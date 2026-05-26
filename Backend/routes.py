from fastapi import APIRouter, Body, HTTPException, status, Response
from fastapi.responses import JSONResponse
from typing import List
from bson import ObjectId

from models import ItemModel, UpdateItemModel
from database import db

router = APIRouter()
collection = db.get_collection("items")

@router.post("/", response_description="Add new item", response_model=ItemModel, status_code=status.HTTP_201_CREATED)
async def create_item(item: ItemModel = Body(...)):
    item_dict = item.model_dump(by_alias=True, exclude=["id"])
    new_item = await collection.insert_one(item_dict)
    created_item = await collection.find_one({"_id": new_item.inserted_id})
    return created_item

@router.get("/", response_description="List all items", response_model=List[ItemModel])
async def list_items():
    items = await collection.find().to_list(1000)
    return items

@router.get("/{id}", response_description="Get a single item", response_model=ItemModel)
async def show_item(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")
        
    if (item := await collection.find_one({"_id": ObjectId(id)})) is not None:
        return item
    raise HTTPException(status_code=404, detail=f"Item {id} not found")

@router.put("/{id}", response_description="Update an item", response_model=ItemModel)
async def update_item(id: str, item: UpdateItemModel = Body(...)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    item_dict = {k: v for k, v in item.model_dump(by_alias=True).items() if v is not None}

    if len(item_dict) >= 1:
        update_result = await collection.update_one(
            {"_id": ObjectId(id)}, {"$set": item_dict}
        )

        if update_result.modified_count == 1:
            if (
                updated_item := await collection.find_one({"_id": ObjectId(id)})
            ) is not None:
                return updated_item

    if (existing_item := await collection.find_one({"_id": ObjectId(id)})) is not None:
        return existing_item

    raise HTTPException(status_code=404, detail=f"Item {id} not found")

@router.delete("/{id}", response_description="Delete an item")
async def delete_item(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    delete_result = await collection.delete_one({"_id": ObjectId(id)})

    if delete_result.deleted_count == 1:
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    raise HTTPException(status_code=404, detail=f"Item {id} not found")
