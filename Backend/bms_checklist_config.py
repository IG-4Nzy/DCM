from datetime import datetime, timezone
from typing import Any, Dict, Optional

from bson import ObjectId
from fastapi import APIRouter, Body, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, ConfigDict, Field

from auth_utils import get_current_user, require_any_privilege, require_privilege
from database import db

router = APIRouter()
collection = db.get_collection("bms_checklist_config")


class BMSChecklistConfigModel(BaseModel):
    id: Optional[str] = Field(alias="_id", default=None)
    department: str
    template: Dict[str, Any] = Field(default_factory=dict)
    updatedAt: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)


@router.get(
    "/",
    response_description="Get BMS checklist template configuration",
    dependencies=[Depends(require_any_privilege(["View Configurations", "Edit BMS Checklist Field", "View BMS Checklist", "Create BMS Checklist", "Update BMS Checklist"]))],
)
async def get_config(
    department: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    target_dept = department or current_user.get("department", "")
    if not target_dept:
        return {"department": "", "template": {}}

    doc = await collection.find_one({"department": target_dept})
    if not doc:
        return {"department": target_dept, "template": {}}

    doc["_id"] = str(doc["_id"])
    return doc


@router.post(
    "/",
    response_description="Save BMS checklist template configuration",
    dependencies=[Depends(require_privilege("Edit BMS Checklist Field"))],
)
async def save_config(
    payload: BMSChecklistConfigModel = Body(...),
    current_user: dict = Depends(get_current_user),
):
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    
    target_dept = payload.department
    if not current_user.get("isSuperuser", False):
        user_dept = current_user.get("department", "")
        if target_dept != user_dept:
            raise HTTPException(
                status_code=403,
                detail="Forbidden: You can only save configurations for your own department."
            )

    doc = {
        "department": target_dept,
        "template": payload.template,
        "updatedAt": now,
    }

    await collection.update_one(
        {"department": target_dept},
        {"$set": doc},
        upsert=True
    )
    
    updated = await collection.find_one({"department": target_dept})
    updated["_id"] = str(updated["_id"])
    return updated
