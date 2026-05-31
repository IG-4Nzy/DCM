from fastapi import APIRouter, HTTPException, status, Body, Query, Depends, Response
from auth_utils import require_privilege, get_current_user
from fastapi.responses import JSONResponse
from typing import Optional, List
from database import db
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
    status_doc = await roaster_status_collection.find_one({"weekStartDate": weekStartDate, "department": department})
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
        user_dept = user.get("department", "Unknown")
        role = user.get("role", "Unknown")
        name_str = f"{first_name} {last_name}".strip()
        if not name_str:
            name_str = user.get("username", "Unknown")
        name_str = f"{name_str} ({user_dept} - {role})"

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
        user_dept = user.get("department", "Unknown")
        role = user.get("role", "Unknown")
        name_str = f"{first_name} {last_name}".strip()
        if not name_str:
            name_str = user.get("username", "Unknown")
        name_str = f"{name_str} ({user_dept} - {role})"

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
    current_user: dict = Depends(get_current_user)
):
    is_superuser = current_user.get("isSuperuser", False)
    privileges = current_user.get("privileges", [])

    if not is_superuser and "View Roaster" not in privileges:
        raise HTTPException(status_code=403, detail="Not enough permissions to view roasters")

    query = {}
    if date:
        query["date"] = date
    elif startDate and endDate:
        query["date"] = {"$gte": startDate, "$lte": endDate}
    if shift:
        query["shift"] = shift
    if department:
        query["department"] = department

    actual_sort_by = sortBy or sort_by or "date"
    sort_order = 1 if order == "asc" else -1

    total = await roasters_collection.count_documents(query)
    cursor = roasters_collection.find(query).sort(actual_sort_by, sort_order).skip(skip).limit(limit)
    roasters = await cursor.to_list(length=limit)

    return {"data": roasters, "total": total}

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
    
    # Enforce no past weeks (allow past days within the current week)
    today = date.today()
    start_of_current_iso_week = today - timedelta(days=today.weekday())
    start_of_current_iso_week_str = start_of_current_iso_week.isoformat()
    if roaster_dict["date"] < start_of_current_iso_week_str:
        raise HTTPException(status_code=400, detail="Cannot create roster entry for past weeks")

    roaster_dict["createdBy"] = current_user.get("sub", "")
    roaster_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()

    # Get User Details
    users_collection = db.get_collection("users")
    user = await users_collection.find_one({"username": current_user.get("sub", "")})
    user_dept = "General"
    if user:
        user_dept = user.get("department", "General")
        first_name = user.get("firstName", "")
        last_name = user.get("lastName", "")
        role = user.get("role", "Unknown")
        name_str = f"{first_name} {last_name}".strip()
        if not name_str:
            name_str = user.get("username", "Unknown")
        roaster_dict["updatedByFullName"] = f"{name_str} ({user_dept} - {role})"

    roaster_dict["department"] = roaster.department or user_dept

    # Check for duplicate: same date + shift + department
    existing = await roasters_collection.find_one({
        "date": roaster_dict["date"],
        "shift": roaster_dict["shift"],
        "department": roaster_dict["department"]
    })
    if existing:
        raise HTTPException(status_code=400, detail=f"Roster for {roaster_dict['date']} - {roaster_dict['shift']} shift already exists for department {roaster_dict['department']}")

    new_roaster = await roasters_collection.insert_one(roaster_dict)
    created = await roasters_collection.find_one({"_id": new_roaster.inserted_id})
    return created

