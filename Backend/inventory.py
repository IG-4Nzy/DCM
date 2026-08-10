import os
import re
from fastapi import APIRouter, HTTPException, status, Body, Query, Depends, UploadFile, File, Response
from auth_utils import require_privilege, get_current_user, require_any_privilege
from fastapi.responses import JSONResponse
from typing import Optional
from database import db
from models import (
    InventoryModel, CreateInventoryModel, UpdateInventoryModel, EditInventoryModel, PaginatedInventoryModel, InventoryHistoryModel,
    InventoryGiveModel, InventoryReturnModel
)
from bson import ObjectId
from datetime import datetime
import openpyxl
import io
import csv

router = APIRouter()
inventory_collection = db.get_collection("inventory")

def match_dept(dept1, dept2) -> bool:
    if dept1 is None or dept2 is None:
        return False
    return str(dept1).strip() == str(dept2).strip()

async def resolve_departments(items):
    if items is None:
        return items
    is_list = isinstance(items, list)
    docs = items if is_list else [items]
    
    dept_ids = []
    for doc in docs:
        d = doc.get("department")
        if d:
            if isinstance(d, ObjectId):
                dept_ids.append(d)
            elif ObjectId.is_valid(str(d)):
                dept_ids.append(ObjectId(str(d)))
                
    if dept_ids:
        departments_col = db.get_collection("departments")
        depts = await departments_col.find({"_id": {"$in": dept_ids}}).to_list(length=None)
        dept_map = {str(d["_id"]): d["name"] for d in depts}
        
        for doc in docs:
            d = doc.get("department")
            if d:
                d_str = str(d)
                if d_str in dept_map:
                    doc["department"] = dept_map[d_str]
                elif isinstance(d, ObjectId):
                    doc["department"] = d_str
                    
    return docs if is_list else docs[0]

@router.get("/", response_description="List all inventory items", response_model=PaginatedInventoryModel, response_model_by_alias=False, dependencies=[Depends(require_any_privilege(["View All Inventory", "View Department Inventory"]))])
async def list_inventory(
    skip: int = Query(0, ge=0),
    pagination: bool = Query(True),
    limit: int = Query(10, ge=1),
    sortBy: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    order: str = Query("desc"),
    search: Optional[str] = None,
    isReturnable: Optional[bool] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    query = {}
    is_superuser = current_user.get("isSuperuser", False)
    user_privileges = current_user.get("privileges", [])

    only_dept_scoped = not (is_superuser or "View All Inventory" in user_privileges)

    if only_dept_scoped:
        user_dept = current_user.get("department") or "None"
        if ObjectId.is_valid(user_dept):
            query["department"] = {"$in": [ObjectId(user_dept), user_dept]}
        else:
            query["department"] = user_dept

    if isReturnable is not None:
        if isReturnable:
            query["isReturnable"] = True
        else:
            query["isReturnable"] = {"$ne": True}

    if search:
        terms = search.strip().split()
        if terms:
            term_queries = []
            departments_col = db.get_collection("departments")
            for term in terms:
                escaped_term = re.escape(term)
                # Find matching department IDs
                matching_depts = await departments_col.find({"name": {"$regex": escaped_term, "$options": "i"}}).to_list(length=None)
                dept_ids = []
                for d in matching_depts:
                    dept_ids.append(d["_id"])
                    dept_ids.append(str(d["_id"]))
                
                or_clause = [
                    {"itemName": {"$regex": escaped_term, "$options": "i"}},
                    {"description": {"$regex": escaped_term, "$options": "i"}},
                    {"lastUpdatedBy": {"$regex": escaped_term, "$options": "i"}},
                    {"department": {"$regex": escaped_term, "$options": "i"}},
                    {"almiraNumber": {"$regex": escaped_term, "$options": "i"}},
                    {"rackNumber": {"$regex": escaped_term, "$options": "i"}},
                    {"history.givenTo": {"$regex": escaped_term, "$options": "i"}},
                    {"history.user": {"$regex": escaped_term, "$options": "i"}},
                ]
                if dept_ids:
                    or_clause.append({"department": {"$in": dept_ids}})
                term_queries.append({"$or": or_clause})
            query["$and"] = term_queries
        
    actual_sort_by = sortBy or sort_by or "lastUpdatedDate"
    sort_order = 1 if order == "asc" else -1
    
    total = await inventory_collection.count_documents(query)
    cursor = inventory_collection.find(query).sort(actual_sort_by, sort_order)
    if pagination:
        cursor = cursor.skip(skip).limit(limit)
        items = await cursor.to_list(length=limit)
    else:
        items = await cursor.to_list(length=None)
            
    items = await resolve_departments(items)
    return {"data": items, "total": total}

@router.post("/", response_description="Create a new inventory item", response_model=InventoryModel, status_code=status.HTTP_201_CREATED, response_model_by_alias=False)
async def create_inventory(item: CreateInventoryModel = Body(...), current_user: dict = Depends(require_privilege("Create Inventory"))):
    username = current_user.get("sub", "Unknown")
    user_dept = current_user.get("department", "General")
    dept_val = ObjectId(user_dept) if ObjectId.is_valid(user_dept) else user_dept
    
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
        "department": dept_val,
        "lastUpdatedDate": item.date,
        "lastUpdatedBy": username,
        "history": [history_entry],
        "isReturnable": item.isReturnable or False,
        "currentHolders": [],
        "almiraNumber": item.almiraNumber,
        "rackNumber": item.rackNumber
    }
    
    new_inv = await inventory_collection.insert_one(inv_dict)
    created_inv = await inventory_collection.find_one({"_id": new_inv.inserted_id})
    created_inv = await resolve_departments(created_inv)
    
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

    if only_dept_scoped and not match_dept(inv.get("department"), current_user.get("department")):
        raise HTTPException(status_code=403, detail="Access denied to this department's inventory item")

    inv = await resolve_departments(inv)
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
    user_privileges = current_user.get("privileges", [])
    has_view_all = "View All Inventory" in user_privileges

    if not is_superuser and not has_view_all and user_dept and not match_dept(existing_inv.get("department"), user_dept):
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
    updated_inv = await resolve_departments(updated_inv)
    
    from notification_helper import log_page_update
    await log_page_update("inventory", department=user_dept, username=current_user.get("sub"))

    return updated_inv

