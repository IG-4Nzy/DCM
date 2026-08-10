import re
from fastapi import APIRouter, Depends, HTTPException, Query
from auth_utils import get_current_user, require_any_privilege
from database import db
from typing import Optional, List, Dict, Any
from bson import ObjectId

router = APIRouter()
history_col = db.get_collection("infrastructure_update_history")

@router.get("", response_description="List infrastructure update history", dependencies=[Depends(require_any_privilege(["Create Server Details", "View Server Details", "View All Server Details", "VM View", "Nodes View", "Update VMs (Restricted)", "Update Node (Restricted)", "Update Storage (Restricted)", "Update Network Device (Restricted)"]))])
async def get_all_history(
    pagination: bool = Query(True),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1),
    search: Optional[str] = None,
    entityType: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query: Dict[str, Any] = {}
    if entityType:
        query["entityType"] = entityType
        
    if search:
        search_regex = {"$regex": search, "$options": "i"}
        query["$or"] = [
            {"entityId": search_regex},
            {"entityName": search_regex},
            {"vmId": search_regex},
            {"ipAddress": search_regex},
            {"hostName": search_regex},
            {"username": search_regex},
            {"userIp": search_regex},
            {"changes.field": search_regex},
            {"changes.from": search_regex},
            {"changes.to": search_regex}
        ]
        
    total = await history_col.count_documents(query)
    cursor = history_col.find(query).sort("timestamp", -1)
    if pagination:
        cursor = cursor.skip(skip).limit(limit)
        
    items = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        items.append(doc)
        
    return {"data": items, "total": total}

@router.get("/{entity_id}", response_description="Get update history for a specific entity", dependencies=[Depends(require_any_privilege(["Create Server Details", "View Server Details", "View All Server Details", "VM View", "Nodes View", "Update VMs (Restricted)", "Update Node (Restricted)", "Update Storage (Restricted)", "Update Network Device (Restricted)"]))])
async def get_entity_history(
    entity_id: str,
    search: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    escaped_id = re.escape(entity_id)
    id_regex = {"$regex": escaped_id, "$options": "i"}
    
    base_or = [
        {"entityId": entity_id},
        {"entityId": id_regex},
        {"entityName": id_regex},
        {"vmId": id_regex},
        {"ipAddress": id_regex},
        {"hostName": id_regex}
    ]
    
    if search:
        search_regex = {"$regex": search, "$options": "i"}
        query = {
            "$and": [
                {"$or": base_or},
                {
                    "$or": [
                        {"username": search_regex},
                        {"userIp": search_regex},
                        {"entityId": search_regex},
                        {"entityName": search_regex},
                        {"vmId": search_regex},
                        {"changes.field": search_regex},
                        {"changes.from": search_regex},
                        {"changes.to": search_regex}
                    ]
                }
            ]
        }
    else:
        query = {"$or": base_or}
    
    cursor = history_col.find(query).sort("timestamp", -1)
    items = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        items.append(doc)
        
    return {"data": items, "total": len(items)}
