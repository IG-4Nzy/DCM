import os
import asyncio
from fastapi import APIRouter, HTTPException, status, Body, Query, Depends, Response, UploadFile, File
import shutil
import uuid
import time
from auth_utils import require_privilege, get_current_user, require_any_privilege
from fastapi.responses import JSONResponse
from typing import Optional
from database import db
from models import (
    ObservationModel, CreateObservationModel, UpdateObservationModel, PaginatedObservationsModel,
    ObservationCategoryModel, CreateObservationCategoryModel, UpdateObservationCategoryModel, PaginatedObservationCategoriesModel
)
from bson import ObjectId
from datetime import datetime

router = APIRouter()
obs_collection = db.get_collection("observations")
categories_collection = db.get_collection("observation_categories")

@router.get("/categories", response_description="List all categories", response_model=PaginatedObservationCategoriesModel, response_model_by_alias=False)
async def list_categories(
    skip: int = Query(0, ge=0),
    pagination: bool = Query(True),
    limit: int = Query(100, ge=1),
    search: Optional[str] = None
):
    query = {}
    if not pagination:
        query["status"] = {"$ne": False}

    if search:
        if not pagination:
            query = {
                "$and": [
                    {"status": {"$ne": False}},
                    {"name": {"$regex": search, "$options": "i"}}
                ]
            }
        else:
            query = {"name": {"$regex": search, "$options": "i"}}
        
    total = await categories_collection.count_documents(query)
    cursor = categories_collection.find(query)
    if pagination:
        cursor = cursor.skip(skip).limit(limit)
        categories = await cursor.to_list(length=limit)
    else:
        categories = await cursor.to_list(length=None)
            
    return {"data": categories, "total": total}

@router.post("/categories", response_description="Create a category", response_model=ObservationCategoryModel, status_code=status.HTTP_201_CREATED, response_model_by_alias=False, dependencies=[Depends(require_privilege("Create Observation"))])
async def create_category(category: CreateObservationCategoryModel = Body(...)):
    cat_dict = category.model_dump()
    new_cat = await categories_collection.insert_one(cat_dict)
    created_cat = await categories_collection.find_one({"_id": new_cat.inserted_id})
    return created_cat