@router.put("/{id}/edit", response_description="Edit general inventory item details", response_model=InventoryModel, response_model_by_alias=False)
async def edit_inventory_item(id: str, edit_data: EditInventoryModel = Body(...), current_user: dict = Depends(require_privilege("Update Inventory"))):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    existing_inv = await inventory_collection.find_one({"_id": ObjectId(id)})
    if existing_inv is None:
        raise HTTPException(status_code=404, detail=f"Item {id} not found")

    is_superuser = current_user.get("isSuperuser", False)
    user_dept = current_user.get("department", "")
    user_privileges = current_user.get("privileges", [])
    has_view_all = "View All Inventory" in user_privileges

    if not is_superuser and not has_view_all and user_dept and not match_dept(existing_inv.get("department"), user_dept):
        raise HTTPException(status_code=403, detail="Cannot edit another department's inventory item")

    if edit_data.quantity < 0:
        raise HTTPException(status_code=400, detail="Quantity cannot be negative")

    current_holders = existing_inv.get("currentHolders", [])
    if edit_data.quantity < len(current_holders):
        raise HTTPException(
            status_code=400,
            detail=f"Quantity cannot be less than the number of checked out items ({len(current_holders)})"
        )

    username = current_user.get("sub", "Unknown")
    quantity_diff = edit_data.quantity - existing_inv.get("quantity", 0)
    current_time = datetime.utcnow().isoformat() + "Z"

    update_fields = {
        "itemName": edit_data.itemName,
        "quantity": edit_data.quantity,
        "description": edit_data.description,
        "isReturnable": edit_data.isReturnable,
        "almiraNumber": edit_data.almiraNumber,
        "rackNumber": edit_data.rackNumber,
        "lastUpdatedDate": current_time,
        "lastUpdatedBy": username
    }

    update_query = {"$set": update_fields}

    if quantity_diff != 0:
        history_entry = {
            "date": current_time,
            "action": "add" if quantity_diff > 0 else "subtract",
            "quantityChange": quantity_diff,
            "remainingQuantity": edit_data.quantity,
            "user": username,
            "givenTo": None
        }
        update_query["$push"] = {"history": history_entry}

    await inventory_collection.update_one({"_id": ObjectId(id)}, update_query)
    updated_inv = await inventory_collection.find_one({"_id": ObjectId(id)})
    updated_inv = await resolve_departments(updated_inv)

    from notification_helper import log_page_update
    await log_page_update("inventory", department=user_dept, username=current_user.get("sub"))

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
    user_privileges = current_user.get("privileges", [])
    has_view_all = "View All Inventory" in user_privileges

    if not is_superuser and not has_view_all and user_dept and not match_dept(existing_inv.get("department"), user_dept):
        raise HTTPException(status_code=403, detail="Cannot delete another department's inventory item")

    delete_result = await inventory_collection.delete_one({"_id": ObjectId(id)})

    if delete_result.deleted_count == 1:
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    raise HTTPException(status_code=404, detail=f"Item {id} not found")

