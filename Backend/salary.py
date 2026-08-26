from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, model_validator, field_validator
from typing import List, Optional, Union, Any
from datetime import datetime, timezone
import asyncio
from database import db
from auth_utils import get_current_user, require_privilege, require_any_privilege

router = APIRouter()

def validate_non_negative(v: Any) -> Any:
    if v is not None and v != "":
        try:
            val = float(v)
            if val < 0:
                raise ValueError("Must be a non-negative number")
        except (ValueError, TypeError):
            raise ValueError("Must be a valid number")
    return v

class ActivityModel(BaseModel):
    id: str
    name: str
    rate: Union[float, str]
    maxUnits: Optional[Union[float, str]] = 0

    @field_validator('rate', 'maxUnits')
    @classmethod
    def validate_fields(cls, v):
        return validate_non_negative(v)

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

    @field_validator('allottedAmount', 'maxStaffs', 'maxDays', 'reserveValue')
    @classmethod
    def validate_fields(cls, v):
        return validate_non_negative(v)

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

    @field_validator('days', 'otHours')
    @classmethod
    def validate_fields(cls, v):
        return validate_non_negative(v)

class GroupModel(BaseModel):
    id: str
    name: str
    perDaySalary: Union[float, str]
    templateId: Optional[str] = None
    members: List[MemberModel] = []
    updatedBy: Optional[str] = None
    updatedAt: Optional[str] = None

    @field_validator('perDaySalary')
    @classmethod
    def validate_fields(cls, v):
        return validate_non_negative(v)

class SalaryMonthModel(BaseModel):
    month: str
    groups: List[GroupModel]
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    editable: Optional[bool] = False

class ToggleEditablePayload(BaseModel):
    editable: bool

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
    current_calendar_month = datetime.now(timezone.utc).strftime("%Y-%m")
    async for doc in cursor:
        month_id = doc["_id"]
        editable = doc.get("editable", False)
        
        # Auto-lock previous months on every month rollover
        if month_id < current_calendar_month:
            last_unlocked_period = doc.get("unlocked_period")
            if last_unlocked_period != current_calendar_month and editable:
                editable = False
                await db["salary_data"].update_one(
                    {"_id": month_id},
                    {"$set": {"editable": False}}
                )

        res.append(SalaryMonthModel(
            month=month_id,
            groups=doc.get("groups", []),
            startDate=doc.get("startDate"),
            endDate=doc.get("endDate"),
            editable=editable
        ))
    return res

@router.post("/{month}/toggle-editable")
async def toggle_month_editable(month: str, payload: ToggleEditablePayload, user=Depends(get_current_user)):
    is_superuser = user.get("isSuperuser", False)
    if not is_superuser:
        raise HTTPException(
            status_code=403,
            detail="Only superusers can toggle the editable status for a month."
        )
    
    current_calendar_month = datetime.now(timezone.utc).strftime("%Y-%m")
    update_data = {"editable": payload.editable}
    if payload.editable:
        update_data["unlocked_period"] = current_calendar_month
    
    await db["salary_data"].update_one(
        {"_id": month},
        {"$set": update_data},
        upsert=True
    )
    return {"message": f"Month {month} editable status updated to {payload.editable}", "editable": payload.editable}

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
    
    existing_doc = await db["salary_data"].find_one({"_id": month})
    is_editable = existing_doc.get("editable", False) if existing_doc and "editable" in existing_doc else False
    if not is_editable:
        raise HTTPException(
            status_code=403,
            detail=f"Salary calculation for {month} is locked and cannot be edited until enabled by a superuser."
        )

    if not has_update:
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


