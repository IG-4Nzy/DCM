import os
import uuid
import shutil
from fastapi import APIRouter, HTTPException, status, Body, Query, Depends, UploadFile, File
from auth_utils import require_privilege, get_current_user
from fastapi.responses import JSONResponse
from typing import Optional
from database import db
from models import WorkModel, CreateWorkModel, UpdateWorkModel, PaginatedWorksModel
from bson import ObjectId

router = APIRouter()
works_collection = db.get_collection("works")

@router.get("/", response_description="List all works", response_model=PaginatedWorksModel, response_model_by_alias=False)
async def list_works(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1),
    sort_by: str = Query("workName"),
    order: str = Query("asc"),
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    is_superuser = current_user.get("isSuperuser", False)
    privileges = current_user.get("privileges", [])
    
    if not is_superuser and "View All Work" not in privileges:
        if "View Assigned Work" not in privileges:
            raise HTTPException(status_code=403, detail="Not enough permissions to view works")
            
        users_collection = db.get_collection("users")
        user_record = await users_collection.find_one({"username": current_user["sub"]})
        if user_record:
            query["assignee"] = str(user_record["_id"])
            query["status"] = {"$ne": "Closed"}
        else:
            raise HTTPException(status_code=403, detail="User record not found")

    if search:
        query = {
            "$or": [
                {"workName": {"$regex": search, "$options": "i"}},
                {"assignee": {"$regex": search, "$options": "i"}},
                {"priority": {"$regex": search, "$options": "i"}},
            ]
        }
        
    sort_order = 1 if order == "asc" else -1
    
    total = await works_collection.count_documents(query)
    cursor = works_collection.find(query).sort(sort_by, sort_order).skip(skip).limit(limit)
    works = await cursor.to_list(length=limit)
            
    return {"data": works, "total": total}

@router.post("/upload", response_description="Upload attachments", dependencies=[Depends(get_current_user)])
async def upload_attachments(files: list[UploadFile] = File(...)):
    uploaded_files = []
    base_dir = "uploads/works"
    
    for file in files:
        if not file.filename:
            continue
        file_ext = os.path.splitext(file.filename)[1]
        unique_name = f"{uuid.uuid4()}{file_ext}"
        file_path = os.path.join(base_dir, unique_name)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        uploaded_files.append({
            "name": file.filename,
            "url": f"/uploads/works/{unique_name}"
        })
        
    return uploaded_files

@router.post("/", response_description="Create a new work", response_model=WorkModel, status_code=status.HTTP_201_CREATED, response_model_by_alias=False, dependencies=[Depends(require_privilege("Create Work"))])
async def create_work(work: CreateWorkModel = Body(...)):
    work_dict = work.model_dump()
    new_work = await works_collection.insert_one(work_dict)
    created_work = await works_collection.find_one({"_id": new_work.inserted_id})
    return created_work

@router.get("/{id}", response_description="Get a single work", response_model=WorkModel, response_model_by_alias=False)
async def show_work(id: str, current_user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")
        
    work = await works_collection.find_one({"_id": ObjectId(id)})
    if work is None:
        raise HTTPException(status_code=404, detail=f"Work {id} not found")
        
    is_superuser = current_user.get("isSuperuser", False)
    privileges = current_user.get("privileges", [])
    
    if not is_superuser and "View All Work" not in privileges:
        if "View Assigned Work" not in privileges:
            raise HTTPException(status_code=403, detail="Not enough permissions to view work")
        
        users_collection = db.get_collection("users")
        user_record = await users_collection.find_one({"username": current_user["sub"]})
        if not user_record or work.get("assignee") != str(user_record["_id"]):
            raise HTTPException(status_code=403, detail="You are not assigned to this work")
            
        if work.get("status") == "Closed":
            raise HTTPException(status_code=403, detail="You cannot view closed tickets")

    return work

@router.put("/{id}", response_description="Update a work", response_model=WorkModel, response_model_by_alias=False)
async def update_work(id: str, work: UpdateWorkModel = Body(...), current_user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    work_dict = {k: v for k, v in work.model_dump().items() if v is not None}
    
    is_superuser = current_user.get("isSuperuser", False)
    privileges = current_user.get("privileges", [])
    
    if not is_superuser:
        existing_work = await works_collection.find_one({"_id": ObjectId(id)})
        if not existing_work:
            raise HTTPException(status_code=404, detail=f"Work {id} not found")
            
        if existing_work.get("status") == "Completed" and "Update Work" not in privileges:
            raise HTTPException(status_code=403, detail="Cannot modify a completed work without Update Work privilege")

        update_keys = set(work_dict.keys())
        status_only = update_keys.issubset({"status", "comments", "id", "_id"})
        
        if status_only:
            has_status_update = "Update Work" in privileges
            has_view_assigned = "View Assigned Work" in privileges
            
            if not has_status_update:
                if has_view_assigned:
                    users_collection = db.get_collection("users")
                    user_record = await users_collection.find_one({"username": current_user["sub"]})
                    if not user_record or existing_work.get("assignee") != str(user_record["_id"]):
                        raise HTTPException(status_code=403, detail="You can only update status for works assigned to you")
                else:
                    raise HTTPException(status_code=403, detail="Need Update Work privilege")
        else:
            if "Update Work" not in privileges:
                raise HTTPException(status_code=403, detail="Need Update Work privilege")

    if len(work_dict) >= 1:
        update_result = await works_collection.update_one(
            {"_id": ObjectId(id)}, {"$set": work_dict}
        )

        if update_result.modified_count == 1:
            if (updated_work := await works_collection.find_one({"_id": ObjectId(id)})) is not None:
                return updated_work

    if (existing_work := await works_collection.find_one({"_id": ObjectId(id)})) is not None:
        return existing_work

    raise HTTPException(status_code=404, detail=f"Work {id} not found")

@router.delete("/{id}", response_description="Delete a work", dependencies=[Depends(require_privilege("Delete Work"))])
async def delete_work(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    delete_result = await works_collection.delete_one({"_id": ObjectId(id)})

    if delete_result.deleted_count == 1:
        return JSONResponse(status_code=status.HTTP_204_NO_CONTENT)

    raise HTTPException(status_code=404, detail=f"Work {id} not found")
