from fastapi import APIRouter, HTTPException, status, Body, Query, Depends, Response
from auth_utils import require_privilege, get_current_user, require_any_privilege
from fastapi.responses import JSONResponse
from typing import Optional, List
from database import db
from models import NodeModel, CreateNodeModel, UpdateNodeModel, PaginatedNodesModel
from bson import ObjectId
from datetime import datetime, timezone

router = APIRouter()
collection = db.get_collection("nodes")

def clean_int(value) -> int:
    if value is None:
        return 0
    if isinstance(value, (int, float)):
        return int(value)
    # extract digits
    digits = "".join([c for c in str(value) if c.isdigit()])
    return int(digits) if digits else 0

async def compute_available_resources(node_doc: dict):
    if not node_doc:
        return node_doc
    vms_collection = db.get_collection("vm_details")
    node_name = node_doc.get("node", "")
    # Find VMs matching the exact node name case-insensitively
    cursor = vms_collection.find({"node": {"$regex": f"^{node_name}$", "$options": "i"}})
    vms = await cursor.to_list(length=None)
    
    used_ram = 0
    used_hdd = 0
    used_cpu = 0
    
    for vm in vms:
        used_ram += clean_int(vm.get("ram"))
        used_hdd += clean_int(vm.get("hdd"))
        used_cpu += clean_int(vm.get("cpu"))
        
    total_ram = clean_int(node_doc.get("totalRam"))
    total_hdd = clean_int(node_doc.get("totalHardisk"))
    total_cpu = clean_int(node_doc.get("totalCpu"))
    
    node_doc["availableRam"] = max(0, total_ram - used_ram) if node_doc.get("totalRam") is not None else None
    node_doc["availableHardisk"] = max(0, total_hdd - used_hdd) if node_doc.get("totalHardisk") is not None else None
    node_doc["availableCpu"] = max(0, total_cpu - used_cpu) if node_doc.get("totalCpu") is not None else None
    
    return node_doc

@router.get("/", response_description="List all nodes", response_model=PaginatedNodesModel, response_model_by_alias=False, dependencies=[Depends(require_any_privilege(["Create Server Details", "View Server Details", "View All Server Details", "Nodes View", "Create Request", "Update Request", "View Request"]))])
async def list_items(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1),
    pagination: bool = Query(True),
    search: Optional[str] = None,
    clusterId: Optional[str] = Query(None),
    serverModel: Optional[str] = Query(None),
    admin: Optional[str] = Query(None),
    rack: Optional[str] = Query(None),
    sortBy: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    order: str = Query("asc"),
    current_user: dict = Depends(get_current_user)
):
    query = {}
    
    privs = current_user.get("privileges", [])
    can_view_all = current_user.get("isSuperuser", False) or "View All Server Details" in privs or "Create Server Details" in privs
    if not can_view_all:
        target_username = current_user.get("sub")
        users_col = db.get_collection("users")
        user_doc = await users_col.find_one({"username": target_username})
        target_user_id = str(user_doc["_id"]) if user_doc else None
        admins = [target_username]
        if target_user_id:
            admins.append(target_user_id)
        query["admin"] = {"$in": admins}
    
    
    if clusterId:
        cluster_doc = await db.get_collection("clusters").find_one({"_id": ObjectId(clusterId) if ObjectId.is_valid(clusterId) else clusterId})
        if cluster_doc:
            node_ids = cluster_doc.get("nodes", [])
            object_ids = []
            for nid in node_ids:
                if ObjectId.is_valid(nid):
                    object_ids.append(ObjectId(nid))
                else:
                    object_ids.append(nid)
            query["$or"] = [
                {"_id": {"$in": object_ids}},
                {"clusterId": clusterId}
            ]
        else:
            query["clusterId"] = clusterId
    
    if serverModel:
        query["serverModel"] = serverModel
    
    if admin:
        if "admin" not in query:
            users_col_adm = db.get_collection("users")
            adm_doc = await users_col_adm.find_one({"username": admin})
            if not adm_doc and ObjectId.is_valid(admin):
                adm_doc = await users_col_adm.find_one({"_id": ObjectId(admin)})
            admin_vals = set()
            admin_vals.add(admin)
            if adm_doc:
                admin_vals.add(str(adm_doc["_id"]))
                if adm_doc.get("username"):
                    admin_vals.add(adm_doc["username"])
            query["admin"] = {"$in": list(admin_vals)}
    
    if rack:
        query["rack"] = rack
    
    if search:
        query["$or"] = [
            {"node": {"$regex": search, "$options": "i"}},
            {"nodeId": {"$regex": search, "$options": "i"}},
            {"custodian": {"$regex": search, "$options": "i"}},
            {"admin": {"$regex": search, "$options": "i"}},
            {"assetNumber": {"$regex": search, "$options": "i"}},
            {"serialNumber": {"$regex": search, "$options": "i"}},
            {"serverModel": {"$regex": search, "$options": "i"}},
            {"rack": {"$regex": search, "$options": "i"}},
            {"rackPosition": {"$regex": search, "$options": "i"}},
            {"remarks": {"$regex": search, "$options": "i"}}
        ]

    actual_sort_by = sortBy or sort_by or "node"
    sort_order = 1 if order == "asc" else -1

    total = await collection.count_documents(query)
    cursor = collection.find(query).sort(actual_sort_by, sort_order)
    
    if pagination:
        cursor = cursor.skip(skip).limit(limit)
        items = await cursor.to_list(length=limit)
    else:
        items = await cursor.to_list(length=None)

    items = [await compute_available_resources(item) for item in items]

    return {"data": items, "total": total}

