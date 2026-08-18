from fastapi import APIRouter, HTTPException, status, Depends, Query, Body
from auth_utils import get_current_user, require_privilege
from database import db
from bson import ObjectId
from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import re

router = APIRouter()
collection = db.get_collection("ip_list")

class IpListModel(BaseModel):
    id: Optional[str] = Field(alias="_id", default=None)
    ip: str
    purpose: Optional[str] = ""
    takenBy: Optional[str] = None
    isUsed: bool = False
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

    @field_validator('ip')
    @classmethod
    def validate_ip(cls, v):
        if v:
            v_trimmed = v.strip()
            if not v_trimmed:
                raise ValueError("IP address cannot be empty")
            if not re.match(r"^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$", v_trimmed):
                raise ValueError("IP Address must be a valid IPv4 address")
            parts = v_trimmed.split(".")
            for part in parts:
                if not 0 <= int(part) <= 255:
                    raise ValueError("Each octet of IP Address must be between 0 and 255")
            return v_trimmed
        return v

    @field_validator('purpose')
    @classmethod
    def validate_purpose(cls, v):
        if v is not None:
            v_trimmed = v.strip()
            if v_trimmed and not re.match(r"^[a-zA-Z0-9\s,.-]+$", v_trimmed):
                raise ValueError("Purpose must contain alphanumeric characters, spaces, commas, periods, or dashes only")
            if len(v_trimmed) > 100:
                raise ValueError("Purpose must be maximum 100 characters")
            return v_trimmed
        return v

class PaginatedIpListModel(BaseModel):
    data: List[IpListModel]
    total: int

def serialize_doc(doc: dict) -> dict:
    doc["_id"] = str(doc["_id"])
    return doc

@router.post("", response_description="Create IP", response_model=IpListModel, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_privilege("Create IP List"))])
async def create_ip(
    payload: IpListModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    doc = payload.model_dump(by_alias=True, exclude={"id"})
    doc["createdAt"] = now
    doc["updatedAt"] = now

    result = await collection.insert_one(doc)
    created = await collection.find_one({"_id": result.inserted_id})
    return serialize_doc(created)

@router.get("", response_description="List IPs", response_model=PaginatedIpListModel, dependencies=[Depends(require_privilege("View IP List"))])
async def list_ips(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1),
    search: Optional[str] = None,
    isUsed: Optional[bool] = None,
    takenBy: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query: Dict[str, Any] = {}
    if search:
        query["$or"] = [
            {"ip": {"$regex": search, "$options": "i"}},
            {"purpose": {"$regex": search, "$options": "i"}}
        ]
    if isUsed is not None:
        query["isUsed"] = isUsed
    if takenBy:
        query["takenBy"] = takenBy

    total = await collection.count_documents(query)
    cursor = collection.find(query).sort("ip", 1).skip(skip).limit(limit)
    
    data = [serialize_doc(doc) async for doc in cursor]
    return {"data": data, "total": total}

@router.put("/{id}", response_description="Update IP", response_model=IpListModel, dependencies=[Depends(require_privilege("Update IP List"))])
async def update_ip(
    id: str,
    payload: IpListModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    existing = await collection.find_one({"_id": ObjectId(id)})
    if not existing:
        raise HTTPException(status_code=404, detail="IP not found")

    update_data = payload.model_dump(by_alias=True, exclude={"id", "_id", "createdAt"}, exclude_none=True)
    update_data["updatedAt"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    await collection.update_one({"_id": ObjectId(id)}, {"$set": update_data})
    updated = await collection.find_one({"_id": ObjectId(id)})
    return serialize_doc(updated)

@router.delete("/{id}", response_description="Delete IP", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_privilege("Delete IP List"))])
async def delete_ip(
    id: str,
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    existing = await collection.find_one({"_id": ObjectId(id)})
    if not existing:
        raise HTTPException(status_code=404, detail="IP not found")

    await collection.delete_one({"_id": ObjectId(id)})
    return
