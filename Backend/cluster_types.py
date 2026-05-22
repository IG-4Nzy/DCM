from fastapi import APIRouter, HTTPException, status, Body, Query, Depends
from auth_utils import require_privilege, get_current_user
from fastapi.responses import JSONResponse
from typing import Optional, List
from database import db
from models import ClusterTypeModel, CreateClusterTypeModel, UpdateClusterTypeModel, PaginatedClusterTypesModel
from bson import ObjectId
from datetime import datetime, timezone

router = APIRouter()
cluster_types_collection = db.get_collection("cluster_types")

@router.get("/", response_description="List all cluster types", response_model=PaginatedClusterTypesModel, response_model_by_alias=False, dependencies=[Depends(require_privilege("View Configurations"))])
async def list_cluster_types(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1),
    pagination: bool = Query(True),
    search: Optional[str] = None
):
    query = {}
    
    if search:
        query = {
            "clusterType": {"$regex": search, "$options": "i"}
        }

    total = await cluster_types_collection.count_documents(query)
    cursor = cluster_types_collection.find(query).sort("clusterType", 1)
    
    if pagination:
        cursor = cursor.skip(skip).limit(limit)
        cluster_types = await cursor.to_list(length=limit)
    else:
        cluster_types = await cursor.to_list(length=None)

    return {"data": cluster_types, "total": total}

@router.post("/", response_description="Create a cluster type", response_model=ClusterTypeModel, status_code=status.HTTP_201_CREATED, response_model_by_alias=False, dependencies=[Depends(require_privilege("Create Configuration"))])
async def create_cluster_type(
    cluster_type: CreateClusterTypeModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    existing = await cluster_types_collection.find_one({"clusterType": {"$regex": f"^{cluster_type.clusterType}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=400, detail="Cluster type already exists")

    ct_dict = cluster_type.model_dump()
    ct_dict["createdBy"] = current_user.get("sub", "")
    ct_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()

    new_ct = await cluster_types_collection.insert_one(ct_dict)
    created = await cluster_types_collection.find_one({"_id": new_ct.inserted_id})
    return created

@router.put("/{id}", response_description="Update a cluster type", response_model=ClusterTypeModel, response_model_by_alias=False, dependencies=[Depends(require_privilege("Update Configurations"))])
async def update_cluster_type(id: str, cluster_type: UpdateClusterTypeModel = Body(...)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    ct_dict = {k: v for k, v in cluster_type.model_dump().items() if v is not None}

    if len(ct_dict) >= 1:
        if "clusterType" in ct_dict:
            existing = await cluster_types_collection.find_one({
                "clusterType": {"$regex": f"^{ct_dict['clusterType']}$", "$options": "i"},
                "_id": {"$ne": ObjectId(id)}
            })
            if existing:
                raise HTTPException(status_code=400, detail="Cluster type already exists")

        ct_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()
        
        update_result = await cluster_types_collection.update_one(
            {"_id": ObjectId(id)}, {"$set": ct_dict}
        )

        if update_result.modified_count == 1:
            if (updated := await cluster_types_collection.find_one({"_id": ObjectId(id)})) is not None:
                return updated

    if (existing := await cluster_types_collection.find_one({"_id": ObjectId(id)})) is not None:
        return existing

    raise HTTPException(status_code=404, detail=f"Cluster type {id} not found")

@router.delete("/{id}", response_description="Delete a cluster type", dependencies=[Depends(require_privilege("Delete Configurations"))])
async def delete_cluster_type(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    delete_result = await cluster_types_collection.delete_one({"_id": ObjectId(id)})

    if delete_result.deleted_count == 1:
        return JSONResponse(status_code=status.HTTP_204_NO_CONTENT)

    raise HTTPException(status_code=404, detail=f"Cluster type {id} not found")
