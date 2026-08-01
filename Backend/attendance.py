from fastapi import APIRouter, HTTPException, status, Body, Query, Depends, Response
from auth_utils import get_current_user
from typing import Optional, List
from database import db
from models import (
    AttendanceModel, CreateAttendanceModel, UpdateAttendanceModel, PaginatedAttendanceModel, AttendanceConfigModel
)
from bson import ObjectId
from datetime import datetime, timedelta

router = APIRouter()
attendance_collection = db.get_collection("attendance")
config_collection = db.get_collection("attendance_config")

# Helper to verify department head
async def is_department_head(user: dict, target_department: str) -> bool:
    if user.get("isSuperuser", False):
        return True
    # Find department Head configuration
    dept_col = db.get_collection("departments")
    dept = await dept_col.find_one({"name": target_department})
    if dept and dept.get("departmentHead") == user.get("sub"):
        return True
    return False

def determine_shift_for_user(username: str, roaster: dict, config_shifts: list, config_roster_rows: list, default_start: str) -> tuple:
    if not roaster:
        return "Default", default_start, "17:00"

    shift_col = roaster.get("shift") or ""
    assignees = roaster.get("assignees") or []

    try:
        user_idx = assignees.index(username)
    except ValueError:
        user_idx = -1

    def norm(s):
        if not s:
            return ""
        return s.lower().replace(" ", "").replace("-", "").replace("_", "")

    # Helper to check if a roster row name matches the column/shift (e.g. "Shift-1" matches "Shift 1 Row 1")
    def row_matches_column(row_name: str, col_name: str) -> bool:
        r_norm = norm(row_name)
        c_norm = norm(col_name)
        if not c_norm or not r_norm:
            return False
        return c_norm in r_norm

    mapped_shift_name = None

    if user_idx >= 0 and config_roster_rows:
        # Find all roster rows that match the roster column (e.g. "Shift-1")
        col_rows = [r for r in config_roster_rows if row_matches_column(r.get("name", ""), shift_col)]
        # Sort alphabetically to keep index matching consistent with rendering
        col_rows.sort(key=lambda x: x.get("name", "").lower())
        
        if user_idx < len(col_rows):
            matched_row = col_rows[user_idx]
            mapped_shift_name = matched_row.get("mappedShift")

    if not mapped_shift_name:
        mapped_shift_name = shift_col

    norm_mapped_shift = norm(mapped_shift_name)

    # Look up mapped shift in config_shifts
    if config_shifts:
        shift_info = next((s for s in config_shifts if norm(s.get("name")) == norm_mapped_shift), None)
        if shift_info:
            return shift_info.get("name") or mapped_shift_name, shift_info.get("startTime", default_start), shift_info.get("endTime", "17:00")

    # Fallback to defaults
    return mapped_shift_name or "Default", default_start, "17:00"

