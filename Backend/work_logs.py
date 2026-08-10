import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status, Body, Query, Depends, Response, Request
from typing import Optional, List
from database import db
from models import WorkLogModel, CreateWorkLogModel, UpdateWorkLogModel, PaginatedWorkLogsModel
from auth_utils import get_current_user
from bson import ObjectId

router = APIRouter()
work_logs_collection = db.get_collection("work_logs")
users_collection = db.get_collection("users")

def parse_time_to_minutes(time_str: str) -> int:
    """Parses time string (e.g. '09:00', '09:00 AM', '14:30', '02:30 PM') into minutes from midnight."""
    if not time_str or not isinstance(time_str, str):
        raise ValueError("Invalid time string")
    
    t_str = time_str.strip()
    upper_str = t_str.upper()
    
    if "AM" in upper_str or "PM" in upper_str:
        # 12-hour format
        is_pm = "PM" in upper_str
        clean_time = upper_str.replace("AM", "").replace("PM", "").strip()
        parts = clean_time.split(":")
        hours = int(parts[0])
        minutes = int(parts[1]) if len(parts) > 1 else 0
        if hours == 12:
            hours = 12 if is_pm else 0
        elif is_pm:
            hours += 12
        return hours * 60 + minutes
    else:
        # 24-hour format
        parts = t_str.split(":")
        hours = int(parts[0])
        minutes = int(parts[1]) if len(parts) > 1 else 0
        return hours * 60 + minutes

def validate_entries_time_overlap(entries: List[dict]):
    """Validates that for each entry startTime < endTime and no two entries overlap."""
    if not entries:
        return
        
    parsed_slots = []
    for idx, entry in enumerate(entries):
        start_raw = entry.get("startTime", "")
        end_raw = entry.get("endTime", "")
        activity = entry.get("activity", "").strip()
        
        if not start_raw or not end_raw:
            raise HTTPException(
                status_code=400,
                detail=f"Entry #{idx + 1} requires both Start Time and End Time."
            )
        if not activity:
            raise HTTPException(
                status_code=400,
                detail=f"Entry #{idx + 1} requires an Activity description."
            )
            
        try:
            start_min = parse_time_to_minutes(start_raw)
            end_min = parse_time_to_minutes(end_raw)
        except Exception:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid time format in entry #{idx + 1} ('{start_raw}' - '{end_raw}'). Use HH:mm format."
            )
            
        if start_min >= end_min:
            raise HTTPException(
                status_code=400,
                detail=f"Entry #{idx + 1}: Start time ({start_raw}) must be earlier than end time ({end_raw})."
            )
            
        parsed_slots.append({
            "idx": idx,
            "start": start_min,
            "end": end_min,
            "start_raw": start_raw,
            "end_raw": end_raw,
            "activity": activity
        })
        
    # Sort slots by start time to check for overlaps
    parsed_slots.sort(key=lambda s: s["start"])
    for i in range(len(parsed_slots) - 1):
        current_slot = parsed_slots[i]
        next_slot = parsed_slots[i + 1]
        
        if current_slot["end"] > next_slot["start"]:
            raise HTTPException(
                status_code=400,
                detail=f"Time slot overlap detected between ({current_slot['start_raw']} - {current_slot['end_raw']}) and ({next_slot['start_raw']} - {next_slot['end_raw']})."
            )

async def enrich_work_log_user(log: dict):
    if not log:
        return
    username = log.get("username")
    if username:
        user_doc = await users_collection.find_one({"username": username})
        if user_doc:
            log["userId"] = str(user_doc["_id"])
            full_name = f"{user_doc.get('firstName', '')} {user_doc.get('lastName', '')}".strip()
            log["userFullName"] = full_name or username
            log["department"] = user_doc.get("department", "")

