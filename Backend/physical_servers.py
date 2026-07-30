from fastapi import APIRouter, HTTPException, status, Body, Query, Depends, Response
from auth_utils import require_privilege, require_any_privilege, get_current_user
from fastapi.responses import JSONResponse
from typing import Optional, List
from database import db
from models import PhysicalServerModel, CreatePhysicalServerModel, UpdatePhysicalServerModel, PaginatedPhysicalServersModel
from bson import ObjectId
from datetime import datetime, timezone
import re

router = APIRouter()
collection = db.get_collection("physical_servers")

async def sync_node_resources(node_name: str):
    if not node_name:
        return
    
    physical_servers_collection = db.get_collection("physical_servers")
    cursor = physical_servers_collection.find({"node": {"$regex": f"^{node_name}$", "$options": "i"}})
    servers = await cursor.to_list(length=None)
    
    def clean_int(value) -> int:
        if value is None:
            return 0
        if isinstance(value, (int, float)):
            return int(value)
        digits = "".join([c for c in str(value) if c.isdigit()])
        return int(digits) if digits else 0
        
    used_ram = 0
    used_hdd = 0
    used_cpu = 0
    for server in servers:
        used_ram += clean_int(server.get("ram"))
        used_hdd += clean_int(server.get("hdd"))
        used_cpu += clean_int(server.get("cpu"))
        
    # Update node_details collection
    nd_collection = db.get_collection("node_details")
    nd_cursor = nd_collection.find({"hostName": {"$regex": f"^{node_name}$", "$options": "i"}})
    nodes_nd = await nd_cursor.to_list(length=None)
    for node in nodes_nd:
        total_ram = clean_int(node.get("totalRam"))
        total_hdd = clean_int(node.get("totalHardisk"))
        total_cpu = clean_int(node.get("totalCpu"))
        
        await nd_collection.update_one(
            {"_id": node["_id"]},
            {"$set": {
                "availableRam": max(0, total_ram - used_ram) if node.get("totalRam") is not None else None,
                "availableHardisk": max(0, total_hdd - used_hdd) if node.get("totalHardisk") is not None else None,
                "availableCpu": max(0, total_cpu - used_cpu) if node.get("totalCpu") is not None else None,
            }}
        )
        
    # Update global nodes collection
    nodes_collection = db.get_collection("nodes")
    node_cursor = nodes_collection.find({"node": {"$regex": f"^{node_name}$", "$options": "i"}})
    global_nodes = await node_cursor.to_list(length=None)
    for node in global_nodes:
        total_ram = clean_int(node.get("totalRam"))
        total_hdd = clean_int(node.get("totalHardisk"))
        total_cpu = clean_int(node.get("totalCpu"))
        
        await nodes_collection.update_one(
            {"_id": node["_id"]},
            {"$set": {
                "availableRam": max(0, total_ram - used_ram) if node.get("totalRam") is not None else None,
                "availableHardisk": max(0, total_hdd - used_hdd) if node.get("totalHardisk") is not None else None,
                "availableCpu": max(0, total_cpu - used_cpu) if node.get("totalCpu") is not None else None,
            }}
        )