def html_to_pdf_bytes_chrome(html_content: str) -> Optional[bytes]:
    import subprocess
    import tempfile
    import os
    import shutil

    chrome_cmd = "google-chrome"
    if not shutil.which(chrome_cmd):
        for alt in ["google-chrome-stable", "chromium", "chromium-browser", "/usr/bin/google-chrome", "/usr/bin/chromium"]:
            if shutil.which(alt) or os.path.exists(alt):
                chrome_cmd = alt
                break

    with tempfile.NamedTemporaryFile(suffix=".html", delete=False) as html_file:
        html_file.write(html_content.encode("utf-8"))
        html_path = html_file.name

    pdf_path = html_path.replace(".html", ".pdf")

    try:
        cmd = [
            chrome_cmd,
            "--headless=new",
            "--disable-gpu",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-extensions",
            "--disable-software-rasterizer",
            "--run-all-compositor-stages-before-draw",
            "--no-pdf-header-footer",
            "--disable-background-networking",
            "--disable-default-apps",
            "--disable-sync",
            "--disable-translate",
            "--metrics-recording-only",
            "--safebrowsing-disable-auto-update",
            "--password-store=basic",
            "--use-mock-keychain",
            "--proxy-server=direct://",
            "--proxy-bypass-list=*",
            f"--print-to-pdf={pdf_path}",
            html_path
        ]
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True, timeout=15)
        
        if not os.path.exists(pdf_path):
            print(f"[SALARY PDF] ERROR: PDF file was not created at {pdf_path}")
            stderr_output = result.stderr.decode("utf-8", errors="replace") if result.stderr else ""
            if stderr_output:
                print(f"[SALARY PDF] Chrome stderr: {stderr_output[:500]}")
            return None

        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()
        
        if len(pdf_bytes) == 0:
            print("[SALARY PDF] ERROR: PDF file is empty (0 bytes)")
            return None
            
        return pdf_bytes
    except subprocess.TimeoutExpired:
        print(f"[SALARY PDF] ERROR: Chrome timed out after 30 seconds")
        return None
    except subprocess.CalledProcessError as e:
        stderr_output = e.stderr.decode("utf-8", errors="replace") if e.stderr else ""
        print(f"[SALARY PDF] ERROR: Chrome process failed (exit code {e.returncode}): {stderr_output[:500]}")
        return None
    except Exception as e:
        print(f"[SALARY PDF] ERROR GENERATING PDF VIA CHROME ({chrome_cmd}): {e}")
        return None
    finally:
        if os.path.exists(html_path):
            try:
                os.remove(html_path)
            except Exception:
                pass
        if os.path.exists(pdf_path):
            try:
                os.remove(pdf_path)
            except Exception:
                pass


class SendSalaryEmailPayload(BaseModel):
    emails: str
    subject: Optional[str] = None
    salaryReportHtml: Optional[str] = None
    splitupReportHtml: Optional[str] = None
    salaryReportPdfBase64: Optional[str] = None
    splitupReportPdfBase64: Optional[str] = None

