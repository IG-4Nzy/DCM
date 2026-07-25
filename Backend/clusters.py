from fastapi import APIRouter, HTTPException, status, Body, Query, Depends, UploadFile, File, Response
from auth_utils import require_privilege, require_any_privilege, get_current_user
from fastapi.responses import JSONResponse
from typing import Optional, List
from database import db
from models import ClusterModel, CreateClusterModel, UpdateClusterModel, PaginatedClustersModel
from bson import ObjectId
from datetime import datetime, timezone
import re
import openpyxl
import io
import csv

router = APIRouter()
collection = db.get_collection("clusters")
node_collection = db.get_collection("nodes")

def parse_sl_number(value) -> int:
    if value is None:
        return 0
    if isinstance(value, (int, float)):
        return int(value)
    value_str = str(value).strip()
    try:
        return int(float(value_str))
    except ValueError:
        digits = "".join(c for c in value_str if c.isdigit())
        return int(digits) if digits else 0

async def resolve_node_names(items):
    """Resolve node IDs in clusters to node names for display, adding a nodeNames field."""
    all_node_ids = set()
    for item in items:
        for nid in item.get("nodes", []):
            if nid and ObjectId.is_valid(nid):
                all_node_ids.add(nid)

    if not all_node_ids:
        for item in items:
            item["nodeNames"] = []
        return items

    # Batch fetch all referenced nodes
    object_ids = [ObjectId(nid) for nid in all_node_ids]
    nodes = await node_collection.find(
        {"_id": {"$in": object_ids}},
        {"node": 1}
    ).to_list(length=None)
    id_to_name = {}
    for n in nodes:
        node_val = n.get("node")
        id_to_name[str(n["_id"])] = str(node_val) if node_val is not None else str(n["_id"])

    for item in items:
        raw_nodes = item.get("nodes", []) or []
        resolved = []
        for nid in raw_nodes:
            if not nid:
                continue
            name = id_to_name.get(str(nid)) or str(nid)
            if name:
                resolved.append(name)
        item["nodeNames"] = resolved

    return items

@router.get("/", response_description="List all clusters", response_model=PaginatedClustersModel, response_model_by_alias=False, dependencies=[Depends(require_any_privilege(["Create Server Details", "View Server Details", "View All Server Details", "Cluster View", "Create Request", "Update Request", "View Request"]))])
async def list_items(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1),
    pagination: bool = Query(True),
    search: Optional[str] = None,
    sortBy: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    order: str = Query("asc")
):
    query = {}
    
    if search:
        terms = search.strip().split()
        if terms:
            term_queries = []
            for term in terms:
                escaped_term = re.escape(term)
                term_queries.append({
                    "$or": [
                        {"clusterName": {"$regex": escaped_term, "$options": "i"}},
                        {"ipAddress": {"$regex": escaped_term, "$options": "i"}},
                        {"slNumber": {"$regex": escaped_term, "$options": "i"}},
                        {"remarks": {"$regex": escaped_term, "$options": "i"}},
                        {"createdBy": {"$regex": escaped_term, "$options": "i"}},
                        {"updatedAt": {"$regex": escaped_term, "$options": "i"}},
                    ]
                })
            query["$and"] = term_queries

    actual_sort_by = sortBy or sort_by or "slNumber"
    sort_order = 1 if order == "asc" else -1

    total = await collection.count_documents(query)

    if actual_sort_by == "slNumber":
        pipeline = [
            {"$match": query},
            {
                "$addFields": {
                    "_slNumberSort": {
                        "$convert": {
                            "input": "$slNumber",
                            "to": "int",
                            "onError": 0,
                            "onNull": 0,
                        }
                    }
                }
            },
            {"$sort": {"_slNumberSort": sort_order}},
        ]
        if pagination:
            pipeline.extend([{"$skip": skip}, {"$limit": limit}])
        pipeline.append({"$project": {"_slNumberSort": 0}})
        items = await collection.aggregate(pipeline).to_list(length=limit if pagination else None)
    else:
        cursor = collection.find(query).sort(actual_sort_by, sort_order)
        if pagination:
            cursor = cursor.skip(skip).limit(limit)
            items = await cursor.to_list(length=limit)
        else:
            items = await cursor.to_list(length=None)

    items = await resolve_node_names(items)

    return {"data": items, "total": total}

