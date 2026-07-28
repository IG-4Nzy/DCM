from fastapi import APIRouter, HTTPException, Query, Depends, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import re
from bson import ObjectId

from database import db
from models import DatastoreModel, CreateDatastoreModel, UpdateDatastoreModel, PaginatedDatastoresModel
from auth_utils import get_current_user

router = APIRouter()
collection = db.get_collection("datastores")

@router.get("/", response_description="List all datastores", response_model=PaginatedDatastoresModel, response_model_by_alias=False)
async def list_datastores(
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
    if search:
        search_regex = {"$regex": re.escape(search), "$options": "i"}
        query = {
            "$or": [
                {"name": search_regex},
                {"type": search_regex},
                {"capacity": search_regex},
                {"createdBy": search_regex},
            ]
        }

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
async def create_datastore(payload: CreateDatastoreModel, current_user: dict = Depends(get_current_user)):
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
    return created

@router.put("/{id}", response_description="Update a datastore", response_model=DatastoreModel, response_model_by_alias=False)
async def update_datastore(id: str, payload: UpdateDatastoreModel, current_user: dict = Depends(get_current_user)):
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
    return updated

@router.delete("/{id}", response_description="Delete a datastore")
async def delete_datastore(id: str, current_user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    delete_result = await collection.delete_one({"_id": ObjectId(id)})
    if delete_result.deleted_count == 1:
        return JSONResponse(status_code=status.HTTP_200_OK, content={"message": "Datastore deleted successfully"})

    raise HTTPException(status_code=404, detail=f"Datastore {id} not found")
