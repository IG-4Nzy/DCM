from fastapi import APIRouter, HTTPException, status, Body, Query, Depends, Response
from auth_utils import require_privilege, get_current_user
from fastapi.responses import JSONResponse
from typing import List, Optional
from database import db
from models import UserModel, CreateUserModel, UpdateUserModel, PaginatedUsersModel
from bson import ObjectId
import bcrypt

async def sync_department_head(username: str, department: Optional[str], is_dept_head: Optional[bool]):
    if is_dept_head is None:
        return
    departments_collection = db.get_collection("departments")
    cursor = departments_collection.find({"departmentHead": username})
    async for dept in cursor:
        if not is_dept_head or dept["name"] != department:
            await departments_collection.update_one(
                {"_id": dept["_id"]},
                {"$set": {"departmentHead": None}}
            )
    if is_dept_head and department:
        await departments_collection.update_one(
            {"name": department},
            {"$set": {"departmentHead": username}}
        )

router = APIRouter()
users_collection = db.get_collection("users")

@router.get("/", response_description="List all users", response_model=PaginatedUsersModel, response_model_by_alias=False, dependencies=[Depends(require_privilege("View User"))])
async def list_users(
    skip: int = Query(0, ge=0),
    pagination: bool = Query(True),
    limit: int = Query(5, ge=1),
    sortBy: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    order: str = Query("asc"),
    search: Optional[str] = None,
    department: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    
    if department == "me":
        query["department"] = current_user.get("department")
    elif department:
        query["department"] = department

    if search:
        search_query = {
            "$or": [
                {"username": {"$regex": search, "$options": "i"}},
                {"role": {"$regex": search, "$options": "i"}},
            ]
        }
        if query:
            query = {"$and": [query, search_query]}
        else:
            query = search_query
        
    actual_sort_by = sortBy or sort_by or "username"
    sort_order = 1 if order == "asc" else -1
    
    total = await users_collection.count_documents(query)
    cursor = users_collection.find(query).sort(actual_sort_by, sort_order)
    if pagination:
        cursor = cursor.skip(skip).limit(limit)
        users = await cursor.to_list(length=limit)
    else:
        users = await cursor.to_list(length=None)
    
    departments_collection = db.get_collection("departments")
    depts = await departments_collection.find({}, {"name": 1, "departmentHead": 1}).to_list(length=None)
    dept_heads = {d["departmentHead"] for d in depts if d.get("departmentHead")}

    for user in users:
        if "status" not in user:
            user["status"] = True
        user["isDepartmentHead"] = user.get("username") in dept_heads
            
    return {"data": users, "total": total}

@router.post("/", response_description="Create a new user", response_model=UserModel, status_code=status.HTTP_201_CREATED, response_model_by_alias=False, dependencies=[Depends(require_privilege("Create User"))])
async def create_user(user: CreateUserModel = Body(...)):
    user_dict = user.model_dump()
    is_dept_head = user_dict.pop("isDepartmentHead", None)
    
    if await users_collection.find_one({"username": user_dict["username"]}):
        raise HTTPException(status_code=400, detail="Username already registered")
        
    hashed_password = bcrypt.hashpw(user_dict["password"].encode('utf-8'), bcrypt.gensalt())
    user_dict["password"] = hashed_password.decode('utf-8')
    
    new_user = await users_collection.insert_one(user_dict)
    
    await sync_department_head(user_dict["username"], user_dict.get("department"), is_dept_head)
    
    created_user = await users_collection.find_one({"_id": new_user.inserted_id})
    if created_user:
        created_user["isDepartmentHead"] = is_dept_head or False
    return created_user

@router.get("/{id}", response_description="Get a single user", response_model=UserModel, response_model_by_alias=False, dependencies=[Depends(require_privilege("View User"))])
async def show_user(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")
        
    if (user := await users_collection.find_one({"_id": ObjectId(id)})) is not None:
        if "status" not in user:
            user["status"] = True
        departments_collection = db.get_collection("departments")
        is_head = await departments_collection.find_one({"departmentHead": user.get("username")}) is not None
        user["isDepartmentHead"] = is_head
        return user
    raise HTTPException(status_code=404, detail=f"User {id} not found")

@router.put("/{id}", response_description="Update a user", response_model=UserModel, response_model_by_alias=False, dependencies=[Depends(require_privilege("Update User"))])
async def update_user(id: str, user: UpdateUserModel = Body(...)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    existing_user = await users_collection.find_one({"_id": ObjectId(id)})
    if not existing_user:
        raise HTTPException(status_code=404, detail=f"User {id} not found")

    user_dict = {k: v for k, v in user.model_dump().items() if v is not None}
    is_dept_head = user_dict.pop("isDepartmentHead", None)

    if "password" in user_dict:
        user_dict["password"] = bcrypt.hashpw(user_dict["password"].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    if len(user_dict) >= 1:
        update_result = await users_collection.update_one(
            {"_id": ObjectId(id)}, {"$set": user_dict}
        )

    updated_user = await users_collection.find_one({"_id": ObjectId(id)})
    
    if is_dept_head is not None and updated_user:
        await sync_department_head(
            updated_user.get("username"),
            updated_user.get("department"),
            is_dept_head
        )

    if updated_user:
        if "status" not in updated_user:
            updated_user["status"] = True
        departments_collection = db.get_collection("departments")
        is_head = await departments_collection.find_one({"departmentHead": updated_user.get("username")}) is not None
        updated_user["isDepartmentHead"] = is_head
        return updated_user

    raise HTTPException(status_code=404, detail=f"User {id} not found")

@router.delete("/{id}", response_description="Delete a user", dependencies=[Depends(require_privilege("Delete User"))])
async def delete_user(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    delete_result = await users_collection.delete_one({"_id": ObjectId(id)})

    if delete_result.deleted_count == 1:
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    raise HTTPException(status_code=404, detail=f"User {id} not found")
