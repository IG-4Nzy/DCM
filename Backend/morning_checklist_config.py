from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import APIRouter, Body, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, ConfigDict, Field

from auth_utils import get_current_user, require_any_privilege, require_privilege
from database import db

router = APIRouter()
collection = db.get_collection("morning_checklist_config")


class MorningChecklistFieldModel(BaseModel):
    id: Optional[str] = Field(alias="_id", default=None)
    label: str
    inputType: str  # "checkbox", "dropdown", "text"
    options: List[str] = Field(default_factory=list)  # for checkbox/dropdown
    showRemarks: bool = False
    slNumber: int = 0
    department: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)


class PaginatedFieldsModel(BaseModel):
    data: List[MorningChecklistFieldModel]
    total: int


def serialize_doc(doc: dict) -> dict:
    doc["_id"] = str(doc["_id"])
    return doc


@router.get(
    "",
    response_description="List morning checklist config fields",
    response_model=PaginatedFieldsModel,
    response_model_by_alias=False,
    dependencies=[Depends(require_any_privilege(["View Configurations", "Edit Morning Checklist Field", "View Morning Checklist", "Create Morning Checklist", "Update Morning Checklist"]))],
)
async def list_fields(
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1),
    pagination: Optional[bool] = Query(True),
    department: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    query: Dict[str, Any] = {}
    target_dept = department or current_user.get("department", "")
    if not current_user.get("isSuperuser", False) or target_dept:
        query["department"] = target_dept

    total = await collection.count_documents(query)

    if pagination is False:
        cursor = collection.find(query).sort("slNumber", 1)
        data = [serialize_doc(doc) async for doc in cursor]
    else:
        cursor = collection.find(query).sort("slNumber", 1).skip(skip).limit(limit)
        data = [serialize_doc(doc) async for doc in cursor]

    return {"data": data, "total": total}


@router.post(
    "",
    response_description="Create morning checklist config field",
    response_model=MorningChecklistFieldModel,
    status_code=status.HTTP_201_CREATED,
    response_model_by_alias=False,
    dependencies=[Depends(require_privilege("Edit Morning Checklist Field"))],
)
async def create_field(
    payload: MorningChecklistFieldModel = Body(...),
    current_user: dict = Depends(get_current_user),
):
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    doc = payload.model_dump(by_alias=True, exclude={"id"})
    doc["createdAt"] = now
    doc["updatedAt"] = now

    if "department" not in doc or not doc["department"]:
        doc["department"] = current_user.get("department", "")

    # Auto-assign slNumber per department
    max_sl_doc = await collection.find_one({"department": doc["department"]}, sort=[("slNumber", -1)])
    doc["slNumber"] = (max_sl_doc["slNumber"] + 1) if max_sl_doc and "slNumber" in max_sl_doc else 1

    result = await collection.insert_one(doc)
    created = await collection.find_one({"_id": result.inserted_id})
    return serialize_doc(created)


@router.put(
    "/{id}",
    response_description="Update morning checklist config field",
    response_model=MorningChecklistFieldModel,
    response_model_by_alias=False,
    dependencies=[Depends(require_privilege("Edit Morning Checklist Field"))],
)
async def update_field(
    id: str,
    payload: MorningChecklistFieldModel = Body(...),
    current_user: dict = Depends(get_current_user),
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    existing = await collection.find_one({"_id": ObjectId(id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Field not found")

    if not current_user.get("isSuperuser", False):
        if existing.get("department") != current_user.get("department"):
            raise HTTPException(status_code=403, detail="Forbidden: You can only edit fields in your department")

    update_data = payload.model_dump(by_alias=True, exclude={"id", "_id"}, exclude_none=True)
    update_data["updatedAt"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    if "department" not in update_data or not update_data["department"]:
        update_data["department"] = existing.get("department", "")

    result = await collection.update_one({"_id": ObjectId(id)}, {"$set": update_data})
    if result.matched_count != 1:
        raise HTTPException(status_code=404, detail="Field not found")

    updated = await collection.find_one({"_id": ObjectId(id)})
    return serialize_doc(updated)


@router.delete(
    "/{id}",
    response_description="Delete morning checklist config field",
    dependencies=[Depends(require_privilege("Edit Morning Checklist Field"))],
)
async def delete_field(
    id: str,
    current_user: dict = Depends(get_current_user),
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    if not current_user.get("isSuperuser", False):
        existing = await collection.find_one({"_id": ObjectId(id)})
        if not existing or existing.get("department") != current_user.get("department"):
            raise HTTPException(status_code=403, detail="Forbidden: You can only delete fields in your department")

    result = await collection.delete_one({"_id": ObjectId(id)})
    if result.deleted_count != 1:
        raise HTTPException(status_code=404, detail="Field not found")

    return Response(status_code=status.HTTP_204_NO_CONTENT)
