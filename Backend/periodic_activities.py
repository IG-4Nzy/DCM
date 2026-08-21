from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, status, Depends, Query, Body, Form, UploadFile, File
from auth_utils import get_current_user, require_privilege
from database import db
from bson import ObjectId
from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional, List, Dict, Any
import uuid
import os
import shutil
import re

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
    departmentName: Optional[str] = None
    isAmc: Optional[bool] = False
    services: Optional[List[Dict[str, Any]]] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None
    repeatInterval: Optional[int] = None
    repeatUnit: Optional[str] = None
    repeatCount: Optional[int] = None
    firstServiceDate: Optional[str] = None
    serviceRepeatMonths: Optional[int] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class CreatePeriodicActivityModel(PeriodicActivityModel):
    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        if v:
            v_trimmed = v.strip()
            if not v_trimmed:
                raise ValueError("Activity name cannot be empty")
            if not re.match(r"^[a-zA-Z0-9\s._,-]+$", v_trimmed):
                raise ValueError("Activity name must contain alphanumeric characters, spaces, dots, commas, underscores, or hyphens only")
            if len(v_trimmed) > 50:
                raise ValueError("Activity name must be maximum 50 characters")
            return v_trimmed
        return v

    @field_validator('remarks')
    @classmethod
    def validate_remarks(cls, v):
        if v is not None:
            if len(v) > 220:
                raise ValueError("Remarks must be maximum 220 characters")
        return v

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
    payload: CreatePeriodicActivityModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    doc = payload.model_dump(by_alias=True, exclude={"id"})
    if doc.get("services") is None:
        doc["services"] = []

    # Generate AMC services if applicable
    if doc.get("isAmc") and doc.get("firstServiceDate") and doc.get("serviceRepeatMonths"):
        services_list = []
        first_date_str = doc.get("firstServiceDate")
        repeat_months = doc.get("serviceRepeatMonths")
        expiry_date_str = doc.get("dueDate")
        
        try:
            expiry_dt = datetime.strptime(expiry_date_str, "%Y-%m-%d")
            curr_dt = datetime.strptime(first_date_str, "%Y-%m-%d")
            
            while curr_dt <= expiry_dt:
                services_list.append({
                    "id": str(uuid.uuid4()),
                    "dueDate": curr_dt.strftime("%Y-%m-%d"),
                    "status": "pending",
                    "completedDate": None,
                    "completedTime": None,
                    "remarks": "",
                    "reportName": None,
                    "reportUrl": None
                })
                
                # Advance by repeat_months
                month = curr_dt.month - 1 + repeat_months
                year = curr_dt.year + month // 12
                month = month % 12 + 1
                day = min(curr_dt.day, [31,
                    29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28,
                    31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1])
                curr_dt = curr_dt.replace(year=year, month=month, day=day)
            doc["services"] = services_list
        except Exception as e:
            print(f"Error generating AMC services: {e}")

    # Enforce department context
    if not current_user.get("isSuperuser", False):
        doc["department"] = current_user.get("department", "")
    elif not doc.get("department"):
        doc["department"] = current_user.get("department", "")

    # For non-AMC repeating activities:
    if not doc.get("isAmc") and doc.get("repeatInterval") and doc.get("repeatUnit"):
        doc["services"] = [{
            "id": str(uuid.uuid4()),
            "dueDate": doc["dueDate"],
            "status": "pending",
            "completedDate": None,
            "completedTime": None,
            "remarks": "",
            "reportName": None,
            "reportUrl": None
        }]

    doc["createdAt"] = now
    doc["updatedAt"] = now

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
        
    depts = await db.get_collection("departments").find({}).to_list(length=None)
    dept_map = {str(d["_id"]): d["name"] for d in depts}

    data = []
    async for doc in cursor:
        d_id = doc.get("department")
        dept_name = dept_map.get(d_id, d_id) if d_id else None
        serialized = serialize_doc(doc)
        serialized["departmentName"] = dept_name
        data.append(serialized)
        
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

    # Handle service list regeneration/update if settings changed
    is_amc = payload.isAmc if payload.isAmc is not None else existing.get("isAmc", False)
    
    if is_amc:
        first_service_date = payload.firstServiceDate or existing.get("firstServiceDate")
        service_repeat_months = payload.serviceRepeatMonths or existing.get("serviceRepeatMonths")
        due_date = payload.dueDate or existing.get("dueDate")
        
        amc_changed = (
            is_amc != existing.get("isAmc") or
            first_service_date != existing.get("firstServiceDate") or
            service_repeat_months != existing.get("serviceRepeatMonths") or
            due_date != existing.get("dueDate")
        )
        
        if amc_changed and first_service_date and service_repeat_months and due_date:
            try:
                expiry_dt = datetime.strptime(due_date, "%Y-%m-%d")
                curr_dt = datetime.strptime(first_service_date, "%Y-%m-%d")
                target_dates = []
                while curr_dt <= expiry_dt:
                    target_dates.append(curr_dt.strftime("%Y-%m-%d"))
                    
                    # Advance by service_repeat_months
                    month = curr_dt.month - 1 + service_repeat_months
                    year = curr_dt.year + month // 12
                    month = month % 12 + 1
                    day = min(curr_dt.day, [31,
                        29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28,
                        31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1])
                    curr_dt = curr_dt.replace(year=year, month=month, day=day)
                
                existing_services = existing.get("services", [])
                completed_services = [s for s in existing_services if s.get("status") == "completed"]
                completed_services_sorted = sorted(
                    completed_services,
                    key=lambda x: x.get("dueDate") or x.get("completedDate") or ""
                )
                
                new_services = []
                n_completed = len(completed_services_sorted)
                for i, target_date in enumerate(target_dates):
                    if i < n_completed:
                        service = completed_services_sorted[i]
                        service["dueDate"] = target_date
                        new_services.append(service)
                    else:
                        new_services.append({
                            "id": str(uuid.uuid4()),
                            "dueDate": target_date,
                            "status": "pending",
                            "completedDate": None,
                            "completedTime": None,
                            "remarks": "",
                            "reportName": None,
                            "reportUrl": None
                        })
                if n_completed > len(target_dates):
                    for i in range(len(target_dates), n_completed):
                        new_services.append(completed_services_sorted[i])
                
                update_data["services"] = new_services
            except Exception as e:
                print(f"Error regenerating AMC services: {e}")
        
        # Clear repeating parameters in database
        update_data["repeatInterval"] = None
        update_data["repeatUnit"] = None
        update_data["repeatCount"] = None
    else:
        repeat_interval = payload.repeatInterval or existing.get("repeatInterval")
        repeat_unit = payload.repeatUnit or existing.get("repeatUnit")
        repeat_count = payload.repeatCount if payload.repeatCount is not None else existing.get("repeatCount")
        due_date = payload.dueDate or existing.get("dueDate")
        
        repeat_changed = (
            is_amc != existing.get("isAmc") or
            repeat_interval != existing.get("repeatInterval") or
            repeat_unit != existing.get("repeatUnit") or
            repeat_count != existing.get("repeatCount") or
            due_date != existing.get("dueDate")
        )
        
        if repeat_changed and repeat_interval and repeat_unit:
            existing_services = existing.get("services", [])
            completed_services = [s for s in existing_services if s.get("status") == "completed"]
            pending_services = [s for s in existing_services if s.get("status") != "completed"]
            
            if pending_services:
                pending_service = pending_services[0]
                pending_service["dueDate"] = due_date
                update_data["services"] = completed_services + [pending_service]
            else:
                completed_count = len(completed_services)
                should_create = False
                if repeat_count is None or repeat_count == -1:
                    should_create = True
                elif completed_count < repeat_count:
                    should_create = True
                    
                if should_create:
                    new_pending = {
                        "id": str(uuid.uuid4()),
                        "dueDate": due_date,
                        "status": "pending",
                        "completedDate": None,
                        "completedTime": None,
                        "remarks": "",
                        "reportName": None,
                        "reportUrl": None
                    }
                    update_data["services"] = completed_services + [new_pending]
                else:
                    update_data["services"] = completed_services
        
        # Clear AMC parameters in database
        update_data["firstServiceDate"] = None
        update_data["serviceRepeatMonths"] = None

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

