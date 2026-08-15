from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, model_validator
from typing import List, Optional, Union
from database import db
from auth_utils import get_current_user, require_privilege, require_any_privilege

router = APIRouter()

class ActivityModel(BaseModel):
    id: str
    name: str
    rate: Union[float, str]
    maxUnits: Optional[Union[float, str]] = 0

class TemplateModel(BaseModel):
    id: str
    title: str
    activities: List[ActivityModel] = []
    allottedAmount: Optional[Union[float, str]] = 0
    maxStaffs: Optional[Union[int, str]] = 0
    maxDays: Optional[Union[int, str]] = None
    initialConsumedAmount: Optional[Union[float, str]] = 0
    reserveEnabled: Optional[bool] = False
    reserveType: Optional[str] = 'percentage'
    reserveValue: Optional[Union[float, str]] = 5

    @model_validator(mode='before')
    @classmethod
    def populate_initial_consumed_amount(cls, data):
        if isinstance(data, dict):
            if 'initialConsumedUnits' in data and 'initialConsumedAmount' not in data:
                data['initialConsumedAmount'] = data.get('initialConsumedUnits', 0)
        return data

class MemberModel(BaseModel):
    id: str
    name: str
    days: Union[float, str]
    otHours: Optional[Union[float, str]] = 0

class GroupModel(BaseModel):
    id: str
    name: str
    perDaySalary: Union[float, str]
    templateId: Optional[str] = None
    members: List[MemberModel] = []
    updatedBy: Optional[str] = None
    updatedAt: Optional[str] = None

class SalaryMonthModel(BaseModel):
    month: str
    groups: List[GroupModel]
    startDate: Optional[str] = None
    endDate: Optional[str] = None

class SaveSalaryPayload(BaseModel):
    groups: List[GroupModel]
    startDate: Optional[str] = None
    endDate: Optional[str] = None

class GlobalSalaryConfig(BaseModel):
    companyName: str = ""
    poNumber: str = ""
    poStartDate: Optional[str] = ""
    poEndDate: Optional[str] = ""

@router.get("/config", response_model=GlobalSalaryConfig, dependencies=[Depends(require_any_privilege(["View Salary Calculation", "Calculate Salary", "Update Salary Calculation"]))])
async def get_config():
    doc = await db["salary_config"].find_one({"_id": "global"})
    if doc:
        return GlobalSalaryConfig(**doc)
    return GlobalSalaryConfig()

@router.post("/config", dependencies=[Depends(require_privilege("Update Salary Calculation"))])
async def save_config(config: GlobalSalaryConfig):
    await db["salary_config"].update_one(
        {"_id": "global"},
        {"$set": config.model_dump()},
        upsert=True
    )
    return {"message": "Config saved"}

@router.get("/templates", response_model=List[TemplateModel], dependencies=[Depends(require_any_privilege(["View Salary Calculation", "Calculate Salary", "Update Salary Calculation"]))])
async def get_templates():
    cursor = db["salary_templates"].find({})
    templates = []
    async for doc in cursor:
        templates.append(TemplateModel(**doc))
    return templates

@router.post("/templates", dependencies=[Depends(require_privilege("Update Salary Calculation"))])
async def save_templates(templates: List[TemplateModel]):
    await db["salary_templates"].delete_many({})
    if templates:
        docs = [t.model_dump() for t in templates]
        await db["salary_templates"].insert_many(docs)
    return {"message": "Templates saved"}

@router.get("", response_model=List[SalaryMonthModel], dependencies=[Depends(require_any_privilege(["View Salary Calculation", "Calculate Salary", "Update Salary Calculation"]))])
async def get_all_salary():
    cursor = db["salary_data"].find({})
    res = []
    async for doc in cursor:
        res.append(SalaryMonthModel(
            month=doc["_id"],
            groups=doc.get("groups", []),
            startDate=doc.get("startDate"),
            endDate=doc.get("endDate")
        ))
    return res