@router.get("/", response_description="List work logs", response_model=PaginatedWorkLogsModel, response_model_by_alias=False)
async def list_work_logs(
    skip: int = Query(0, ge=0),
    pagination: bool = Query(True),
    limit: int = Query(10, ge=1),
    sortBy: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    order: str = Query("desc"),
    search: Optional[str] = None,
    user: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    is_superuser = current_user.get("isSuperuser", False)
    privileges = current_user.get("privileges", [])
    
    has_view_all = is_superuser or "View All Work Logs" in privileges
    has_view_own = "View Work Log" in privileges
    
    if not has_view_all and not has_view_own:
        raise HTTPException(status_code=403, detail="Not enough permissions to view work logs")
        
    query = {}
    
    # Ownership filtering:
    if not has_view_all:
        # Non-privileged user can ONLY view their own logs
        query["username"] = current_user["sub"]
    else:
        # Department filtering: find usernames belonging to the department
        if department and department != "All" and department != "All Departments":
            dept_users = await users_collection.find({"department": department}).to_list(length=None)
            dept_usernames = [u.get("username") for u in dept_users if u.get("username")]
            if dept_usernames:
                query["username"] = {"$in": dept_usernames}
            else:
                # No users in this department — return empty
                return {"data": [], "total": 0}

        # Privileged user can filter by user if provided
        if user and user != "All" and user != "All Users":
            # user can be username or userId
            if ObjectId.is_valid(user):
                user_doc = await users_collection.find_one({"_id": ObjectId(user)})
                if user_doc:
                    query["username"] = user_doc.get("username")
                else:
                    query["username"] = user
            else:
                query["username"] = user

    if date and date != "All":
        query["date"] = date
        
    if search:
        search_query = {
            "$or": [
                {"date": {"$regex": search, "$options": "i"}},
                {"username": {"$regex": search, "$options": "i"}},
                {"entries.activity": {"$regex": search, "$options": "i"}}
            ]
        }
        if query:
            query = {"$and": [query, search_query]}
        else:
            query = search_query
            
    actual_sort_by = sortBy or sort_by or "date"
    sort_order = 1 if order == "asc" else -1
    
    total = await work_logs_collection.count_documents(query)
    cursor = work_logs_collection.find(query).sort(actual_sort_by, sort_order)
    
    if pagination:
        cursor = cursor.skip(skip).limit(limit)
        logs = await cursor.to_list(length=limit)
    else:
        logs = await cursor.to_list(length=None)
        
    for log in logs:
        await enrich_work_log_user(log)
        
    return {"data": logs, "total": total}

@router.post("/", response_description="Create a work log", response_model=WorkLogModel, status_code=status.HTTP_201_CREATED, response_model_by_alias=False)
async def create_work_log(
    log: CreateWorkLogModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    is_superuser = current_user.get("isSuperuser", False)
    privileges = current_user.get("privileges", [])
    
    if not is_superuser and "Create Work Log" not in privileges:
        raise HTTPException(status_code=403, detail="Not enough permissions to create work log")
        
    log_dict = log.model_dump()
    
    # Always create work log for the current user
    target_username = current_user["sub"]
    log_dict["username"] = target_username
    
    # Validate entries and ensure IDs
    entries = log_dict.get("entries") or []
    if not entries:
        raise HTTPException(status_code=400, detail="Work log must contain at least one time slot activity entry.")
        
    # Check for time overlaps
    validate_entries_time_overlap(entries)
    
    for entry in entries:
        if not entry.get("id"):
            entry["id"] = str(uuid.uuid4())
            
    log_dict["entries"] = entries
    
    # Enforce current day date for work log creation
    today_str = datetime.now().strftime("%Y-%m-%d")
    log_dict["date"] = today_str

    # Check if a log instance for this user and date already exists
    existing = await work_logs_collection.find_one({
        "username": target_username,
        "date": log_dict["date"]
    })
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"A work log for '{target_username}' on {log_dict['date']} already exists. Please update today's log instead."
        )
        
    now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    log_dict["createdAt"] = now_iso
    log_dict["updatedAt"] = now_iso
    
    new_doc = await work_logs_collection.insert_one(log_dict)
    created_log = await work_logs_collection.find_one({"_id": new_doc.inserted_id})
    await enrich_work_log_user(created_log)
    return created_log

@router.get("/{id}", response_description="Get single work log", response_model=WorkLogModel, response_model_by_alias=False)
async def show_work_log(id: str, current_user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")
        
    log = await work_logs_collection.find_one({"_id": ObjectId(id)})
    if not log:
        raise HTTPException(status_code=404, detail="Work log not found")
        
    is_superuser = current_user.get("isSuperuser", False)
    privileges = current_user.get("privileges", [])
    has_view_all = is_superuser or "View All Work Logs" in privileges
    
    if not has_view_all and log.get("username") != current_user["sub"]:
        raise HTTPException(status_code=403, detail="Not enough permissions to view this work log")
        
    await enrich_work_log_user(log)
    return log

@router.put("/{id}", response_description="Update a work log", response_model=WorkLogModel, response_model_by_alias=False)
async def update_work_log(
    id: str,
    log: UpdateWorkLogModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")
        
    existing = await work_logs_collection.find_one({"_id": ObjectId(id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Work log not found")
        
    is_superuser = current_user.get("isSuperuser", False)
    privileges = current_user.get("privileges", [])
    
    has_update_all = is_superuser or "View All Work Logs" in privileges
    if not has_update_all:
        if "Update Work Log" not in privileges:
            raise HTTPException(status_code=403, detail="Not enough permissions to update work log")
        if existing.get("username") != current_user["sub"]:
            raise HTTPException(status_code=403, detail="You can only update your own work logs")
            
    updates = {k: v for k, v in log.model_dump().items() if v is not None}
    updates.pop("date", None)
    updates.pop("username", None)
    
    if "entries" in updates:
        entries = updates["entries"] or []
        if not entries:
            raise HTTPException(status_code=400, detail="Work log must contain at least one time slot activity entry.")
        validate_entries_time_overlap(entries)
        for entry in entries:
            if not entry.get("id"):
                entry["id"] = str(uuid.uuid4())
        updates["entries"] = entries
        
    updates["updatedAt"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    
    await work_logs_collection.update_one({"_id": ObjectId(id)}, {"$set": updates})
    updated_doc = await work_logs_collection.find_one({"_id": ObjectId(id)})
    await enrich_work_log_user(updated_doc)
    return updated_doc

@router.delete("/{id}", response_description="Delete a work log")
async def delete_work_log(id: str, current_user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")
        
    existing = await work_logs_collection.find_one({"_id": ObjectId(id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Work log not found")
        
    is_superuser = current_user.get("isSuperuser", False)
    privileges = current_user.get("privileges", [])
    
    has_delete_all = is_superuser or "View All Work Logs" in privileges
    if not has_delete_all:
        if "Delete Work Log" not in privileges:
            raise HTTPException(status_code=403, detail="Not enough permissions to delete work log")
        if existing.get("username") != current_user["sub"]:
            raise HTTPException(status_code=403, detail="You can only delete your own work logs")
            
    await work_logs_collection.delete_one({"_id": ObjectId(id)})
    return Response(status_code=status.HTTP_204_NO_CONTENT)
