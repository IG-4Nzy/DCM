import os
import uuid
import shutil
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status, Body, Query, Depends, UploadFile, File, Response
from auth_utils import require_privilege, get_current_user
from fastapi.responses import JSONResponse
from typing import Optional
from database import db, get_next_sequence
from models import WorkModel, CreateWorkModel, UpdateWorkModel, PaginatedWorksModel
from bson import ObjectId

router = APIRouter()
works_collection = db.get_collection("works")

async def is_department_head_of_assignees(current_user_username: str, work: dict) -> bool:
    departments_collection = db.get_collection("departments")
    depts_where_head = await departments_collection.find({"departmentHead": current_user_username}).to_list(length=None)
    if not depts_where_head:
        return False
        
    head_dept_ids = {str(d["_id"]) for d in depts_where_head}
    if not head_dept_ids:
        return False
        
    assignees_list = list(work.get("assignees") or [])
    if work.get("assignee") and work.get("assignee") not in assignees_list:
        assignees_list.append(work.get("assignee"))
        
    creator_username = work.get("createdBy")
    if creator_username:
        users_collection = db.get_collection("users")
        creator_user = await users_collection.find_one({"username": creator_username})
        if creator_user and creator_user.get("department") in head_dept_ids:
            return True
            
    if not assignees_list:
        return False
        
    users_collection = db.get_collection("users")
    object_ids = []
    usernames = []
    for a in assignees_list:
        if ObjectId.is_valid(a):
            object_ids.append(ObjectId(a))
        else:
            usernames.append(a)
            
    query = {"$or": []}
    if object_ids:
        query["$or"].append({"_id": {"$in": object_ids}})
    if usernames:
        query["$or"].append({"username": {"$in": usernames}})
        
    if not query["$or"]:
        return False
        
    assignee_users = await users_collection.find(query).to_list(length=None)
    for u in assignee_users:
        u_dept = u.get("department")
        if u_dept and u_dept in head_dept_ids:
            return True
            
    return False

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
    assignee: Optional[str] = None,
    department: Optional[str] = None,
    tab: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    query = {}
    is_superuser = current_user.get("isSuperuser", False)
    privileges = current_user.get("privileges", [])
    
    has_view_all = "View All Work" in privileges
    has_view_all_departments = "View All Department Works" in privileges
    has_view_assigned = "View Assigned Work" in privileges
    has_view_emergency = "View Emergency Work" in privileges
    
    if not is_superuser and not has_view_all and not has_view_all_departments and not has_view_assigned and not has_view_emergency:
        raise HTTPException(status_code=403, detail="Not enough permissions to view works")
            
    users_collection = db.get_collection("users")
    user_record = await users_collection.find_one({"username": current_user["sub"]})
    user_id = str(user_record["_id"]) if user_record else None

    if not is_superuser and not has_view_all and not has_view_all_departments:
        or_conditions = []
        if has_view_assigned:
            if not user_id:
                raise HTTPException(status_code=403, detail="User record not found")
            or_conditions.append({"assignee": user_id})
            or_conditions.append({"assignees": user_id})
        if has_view_emergency:
            or_conditions.append({"isEmergency": True})
            
        if not or_conditions:
            raise HTTPException(status_code=403, detail="Not enough privileges")
            
        if assignee and assignee != "All" and assignee != "All Assignees" and assignee != user_id:
            if not has_view_emergency:
                raise HTTPException(status_code=403, detail="Access Denied: Non-privileged users can only query their own assigned works.")
            
        query["$or"] = or_conditions
        if not status or status == "All" or status == "All Statuses":
            query["status"] = {"$ne": "Closed"}
    elif not is_superuser and has_view_all_departments:
        # "View All Department Works" allows seeing works across all departments
        if assignee and assignee != "All" and assignee != "All Assignees":
            query["$or"] = [
                {"assignee": assignee},
                {"assignees": assignee}
            ]
    elif not is_superuser and has_view_all:
        # "View All Work" shows all works in the user's department only
        user_dept = user_record.get("department") if user_record else None
        if user_dept:
            # Find all users in the same department
            dept_users = await users_collection.find({"department": user_dept}).to_list(length=None)
            dept_user_ids = [str(u["_id"]) for u in dept_users]
            dept_usernames = [u["username"] for u in dept_users if u.get("username")]
            dept_filter_conditions = []
            if dept_user_ids:
                dept_filter_conditions.append({"assignee": {"$in": dept_user_ids}})
                dept_filter_conditions.append({"assignees": {"$elemMatch": {"$in": dept_user_ids}}})
            if dept_usernames:
                dept_filter_conditions.append({"createdBy": {"$in": dept_usernames}})
            if dept_filter_conditions:
                query["$or"] = dept_filter_conditions
        if assignee and assignee != "All" and assignee != "All Assignees":
            if "$or" in query:
                query["$and"] = [{"$or": query.pop("$or")}, {"$or": [{"assignee": assignee}, {"assignees": assignee}]}]
            else:
                query["$or"] = [{"assignee": assignee}, {"assignees": assignee}]
    else:
        # Superuser — can see everything, but still allow assignee filter
        if assignee and assignee != "All" and assignee != "All Assignees":
            query["$or"] = [
                {"assignee": assignee},
                {"assignees": assignee}
            ]
    if (is_superuser or has_view_all_departments) and department and department not in ["All", "All Departments"]:
        dept_users = await users_collection.find({"department": department}).to_list(length=None)
        dept_user_ids = [str(u["_id"]) for u in dept_users]
        dept_usernames = [u["username"] for u in dept_users if u.get("username")]
        
        dept_filter_conditions = []
        if dept_user_ids:
            dept_filter_conditions.append({"assignee": {"$in": dept_user_ids}})
            dept_filter_conditions.append({"assignees": {"$elemMatch": {"$in": dept_user_ids}}})
        if dept_usernames:
            dept_filter_conditions.append({"createdBy": {"$in": dept_usernames}})
            
        if dept_filter_conditions:
            if "$or" in query:
                query["$and"] = [{"$or": query.pop("$or")}, {"$or": dept_filter_conditions}]
            else:
                query["$or"] = dept_filter_conditions
        else:
            # If department has no users, return empty
            if "$or" in query:
                query["$and"] = [{"$or": query.pop("$or")}, {"_id": "nonexistent_for_empty_department"}]
            else:
                query["_id"] = "nonexistent_for_empty_department"

    if status and status != "All" and status != "All Statuses":
        if "," in status:
            status_list = [s.strip() for s in status.split(",") if s.strip()]
            query["status"] = {"$in": status_list}
        else:
            query["status"] = status

    if search:
        search_query = {
            "$or": [
                {"workName": {"$regex": search, "$options": "i"}},
                {"assignee": {"$regex": search, "$options": "i"}},
                {"assignees": {"$regex": search, "$options": "i"}},
                {"priority": {"$regex": search, "$options": "i"}},
            ]
        }
        if query:
            query = {"$and": [query, search_query]}
        else:
            query = search_query

    # Apply tab filtering
    tab_query = {}
    if tab == "emergency":
        tab_query = {"isEmergency": True, "approved": False}
    else:
        tab_query = {
            "$or": [
                {"isEmergency": {"$ne": True}},
                {"approved": True}
            ]
        }
    
    if query:
        query = {"$and": [query, tab_query]}
    else:
        query = tab_query
        
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

