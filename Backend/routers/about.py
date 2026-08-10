import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, status, Body, Depends, File, UploadFile, Form
from database import db
from auth_utils import require_privilege, get_current_user
from bson import ObjectId
from datetime import datetime, timezone
import os

router = APIRouter()
logger = logging.getLogger("about.router")

ABOUT_COLLECTION = "about_config"
BUG_REPORTS_COLLECTION = "bug_reports"

# ----------------------------------------
# About App Settings
# ----------------------------------------

@router.get("/", response_description="Get About App details")
async def get_about_details():
    config_col = db.get_collection(ABOUT_COLLECTION)
    config = await config_col.find_one({})
    if not config:
        # Default fallback
        config = {
            "appName": "Datacentre Management System (DCM)",
            "appVersion": "1.0.0",
            "newFeatures": [
                "Integrated Server Ping Monitoring with Database backend",
                "Departmental filtering for works and privileges",
                "Centralized Dashboard UI for Server Monitoring",
                "Added Notification sounds and Mute toggles",
                "Salary Calculation enhancements",
                "Late login restrictions on checklists",
            ]
        }
        await config_col.insert_one(config)
        config.pop("_id", None)
    else:
        config["_id"] = str(config["_id"])
    return config

@router.put("/", response_description="Update About App details", dependencies=[Depends(require_privilege("Edit About App"))])
async def update_about_details(payload: dict = Body(...)):
    config_col = db.get_collection(ABOUT_COLLECTION)
    existing = await config_col.find_one({})
    
    update_data = {
        "appName": payload.get("appName", ""),
        "appVersion": payload.get("appVersion", ""),
        "newFeatures": payload.get("newFeatures", [])
    }

    if existing:
        await config_col.update_one({"_id": existing["_id"]}, {"$set": update_data})
    else:
        await config_col.insert_one(update_data)
        
    return {"message": "About details updated successfully"}

# ----------------------------------------
# Bug Reports
# ----------------------------------------

@router.post("/bug-reports", response_description="Submit a bug report")
async def submit_bug_report(
    description: str = Form(...),
    image: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user)
):
    bug_col = db.get_collection(BUG_REPORTS_COLLECTION)
    
    image_path = None
    if image:
        upload_dir = "uploads/bugs"
        os.makedirs(upload_dir, exist_ok=True)
        file_path = os.path.join(upload_dir, f"{ObjectId()}_{image.filename}")
        with open(file_path, "wb") as buffer:
            buffer.write(await image.read())
        image_path = file_path

    bug_report = {
        "description": description,
        "imagePath": image_path,
        "reportedBy": current_user.get("sub", "unknown"),
        "reportedAt": datetime.now(timezone.utc).isoformat()
    }
    
    await bug_col.insert_one(bug_report)
    return {"message": "Bug reported successfully"}

@router.get("/bug-reports", response_description="Get all bug reports", dependencies=[Depends(require_privilege("View Bug Reports"))])
async def get_bug_reports():
    bug_col = db.get_collection(BUG_REPORTS_COLLECTION)
    cursor = bug_col.find().sort("reportedAt", -1)
    bugs = await cursor.to_list(length=None)
    for b in bugs:
        b["_id"] = str(b["_id"])
    return bugs

@router.delete("/bug-reports/{id}", response_description="Delete a bug report", dependencies=[Depends(require_privilege("View Bug Reports"))])
async def delete_bug_report(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID")
    bug_col = db.get_collection(BUG_REPORTS_COLLECTION)
    res = await bug_col.delete_one({"_id": ObjectId(id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bug report not found")
    return {"message": "Bug report deleted"}