@router.post("/bulk", response_description="Bulk create inventory items")
async def bulk_create_inventory(file: UploadFile = File(...), current_user: dict = Depends(require_privilege("Create Inventory"))):
    username = current_user.get("sub", "Unknown")
    user_dept = current_user.get("department", "General")
    dept_val = ObjectId(user_dept) if ObjectId.is_valid(user_dept) else user_dept
    
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
            almira_idx = next((i for i, h in enumerate(headers) if "almira" in h or "almirah" in h), -1)
            rack_idx = next((i for i, h in enumerate(headers) if "rack" in h), -1)
            
            if name_idx == -1 or qty_idx == -1:
                raise HTTPException(status_code=400, detail="Could not find 'Name' and 'Quantity' columns")
                
            for row in rows[1:]:
                name = row[name_idx]
                qty = row[qty_idx]
                desc = row[desc_idx] if desc_idx != -1 else ""
                almira_val = str(row[almira_idx]) if almira_idx != -1 and row[almira_idx] is not None else ""
                rack_val = str(row[rack_idx]) if rack_idx != -1 and row[rack_idx] is not None else ""
                
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
                    "department": dept_val,
                    "lastUpdatedDate": current_time,
                    "lastUpdatedBy": username,
                    "history": [{
                        "date": current_time,
                        "action": "created",
                        "quantityChange": qty_val,
                        "remainingQuantity": qty_val,
                        "user": username,
                        "givenTo": None
                    }],
                    "isReturnable": False,
                    "currentHolders": [],
                    "almiraNumber": almira_val,
                    "rackNumber": rack_val
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
            almira_idx = next((i for i, h in enumerate(headers) if "almira" in h or "almirah" in h), -1)
            rack_idx = next((i for i, h in enumerate(headers) if "rack" in h), -1)
            
            if name_idx == -1 or qty_idx == -1:
                raise HTTPException(status_code=400, detail="Could not find 'Name' and 'Quantity' columns")
                
            for row in rows[1:]:
                if len(row) <= max(name_idx, qty_idx):
                    continue
                name = row[name_idx]
                qty = row[qty_idx]
                desc = row[desc_idx] if desc_idx != -1 and len(row) > desc_idx else ""
                almira_val = str(row[almira_idx]) if almira_idx != -1 and len(row) > almira_idx and row[almira_idx] is not None else ""
                rack_val = str(row[rack_idx]) if rack_idx != -1 and len(row) > rack_idx and row[rack_idx] is not None else ""
                
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
                    "department": dept_val,
                    "lastUpdatedDate": current_time,
                    "lastUpdatedBy": username,
                    "history": [{
                        "date": current_time,
                        "action": "created",
                        "quantityChange": qty_val,
                        "remainingQuantity": qty_val,
                        "user": username,
                        "givenTo": None
                    }],
                    "isReturnable": False,
                    "currentHolders": [],
                    "almiraNumber": almira_val,
                    "rackNumber": rack_val
                })
                
        if items_to_insert:
            await inventory_collection.insert_many(items_to_insert)
            
        return {"message": f"Successfully created {len(items_to_insert)} items"}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing file: {str(e)}")

