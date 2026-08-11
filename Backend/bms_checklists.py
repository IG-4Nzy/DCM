from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import APIRouter, Body, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, ConfigDict, Field

from auth_utils import get_current_user, require_any_privilege, require_privilege
from database import db

router = APIRouter()
collection = db.get_collection("bms_checklists")


class BMSChecklistModel(BaseModel):
    id: Optional[str] = Field(alias="_id", default=None)
    date: str
    time: str
    preparedBy: str
    department: Optional[str] = None
    status: str = "Draft"
    data: Dict[str, Any] = Field(default_factory=dict)
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None
    createdBy: Optional[str] = None
    completedBy: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)


class PaginatedBMSChecklistsModel(BaseModel):
    data: List[BMSChecklistModel]
    total: int


def serialize_checklist(doc: dict) -> dict:
    doc["_id"] = str(doc["_id"])
    return doc


@router.get(
    "",
    response_description="List BMS checklists",
    response_model=PaginatedBMSChecklistsModel,
    response_model_by_alias=False,
    dependencies=[Depends(require_any_privilege(["View BMS Checklist", "View All Department BMS Checklist"]))],
)
async def list_bms_checklists(
    pagination: bool = Query(True),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1),
    status_filter: Optional[str] = Query(None, alias="status"),
    prepared_by: Optional[str] = Query(None, alias="preparedBy"),
    department: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    query: Dict[str, Any] = {}
    if status_filter:
        query["status"] = status_filter
    if prepared_by:
        query["preparedBy"] = {"$regex": prepared_by, "$options": "i"}
    if date:
        query["date"] = date

    can_view_all = current_user.get("isSuperuser", False) or "View All Department BMS Checklist" in current_user.get("privileges", [])
    
    if not can_view_all:
        query["department"] = current_user.get("department", "")
    elif department:
        query["department"] = department

    total = await collection.count_documents(query)
    cursor = collection.find(query).sort("createdAt", -1)
    if pagination:
        cursor = cursor.skip(skip).limit(limit)
    data = [serialize_checklist(doc) async for doc in cursor]
    return {"data": data, "total": total}


@router.post(
    "",
    response_description="Create BMS checklist",
    response_model=BMSChecklistModel,
    status_code=status.HTTP_201_CREATED,
    response_model_by_alias=False,
    dependencies=[Depends(require_privilege("Create BMS Checklist"))],
)
async def create_bms_checklist(
    payload: BMSChecklistModel = Body(...),
    current_user: dict = Depends(get_current_user),
):
    now = datetime.now(timezone.utc).isoformat()
    doc = payload.model_dump(by_alias=True, exclude={"id"})
    doc["createdAt"] = now
    doc["updatedAt"] = now
    doc["createdBy"] = current_user.get("sub", "")

    if "department" not in doc or not doc["department"]:
        doc["department"] = current_user.get("department", "")

    # Enforce one checklist per day per department
    existing = await collection.find_one({
        "date": doc["date"],
        "department": doc["department"]
    })
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"A BMS checklist already exists for {doc['date']} in this department"
        )

    result = await collection.insert_one(doc)
    created = await collection.find_one({"_id": result.inserted_id})
    
    from notification_helper import log_page_update
    await log_page_update("daily-activities", department=doc.get("department"), username=current_user.get("sub"))

    return serialize_checklist(created)


