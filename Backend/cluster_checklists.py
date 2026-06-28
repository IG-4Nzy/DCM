from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import APIRouter, Body, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, ConfigDict, Field

from auth_utils import get_current_user, require_any_privilege, require_privilege
from database import db

router = APIRouter()
collection = db.get_collection("cluster_checklists")


class ClusterChecklistModel(BaseModel):
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
    completedBy: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)


class PaginatedClusterChecklistsModel(BaseModel):
    data: List[ClusterChecklistModel]
    total: int


def serialize_checklist(doc: dict) -> dict:
    doc["_id"] = str(doc["_id"])
    return doc


@router.get(
    "",
    response_description="List Cluster checklists",
    response_model=PaginatedClusterChecklistsModel,
    response_model_by_alias=False,
    dependencies=[Depends(require_any_privilege(["View Cluster Checklist", "View All Department Cluster Checklist"]))],
)
async def list_cluster_checklists(
    pagination: bool = Query(True),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1),
    status_filter: Optional[str] = Query(None, alias="status"),
    prepared_by: Optional[str] = Query(None, alias="preparedBy"),
    department: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    query: Dict[str, Any] = {}
    if status_filter:
        query["status"] = status_filter
    if prepared_by:
        query["preparedBy"] = {"$regex": prepared_by, "$options": "i"}
    if date:
        query["date"] = date

    can_view_all = current_user.get("isSuperuser", False) or "View All Department Cluster Checklist" in current_user.get("privileges", [])
    
    if not can_view_all:
        query["department"] = current_user.get("department", "")
    elif department:
        query["department"] = department

    total = await collection.count_documents(query)
    cursor = collection.find(query).sort("createdAt", -1)
    if pagination:
        cursor = cursor.skip(skip).limit(limit)
    data = [serialize_checklist(doc) async for doc in cursor]
    return {"data": data, "total": total}


@router.post(
    "",
    response_description="Create Cluster checklist",
    response_model=ClusterChecklistModel,
    status_code=status.HTTP_201_CREATED,
    response_model_by_alias=False,
    dependencies=[Depends(require_privilege("Create Cluster Checklist"))],
)
async def create_cluster_checklist(
    payload: ClusterChecklistModel = Body(...),
    current_user: dict = Depends(get_current_user),
):
    now = datetime.now(timezone.utc).isoformat()
    doc = payload.model_dump(by_alias=True, exclude={"id"})
    doc["createdAt"] = now
    doc["updatedAt"] = now
    doc["createdBy"] = current_user.get("sub", "")

    if "department" not in doc or not doc["department"]:
        doc["department"] = current_user.get("department", "")

    # Enforce one checklist per day per department
    existing = await collection.find_one({
        "date": doc["date"],
        "department": doc["department"]
    })
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"A Cluster checklist already exists for {doc['date']} in this department"
        )

    result = await collection.insert_one(doc)
    created = await collection.find_one({"_id": result.inserted_id})
    
    from notification_helper import log_page_update
    await log_page_update("daily-activities", department=doc.get("department"), username=current_user.get("sub"))

    return serialize_checklist(created)


@router.get(
    "/{id}",
    response_description="Get Cluster checklist",
    response_model=ClusterChecklistModel,
    response_model_by_alias=False,
    dependencies=[Depends(require_any_privilege(["View Cluster Checklist", "View All Department Cluster Checklist"]))],
)
async def get_cluster_checklist(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    doc = await collection.find_one({"_id": ObjectId(id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Cluster checklist not found")

    return serialize_checklist(doc)


@router.put(
    "/{id}",
    response_description="Update Cluster checklist",
    response_model=ClusterChecklistModel,
    response_model_by_alias=False,
    dependencies=[Depends(require_any_privilege(["Update Cluster Checklist", "Edit Cluster Checklist Field"]))],
)
async def update_cluster_checklist(
    id: str,
    payload: ClusterChecklistModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    update_data = payload.model_dump(by_alias=True, exclude={"id", "_id"}, exclude_none=True)
    update_data["updatedAt"] = datetime.now(timezone.utc).isoformat()

    result = await collection.update_one({"_id": ObjectId(id)}, {"$set": update_data})
    if result.matched_count != 1:
        raise HTTPException(status_code=404, detail="Cluster checklist not found")

    updated = await collection.find_one({"_id": ObjectId(id)})
    
    from notification_helper import log_page_update
    await log_page_update("daily-activities", department=updated.get("department"), username=current_user.get("sub"))

    return serialize_checklist(updated)


@router.delete(
    "/{id}",
    response_description="Delete Cluster checklist",
    dependencies=[Depends(require_privilege("Delete Cluster Checklist"))],
)
async def delete_cluster_checklist(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    result = await collection.delete_one({"_id": ObjectId(id)})
    if result.deleted_count != 1:
        raise HTTPException(status_code=404, detail="Cluster checklist not found")

    return Response(status_code=status.HTTP_204_NO_CONTENT)
