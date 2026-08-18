from fastapi import APIRouter, Body, HTTPException, status, Depends
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict, field_validator
from bson import ObjectId
from datetime import datetime, timezone
import re

from database import db
from auth_utils import get_current_user, require_privilege

router = APIRouter()

# ----------------------------------------------------------------------
# Pydantic Schemas
# ----------------------------------------------------------------------
class PhoneDirectoryModel(BaseModel):
    name: str = Field(..., min_length=1)
    contact_number: str = Field(..., min_length=1)
    remarks: Optional[str] = ""
    createdBy: Optional[str] = ""
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        if v:
            v_trimmed = v.strip()
            if not v_trimmed:
                raise ValueError("Name cannot be empty")
            if not re.match(r"^[a-zA-Z0-9\s,.-]+$", v_trimmed):
                raise ValueError("Name must contain alphanumeric characters, spaces, commas, periods, or dashes only")
            if len(v_trimmed) > 100:
                raise ValueError("Name must be maximum 100 characters")
            return v_trimmed
        return v

    @field_validator('contact_number')
    @classmethod
    def validate_contact_number(cls, v):
        if v:
            v_trimmed = v.strip()
            if not v_trimmed:
                raise ValueError("Contact number cannot be empty")
            if not re.match(r"^[a-zA-Z0-9\s+-]+$", v_trimmed):
                raise ValueError("Contact number must contain letters, numbers, spaces, hyphens, and plus signs only")
            if len(v_trimmed) > 15:
                raise ValueError("Contact number must be maximum 15 characters")
            return v_trimmed
        return v

    @field_validator('remarks')
    @classmethod
    def validate_remarks(cls, v):
        if v is not None:
            v_trimmed = v.strip()
            if v_trimmed and not re.match(r"^[a-zA-Z0-9\s,.-]+$", v_trimmed):
                raise ValueError("Remarks must contain alphanumeric characters, spaces, commas, periods, or dashes only")
            if len(v_trimmed) > 125:
                raise ValueError("Remarks must be maximum 125 characters")
            return v_trimmed
        return v

class UpdatePhoneDirectoryModel(BaseModel):
    name: Optional[str] = None
    contact_number: Optional[str] = None
    remarks: Optional[str] = None

    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        populate_by_name=True,
    )

    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        if v is not None:
            v_trimmed = v.strip()
            if not v_trimmed:
                raise ValueError("Name cannot be empty")
            if not re.match(r"^[a-zA-Z0-9\s,.-]+$", v_trimmed):
                raise ValueError("Name must contain alphanumeric characters, spaces, commas, periods, or dashes only")
            if len(v_trimmed) > 100:
                raise ValueError("Name must be maximum 100 characters")
            return v_trimmed
        return v

    @field_validator('contact_number')
    @classmethod
    def validate_contact_number(cls, v):
        if v is not None:
            v_trimmed = v.strip()
            if not v_trimmed:
                raise ValueError("Contact number cannot be empty")
            if not re.match(r"^[a-zA-Z0-9\s+-]+$", v_trimmed):
                raise ValueError("Contact number must contain letters, numbers, spaces, hyphens, and plus signs only")
            if len(v_trimmed) > 15:
                raise ValueError("Contact number must be maximum 15 characters")
            return v_trimmed
        return v

    @field_validator('remarks')
    @classmethod
    def validate_remarks(cls, v):
        if v is not None:
            v_trimmed = v.strip()
            if v_trimmed and not re.match(r"^[a-zA-Z0-9\s,.-]+$", v_trimmed):
                raise ValueError("Remarks must contain alphanumeric characters, spaces, commas, periods, or dashes only")
            if len(v_trimmed) > 125:
                raise ValueError("Remarks must be maximum 125 characters")
            return v_trimmed
        return v

class PaginatedPhoneDirectoryModel(BaseModel):
    data: List[PhoneDirectoryModel]
    total: int

def serialize_doc(doc: dict) -> dict:
    doc["_id"] = str(doc["_id"])
    return doc

# ----------------------------------------------------------------------
# API Endpoints
# ----------------------------------------------------------------------

@router.post("", response_description="Create phone directory entry", response_model=PhoneDirectoryModel, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_privilege("Create Phone Directory"))])
async def create_phone_entry(
    payload: PhoneDirectoryModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    collection = db.get_collection("phone_directory")
    
    # Check if contact number already exists
    existing = await collection.find_one({"contact_number": payload.contact_number})
    if existing:
        raise HTTPException(status_code=400, detail="An entry with this contact number already exists.")

    doc = payload.model_dump(exclude_unset=True)
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    
    doc["createdBy"] = current_user.get("username", "admin")
    doc["createdAt"] = now
    doc["updatedAt"] = now

    new_item = await collection.insert_one(doc)
    created_item = await collection.find_one({"_id": new_item.inserted_id})
    return serialize_doc(created_item)

@router.get("", response_description="List phone directory entries", dependencies=[Depends(require_privilege("View Phone Directory"))])
async def list_phone_entries(
    skip: int = 0,
    limit: int = 10,
    search: Optional[str] = None,
    sortBy: Optional[str] = "createdAt",
    order: Optional[str] = "desc"
):
    collection = db.get_collection("phone_directory")
    query = {}
    
    if search:
        query = {
            "$or": [
                {"name": {"$regex": search, "$options": "i"}},
                {"contact_number": {"$regex": search, "$options": "i"}},
                {"remarks": {"$regex": search, "$options": "i"}}
            ]
        }
        
    sort_order = -1 if order == "desc" else 1
    sort_field = sortBy if sortBy else "createdAt"
    
    cursor = collection.find(query).sort(sort_field, sort_order).skip(skip).limit(limit)
    items = await cursor.to_list(length=limit)
    total = await collection.count_documents(query)
    
    return {"data": [serialize_doc(item) for item in items], "total": total}

@router.put("/{id}", response_description="Update phone directory entry", response_model=PhoneDirectoryModel, dependencies=[Depends(require_privilege("Update Phone Directory"))])
async def update_phone_entry(id: str, payload: UpdatePhoneDirectoryModel = Body(...)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    collection = db.get_collection("phone_directory")
    
    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields provided for update")

    # If contact_number is updated, check for duplicates
    if "contact_number" in update_data:
        existing = await collection.find_one({"contact_number": update_data["contact_number"], "_id": {"$ne": ObjectId(id)}})
        if existing:
            raise HTTPException(status_code=400, detail="Another entry with this contact number already exists.")

    update_data["updatedAt"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    result = await collection.update_one({"_id": ObjectId(id)}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")

    updated_item = await collection.find_one({"_id": ObjectId(id)})
    return serialize_doc(updated_item)

@router.delete("/{id}", response_description="Delete phone directory entry", dependencies=[Depends(require_privilege("Delete Phone Directory"))])
async def delete_phone_entry(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    collection = db.get_collection("phone_directory")
    result = await collection.delete_one({"_id": ObjectId(id)})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")

    return {"status": "ok"}
