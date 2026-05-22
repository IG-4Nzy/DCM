from fastapi import APIRouter, HTTPException, status, Body, Query, Depends
from auth_utils import require_privilege, get_current_user
from fastapi.responses import JSONResponse
from typing import Optional, List
from database import db
from models import ServerModelModel, CreateServerModelModel, UpdateServerModelModel, PaginatedServerModelsModel
from bson import ObjectId
from datetime import datetime, timezone

router = APIRouter()
collection = db.get_collection("server_models")

@router.get("/", response_description="List all server models", response_model=PaginatedServerModelsModel, response_model_by_alias=False, dependencies=[Depends(require_privilege("View Configurations"))])
async def list_items(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1),
    pagination: bool = Query(True),
    search: Optional[str] = None
):
    query = {}
    
    if search:
        query = {
            "serverModel": {"$regex": search, "$options": "i"}
        }

    total = await collection.count_documents(query)
    cursor = collection.find(query).sort("serverModel", 1)
    
    if pagination:
        cursor = cursor.skip(skip).limit(limit)
        items = await cursor.to_list(length=limit)
    else:
        items = await cursor.to_list(length=None)

    return {"data": items, "total": total}

@router.post("/", response_description="Create a serverModel", response_model=ServerModelModel, status_code=status.HTTP_201_CREATED, response_model_by_alias=False, dependencies=[Depends(require_privilege("Create Configuration"))])
async def create_item(
    payload: CreateServerModelModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    existing = await collection.find_one({ "serverModel": {"$regex": f"^{getattr(payload, 'serverModel')}$", "$options": "i"} })
    if existing:
        raise HTTPException(status_code=400, detail="Server Model already exists")

    item_dict = payload.model_dump()
    item_dict["createdBy"] = current_user.get("sub", "")
    item_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()

    new_item = await collection.insert_one(item_dict)
    created = await collection.find_one({"_id": new_item.inserted_id})
    return created

@router.put("/{id}", response_description="Update a serverModel", response_model=ServerModelModel, response_model_by_alias=False, dependencies=[Depends(require_privilege("Update Configurations"))])
async def update_item(id: str, payload: UpdateServerModelModel = Body(...)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    item_dict = {k: v for k, v in payload.model_dump().items() if v is not None}

    if len(item_dict) >= 1:
        if "serverModel" in item_dict:
            existing = await collection.find_one({
                "serverModel": {"$regex": f"^{item_dict['serverModel']}$", "$options": "i"},
                "_id": {"$ne": ObjectId(id)}
            })
            if existing:
                raise HTTPException(status_code=400, detail="Server Model already exists")

        item_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()
        
        update_result = await collection.update_one(
            {"_id": ObjectId(id)}, {"$set": item_dict}
        )

        if update_result.modified_count == 1:
            if (updated := await collection.find_one({"_id": ObjectId(id)})) is not None:
                return updated

    if (existing := await collection.find_one({"_id": ObjectId(id)})) is not None:
        return existing

    raise HTTPException(status_code=404, detail=f"Server Model {id} not found")

@router.delete("/{id}", response_description="Delete a serverModel", dependencies=[Depends(require_privilege("Delete Configurations"))])
async def delete_item(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    delete_result = await collection.delete_one({"_id": ObjectId(id)})

    if delete_result.deleted_count == 1:
        return JSONResponse(status_code=status.HTTP_204_NO_CONTENT)

    raise HTTPException(status_code=404, detail=f"Server Model {id} not found")
