from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status, Depends, Query, Body
from auth_utils import get_current_user, require_privilege
from database import db
from bson import ObjectId
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any

router = APIRouter()
collection = db.get_collection("announcements")

class AnnouncementModel(BaseModel):
    id: Optional[str] = Field(alias="_id", default=None)
    title: str
    description: str
    date: Optional[str] = None  # Optional YYYY-MM-DD
    mentionType: str  # "all", "department", "staff"
    mentionedDepartment: Optional[str] = ""
    mentionedStaff: Optional[str] = ""
    createdBy: Optional[str] = ""
    department: Optional[str] = ""
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class PaginatedAnnouncementsModel(BaseModel):
    data: List[AnnouncementModel]
    total: int

def serialize_doc(doc: dict) -> dict:
    doc["_id"] = str(doc["_id"])
    return doc

@router.post("", response_description="Create announcement", response_model=AnnouncementModel, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_privilege("Create Announcement"))])
async def create_announcement(
    payload: AnnouncementModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    doc = payload.model_dump(by_alias=True, exclude={"id"})
    doc["createdAt"] = now
    doc["updatedAt"] = now
    doc["createdBy"] = current_user.get("sub") or current_user.get("username", "")
    
    # Enforce department context
    if not current_user.get("isSuperuser", False):
        doc["department"] = current_user.get("department", "")
    elif not doc.get("department"):
        doc["department"] = current_user.get("department", "")

    result = await collection.insert_one(doc)
    created = await collection.find_one({"_id": result.inserted_id})
    return serialize_doc(created)

@router.get("", response_description="List announcements", response_model=PaginatedAnnouncementsModel, dependencies=[Depends(require_privilege("View Announcements"))])
async def list_announcements(
    pagination: bool = Query(True),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1),
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query: Dict[str, Any] = {}
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]

    # Non-superusers can only manage/see announcements created by their department
    if not current_user.get("isSuperuser", False):
        query["department"] = current_user.get("department", "")

    total = await collection.count_documents(query)
    cursor = collection.find(query).sort("createdAt", -1)
    if pagination:
        cursor = cursor.skip(skip).limit(limit)
    
    data = [serialize_doc(doc) async for doc in cursor]
    return {"data": data, "total": total}

@router.put("/{id}", response_description="Update announcement", response_model=AnnouncementModel, dependencies=[Depends(require_privilege("Update Announcement"))])
async def update_announcement(
    id: str,
    payload: AnnouncementModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    existing = await collection.find_one({"_id": ObjectId(id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Announcement not found")

    if not current_user.get("isSuperuser", False) and existing.get("department") != current_user.get("department", ""):
        raise HTTPException(status_code=403, detail="Forbidden: You cannot modify announcements of other departments")

    update_data = payload.model_dump(by_alias=True, exclude={"id", "_id"}, exclude_none=True)
    update_data["updatedAt"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    await collection.update_one({"_id": ObjectId(id)}, {"$set": update_data})
    updated = await collection.find_one({"_id": ObjectId(id)})
    return serialize_doc(updated)

@router.delete("/{id}", response_description="Delete announcement", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_privilege("Delete Announcement"))])
async def delete_announcement(
    id: str,
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    existing = await collection.find_one({"_id": ObjectId(id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Announcement not found")

    if not current_user.get("isSuperuser", False) and existing.get("department") != current_user.get("department", ""):
        raise HTTPException(status_code=403, detail="Forbidden: You cannot delete announcements of other departments")

    await collection.delete_one({"_id": ObjectId(id)})
    return