@router.post("/", response_description="Create a new work", response_model=WorkModel, status_code=status.HTTP_201_CREATED, response_model_by_alias=False)
async def create_work(work: CreateWorkModel = Body(...), current_user: dict = Depends(get_current_user)):
    work_dict = work.model_dump()
    is_superuser = current_user.get("isSuperuser", False)
    privileges = current_user.get("privileges", [])
    is_emergency = work_dict.get("isEmergency", False)
    
    if not is_superuser:
        if is_emergency:
            if "Create Work" not in privileges and "Create Emergency Work" not in privileges:
                raise HTTPException(status_code=403, detail="Not enough permissions to create emergency work")
        else:
            if "Create Work" not in privileges:
                raise HTTPException(status_code=403, detail="Not enough permissions to create work")
                
    work_dict["createdBy"] = current_user.get("sub")
    if is_emergency:
        work_dict["approved"] = False
    else:
        work_dict["approved"] = True

    if not work_dict.get("createdAt"):
        work_dict["createdAt"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        
    work_dict["workId"] = await get_next_sequence("works_sequence", "WRK")
    
    new_work = await works_collection.insert_one(work_dict)
    created_work = await works_collection.find_one({"_id": new_work.inserted_id})
    
    from notification_helper import log_page_update
    assignees_list = work_dict.get("assignees") or []
    if work_dict.get("assignee") and work_dict.get("assignee") not in assignees_list:
        assignees_list.append(work_dict.get("assignee"))
    for asn in assignees_list:
        await log_page_update("works", assignee=asn, username=current_user.get("sub"))
    
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
    
    has_view_all = "View All Work" in privileges
    has_view_all_departments = "View All Department Works" in privileges
    has_view_assigned = "View Assigned Work" in privileges
    has_view_emergency = "View Emergency Work" in privileges
    
    if not is_superuser and not has_view_all_departments:
        allowed = False
        
        users_collection = db.get_collection("users")
        user_record = await users_collection.find_one({"username": current_user["sub"]})
        user_id = str(user_record["_id"]) if user_record else None

        if has_view_emergency and work.get("isEmergency"):
            allowed = True
        elif has_view_all and user_record:
            user_dept = user_record.get("department")
            if user_dept:
                dept_users = await users_collection.find({"department": user_dept}).to_list(length=None)
                dept_user_ids = [str(u["_id"]) for u in dept_users]
                dept_usernames = [u["username"] for u in dept_users if u.get("username")]
                
                assignees_list = work.get("assignees") or []
                if work.get("assignee"):
                    assignees_list.append(work.get("assignee"))
                
                is_in_dept = False
                for a in assignees_list:
                    if a in dept_user_ids:
                        is_in_dept = True
                        break
                if work.get("createdBy") in dept_usernames:
                    is_in_dept = True
                
                if is_in_dept:
                    allowed = True
                    
        if not allowed and has_view_assigned:
            assignees_list = work.get("assignees") or []
            if work.get("assignee"):
                assignees_list.append(work.get("assignee"))
                
            if user_record and user_id in assignees_list:
                allowed = True
                if work.get("status") == "Closed":
                    raise HTTPException(status_code=403, detail="You cannot view closed tickets")
                    
        if not allowed:
            raise HTTPException(status_code=403, detail="Not enough permissions to view work")

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
            
        is_emergency = existing_work.get("isEmergency", False)
        is_dept_head = await is_department_head_of_assignees(current_user.get("sub"), existing_work)
        has_update = "Update Work" in privileges or (is_emergency and ("Update Emergency Work" in privileges or is_dept_head))
            
        if work_dict.get("approved") is True:
            if not ("Update Work" in privileges or (is_emergency and "Approve Emergency Work" in privileges)):
                raise HTTPException(status_code=403, detail="Approving emergency work requires update/approval privileges")

        if existing_work.get("status") == "Completed" and not has_update:
            raise HTTPException(status_code=403, detail="Cannot modify a completed work without update privilege")
 
        update_keys = set(work_dict.keys())
        status_only = update_keys.issubset({"status", "comments", "completedAt", "id", "_id", "approved"})
        
        if status_only:
            if not has_update:
                has_view_assigned = "View Assigned Work" in privileges
                has_view_emergency = "View Emergency Work" in privileges
                has_view_permission = has_view_assigned or (is_emergency and has_view_emergency)
                
                if has_view_permission:
                    users_collection = db.get_collection("users")
                    user_record = await users_collection.find_one({"username": current_user["sub"]})
                    user_id = str(user_record["_id"]) if user_record else None
                    
                    assignees_list = existing_work.get("assignees") or []
                    if existing_work.get("assignee"):
                        assignees_list.append(existing_work.get("assignee"))
                        
                    if not user_record or user_id not in assignees_list:
                        raise HTTPException(status_code=403, detail="You can only update status for works assigned to you")
                else:
                    raise HTTPException(status_code=403, detail="Need update privilege")
        else:
            if not has_update:
                raise HTTPException(status_code=403, detail="Need update privilege")

    if len(work_dict) >= 1:
        update_result = await works_collection.update_one(
            {"_id": ObjectId(id)}, {"$set": work_dict}
        )

        if update_result.modified_count == 1:
            if (updated_work := await works_collection.find_one({"_id": ObjectId(id)})) is not None:
                from notification_helper import log_page_update
                assignees_list = updated_work.get("assignees") or []
                if updated_work.get("assignee") and updated_work.get("assignee") not in assignees_list:
                    assignees_list.append(updated_work.get("assignee"))
                for asn in assignees_list:
                    await log_page_update("works", assignee=asn, username=current_user.get("sub"))
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
    user_id = str(current_user_record["_id"]) if current_user_record else None
    
    assignees_list = existing_work.get("assignees") or []
    if existing_work.get("assignee"):
        assignees_list.append(existing_work.get("assignee"))
        
    is_assignee = user_id in assignees_list
    is_dept_head = await is_department_head_of_assignees(current_user.get("sub"), existing_work)
    has_update_privilege = is_superuser or "Update Work" in privileges or (existing_work.get("isEmergency") and ("Update Emergency Work" in privileges or is_dept_head))
    
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
            "$set": {
                "assignee": new_assignee_id_str,
                "assignees": [new_assignee_id_str]
            },
            "$push": {"comments": new_comment}
        }
    )
    
    updated_work = await works_collection.find_one({"_id": ObjectId(id)})
    
    from notification_helper import log_page_update
    await log_page_update("works", assignee=new_assignee_id_str, username=transferring_username)
    
    return updated_work

@router.delete("/{id}", response_description="Delete a work")
async def delete_work(id: str, current_user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    is_superuser = current_user.get("isSuperuser", False)
    privileges = current_user.get("privileges", [])

    if not is_superuser:
        existing_work = await works_collection.find_one({"_id": ObjectId(id)})
        if not existing_work:
            raise HTTPException(status_code=404, detail=f"Work {id} not found")
        
        is_emergency = existing_work.get("isEmergency", False)
        if is_emergency:
            is_dept_head = await is_department_head_of_assignees(current_user.get("sub"), existing_work)
            if "Delete Work" not in privileges and "Delete Emergency Work" not in privileges and not is_dept_head:
                raise HTTPException(status_code=403, detail="Need Delete Emergency Work privilege")
        else:
            if "Delete Work" not in privileges:
                raise HTTPException(status_code=403, detail="Need Delete Work privilege")

    delete_result = await works_collection.delete_one({"_id": ObjectId(id)})

    if delete_result.deleted_count == 1:
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    raise HTTPException(status_code=404, detail=f"Work {id} not found")
