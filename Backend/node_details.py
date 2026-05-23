from fastapi import APIRouter, HTTPException, status, Body, Query, Depends
from auth_utils import require_privilege, get_current_user
from fastapi.responses import JSONResponse
from typing import Optional, List
from database import db
from models import NodeDetailsModel, CreateNodeDetailsModel, UpdateNodeDetailsModel, PaginatedNodeDetailsModel
from bson import ObjectId
from datetime import datetime, timezone

router = APIRouter()
collection = db.get_collection("node_details")

def clean_int(value) -> int:
    if value is None:
        return 0
    if isinstance(value, (int, float)):
        return int(value)
    digits = "".join([c for c in str(value) if c.isdigit()])
    return int(digits) if digits else 0

async def compute_node_details_available_resources(doc: dict):
    if not doc:
        return doc
    vms_collection = db.get_collection("vm_details")
    node_name = doc.get("hostName", "")
    
    # Find VMs matching this hostName case-insensitively
    cursor = vms_collection.find({"node": {"$regex": f"^{node_name}$", "$options": "i"}})
    vms = await cursor.to_list(length=None)
    
    used_ram = 0
    used_hdd = 0
    used_cpu = 0
    
    for vm in vms:
        used_ram += clean_int(vm.get("ram"))
        used_hdd += clean_int(vm.get("hdd"))
        used_cpu += clean_int(vm.get("cpu"))
        
    total_ram = clean_int(doc.get("totalRam"))
    total_hdd = clean_int(doc.get("totalHardisk"))
    total_cpu = clean_int(doc.get("totalCpu"))
    
    doc["availableRam"] = max(0, total_ram - used_ram) if doc.get("totalRam") is not None else None
    doc["availableHardisk"] = max(0, total_hdd - used_hdd) if doc.get("totalHardisk") is not None else None
    doc["availableCpu"] = max(0, total_cpu - used_cpu) if doc.get("totalCpu") is not None else None
    
    return doc

@router.get("/", response_description="List all node details", response_model=PaginatedNodeDetailsModel, response_model_by_alias=False, dependencies=[Depends(require_privilege("View Cluster"))])
async def list_items(
    clusterId: str = Query(..., description="The ID of the cluster"),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1),
    pagination: bool = Query(True),
    search: Optional[str] = None
):
    query = {"clusterId": clusterId}
    
    if search:
        query["$or"] = [
            {"hostName": {"$regex": search, "$options": "i"}},
            {"ipAddress": {"$regex": search, "$options": "i"}},
            {"rack": {"$regex": search, "$options": "i"}},
            {"serverModel": {"$regex": search, "$options": "i"}}
        ]

    total = await collection.count_documents(query)
    cursor = collection.find(query).sort("slNumber", 1)
    
    if pagination:
        cursor = cursor.skip(skip).limit(limit)
        items = await cursor.to_list(length=limit)
    else:
        items = await cursor.to_list(length=None)

    items = [await compute_node_details_available_resources(item) for item in items]

    return {"data": items, "total": total}

@router.post("/", response_description="Create node details", response_model=NodeDetailsModel, status_code=status.HTTP_201_CREATED, response_model_by_alias=False, dependencies=[Depends(require_privilege("Create Cluster"))])
async def create_item(
    payload: CreateNodeDetailsModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    item_dict = payload.model_dump()
    item_dict["createdBy"] = current_user.get("sub", "")
    item_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()

    # Auto-populate SL Number safely
    cursor = collection.find({"clusterId": payload.clusterId}, {"slNumber": 1})
    max_sl = 0
    async for doc in cursor:
        sl_str = doc.get("slNumber", "0")
        if isinstance(sl_str, str) and sl_str.isdigit():
            max_sl = max(max_sl, int(sl_str))
        elif isinstance(sl_str, int):
            max_sl = max(max_sl, sl_str)
    
    item_dict["slNumber"] = str(max_sl + 1)

    new_item = await collection.insert_one(item_dict)
    created = await collection.find_one({"_id": new_item.inserted_id})

    # Synchronize node into the global nodes collection
    host_name = item_dict.get("hostName")
    if host_name:
        nodes_collection = db.get_collection("nodes")
        existing_node = await nodes_collection.find_one({"node": {"$regex": f"^{host_name}$", "$options": "i"}})
        node_payload = {
            "node": host_name,
            "remarks": item_dict.get("remarks", ""),
            "totalRam": item_dict.get("totalRam"),
            "totalHardisk": item_dict.get("totalHardisk"),
            "totalCpu": item_dict.get("totalCpu"),
            "createdBy": current_user.get("sub", ""),
            "updatedAt": datetime.now(timezone.utc).isoformat()
        }
        if existing_node:
            await nodes_collection.update_one(
                {"_id": existing_node["_id"]},
                {"$set": {
                    "totalRam": item_dict.get("totalRam"),
                    "totalHardisk": item_dict.get("totalHardisk"),
                    "totalCpu": item_dict.get("totalCpu"),
                    "remarks": item_dict.get("remarks", ""),
                    "updatedAt": datetime.now(timezone.utc).isoformat()
                }}
            )
        else:
            await nodes_collection.insert_one(node_payload)

    return await compute_node_details_available_resources(created)

@router.put("/{id}", response_description="Update node details", response_model=NodeDetailsModel, response_model_by_alias=False, dependencies=[Depends(require_privilege("Update Cluster"))])
async def update_item(id: str, payload: UpdateNodeDetailsModel = Body(...)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    item_dict = {k: v for k, v in payload.model_dump().items() if v is not None}

    if len(item_dict) >= 1:
        item_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()
        
        update_result = await collection.update_one(
            {"_id": ObjectId(id)}, {"$set": item_dict}
        )

        if update_result.modified_count == 1:
            updated = await collection.find_one({"_id": ObjectId(id)})
            if updated is not None:
                # Synchronize node into the global nodes collection
                host_name = updated.get("hostName")
                if host_name:
                    nodes_collection = db.get_collection("nodes")
                    existing_node = await nodes_collection.find_one({"node": {"$regex": f"^{host_name}$", "$options": "i"}})
                    if existing_node:
                        await nodes_collection.update_one(
                            {"_id": existing_node["_id"]},
                            {"$set": {
                                "totalRam": updated.get("totalRam"),
                                "totalHardisk": updated.get("totalHardisk"),
                                "totalCpu": updated.get("totalCpu"),
                                "remarks": updated.get("remarks", ""),
                                "updatedAt": datetime.now(timezone.utc).isoformat()
                            }}
                        )
                    else:
                        node_payload = {
                            "node": host_name,
                            "remarks": updated.get("remarks", ""),
                            "totalRam": updated.get("totalRam"),
                            "totalHardisk": updated.get("totalHardisk"),
                            "totalCpu": updated.get("totalCpu"),
                            "createdBy": "system",
                            "updatedAt": datetime.now(timezone.utc).isoformat()
                        }
                        await nodes_collection.insert_one(node_payload)
                return await compute_node_details_available_resources(updated)

    if (existing := await collection.find_one({"_id": ObjectId(id)})) is not None:
        return await compute_node_details_available_resources(existing)

    raise HTTPException(status_code=404, detail="Node details not found")

@router.delete("/{id}", response_description="Delete node details", dependencies=[Depends(require_privilege("Delete Cluster"))])
async def delete_item(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    delete_result = await collection.delete_one({"_id": ObjectId(id)})

    if delete_result.deleted_count == 1:
        return JSONResponse(status_code=status.HTTP_204_NO_CONTENT)

    raise HTTPException(status_code=404, detail="Node details not found")