class BonusEntryModel(BaseModel):
    id: str
    name: str
    accumulatedAmount: float = 0.0
    notes: Optional[str] = ""
    lastAddedMonth: Optional[str] = None
    resigned: Optional[bool] = False
    updatedBy: Optional[str] = None
    updatedAt: Optional[str] = None
    month: Optional[str] = None
    period: Optional[str] = None
    additions: Optional[List[dict]] = []

class BonusQuickAddAllPayload(BaseModel):
    amount: float = 1000.0
    month: Optional[str] = None
    period: Optional[str] = None

async def log_bonus_history(action: str, employee: str, details: str, performed_by: str):
    from datetime import datetime, timezone
    await db["salary_bonus_history"].insert_one({
        "action": action,
        "employee": employee,
        "details": details,
        "performedBy": performed_by,
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    })

@router.get("/bonus", dependencies=[Depends(require_any_privilege(["View Salary Calculation", "Calculate Salary", "Update Salary Calculation"]))])
async def get_bonus_entries():
    cursor = db["salary_bonus"].find({})
    res = []
    async for doc in cursor:
        res.append({
            "id": doc["_id"],
            "name": doc.get("name", ""),
            "accumulatedAmount": doc.get("accumulatedAmount", 0.0),
            "notes": doc.get("notes", ""),
            "lastAddedMonth": doc.get("lastAddedMonth"),
            "resigned": doc.get("resigned", False),
            "updatedBy": doc.get("updatedBy"),
            "updatedAt": doc.get("updatedAt"),
            "additions": doc.get("additions", [])
        })
    return res

@router.get("/bonus/history", dependencies=[Depends(require_any_privilege(["View Salary Calculation", "Calculate Salary", "Update Salary Calculation"]))])
async def get_bonus_history():
    cursor = db["salary_bonus_history"].find({}).sort("timestamp", -1).limit(200)
    res = []
    async for doc in cursor:
        res.append({
            "id": str(doc["_id"]),
            "action": doc.get("action", ""),
            "employee": doc.get("employee", ""),
            "details": doc.get("details", ""),
            "performedBy": doc.get("performedBy", ""),
            "timestamp": doc.get("timestamp", "")
        })
    return res

@router.post("/bonus", dependencies=[Depends(require_any_privilege(["Calculate Salary", "Update Salary Calculation"]))])
async def save_bonus_entry(entry: BonusEntryModel, user=Depends(get_current_user)):
    doc = entry.model_dump()
    doc["_id"] = entry.id
    updater = user.get("displayName") or user.get("sub") or "system"
    doc["updatedBy"] = updater
    from datetime import datetime, timezone
    now_str = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    doc["updatedAt"] = now_str
    
    existing = await db["salary_bonus"].find_one({"_id": entry.id})
    additions = []
    if existing:
        old_amount = existing.get("accumulatedAmount", 0.0)
        new_amount = entry.accumulatedAmount
        if new_amount == 0.0:
            additions = []
        else:
            additions = existing.get("additions", [])
            if not isinstance(additions, list):
                additions = []
            diff = new_amount - old_amount
            if diff != 0:
                period_str = entry.period or "Manual Adjustment"
                month_str = entry.month or datetime.now(timezone.utc).strftime("%Y-%m")
                additions.append({
                    "month": month_str,
                    "period": period_str,
                    "amount": diff,
                    "timestamp": now_str,
                    "updatedBy": updater
                })
                if diff > 0 and entry.month:
                    doc["lastAddedMonth"] = entry.month
        
        if old_amount != new_amount:
            diff = new_amount - old_amount
            action = "Added" if diff > 0 else "Deducted"
            await log_bonus_history(action, entry.name, f"{action} ₹{abs(diff):,.0f} (₹{old_amount:,.0f} → ₹{new_amount:,.0f})", updater)
        else:
            await log_bonus_history("Updated", entry.name, f"Details updated", updater)
    else:
        # Created new entry
        if entry.accumulatedAmount != 0:
            period_str = entry.period or "Initial Entry"
            month_str = entry.month or datetime.now(timezone.utc).strftime("%Y-%m")
            additions.append({
                "month": month_str,
                "period": period_str,
                "amount": entry.accumulatedAmount,
                "timestamp": now_str,
                "updatedBy": updater
            })
            if entry.month:
                doc["lastAddedMonth"] = entry.month
        await log_bonus_history("Created", entry.name, f"Added to bonus tracker with ₹{entry.accumulatedAmount:,.0f}", updater)
    
    doc["additions"] = additions
    
    await db["salary_bonus"].update_one(
        {"_id": entry.id},
        {"$set": doc},
        upsert=True
    )
    return {"message": "Bonus entry saved", "entry": doc}

