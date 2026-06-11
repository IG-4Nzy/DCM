from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, status, Depends, Query, Body, Form, UploadFile, File
from auth_utils import get_current_user, require_privilege
from database import db
from bson import ObjectId
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
import uuid
import os
import shutil

router = APIRouter()
collection = db.get_collection("periodic_activities")

def add_interval(date_str: str, interval: int, unit: str) -> str:
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    if unit == "days":
        dt += timedelta(days=interval)
    elif unit == "weeks":
        dt += timedelta(weeks=interval)
    elif unit == "months":
        month = dt.month - 1 + interval
        year = dt.year + month // 12
        month = month % 12 + 1
        day = min(dt.day, [31,
            29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28,
            31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1])
        dt = dt.replace(year=year, month=month, day=day)
    elif unit == "years":
        year = dt.year + interval
        day = min(dt.day, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28) if dt.month == 2 and dt.day == 29 else dt.day
        dt = dt.replace(year=year, day=day)
    return dt.strftime("%Y-%m-%d")

class PeriodicActivityModel(BaseModel):
    id: Optional[str] = Field(alias="_id", default=None)
    name: str
    dueDate: str  # YYYY-MM-DD format
    remarks: Optional[str] = ""
    department: Optional[str] = None
    isAmc: Optional[bool] = False
    services: Optional[List[Dict[str, Any]]] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None
    repeatInterval: Optional[int] = None
    repeatUnit: Optional[str] = None
    repeatCount: Optional[int] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class PaginatedPeriodicActivitiesModel(BaseModel):
    data: List[PeriodicActivityModel]
    total: int

def serialize_doc(doc: dict) -> dict:
    doc["_id"] = str(doc["_id"])
    if doc.get("services") is None:
        doc["services"] = []
    return doc