@router.get("/", response_description="List all physical servers", response_model=PaginatedPhysicalServersModel, response_model_by_alias=False, dependencies=[Depends(require_any_privilege(["Create Server Details", "View Server Details", "View All Server Details", "Physical Server View", "Create Request", "Update Request", "View Request"]))])
async def list_items(
    clusterId: Optional[str] = Query(None, description="The ID of the cluster"),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1),
    pagination: bool = Query(True),
    search: Optional[str] = None,
    sortBy: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    order: str = Query("desc"),
    current_user: dict = Depends(get_current_user)
):
    query = {}
    
    privs = current_user.get("privileges", [])
    can_view_all = current_user.get("isSuperuser", False) or "View All Server Details" in privs
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
        query["clusterId"] = clusterId
    
    if search:
        terms = search.strip().split()
        if terms:
            # Cross-entity lookup: find clusters matching any search term
            cluster_queries = []
            for term in terms:
                cluster_queries.append({"clusterName": {"$regex": re.escape(term), "$options": "i"}})
            clusters_col = db.get_collection("clusters")
            matching_clusters = await clusters_col.find({"$or": cluster_queries}, {"_id": 1}).to_list(length=None)
            matching_cluster_ids = [str(doc["_id"]) for doc in matching_clusters]

            term_queries = []
            for term in terms:
                escaped_term = re.escape(term)
                
                or_conditions = [
                    {"ipAddress": {"$regex": escaped_term, "$options": "i"}},
                    {"applications": {"$regex": escaped_term, "$options": "i"}},
                    {"node": {"$regex": escaped_term, "$options": "i"}},
                    {"ram": {"$regex": escaped_term, "$options": "i"}},
                    {"hdd": {"$regex": escaped_term, "$options": "i"}},
                    {"cpu": {"$regex": escaped_term, "$options": "i"}},
                    {"backupLocation": {"$regex": escaped_term, "$options": "i"}},
                    {"adminName": {"$regex": escaped_term, "$options": "i"}},
                    {"adminContact": {"$regex": escaped_term, "$options": "i"}},
                    {"remarks": {"$regex": escaped_term, "$options": "i"}},
                    {"createdBy": {"$regex": escaped_term, "$options": "i"}},
                    {"createdAt": {"$regex": escaped_term, "$options": "i"}},
                    {"updatedAt": {"$regex": escaped_term, "$options": "i"}},
                ]

                if matching_cluster_ids:
                    or_conditions.append({"clusterId": {"$in": matching_cluster_ids}})

                term_queries.append({"$or": or_conditions})
            query["$and"] = term_queries

    actual_sort_by = sortBy or sort_by or "createdAt"
    sort_order = 1 if order == "asc" else -1

    total = await collection.count_documents(query)
    cursor = collection.find(query).sort(actual_sort_by, sort_order)
    
    if pagination:
        cursor = cursor.skip(skip).limit(limit)
        items = await cursor.to_list(length=limit)
    else:
        items = await cursor.to_list(length=None)

    return {"data": items, "total": total}

@router.post("/", response_description="Create physical server details", response_model=PhysicalServerModel, status_code=status.HTTP_201_CREATED, response_model_by_alias=False, dependencies=[Depends(require_privilege("Create Server Details"))])
async def create_item(
    payload: CreatePhysicalServerModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    item_dict = payload.model_dump()
    item_dict["createdBy"] = current_user.get("sub", "")
    item_dict["createdAt"] = datetime.now(timezone.utc).isoformat()
    item_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()

    new_item = await collection.insert_one(item_dict)
    created = await collection.find_one({"_id": new_item.inserted_id})
    if created and created.get("node"):
        await sync_node_resources(created["node"])
    return created

@router.put("/{id}", response_description="Update physical server details", response_model=PhysicalServerModel, response_model_by_alias=False, dependencies=[Depends(require_privilege("Create Server Details"))])
async def update_item(id: str, payload: UpdatePhysicalServerModel = Body(...), current_user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    old_server = await collection.find_one({"_id": ObjectId(id)})
    old_node = old_server.get("node") if old_server else None

    item_dict = {k: v for k, v in payload.model_dump().items() if v is not None}

    if len(item_dict) >= 1:
        item_dict["updatedBy"] = current_user.get("sub", "")
        item_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()
        
        update_result = await collection.update_one(
            {"_id": ObjectId(id)}, {"$set": item_dict}
        )

        if update_result.modified_count == 1:
            if (updated := await collection.find_one({"_id": ObjectId(id)})) is not None:
                if old_node:
                    await sync_node_resources(old_node)
                new_node = updated.get("node")
                if new_node and new_node != old_node:
                    await sync_node_resources(new_node)
                return updated

    if (existing := await collection.find_one({"_id": ObjectId(id)})) is not None:
        return existing

    raise HTTPException(status_code=404, detail="Physical server details not found")

@router.delete("/{id}", response_description="Delete physical server details", dependencies=[Depends(require_privilege("Create Server Details"))])
async def delete_item(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    server = await collection.find_one({"_id": ObjectId(id)})
    node_name = server.get("node") if server else None

    delete_result = await collection.delete_one({"_id": ObjectId(id)})

    if delete_result.deleted_count == 1:
        if node_name:
            await sync_node_resources(node_name)
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    raise HTTPException(status_code=404, detail="Physical server details not found")
