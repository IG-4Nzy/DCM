from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import APIRouter, Body, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, ConfigDict, Field

from auth_utils import get_current_user, require_any_privilege, require_privilege
from database import db

router = APIRouter()
collection = db.get_collection("bms_checklists")


class BMSChecklistModel(BaseModel):
    id: Optional[str] = Field(alias="_id", default=None)
    date: str
    time: str
    preparedBy: str
    department: Optional[str] = None
    status: str = "Draft"
    data: Dict[str, Any] = Field(default_factory=dict)
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None
    createdBy: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)


class PaginatedBMSChecklistsModel(BaseModel):
    data: List[BMSChecklistModel]
    total: int


def serialize_checklist(doc: dict) -> dict:
    doc["_id"] = str(doc["_id"])
    return doc


@router.get(
    "/",
    response_description="List BMS checklists",
    response_model=PaginatedBMSChecklistsModel,
    response_model_by_alias=False,
    dependencies=[Depends(require_privilege("View BMS Checklist"))],
)
async def list_bms_checklists(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1),
    status_filter: Optional[str] = Query(None, alias="status"),
    prepared_by: Optional[str] = Query(None, alias="preparedBy"),
):
    query: Dict[str, Any] = {}
    if status_filter:
        query["status"] = status_filter
    if prepared_by:
        query["preparedBy"] = {"$regex": prepared_by, "$options": "i"}

    total = await collection.count_documents(query)
    cursor = collection.find(query).sort("createdAt", -1).skip(skip).limit(limit)
    data = [serialize_checklist(doc) async for doc in cursor]
    return {"data": data, "total": total}


@router.post(
    "/",
    response_description="Create BMS checklist",
    response_model=BMSChecklistModel,
    status_code=status.HTTP_201_CREATED,
    response_model_by_alias=False,
    dependencies=[Depends(require_privilege("Create BMS Checklist"))],
)
async def create_bms_checklist(
    payload: BMSChecklistModel = Body(...),
    current_user: dict = Depends(get_current_user),
):
    now = datetime.now(timezone.utc).isoformat()
    doc = payload.model_dump(by_alias=True, exclude={"id"})
    doc["createdAt"] = now
    doc["updatedAt"] = now
    doc["createdBy"] = current_user.get("sub", "")

    result = await collection.insert_one(doc)
    created = await collection.find_one({"_id": result.inserted_id})
    
    from notification_helper import log_page_update
    await log_page_update("daily-activities", department=doc.get("department"), username=current_user.get("sub"))

    return serialize_checklist(created)


@router.get(
    "/{id}",
    response_description="Get BMS checklist",
    response_model=BMSChecklistModel,
    response_model_by_alias=False,
    dependencies=[Depends(require_privilege("View BMS Checklist"))],
)
async def get_bms_checklist(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    doc = await collection.find_one({"_id": ObjectId(id)})
    if not doc:
        raise HTTPException(status_code=404, detail="BMS checklist not found")

    return serialize_checklist(doc)


@router.put(
    "/{id}",
    response_description="Update BMS checklist",
    response_model=BMSChecklistModel,
    response_model_by_alias=False,
    dependencies=[Depends(require_any_privilege(["Update BMS Checklist", "Edit BMS Checklist Field"]))],
)
async def update_bms_checklist(
    id: str,
    payload: BMSChecklistModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    update_data = payload.model_dump(by_alias=True, exclude={"id", "_id"}, exclude_none=True)
    update_data["updatedAt"] = datetime.now(timezone.utc).isoformat()

    result = await collection.update_one({"_id": ObjectId(id)}, {"$set": update_data})
    if result.matched_count != 1:
        raise HTTPException(status_code=404, detail="BMS checklist not found")

    updated = await collection.find_one({"_id": ObjectId(id)})
    
    from notification_helper import log_page_update
    await log_page_update("daily-activities", department=updated.get("department"), username=current_user.get("sub"))

    return serialize_checklist(updated)


@router.delete(
    "/{id}",
    response_description="Delete BMS checklist",
    dependencies=[Depends(require_privilege("Delete BMS Checklist"))],
)
async def delete_bms_checklist(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    result = await collection.delete_one({"_id": ObjectId(id)})
    if result.deleted_count != 1:
        raise HTTPException(status_code=404, detail="BMS checklist not found")

    return Response(status_code=status.HTTP_204_NO_CONTENT)