@router.post("", response_description="Create periodic activity", response_model=PeriodicActivityModel, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_privilege("Create Periodic Activity"))])
async def create_periodic_activity(
    payload: PeriodicActivityModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    doc = payload.model_dump(by_alias=True, exclude={"id"})
    if doc.get("services") is None:
        doc["services"] = []
    doc["createdAt"] = now
    doc["updatedAt"] = now
    
    # Enforce department context
    if not current_user.get("isSuperuser", False):
        doc["department"] = current_user.get("department", "")
    elif not doc.get("department"):
        doc["department"] = current_user.get("department", "")

    repeat_interval = doc.pop("repeatInterval", None)
    repeat_unit = doc.pop("repeatUnit", None)
    repeat_count = doc.pop("repeatCount", None)

    if repeat_interval and repeat_unit and repeat_count and repeat_count > 1:
        docs_to_insert = []
        current_date = doc["dueDate"]
        for _ in range(repeat_count):
            new_doc = doc.copy()
            new_doc["dueDate"] = current_date
            new_doc["createdAt"] = now
            new_doc["updatedAt"] = now
            docs_to_insert.append(new_doc)
            try:
                current_date = add_interval(current_date, repeat_interval, repeat_unit)
            except Exception as e:
                # Fallback if parsing fails
                break
        
        result = await collection.insert_many(docs_to_insert)
        inserted_id = result.inserted_ids[0]
    else:
        result = await collection.insert_one(doc)
        inserted_id = result.inserted_id

    created = await collection.find_one({"_id": inserted_id})
    return serialize_doc(created)

@router.get("", response_description="List periodic activities", response_model=PaginatedPeriodicActivitiesModel, dependencies=[Depends(require_privilege("View Periodic Activity"))])
async def list_periodic_activities(
    pagination: bool = Query(True),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1),
    search: Optional[str] = None,
    department: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    query: Dict[str, Any] = {}
    if search:
        query["name"] = {"$regex": search, "$options": "i"}

    # Filter by department
    target_dept = department or current_user.get("department", "")
    if not current_user.get("isSuperuser", False) or target_dept:
        query["department"] = target_dept

    total = await collection.count_documents(query)
    cursor = collection.find(query).sort("dueDate", 1)
    if pagination:
        cursor = cursor.skip(skip).limit(limit)
        data = [serialize_doc(doc) async for doc in cursor]
    else:
        data = [serialize_doc(doc) async for doc in cursor]
    return {"data": data, "total": total}

@router.put("/{id}", response_description="Update periodic activity", response_model=PeriodicActivityModel, dependencies=[Depends(require_privilege("Update Periodic Activity"))])
async def update_periodic_activity(
    id: str,
    payload: PeriodicActivityModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    existing = await collection.find_one({"_id": ObjectId(id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Periodic activity not found")

    if not current_user.get("isSuperuser", False) and existing.get("department") != current_user.get("department", ""):
        raise HTTPException(status_code=403, detail="Forbidden: You cannot modify activities of other departments")

    update_data = payload.model_dump(by_alias=True, exclude={"id", "_id"}, exclude_none=True)
    update_data["updatedAt"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    await collection.update_one({"_id": ObjectId(id)}, {"$set": update_data})
    updated = await collection.find_one({"_id": ObjectId(id)})
    return serialize_doc(updated)

@router.delete("/{id}", response_description="Delete periodic activity", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_privilege("Delete Periodic Activity"))])
async def delete_periodic_activity(
    id: str,
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    existing = await collection.find_one({"_id": ObjectId(id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Periodic activity not found")

    if not current_user.get("isSuperuser", False) and existing.get("department") != current_user.get("department", ""):
        raise HTTPException(status_code=403, detail="Forbidden: You cannot delete activities of other departments")

    await collection.delete_one({"_id": ObjectId(id)})
    return

@router.post("/{id}/services", dependencies=[Depends(require_privilege("Update Periodic Activity"))])
async def add_service(
    id: str,
    date: str = Form(...),
    time: str = Form(...),
    remarks: str = Form(""),
    file: Optional[UploadFile] = File(default=None),
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    existing = await collection.find_one({"_id": ObjectId(id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Periodic activity not found")

    if not current_user.get("isSuperuser", False) and existing.get("department") != current_user.get("department", ""):
        raise HTTPException(status_code=403, detail="Forbidden: You cannot modify activities of other departments")

    # Save file if present
    report_name = None
    report_url = None
    if file:
        base_dir = "uploads/periodic_activities"
        os.makedirs(base_dir, exist_ok=True)
        file_ext = os.path.splitext(file.filename)[1]
        unique_name = f"{uuid.uuid4()}{file_ext}"
        file_path = os.path.join(base_dir, unique_name)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        report_name = file.filename
        report_url = f"/uploads/periodic_activities/{unique_name}"

    new_service = {
        "id": str(uuid.uuid4()),
        "date": date,
        "time": time,
        "remarks": remarks,
        "reportName": report_name,
        "reportUrl": report_url,
        "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    }

    await collection.update_one(
        {"_id": ObjectId(id)},
        {"$push": {"services": new_service}, "$set": {"updatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")}}
    )

    updated = await collection.find_one({"_id": ObjectId(id)})
    return serialize_doc(updated)

@router.post("/{id}/services/{service_id}/report", dependencies=[Depends(require_privilege("Update Periodic Activity"))])
async def upload_service_report(
    id: str,
    service_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    existing = await collection.find_one({"_id": ObjectId(id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Periodic activity not found")

    if not current_user.get("isSuperuser", False) and existing.get("department") != current_user.get("department", ""):
        raise HTTPException(status_code=403, detail="Forbidden: You cannot modify activities of other departments")

    # Check if service exists
    services = existing.get("services", [])
    service_index = -1
    for i, s in enumerate(services):
        if s.get("id") == service_id:
            service_index = i
            break

    if service_index == -1:
        raise HTTPException(status_code=404, detail="Service record not found")

    # Save file
    base_dir = "uploads/periodic_activities"
    os.makedirs(base_dir, exist_ok=True)
    file_ext = os.path.splitext(file.filename)[1]
    unique_name = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(base_dir, unique_name)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Delete old file if existed
    old_url = services[service_index].get("reportUrl")
    if old_url:
        old_path = old_url.lstrip("/")
        if os.path.exists(old_path):
            try:
                os.remove(old_path)
            except Exception as e:
                print(f"Failed to delete old report file: {e}")

    await collection.update_one(
        {"_id": ObjectId(id)},
        {
            "$set": {
                f"services.{service_index}.reportName": file.filename,
                f"services.{service_index}.reportUrl": f"/uploads/periodic_activities/{unique_name}",
                "updatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            }
        }
    )

    updated = await collection.find_one({"_id": ObjectId(id)})
    return serialize_doc(updated)

@router.delete("/{id}/services/{service_id}", dependencies=[Depends(require_privilege("Update Periodic Activity"))])
async def delete_service(
    id: str,
    service_id: str,
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    existing = await collection.find_one({"_id": ObjectId(id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Periodic activity not found")

    if not current_user.get("isSuperuser", False) and existing.get("department") != current_user.get("department", ""):
        raise HTTPException(status_code=403, detail="Forbidden: You cannot modify activities of other departments")

    services = existing.get("services", [])
    service_to_delete = None
    for s in services:
        if s.get("id") == service_id:
            service_to_delete = s
            break

    if not service_to_delete:
        raise HTTPException(status_code=404, detail="Service record not found")

    # Delete report file if existed
    report_url = service_to_delete.get("reportUrl")
    if report_url:
        file_path = report_url.lstrip("/")
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                print(f"Failed to delete report file: {e}")

    await collection.update_one(
        {"_id": ObjectId(id)},
        {
            "$pull": {"services": {"id": service_id}},
            "$set": {"updatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")}
        }
    )

    updated = await collection.find_one({"_id": ObjectId(id)})
    return serialize_doc(updated)
