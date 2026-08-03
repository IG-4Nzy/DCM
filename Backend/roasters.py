from fastapi import APIRouter, HTTPException, status, Body, Query, Depends, Response
from auth_utils import require_privilege, get_current_user
from fastapi.responses import JSONResponse
from typing import Optional, List
from database import db, get_local_now
from models import RoasterModel, CreateRoasterModel, UpdateRoasterModel, PaginatedRoastersModel, RoasterStatusModel, CreateRoasterStatusModel
from bson import ObjectId
from datetime import datetime, timezone, date, timedelta

router = APIRouter()
roasters_collection = db.get_collection("roasters")
roaster_status_collection = db.get_collection("roaster_status")

@router.get("/status", response_description="Get roster status", response_model=RoasterStatusModel, response_model_by_alias=False)
async def get_roaster_status(
    weekStartDate: str = Query(...),
    department: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    dept_doc = await db.get_collection("departments").find_one({
        "$or": [
            {"name": department},
            {"_id": ObjectId(department) if ObjectId.is_valid(department) else None}
        ]
    })
    dept_match = [department]
    if dept_doc:
        dept_match = [str(dept_doc["_id"]), dept_doc.get("name", "")]

    status_doc = await roaster_status_collection.find_one({"weekStartDate": weekStartDate, "department": {"$in": dept_match}})
    if not status_doc:
        return RoasterStatusModel(
            weekStartDate=weekStartDate,
            department=department,
            status="Pending",
            updatedByFullName=None,
            updatedAt=None
        )
    return status_doc

@router.post("/status", response_description="Create or update roster status", response_model=RoasterStatusModel, response_model_by_alias=False, dependencies=[Depends(require_privilege("Approve Roaster"))])
async def update_roaster_status(
    status_data: CreateRoasterStatusModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    # Get User Details
    users_collection = db.get_collection("users")
    user = await users_collection.find_one({"username": current_user.get("sub", "")})
    name_str = "Unknown"
    if user:
        first_name = user.get("firstName", "")
        last_name = user.get("lastName", "")
        name_str = f"{first_name} {last_name}".strip()
        if not name_str:
            name_str = user.get("username", "Unknown")

    update_doc = {
        "weekStartDate": status_data.weekStartDate,
        "department": status_data.department,
        "status": status_data.status,
        "updatedByFullName": name_str,
        "updatedAt": datetime.now(timezone.utc).isoformat()
    }

    result = await roaster_status_collection.update_one(
        {"weekStartDate": status_data.weekStartDate, "department": status_data.department},
        {"$set": update_doc},
        upsert=True
    )

    updated_doc = await roaster_status_collection.find_one({"weekStartDate": status_data.weekStartDate, "department": status_data.department})
    
    from notification_helper import log_page_update
    await log_page_update("roasters", department=status_data.department, username=current_user.get("sub"))
    
    return updated_doc

@router.post("/status/reset", response_description="Reset roster status to Pending", response_model=RoasterStatusModel, response_model_by_alias=False)
async def reset_roaster_status(
    status_data: CreateRoasterStatusModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    is_superuser = current_user.get("isSuperuser", False)
    privileges = current_user.get("privileges", [])
    if not is_superuser and "Create Roaster" not in privileges and "Update Roaster" not in privileges:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    # Get User Details
    users_collection = db.get_collection("users")
    user = await users_collection.find_one({"username": current_user.get("sub", "")})
    name_str = "Unknown"
    if user:
        first_name = user.get("firstName", "")
        last_name = user.get("lastName", "")
        name_str = f"{first_name} {last_name}".strip()
        if not name_str:
            name_str = user.get("username", "Unknown")

    update_doc = {
        "weekStartDate": status_data.weekStartDate,
        "department": status_data.department,
        "status": "Pending",
        "updatedByFullName": name_str,
        "updatedAt": datetime.now(timezone.utc).isoformat()
    }

    await roaster_status_collection.update_one(
        {"weekStartDate": status_data.weekStartDate, "department": status_data.department},
        {"$set": update_doc},
        upsert=True
    )

    updated_doc = await roaster_status_collection.find_one({"weekStartDate": status_data.weekStartDate, "department": status_data.department})
    return updated_doc

@router.get("/", response_description="List roasters", response_model=PaginatedRoastersModel, response_model_by_alias=False)
async def list_roasters(
    skip: int = Query(0, ge=0),
    limit: int = Query(500, ge=1),
    date: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    shift: Optional[str] = None,
    department: Optional[str] = None,
    sortBy: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    order: str = Query("desc"),
    pagination: bool = Query(True),
    current_user: dict = Depends(get_current_user)
):
    is_superuser = current_user.get("isSuperuser", False)
    privileges = current_user.get("privileges", [])

    if not is_superuser and "View Roaster" not in privileges and "View All Roaster" not in privileges:
        raise HTTPException(status_code=403, detail="Not enough permissions to view roasters")

    query = {}
    if date:
        query["date"] = date
    elif startDate and endDate:
        query["date"] = {"$gte": startDate, "$lte": endDate}
    if shift:
        query["shift"] = shift
    if department:
        dept_doc = await db.get_collection("departments").find_one({
            "$or": [
                {"name": department},
                {"_id": ObjectId(department) if ObjectId.is_valid(department) else None}
            ]
        })
        if dept_doc:
            query["department"] = {"$in": [str(dept_doc["_id"]), dept_doc.get("name", "")]}
        else:
            query["department"] = department

    actual_sort_by = sortBy or sort_by or "date"
    sort_order = 1 if order == "asc" else -1

    total = await roasters_collection.count_documents(query)
    cursor = roasters_collection.find(query).sort(actual_sort_by, sort_order)
    if pagination:
        cursor = cursor.skip(skip).limit(limit)
        roasters = await cursor.to_list(length=limit)
    else:
        roasters = await cursor.to_list(length=None)

    return {"data": roasters, "total": total}

async def record_roaster_history(
    department: str,
    changed_by_user: dict,
    changes: List[dict],
    batch_id: Optional[str] = None
):
    if not changes:
        return

    users_collection = db.get_collection("users")
    user = await users_collection.find_one({"username": changed_by_user.get("sub", "")})
    name_str = "Unknown"
    if user:
        first_name = user.get("firstName", "")
        last_name = user.get("lastName", "")
        name_str = f"{first_name} {last_name}".strip()
        if not name_str:
            name_str = user.get("username", "Unknown")

    now_iso = datetime.now(timezone.utc).isoformat()
    b_id = batch_id or f"batch_{int(datetime.now(timezone.utc).timestamp()*1000)}"

    history_doc = {
        "batchId": b_id,
        "department": department,
        "changedBy": changed_by_user.get("sub", ""),
        "changedByFullName": name_str,
        "timestamp": now_iso,
        "date": changes[0]["date"] if len(changes) > 0 else "",
        "affectedDates": list(set([c["date"] for c in changes])),
        "changes": changes
    }
    await db.get_collection("roaster_history").insert_one(history_doc)

@router.get("/history", response_description="Get roaster change history")
async def get_roaster_history(
    department: str = Query(...),
    startDate: Optional[str] = Query(None),
    endDate: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1),
    current_user: dict = Depends(get_current_user)
):
    is_superuser = current_user.get("isSuperuser", False)
    privileges = current_user.get("privileges", [])
    if not is_superuser and "View Roaster" not in privileges and "View All Roaster" not in privileges:
        raise HTTPException(status_code=403, detail="Not enough permissions to view roaster history")

    dept_doc = await db.get_collection("departments").find_one({
        "$or": [
            {"name": department},
            {"_id": ObjectId(department) if ObjectId.is_valid(department) else None}
        ]
    })
    dept_match = [department]
    if dept_doc:
        dept_match = list(set([d for d in [department, str(dept_doc["_id"]), dept_doc.get("name", "")] if d]))

    query = {"department": {"$in": dept_match}}
    if startDate and endDate:
        query["$or"] = [
            {"date": {"$gte": startDate, "$lte": endDate}},
            {"affectedDates": {"$elemMatch": {"$gte": startDate, "$lte": endDate}}}
        ]

    history_col = db.get_collection("roaster_history")
    cursor = history_col.find(query).sort("timestamp", -1).skip(skip).limit(limit)
    history_docs = await cursor.to_list(length=limit)

    result = []
    for doc in history_docs:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
        result.append(doc)

    return result

@router.post("/batch", response_description="Batch create/update roaster entries with change history")
async def batch_save_roasters(
    payload: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    is_superuser = current_user.get("isSuperuser", False)
    privileges = current_user.get("privileges", [])
    if not is_superuser and "Create Roaster" not in privileges and "Update Roaster" not in privileges:
        raise HTTPException(status_code=403, detail="Not enough permissions to edit roasters")

    items = payload.get("items", [])
    department = payload.get("department") or "General"
    if not items:
        return {"status": "success", "updatedCount": 0}

    today = date.today()
    start_of_current_iso_week_str = (today - timedelta(days=today.weekday())).isoformat()

    users_collection = db.get_collection("users")
    user = await users_collection.find_one({"username": current_user.get("sub", "")})
    name_str = "Unknown"
    if user:
        first_name = user.get("firstName", "")
        last_name = user.get("lastName", "")
        name_str = f"{first_name} {last_name}".strip()
        if not name_str:
            name_str = user.get("username", "Unknown")

    changes_list = []
    now_iso = datetime.now(timezone.utc).isoformat()
    b_id = f"batch_{int(datetime.now(timezone.utc).timestamp()*1000)}"

    for item in items:
        item_date = item.get("date")
        item_shift = item.get("shift")
        new_assignees = item.get("assignees", [])
        new_notes = item.get("notes")

        if not item_date or not item_shift:
            continue

        if not is_superuser and item_date < start_of_current_iso_week_str:
            continue

        existing = await roasters_collection.find_one({
            "date": item_date,
            "shift": item_shift,
            "department": department
        })

        prev_assignees = existing.get("assignees", []) if existing else []
        prev_notes = existing.get("notes") if existing else None

        if prev_assignees != new_assignees or prev_notes != new_notes:
            changes_list.append({
                "date": item_date,
                "shift": item_shift,
                "previousAssignees": prev_assignees,
                "newAssignees": new_assignees,
                "previousNotes": prev_notes,
                "newNotes": new_notes
            })

            if existing:
                await roasters_collection.update_one(
                    {"_id": existing["_id"]},
                    {"$set": {
                        "assignees": new_assignees,
                        "notes": new_notes,
                        "updatedAt": now_iso,
                        "updatedByFullName": name_str
                    }}
                )
            else:
                new_doc = {
                    "date": item_date,
                    "shift": item_shift,
                    "assignees": new_assignees,
                    "department": department,
                    "notes": new_notes,
                    "createdBy": current_user.get("sub", ""),
                    "updatedAt": now_iso,
                    "updatedByFullName": name_str
                }
                await roasters_collection.insert_one(new_doc)

    if changes_list:
        await record_roaster_history(department, current_user, changes_list, batch_id=b_id)
        
        # Reset status to Pending
        week_start_date = payload.get("weekStartDate") or (items[0]["date"] if items else None)
        if week_start_date:
            await roaster_status_collection.update_one(
                {"weekStartDate": week_start_date, "department": department},
                {"$set": {
                    "weekStartDate": week_start_date,
                    "department": department,
                    "status": "Pending",
                    "updatedByFullName": name_str,
                    "updatedAt": now_iso
                }},
                upsert=True
            )

        from notification_helper import log_page_update
        await log_page_update("roasters", department=department, username=current_user.get("sub"))

    return {"status": "success", "updatedCount": len(changes_list)}

@router.post("/", response_description="Create a roster entry", response_model=RoasterModel, status_code=status.HTTP_201_CREATED, response_model_by_alias=False)
async def create_roaster(
    roaster: CreateRoasterModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    is_superuser = current_user.get("isSuperuser", False)
    privileges = current_user.get("privileges", [])

    if not is_superuser and "Create Roaster" not in privileges:
        raise HTTPException(status_code=403, detail="Not enough permissions to create roasters")

    roaster_dict = roaster.model_dump()
    
    today = date.today()
    start_of_current_iso_week_str = (today - timedelta(days=today.weekday())).isoformat()
    if not is_superuser and roaster_dict["date"] < start_of_current_iso_week_str:
        raise HTTPException(status_code=400, detail="Cannot create roster entry for past weeks")

    roaster_dict["createdBy"] = current_user.get("sub", "")
    roaster_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()

    users_collection = db.get_collection("users")
    user = await users_collection.find_one({"username": current_user.get("sub", "")})
    user_dept = "General"
    if user:
        user_dept = user.get("department", "General")
        first_name = user.get("firstName", "")
        last_name = user.get("lastName", "")
        name_str = f"{first_name} {last_name}".strip()
        if not name_str:
            name_str = user.get("username", "Unknown")
        roaster_dict["updatedByFullName"] = name_str

    roaster_dict["department"] = roaster.department or user_dept

    existing = await roasters_collection.find_one({
        "date": roaster_dict["date"],
        "shift": roaster_dict["shift"],
        "department": roaster_dict["department"]
    })
    
    prev_assignees = existing.get("assignees", []) if existing else []
    new_assignees = roaster_dict.get("assignees", [])
    prev_notes = existing.get("notes") if existing else None
    new_notes = roaster_dict.get("notes")

    if prev_assignees != new_assignees or prev_notes != new_notes:
        await record_roaster_history(
            roaster_dict["department"],
            current_user,
            [{
                "date": roaster_dict["date"],
                "shift": roaster_dict["shift"],
                "previousAssignees": prev_assignees,
                "newAssignees": new_assignees,
                "previousNotes": prev_notes,
                "newNotes": new_notes
            }]
        )

    if existing:
        update_fields = {
            "assignees": new_assignees,
            "notes": new_notes,
            "updatedAt": datetime.now(timezone.utc).isoformat(),
            "updatedByFullName": roaster_dict.get("updatedByFullName")
        }
        await roasters_collection.update_one(
            {"_id": existing["_id"]},
            {"$set": update_fields}
        )
        created = await roasters_collection.find_one({"_id": existing["_id"]})
        from notification_helper import log_page_update
        await log_page_update("roasters", department=created.get("department"), username=current_user.get("sub"))
        return created

    new_roaster = await roasters_collection.insert_one(roaster_dict)
    created = await roasters_collection.find_one({"_id": new_roaster.inserted_id})
    
    from notification_helper import log_page_update
    await log_page_update("roasters", department=created.get("department"), username=current_user.get("sub"))
    
    return created

@router.put("/{id}", response_description="Update a roster entry", response_model=RoasterModel, response_model_by_alias=False, dependencies=[Depends(require_privilege("Update Roaster"))])
async def update_roaster(id: str, roaster: UpdateRoasterModel = Body(...), current_user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    roaster_dict = {k: v for k, v in roaster.model_dump().items() if v is not None}

    existing = await roasters_collection.find_one({"_id": ObjectId(id)})
    if not existing:
        raise HTTPException(status_code=404, detail=f"Roster {id} not found")

    today = date.today()
    start_of_current_iso_week_str = (today - timedelta(days=today.weekday())).isoformat()
    roster_date = roaster_dict.get("date") or existing.get("date")
    is_superuser = current_user.get("isSuperuser", False)
    if not is_superuser and roster_date and roster_date < start_of_current_iso_week_str:
        raise HTTPException(status_code=400, detail="Cannot edit roster entry for past weeks")

    if len(roaster_dict) >= 1:
        roaster_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()
        
        users_collection = db.get_collection("users")
        user = await users_collection.find_one({"username": current_user.get("sub", "")})
        if user:
            first_name = user.get("firstName", "")
            last_name = user.get("lastName", "")
            name_str = f"{first_name} {last_name}".strip()
            if not name_str:
                name_str = user.get("username", "Unknown")
            roaster_dict["updatedByFullName"] = name_str

        prev_assignees = existing.get("assignees", [])
        new_assignees = roaster_dict.get("assignees", prev_assignees)
        prev_notes = existing.get("notes")
        new_notes = roaster_dict.get("notes", prev_notes)

        if prev_assignees != new_assignees or prev_notes != new_notes:
            await record_roaster_history(
                existing.get("department", "General"),
                current_user,
                [{
                    "date": existing.get("date"),
                    "shift": existing.get("shift"),
                    "previousAssignees": prev_assignees,
                    "newAssignees": new_assignees,
                    "previousNotes": prev_notes,
                    "newNotes": new_notes
                }]
            )

        update_result = await roasters_collection.update_one(
            {"_id": ObjectId(id)}, {"$set": roaster_dict}
        )

        if update_result.modified_count == 1:
            if (updated := await roasters_collection.find_one({"_id": ObjectId(id)})) is not None:
                from notification_helper import log_page_update
                await log_page_update("roasters", department=updated.get("department"), username=current_user.get("sub"))
                return updated

    if (existing := await roasters_collection.find_one({"_id": ObjectId(id)})) is not None:
        return existing

    raise HTTPException(status_code=404, detail=f"Roster {id} not found")

@router.delete("/{id}", response_description="Delete a roster entry", dependencies=[Depends(require_privilege("Delete Roaster"))])
async def delete_roaster(id: str, current_user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    existing = await roasters_collection.find_one({"_id": ObjectId(id)})
    if not existing:
        raise HTTPException(status_code=404, detail=f"Roster {id} not found")

    # Enforce no past weeks (allow past days within the current week)
    today = date.today()
    start_of_current_iso_week = today - timedelta(days=today.weekday())
    start_of_current_iso_week_str = start_of_current_iso_week.isoformat()
    is_superuser = current_user.get("isSuperuser", False)
    if not is_superuser and existing.get("date") and existing["date"] < start_of_current_iso_week_str:
        raise HTTPException(status_code=400, detail="Cannot delete roster entry for past weeks")

    delete_result = await roasters_collection.delete_one({"_id": ObjectId(id)})

    if delete_result.deleted_count == 1:
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    raise HTTPException(status_code=404, detail=f"Roster {id} not found")

async def reconcile_roster_leaves(department: str, now_local: datetime):
    today_str = now_local.strftime("%Y-%m-%d")
    start_check_date = (now_local - timedelta(days=45)).strftime("%Y-%m-%d")
    
    roasters = await roasters_collection.find({
        "department": department,
        "date": {"$gte": start_check_date, "$lt": today_str},
        "shift": {"$ne": "Leave"},
        "assignees": {"$exists": True, "$ne": []}
    }).to_list(length=None)
    
    if not roasters:
        return

    attendance_col = db.get_collection("attendance")
    
    for roster in roasters:
        roster_date = roster["date"]
        assignees = list(roster.get("assignees", []))
        changed_roster = False
        
        for username in assignees:
            att = await attendance_col.find_one({
                "username": username,
                "date": roster_date
            })
            did_login = False
            if att and att.get("firstLogin"):
                did_login = True
                
            if not did_login:
                roster["assignees"] = [u for u in roster["assignees"] if u != username]
                changed_roster = True
                
                leave_roster = await roasters_collection.find_one({
                    "date": roster_date,
                    "shift": "Leave",
                    "department": department
                })
                
                if leave_roster:
                    leave_assignees = list(leave_roster.get("assignees", []))
                    if username not in leave_assignees:
                        leave_assignees.append(username)
                        await roasters_collection.update_one(
                            {"_id": leave_roster["_id"]},
                            {"$set": {
                                "assignees": leave_assignees,
                                "updatedAt": datetime.now(timezone.utc).isoformat()
                            }}
                        )
                else:
                    new_leave_roster = {
                        "date": roster_date,
                        "shift": "Leave",
                        "department": department,
                        "assignees": [username],
                        "notes": "Auto-marked Leave (No login)",
                        "createdBy": "system",
                        "updatedAt": datetime.now(timezone.utc).isoformat(),
                        "updatedByFullName": "System Auto-Reconciliation"
                    }
                    await roasters_collection.insert_one(new_leave_roster)
        
        if changed_roster:
            await roasters_collection.update_one(
                {"_id": roster["_id"]},
                {"$set": {
                    "assignees": roster["assignees"],
                    "updatedAt": datetime.now(timezone.utc).isoformat()
                }}
            )

@router.get("/duty-summary", response_description="Get duty day counts per staff for the configured monthly cycle and current week")
async def get_duty_summary(
    department: str = Query(...),
    date_str: Optional[str] = Query(None, alias="date"),
    current_user: dict = Depends(get_current_user)
):
    is_superuser = current_user.get("isSuperuser", False)
    privileges = current_user.get("privileges", [])
    if not is_superuser and "View Roaster" not in privileges and "View All Roaster" not in privileges:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    # Reconcile roster leaves for the past dates in this department
    await reconcile_roster_leaves(department, get_local_now())

    # Get attendance config for cycle start/end days
    config_collection = db.get_collection("attendance_config")
    config = await config_collection.find_one({}) or {}
    start_day = int(config.get("startDay", 1))
    end_day = int(config.get("endDay", 31))
    max_days = int(config.get("maxAllowedDays", 26))

    if date_str:
        try:
            today = datetime.strptime(date_str, "%Y-%m-%d").date()
        except Exception:
            today = date.today()
    else:
        today = date.today()

    # Calculate cycle start and end dates based on today/selected date
    import calendar
    if start_day == 1:
        cycle_start = today.replace(day=1)
        last_day = calendar.monthrange(today.year, today.month)[1]
        cycle_end = today.replace(day=last_day)
    else:
        if today.day >= start_day:
            last_day_curr = calendar.monthrange(today.year, today.month)[1]
            cycle_start = today.replace(day=min(start_day, last_day_curr))
            
            next_month = today.month + 1 if today.month < 12 else 1
            next_year = today.year if today.month < 12 else today.year + 1
            last_day_next = calendar.monthrange(next_year, next_month)[1]
            cycle_end = date(next_year, next_month, min(end_day, last_day_next))
        else:
            prev_month = today.month - 1 if today.month > 1 else 12
            prev_year = today.year if today.month > 1 else today.year - 1
            last_day_prev = calendar.monthrange(prev_year, prev_month)[1]
            cycle_start = date(prev_year, prev_month, min(start_day, last_day_prev))
            
            last_day_curr = calendar.monthrange(today.year, today.month)[1]
            cycle_end = today.replace(day=min(end_day, last_day_curr))

    cycle_start_str = cycle_start.isoformat()
    cycle_end_str = cycle_end.isoformat()

    # Calculate weeks list within cycle_start and cycle_end
    weeks = []
    curr = cycle_start
    while curr <= cycle_end:
        w_start = curr - timedelta(days=curr.weekday())
        w_end = w_start + timedelta(days=6)
        week_key = (w_start, w_end)
        if week_key not in weeks:
            weeks.append(week_key)
        curr += timedelta(days=7 - curr.weekday())

    weeks_list = []
    for ws, we in sorted(weeks):
        weeks_list.append({
            "start": ws.isoformat(),
            "end": we.isoformat(),
            "label": f"Week ({ws.strftime('%d %b')} - {we.strftime('%d %b')})"
        })

    # Calculate current week boundaries
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)
    week_start_str = week_start.isoformat()
    week_end_str = week_end.isoformat()

    dept_doc = await db.get_collection("departments").find_one({
        "$or": [
            {"name": department},
            {"_id": ObjectId(department) if ObjectId.is_valid(department) else None}
        ]
    })
    dept_match = [department]
    if dept_doc:
        dept_match = list(set([d for d in [department, str(dept_doc["_id"]), dept_doc.get("name", "")] if d]))

    # Fetch all rosters in the monthly cycle for this department (exclude Leave)
    month_query = {
        "date": {"$gte": cycle_start_str, "$lte": cycle_end_str},
        "department": {"$in": dept_match},
        "shift": {"$ne": "Leave"}
    }
    month_rosters = await roasters_collection.find(month_query).to_list(length=None)

    # Fetch all rosters in the current week for this department (exclude Leave)
    week_query = {
        "date": {"$gte": week_start_str, "$lte": week_end_str},
        "department": {"$in": dept_match},
        "shift": {"$ne": "Leave"}
    }
    week_rosters = await roasters_collection.find(week_query).to_list(length=None)

    # Count unique duty days per staff member
    month_days = {}  # username -> set of dates
    week_days = {}   # username -> set of dates

    for roster in month_rosters:
        for assignee in roster.get("assignees", []):
            if assignee not in month_days:
                month_days[assignee] = set()
            month_days[assignee].add(roster["date"])

    for roster in week_rosters:
        for assignee in roster.get("assignees", []):
            if assignee not in week_days:
                week_days[assignee] = set()
            week_days[assignee].add(roster["date"])

    # Get all users of this department with the tracked role
    users_collection = db.get_collection("users")
    tracked_role = config.get("trackedRole", "All Roles")
    user_query = {"department": {"$in": dept_match}, "status": {"$ne": False}}
    user_query["$or"] = [
        {"isSuperuser": {"$ne": True}},
        {"is_superuser": {"$ne": True}}
    ]
    all_users = await users_collection.find(user_query).to_list(length=None)

    all_staff = set()
    for u in all_users:
        if tracked_role == "All Roles" or u.get("role") == tracked_role:
            all_staff.add(u["username"])

    all_staff.update(month_days.keys())
    all_staff.update(week_days.keys())

    # Count days per week per staff
    staff_weeks = {}
    for staff in all_staff:
        staff_weeks[staff] = {w["label"]: set() for w in weeks_list}

    for roster in month_rosters:
        r_date = roster["date"]
        for assignee in roster.get("assignees", []):
            if assignee in staff_weeks:
                dt = datetime.strptime(r_date, "%Y-%m-%d").date()
                for w in weeks_list:
                    ws = datetime.strptime(w["start"], "%Y-%m-%d").date()
                    we = datetime.strptime(w["end"], "%Y-%m-%d").date()
                    if ws <= dt <= we:
                        staff_weeks[assignee][w["label"]].add(r_date)

    summary = []
    for staff in sorted(all_staff):
        weeks_breakdown = {}
        for w in weeks_list:
            weeks_breakdown[w["label"]] = len(staff_weeks[staff][w["label"]])

        summary.append({
            "username": staff,
            "monthDays": len(month_days.get(staff, set())),
            "weekDays": len(week_days.get(staff, set())),
            "weeksBreakdown": weeks_breakdown
        })

    roaster_splitup_collection = db.get_collection("roaster_splitup")
    splitup_doc = await roaster_splitup_collection.find_one({
        "department": department,
        "cycleStart": cycle_start_str
    })
    splitups = {}
    if splitup_doc:
        splitups = splitup_doc.get("splitups", {})

    return {
        "cycleStart": cycle_start_str,
        "cycleEnd": cycle_end_str,
        "weekStart": week_start_str,
        "weekEnd": week_end_str,
        "trackedRole": config.get("trackedRole", "All Roles"),
        "maxAllowedDays": max_days,
        "weeks": weeks_list,
        "shifts": config.get("shifts", []),
        "rosterRows": config.get("rosterRows", []),
        "validationRules": config.get("validationRules", []),
        "summary": summary,
        "splitups": splitups
    }

@router.post("/duty-summary/splitup", response_description="Save roaster splitup overrides")
async def save_roaster_splitup(
    payload: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    is_superuser = current_user.get("isSuperuser", False)
    privileges = current_user.get("privileges", [])
    if not is_superuser and "Create Roaster" not in privileges and "Update Roaster" not in privileges:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    department = payload.get("department")
    cycleStart = payload.get("cycleStart")
    splitups = payload.get("splitups", {})

    if not department or not cycleStart:
        raise HTTPException(status_code=400, detail="Missing department or cycleStart")

    roaster_splitup_collection = db.get_collection("roaster_splitup")
    await roaster_splitup_collection.update_one(
        {"department": department, "cycleStart": cycleStart},
        {"$set": {
            "department": department,
            "cycleStart": cycleStart,
            "splitups": splitups,
            "updatedAt": datetime.now(timezone.utc).isoformat(),
            "updatedBy": current_user.get("sub")
        }},
        upsert=True
    )
    return {"status": "success"}


