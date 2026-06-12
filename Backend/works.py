import os
import uuid
import shutil
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status, Body, Query, Depends, UploadFile, File, Response
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
    pagination: bool = Query(True),
    limit: int = Query(10, ge=1),
    sortBy: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    order: str = Query("asc"),
    search: Optional[str] = None,
    status: Optional[str] = None,
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

    if status and status != "All" and status != "All Statuses":
        query["status"] = status

    if search:
        search_query = {
            "$or": [
                {"workName": {"$regex": search, "$options": "i"}},
                {"assignee": {"$regex": search, "$options": "i"}},
                {"priority": {"$regex": search, "$options": "i"}},
            ]
        }
        if query:
            query = {"$and": [query, search_query]}
        else:
            query = search_query
        
    actual_sort_by = sortBy or sort_by or "workName"
    sort_order = 1 if order == "asc" else -1
    
    pipeline = []
    if query:
        pipeline.append({"$match": query})
        
    pipeline.append({
        "$addFields": {
            "status_weight": {
                "$cond": {
                    "if": {"$in": ["$status", ["Completed", "Closed"]]},
                    "then": 1,
                    "else": 0
                }
            }
        }
    })
    
    pipeline.append({
        "$sort": {
            "status_weight": 1,
            actual_sort_by: sort_order
        }
    })
    
    total = await works_collection.count_documents(query)
    
    if pagination:
        pipeline.append({"$skip": skip})
        pipeline.append({"$limit": limit})
        cursor = works_collection.aggregate(pipeline)
        works = await cursor.to_list(length=limit)
    else:
        cursor = works_collection.aggregate(pipeline)
        works = await cursor.to_list(length=None)
            
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
async def create_work(work: CreateWorkModel = Body(...), current_user: dict = Depends(get_current_user)):
    work_dict = work.model_dump()
    new_work = await works_collection.insert_one(work_dict)
    created_work = await works_collection.find_one({"_id": new_work.inserted_id})
    
    from notification_helper import log_page_update
    await log_page_update("works", assignee=work.assignee, username=current_user.get("sub"))
    
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
        status_only = update_keys.issubset({"status", "comments", "completedAt", "id", "_id"})
        
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
                from notification_helper import log_page_update
                await log_page_update("works", assignee=updated_work.get("assignee"), username=current_user.get("sub"))
                return updated_work

    if (existing_work := await works_collection.find_one({"_id": ObjectId(id)})) is not None:
        return existing_work

    raise HTTPException(status_code=404, detail=f"Work {id} not found")

@router.post("/{id}/transfer", response_description="Transfer work to another staff", response_model=WorkModel)
async def transfer_work(
    id: str,
    transfer_data: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")
        
    existing_work = await works_collection.find_one({"_id": ObjectId(id)})
    if not existing_work:
        raise HTTPException(status_code=404, detail="Work not found")
        
    new_assignee_id = transfer_data.get("newAssigneeId")
    reason = transfer_data.get("reason")
    
    if not new_assignee_id:
        raise HTTPException(status_code=400, detail="New assignee is required")
    if not reason:
        raise HTTPException(status_code=400, detail="Reason is required")
        
    users_collection = db.get_collection("users")
    new_assignee_user = await users_collection.find_one({
        "$or": [
            {"_id": ObjectId(new_assignee_id) if ObjectId.is_valid(new_assignee_id) else None},
            {"username": new_assignee_id}
        ]
    })
    if not new_assignee_user:
        raise HTTPException(status_code=404, detail="New assignee not found")
        
    new_assignee_username = new_assignee_user.get("username")
    new_assignee_id_str = str(new_assignee_user["_id"])
    
    # Check permission: must be currently assigned user, or superuser, or have "Update Work" privilege
    is_superuser = current_user.get("isSuperuser", False)
    privileges = current_user.get("privileges", [])
    
    current_user_record = await users_collection.find_one({"username": current_user["sub"]})
    is_assignee = current_user_record and existing_work.get("assignee") == str(current_user_record["_id"])
    has_update_privilege = is_superuser or "Update Work" in privileges
    
    if not (is_assignee or has_update_privilege):
        raise HTTPException(status_code=403, detail="You do not have permission to transfer this work")
        
    transferring_username = current_user.get("sub", "Unknown")
    now_str = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    local_time_formatted = datetime.now().strftime("%Y-%m-%d %I:%M %p")
    
    log_text = f"Transferred this work to {new_assignee_username} at {local_time_formatted}. Reason: {reason}"
    
    new_comment = {
        "text": log_text,
        "user": transferring_username,
        "timestamp": now_str
    }
    
    await works_collection.update_one(
        {"_id": ObjectId(id)},
        {
            "$set": {"assignee": new_assignee_id_str},
            "$push": {"comments": new_comment}
        }
    )
    
    updated_work = await works_collection.find_one({"_id": ObjectId(id)})
    
    from notification_helper import log_page_update
    await log_page_update("works", assignee=new_assignee_id_str, username=transferring_username)
    
    return updated_work

@router.delete("/{id}", response_description="Delete a work", dependencies=[Depends(require_privilege("Delete Work"))])
async def delete_work(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    delete_result = await works_collection.delete_one({"_id": ObjectId(id)})

    if delete_result.deleted_count == 1:
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    raise HTTPException(status_code=404, detail=f"Work {id} not found")