@router.get("/", response_description="List attendance records", response_model=PaginatedAttendanceModel, response_model_by_alias=False)
async def list_attendance(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1),
    pagination: bool = Query(True),
    search: Optional[str] = None,
    department: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    sortBy: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    order: str = Query("desc"),
    current_user: dict = Depends(get_current_user)
):
    query = {}
    is_superuser = current_user.get("isSuperuser", False)
    privileges = current_user.get("privileges", [])

    # Access control implementation
    if is_superuser or "View All Attendance" in privileges:
        if department:
            query["department"] = department
    elif "View Departmental Attendance" in privileges:
        query["department"] = current_user.get("department") or "None"
    elif "View Self Attendance" in privileges:
        query["username"] = current_user.get("sub")
    else:
        raise HTTPException(status_code=403, detail="Not enough permissions to view attendance")

    # Search filter
    if search:
        users_col = db.get_collection("users")
        matching_users = await users_col.find({
            "$or": [
                {"username": {"$regex": search, "$options": "i"}},
                {"firstName": {"$regex": search, "$options": "i"}},
                {"lastName": {"$regex": search, "$options": "i"}}
            ]
        }).to_list(length=None)
        matching_usernames = [u["username"] for u in matching_users if u.get("username")]
        
        search_query = {
            "$or": [
                {"username": {"$in": matching_usernames}},
                {"department": {"$regex": search, "$options": "i"}}
            ]
        }
        if query:
            query = {"$and": [query, search_query]}
        else:
            query = search_query

    # Date filter range
    if startDate and endDate:
        query["date"] = {"$gte": startDate, "$lte": endDate}
    elif startDate:
        query["date"] = {"$gte": startDate}
    elif endDate:
        query["date"] = {"$lte": endDate}

    actual_sort_by = sortBy or sort_by or "date"
    sort_order = 1 if order == "asc" else -1

    total = await attendance_collection.count_documents(query)
    cursor = attendance_collection.find(query).sort(actual_sort_by, sort_order)

    if pagination:
        cursor = cursor.skip(skip).limit(limit)
        items = await cursor.to_list(length=limit)
    else:
        items = await cursor.to_list(length=None)

    # Enrich each record with fullName and shift details from rosters
    users_col = db.get_collection("users")
    roasters_col = db.get_collection("roasters")
    config = await config_collection.find_one({}) or {}
    config_shifts = config.get("shifts", [])
    config_roster_rows = config.get("rosterRows", [])
    default_start = config.get("shiftStart", "09:00")

    enriched_items = []
    for item in items:
        enriched = dict(item)
        enriched["id"] = str(item["_id"])
        
        user = await users_col.find_one({"username": item["username"]})
        if user:
            first_name = user.get("firstName") or ""
            last_name = user.get("lastName") or ""
            full_name = f"{first_name} {last_name}".strip()
            enriched["fullName"] = full_name if full_name else item["username"]
        else:
            enriched["fullName"] = item["username"]

        # If user has not explicitly logged out, take the last active (API call) time
        # ONLY if the last active time is on the same day as the attendance record (or next day for night shift)
        if not item.get("loggedOut", False) and user and user.get("lastActive"):
            last_active_str = user.get("lastActive")
            try:
                if last_active_str.endswith("Z"):
                    # Convert UTC to local timezone
                    import zoneinfo
                    tz = zoneinfo.ZoneInfo("Asia/Kolkata")
                    dt_utc = datetime.fromisoformat(last_active_str.replace("Z", "+00:00"))
                    dt_local = dt_utc.astimezone(tz)
                else:
                    # Parse local datetime directly
                    dt_local = datetime.fromisoformat(last_active_str)
                
                # Check if it's a night shift
                shift_start = item.get("shiftStart") or "09:00"
                shift_end = item.get("shiftEnd") or "17:00"
                sh, sm = 9, 0
                eh, em = 17, 0
                try:
                    sh, sm = map(int, shift_start.split(":"))
                except Exception:
                    pass
                try:
                    eh, em = map(int, shift_end.split(":"))
                except Exception:
                    pass
                
                is_record_night = (sh > eh) or (sh == eh and sm >= em)
                
                rec_dt = datetime.strptime(item.get("date"), "%Y-%m-%d")
                shift_start_dt = rec_dt.replace(hour=sh, minute=sm, second=0, microsecond=0)
                if is_record_night:
                    shift_end_dt = rec_dt.replace(hour=eh, minute=em, second=0, microsecond=0) + timedelta(days=1)
                else:
                    shift_end_dt = rec_dt.replace(hour=eh, minute=em, second=0, microsecond=0)
                
                # Align timezones
                if dt_local.tzinfo:
                    shift_start_dt = shift_start_dt.replace(tzinfo=dt_local.tzinfo)
                    shift_end_dt = shift_end_dt.replace(tzinfo=dt_local.tzinfo)
                
                # Active window is from [Shift Start - 3 hours] to [Shift End + 3 hours]
                window_start = shift_start_dt - timedelta(hours=3)
                window_end = shift_end_dt + timedelta(hours=3)
                
                if window_start <= dt_local <= window_end:
                    # Only enrich if dt_local is strictly later than existing db lastLogout
                    db_logout_str = item.get("lastLogout")
                    should_enrich = True
                    if db_logout_str:
                        try:
                            db_logout_dt = datetime.fromisoformat(db_logout_str)
                            # Align timezones for comparison
                            if db_logout_dt.tzinfo is not None and dt_local.tzinfo is None:
                                db_logout_dt = db_logout_dt.replace(tzinfo=None)
                            elif db_logout_dt.tzinfo is None and dt_local.tzinfo is not None:
                                dt_local = dt_local.replace(tzinfo=None)
                                
                            if dt_local <= db_logout_dt:
                                should_enrich = False
                        except Exception:
                            pass
                    
                    if should_enrich:
                        # Align timezone for output
                        if dt_local.tzinfo is not None and item.get("firstLogin") and datetime.fromisoformat(item["firstLogin"]).tzinfo is None:
                            dt_local = dt_local.replace(tzinfo=None)
                        enriched["lastLogout"] = dt_local.isoformat()
            except Exception:
                # Fallback to simple matching if parsing fails
                try:
                    if last_active_str.endswith("Z"):
                        dt_utc = datetime.fromisoformat(last_active_str.replace("Z", "+00:00"))
                        dt_local = dt_utc.astimezone()
                        last_active_local_str = dt_local.isoformat()
                    else:
                        last_active_local_str = last_active_str
                    if last_active_local_str[:10] == item.get("date"):
                        enriched["lastLogout"] = last_active_local_str
                except Exception:
                    pass

            # Recalculate workedHours based on firstLogin and lastActive fallback
            first_login_str = enriched.get("firstLogin")
            if first_login_str and enriched["lastLogout"]:
                try:
                    start_dt = datetime.fromisoformat(first_login_str)
                    end_dt = datetime.fromisoformat(enriched["lastLogout"])
                    if start_dt.tzinfo is not None and end_dt.tzinfo is None:
                        start_dt = start_dt.replace(tzinfo=None)
                    elif start_dt.tzinfo is None and end_dt.tzinfo is not None:
                        end_dt = end_dt.replace(tzinfo=None)
                    enriched["workedHours"] = round((end_dt - start_dt).total_seconds() / 3600.0, 1)
                except Exception:
                    pass

        # Roster shift lookup
        log_date = item.get("date")
        username = item.get("username")
        roaster = await roasters_col.find_one({"date": log_date, "assignees": username})
        
        shift_name, start_time, end_time = determine_shift_for_user(username, roaster, config_shifts, config_roster_rows, default_start)
        enriched["shiftName"] = shift_name
        enriched["shiftStart"] = start_time
        enriched["shiftEnd"] = end_time

        enriched_items.append(enriched)

    return {"data": enriched_items, "total": total}

