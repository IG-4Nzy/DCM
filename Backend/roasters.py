from fastapi import APIRouter, HTTPException, status, Body, Query, Depends, Response
from auth_utils import require_privilege, get_current_user
from fastapi.responses import JSONResponse
from typing import Optional, List
from database import db
from models import RoasterModel, CreateRoasterModel, UpdateRoasterModel, PaginatedRoastersModel, RoasterStatusModel, CreateRoasterStatusModel
from bson import ObjectId
from datetime import datetime, timezone

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
    roaster_dict["createdBy"] = current_user.get("sub", "")
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

    # Check for duplicate: same date + shift
    existing = await roasters_collection.find_one({"date": roaster_dict["date"], "shift": roaster_dict["shift"]})
    if existing:
        raise HTTPException(status_code=400, detail=f"Roster for {roaster_dict['date']} - {roaster_dict['shift']} shift already exists")

    new_roaster = await roasters_collection.insert_one(roaster_dict)
    created = await roasters_collection.find_one({"_id": new_roaster.inserted_id})
    return created

@router.put("/{id}", response_description="Update a roster entry", response_model=RoasterModel, response_model_by_alias=False, dependencies=[Depends(require_privilege("Update Roaster"))])
async def update_roaster(id: str, roaster: UpdateRoasterModel = Body(...), current_user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    roaster_dict = {k: v for k, v in roaster.model_dump().items() if v is not None}

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

    delete_result = await roasters_collection.delete_one({"_id": ObjectId(id)})

    if delete_result.deleted_count == 1:
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    raise HTTPException(status_code=404, detail=f"Roster {id} not found")