@router.post("/{month}/send-email", dependencies=[Depends(require_any_privilege(["View Salary Calculation", "Calculate Salary", "Update Salary Calculation"]))])
async def send_salary_email(month: str, payload: SendSalaryEmailPayload, user=Depends(get_current_user)):
    # Check if accounts email delivery is enabled in mail config
    config_col = db.get_collection("mail_config")
    config = await config_col.find_one({"_id": "mail_config"})
    if config and not config.get("accountsMailEnabled", True):
        raise HTTPException(
            status_code=400,
            detail="Sending Accounts/Salary emails is currently disabled in Mail Configuration."
        )

    emails_str = payload.emails.strip()
    if not emails_str:
        raise HTTPException(status_code=400, detail="Emails list is required")
    
    emails = [e.strip() for e in emails_str.split(",") if e.strip()]
    if not emails:
        raise HTTPException(status_code=400, detail="No valid email addresses provided")

    try:
        from mail_utils import send_email

        attachments = None
        try:
            import base64
            att_list = []

            # 1. Individual Salary Report PDF (Base64 -> Fallback to HTML-to-Chrome)
            pdf_bytes = None
            if payload.salaryReportPdfBase64:
                try:
                    b64_str = payload.salaryReportPdfBase64.strip()
                    if "," in b64_str:
                        b64_str = b64_str.split(",", 1)[1]
                    decoded = base64.b64decode(b64_str)
                    if decoded and len(decoded) > 0:
                        pdf_bytes = decoded
                        print(f"[SALARY EMAIL] Individual report PDF loaded from frontend Base64: {len(pdf_bytes)} bytes")
                except Exception as b64_err:
                    print(f"[SALARY EMAIL] ERROR decoding individual report PDF base64: {b64_err}")

            if not pdf_bytes and payload.salaryReportHtml:
                try:
                    generated = await asyncio.to_thread(html_to_pdf_bytes_chrome, payload.salaryReportHtml)
                    if generated and len(generated) > 0:
                        pdf_bytes = generated
                        print(f"[SALARY EMAIL] Individual report PDF generated via Chrome: {len(pdf_bytes)} bytes")
                    else:
                        print("[SALARY EMAIL] WARNING: Individual report PDF Chrome generation returned empty/None")
                except Exception as e1:
                    print(f"[SALARY EMAIL] ERROR generating individual report PDF via Chrome: {e1}")

            if pdf_bytes:
                att_list.append({
                    "filename": f"Salary_Report_Individual_Members_{month}.pdf",
                    "content": pdf_bytes,
                    "content_type": "application/pdf"
                })

            # 2. All Splitup Statements PDF (Base64 -> Fallback to HTML-to-Chrome)
            splitup_bytes = None
            if payload.splitupReportPdfBase64:
                try:
                    b64_str = payload.splitupReportPdfBase64.strip()
                    if "," in b64_str:
                        b64_str = b64_str.split(",", 1)[1]
                    decoded = base64.b64decode(b64_str)
                    if decoded and len(decoded) > 0:
                        splitup_bytes = decoded
                        print(f"[SALARY EMAIL] Splitup report PDF loaded from frontend Base64: {len(splitup_bytes)} bytes")
                except Exception as b64_err:
                    print(f"[SALARY EMAIL] ERROR decoding splitup report PDF base64: {b64_err}")

            if not splitup_bytes and payload.splitupReportHtml:
                try:
                    generated = await asyncio.to_thread(html_to_pdf_bytes_chrome, payload.splitupReportHtml)
                    if generated and len(generated) > 0:
                        splitup_bytes = generated
                        print(f"[SALARY EMAIL] Splitup report PDF generated via Chrome: {len(splitup_bytes)} bytes")
                    else:
                        print("[SALARY EMAIL] WARNING: Splitup report PDF Chrome generation returned empty/None")
                except Exception as e2:
                    print(f"[SALARY EMAIL] ERROR generating splitup report PDF via Chrome: {e2}")

            if splitup_bytes:
                att_list.append({
                    "filename": f"Salary_All_Splitups_{month}.pdf",
                    "content": splitup_bytes,
                    "content_type": "application/pdf"
                })

            if att_list:
                attachments = att_list
                print(f"[SALARY EMAIL] Total attachments prepared: {len(att_list)}")
            else:
                print("[SALARY EMAIL] WARNING: No PDF attachments could be prepared (both empty)")
        except Exception as pdf_err:
            print(f"[SALARY EMAIL] ERROR in PDF attachment preparation block: {pdf_err}")

        subject = payload.subject.strip() if (payload.subject and payload.subject.strip()) else f"Monthly Salary Report & Splitup Statements - {month}"
        body = (
            f"Respected Sir/Madam,\n\n"
            f"Please find attached the Monthly Salary Report (Individual Members) and "
            f"All Splitup Statements for the period {month}.\n\n"
            f"Generated via Datacentre Management System (DCM).\n\n"
            f"Thank you,\n"
            f"Datacentre Management System"
        )

        att_count = len(attachments) if attachments else 0
        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.6;">
            <h2 style="color: #0f172a; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">Monthly Salary Report & Splitup Statements</h2>
            <p><strong>Period:</strong> {month}</p>
            <p>Respected Sir/Madam,</p>
            <p>Please find attached the following {att_count} PDF report(s) for the period <strong>{month}</strong>:</p>
            <div style="background-color: #f8fafc; padding: 12px 16px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 16px 0;">
                <p style="margin: 4px 0; font-weight: 600;">📄 1. Salary Report: Individual Members (.pdf)</p>
                <p style="margin: 4px 0; font-weight: 600;">📄 2. All Splitup Reports (.pdf - multi-page)</p>
            </div>
            <p>Generated via Datacentre Management System (DCM).</p>
            <p style="margin-top: 25px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 8px;">
                This is an automated notification from the Datacentre Management System (DCM).
            </p>
        </body>
        </html>
        """

        await send_email(
            to_emails=emails,
            subject=subject,
            body=body,
            html_body=html_body,
            attachments=attachments
        )

        # Save last sent email address for accounts
        await db.get_collection("last_sent_emails").update_one(
            {"_id": "accounts"},
            {"$set": {"emails": emails_str}},
            upsert=True
        )

        return {
            "success": True,
            "message": f"Salary report and splitups successfully emailed to {', '.join(emails)}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")