@router.put("/{id}/give", response_description="Give inventory item to user", response_model=InventoryModel, response_model_by_alias=False)
async def give_inventory_item(id: str, give_data: InventoryGiveModel = Body(...), current_user: dict = Depends(require_privilege("Update Inventory"))):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    existing_inv = await inventory_collection.find_one({"_id": ObjectId(id)})
    if existing_inv is None:
        raise HTTPException(status_code=404, detail=f"Item {id} not found")

    is_superuser = current_user.get("isSuperuser", False)
    user_dept = current_user.get("department", "")
    user_privileges = current_user.get("privileges", [])
    has_view_all = "View All Inventory" in user_privileges

    if not is_superuser and not has_view_all and user_dept and not match_dept(existing_inv.get("department"), user_dept):
        raise HTTPException(status_code=403, detail="Cannot update another department's inventory item")

    total_qty = existing_inv.get("quantity", 0)
    give_qty = give_data.quantity if hasattr(give_data, "quantity") and give_data.quantity is not None else 1
    if give_qty <= 0:
        raise HTTPException(status_code=400, detail="Quantity to give must be greater than 0")

    if total_qty < give_qty:
        raise HTTPException(status_code=400, detail="Insufficient quantity available in inventory")

    username = current_user.get("sub", "Unknown")
    new_holders = []
    
    if existing_inv.get("isReturnable"):
        for _ in range(give_qty):
            session_id = str(ObjectId())
            new_holders.append({
                "id": session_id,
                "givenTo": give_data.givenTo,
                "givenDate": give_data.date,
                "givenBy": username
            })

    new_quantity = total_qty - give_qty

    history_entry = {
        "date": give_data.date,
        "action": "given",
        "quantityChange": -give_qty,
        "remainingQuantity": new_quantity,
        "user": username,
        "givenTo": give_data.givenTo
    }

    update_query = {
        "$set": {
            "quantity": new_quantity,
            "lastUpdatedDate": give_data.date,
            "lastUpdatedBy": username
        },
        "$push": {
            "history": history_entry
        }
    }

    if new_holders:
        update_query["$push"]["currentHolders"] = {"$each": new_holders}

    await inventory_collection.update_one({"_id": ObjectId(id)}, update_query)
    updated_inv = await inventory_collection.find_one({"_id": ObjectId(id)})
    updated_inv = await resolve_departments(updated_inv)
    return updated_inv

@router.put("/{id}/return", response_description="Return a returnable inventory item", response_model=InventoryModel, response_model_by_alias=False)
async def return_inventory_item(id: str, return_data: InventoryReturnModel = Body(...), current_user: dict = Depends(require_privilege("Update Inventory"))):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    existing_inv = await inventory_collection.find_one({"_id": ObjectId(id)})
    if existing_inv is None:
        raise HTTPException(status_code=404, detail=f"Item {id} not found")

    is_superuser = current_user.get("isSuperuser", False)
    user_dept = current_user.get("department", "")
    user_privileges = current_user.get("privileges", [])
    has_view_all = "View All Inventory" in user_privileges

    if not is_superuser and not has_view_all and user_dept and not match_dept(existing_inv.get("department"), user_dept):
        raise HTTPException(status_code=403, detail="Cannot update another department's inventory item")

    current_holders = existing_inv.get("currentHolders", [])
    holder = next((h for h in current_holders if h["id"] == return_data.holderId), None)
    if not holder:
        raise HTTPException(status_code=404, detail="Holder checkout session not found for this item")

    username = current_user.get("sub", "Unknown")
    total_qty = existing_inv.get("quantity", 0)
    new_quantity = total_qty + 1

    history_entry = {
        "date": return_data.date,
        "action": "returned",
        "quantityChange": 1,
        "remainingQuantity": new_quantity,
        "user": username,
        "givenTo": holder["givenTo"]
    }

    await inventory_collection.update_one(
        {"_id": ObjectId(id)},
        {
            "$pull": {
                "currentHolders": {"id": return_data.holderId}
            },
            "$set": {
                "quantity": new_quantity,
                "lastUpdatedDate": return_data.date,
                "lastUpdatedBy": username
            },
            "$push": {
                "history": history_entry
            }
        }
    )

    updated_inv = await inventory_collection.find_one({"_id": ObjectId(id)})
    updated_inv = await resolve_departments(updated_inv)
    return updated_inv
