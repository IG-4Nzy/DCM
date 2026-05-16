from fastapi import APIRouter, HTTPException, status, Body
from fastapi.responses import JSONResponse
from typing import List
from database import db
from models import UserModel, CreateUserModel, UpdateUserModel
from bson import ObjectId
import bcrypt

router = APIRouter()
users_collection = db.get_collection("users")

@router.get("/", response_description="List all users", response_model=List[UserModel])
async def list_users():
    users = await users_collection.find().to_list(1000)
    for user in users:
        if "status" not in user:
            user["status"] = "Active"
    return users

@router.post("/", response_description="Create a new user", response_model=UserModel, status_code=status.HTTP_201_CREATED)
async def create_user(user: CreateUserModel = Body(...)):
    user_dict = user.model_dump()
    
    if await users_collection.find_one({"username": user_dict["username"]}):
        raise HTTPException(status_code=400, detail="Username already registered")
        
    hashed_password = bcrypt.hashpw(user_dict["password"].encode('utf-8'), bcrypt.gensalt())
    user_dict["password"] = hashed_password.decode('utf-8')
    
    new_user = await users_collection.insert_one(user_dict)
    created_user = await users_collection.find_one({"_id": new_user.inserted_id})
    return created_user

@router.get("/{id}", response_description="Get a single user", response_model=UserModel)
async def show_user(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")
        
    if (user := await users_collection.find_one({"_id": ObjectId(id)})) is not None:
        if "status" not in user:
            user["status"] = "Active"
        return user
    raise HTTPException(status_code=404, detail=f"User {id} not found")

@router.put("/{id}", response_description="Update a user", response_model=UserModel)
async def update_user(id: str, user: UpdateUserModel = Body(...)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    user_dict = {k: v for k, v in user.model_dump().items() if v is not None}

    if "password" in user_dict:
        user_dict["password"] = bcrypt.hashpw(user_dict["password"].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    if len(user_dict) >= 1:
        update_result = await users_collection.update_one(
            {"_id": ObjectId(id)}, {"$set": user_dict}
        )

        if update_result.modified_count == 1:
            if (updated_user := await users_collection.find_one({"_id": ObjectId(id)})) is not None:
                if "status" not in updated_user:
                    updated_user["status"] = "Active"
                return updated_user

    if (existing_user := await users_collection.find_one({"_id": ObjectId(id)})) is not None:
        if "status" not in existing_user:
            existing_user["status"] = "Active"
        return existing_user

    raise HTTPException(status_code=404, detail=f"User {id} not found")

@router.delete("/{id}", response_description="Delete a user")
async def delete_user(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    delete_result = await users_collection.delete_one({"_id": ObjectId(id)})

    if delete_result.deleted_count == 1:
        return JSONResponse(status_code=status.HTTP_204_NO_CONTENT)

    raise HTTPException(status_code=404, detail=f"User {id} not found")