@router.put("/{id}/services/{service_id}/complete", dependencies=[Depends(require_privilege("Update Periodic Activity"))])
async def complete_service(
    id: str,
    service_id: str,
    completedDate: str = Form(...),
    completedTime: str = Form(...),
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

    services = existing.get("services", [])
    service_index = -1
    for i, s in enumerate(services):
        if s.get("id") == service_id:
            service_index = i
            break

    if service_index == -1:
        raise HTTPException(status_code=404, detail="Service record not found")

    # Save file if provided
    report_name = services[service_index].get("reportName")
    report_url = services[service_index].get("reportUrl")
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

    await collection.update_one(
        {"_id": ObjectId(id)},
        {
            "$set": {
                f"services.{service_index}.status": "completed",
                f"services.{service_index}.completedDate": completedDate,
                f"services.{service_index}.completedTime": completedTime,
                f"services.{service_index}.remarks": remarks,
                f"services.{service_index}.reportName": report_name,
                f"services.{service_index}.reportUrl": report_url,
                f"services.{service_index}.completedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                "updatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            }
        }
    )

    # Load the updated document to see if we should create a new repeating occurrence
    updated_doc = await collection.find_one({"_id": ObjectId(id)})
    if updated_doc:
        repeat_interval = updated_doc.get("repeatInterval")
        repeat_unit = updated_doc.get("repeatUnit")
        repeat_count = updated_doc.get("repeatCount")
        
        if repeat_interval and repeat_unit:
            services = updated_doc.get("services", [])
            completed_count = sum(1 for s in services if s.get("status") == "completed")
            
            should_create_next = False
            if repeat_count is None or repeat_count == -1:
                should_create_next = True
            elif completed_count < repeat_count:
                should_create_next = True
                
            if should_create_next:
                completed_service = services[service_index]
                completed_due_date = completed_service.get("dueDate")
                if not completed_due_date:
                    completed_due_date = completed_service.get("date")
                    
                try:
                    next_due_date = add_interval(completed_due_date, repeat_interval, repeat_unit)
                    
                    next_service = {
                        "id": str(uuid.uuid4()),
                        "dueDate": next_due_date,
                        "status": "pending",
                        "completedDate": None,
                        "completedTime": None,
                        "remarks": "",
                        "reportName": None,
                        "reportUrl": None
                    }
                    
                    await collection.update_one(
                        {"_id": ObjectId(id)},
                        {
                            "$push": {"services": next_service},
                            "$set": {
                                "dueDate": next_due_date,
                                "updatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
                            }
                        }
                    )
                except Exception as e:
                    print(f"Error generating next repeating service: {e}")

    updated = await collection.find_one({"_id": ObjectId(id)})
    return serialize_doc(updated)