@router.get(
    "/{id}",
    response_description="Get BMS checklist",
    response_model=BMSChecklistModel,
    response_model_by_alias=False,
    dependencies=[Depends(require_any_privilege(["View BMS Checklist", "View All Department BMS Checklist"]))],
)
async def get_bms_checklist(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    doc = await collection.find_one({"_id": ObjectId(id)})
    if not doc:
        raise HTTPException(status_code=404, detail="BMS checklist not found")

    return serialize_checklist(doc)


@router.put(
    "/{id}",
    response_description="Update BMS checklist",
    response_model=BMSChecklistModel,
    response_model_by_alias=False,
    dependencies=[Depends(require_any_privilege(["Update BMS Checklist", "Edit BMS Checklist Field"]))],
)
async def update_bms_checklist(
    id: str,
    payload: BMSChecklistModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    update_data = payload.model_dump(by_alias=True, exclude={"id", "_id"}, exclude_none=True)
    update_data["updatedAt"] = datetime.now(timezone.utc).isoformat()

    result = await collection.update_one({"_id": ObjectId(id)}, {"$set": update_data})
    if result.matched_count != 1:
        raise HTTPException(status_code=404, detail="BMS checklist not found")

    updated = await collection.find_one({"_id": ObjectId(id)})
    
    from notification_helper import log_page_update
    await log_page_update("daily-activities", department=updated.get("department"), username=current_user.get("sub"))

    return serialize_checklist(updated)


@router.delete(
    "/{id}",
    response_description="Delete BMS checklist",
    dependencies=[Depends(require_privilege("Delete BMS Checklist"))],
)
async def delete_bms_checklist(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    result = await collection.delete_one({"_id": ObjectId(id)})
    if result.deleted_count != 1:
        raise HTTPException(status_code=404, detail="BMS checklist not found")

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{id}/send-email",
    response_description="Send BMS Checklist via email",
)
async def send_bms_checklist_email(
    id: str,
    payload: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    try:
        # Check if BMS checklist email is enabled in mail config
        config_col = db.get_collection("mail_config")
        config = await config_col.find_one({"_id": "mail_config"})
        if config and not config.get("bmsChecklistMailEnabled", True):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Sending BMS Checklist emails is currently disabled in Mail Configuration."
            )

        if not ObjectId.is_valid(id):
            raise HTTPException(status_code=400, detail="Invalid ID format")

        doc = await collection.find_one({"_id": ObjectId(id)})
        if not doc:
            raise HTTPException(status_code=404, detail="BMS checklist not found")

        emails_str = payload.get("emails", "")
        if not emails_str:
            raise HTTPException(status_code=400, detail="Emails list is required")

        emails = [e.strip() for e in emails_str.split(",") if e.strip()]
        if not emails:
            raise HTTPException(status_code=400, detail="No valid email addresses provided")

        dept_id = doc.get("department")
        dept_name = "General"
        if dept_id:
            dept_doc = await db.get_collection("departments").find_one({
                "$or": [
                    {"name": dept_id},
                    {"_id": ObjectId(dept_id) if ObjectId.is_valid(dept_id) else None}
                ]
            })
            if dept_doc:
                dept_name = str(dept_doc.get("name", dept_id))
            else:
                dept_name = str(dept_id)

        # Fetch observations & visitors HTML
        from mail_utils import get_day_summary_html
        summary_html = await get_day_summary_html(doc.get("date"))

        data_dict = doc.get("data", {})
        if isinstance(data_dict, str):
            import json
            try:
                data_dict = json.loads(data_dict)
            except Exception:
                data_dict = {}
                
        rows_html = ""
        if isinstance(data_dict, dict):
            for category, devices in data_dict.items():
                rows_html += f"""
                <tr style="background-color: #e2e8f0;">
                    <td colspan="5" style="border: 1px solid #cbd5e1; padding: 10px; font-weight: bold; text-align: left; font-size: 14px; color: #1e293b;">
                        {category}
                    </td>
                </tr>
                """
                if isinstance(devices, dict):
                    for device, parameters in devices.items():
                        if isinstance(parameters, dict):
                            for param, raw_val in parameters.items():
                                val = ""
                                bms_reading = ""
                                unit = ""
                                remarks = ""
                                
                                if isinstance(raw_val, dict):
                                    val = raw_val.get("value", "")
                                    bms_reading = raw_val.get("BMS_Reading", "")
                                    unit = raw_val.get("unit", "")
                                    remarks = raw_val.get("remarks", "")
                                else:
                                    val = str(raw_val)
                 
                                rows_html += f"""
                                <tr>
                                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">{device}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">{param}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold;">{val} {unit}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">{bms_reading if bms_reading else '-'}</td>
                                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-style: italic; color: #475569;">{remarks if remarks else '-'}</td>
                                </tr>
                                """
     
        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.6;">
            <h2 style="color: #0f172a; border-bottom: 2px solid #10b981; padding-bottom: 8px;">BMS Checklist Report</h2>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
                <tr>
                    <td style="padding: 6px 0;"><strong>Date:</strong> {doc.get('date')}</td>
                    <td style="padding: 6px 0;"><strong>Time:</strong> {doc.get('time')}</td>
                </tr>
                <tr>
                    <td style="padding: 6px 0;"><strong>Prepared By:</strong> {doc.get('preparedBy')}</td>
                    <td style="padding: 6px 0;"><strong>Department:</strong> {dept_name}</td>
                </tr>
                <tr>
                    <td style="padding: 6px 0;"><strong>Status:</strong> <span style="font-weight: bold; color: {'#10b981' if doc.get('status') == 'Completed' else '#f59e0b'};">{doc.get('status')}</span></td>
                    <td></td>
                </tr>
            </table>
            
            <table style="border-collapse: collapse; width: 100%; font-size: 13px; border: 1px solid #cbd5e1;">
                <thead>
                    <tr style="background-color: #f1f5f9;">
                        <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: left; width: 25%;">Device</th>
                        <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: left; width: 25%;">Parameter</th>
                        <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; width: 15%;">Value / Unit</th>
                        <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; width: 15%;">BMS Reading</th>
                        <th style="border: 1px solid #cbd5e1; padding: 10px; text-align: left; width: 20%;">Remarks</th>
                    </tr>
                </thead>
                <tbody>
                    {rows_html}
                </tbody>
            </table>
            
            {summary_html}
            
            <p style="margin-top: 25px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 8px;">
                This is an automated report sent from the Datacentre Management System (DCM).
            </p>
        </body>
        </html>
        """
     
        plain_body = f"BMS Checklist Report\nDate: {doc.get('date')} - {doc.get('time')}\nPrepared By: {doc.get('preparedBy')}\nStatus: {doc.get('status')}\n\nPlease find attached the PDF report for this BMS Checklist."
     
        from mail_utils import send_email, html_to_pdf_bytes
        
        attachments = None
        try:
            pdf_base64 = payload.get("pdf_base64") or payload.get("pdfBase64")
            if pdf_base64:
                import base64
                if "," in pdf_base64:
                    pdf_base64 = pdf_base64.split(",")[1]
                pdf_bytes = base64.b64decode(pdf_base64)
            else:
                pdf_bytes = await html_to_pdf_bytes(html_body)
 
            date_clean = (doc.get("date") or "date").replace("-", "")
            time_clean = (doc.get("time") or "time").replace(":", "")
            filename = f"BMS_Checklist_{date_clean}_{time_clean}.pdf"
            attachments = [{
                "filename": filename,
                "content": pdf_bytes,
                "content_type": "application/pdf"
            }]
        except Exception as pdf_err:
            print("ERROR GENERATING BMS CHECKLIST PDF:", pdf_err)
     
        await send_email(
            to_emails=emails,
            subject=f"BMS Checklist Report - {doc.get('date')} - {dept_name}",
            body=plain_body,
            html_body=html_body,
            attachments=attachments
        )
        dept = str(doc.get("department")) if doc.get("department") else "General"
        await db.get_collection("last_sent_emails").update_one(
            {"_id": dept},
            {"$set": {"emails": emails_str}},
            upsert=True
        )
        return {"success": True, "message": f"Checklist report successfully sent to {', '.join(emails)}"}
    except HTTPException as he:
        raise he
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")