@router.put("/{id}", response_description="Update a roster entry", response_model=RoasterModel, response_model_by_alias=False, dependencies=[Depends(require_privilege("Update Roaster"))])
async def update_roaster(id: str, roaster: UpdateRoasterModel = Body(...), current_user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    roaster_dict = {k: v for k, v in roaster.model_dump().items() if v is not None}

    existing = await roasters_collection.find_one({"_id": ObjectId(id)})
    if not existing:
        raise HTTPException(status_code=404, detail=f"Roster {id} not found")

    # Enforce no past weeks (allow past days within the current week)
    today = date.today()
    start_of_current_iso_week = today - timedelta(days=today.weekday())
    start_of_current_iso_week_str = start_of_current_iso_week.isoformat()
    roster_date = roaster_dict.get("date") or existing.get("date")
    if roster_date and roster_date < start_of_current_iso_week_str:
        raise HTTPException(status_code=400, detail="Cannot edit roster entry for past weeks")

    if len(roaster_dict) >= 1:
        roaster_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()
        
        # Get User Details
        users_collection = db.get_collection("users")
        user = await users_collection.find_one({"username": current_user.get("sub", "")})
        if user:
            first_name = user.get("firstName", "")
            last_name = user.get("lastName", "")
            department = user.get("department", "Unknown")
            role = user.get("role", "Unknown")
            name_str = f"{first_name} {last_name}".strip()
            if not name_str:
                name_str = user.get("username", "Unknown")
            roaster_dict["updatedByFullName"] = f"{name_str} ({department} - {role})"

        update_result = await roasters_collection.update_one(
            {"_id": ObjectId(id)}, {"$set": roaster_dict}
        )

        if update_result.modified_count == 1:
            if (updated := await roasters_collection.find_one({"_id": ObjectId(id)})) is not None:
                return updated

    if (existing := await roasters_collection.find_one({"_id": ObjectId(id)})) is not None:
        return existing

    raise HTTPException(status_code=404, detail=f"Roster {id} not found")

@router.delete("/{id}", response_description="Delete a roster entry", dependencies=[Depends(require_privilege("Delete Roaster"))])
async def delete_roaster(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    existing = await roasters_collection.find_one({"_id": ObjectId(id)})
    if not existing:
        raise HTTPException(status_code=404, detail=f"Roster {id} not found")

    # Enforce no past weeks (allow past days within the current week)
    today = date.today()
    start_of_current_iso_week = today - timedelta(days=today.weekday())
    start_of_current_iso_week_str = start_of_current_iso_week.isoformat()
    if existing.get("date") and existing["date"] < start_of_current_iso_week_str:
        raise HTTPException(status_code=400, detail="Cannot delete roster entry for past weeks")

    delete_result = await roasters_collection.delete_one({"_id": ObjectId(id)})

    if delete_result.deleted_count == 1:
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    raise HTTPException(status_code=404, detail=f"Roster {id} not found")

@router.get("/duty-summary", response_description="Get duty day counts per staff for the configured monthly cycle and current week")
async def get_duty_summary(
    department: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    is_superuser = current_user.get("isSuperuser", False)
    privileges = current_user.get("privileges", [])
    if not is_superuser and "View Roaster" not in privileges:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    # Get attendance config for cycle start/end days
    config_collection = db.get_collection("attendance_config")
    config = await config_collection.find_one({}) or {}
    start_day = int(config.get("startDay", 1))
    end_day = int(config.get("endDay", 31))

    today = date.today()

    # Calculate cycle start and end dates for the current month
    try:
        cycle_start = date(today.year, today.month, start_day)
    except ValueError:
        # Handle months with fewer days (e.g. Feb 30 → clamp to last day)
        import calendar
        last_day = calendar.monthrange(today.year, today.month)[1]
        cycle_start = date(today.year, today.month, min(start_day, last_day))

    # If end_day < start_day, cycle spans into the next month
    if end_day >= start_day:
        try:
            cycle_end = date(today.year, today.month, end_day)
        except ValueError:
            import calendar
            last_day = calendar.monthrange(today.year, today.month)[1]
            cycle_end = date(today.year, today.month, min(end_day, last_day))
    else:
        next_month = today.month + 1 if today.month < 12 else 1
        next_year = today.year if today.month < 12 else today.year + 1
        try:
            cycle_end = date(next_year, next_month, end_day)
        except ValueError:
            import calendar
            last_day = calendar.monthrange(next_year, next_month)[1]
            cycle_end = date(next_year, next_month, min(end_day, last_day))

    cycle_start_str = cycle_start.isoformat()
    cycle_end_str = cycle_end.isoformat()

    # Calculate current week boundaries (ISO week: Mon-Sun)
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)
    week_start_str = week_start.isoformat()
    week_end_str = week_end.isoformat()

    # Fetch all rosters in the monthly cycle for this department (exclude Leave)
    month_query = {
        "date": {"$gte": cycle_start_str, "$lte": cycle_end_str},
        "department": department,
        "shift": {"$ne": "Leave"}
    }
    month_rosters = await roasters_collection.find(month_query).to_list(length=None)

    # Fetch all rosters in the current week for this department (exclude Leave)
    week_query = {
        "date": {"$gte": week_start_str, "$lte": week_end_str},
        "department": department,
        "shift": {"$ne": "Leave"}
    }
    week_rosters = await roasters_collection.find(week_query).to_list(length=None)

    # Count unique duty days per staff member
    month_days: dict = {}  # username -> set of dates
    week_days: dict = {}   # username -> set of dates

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

    # Merge all staff into a single result
    all_staff = set(list(month_days.keys()) + list(week_days.keys()))
    summary = []
    for staff in sorted(all_staff):
        summary.append({
            "username": staff,
            "monthDays": len(month_days.get(staff, set())),
            "weekDays": len(week_days.get(staff, set()))
        })

    return {
        "cycleStart": cycle_start_str,
        "cycleEnd": cycle_end_str,
        "weekStart": week_start_str,
        "weekEnd": week_end_str,
        "trackedRole": config.get("trackedRole", "All Roles"),
        "summary": summary
    }