@router.post("/", response_description="Create a node", response_model=NodeModel, status_code=status.HTTP_201_CREATED, response_model_by_alias=False, dependencies=[Depends(require_privilege("Create Server Details"))])
async def create_item(
    payload: CreateNodeModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    if payload.node:
        existing = await collection.find_one({ "node": {"$regex": f"^{payload.node}$", "$options": "i"} })
        if existing:
            raise HTTPException(status_code=400, detail="Node already exists")

    item_dict = payload.model_dump()
    item_dict["createdBy"] = current_user.get("sub", "")
    item_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()
    
    max_node_id = 0
    cursor = collection.find({}, {"nodeId": 1})
    async for doc in cursor:
        nid = str(doc.get("nodeId", ""))
        digits = "".join(c for c in nid if c.isdigit())
        if digits:
            try:
                max_node_id = max(max_node_id, int(digits))
            except:
                pass
    item_dict["nodeId"] = f"{max_node_id + 1:03d}"

    new_item = await collection.insert_one(item_dict)
    created = await collection.find_one({"_id": new_item.inserted_id})
    return await compute_available_resources(created)

@router.put("/{id}", response_description="Update a node", response_model=NodeModel, response_model_by_alias=False, dependencies=[Depends(require_privilege("Create Server Details"))])
async def update_item(id: str, payload: UpdateNodeModel = Body(...)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    item_dict = {k: v for k, v in payload.model_dump().items() if v is not None}

    if len(item_dict) >= 1:
        if "node" in item_dict and item_dict["node"]:
            existing = await collection.find_one({
                "node": {"$regex": f"^{item_dict['node']}$", "$options": "i"},
                "_id": {"$ne": ObjectId(id)}
            })
            if existing:
                raise HTTPException(status_code=400, detail="Node already exists")

        item_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()
        
        update_result = await collection.update_one(
            {"_id": ObjectId(id)}, {"$set": item_dict}
        )

        if update_result.modified_count == 1:
            if (updated := await collection.find_one({"_id": ObjectId(id)})) is not None:
                return await compute_available_resources(updated)

    if (existing := await collection.find_one({"_id": ObjectId(id)})) is not None:
        return await compute_available_resources(existing)

    raise HTTPException(status_code=404, detail=f"Node {id} not found")

@router.delete("/{id}", response_description="Delete a node", dependencies=[Depends(require_privilege("Create Server Details"))])
async def delete_item(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    delete_result = await collection.delete_one({"_id": ObjectId(id)})

    if delete_result.deleted_count == 1:
        # Remove this node from any cluster's nodes list
        clusters_col = db.get_collection("clusters")
        await clusters_col.update_many(
            {"nodes": id},
            {"$pull": {"nodes": id}}
        )
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    raise HTTPException(status_code=404, detail=f"Node {id} not found")
