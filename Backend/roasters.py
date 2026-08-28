from fastapi import APIRouter, HTTPException, status, Body, Query, Depends, Response
from auth_utils import require_privilege, get_current_user
from fastapi.responses import JSONResponse
from typing import Optional, List
from database import db, get_local_now
from models import RoasterModel, CreateRoasterModel, UpdateRoasterModel, PaginatedRoastersModel, RoasterStatusModel, CreateRoasterStatusModel, RoleRosterMappingModel, CreateRoleRosterMappingModel
from bson import ObjectId
from datetime import datetime, timezone, date, timedelta

router = APIRouter()
roasters_collection = db.get_collection("roasters")
roaster_status_collection = db.get_collection("roaster_status")
role_roster_mappings_collection = db.get_collection("role_roster_mappings")

async def get_mapped_department(current_user: dict) -> Optional[str]:
    is_superuser = current_user.get("isSuperuser", False)
    if is_superuser:
        return None
    
    role_ids = current_user.get("roleIds", [])
    if isinstance(role_ids, str):
        role_ids = [role_ids]
    if not role_ids:
        return None
        
    role_names = []
    roles_col = db.get_collection("roles")
    for rid in role_ids:
        if ObjectId.is_valid(rid):
            r_doc = await roles_col.find_one({"_id": ObjectId(rid)})
            if r_doc:
                role_names.append(r_doc.get("name"))
        else:
            role_names.append(rid)

    mapping = await role_roster_mappings_collection.find_one({
        "$or": [
            {"roleId": {"$in": role_ids}},
            {"roleName": {"$in": role_names}}
        ]
    })
    if mapping:
        return mapping.get("departmentName")
    return None

