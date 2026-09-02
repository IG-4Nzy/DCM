from fastapi import APIRouter, HTTPException, Query, Depends, status, Request
from fastapi.responses import JSONResponse
from typing import Optional
from datetime import datetime, timezone
import re
from bson import ObjectId

from database import db
from models import DatastoreModel, CreateDatastoreModel, UpdateDatastoreModel, PaginatedDatastoresModel
from auth_utils import get_current_user
from history_helper import record_audit_log, compute_diff_details, get_client_ip

router = APIRouter()
collection = db.get_collection("datastores")

@router.get("/", response_description="List all datastores", response_model=PaginatedDatastoresModel, response_model_by_alias=False)
async def list_datastores(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1),
    pagination: bool = Query(True),
    search: Optional[str] = None,
    type: Optional[str] = Query(None),
    sortBy: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    order: str = Query("desc"),
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if type:
        query["type"] = {"$regex": f"^{re.escape(type)}$", "$options": "i"}

    if search:
        search_parts = [p.strip() for p in search.split(",") if p.strip()]
        if not search_parts:
            search_parts = [search.strip()]
            
        from search_utils import resolve_search_references
        
        all_or_conditions = []
        for part in search_parts:
            _, _, _, matched_ips = await resolve_search_references(part)
            
            search_regex = {"$regex": re.escape(part), "$options": "i"}
            or_conditions = [
                {"name": search_regex},
                {"type": search_regex},
                {"node": search_regex},
                {"mountPath": search_regex},
                {"capacity": search_regex},
                {"remarks": search_regex},
                {"createdBy": search_regex},
            ]
            
            if matched_ips:
                or_conditions.append({"node": {"$in": matched_ips}})
                
            all_or_conditions.extend(or_conditions)
            
        if all_or_conditions:
            search_condition = {"$or": all_or_conditions}
            
            if query:
                query = {"$and": [query, search_condition]}
            else:
                query = search_condition

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

@router.post("/", response_description="Create a datastore", response_model=DatastoreModel, status_code=status.HTTP_201_CREATED, response_model_by_alias=False)
async def create_datastore(
    request: Request,
    payload: CreateDatastoreModel,
    current_user: dict = Depends(get_current_user)
):
    item_dict = payload.model_dump()
    item_dict["createdBy"] = current_user.get("sub", "")
    now = datetime.now(timezone.utc).isoformat()
    item_dict["createdAt"] = now
    item_dict["updatedAt"] = now

    existing = await collection.find_one({"name": {"$regex": f"^{re.escape(payload.name)}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=400, detail="Datastore with this name already exists")

    new_item = await collection.insert_one(item_dict)
    created = await collection.find_one({"_id": new_item.inserted_id})

    if created:
        actor_name = current_user.get("sub") or current_user.get("username") or "Unknown"
        actor_ip = get_client_ip(request)
        await record_audit_log(
            request=request,
            current_user=current_user,
            action=f"Create Datastore: {created.get('name')}",
            details=f"Datastore '{created.get('name')}' (Type: {created.get('type', '--')}, Node: {created.get('node', '--')}) created by '{actor_name}' from IP {actor_ip}",
            after_state=created
        )

    return created

@router.put("/{id}", response_description="Update a datastore", response_model=DatastoreModel, response_model_by_alias=False)
async def update_datastore(
    id: str,
    request: Request,
    payload: UpdateDatastoreModel,
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    existing = await collection.find_one({"_id": ObjectId(id)})
    if not existing:
        raise HTTPException(status_code=404, detail=f"Datastore {id} not found")

    if payload.name:
        existing_name = await collection.find_one({"name": {"$regex": f"^{re.escape(payload.name)}$", "$options": "i"}, "_id": {"$ne": ObjectId(id)}})
        if existing_name:
            raise HTTPException(status_code=400, detail="Datastore with this name already exists")

    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    update_data["updatedBy"] = current_user.get("sub", "")
    update_data["updatedAt"] = datetime.now(timezone.utc).isoformat()

    await collection.update_one({"_id": ObjectId(id)}, {"$set": update_data})
    updated = await collection.find_one({"_id": ObjectId(id)})

    if updated:
        actor_name = current_user.get("sub") or current_user.get("username") or "Unknown"
        actor_ip = get_client_ip(request)
        diff_text = compute_diff_details(existing, updated)
        await record_audit_log(
            request=request,
            current_user=current_user,
            action=f"Update Datastore: {existing.get('name')}",
            details=f"Updated fields for datastore '{existing.get('name')}': {diff_text} by '{actor_name}' from IP {actor_ip}",
            before_state=existing,
            after_state=updated
        )

    return updated

@router.delete("/{id}", response_description="Delete a datastore")
async def delete_datastore(
    id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    existing = await collection.find_one({"_id": ObjectId(id)})
    if not existing:
        raise HTTPException(status_code=404, detail=f"Datastore {id} not found")

    delete_result = await collection.delete_one({"_id": ObjectId(id)})
    if delete_result.deleted_count == 1:
        actor_name = current_user.get("sub") or current_user.get("username") or "Unknown"
        actor_ip = get_client_ip(request)
        await record_audit_log(
            request=request,
            current_user=current_user,
            action=f"Delete Datastore: {existing.get('name')}",
            details=f"Deleted datastore '{existing.get('name')}' (ID: {id}) by '{actor_name}' from IP {actor_ip}",
            before_state=existing
        )
        return JSONResponse(status_code=status.HTTP_200_OK, content={"message": "Datastore deleted successfully"})

    raise HTTPException(status_code=404, detail=f"Datastore {id} not found")
