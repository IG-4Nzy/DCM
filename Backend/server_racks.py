from fastapi import APIRouter, HTTPException, status, Body, Query, Depends, Response, UploadFile, File
from auth_utils import require_privilege, get_current_user
from fastapi.responses import JSONResponse
from typing import Optional, List
from database import db
from models import ServerRackModel, CreateServerRackModel, UpdateServerRackModel, PaginatedServerRacksModel
from bson import ObjectId
from datetime import datetime, timezone
import openpyxl
import io
import csv

router = APIRouter()
collection = db.get_collection("server_racks")

async def compute_remaining_capacity(rack_doc: dict):
    if not rack_doc:
        return rack_doc
    rack_name = rack_doc.get("serverRack", "")
    nodes_collection = db.get_collection("nodes")
    cursor = nodes_collection.find({"rack": {"$regex": f"^{rack_name}$", "$options": "i"}})
    nodes = await cursor.to_list(length=None)
    used_units = sum(n.get("rackUnits") or 0 for n in nodes)
    total_capacity = rack_doc.get("rackCapacity")
    if total_capacity is not None:
        rack_doc["remainingCapacity"] = max(0, total_capacity - used_units)
    else:
        rack_doc["remainingCapacity"] = None
    return rack_doc

@router.get("/", response_description="List all server racks", response_model=PaginatedServerRacksModel, response_model_by_alias=False, dependencies=[Depends(require_privilege("Create Server Details"))])
async def list_items(
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
            "serverRack": {"$regex": search, "$options": "i"}
        }

    actual_sort_by = sortBy or sort_by or "serverRack"
    sort_order = 1 if order == "asc" else -1

    total = await collection.count_documents(query)
    cursor = collection.find(query).sort(actual_sort_by, sort_order)
    
    if pagination:
        cursor = cursor.skip(skip).limit(limit)
        items = await cursor.to_list(length=limit)
    else:
        items = await cursor.to_list(length=None)

    items = [await compute_remaining_capacity(item) for item in items]

    return {"data": items, "total": total}

@router.post("/", response_description="Create a serverRack", response_model=ServerRackModel, status_code=status.HTTP_201_CREATED, response_model_by_alias=False, dependencies=[Depends(require_privilege("Create Server Details"))])
async def create_item(
    payload: CreateServerRackModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    existing = await collection.find_one({ "serverRack": {"$regex": f"^{getattr(payload, 'serverRack')}$", "$options": "i"} })
    if existing:
        raise HTTPException(status_code=400, detail="Server Rack already exists")

    item_dict = payload.model_dump()
    item_dict["createdBy"] = current_user.get("sub", "")
    item_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()

    new_item = await collection.insert_one(item_dict)
    created = await collection.find_one({"_id": new_item.inserted_id})
    return await compute_remaining_capacity(created)

@router.put("/{id}", response_description="Update a serverRack", response_model=ServerRackModel, response_model_by_alias=False, dependencies=[Depends(require_privilege("Create Server Details"))])
async def update_item(id: str, payload: UpdateServerRackModel = Body(...)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    item_dict = {k: v for k, v in payload.model_dump().items() if v is not None}

    if len(item_dict) >= 1:
        if "serverRack" in item_dict:
            existing = await collection.find_one({
                "serverRack": {"$regex": f"^{item_dict['serverRack']}$", "$options": "i"},
                "_id": {"$ne": ObjectId(id)}
            })
            if existing:
                raise HTTPException(status_code=400, detail="Server Rack already exists")

        item_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()
        
        update_result = await collection.update_one(
            {"_id": ObjectId(id)}, {"$set": item_dict}
        )

        if update_result.modified_count == 1:
            if (updated := await collection.find_one({"_id": ObjectId(id)})) is not None:
                return await compute_remaining_capacity(updated)

    if (existing := await collection.find_one({"_id": ObjectId(id)})) is not None:
        return await compute_remaining_capacity(existing)

    raise HTTPException(status_code=404, detail=f"Server Rack {id} not found")

@router.delete("/{id}", response_description="Delete a serverRack", dependencies=[Depends(require_privilege("Create Server Details"))])
async def delete_item(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    delete_result = await collection.delete_one({"_id": ObjectId(id)})

    if delete_result.deleted_count == 1:
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    raise HTTPException(status_code=404, detail=f"Server Rack {id} not found")

@router.post("/bulk", response_description="Bulk create server racks", dependencies=[Depends(require_privilege("Create Server Details"))])
async def bulk_create_server_racks(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
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
            
            name_idx = next((i for i, h in enumerate(headers) if "rack" in h), -1)
            remarks_idx = next((i for i, h in enumerate(headers) if "remark" in h), -1)
            
            if name_idx == -1:
                raise HTTPException(status_code=400, detail="Could not find 'Server Rack' column")
                
            for row in rows[1:]:
                name = row[name_idx]
                remarks = row[remarks_idx] if remarks_idx != -1 else ""
                
                if not name:
                    continue
                
                name_str = str(name).strip()
                name_lower = name_str.lower()
                
                if name_lower in seen_names:
                    raise HTTPException(status_code=400, detail=f"Duplicate server rack '{name_str}' found in the file")
                seen_names.add(name_lower)
                
                existing = await collection.find_one({"serverRack": {"$regex": f"^{name_str}$", "$options": "i"}})
                if existing:
                    raise HTTPException(status_code=400, detail=f"Server Rack '{name_str}' already exists")
                    
                items_to_insert.append({
                    "serverRack": name_str,
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
            
            name_idx = next((i for i, h in enumerate(headers) if "rack" in h), -1)
            remarks_idx = next((i for i, h in enumerate(headers) if "remark" in h), -1)
            
            if name_idx == -1:
                raise HTTPException(status_code=400, detail="Could not find 'Server Rack' column")
                
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
                    raise HTTPException(status_code=400, detail=f"Duplicate server rack '{name_str}' found in the file")
                seen_names.add(name_lower)
                
                existing = await collection.find_one({"serverRack": {"$regex": f"^{name_str}$", "$options": "i"}})
                if existing:
                    raise HTTPException(status_code=400, detail=f"Server Rack '{name_str}' already exists")
                    
                items_to_insert.append({
                    "serverRack": name_str,
                    "remarks": str(remarks).strip() if remarks else "",
                    "createdBy": username,
                    "updatedAt": current_time
                })
                
        if items_to_insert:
            await collection.insert_many(items_to_insert)
            
        return {"message": f"Successfully created {len(items_to_insert)} server racks"}
        
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing file: {str(e)}")
