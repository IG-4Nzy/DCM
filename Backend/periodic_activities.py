from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status, Depends, Query, Body
from auth_utils import get_current_user, require_privilege
from database import db
from bson import ObjectId
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any

router = APIRouter()
collection = db.get_collection("periodic_activities")

class PeriodicActivityModel(BaseModel):
    id: Optional[str] = Field(alias="_id", default=None)
    name: str
    dueDate: str  # YYYY-MM-DD format
    remarks: Optional[str] = ""
    department: Optional[str] = ""
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class PaginatedPeriodicActivitiesModel(BaseModel):
    data: List[PeriodicActivityModel]
    total: int

def serialize_doc(doc: dict) -> dict:
    doc["_id"] = str(doc["_id"])
    return doc

@router.post("", response_description="Create periodic activity", response_model=PeriodicActivityModel, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_privilege("Create Periodic Activity"))])
async def create_periodic_activity(
    payload: PeriodicActivityModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    doc = payload.model_dump(by_alias=True, exclude={"id"})
    doc["createdAt"] = now
    doc["updatedAt"] = now
    
    # Enforce department context
    if not current_user.get("isSuperuser", False):
        doc["department"] = current_user.get("department", "")
    elif not doc.get("department"):
        doc["department"] = current_user.get("department", "")

    result = await collection.insert_one(doc)
    created = await collection.find_one({"_id": result.inserted_id})
    return serialize_doc(created)

@router.get("", response_description="List periodic activities", response_model=PaginatedPeriodicActivitiesModel, dependencies=[Depends(require_privilege("View Periodic Activity"))])
async def list_periodic_activities(
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
    cursor = collection.find(query).sort("dueDate", 1).skip(skip).limit(limit)
    
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
