from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import APIRouter, Body, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, ConfigDict, Field

from auth_utils import get_current_user, require_any_privilege, require_privilege
from database import db

router = APIRouter()
collection = db.get_collection("morning_checklists")


class MorningChecklistItemModel(BaseModel):
    fieldId: str = ""
    label: str = ""
    inputType: str = "text"  # "checkbox", "dropdown", "text"
    options: List[str] = Field(default_factory=list)
    value: Any = ""  # string for text/dropdown, list for checkbox
    remarks: str = ""
    showRemarks: bool = False


class MorningChecklistModel(BaseModel):
    id: Optional[str] = Field(alias="_id", default=None)
    date: str
    department: str = ""
    preparedBy: str = ""
    createdBy: Optional[str] = None
    status: str = "Draft"  # Draft | Completed
    items: List[MorningChecklistItemModel] = Field(default_factory=list)
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None
    completedBy: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)


class PaginatedMorningChecklistsModel(BaseModel):
    data: List[MorningChecklistModel]
    total: int


def serialize_checklist(doc: dict) -> dict:
    doc["_id"] = str(doc["_id"])
    return doc


@router.get(
    "/",
    response_description="List morning checklists",
    response_model=PaginatedMorningChecklistsModel,
    response_model_by_alias=False,
    dependencies=[Depends(require_privilege("View Morning Checklist"))],
)
async def list_morning_checklists(
    pagination: bool = Query(True),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1),
    date: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    prepared_by: Optional[str] = Query(None, alias="preparedBy"),
    month: Optional[str] = Query(None),  # YYYY-MM format for month filter
    current_user: dict = Depends(get_current_user),
):
    query: Dict[str, Any] = {}
    if date:
        query["date"] = date
    if status_filter:
        query["status"] = status_filter
    if prepared_by:
        query["preparedBy"] = {"$regex": prepared_by, "$options": "i"}
    if month:
        # Filter by month: date field starts with YYYY-MM
        query["date"] = {"$regex": f"^{month}"}

    target_dept = department or current_user.get("department", "")
    if not current_user.get("isSuperuser", False) or target_dept:
        query["department"] = target_dept

    total = await collection.count_documents(query)
    cursor = collection.find(query).sort("createdAt", -1)
    if pagination:
        cursor = cursor.skip(skip).limit(limit)
    data = [serialize_checklist(doc) async for doc in cursor]
    return {"data": data, "total": total}


@router.post(
    "/",
    response_description="Create morning checklist",
    response_model=MorningChecklistModel,
    status_code=status.HTTP_201_CREATED,
    response_model_by_alias=False,
    dependencies=[Depends(require_privilege("Create Morning Checklist"))],
)
async def create_morning_checklist(
    payload: MorningChecklistModel = Body(...),
    current_user: dict = Depends(get_current_user),
):
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    doc = payload.model_dump(by_alias=True, exclude={"id"})
    doc["createdAt"] = now
    doc["updatedAt"] = now
    doc["createdBy"] = current_user.get("sub", "")

    # Enforce department context
    if not current_user.get("isSuperuser", False):
        doc["department"] = current_user.get("department", "")
    elif not doc.get("department"):
        doc["department"] = current_user.get("department", "")

    # Enforce one per day per department
    existing = await collection.find_one({
        "date": doc["date"],
        "department": doc.get("department", "")
    })
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"A morning checklist already exists for {doc['date']} in this department"
        )

    result = await collection.insert_one(doc)
    created = await collection.find_one({"_id": result.inserted_id})

    from notification_helper import log_page_update
    await log_page_update("daily-activities", department=doc.get("department"), username=current_user.get("sub"))

    return serialize_checklist(created)


@router.get(
    "/{id}",
    response_description="Get morning checklist",
    response_model=MorningChecklistModel,
    response_model_by_alias=False,
    dependencies=[Depends(require_privilege("View Morning Checklist"))],
)
async def get_morning_checklist(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    doc = await collection.find_one({"_id": ObjectId(id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Morning checklist not found")

    return serialize_checklist(doc)


@router.put(
    "/{id}",
    response_description="Update morning checklist",
    response_model=MorningChecklistModel,
    response_model_by_alias=False,
    dependencies=[Depends(require_any_privilege(["Update Morning Checklist", "Edit Morning Checklist Field"]))],
)
async def update_morning_checklist(
    id: str,
    payload: MorningChecklistModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    update_data = payload.model_dump(by_alias=True, exclude={"id", "_id"}, exclude_none=True)
    update_data["updatedAt"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    result = await collection.update_one({"_id": ObjectId(id)}, {"$set": update_data})
    if result.matched_count != 1:
        raise HTTPException(status_code=404, detail="Morning checklist not found")

    updated = await collection.find_one({"_id": ObjectId(id)})

    from notification_helper import log_page_update
    await log_page_update("daily-activities", department=updated.get("department"), username=current_user.get("sub"))

    return serialize_checklist(updated)


@router.delete(
    "/{id}",
    response_description="Delete morning checklist",
    dependencies=[Depends(require_privilege("Delete Morning Checklist"))],
)
async def delete_morning_checklist(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    result = await collection.delete_one({"_id": ObjectId(id)})
    if result.deleted_count != 1:
        raise HTTPException(status_code=404, detail="Morning checklist not found")

    return Response(status_code=status.HTTP_204_NO_CONTENT)