@router.post("/", response_description="Create cluster", response_model=ClusterModel, status_code=status.HTTP_201_CREATED, response_model_by_alias=False, dependencies=[Depends(require_privilege("Create Server Details"))])
async def create_item(
    payload: CreateClusterModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    existing = await collection.find_one({"clusterName": {"$regex": f"^{payload.clusterName}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=400, detail=f"Cluster with name '{payload.clusterName}' already exists")

    item_dict = payload.model_dump()
    item_dict["createdBy"] = current_user.get("sub", "")
    item_dict["createdAt"] = datetime.now(timezone.utc).isoformat()
    item_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()

    # Auto-populate SL Number safely
    cursor = collection.find({}, {"slNumber": 1})
    max_sl = 0
    async for doc in cursor:
        max_sl = max(max_sl, parse_sl_number(doc.get("slNumber", "0")))
    
    item_dict["slNumber"] = str(max_sl + 1)

    new_item = await collection.insert_one(item_dict)
    created = await collection.find_one({"_id": new_item.inserted_id})

    # Sync clusterId on assigned nodes
    node_ids = item_dict.get("nodes", [])
    if node_ids:
        cluster_id_str = str(new_item.inserted_id)
        for nid in node_ids:
            if ObjectId.is_valid(nid):
                await node_collection.update_one(
                    {"_id": ObjectId(nid)},
                    {"$set": {"clusterId": cluster_id_str}}
                )

    return created

@router.put("/{id}", response_description="Update cluster", response_model=ClusterModel, response_model_by_alias=False, dependencies=[Depends(require_privilege("Create Server Details"))])
async def update_item(id: str, payload: UpdateClusterModel = Body(...), current_user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    item_dict = {k: v for k, v in payload.model_dump().items() if v is not None}

    if "clusterName" in item_dict:
        existing = await collection.find_one({
            "clusterName": {"$regex": f"^{item_dict['clusterName']}$", "$options": "i"},
            "_id": {"$ne": ObjectId(id)}
        })
        if existing:
            raise HTTPException(status_code=400, detail=f"Cluster with name '{item_dict['clusterName']}' already exists")

    # Sync clusterId on nodes if nodes list is being updated
    if "nodes" in item_dict:
        old_cluster = await collection.find_one({"_id": ObjectId(id)})
        old_nodes = set(old_cluster.get("nodes", [])) if old_cluster else set()
        new_nodes = set(item_dict.get("nodes", []))

        # Nodes removed from this cluster: clear their clusterId
        removed = old_nodes - new_nodes
        for nid in removed:
            if ObjectId.is_valid(nid):
                await node_collection.update_one(
                    {"_id": ObjectId(nid)},
                    {"$set": {"clusterId": ""}}
                )

        # Nodes added to this cluster: set their clusterId
        added = new_nodes - old_nodes
        for nid in added:
            if ObjectId.is_valid(nid):
                # Remove from any other cluster's nodes list first
                await collection.update_many(
                    {"nodes": nid, "_id": {"$ne": ObjectId(id)}},
                    {"$pull": {"nodes": nid}}
                )
                await node_collection.update_one(
                    {"_id": ObjectId(nid)},
                    {"$set": {"clusterId": id}}
                )

    if len(item_dict) >= 1:
        item_dict["updatedBy"] = current_user.get("sub", "")
        item_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()
        
        update_result = await collection.update_one(
            {"_id": ObjectId(id)}, {"$set": item_dict}
        )

        if update_result.modified_count == 1:
            if (updated := await collection.find_one({"_id": ObjectId(id)})) is not None:
                return updated

    if (existing := await collection.find_one({"_id": ObjectId(id)})) is not None:
        return existing

    raise HTTPException(status_code=404, detail="Cluster not found")

@router.delete("/{id}", response_description="Delete cluster", dependencies=[Depends(require_privilege("Create Server Details"))])
async def delete_item(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    # Clear clusterId from nodes that belong to this cluster
    cluster_doc = await collection.find_one({"_id": ObjectId(id)})
    if cluster_doc:
        for nid in cluster_doc.get("nodes", []):
            if ObjectId.is_valid(nid):
                await node_collection.update_one(
                    {"_id": ObjectId(nid)},
                    {"$set": {"clusterId": ""}}
                )

    delete_result = await collection.delete_one({"_id": ObjectId(id)})

    if delete_result.deleted_count == 1:
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    raise HTTPException(status_code=404, detail="Cluster not found")

@router.post("/bulk", response_description="Bulk create clusters", dependencies=[Depends(require_privilege("Create Server Details"))])
async def bulk_create_clusters(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    username = current_user.get("sub", "Unknown")
    
    if not file.filename.endswith((".xlsx", ".csv")):
        raise HTTPException(status_code=400, detail="Only .xlsx or .csv files are supported")
        
    content = await file.read()
    items_to_insert = []
    
    cursor = collection.find({}, {"slNumber": 1})
    max_sl = 0
    async for doc in cursor:
        max_sl = max(max_sl, parse_sl_number(doc.get("slNumber", "0")))
            
    next_sl = max_sl + 1
    current_time = datetime.now(timezone.utc).isoformat()
    
    try:
        seen_names = set()
        if file.filename.endswith(".xlsx"):
            wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
            sheet = wb.active
            rows = list(sheet.iter_rows(values_only=True))
            if not rows or len(rows) < 2:
                raise HTTPException(status_code=400, detail="Excel file is empty or missing headers")
                
            headers = [str(h).lower().strip() for h in rows[0]]
            
            name_idx = next((i for i, h in enumerate(headers) if "name" in h or "cluster" in h), -1)
            ip_idx = next((i for i, h in enumerate(headers) if "ip" in h or "address" in h), -1)
            
            if name_idx == -1 or ip_idx == -1:
                raise HTTPException(status_code=400, detail="Could not find 'Cluster Name' and 'IP Address' columns")
                
            for row in rows[1:]:
                name = row[name_idx]
                ip = row[ip_idx]
                
                if not name or not ip:
                    continue
                
                name_str = str(name).strip()
                name_lower = name_str.lower()
                
                if name_lower in seen_names:
                    raise HTTPException(status_code=400, detail=f"Duplicate cluster name '{name_str}' found in the file")
                seen_names.add(name_lower)
                
                existing = await collection.find_one({"clusterName": {"$regex": f"^{name_str}$", "$options": "i"}})
                if existing:
                    raise HTTPException(status_code=400, detail=f"Cluster with name '{name_str}' already exists")
                    
                items_to_insert.append({
                    "slNumber": str(next_sl),
                    "clusterName": name_str,
                    "ipAddress": str(ip).strip(),
                    "createdBy": username,
                    "updatedAt": current_time
                })
                next_sl += 1
        else:
            decoded = content.decode("utf-8")
            reader = csv.reader(decoded.splitlines())
            rows = list(reader)
            if not rows or len(rows) < 2:
                raise HTTPException(status_code=400, detail="CSV file is empty or missing headers")
                
            headers = [str(h).lower().strip() for h in rows[0]]
            
            name_idx = next((i for i, h in enumerate(headers) if "name" in h or "cluster" in h), -1)
            ip_idx = next((i for i, h in enumerate(headers) if "ip" in h or "address" in h), -1)
            
            if name_idx == -1 or ip_idx == -1:
                raise HTTPException(status_code=400, detail="Could not find 'Cluster Name' and 'IP Address' columns")
                
            for row in rows[1:]:
                if len(row) <= max(name_idx, ip_idx):
                    continue
                name = row[name_idx]
                ip = row[ip_idx]
                
                if not name or not ip:
                    continue
                
                name_str = str(name).strip()
                name_lower = name_str.lower()
                
                if name_lower in seen_names:
                    raise HTTPException(status_code=400, detail=f"Duplicate cluster name '{name_str}' found in the file")
                seen_names.add(name_lower)
                
                existing = await collection.find_one({"clusterName": {"$regex": f"^{name_str}$", "$options": "i"}})
                if existing:
                    raise HTTPException(status_code=400, detail=f"Cluster with name '{name_str}' already exists")
                    
                items_to_insert.append({
                    "slNumber": str(next_sl),
                    "clusterName": name_str,
                    "ipAddress": str(ip).strip(),
                    "createdBy": username,
                    "updatedAt": current_time
                })
                next_sl += 1
                
        if items_to_insert:
            await collection.insert_many(items_to_insert)
            
        return {"message": f"Successfully created {len(items_to_insert)} clusters"}
        
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing file: {str(e)}")
