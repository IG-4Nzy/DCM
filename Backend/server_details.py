from fastapi import APIRouter, HTTPException, status, Body, Query, Depends
from auth_utils import require_privilege, get_current_user
from fastapi.responses import JSONResponse
from typing import Optional, List
from database import db
from models import ServerDetailsModel, CreateServerDetailsModel, UpdateServerDetailsModel, PaginatedServerDetailsModel
from bson import ObjectId
from datetime import datetime, timezone

router = APIRouter()
collection = db.get_collection("server_details")

@router.get("/", response_description="List all server details", response_model=PaginatedServerDetailsModel, response_model_by_alias=False, dependencies=[Depends(require_privilege("View Server Details"))])
async def list_items(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1),
    pagination: bool = Query(True),
    search: Optional[str] = None
):
    query = {}
    
    if search:
        query = {
            "$or": [
                {"hostName": {"$regex": search, "$options": "i"}},
                {"ipAddress": {"$regex": search, "$options": "i"}},
                {"rack": {"$regex": search, "$options": "i"}},
                {"serverModel": {"$regex": search, "$options": "i"}}
            ]
        }

    total = await collection.count_documents(query)
    cursor = collection.find(query).sort("slNumber", 1)
    
    if pagination:
        cursor = cursor.skip(skip).limit(limit)
        items = await cursor.to_list(length=limit)
    else:
        items = await cursor.to_list(length=None)

    return {"data": items, "total": total}

@router.post("/", response_description="Create server details", response_model=ServerDetailsModel, status_code=status.HTTP_201_CREATED, response_model_by_alias=False, dependencies=[Depends(require_privilege("Create Server Details"))])
async def create_item(
    payload: CreateServerDetailsModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    item_dict = payload.model_dump()
    item_dict["createdBy"] = current_user.get("sub", "")
    item_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()

    # Auto-populate SL Number safely
    cursor = collection.find({}, {"slNumber": 1})
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
    return created

@router.put("/{id}", response_description="Update server details", response_model=ServerDetailsModel, response_model_by_alias=False, dependencies=[Depends(require_privilege("Update Server Details"))])
async def update_item(id: str, payload: UpdateServerDetailsModel = Body(...)):
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

    raise HTTPException(status_code=404, detail="Server details not found")

@router.delete("/{id}", response_description="Delete server details", dependencies=[Depends(require_privilege("Delete Server Details"))])
async def delete_item(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    delete_result = await collection.delete_one({"_id": ObjectId(id)})

    if delete_result.deleted_count == 1:
        return JSONResponse(status_code=status.HTTP_204_NO_CONTENT)

    raise HTTPException(status_code=404, detail="Server details not found")