@router.get("/status", response_description="Get roster status", response_model=RoasterStatusModel, response_model_by_alias=False)
async def get_roaster_status(
    weekStartDate: str = Query(...),
    department: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    mapped_dept = await get_mapped_department(current_user)
    if mapped_dept:
        department = mapped_dept

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
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "emailSent": False
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
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "emailSent": False
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
    mapped_dept = await get_mapped_department(current_user)
    if mapped_dept:
        department = mapped_dept

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
    mapped_dept = await get_mapped_department(current_user)
    if mapped_dept:
        department = mapped_dept

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
        changed_roster = False
        new_assignees_list = []
        for raw_assignee in roster.get("assignees", []):
            if not raw_assignee:
                new_assignees_list.append("")
                continue
            parts = [p.strip() for p in raw_assignee.split(",") if p.strip()]
            valid_parts = []
            for username in parts:
                att = await attendance_col.find_one({
                    "username": username,
                    "date": roster_date
                })
                did_login = False
                if att and att.get("firstLogin"):
                    did_login = True
                    
                if did_login:
                    valid_parts.append(username)
                else:
                    changed_roster = True
                    leave_roster = await roasters_collection.find_one({
                        "date": roster_date,
                        "shift": "Leave",
                        "department": department
                    })
                    
                    if leave_roster:
                        leave_assignees = list(leave_roster.get("assignees", []))
                        flat_leaves = []
                        for la in leave_assignees:
                            if la:
                                flat_leaves.extend([p.strip() for p in la.split(",") if p.strip()])
                        if username not in flat_leaves:
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
            new_assignees_list.append(", ".join(valid_parts))
        
        if changed_roster:
            await roasters_collection.update_one(
                {"_id": roster["_id"]},
                {"$set": {
                    "assignees": new_assignees_list,
                    "updatedAt": datetime.now(timezone.utc).isoformat()
                }}
            )

@router.get("/duty-summary", response_description="Get duty day counts per staff for the configured monthly cycle and current week")
async def get_duty_summary(
    department: str = Query(...),
    date_str: Optional[str] = Query(None, alias="date"),
    current_user: dict = Depends(get_current_user)
):
    mapped_dept = await get_mapped_department(current_user)
    if mapped_dept:
        department = mapped_dept

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
        for raw_assignee in roster.get("assignees", []):
            if raw_assignee:
                parts = [p.strip() for p in raw_assignee.split(",") if p.strip()]
                for assignee in parts:
                    if assignee not in month_days:
                        month_days[assignee] = set()
                    month_days[assignee].add(roster["date"])

    for roster in week_rosters:
        for raw_assignee in roster.get("assignees", []):
            if raw_assignee:
                parts = [p.strip() for p in raw_assignee.split(",") if p.strip()]
                for assignee in parts:
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
        for raw_assignee in roster.get("assignees", []):
            if raw_assignee:
                parts = [p.strip() for p in raw_assignee.split(",") if p.strip()]
                for assignee in parts:
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

@router.get("/role-mappings", response_description="List role roster mappings", response_model=List[RoleRosterMappingModel], response_model_by_alias=False)
async def list_role_mappings(current_user: dict = Depends(get_current_user)):
    cursor = role_roster_mappings_collection.find()
    return await cursor.to_list(length=None)

@router.post("/role-mappings", response_description="Create or update role roster mapping", response_model=RoleRosterMappingModel, response_model_by_alias=False)
async def create_or_update_role_mapping(
    payload: CreateRoleRosterMappingModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    mapping_dict = payload.model_dump()
    await role_roster_mappings_collection.update_one(
        {"roleId": payload.roleId},
        {"$set": mapping_dict},
        upsert=True
    )
    created = await role_roster_mappings_collection.find_one({"roleId": payload.roleId})
    return created

@router.delete("/role-mappings/{id}", response_description="Delete role roster mapping")
async def delete_role_mapping(id: str, current_user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")
    result = await role_roster_mappings_collection.delete_one({"_id": ObjectId(id)})
    if result.deleted_count == 1:
        return {"status": "deleted"}
    raise HTTPException(status_code=404, detail="Mapping not found")


def format_time(t_str):
    if not t_str:
        return ""
    try:
        dt = datetime.strptime(t_str, "%H:%M")
        return dt.strftime("%I:%M %p")
    except Exception:
        return t_str

async def generate_roster_pdf_bytes(department: str, week_start_date: str, rosters: list, user_names: dict):
    config_collection = db.get_collection("attendance_config")
    config = await config_collection.find_one({}) or {}
    config_shifts = config.get("shifts", [])
    config_roster_rows = config.get("rosterRows", [])
    
    from datetime import datetime, timedelta
    start_dt = datetime.strptime(week_start_date, "%Y-%m-%d")
    week_dates = [(start_dt + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]
    
    start_formatted = start_dt.strftime("%d-%m-%Y")
    end_formatted = (start_dt + timedelta(days=6)).strftime("%d-%m-%Y")
    year_str = start_dt.strftime("%Y")
    
    roster_map = {}
    for r in rosters:
        roster_map[(r["date"], r["shift"])] = r.get("assignees", [])
        
    shifts = ["Shift-1", "Shift-2", "Shift-3"]
    
    headers_html = ""
    for shift_name in shifts:
        cfg_shift = next((s for s in config_shifts if s.get("name") == shift_name), None)
        header_label = shift_name
        if shift_name == "Shift-1":
            header_label = "Shift-1 (06-30 AM to 2:30 PM)"
        elif shift_name == "Shift-2":
            header_label = "Shift - 2 (02:30 PM to 10:30 PM)"
        elif shift_name == "Shift-3":
            header_label = "Shift - 3 (10:30 PM to 06:30 AM)"
        elif cfg_shift:
            s_time = format_time(cfg_shift.get("startTime"))
            e_time = format_time(cfg_shift.get("endTime"))
            header_label = f"{shift_name} ({s_time} to {e_time})"
            
        headers_html += f"<th>{header_label}</th>"
        
    table_rows_html = ""
    for idx, d_str in enumerate(week_dates):
        d_val = datetime.strptime(d_str, "%Y-%m-%d")
        day_formatted = d_val.strftime("%d/%m/%y")
        day_name = d_val.strftime("%A")
        
        bg_color = "#ffffff" if idx % 2 == 0 else "#f5f5f5"
        
        row_html = f"<tr style='background-color: {bg_color};'>"
        row_html += f"<td class='day-cell'>{day_formatted}<span class='day-name'>{day_name}</span></td>"
        
        for shift_name in shifts:
            assignees = roster_map.get((d_str, shift_name), [])
            shift_rows = [r for r in config_roster_rows if r.get("mappedShift") == shift_name]
            num_slots = len(shift_rows) if shift_rows else 2
            
            slots_html = ""
            for i in range(num_slots):
                username = assignees[i] if i < len(assignees) else None
                if username:
                    parts = [p.strip() for p in username.split(",") if p.strip()]
                    display_name = ", ".join([user_names.get(u, u) for u in parts])
                else:
                    display_name = "-"
                slots_html += f"<div class='slot-label'>{display_name}</div>"
                
            row_html += f"<td><div class='slots-container'>{slots_html}</div></td>"
            
        row_html += "</tr>"
        table_rows_html += row_html
        
    html_content = f"""<!DOCTYPE html>
    <html>
    <head>
    <meta charset="utf-8">
    <style>
      @page {{
        size: A4 portrait;
        margin: 15mm;
      }}
      body {{
        font-family: 'Segoe UI', Arial, sans-serif;
        color: #333;
        line-height: 1.4;
        margin: 0;
        padding: 0;
      }}
      .roaster-container {{
        width: 100%;
        margin: 0 auto;
      }}
      .header {{
        text-align: center;
        margin-bottom: 20px;
      }}
      .header .label {{
        display: block;
        font-size: 13px;
        font-weight: bold;
        color: #444;
        margin-bottom: 3px;
      }}
      .header .label:nth-child(2) {{
        font-size: 15px;
        color: #111;
        margin-bottom: 5px;
      }}
      .header .label:nth-child(3) {{
        font-size: 14px;
        color: #222;
      }}
      .header .label:nth-child(4) {{
        font-size: 11px;
        font-weight: normal;
        color: #666;
        margin-top: 5px;
      }}
      
      table {{
        width: 100%;
        border-collapse: collapse;
        margin-top: 15px;
        border: 1px solid #000;
      }}
      
      th, td {{
        border: 1px solid #000;
        padding: 6px;
        text-align: center;
        vertical-align: middle;
      }}
      
      th {{
        font-size: 13px;
        font-weight: bold;
        background-color: #f3f4f6;
      }}
      
      .day-cell {{
        font-size: 13px;
        font-weight: bold;
        background-color: #fafafa;
        width: 100px;
        min-width: 100px;
      }}
      
      .day-name {{
        font-size: 11px;
        font-weight: normal;
        color: #555;
        display: block;
        margin-top: 2px;
      }}
      
      .slots-container {{
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 48px;
        justify-content: center;
      }}
      
      .slot-label {{
        display: block;
        padding: 4px 0;
        font-size: 13px;
        font-weight: 500;
        border-bottom: 1px solid #eee;
      }}
      .slot-label:last-child {{
        border-bottom: none;
      }}
      
      .footer {{
        margin-top: 30px;
      }}
      .kindly-label {{
        display: block;
        font-size: 12px;
        font-style: italic;
        text-align: center;
        margin-bottom: 25px;
      }}
      .footer-section1 {{
        display: flex;
        justify-content: space-between;
        font-size: 13px;
        font-weight: bold;
        margin-bottom: 50px;
      }}
      .footer-section2 {{
        display: flex;
        justify-content: space-between;
        font-size: 12px;
      }}
      .footer-section2-left {{
        display: flex;
        flex-direction: column;
        gap: 3px;
      }}
      .footer-section2-right {{
        display: flex;
        flex-direction: column;
        gap: 3px;
        text-align: right;
        font-weight: bold;
      }}
    </style>
    </head>
    <body>
    <div class="roaster-container">
        <div class="header">
            <span class="label">VSSC/DCS/{year_str}</span>
            <span class="label">SCHEDULE FOR ROUND THE CLOCK MANNING OF DATA CENTRE FACILITY</span>
            <span class="label">CITG VSSC From {start_formatted} to {end_formatted}</span>
            <span class="label">The contract staff identified by respective contractors for operations in DCS FACILITY for shift duty and holidays are as follows.</span>
        </div>
        
        <table>
            <thead>
                <tr>
                    <th>Day</th>
                    {headers_html}
                </tr>
            </thead>
            <tbody>
                {table_rows_html}
            </tbody>
        </table>
        
        <div class="footer">
            <span class="kindly-label">* Kindly permit the persons on shift 3 from 08:00 PM and shift 2 from 09:00 am onwards.</span>
            <div class="footer-section1">
                <span>MANAGER DCS</span>
                <span>Approved By</span>
            </div>
            <div class="footer-section2">
                <div class="footer-section2-left">
                    <span>CC:Asst.Commandant</span>
                    <span>CC:Head,TOMD</span>
                    <span>CC:Duty Officer</span>
                    <span>CC:File</span>
                </div>
                <div class="footer-section2-right">
                    <span>SUJITH S</span>
                    <span>GD,CITG</span>
                </div>
            </div>
        </div>
    </div>
    </body>
    </html>
    """
    
    import subprocess
    import tempfile
    import os
    
    with tempfile.NamedTemporaryFile(suffix=".html", delete=False) as html_file:
        html_file.write(html_content.encode("utf-8"))
        html_path = html_file.name
        
    pdf_path = html_path.replace(".html", ".pdf")
    
    try:
        cmd = [
            "google-chrome",
            "--headless=new",
            "--disable-gpu",
            "--no-sandbox",
            "--no-pdf-header-footer",
            f"--print-to-pdf={pdf_path}",
            html_path
        ]
        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True, timeout=15)
        
        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()
        return pdf_bytes
    finally:
        if os.path.exists(html_path):
            os.remove(html_path)
        if os.path.exists(pdf_path):
            os.remove(pdf_path)


@router.post("/send-email", response_description="Send duty roster via email")
async def send_roster_email(
    payload: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    # Check if roster email is enabled in mail config
    config_col = db.get_collection("mail_config")
    config = await config_col.find_one({"_id": "mail_config"})
    if config and not config.get("rosterMailEnabled", True):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sending roster emails is currently disabled in Mail Configuration."
        )

    emails_str = payload.get("emails", "")
    department = payload.get("department", "General")
    week_start_date = payload.get("weekStartDate")
    
    if not emails_str:
        raise HTTPException(status_code=400, detail="Emails list is required")
    if not week_start_date:
        raise HTTPException(status_code=400, detail="Week start date is required")
        
    emails = [e.strip() for e in emails_str.split(",") if e.strip()]
    if not emails:
        raise HTTPException(status_code=400, detail="No valid email addresses provided")
        
    from datetime import datetime, timedelta
    
    try:
        start_dt = datetime.strptime(week_start_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid weekStartDate format. Use YYYY-MM-DD")
        
    week_dates = [(start_dt + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]
    
    dept_doc = await db.get_collection("departments").find_one({
        "$or": [
            {"name": department},
            {"_id": ObjectId(department) if ObjectId.is_valid(department) else None}
        ]
    })
    dept_match = [department]
    if dept_doc:
        dept_match = list(set([d for d in [department, str(dept_doc["_id"]), dept_doc.get("name", "")] if d]))

    dept_name = dept_doc.get("name", department) if dept_doc else department

    status_doc = await roaster_status_collection.find_one({"weekStartDate": week_start_date, "department": {"$in": dept_match}})
    if not status_doc or status_doc.get("status") != "Approved":
        raise HTTPException(status_code=400, detail="Roster must be approved before sending email.")
    if status_doc.get("emailSent") is True:
        raise HTTPException(status_code=400, detail="Roster email has already been sent for this approval.")

    rosters = await roasters_collection.find({
        "date": {"$in": week_dates},
        "department": {"$in": dept_match}
    }).to_list(length=None)
    
    shifts = ["Shift-1", "Shift-2", "Shift-3", "Leave"]
    
    roster_map = {}
    notes_map = {}
    for r in rosters:
        roster_map[(r["date"], r["shift"])] = r.get("assignees", [])
        if r.get("notes"):
            notes_map[(r["date"], r["shift"])] = r["notes"]
            
    all_usernames = set()
    for r in rosters:
        for u in r.get("assignees", []):
            if u:
                all_usernames.update([p.strip() for p in u.split(",") if p.strip()])
    
    users_col = db.get_collection("users")
    user_docs = await users_col.find({"username": {"$in": list(all_usernames)}}).to_list(length=None)
    user_names = {u["username"]: f"{u.get('firstName', '')} {u.get('lastName', '')}".strip() or u["username"] for u in user_docs}
    
    headers_html = "".join([f"<th style='border: 1px solid #cbd5e1; padding: 10px; background-color: #f1f5f9; text-align: center;'>{datetime.strptime(d, '%Y-%m-%d').strftime('%a, %d %b')}</th>" for d in week_dates])
    rows_html = ""
    for shift in ["Shift-1", "Shift-2", "Shift-3"]:
        shift_label = shift
        if shift == "Shift-1":
            shift_label = "Shift-1 (06:30 AM to 02:30 PM)"
        elif shift == "Shift-2":
            shift_label = "Shift-2 (02:30 PM to 10:30 PM)"
        elif shift == "Shift-3":
            shift_label = "Shift-3 (10:30 PM to 06:30 AM)"

        rows_html += f"<tr><td style='border: 1px solid #cbd5e1; padding: 10px; font-weight: bold; background-color: #f8fafc; text-align: left; white-space: nowrap;'>{shift_label}</td>"
        for d in week_dates:
            assignees = roster_map.get((d, shift), [])
            names = []
            for u in assignees:
                if u:
                    parts = [p.strip() for p in u.split(",") if p.strip()]
                    names.extend([user_names.get(part, part) for part in parts])
            names_str = ", ".join(names) if names else "<span style='color: #94a3b8; font-style: italic;'>Unassigned</span>"
            notes = notes_map.get((d, shift))
            notes_html = f"<div style='font-size: 11px; color: #64748b; margin-top: 4px; font-style: italic;'>Note: {notes}</div>" if notes else ""
            rows_html += f"<td style='border: 1px solid #cbd5e1; padding: 10px; text-align: center; vertical-align: top;'>{names_str}{notes_html}</td>"
        rows_html += "</tr>"
        
    html_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.6;">
        <h2 style="color: #0f172a; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">Duty Roster Summary</h2>
        <p><strong>Department:</strong> {dept_name}</p>
        <p><strong>Week:</strong> {week_dates[0]} to {week_dates[-1]}</p>
        
        <p>Please find attached the printable PDF version of the duty roster.</p>

        <table style="border-collapse: collapse; width: 100%; font-size: 14px; margin-top: 15px; border: 1px solid #cbd5e1;">
            <thead>
                <tr>
                    <th style="border: 1px solid #cbd5e1; padding: 10px; background-color: #f1f5f9; text-align: left;">Shift</th>
                    {headers_html}
                </tr>
            </thead>
            <tbody>
                {rows_html}
            </tbody>
        </table>
        
        <p style="margin-top: 25px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 8px;">
            This is an automated notification from the Datacentre Management System (DCM).
        </p>
    </body>
    </html>
    """
    
    plain_body = f"Duty Roster - {dept_name}\nWeek: {week_dates[0]} to {week_dates[-1]}\n\nPlease find attached the printable PDF version of the duty roster."
    
    attachments = None
    try:
        pdf_base64 = payload.get("pdf_base64") or payload.get("pdfBase64")
        if pdf_base64:
            import base64
            if "," in pdf_base64:
                pdf_base64 = pdf_base64.split(",")[1]
            pdf_bytes = base64.b64decode(pdf_base64)
        else:
            pdf_bytes = await generate_roster_pdf_bytes(dept_name, week_start_date, rosters, user_names)

        dept_clean = "".join([c if c.isalnum() else "_" for c in dept_name])
        pdf_filename = f"Duty_Roster_{dept_clean}_{week_start_date}.pdf"
        attachments = [{
            "filename": pdf_filename,
            "content": pdf_bytes,
            "content_type": "application/pdf"
        }]
    except Exception as pdf_err:
        print("ERROR GENERATING ROSTER PDF:", pdf_err)

    from mail_utils import send_email
    try:
        await send_email(
            to_emails=emails,
            subject=f"Duty Roster - {dept_name} - Week {week_dates[0]} - {week_dates[-1]}",
            body=plain_body,
            html_body=html_body,
            attachments=attachments
        )
        await roaster_status_collection.update_many(
            {"weekStartDate": week_start_date, "department": {"$in": dept_match}},
            {"$set": {"emailSent": True}}
        )
        await db.get_collection("last_sent_emails").update_one(
            {"_id": department},
            {"$set": {"emails": emails_str}},
            upsert=True
        )
        return {"success": True, "message": f"Roster email successfully sent to {', '.join(emails)}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")



