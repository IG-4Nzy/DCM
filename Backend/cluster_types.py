from fastapi import APIRouter, HTTPException, status, Body, Query, Depends, Response, UploadFile, File
from auth_utils import require_privilege, require_any_privilege, get_current_user
from fastapi.responses import JSONResponse
from typing import Optional, List
from database import db
from models import ClusterTypeModel, CreateClusterTypeModel, UpdateClusterTypeModel, PaginatedClusterTypesModel
from bson import ObjectId
from datetime import datetime, timezone
import openpyxl
import io
import csv

router = APIRouter()
cluster_types_collection = db.get_collection("cluster_types")

@router.get("/", response_description="List all cluster types", response_model=PaginatedClusterTypesModel, response_model_by_alias=False, dependencies=[Depends(require_privilege("View Configurations"))])
async def list_cluster_types(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1),
    pagination: bool = Query(True),
    search: Optional[str] = None,
    sortBy: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    order: str = Query("asc")
):
    query = {}
    
    if search:
        query = {
            "clusterType": {"$regex": search, "$options": "i"}
        }

    actual_sort_by = sortBy or sort_by or "clusterType"
    sort_order = 1 if order == "asc" else -1

    total = await cluster_types_collection.count_documents(query)
    cursor = cluster_types_collection.find(query).sort(actual_sort_by, sort_order)
    
    if pagination:
        cursor = cursor.skip(skip).limit(limit)
        cluster_types = await cursor.to_list(length=limit)
    else:
        cluster_types = await cursor.to_list(length=None)

    return {"data": cluster_types, "total": total}

@router.post("/", response_description="Create a cluster type", response_model=ClusterTypeModel, status_code=status.HTTP_201_CREATED, response_model_by_alias=False, dependencies=[Depends(require_any_privilege(["Create Configuration", "Create Server Details"]))])
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

@router.put("/{id}", response_description="Update a cluster type", response_model=ClusterTypeModel, response_model_by_alias=False, dependencies=[Depends(require_any_privilege(["Update Configurations", "Update Server Details"]))])
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
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    raise HTTPException(status_code=404, detail=f"Cluster type {id} not found")

@router.post("/bulk", response_description="Bulk create cluster types", dependencies=[Depends(require_any_privilege(["Create Configuration", "Create Server Details"]))])
async def bulk_create_cluster_types(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    username = current_user.get("sub", "Unknown")
    
    if not file.filename.endswith((".xlsx", ".csv")):
        raise HTTPException(status_code=400, detail="Only .xlsx or .csv files are supported")
        
    content = await file.read()
    items_to_insert = []
    current_time = datetime.now(timezone.utc).isoformat()
    
    try:
        seen_names = set()
        if file.filename.endswith(".xlsx"):
            wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
            sheet = wb.active
            rows = list(sheet.iter_rows(values_only=True))
            if not rows or len(rows) < 2:
                raise HTTPException(status_code=400, detail="Excel file is empty or missing headers")
                
            headers = [str(h).lower().strip() for h in rows[0]]
            
            name_idx = next((i for i, h in enumerate(headers) if "type" in h or "cluster" in h), -1)
            remarks_idx = next((i for i, h in enumerate(headers) if "remark" in h), -1)
            
            if name_idx == -1:
                raise HTTPException(status_code=400, detail="Could not find 'Cluster Type' column")
                
            for row in rows[1:]:
                name = row[name_idx]
                remarks = row[remarks_idx] if remarks_idx != -1 else ""
                
                if not name:
                    continue
                
                name_str = str(name).strip()
                name_lower = name_str.lower()
                
                if name_lower in seen_names:
                    raise HTTPException(status_code=400, detail=f"Duplicate cluster type '{name_str}' found in the file")
                seen_names.add(name_lower)
                
                existing = await cluster_types_collection.find_one({"clusterType": {"$regex": f"^{name_str}$", "$options": "i"}})
                if existing:
                    raise HTTPException(status_code=400, detail=f"Cluster type '{name_str}' already exists")
                    
                items_to_insert.append({
                    "clusterType": name_str,
                    "remarks": str(remarks).strip() if remarks else "",
                    "createdBy": username,
                    "updatedAt": current_time
                })
        else:
            decoded = content.decode("utf-8")
            reader = csv.reader(decoded.splitlines())
            rows = list(reader)
            if not rows or len(rows) < 2:
                raise HTTPException(status_code=400, detail="CSV file is empty or missing headers")
                
            headers = [str(h).lower().strip() for h in rows[0]]
            
            name_idx = next((i for i, h in enumerate(headers) if "type" in h or "cluster" in h), -1)
            remarks_idx = next((i for i, h in enumerate(headers) if "remark" in h), -1)
            
            if name_idx == -1:
                raise HTTPException(status_code=400, detail="Could not find 'Cluster Type' column")
                
            for row in rows[1:]:
                if len(row) <= name_idx:
                    continue
                name = row[name_idx]
                remarks = row[remarks_idx] if remarks_idx != -1 and len(row) > remarks_idx else ""
                
                if not name:
                    continue
                
                name_str = str(name).strip()
                name_lower = name_str.lower()
                
                if name_lower in seen_names:
                    raise HTTPException(status_code=400, detail=f"Duplicate cluster type '{name_str}' found in the file")
                seen_names.add(name_lower)
                
                existing = await cluster_types_collection.find_one({"clusterType": {"$regex": f"^{name_str}$", "$options": "i"}})
                if existing:
                    raise HTTPException(status_code=400, detail=f"Cluster type '{name_str}' already exists")
                    
                items_to_insert.append({
                    "clusterType": name_str,
                    "remarks": str(remarks).strip() if remarks else "",
                    "createdBy": username,
                    "updatedAt": current_time
                })
                
        if items_to_insert:
            await cluster_types_collection.insert_many(items_to_insert)
            
        return {"message": f"Successfully created {len(items_to_insert)} cluster types"}
        
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing file: {str(e)}")
