from fastapi import APIRouter, Depends, HTTPException, Query
from auth_utils import get_current_user
from database import db
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict

router = APIRouter()
logs_collection = db.get_collection("audit_logs")

class AuditLogResponseModel(BaseModel):
    id: Optional[str] = Field(alias="_id", default=None)
    timestamp: str
    user: str
    action: str
    details: str
    ipAddress: Optional[str] = None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

class PaginatedAuditLogsModel(BaseModel):
    data: List[AuditLogResponseModel]
    total: int

@router.get("/", response_description="List all audit logs", response_model=PaginatedAuditLogsModel)
async def list_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1),
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    if not current_user.get("isSuperuser", False):
        raise HTTPException(status_code=403, detail="Only superuser can access audit logs")

    query = {
        "details": {"$not": {"$regex": "^GET", "$options": "i"}},
        "action": {"$not": {"$regex": "^GET|^View", "$options": "i"}}
    }
    if search:
        search_query = {
            "$or": [
                {"user": {"$regex": search, "$options": "i"}},
                {"action": {"$regex": search, "$options": "i"}},
                {"details": {"$regex": search, "$options": "i"}},
                {"ipAddress": {"$regex": search, "$options": "i"}}
            ]
        }
        query = {"$and": [query, search_query]}

    total = await logs_collection.count_documents(query)
    cursor = logs_collection.find(query).sort("timestamp", -1).skip(skip).limit(limit)
    
    items = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        items.append(doc)

    return {"data": items, "total": total}
