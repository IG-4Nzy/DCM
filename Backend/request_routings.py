from fastapi import APIRouter, HTTPException, status, Body, Query, Depends
from auth_utils import get_current_user
from fastapi.responses import JSONResponse
from typing import Optional
from database import db
from models import (
    RequestRoutingModel,
    CreateRequestRoutingModel,
    UpdateRequestRoutingModel,
    PaginatedRequestRoutingsModel,
)
from bson import ObjectId
from datetime import datetime, timezone

router = APIRouter()
collection = db.get_collection("request_routings")


@router.get(
    "/",
    response_description="List all request routings",
    response_model=PaginatedRequestRoutingsModel,
    response_model_by_alias=False,
)
async def list_items(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1),
    pagination: bool = Query(True),
    search: Optional[str] = None,
    sortBy: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    order: str = Query("asc"),
    current_user: dict = Depends(get_current_user),
):
    query = {}
    if search:
        query["requestType"] = {"$regex": search, "$options": "i"}

    actual_sort_by = sortBy or sort_by or "requestType"
    sort_order = 1 if order == "asc" else -1

    total = await collection.count_documents(query)
    cursor = collection.find(query).sort(actual_sort_by, sort_order)

    if pagination:
        cursor = cursor.skip(skip).limit(limit)
        items = await cursor.to_list(length=limit)
    else:
        items = await cursor.to_list(length=None)

    return {"data": items, "total": total}


@router.post(
    "/",
    response_description="Create a request routing",
    response_model=RequestRoutingModel,
    status_code=status.HTTP_201_CREATED,
    response_model_by_alias=False,
)
async def create_item(
    payload: CreateRequestRoutingModel = Body(...),
    current_user: dict = Depends(get_current_user),
):
    # Prevent duplicates
    existing = await collection.find_one({"requestType": payload.requestType})
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Routing for '{payload.requestType}' already exists",
        )

    item_dict = payload.model_dump()
    new_item = await collection.insert_one(item_dict)
    created = await collection.find_one({"_id": new_item.inserted_id})
    return created


@router.put(
    "/{id}",
    response_description="Update a request routing",
    response_model=RequestRoutingModel,
    response_model_by_alias=False,
)
async def update_item(
    id: str,
    payload: UpdateRequestRoutingModel = Body(...),
    current_user: dict = Depends(get_current_user),
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    item_dict = {k: v for k, v in payload.model_dump().items() if v is not None}

    if len(item_dict) >= 1:
        update_result = await collection.update_one(
            {"_id": ObjectId(id)}, {"$set": item_dict}
        )

        if update_result.modified_count == 1:
            if (
                updated := await collection.find_one({"_id": ObjectId(id)})
            ) is not None:
                return updated

    if (existing := await collection.find_one({"_id": ObjectId(id)})) is not None:
        return existing

    raise HTTPException(status_code=404, detail=f"Request routing {id} not found")


@router.delete("/{id}", response_description="Delete a request routing")
async def delete_item(
    id: str, current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    delete_result = await collection.delete_one({"_id": ObjectId(id)})

    if delete_result.deleted_count == 1:
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={"message": "Deleted successfully"},
        )

    raise HTTPException(status_code=404, detail=f"Request routing {id} not found")
