import os
from fastapi import APIRouter, HTTPException, status, Body, Query, Depends
from auth_utils import require_privilege, get_current_user
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
    limit: int = Query(100, ge=1),
    search: Optional[str] = None
):
    query = {}
    if search:
        query = {"name": {"$regex": search, "$options": "i"}}
        
    total = await categories_collection.count_documents(query)
    cursor = categories_collection.find(query).skip(skip).limit(limit)
    categories = await cursor.to_list(length=limit)
            
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
        return JSONResponse(status_code=status.HTTP_204_NO_CONTENT)
    raise HTTPException(status_code=404, detail=f"Category {id} not found")

@router.get("/", response_description="List all observations", response_model=PaginatedObservationsModel, response_model_by_alias=False)
async def list_observations(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1),
    sort_by: str = Query("observationId"),
    order: str = Query("desc"),
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    date_filter: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    is_superuser = current_user.get("isSuperuser", False)
    privileges = current_user.get("privileges", [])
    
    if not is_superuser and "View Observations" not in privileges:
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
        query["observedDate"] = date_filter
        
    if not is_superuser:
        users_collection = db.get_collection("users")
        current_user_record = await users_collection.find_one({"username": current_user["sub"]})
        if current_user_record and current_user_record.get("department"):
            dept = current_user_record["department"]
            dept_users = await users_collection.find({"department": dept}).to_list(length=None)
            dept_usernames = [u["username"] for u in dept_users]
            query["loggedBy"] = {"$in": dept_usernames}
        else:
            query["loggedBy"] = current_user["sub"]

    sort_order = 1 if order == "asc" else -1
    
    total = await obs_collection.count_documents(query)
    cursor = obs_collection.find(query).sort(sort_by, sort_order).skip(skip).limit(limit)
    observations = await cursor.to_list(length=limit)
            
    return {"data": observations, "total": total}

@router.post("/", response_description="Create a new observation", response_model=ObservationModel, status_code=status.HTTP_201_CREATED, response_model_by_alias=False, dependencies=[Depends(require_privilege("Create Observation"))])
async def create_observation(observation: CreateObservationModel = Body(...)):
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
    
    new_obs = await obs_collection.insert_one(obs_dict)
    created_obs = await obs_collection.find_one({"_id": new_obs.inserted_id})
    return created_obs

@router.get("/{id}", response_description="Get a single observation", response_model=ObservationModel, response_model_by_alias=False, dependencies=[Depends(require_privilege("View Observations"))])
async def show_observation(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")
        
    obs = await obs_collection.find_one({"_id": ObjectId(id)})
    if obs is None:
        raise HTTPException(status_code=404, detail=f"Observation {id} not found")

    return obs

@router.put("/{id}", response_description="Update an observation", response_model=ObservationModel, response_model_by_alias=False, dependencies=[Depends(require_privilege("Update Observation"))])
async def update_observation(id: str, observation: UpdateObservationModel = Body(...)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    obs_dict = {k: v for k, v in observation.model_dump().items() if v is not None}
    
    if len(obs_dict) >= 1:
        update_result = await obs_collection.update_one(
            {"_id": ObjectId(id)}, {"$set": obs_dict}
        )

        if update_result.modified_count == 1:
            if (updated_obs := await obs_collection.find_one({"_id": ObjectId(id)})) is not None:
                return updated_obs

    if (existing_obs := await obs_collection.find_one({"_id": ObjectId(id)})) is not None:
        return existing_obs

    raise HTTPException(status_code=404, detail=f"Observation {id} not found")

@router.delete("/{id}", response_description="Delete an observation", dependencies=[Depends(require_privilege("Delete Observation"))])
async def delete_observation(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    delete_result = await obs_collection.delete_one({"_id": ObjectId(id)})

    if delete_result.deleted_count == 1:
        return JSONResponse(status_code=status.HTTP_204_NO_CONTENT)

    raise HTTPException(status_code=404, detail=f"Observation {id} not found")
