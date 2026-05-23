from fastapi import APIRouter, HTTPException, status, Body, Query, Depends
from auth_utils import require_privilege, get_current_user
from fastapi.responses import JSONResponse
from typing import Optional
from database import db
from models import RequestModel, CreateRequestModel, UpdateRequestModel, PaginatedRequestsModel
from bson import ObjectId
from datetime import datetime, timezone

router = APIRouter()
collection = db.get_collection("requests")

@router.get("/", response_description="List all requests", response_model=PaginatedRequestsModel, response_model_by_alias=False)
async def list_items(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1),
    pagination: bool = Query(True),
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    
    is_superuser = current_user.get("isSuperuser", False)
    if not is_superuser:
        # For simplicity, non-superusers can only see their own requests unless they have a specific privilege.
        query["createdBy"] = current_user.get("sub", "")
    
    if search:
        query["requestType"] = {"$regex": search, "$options": "i"}

    total = await collection.count_documents(query)
    cursor = collection.find(query).sort("createdAt", -1)
    
    if pagination:
        cursor = cursor.skip(skip).limit(limit)
        items = await cursor.to_list(length=limit)
    else:
        items = await cursor.to_list(length=None)

    return {"data": items, "total": total}

@router.post("/", response_description="Create a request", response_model=RequestModel, status_code=status.HTTP_201_CREATED, response_model_by_alias=False)
async def create_item(
    payload: CreateRequestModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    item_dict = payload.model_dump()
    item_dict["createdBy"] = current_user.get("sub", "")
    now = datetime.now(timezone.utc).isoformat()
    item_dict["createdAt"] = now
    item_dict["updatedAt"] = now
    item_dict["status"] = "Pending"

    new_item = await collection.insert_one(item_dict)
    created = await collection.find_one({"_id": new_item.inserted_id})
    return created

@router.put("/{id}", response_description="Update a request", response_model=RequestModel, response_model_by_alias=False)
async def update_item(id: str, payload: UpdateRequestModel = Body(...), current_user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    item_dict = {k: v for k, v in payload.model_dump().items() if v is not None}

    if len(item_dict) >= 1:
        item_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()
        
        update_result = await collection.update_one(
            {"_id": ObjectId(id)}, {"$set": item_dict}
        )

        if update_result.modified_count == 1:
            if (updated := await collection.find_one({"_id": ObjectId(id)})) is not None:
                return updated

    if (existing := await collection.find_one({"_id": ObjectId(id)})) is not None:
        return existing

    raise HTTPException(status_code=404, detail=f"Request {id} not found")

@router.delete("/{id}", response_description="Delete a request")
async def delete_item(id: str, current_user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    delete_result = await collection.delete_one({"_id": ObjectId(id)})

    if delete_result.deleted_count == 1:
        return JSONResponse(status_code=status.HTTP_200_OK, content={"message": "Deleted successfully"})

    raise HTTPException(status_code=404, detail=f"Request {id} not found")