@router.post("/regularize/{id}")
async def request_regularize(
    id: str,
    reason: str = Body(..., embed=True),
    remarks: Optional[str] = Body(None, embed=True),
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    attendance = await attendance_collection.find_one({"_id": ObjectId(id)})
    if not attendance:
        raise HTTPException(status_code=404, detail="Attendance record not found")

    if not current_user.get("isSuperuser", False) and attendance.get("username") != current_user.get("sub"):
        raise HTTPException(status_code=403, detail="You can only regularize your own attendance")

    await attendance_collection.update_one(
        {"_id": ObjectId(id)},
        {
            "$set": {
                "regularizeStatus": "Pending",
                "regularizeReason": reason,
                "regularizeRemarks": remarks
            }
        }
    )
    from notification_helper import log_page_update
    await log_page_update("attendance", department=attendance.get("department"), username=current_user.get("sub"))
    return {"message": "Regularization request submitted successfully"}

@router.post("/approve/{id}")
async def approve_regularize(
    id: str,
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    attendance = await attendance_collection.find_one({"_id": ObjectId(id)})
    if not attendance:
        raise HTTPException(status_code=404, detail="Attendance record not found")

    target_dept = attendance.get("department")
    if not await is_department_head(current_user, target_dept):
        raise HTTPException(status_code=403, detail="Only Department Heads or Superusers can approve regularization")

    await attendance_collection.update_one(
        {"_id": ObjectId(id)},
        {
            "$set": {
                "regularizeStatus": "Approved",
                "workedHours": max(attendance.get("workedHours", 0.0), 8.0)
            }
        }
    )
    from notification_helper import log_page_update
    await log_page_update("attendance", department=target_dept, username=current_user.get("sub"))
    return {"message": "Regularization request approved"}

@router.post("/reject/{id}")
async def reject_regularize(
    id: str,
    remarks: Optional[str] = Body(None, embed=True),
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    attendance = await attendance_collection.find_one({"_id": ObjectId(id)})
    if not attendance:
        raise HTTPException(status_code=404, detail="Attendance record not found")

    target_dept = attendance.get("department")
    if not await is_department_head(current_user, target_dept):
        raise HTTPException(status_code=403, detail="Only Department Heads or Superusers can reject regularization")

    await attendance_collection.update_one(
        {"_id": ObjectId(id)},
        {
            "$set": {
                "regularizeStatus": "Rejected",
                "regularizeRemarks": remarks or "Rejected by Department Head"
            }
        }
    )
    from notification_helper import log_page_update
    await log_page_update("attendance", department=target_dept, username=current_user.get("sub"))
    return {"message": "Regularization request rejected"}

@router.get("/server-time")
async def get_server_time():
    from datetime import datetime, timezone
    return {"currentTime": datetime.now(timezone.utc).isoformat()}

@router.get("/config", response_model=AttendanceConfigModel, response_model_by_alias=False)
async def get_attendance_config():
    config = await config_collection.find_one({})
    if not config:
        default_config = {
            "startDay": 1,
            "endDay": 31,
            "shiftStart": "09:00",
            "lateGracePeriod": 30,
            "maxAllowedDays": 26,
            "trackedRole": "All Roles",
            "shifts": [
                {"name": "Shift-1", "startTime": "06:30", "endTime": "14:30"},
                {"name": "Shift-2", "startTime": "14:30", "endTime": "22:30"},
                {"name": "Shift-3", "startTime": "22:30", "endTime": "06:30"}
            ],
            "rosterRows": [
                {"name": "Shift 1 Row 1", "mappedShift": "Shift-1"},
                {"name": "Shift 1 Row 2", "mappedShift": "Shift-1"},
                {"name": "Shift 2 Row 1", "mappedShift": "Shift-2"},
                {"name": "Shift 2 Row 2", "mappedShift": "Shift-2"},
                {"name": "Shift 3 Row 1", "mappedShift": "Shift-3"},
                {"name": "Shift 3 Row 2", "mappedShift": "Shift-3"},
                {"name": "Leave", "mappedShift": "Leave"}
            ],
            "validationRules": [
                {
                    "id": "rule_default_night",
                    "fromShift": "Shift-3",
                    "allowedNextShifts": ["Shift-4", "Leave"],
                    "restrictedNextShifts": ["Shift-1", "Shift-2", "Shift-3"],
                    "description": "Persons working Shift-3 (Night) can only take Shift-4 or Leave on the next day."
                }
            ],
            "lateLoginRestriction": True
        }
        await config_collection.insert_one(default_config)
        config = await config_collection.find_one({})
    # Backward compatibility for existing configs
    updates = {}
    if "rosterRows" not in config:
        config["rosterRows"] = [
            {"name": "Shift 1 Row 1", "mappedShift": "Shift-1"},
            {"name": "Shift 1 Row 2", "mappedShift": "Shift-1"},
            {"name": "Shift 2 Row 1", "mappedShift": "Shift-2"},
            {"name": "Shift 2 Row 2", "mappedShift": "Shift-2"},
            {"name": "Shift 3 Row 1", "mappedShift": "Shift-3"},
            {"name": "Shift 3 Row 2", "mappedShift": "Shift-3"},
            {"name": "Leave", "mappedShift": "Leave"}
        ]
        updates["rosterRows"] = config["rosterRows"]
    if "validationRules" not in config:
        config["validationRules"] = [
            {
                "id": "rule_default_night",
                "fromShift": "Shift-3",
                "allowedNextShifts": ["Shift-4", "Leave"],
                "restrictedNextShifts": ["Shift-1", "Shift-2", "Shift-3"],
                "description": "Persons working Shift-3 (Night) can only take Shift-4 or Leave on the next day."
            }
        ]
        updates["validationRules"] = config["validationRules"]
    if "lateLoginRestriction" not in config:
        config["lateLoginRestriction"] = True
        updates["lateLoginRestriction"] = True
    if updates:
        await config_collection.update_one({"_id": config["_id"]}, {"$set": updates})
    return config

@router.post("/config", response_model=AttendanceConfigModel, response_model_by_alias=False)
async def update_attendance_config(
    payload: AttendanceConfigModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    is_superuser = current_user.get("isSuperuser", False)
    privileges = current_user.get("privileges", [])
    if not is_superuser and "Update Configurations" not in privileges:
        raise HTTPException(status_code=403, detail="Not enough permissions to update configuration")

    config = await config_collection.find_one({})
    update_data = {
        "startDay": payload.startDay,
        "endDay": payload.endDay,
        "shiftStart": payload.shiftStart,
        "lateGracePeriod": payload.lateGracePeriod,
        "maxAllowedDays": payload.maxAllowedDays,
        "shifts": [dict(s) for s in payload.shifts],
        "trackedRole": payload.trackedRole or "All Roles",
        "rosterRows": [dict(r) for r in payload.rosterRows],
        "validationRules": [dict(r) for r in payload.validationRules],
        "lateLoginRestriction": payload.lateLoginRestriction
    }
    if config:
        await config_collection.update_one({"_id": config["_id"]}, {"$set": update_data})
    else:
        await config_collection.insert_one(update_data)
        
    new_config = await config_collection.find_one({})
    return new_config


@router.get("/summary")
async def get_attendance_summary(
    startDate: str = Query(...),
    endDate: str = Query(...),
    department: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    is_superuser = current_user.get("isSuperuser", False)
    privileges = current_user.get("privileges", [])
    
    # Determine access query filter for users
    query = {"status": True}
    
    if is_superuser or "View All Attendance" in privileges:
        if department:
            query["department"] = department
    elif "View Departmental Attendance" in privileges:
        query["department"] = current_user.get("department") or "None"
    elif "View Self Attendance" in privileges:
        query["username"] = current_user.get("sub")
    else:
        raise HTTPException(status_code=403, detail="Not enough permissions to view attendance summaries")
        
    # Fetch attendance config to know shiftStart, lateGracePeriod and trackedRole
    config = await config_collection.find_one({})
    if not config:
        config = {"startDay": 1, "endDay": 31, "shiftStart": "09:00", "lateGracePeriod": 30, "maxAllowedDays": 26, "trackedRole": "All Roles"}

    # Fetch users matching query
    users_col = db.get_collection("users")
    users = await users_col.find(query).to_list(length=None)

    # Filter users by trackedRole
    tracked_role = config.get("trackedRole")
    if tracked_role and tracked_role != "All Roles":
        users = [
            u for u in users
            if (
                u.get("role") == tracked_role
                or (isinstance(u.get("role"), list) and tracked_role in u.get("role"))
            )
        ]
        
    shift_start = config.get("shiftStart", "09:00")
    grace = config.get("lateGracePeriod", 30)
    max_days = config.get("maxAllowedDays", 26)
    
    try:
        sh, sm = map(int, shift_start.split(":"))
        threshold_mins = sh * 60 + sm + grace
    except Exception:
        threshold_mins = 9 * 60 + 30
        
    results = []
    for u in users:
        username = u.get("username")
        user_dept = u.get("department") or "None"
        
        # Fetch attendance records for this user in date range
        att_query = {
            "username": username,
            "date": {"$gte": startDate, "$lte": endDate}
        }
        logs = await attendance_collection.find(att_query).to_list(length=None)
        
        # Exclude unapproved late login attempts from summary
        logs = [
            log for log in logs
            if not (log.get("isLateAttempt") and log.get("lateApprovalStatus") in ("Pending", "Rejected"))
        ]
        
        present_days = len(logs)
        late_days = 0
        
        for log in logs:
            first_login = log.get("firstLogin")
            if first_login:
                try:
                    log_date = log.get("date")
                    curr_shift_start = shift_start
                    roasters_col = db.get_collection("roasters")
                    roaster = await roasters_col.find_one({"date": log_date, "assignees": username})
                    config_shifts = config.get("shifts", [])
                    config_roster_rows = config.get("rosterRows", [])
                    _, curr_shift_start, _ = determine_shift_for_user(username, roaster, config_shifts, config_roster_rows, shift_start)

                    sh, sm = map(int, curr_shift_start.split(":"))
                    threshold_mins = sh * 60 + sm + grace

                    dt = datetime.fromisoformat(first_login)
                    login_mins = dt.hour * 60 + dt.minute
                    if login_mins > threshold_mins:
                        late_days += 1
                except Exception:
                    pass
                    
        first_name = u.get("firstName") or ""
        last_name = u.get("lastName") or ""
        full_name = f"{first_name} {last_name}".strip()
        if not full_name:
            full_name = username
            
        results.append({
            "username": username,
            "fullName": full_name,
            "department": user_dept,
            "presentDays": present_days,
            "lateDays": late_days,
            "maxDays": max_days
        })
        
    return results

@router.put("/{id}", response_model=AttendanceModel, response_model_by_alias=False)
async def edit_attendance(
    id: str,
    payload: UpdateAttendanceModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")
        
    is_superuser = current_user.get("isSuperuser", False)
    privileges = current_user.get("privileges", [])
    if not is_superuser and "Update Attendance" not in privileges:
        raise HTTPException(status_code=403, detail="Not enough permissions to edit attendance")
        
    existing = await attendance_collection.find_one({"_id": ObjectId(id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Attendance log not found")
        
    update_dict = {k: v for k, v in payload.model_dump().items() if v is not None}
    
    # Calculate workedHours if firstLogin and lastLogout are modified or present
    first_login = update_dict.get("firstLogin") or existing.get("firstLogin")
    last_logout = update_dict.get("lastLogout") or existing.get("lastLogout")
    if first_login and last_logout:
        try:
            start_dt = datetime.fromisoformat(first_login)
            end_dt = datetime.fromisoformat(last_logout)
            update_dict["workedHours"] = round((end_dt - start_dt).total_seconds() / 3600.0, 1)
        except Exception:
            pass
            
    await attendance_collection.update_one(
        {"_id": ObjectId(id)},
        {"$set": update_dict}
    )
    
    updated = await attendance_collection.find_one({"_id": ObjectId(id)})
    from notification_helper import log_page_update
    await log_page_update("attendance", department=updated.get("department"), username=current_user.get("sub"))
    return updated

@router.delete("/{id}")
async def delete_attendance(
    id: str,
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")
        
    is_superuser = current_user.get("isSuperuser", False)
    privileges = current_user.get("privileges", [])
    if not is_superuser and "Delete Attendance" not in privileges:
        raise HTTPException(status_code=403, detail="Not enough privileges to delete attendance")
        
    delete_result = await attendance_collection.delete_one({"_id": ObjectId(id)})
    if delete_result.deleted_count == 1:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    raise HTTPException(status_code=404, detail="Attendance log not found")

# --- Late Login Approval Endpoints ---

@router.post("/approve-late/{id}")
async def approve_late_login(
    id: str,
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    record = await attendance_collection.find_one({"_id": ObjectId(id)})
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found")

    target_dept = record.get("department", "")
    if not await is_department_head(current_user, target_dept):
        raise HTTPException(status_code=403, detail="Only the department head can approve late logins")

    await attendance_collection.update_one(
        {"_id": ObjectId(id)},
        {
            "$set": {
                "lateApprovalStatus": "Approved",
            }
        }
    )
    from notification_helper import log_page_update
    await log_page_update("attendance", department=target_dept, username=current_user.get("sub"))
    return {"message": "Late login approved successfully"}

@router.post("/reject-late/{id}")
async def reject_late_login(
    id: str,
    current_user: dict = Depends(get_current_user),
    body: dict = Body(default={})
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    record = await attendance_collection.find_one({"_id": ObjectId(id)})
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found")

    target_dept = record.get("department", "")
    if not await is_department_head(current_user, target_dept):
        raise HTTPException(status_code=403, detail="Only the department head can reject late logins")

    remarks = body.get("remarks", "Rejected by Department Head")
    await attendance_collection.update_one(
        {"_id": ObjectId(id)},
        {
            "$set": {
                "lateApprovalStatus": "Rejected",
                "regularizeRemarks": remarks,
            }
        }
    )
    from notification_helper import log_page_update
    await log_page_update("attendance", department=target_dept, username=current_user.get("sub"))
    return {"message": "Late login rejected"}

# --- Verification Endpoints ---

verification_collection = db.get_collection("attendance_verification")

@router.get("/verification-status")
async def get_verification_status(current_user: dict = Depends(get_current_user)):
    records = await verification_collection.find({}).to_list(length=None)
    return {"verifiedPeriods": [r.get("periodLabel") for r in records if r.get("verified")]}

@router.get("/verification-data")
async def get_verification_data(
    periodLabel: str,
    current_user: dict = Depends(get_current_user)
):
    if not periodLabel:
        raise HTTPException(status_code=400, detail="periodLabel is required")
    record = await verification_collection.find_one({"periodLabel": periodLabel})
    if not record:
        return {"data": []}
    return {"data": record.get("data", [])}

@router.post("/verify-period")
async def verify_period(
    body: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    period_label = body.get("periodLabel")
    if not period_label:
        raise HTTPException(status_code=400, detail="periodLabel is required")
    
    await verification_collection.update_one(
        {"periodLabel": period_label},
        {"$set": {
            "verified": True, 
            "verifiedBy": current_user.get("sub"), 
            "verifiedAt": datetime.utcnow().isoformat(),
            "data": body.get("data", [])
        }},
        upsert=True
    )
    return {"message": "Period verified successfully"}
