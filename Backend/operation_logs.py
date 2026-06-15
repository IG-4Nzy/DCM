from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status, Depends, Query, Body
from auth_utils import get_current_user, require_privilege
from database import db
from bson import ObjectId
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any

router = APIRouter()
collection = db.get_collection("operation_logs")

class OperationLogModel(BaseModel):
    id: Optional[str] = Field(alias="_id", default=None)
    date: str  # YYYY-MM-DD
    remarks: str
    status: str  # "open" or "closed"
    loggedBy: Optional[str] = ""
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class PaginatedOperationLogsModel(BaseModel):
    data: List[OperationLogModel]
    total: int

def serialize_doc(doc: dict) -> dict:
    doc["_id"] = str(doc["_id"])
    return doc

@router.post("", response_description="Create operation log", response_model=OperationLogModel, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_privilege("Create Log"))])
async def create_log(
    payload: OperationLogModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    doc = payload.model_dump(by_alias=True, exclude={"id"})
    doc["createdAt"] = now
    doc["updatedAt"] = now
    doc["loggedBy"] = current_user.get("username") or current_user.get("sub") or "unknown"

    result = await collection.insert_one(doc)
    created = await collection.find_one({"_id": result.inserted_id})
    return serialize_doc(created)

@router.get("", response_description="List operation logs", response_model=PaginatedOperationLogsModel, dependencies=[Depends(require_privilege("View Logs"))])
async def list_logs(
    pagination: bool = Query(True),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1),
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query: Dict[str, Any] = {}
    if search:
        query["$or"] = [
            {"remarks": {"$regex": search, "$options": "i"}},
            {"status": {"$regex": search, "$options": "i"}},
            {"loggedBy": {"$regex": search, "$options": "i"}}
        ]

    total = await collection.count_documents(query)
    cursor = collection.find(query).sort("createdAt", -1)
    if pagination:
        cursor = cursor.skip(skip).limit(limit)
    
    data = [serialize_doc(doc) async for doc in cursor]
    return {"data": data, "total": total}

@router.put("/{id}", response_description="Update operation log", response_model=OperationLogModel, dependencies=[Depends(require_privilege("Update Log"))])
async def update_log(
    id: str,
    payload: OperationLogModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    existing = await collection.find_one({"_id": ObjectId(id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Log not found")

    update_data = payload.model_dump(by_alias=True, exclude={"id", "_id"}, exclude_none=True)
    update_data["updatedAt"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    await collection.update_one({"_id": ObjectId(id)}, {"$set": update_data})
    updated = await collection.find_one({"_id": ObjectId(id)})
    return serialize_doc(updated)

@router.delete("/{id}", response_description="Delete operation log", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_privilege("Delete Log"))])
async def delete_log(
    id: str,
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    existing = await collection.find_one({"_id": ObjectId(id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Log not found")

    await collection.delete_one({"_id": ObjectId(id)})
    return