@router.put("/categories/{id}", response_description="Update a category", response_model=ObservationCategoryModel, response_model_by_alias=False, dependencies=[Depends(require_privilege("Update Observation"))])
async def update_category(id: str, category: UpdateObservationCategoryModel = Body(...)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    cat_dict = {k: v for k, v in category.model_dump().items() if v is not None}
    
    if len(cat_dict) >= 1:
        update_result = await categories_collection.update_one(
            {"_id": ObjectId(id)}, {"$set": cat_dict}
        )
        if update_result.modified_count == 1:
            if (updated_cat := await categories_collection.find_one({"_id": ObjectId(id)})) is not None:
                return updated_cat

    if (existing_cat := await categories_collection.find_one({"_id": ObjectId(id)})) is not None:
        return existing_cat

    raise HTTPException(status_code=404, detail=f"Category {id} not found")

@router.delete("/categories/{id}", response_description="Delete a category", dependencies=[Depends(require_privilege("Delete Observation"))])
async def delete_category(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")
    delete_result = await categories_collection.delete_one({"_id": ObjectId(id)})
    if delete_result.deleted_count == 1:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    raise HTTPException(status_code=404, detail=f"Category {id} not found")

async def enrich_observation(obs: dict):
    if not obs:
        return obs
    obs_id = str(obs["_id"])
    parent_id = obs.get("repeatedFromId")
    group_parent_id = parent_id if parent_id else obs_id
    
    children_cursor = obs_collection.find({"repeatedFromId": group_parent_id})
    children = await children_cursor.to_list(length=None)
    
    total_occurrences = 1 + len(children)
    obs["repeatCount"] = total_occurrences if total_occurrences > 1 else 0
    
    if total_occurrences > 1:
        parent_obs = None
        if group_parent_id != obs_id:
            parent_obs = await obs_collection.find_one({"_id": ObjectId(group_parent_id)})
        else:
            parent_obs = obs
        
        if parent_obs:
            obs["repeatedDetails"] = {
                "parent": {
                    "id": str(parent_obs["_id"]),
                    "observationId": parent_obs.get("observationId", ""),
                    "description": parent_obs.get("description", ""),
                    "observedDate": parent_obs.get("observedDate", "")
                },
                "children": [
                    {
                        "id": str(c["_id"]),
                        "observationId": c.get("observationId", ""),
                        "description": c.get("description", ""),
                        "observedDate": c.get("observedDate", "")
                    }
                    for c in children
                ]
            }
        else:
            obs["repeatedDetails"] = None
    else:
        obs["repeatedDetails"] = None

    # Fetch mapped works referencing this observation
    works_col = db.get_collection("works")
    custom_obs_id = obs.get("observationId")
    or_clause = [{"description": {"$regex": f"#{obs_id}", "$options": "i"}}, {"comments.text": {"$regex": f"#{obs_id}", "$options": "i"}}]
    if custom_obs_id:
        or_clause.extend([{"description": {"$regex": f"#{custom_obs_id}", "$options": "i"}}, {"comments.text": {"$regex": f"#{custom_obs_id}", "$options": "i"}}])
    
    matching_works = await works_col.find({"$or": or_clause}).to_list(length=None)
    if matching_works:
        obs["mappedWorks"] = [
            {
                "id": str(w["_id"]),
                "workId": w.get("workId", ""),
                "workName": w.get("workName", ""),
                "status": w.get("status", "Pending"),
                "priority": w.get("priority", "Medium")
            }
            for w in matching_works
        ]
    else:
        obs["mappedWorks"] = []

    return obs

@router.post("/upload", response_description="Upload attachments", dependencies=[Depends(get_current_user)])
async def upload_attachments(files: list[UploadFile] = File(...)):
    uploaded_files = []
    base_dir = "uploads/observations"
    os.makedirs(base_dir, exist_ok=True)
    
    for file in files:
        if not file.filename:
            continue
            
        unique_name = f"{int(time.time())}_{uuid.uuid4().hex[:8]}_{file.filename}"
        file_path = os.path.join(base_dir, unique_name)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        uploaded_files.append({
            "name": file.filename,
            "url": f"/uploads/observations/{unique_name}"
        })
        
    return uploaded_files

@router.get("/", response_description="List all observations", response_model=PaginatedObservationsModel, response_model_by_alias=False)
async def list_observations(
    skip: int = Query(0, ge=0),
    pagination: bool = Query(True),
    limit: int = Query(10, ge=1),
    sortBy: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    order: str = Query("desc"),
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    date_filter: Optional[str] = None,
    category_filter: Optional[str] = None,
    department_filter: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    is_superuser = current_user.get("isSuperuser", False)
    privileges = current_user.get("privileges", [])
    
    if not is_superuser and "View Observations" not in privileges and "View All Department Observations" not in privileges:
        raise HTTPException(status_code=403, detail="Not enough permissions to view observations")

    if search:
        query["$or"] = [
            {"observationId": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"amc": {"$regex": search, "$options": "i"}},
            {"category": {"$regex": search, "$options": "i"}},
        ]
        
    if status_filter:
        query["status"] = status_filter
        
    if date_filter:
        query["$or"] = [
            {"observedDate": date_filter},
            {"lastStatusUpdatedOn": {"$regex": f"^{date_filter}"}}
        ]

    if category_filter:
        query["category"] = category_filter
        
    users_collection = db.get_collection("users")
    can_view_all = is_superuser or "View All Department Observations" in privileges

    if can_view_all:
        if department_filter:
            dept_users = await users_collection.find({"department": department_filter}).to_list(length=None)
            dept_usernames = [u["username"] for u in dept_users]
            query["loggedBy"] = {"$in": dept_usernames}
    else:
        current_user_record = await users_collection.find_one({"username": current_user["sub"]})
        if current_user_record and current_user_record.get("department"):
            dept = current_user_record["department"]
            dept_users = await users_collection.find({"department": dept}).to_list(length=None)
            dept_usernames = [u["username"] for u in dept_users]
            query["loggedBy"] = {"$in": dept_usernames}
        else:
            query["loggedBy"] = current_user["sub"]

    total = await obs_collection.count_documents(query)
    if category_filter and category_filter.strip().lower() == "hard disk failures" and not sortBy and not sort_by:
        cursor = obs_collection.find(query).sort([("serverRack", 1), ("rackPosition", 1)])
    else:
        actual_sort_by = sortBy or sort_by or "observationId"
        sort_order = 1 if order == "asc" else -1
        cursor = obs_collection.find(query).sort(actual_sort_by, sort_order)
    if pagination:
        cursor = cursor.skip(skip).limit(limit)
        observations = await cursor.to_list(length=limit)
    else:
        observations = await cursor.to_list(length=None)
        
    for obs in observations:
        await enrich_observation(obs)
            
    return {"data": observations, "total": total}

@router.post("/", response_description="Create a new observation", response_model=ObservationModel, status_code=status.HTTP_201_CREATED, response_model_by_alias=False, dependencies=[Depends(require_privilege("Create Observation"))])
async def create_observation(
    observation: CreateObservationModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    obs_dict = observation.model_dump()
    
    # Auto-generate observationId
    current_year = datetime.now().year % 100 # get last two digits
    
    # find the highest ID for the current year
    regex_pattern = f"^OBS-{current_year}"
    last_obs = await obs_collection.find({"observationId": {"$regex": regex_pattern}}).sort("observationId", -1).limit(1).to_list(length=1)
    
    next_num = 1
    if last_obs and last_obs[0].get("observationId"):
        try:
            last_num_str = last_obs[0]["observationId"].split("-")[1][2:]
            next_num = int(last_num_str) + 1
        except:
            pass
            
    obs_dict["observationId"] = f"OBS-{current_year}{str(next_num).zfill(3)}"
    obs_dict["lastStatusUpdatedOn"] = datetime.now().isoformat()
    
    new_obs = await obs_collection.insert_one(obs_dict)
    created_obs = await obs_collection.find_one({"_id": new_obs.inserted_id})
    
    users_collection = db.get_collection("users")
    user_record = await users_collection.find_one({"username": current_user["sub"]})
    user_dept = user_record.get("department") if user_record else None

    from notification_helper import log_page_update
    await log_page_update("observations", department=user_dept, username=current_user.get("sub"))

    # If observation is marked as an incident, trigger automated incident email notification
    if created_obs.get("isIncident"):
        try:
            config_col = db.get_collection("mail_config")
            config = await config_col.find_one({"_id": "mail_config"}) or {}
            if config.get("incidentMailEnabled", True):
                recipient_emails = config.get("savedEmailsIncident") or config.get("savedEmails") or []
                if recipient_emails:
                    from mail_utils import send_email
                    obs_id = created_obs.get("observationId", "N/A")
                    cat = created_obs.get("category", "General")
                    desc = created_obs.get("description", "")
                    obs_date = created_obs.get("observedDate", "")
                    obs_time = created_obs.get("observedTime", "")
                    logged_by = created_obs.get("loggedBy", "Unknown")
                    
                    subject = f"[INCIDENT ALERT] Observation Incident Logged: {obs_id} - {cat}"
                    body = (
                        f"HIGH PRIORITY INCIDENT ALERT\n\n"
                        f"An observation has been marked as an INCIDENT in DCM.\n\n"
                        f"Incident ID: {obs_id}\n"
                        f"Category: {cat}\n"
                        f"Observed Date & Time: {obs_date} {obs_time}\n"
                        f"Logged By: {logged_by}\n"
                        f"Description:\n{desc}\n\n"
                        f"Please take necessary action immediately."
                    )
                    html_body = f"""
                    <div style="font-family: Arial, sans-serif; padding: 20px; border: 2px solid #d32f2f; border-radius: 8px;">
                        <h2 style="color: #d32f2f; margin-top: 0;">🚨 HIGH PRIORITY INCIDENT ALERT</h2>
                        <p>An observation has been marked as an <strong>INCIDENT</strong> in DCM.</p>
                        <table style="border-collapse: collapse; width: 100%; margin-top: 15px;">
                            <tr style="background-color: #f8d7da;">
                                <td style="padding: 10px; border: 1px solid #f5c6cb; font-weight: bold; width: 30%;">Incident ID</td>
                                <td style="padding: 10px; border: 1px solid #f5c6cb; color: #721c24; font-weight: bold;">{obs_id}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Category</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">{cat}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Observed Date & Time</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">{obs_date} {obs_time}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Logged By</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">{logged_by}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Description</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">{desc}</td>
                            </tr>
                        </table>
                        <p style="margin-top: 20px; color: #555;">Please log into the DCM system to inspect and resolve this incident.</p>
                    </div>
                    """
                    asyncio.create_task(send_email(recipient_emails, subject, body, html_body))
        except Exception as mail_err:
            print(f"Failed to trigger incident email notification: {mail_err}")

    await enrich_observation(created_obs)
    return created_obs

@router.get("/{id}", response_description="Get a single observation", response_model=ObservationModel, response_model_by_alias=False, dependencies=[Depends(require_any_privilege(["View Observations", "View All Department Observations"]))])
async def show_observation(id: str):
    if ObjectId.is_valid(id):
        obs = await obs_collection.find_one({"_id": ObjectId(id)})
    else:
        obs = await obs_collection.find_one({"observationId": id})
        
    if obs is None:
        raise HTTPException(status_code=404, detail=f"Observation {id} not found")

    await enrich_observation(obs)
    return obs

@router.put("/{id}", response_description="Update an observation", response_model=ObservationModel, response_model_by_alias=False, dependencies=[Depends(require_privilege("Update Observation"))])
async def update_observation(
    id: str,
    observation: UpdateObservationModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    obs_dict = {k: v for k, v in observation.model_dump().items() if v is not None}
    
    if "status" in obs_dict:
        existing_obs = await obs_collection.find_one({"_id": ObjectId(id)})
        if existing_obs and existing_obs.get("status") != obs_dict["status"]:
            obs_dict["lastStatusUpdatedOn"] = datetime.now().isoformat()
    
    if len(obs_dict) >= 1:
        update_result = await obs_collection.update_one(
            {"_id": ObjectId(id)}, {"$set": obs_dict}
        )

        if update_result.modified_count == 1:
            if (updated_obs := await obs_collection.find_one({"_id": ObjectId(id)})) is not None:
                users_collection = db.get_collection("users")
                user_record = await users_collection.find_one({"username": current_user["sub"]})
                user_dept = user_record.get("department") if user_record else None

                from notification_helper import log_page_update
                await log_page_update("observations", department=user_dept, username=current_user.get("sub"))
                await enrich_observation(updated_obs)
                return updated_obs

    if (existing_obs := await obs_collection.find_one({"_id": ObjectId(id)})) is not None:
        await enrich_observation(existing_obs)
        return existing_obs

    raise HTTPException(status_code=404, detail=f"Observation {id} not found")

@router.delete("/{id}", response_description="Delete an observation", dependencies=[Depends(require_privilege("Delete Observation"))])
async def delete_observation(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    delete_result = await obs_collection.delete_one({"_id": ObjectId(id)})

    if delete_result.deleted_count == 1:
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    raise HTTPException(status_code=404, detail=f"Observation {id} not found")