@router.post("/bonus/resign/{entry_id}", dependencies=[Depends(require_any_privilege(["Calculate Salary", "Update Salary Calculation"]))])
async def toggle_resign_bonus_entry(entry_id: str, user=Depends(get_current_user)):
    from datetime import datetime, timezone
    updater = user.get("displayName") or user.get("sub") or "system"
    now_str = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    
    existing = await db["salary_bonus"].find_one({"_id": entry_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Bonus entry not found")
    
    current_resigned = existing.get("resigned", False)
    new_resigned = not current_resigned
    
    await db["salary_bonus"].update_one(
        {"_id": entry_id},
        {"$set": {"resigned": new_resigned, "updatedBy": updater, "updatedAt": now_str}}
    )
    
    action = "Resigned" if new_resigned else "Unresigned"
    await log_bonus_history(action, existing.get("name", ""), f"Marked as {'resigned' if new_resigned else 'active'}", updater)
    
    return {"message": f"Employee {'resigned' if new_resigned else 'marked active'}"}

@router.post("/bonus/quick-add-all", dependencies=[Depends(require_any_privilege(["Calculate Salary", "Update Salary Calculation"]))])
async def quick_add_all_bonus(payload: BonusQuickAddAllPayload, user=Depends(get_current_user)):
    from datetime import datetime, timezone
    now_str = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    current_month = payload.month or datetime.now(timezone.utc).strftime("%Y-%m")
    period_str = payload.period or "Bulk Add"
    updater = user.get("displayName") or user.get("sub") or "system"
    
    cursor = db["salary_bonus"].find({"$or": [{"resigned": False}, {"resigned": {"$exists": False}}]})
    updated_count = 0
    skipped_count = 0
    async for doc in cursor:
        if doc.get("lastAddedMonth") == current_month:
            skipped_count += 1
            continue
        new_amount = (doc.get("accumulatedAmount", 0.0) or 0.0) + payload.amount
        
        additions = doc.get("additions", [])
        if not isinstance(additions, list):
            additions = []
        additions.append({
            "month": current_month,
            "period": period_str,
            "amount": payload.amount,
            "timestamp": now_str,
            "updatedBy": updater
        })
        
        await db["salary_bonus"].update_one(
            {"_id": doc["_id"]},
            {"$set": {
                "accumulatedAmount": new_amount,
                "lastAddedMonth": current_month,
                "updatedBy": updater,
                "updatedAt": now_str,
                "additions": additions
            }}
        )
        updated_count += 1
    
    await log_bonus_history("Bulk Add", "All Active Employees", f"Added ₹{payload.amount:,.0f} to {updated_count} employee(s), {skipped_count} skipped (already added this month)", updater)
    
    return {"message": f"Added ₹{payload.amount:,.0f} to {updated_count} employees", "updated": updated_count, "skipped": skipped_count}

@router.post("/bonus/reset-all", dependencies=[Depends(require_any_privilege(["Calculate Salary", "Update Salary Calculation"]))])
async def reset_all_bonus(user=Depends(get_current_user)):
    from datetime import datetime, timezone
    now_str = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    updater = user.get("displayName") or user.get("sub") or "system"
    
    # Delete resigned employees
    del_result = await db["salary_bonus"].delete_many({"resigned": True})
    deleted_count = del_result.deleted_count
    
    # Reset active employees
    await db["salary_bonus"].update_many(
        {},
        {"$set": {
            "accumulatedAmount": 0.0,
            "lastAddedMonth": None,
            "additions": [],
            "updatedBy": updater,
            "updatedAt": now_str
        }}
    )
    
    details = f"All amounts reset to ₹0"
    if deleted_count > 0:
        details += f", {deleted_count} resigned employee(s) removed"
    await log_bonus_history("Reset All", "All Employees", details, updater)
    
    return {"message": "All bonus amounts reset to 0", "resignedRemoved": deleted_count}

@router.delete("/bonus/{entry_id}", dependencies=[Depends(require_any_privilege(["Calculate Salary", "Update Salary Calculation"]))])
async def delete_bonus_entry(entry_id: str, user=Depends(get_current_user)):
    updater = user.get("displayName") or user.get("sub") or "system"
    existing = await db["salary_bonus"].find_one({"_id": entry_id})
    name = existing.get("name", "Unknown") if existing else "Unknown"
    
    await db["salary_bonus"].delete_one({"_id": entry_id})
    await log_bonus_history("Deleted", name, f"Removed from bonus tracker", updater)
    return {"message": "Bonus entry deleted"}

@router.get("/{month}", response_model=List[GroupModel], dependencies=[Depends(require_any_privilege(["View Salary Calculation", "Calculate Salary", "Update Salary Calculation"]))])
async def get_salary(month: str):
    doc = await db["salary_data"].find_one({"_id": month})
    if doc and "groups" in doc:
        return [GroupModel(**g) for g in doc["groups"]]
    return []

@router.post("/{month}")
async def save_salary(month: str, payload: SaveSalaryPayload, user=Depends(get_current_user)):
    groups = payload.groups
    is_superuser = user.get("isSuperuser", False)
    privileges = user.get("privileges", [])
    
    has_update = is_superuser or "Update Salary Calculation" in privileges
    has_calc = is_superuser or "Calculate Salary" in privileges
    
    if not has_update and not has_calc:
        raise HTTPException(
            status_code=403,
            detail="Not enough permissions. Requires: Update Salary Calculation or Calculate Salary"
        )
    
    if not has_update:
        existing_doc = await db["salary_data"].find_one({"_id": month})
        baseline_groups = []
        if existing_doc and "groups" in existing_doc:
            baseline_groups = existing_doc["groups"]
        else:
            cursor = db["salary_data"].find({}).sort("_id", -1)
            async for doc in cursor:
                if doc.get("groups"):
                    baseline_groups = doc["groups"]
                    break
        
        if len(groups) != len(baseline_groups):
            raise HTTPException(
                status_code=403,
                detail="Calculate Salary privilege is not allowed to add or remove groups."
            )
        
        baseline_map = {bg["id"]: bg for bg in baseline_groups}
        for g in groups:
            if g.id not in baseline_map:
                raise HTTPException(
                    status_code=403,
                    detail="Calculate Salary privilege is not allowed to add new groups."
                )
            bg = baseline_map[g.id]
            
            bg_template_id = bg.get("templateId")
            g_template_id = g.templateId
            
            if g.name != bg.get("name"):
                raise HTTPException(
                    status_code=403,
                    detail="Calculate Salary privilege is not allowed to update group name."
                )
            
            if g_template_id != bg_template_id:
                raise HTTPException(
                    status_code=403,
                    detail="Calculate Salary privilege is not allowed to update group template."
                )
            
            try:
                g_val = float(g.perDaySalary)
            except ValueError:
                g_val = str(g.perDaySalary)
                
            try:
                bg_val = float(bg.get("perDaySalary", 0))
            except ValueError:
                bg_val = str(bg.get("perDaySalary", ""))
                
            if g_val != bg_val:
                raise HTTPException(
                    status_code=403,
                    detail="Calculate Salary privilege is not allowed to update group per day salary."
                )

    update_doc = {
        "groups": [g.model_dump() for g in groups],
        "startDate": payload.startDate,
        "endDate": payload.endDate
    }

    await db["salary_data"].update_one(
        {"_id": month},
        {"$set": update_doc},
        upsert=True
    )
    return {"message": "Salary saved"}

