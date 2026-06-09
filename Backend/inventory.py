import os
from fastapi import APIRouter, HTTPException, status, Body, Query, Depends, UploadFile, File, Response
from auth_utils import require_privilege, get_current_user, require_any_privilege
from fastapi.responses import JSONResponse
from typing import Optional
from database import db
from models import (
    InventoryModel, CreateInventoryModel, UpdateInventoryModel, PaginatedInventoryModel, InventoryHistoryModel
)
from bson import ObjectId
from datetime import datetime
import openpyxl
import io
import csv

router = APIRouter()
inventory_collection = db.get_collection("inventory")

@router.get("/", response_description="List all inventory items", response_model=PaginatedInventoryModel, response_model_by_alias=False, dependencies=[Depends(require_any_privilege(["View All Inventory", "View Department Inventory"]))])
async def list_inventory(
    skip: int = Query(0, ge=0),
    pagination: bool = Query(True),
    limit: int = Query(10, ge=1),
    sortBy: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    order: str = Query("desc"),
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    is_superuser = current_user.get("isSuperuser", False)
    user_privileges = current_user.get("privileges", [])

    only_dept_scoped = not (is_superuser or "View All Inventory" in user_privileges)

    if only_dept_scoped:
        query["department"] = current_user.get("department") or "None"

    if search:
        query["$or"] = [
            {"itemName": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"lastUpdatedBy": {"$regex": search, "$options": "i"}},
        ]
        
    actual_sort_by = sortBy or sort_by or "lastUpdatedDate"
    sort_order = 1 if order == "asc" else -1
    
    total = await inventory_collection.count_documents(query)
    cursor = inventory_collection.find(query).sort(actual_sort_by, sort_order)
    if pagination:
        cursor = cursor.skip(skip).limit(limit)
        items = await cursor.to_list(length=limit)
    else:
        items = await cursor.to_list(length=None)
            
    return {"data": items, "total": total}

@router.post("/", response_description="Create a new inventory item", response_model=InventoryModel, status_code=status.HTTP_201_CREATED, response_model_by_alias=False)
async def create_inventory(item: CreateInventoryModel = Body(...), current_user: dict = Depends(require_privilege("Create Inventory"))):
    username = current_user.get("sub", "Unknown")
    user_dept = current_user.get("department", "General")
    
    history_entry = {
        "date": item.date,
        "action": "created",
        "quantityChange": item.quantity,
        "remainingQuantity": item.quantity,
        "user": username,
        "givenTo": None
    }
    
    inv_dict = {
        "itemName": item.itemName,
        "quantity": item.quantity,
        "description": item.description,
        "department": user_dept,
        "lastUpdatedDate": item.date,
        "lastUpdatedBy": username,
        "history": [history_entry]
    }
    
    new_inv = await inventory_collection.insert_one(inv_dict)
    created_inv = await inventory_collection.find_one({"_id": new_inv.inserted_id})
    
    from notification_helper import log_page_update
    await log_page_update("inventory", department=user_dept, username=current_user.get("sub"))

    return created_inv

@router.get("/{id}", response_description="Get a single inventory item", response_model=InventoryModel, response_model_by_alias=False)
async def show_inventory(id: str, current_user: dict = Depends(require_any_privilege(["View All Inventory", "View Department Inventory"]))):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")
        
    inv = await inventory_collection.find_one({"_id": ObjectId(id)})
    if inv is None:
        raise HTTPException(status_code=404, detail=f"Item {id} not found")

    is_superuser = current_user.get("isSuperuser", False)
    user_privileges = current_user.get("privileges", [])
    only_dept_scoped = not (is_superuser or "View All Inventory" in user_privileges)

    if only_dept_scoped and inv.get("department") != current_user.get("department"):
        raise HTTPException(status_code=403, detail="Access denied to this department's inventory item")

    return inv

@router.put("/{id}", response_description="Update an inventory item", response_model=InventoryModel, response_model_by_alias=False)
async def update_inventory(id: str, update_data: UpdateInventoryModel = Body(...), current_user: dict = Depends(require_privilege("Update Inventory"))):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    existing_inv = await inventory_collection.find_one({"_id": ObjectId(id)})
    if existing_inv is None:
        raise HTTPException(status_code=404, detail=f"Item {id} not found")

    is_superuser = current_user.get("isSuperuser", False)
    user_dept = current_user.get("department", "")
    if not is_superuser and user_dept and existing_inv.get("department") != user_dept:
        raise HTTPException(status_code=403, detail="Cannot update another department's inventory item")

    username = current_user.get("sub", "Unknown")
    new_quantity = existing_inv["quantity"] + update_data.quantityChange
    
    if new_quantity < 0:
        raise HTTPException(status_code=400, detail="Insufficient stock")
        
    history_entry = {
        "date": update_data.date,
        "action": update_data.action,
        "quantityChange": update_data.quantityChange,
        "remainingQuantity": new_quantity,
        "user": username,
        "givenTo": update_data.givenTo
    }
    
    update_result = await inventory_collection.update_one(
        {"_id": ObjectId(id)},
        {
            "$set": {
                "quantity": new_quantity,
                "lastUpdatedDate": update_data.date,
                "lastUpdatedBy": username
            },
            "$push": {
                "history": history_entry
            }
        }
    )

    updated_inv = await inventory_collection.find_one({"_id": ObjectId(id)})
    
    from notification_helper import log_page_update
    await log_page_update("inventory", department=updated_inv.get("department"), username=current_user.get("sub"))

    return updated_inv

@router.delete("/{id}", response_description="Delete an inventory item")
async def delete_inventory(id: str, current_user: dict = Depends(require_privilege("Delete Inventory"))):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    existing_inv = await inventory_collection.find_one({"_id": ObjectId(id)})
    if existing_inv is None:
        raise HTTPException(status_code=404, detail=f"Item {id} not found")

    is_superuser = current_user.get("isSuperuser", False)
    user_dept = current_user.get("department", "")
    if not is_superuser and user_dept and existing_inv.get("department") != user_dept:
        raise HTTPException(status_code=403, detail="Cannot delete another department's inventory item")

    delete_result = await inventory_collection.delete_one({"_id": ObjectId(id)})

    if delete_result.deleted_count == 1:
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    raise HTTPException(status_code=404, detail=f"Item {id} not found")

@router.post("/bulk", response_description="Bulk create inventory items")
async def bulk_create_inventory(file: UploadFile = File(...), current_user: dict = Depends(require_privilege("Create Inventory"))):
    username = current_user.get("sub", "Unknown")
    user_dept = current_user.get("department", "General")
    
    if not file.filename.endswith((".xlsx", ".csv")):
        raise HTTPException(status_code=400, detail="Only .xlsx or .csv files are supported")
        
    content = await file.read()
    items_to_insert = []
    current_time = datetime.utcnow().isoformat() + "Z"
    
    try:
        if file.filename.endswith(".xlsx"):
            wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
            sheet = wb.active
            rows = list(sheet.iter_rows(values_only=True))
            if not rows or len(rows) < 2:
                raise HTTPException(status_code=400, detail="Excel file is empty or missing headers")
                
            headers = [str(h).lower().strip() for h in rows[0]]
            
            name_idx = next((i for i, h in enumerate(headers) if "name" in h or "item" in h), -1)
            qty_idx = next((i for i, h in enumerate(headers) if "quant" in h or "qty" in h), -1)
            desc_idx = next((i for i, h in enumerate(headers) if "desc" in h or "remark" in h), -1)
            
            if name_idx == -1 or qty_idx == -1:
                raise HTTPException(status_code=400, detail="Could not find 'Name' and 'Quantity' columns")
                
            for row in rows[1:]:
                name = row[name_idx]
                qty = row[qty_idx]
                desc = row[desc_idx] if desc_idx != -1 else ""
                
                if not name:
                    continue
                    
                try:
                    qty_val = int(qty)
                except (ValueError, TypeError):
                    qty_val = 0
                    
                items_to_insert.append({
                    "itemName": str(name),
                    "quantity": qty_val,
                    "description": str(desc) if desc else "",
                    "department": user_dept,
                    "lastUpdatedDate": current_time,
                    "lastUpdatedBy": username,
                    "history": [{
                        "date": current_time,
                        "action": "created",
                        "quantityChange": qty_val,
                        "remainingQuantity": qty_val,
                        "user": username,
                        "givenTo": None
                    }]
                })
        else:
            # CSV parsing
            decoded = content.decode("utf-8")
            reader = csv.reader(decoded.splitlines())
            rows = list(reader)
            if not rows or len(rows) < 2:
                raise HTTPException(status_code=400, detail="CSV file is empty or missing headers")
                
            headers = [str(h).lower().strip() for h in rows[0]]
            
            name_idx = next((i for i, h in enumerate(headers) if "name" in h or "item" in h), -1)
            qty_idx = next((i for i, h in enumerate(headers) if "quant" in h or "qty" in h), -1)
            desc_idx = next((i for i, h in enumerate(headers) if "desc" in h or "remark" in h), -1)
            
            if name_idx == -1 or qty_idx == -1:
                raise HTTPException(status_code=400, detail="Could not find 'Name' and 'Quantity' columns")
                
            for row in rows[1:]:
                if len(row) <= max(name_idx, qty_idx):
                    continue
                name = row[name_idx]
                qty = row[qty_idx]
                desc = row[desc_idx] if desc_idx != -1 and len(row) > desc_idx else ""
                
                if not name:
                    continue
                    
                try:
                    qty_val = int(qty)
                except (ValueError, TypeError):
                    qty_val = 0
                    
                items_to_insert.append({
                    "itemName": str(name),
                    "quantity": qty_val,
                    "description": str(desc) if desc else "",
                    "department": user_dept,
                    "lastUpdatedDate": current_time,
                    "lastUpdatedBy": username,
                    "history": [{
                        "date": current_time,
                        "action": "created",
                        "quantityChange": qty_val,
                        "remainingQuantity": qty_val,
                        "user": username,
                        "givenTo": None
                    }]
                })
                
        if items_to_insert:
            await inventory_collection.insert_many(items_to_insert)
            
        return {"message": f"Successfully created {len(items_to_insert)} items"}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing file: {str(e)}")
