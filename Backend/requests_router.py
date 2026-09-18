from fastapi import APIRouter, HTTPException, status, Body, Query, Depends, UploadFile, File
import asyncio
import re
import os
from auth_utils import require_privilege, get_current_user
from fastapi.responses import JSONResponse
from typing import Optional, List, Dict, Any
from database import db, get_next_sequence
from models import RequestModel, CreateRequestModel, UpdateRequestModel, PaginatedRequestsModel
from bson import ObjectId
from datetime import datetime, timezone
from pydantic import BaseModel, Field, field_validator

router = APIRouter()
collection = db.get_collection("requests")
routings_collection = db.get_collection("request_routings")
departments_collection = db.get_collection("departments")
users_collection = db.get_collection("users")

class VisitorLogCreate(BaseModel):
    visitorName: str = Field(..., min_length=1)
    division: str = Field(..., min_length=1)
    purpose: str = Field(..., min_length=1)
    entryTime: str = Field(..., min_length=1)
    exitTime: Optional[str] = ""
    itemsToBring: Optional[str] = ""
    keptItemsOnExit: bool = False
    requestId: Optional[str] = ""

    @field_validator('visitorName')
    @classmethod
    def validate_visitor_name(cls, v):
        if v:
            v_trimmed = v.strip()
            if not all(c.isalnum() or c == ',' or c.isspace() for c in v_trimmed):
                raise ValueError("Visitor name must contain alphanumeric characters and commas only")
            if len(v_trimmed) > 40:
                raise ValueError("Visitor name must be maximum 40 characters")
            return v_trimmed
        return v

    @field_validator('division')
    @classmethod
    def validate_division(cls, v):
        if v:
            v_trimmed = v.strip()
            if not all(c.isalnum() or c.isspace() or c == '_' for c in v_trimmed):
                raise ValueError("Division must contain alphanumeric characters, spaces, or underscores only")
            if len(v_trimmed) > 60:
                raise ValueError("Division must be maximum 60 characters")
            return v_trimmed
        return v

    @field_validator('purpose')
    @classmethod
    def validate_purpose(cls, v):
        if v:
            v_trimmed = v.strip()
            if not all(c.isalnum() or c.isspace() or c == '_' for c in v_trimmed):
                raise ValueError("Purpose of visit must contain alphanumeric characters, spaces, or underscores only")
            if len(v_trimmed) > 125:
                raise ValueError("Purpose of visit must be maximum 125 characters")
            return v_trimmed
        return v

    @field_validator('itemsToBring')
    @classmethod
    def validate_items_to_bring(cls, v):
        if v:
            v_trimmed = v.strip()
            if not all(c.isalnum() or c.isspace() or c == '_' for c in v_trimmed):
                raise ValueError("Tools/items to bring must contain alphanumeric characters, spaces, or underscores only")
            return v_trimmed
        return v

class VisitorLogUpdate(BaseModel):
    visitorName: Optional[str] = None
    division: Optional[str] = None
    purpose: Optional[str] = None
    entryTime: Optional[str] = None
    exitTime: Optional[str] = None
    itemsToBring: Optional[str] = None
    keptItemsOnExit: Optional[bool] = None
    requestId: Optional[str] = None

    @field_validator('visitorName')
    @classmethod
    def validate_visitor_name(cls, v):
        if v is not None:
            v_trimmed = v.strip()
            if not all(c.isalnum() or c == ',' or c.isspace() for c in v_trimmed):
                raise ValueError("Visitor name must contain alphanumeric characters and commas only")
            if len(v_trimmed) > 40:
                raise ValueError("Visitor name must be maximum 40 characters")
            return v_trimmed
        return v

    @field_validator('division')
    @classmethod
    def validate_division(cls, v):
        if v is not None:
            v_trimmed = v.strip()
            if not all(c.isalnum() or c.isspace() or c == '_' for c in v_trimmed):
                raise ValueError("Division must contain alphanumeric characters, spaces, or underscores only")
            if len(v_trimmed) > 60:
                raise ValueError("Division must be maximum 60 characters")
            return v_trimmed
        return v

    @field_validator('purpose')
    @classmethod
    def validate_purpose(cls, v):
        if v is not None:
            v_trimmed = v.strip()
            if not all(c.isalnum() or c.isspace() or c == '_' for c in v_trimmed):
                raise ValueError("Purpose of visit must contain alphanumeric characters, spaces, or underscores only")
            if len(v_trimmed) > 125:
                raise ValueError("Purpose of visit must be maximum 125 characters")
            return v_trimmed
        return v

    @field_validator('itemsToBring')
    @classmethod
    def validate_items_to_bring(cls, v):
        if v is not None:
            v_trimmed = v.strip()
            if not all(c.isalnum() or c.isspace() or c == '_' for c in v_trimmed):
                raise ValueError("Tools/items to bring must contain alphanumeric characters, spaces, or underscores only")
            return v_trimmed
        return v


async def log_request_action(request_id: str, action: str, details: str, username: str, remarks: Optional[str] = None):
    try:
        logs_col = db.get_collection("request_logs")
        log_entry = {
            "requestId": request_id,
            "action": action,
            "details": details,
            "user": username,
            "remarks": remarks or "",
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        }
        await logs_col.insert_one(log_entry)
    except Exception as e:
        print(f"Failed to write request history log: {e}")


async def send_stage_email_notification(
    stage: dict,
    request_doc: dict,
    action_type: str = "Stage Reached",
    actor_username: Optional[str] = None,
    remarks: Optional[str] = None
):
    """Sends email notifications to requester, assignee, and custom recipients when a request reaches a stage."""
    try:
        if not stage or not isinstance(stage, dict):
            return

        send_email_flag = stage.get("sendEmail", False)
        if not send_email_flag:
            return

        email_to_requester = stage.get("emailToRequester", False)
        email_to_assignee = stage.get("emailToAssignee", False)
        custom_emails = stage.get("customEmails") or []

        # If no recipient options configured, exit
        if not (email_to_requester or email_to_assignee or custom_emails):
            return

        recipients = []

        # 1. Email to Requester
        if email_to_requester:
            requester = request_doc.get("createdBy") or ""
            if requester:
                user = await users_collection.find_one({"username": requester})
                req_email = None
                if user and user.get("email"):
                    req_email = str(user["email"]).strip()
                elif user and user.get("mail"):
                    req_email = str(user["mail"]).strip()
                elif "@" in requester:
                    req_email = requester.strip()
                else:
                    details = request_doc.get("details") or {}
                    if isinstance(details, dict) and details.get("email"):
                        req_email = str(details["email"]).strip()
                    elif isinstance(details, dict) and details.get("requesterEmail"):
                        req_email = str(details["requesterEmail"]).strip()
                    elif user and user.get("username"):
                        req_email = f"{user.get('username')}@vssc.gov.in"
                    else:
                        req_email = f"{requester}@vssc.gov.in"

                if req_email and "@" in req_email and req_email not in recipients:
                    recipients.append(req_email)

        # 2. Email to Assignee(s)
        if email_to_assignee:
            assigned_users = request_doc.get("currentAssignedUsers") or []
            if not assigned_users and stage.get("assignedTo"):
                assigned_to_raw = stage.get("assignedTo")
                if isinstance(assigned_to_raw, list):
                    assigned_users = assigned_to_raw
                elif isinstance(assigned_to_raw, str):
                    assigned_users = [assigned_to_raw]

            for assignee in assigned_users:
                assignee_str = str(assignee).strip()
                if not assignee_str:
                    continue
                if assignee_str.startswith("SpecificUser:"):
                    assignee_str = assignee_str.replace("SpecificUser:", "").strip()
                elif assignee_str.startswith("Role:") or assignee_str.startswith("DeptStaffs:"):
                    continue

                user = await users_collection.find_one({"username": assignee_str})
                assignee_email = None
                if user and user.get("email"):
                    assignee_email = str(user["email"]).strip()
                elif user and user.get("mail"):
                    assignee_email = str(user["mail"]).strip()
                elif "@" in assignee_str:
                    assignee_email = assignee_str
                elif user and user.get("username"):
                    assignee_email = f"{user.get('username')}@vssc.gov.in"
                elif assignee_str.replace("_", "").isalnum():
                    assignee_email = f"{assignee_str}@vssc.gov.in"

                if assignee_email and "@" in assignee_email and assignee_email not in recipients:
                    recipients.append(assignee_email)

        # 3. Custom Emails
        if custom_emails:
            if isinstance(custom_emails, str):
                custom_list = [c.strip() for c in custom_emails.split(",") if c.strip()]
            else:
                custom_list = [str(c).strip() for c in custom_emails if c and str(c).strip()]

            for ce in custom_list:
                if "@" in ce and ce not in recipients:
                    recipients.append(ce)

        if not recipients:
            print(f"[Stage Mail] No valid recipients resolved for stage '{stage.get('stageName')}' in request {request_doc.get('requestId')}")
            return

        request_id = request_doc.get("requestId") or str(request_doc.get("_id", "N/A"))
        stage_name = stage.get("stageName") or request_doc.get("status") or "Current Stage"
        request_type = request_doc.get("requestType") or request_doc.get("category") or "Request"
        requester_name = request_doc.get("createdBy") or "Unknown"
        assigned_display = ", ".join(request_doc.get("currentAssignedUsers") or []) or "None"
        formatted_time = datetime.now().strftime("%d-%b-%Y %I:%M %p")
        display_remarks = remarks or request_doc.get("remarks") or "None"
        description = request_doc.get("description") or "-"

        subject = f"[DCM Request Alert] {request_id} ({request_type}) - Stage: {stage_name}"

        body = (
            f"DCM REQUEST NOTIFICATION\n"
            f"========================\n\n"
            f"Request ID   : {request_id}\n"
            f"Request Type : {request_type}\n"
            f"Current Stage: {stage_name}\n"
            f"Action       : {action_type} by {actor_username or 'System'}\n"
            f"Requester    : {requester_name}\n"
            f"Assigned To  : {assigned_display}\n"
            f"Date & Time  : {formatted_time}\n"
            f"Description  : {description}\n"
            f"Remarks      : {display_remarks}\n\n"
            f"Please log into the Datacentre Management (DCM) portal to view and process this request.\n"
        )

        actor_str = f"by {actor_username}" if actor_username else ""
        html_body = f"""
        <div style="font-family: Arial, -apple-system, BlinkMacSystemFont, sans-serif; max-width: 620px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #1e3a8a; padding: 20px 24px; color: #ffffff;">
                <h2 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">DCM Request Notification</h2>
                <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.9;">Request has reached stage: <strong>{stage_name}</strong></p>
            </div>
            
            <div style="padding: 24px;">
                <div style="margin-bottom: 20px;">
                    <span style="display: inline-block; background-color: #eff6ff; color: #1d4ed8; padding: 6px 14px; border-radius: 9999px; font-weight: 700; font-size: 13px; border: 1px solid #bfdbfe;">
                        {request_id} • {request_type}
                    </span>
                    <span style="display: inline-block; margin-left: 8px; background-color: #f0fdf4; color: #15803d; padding: 6px 14px; border-radius: 9999px; font-weight: 700; font-size: 13px; border: 1px solid #bbf7d0;">
                        Stage: {stage_name}
                    </span>
                </div>

                <table style="border-collapse: collapse; width: 100%; font-size: 14px; margin-bottom: 20px;">
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 10px 8px; font-weight: 600; color: #64748b; width: 35%;">Action</td>
                        <td style="padding: 10px 8px; color: #0f172a;">{action_type} {actor_str}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 10px 8px; font-weight: 600; color: #64748b;">Requester</td>
                        <td style="padding: 10px 8px; color: #0f172a; font-weight: 600;">{requester_name}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 10px 8px; font-weight: 600; color: #64748b;">Assigned To</td>
                        <td style="padding: 10px 8px; color: #0f172a;">{assigned_display}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 10px 8px; font-weight: 600; color: #64748b;">Date & Time</td>
                        <td style="padding: 10px 8px; color: #0f172a;">{formatted_time}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 10px 8px; font-weight: 600; color: #64748b;">Description</td>
                        <td style="padding: 10px 8px; color: #0f172a;">{description}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 8px; font-weight: 600; color: #64748b;">Remarks</td>
                        <td style="padding: 10px 8px; color: #0f172a;">{display_remarks}</td>
                    </tr>
                </table>

                <div style="background-color: #f8fafc; padding: 14px 16px; border-radius: 6px; border-left: 4px solid #3b82f6; margin-top: 10px;">
                    <p style="margin: 0; font-size: 13px; color: #475569;">
                        Please log into the DCM Portal to review, approve, or advance this request.
                    </p>
                </div>
            </div>

            <div style="background-color: #f8fafc; padding: 12px 24px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8;">
                Datacentre Management System (DCM) • Automated Stage Notification
            </div>
        </div>
        """

        from mail_utils import send_email
        asyncio.create_task(send_email(
            to_emails=recipients,
            subject=subject,
            body=body,
            html_body=html_body
        ))
        print(f"[Stage Mail] Dispatched email for request {request_id} at stage '{stage_name}' to {recipients}")
    except Exception as e:
        print(f"[Stage Mail] Error dispatching stage email: {e}")


async def add_visitor_log_on_completion(existing_request: dict, username: str):
    if not existing_request or existing_request.get("visitorReflected"):
        return

    try:
        request_type = existing_request.get("requestType") or existing_request.get("category", "")
        if request_type == "DC Entry":
            details = existing_request.get("details") or {}
            
            # Resolve the requester's full name and department
            users_col = db.get_collection("users")
            user = await users_col.find_one({"username": existing_request.get("createdBy", "")})
            visitor_name = "Unknown"
            division = "Unknown"
            if user:
                first = user.get("firstName", "")
                last = user.get("lastName", "")
                visitor_name = f"{first} {last}".strip() or user.get("username", "Unknown")
                division = user.get("department", "Unknown")

            visitor_log = {
                "requestId": str(existing_request["_id"]),
                "visitorName": visitor_name,
                "division": division,
                "purpose": existing_request.get("purpose") or details.get("purpose") or "Datacentre Visit",
                "entryTime": details.get("entryTime") or details.get("dateTime") or existing_request.get("createdAt") or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                "exitTime": details.get("exitTime") or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                "itemsToBring": details.get("itemsToBring") or "",
                "keptItemsOnExit": bool(details.get("keptItemsOnExit")),
                "loggedBy": username or "system",
                "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            }

            visitor_logs_col = db.get_collection("visitor_logs")
            await visitor_logs_col.insert_one(visitor_log)
            
            # Mark visitorReflected = True in the request document
            req_col = db.get_collection("requests")
            await req_col.update_one({"_id": existing_request["_id"]}, {"$set": {"visitorReflected": True}})
    except Exception as e:
        print(f"Error in add_visitor_log_on_completion: {e}")


async def get_routing_for_type(request_type: str):
    """Fetch the routing configuration for a given request type."""
    # Try exact match first
    routing = await routings_collection.find_one({"requestType": request_type})
    if routing:
        return routing

    # Fallback mappings for common aliases
    fallbacks = {
        "VM Creation": ["VM Request", "VM_Request", "VM_Creation"],
        "VM Request": ["VM Creation", "VM_Creation", "VM_Request"],
        "VM Management": ["VM Creation", "VM Request", "VM_Request", "VM_Creation"],
        "DC Entry": ["DC_Entry", "Datacentre Entry", "Datacentre_Entry"],
        "Datacentre Entry": ["DC Entry", "DC_Entry"],
        "Hardware Issuance": ["Hardware_Issuance", "Hardware Issuing", "Hardware_Issuing"],
        "Hardware Replacement": ["Hardware_Replacement", "Hardware Replacing", "Hardware_Replacing"]
    }
    
    aliases = fallbacks.get(request_type, [])
    for alias in aliases:
        routing = await routings_collection.find_one({"requestType": alias})
        if routing:
            return routing

    # Fallback to case-insensitive exact match
    routing = await routings_collection.find_one({"requestType": {"$regex": f"^{request_type}$", "$options": "i"}})
    if routing:
        return routing

    # Substring search as a last resort
    routing = await routings_collection.find_one({"requestType": {"$regex": request_type, "$options": "i"}})
    return routing


def is_stage_applicable(stage: dict, request_doc: dict) -> bool:
    """Check whether a stage condition matches the request doc details."""
    c_field = stage.get("conditionField")
    c_val = stage.get("conditionValue")
    c_operator = stage.get("conditionOperator", "equals")

    # For standard operators, if condition is incomplete, assume it's always applicable
    if c_operator not in ["is_empty", "is_not_empty"]:
        if not c_field or c_val is None or str(c_val).strip() == "":
            return True
    else:
        # For is_empty/is_not_empty, we only need the field
        if not c_field:
            return True

    details = request_doc.get("details") if isinstance(request_doc.get("details"), dict) else {}

    raw_val = None
    if c_field in details and details[c_field] is not None:
        raw_val = details[c_field]
    elif c_field in request_doc and request_doc[c_field] is not None:
        raw_val = request_doc[c_field]

    if c_operator == "is_empty":
        return raw_val is None or str(raw_val).strip() == ""
    elif c_operator == "is_not_empty":
        return raw_val is not None and str(raw_val).strip() != ""

    if raw_val is None or str(raw_val).strip() == "":
        # Default fallback for networkType if unspecified
        if c_field == "networkType":
            raw_val = "Internet"
        else:
            raw_val = ""

    actual_val = str(raw_val).strip().lower()
    expected_val = str(c_val).strip().lower()

    if c_operator == "not_equals":
        return actual_val != expected_val
    else:  # equals
        return actual_val == expected_val


def get_applicable_stages(stages: List[dict], request_doc: dict) -> List[dict]:
    """Filter stages based on stage execution conditions."""
    return [s for s in stages if is_stage_applicable(s, request_doc)]


def recalculate_vm_name(doc: dict) -> dict:
    """Recalculate vmName for VM Creation requests using Purpose, OS, and IP."""
    req_type = doc.get("requestType") or doc.get("category", "")
    if req_type != "VM Creation":
        return doc

    details = doc.get("details")
    if not isinstance(details, dict):
        details = {}

    purpose = (doc.get("purpose") or "").strip().replace(" ", "")
    os_ver = (details.get("osVersion") or "").strip().replace(" ", "")
    ip_val = (details.get("ip") or "").strip()

    ip_portion = ""
    if ip_val:
        parts = [p for p in ip_val.split(".") if p]
        if len(parts) >= 2:
            ip_portion = ".".join(parts[-2:])
        else:
            ip_portion = ip_val

    name_parts = [p for p in [purpose, os_ver, ip_portion] if p]
    if name_parts:
        details["vmName"] = "_".join(name_parts)

    doc["details"] = details
    return doc


async def resolve_assignees(stage: dict, requester_username: str, request_doc: Optional[dict] = None) -> List[str]:
    """Resolve the actual usernames to assign based on the assignment type and conditional rules."""
    # Check conditional assignments if request_doc is provided
    conditional_rules = stage.get("conditionalAssignments") or []
    if conditional_rules and request_doc:
        details = request_doc.get("details") or {}
        for rule in conditional_rules:
            if not isinstance(rule, dict):
                continue
            field = rule.get("conditionField", "")
            exp_val = str(rule.get("conditionValue", "")).strip().lower()
            if not field or not exp_val:
                continue
            act_val = str(details.get(field) or request_doc.get(field) or "").strip().lower()
            if act_val == exp_val:
                # Rule matches! Resolve assignees using rule's configuration
                rule_assign_type = rule.get("assignmentType") or "Mixed"
                rule_assigned_to = rule.get("assignedTo")
                return await resolve_assignees(
                    {"assignmentType": rule_assign_type, "assignedTo": rule_assigned_to},
                    requester_username,
                    request_doc=None
                )

    assignment_type = stage.get("assignmentType", "")
    assigned_to = stage.get("assignedTo", "")

    if assignment_type == "Mixed":
        items = assigned_to if isinstance(assigned_to, list) else ([assigned_to] if isinstance(assigned_to, str) else [])
        assignees = set()
        for item in items:
            if item == "Requester":
                res = await resolve_assignees({"assignmentType": "Requester"}, requester_username)
            elif item == "RequesterDeptHead":
                res = await resolve_assignees({"assignmentType": "RequesterDeptHead"}, requester_username)
            elif item.startswith("DeptStaffs:"):
                res = await resolve_assignees({"assignmentType": "DeptStaffs", "assignedTo": item.replace("DeptStaffs:", "")}, requester_username)
            elif item.startswith("Role:"):
                res = await resolve_assignees({"assignmentType": "Role", "assignedTo": item.replace("Role:", "")}, requester_username)
            elif item.startswith("SpecificUser:"):
                res = [item.replace("SpecificUser:", "")]
            else:
                res = []
            assignees.update(res)
        return list(assignees)

    if assignment_type == "Requester":
        return [requester_username]

    elif assignment_type == "RequesterDeptHead":
        # Find the requester's department, then get department head
        user = await users_collection.find_one({"username": requester_username})
        if user and user.get("department"):
            dept_id_or_name = user["department"]
            if ObjectId.is_valid(dept_id_or_name):
                dept = await departments_collection.find_one({"_id": ObjectId(dept_id_or_name)})
            else:
                dept = await departments_collection.find_one({"name": dept_id_or_name})
            
            if dept and dept.get("departmentHead"):
                return [dept["departmentHead"]]
        return []

    elif assignment_type == "DeptStaffs":
        # Assign to all staff in the given department
        dept_name_or_id = assigned_to
        if dept_name_or_id:
            if ObjectId.is_valid(dept_name_or_id):
                dept = await departments_collection.find_one({"_id": ObjectId(dept_name_or_id)})
            else:
                dept = await departments_collection.find_one({"name": dept_name_or_id})
                
            if dept:
                staff_cursor = users_collection.find({"department": str(dept["_id"]), "status": True})
                staff_list = await staff_cursor.to_list(length=None)
                return [s["username"] for s in staff_list if s.get("username")]
        return []

    elif assignment_type == "SpecificUser":
        if assigned_to:
            return [assigned_to]
        return []

    elif assignment_type == "Role":
        role_name_or_id = assigned_to
        if role_name_or_id:
            roles_collection = db.get_collection("roles")
            if ObjectId.is_valid(role_name_or_id):
                role = await roles_collection.find_one({"_id": ObjectId(role_name_or_id)})
            else:
                role = await roles_collection.find_one({"name": role_name_or_id})
                
            if role:
                users_cursor = users_collection.find({"role": str(role["_id"]), "status": True})
                users_list = await users_cursor.to_list(length=None)
                return [u["username"] for u in users_list if u.get("username")]
        return []

    elif assignment_type == "TargetApprover":
        # Legacy: assigned_to holds the target approver username
        if assigned_to:
            return [assigned_to]
        return []

    elif assignment_type == "TargetApproverDeptStaffs":
        # Legacy: get all staffs from the target approver's department
        if assigned_to:
            user = await users_collection.find_one({"username": assigned_to})
            if user and user.get("department"):
                staff_cursor = users_collection.find({"department": user["department"], "status": True})
                staff_list = await staff_cursor.to_list(length=None)
                return [s["username"] for s in staff_list if s.get("username")]
        return []

    return []


async def deduct_inventory_on_completion(existing_request: dict, username: str):
    if not existing_request or existing_request.get("inventoryReflected"):
        return

    try:
        request_type = existing_request.get("requestType") or existing_request.get("category", "")
        if request_type == "Hardware Issuance":
            details = existing_request.get("details") or {}
            hardware_id = details.get("hardwareId")
            quantity_to_deduct = details.get("quantity")
            
            if hardware_id and quantity_to_deduct:
                try:
                    qty_to_deduct = int(quantity_to_deduct)
                except (ValueError, TypeError):
                    qty_to_deduct = 0
                
                if qty_to_deduct > 0 and ObjectId.is_valid(hardware_id):
                    inv_col = db.get_collection("inventory")
                    inv_item = await inv_col.find_one({"_id": ObjectId(hardware_id)})
                    if inv_item:
                        new_qty = max(0, inv_item.get("quantity", 0) - qty_to_deduct)
                        history = inv_item.get("history")
                        if not isinstance(history, list):
                            history = []
                        history_entry = {
                            "date": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                            "action": "issued",
                            "quantityChange": -qty_to_deduct,
                            "remainingQuantity": new_qty,
                            "user": username or "system",
                            "givenTo": existing_request.get("createdBy", "Request Completion")
                        }
                        history.append(history_entry)
                        await inv_col.update_one(
                            {"_id": ObjectId(hardware_id)},
                            {
                                "$set": {
                                    "quantity": new_qty,
                                    "lastUpdatedDate": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                                    "lastUpdatedBy": username or "system",
                                    "history": history
                                }
                            }
                        )
                        # Mark inventoryReflected = True
                        await collection.update_one({"_id": existing_request["_id"]}, {"$set": {"inventoryReflected": True}})
    except Exception as e:
        print(f"Error in deduct_inventory_on_completion: {e}")


async def add_vm_details_on_completion(existing_request: dict, username: str):
    if not existing_request or existing_request.get("vmReflected"):
        return

    try:
        request_type = existing_request.get("requestType") or existing_request.get("category", "")
        if request_type == "VM Creation":
            details = existing_request.get("details") or {}
            
            cluster_name = details.get("cluster")
            cluster_id = ""
            if cluster_name:
                clusters_col = db.get_collection("clusters")
                cluster_obj = await clusters_col.find_one({"clusterName": cluster_name})
                if cluster_obj:
                    cluster_id = str(cluster_obj.get("_id") or "")

            vms_col = db.get_collection("vm_details")

            # Auto-generate vmId if missing
            vm_id_val = details.get("vmId") or ""
            if not vm_id_val:
                max_vm_id = 0
                cursor = vms_col.find({"vmId": {"$regex": "^VM-"}}, {"vmId": 1})
                async for doc in cursor:
                    vid = doc.get("vmId", "")
                    if vid.startswith("VM-"):
                        try:
                            num = int(vid.replace("VM-", ""))
                            max_vm_id = max(max_vm_id, num)
                        except Exception:
                            pass
                vm_id_val = f"VM-{max_vm_id + 1}"

            # Determine vmName
            vm_name_val = details.get("vmName") or details.get("applications") or f"VM_{details.get('ip', '').replace('.', '_')}"

            # Determine Requester / Admin details
            requester_username = existing_request.get("createdBy") or username or "system"
            admin_name_val = ""
            admin_contact_val = details.get("adminContact") or existing_request.get("contactNo") or ""

            if requester_username and requester_username != "system":
                users_col = db.get_collection("users")
                user_obj = await users_col.find_one({"username": requester_username})
                if user_obj:
                    first_name = user_obj.get("firstName", "")
                    last_name = user_obj.get("lastName", "")
                    admin_name_val = f"{first_name} {last_name}".strip() or requester_username
                    if not admin_contact_val:
                        admin_contact_val = user_obj.get("phone") or user_obj.get("mobile") or ""

            if not admin_name_val:
                admin_name_val = existing_request.get("requesterName") or existing_request.get("userName") or requester_username or "System Admin"

            vm_data = {
                "vmId": vm_id_val,
                "vmName": vm_name_val,
                "clusterId": cluster_id,
                "ipAddress": details.get("ip") or "",
                "applications": details.get("applications") or details.get("vmName") or "Web Server",
                "node": details.get("node") or "Unknown Host",
                "osAndExpiry": details.get("osVersion") or "Ubuntu Server 22.04 LTS",
                "hdd": str(details.get("hdd") or "120"),
                "ram": str(details.get("ram") or "8"),
                "cpu": str(details.get("cpu") or "4"),
                "networkType": details.get("networkType") or "Internet",
                "backupName": details.get("backupName") or "",
                "backupNode": details.get("backupNode") or "",
                "backupStorage": details.get("backupStorage") or "",
                "backupDatastore": details.get("backupDatastore") or "",
                "datastore": details.get("datastore") or "",
                "addedToMonitoring": bool(details.get("addedToMonitoring")),
                "admin": requester_username,
                "adminName": admin_name_val,
                "adminContact": admin_contact_val,
                "createdBy": username or requester_username or "system",
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "updatedAt": datetime.now(timezone.utc).isoformat()
            }

            # Avoid duplicate VM entries
            existing_vm = await vms_col.find_one({
                "$or": [
                    {"vmName": vm_data["vmName"], "clusterId": vm_data["clusterId"]},
                    {"applications": vm_data["applications"], "clusterId": vm_data["clusterId"]}
                ]
            })
            if not existing_vm:
                await vms_col.insert_one(vm_data)
                # Sync resources on the physical host
                from vm_details import sync_node_resources
                await sync_node_resources(vm_data["node"])

            # Mark vmReflected = True
            await collection.update_one({"_id": existing_request["_id"]}, {"$set": {"vmReflected": True}})
        elif request_type == "VM Management":
            details = existing_request.get("details") or {}
            operation_type = details.get("operationType")
            if operation_type == "Delete VM":
                vm_id_str = details.get("vmId")
                if vm_id_str:
                    vms_col = db.get_collection("vm_details")
                    # Try finding by ObjectId or by vmId string
                    query = {}
                    if ObjectId.is_valid(vm_id_str):
                        query["_id"] = ObjectId(vm_id_str)
                    else:
                        query["vmId"] = vm_id_str
                    
                    vm = await vms_col.find_one(query)
                    if vm:
                        node_name = vm.get("node")
                        # Delete the VM details
                        delete_result = await vms_col.delete_one({"_id": vm["_id"]})
                        if delete_result.deleted_count == 1:
                            if node_name:
                                from vm_details import sync_node_resources
                                await sync_node_resources(node_name)
                            
                            # Log to audit logs
                            audit_col = db.get_collection("audit_logs")
                            await audit_col.insert_one({
                                "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                                "user": username or "system",
                                "ipAddress": "127.0.0.1",
                                "action": f"Deleted VM: {vm.get('vmName') or vm.get('applications') or vm_id_str}",
                                "details": f"VM deleted automatically on VM deletion request completion. VM ID: {vm.get('vmId') or vm_id_str}. Justification: {details.get('justification') or 'No justification provided'}"
                            })
                    
                    # Mark vmReflected = True
                    await collection.update_one({"_id": existing_request["_id"]}, {"$set": {"vmReflected": True}})
    except Exception as e:
        print(f"Error in add_vm_details_on_completion: {e}")


@router.get("/", response_description="List all requests", response_model=PaginatedRequestsModel, response_model_by_alias=False, dependencies=[Depends(require_privilege("View Request"))])
async def list_items(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1),
    pagination: bool = Query(True),
    search: Optional[str] = None,
    completed: Optional[bool] = Query(None),
    requestType: Optional[str] = Query(None),
    request_type: Optional[str] = Query(None),
    sortBy: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    order: str = Query("desc"),
    current_user: dict = Depends(get_current_user)
):
    conditions = []
    
    actual_request_type = requestType or request_type
    if actual_request_type:
        conditions.append({"requestType": actual_request_type})

    is_superuser = current_user.get("isSuperuser", False)
    if not is_superuser:
        username = current_user.get("sub", "")
        user_or_conditions = [
            {"createdBy": username},
            {"currentAssignedUsers": username}
        ]
        
        depts_col = db.get_collection("departments")
        depts_where_head = await depts_col.find({"departmentHead": username}).to_list(length=None)
        if depts_where_head:
            dept_names = [d["name"] for d in depts_where_head]
            dept_ids = [str(d["_id"]) for d in depts_where_head]
            dept_identifiers = dept_names + dept_ids
            
            users_col = db.get_collection("users")
            dept_users = await users_col.find({"department": {"$in": dept_identifiers}}).to_list(length=None)
            dept_usernames = [u["username"] for u in dept_users if u.get("username")]
            if dept_usernames:
                user_or_conditions.append({"createdBy": {"$in": dept_usernames}})
                
        conditions.append({
            "$or": user_or_conditions
        })

    if search:
        conditions.append({"requestType": {"$regex": search, "$options": "i"}})

    if completed is not None:
        if completed:
            conditions.append({"status": "Completed"})
        else:
            conditions.append({"status": {"$ne": "Completed"}})

    if len(conditions) > 1:
        query = {"$and": conditions}
    elif len(conditions) == 1:
        query = conditions[0]
    else:
        query = {}

    actual_sort_by = sortBy or sort_by or "createdAt"
    sort_order = 1 if order == "asc" else -1

    total = await collection.count_documents(query)
    cursor = collection.find(query).sort(actual_sort_by, sort_order)

    if pagination:
        cursor = cursor.skip(skip).limit(limit)
        items = await cursor.to_list(length=limit)
    else:
        items = await cursor.to_list(length=None)

    # Resolve full names for createdBy and currentAssignedUsers
    users_col = db.get_collection("users")
    usernames = set()
    for item in items:
        if item.get("createdBy"):
            usernames.add(item["createdBy"])
        if item.get("currentAssignedUsers"):
            usernames.update(item["currentAssignedUsers"])

    user_map = {}
    if usernames:
        users = await users_col.find({"username": {"$in": list(usernames)}}).to_list(length=None)
        for u in users:
            name = f"{u.get('firstName', '')} {u.get('lastName', '')}".strip()
            user_map[u.get("username")] = name or u.get("username")

    for item in items:
        cb = item.get("createdBy")
        if cb:
            item["createdByFullName"] = user_map.get(cb, cb)
        else:
            item["createdByFullName"] = ""
            
        cau = item.get("currentAssignedUsers")
        if cau and isinstance(cau, list):
            item["currentAssignedUsersFullName"] = [user_map.get(u, u) for u in cau]
        else:
            item["currentAssignedUsersFullName"] = []

    # Compute nextStageName for each request
    routing_cache = {}
    for item in items:
        if item.get("status") in ("Completed", "Rejected"):
            item["nextStageName"] = ""
            continue
        req_type = item.get("requestType") or item.get("category", "")
        if req_type not in routing_cache:
            routing_cache[req_type] = await get_routing_for_type(req_type)
        routing = routing_cache[req_type]
        if not routing or not routing.get("stages"):
            item["nextStageName"] = "Completed"
            continue
        sorted_stages = sorted(routing["stages"], key=lambda s: s.get("order", 0))
        applicable = get_applicable_stages(sorted_stages, item)
        curr_status = item.get("status", "")
        current_idx = next((i for i, s in enumerate(applicable) if s.get("stageName") == curr_status), item.get("currentStageIndex", 0))
        next_idx = current_idx + 1
        if next_idx >= len(applicable):
            item["nextStageName"] = "Completed"
        else:
            item["nextStageName"] = applicable[next_idx].get("stageName", "")

    return {"data": items, "total": total}


@router.get("/types", response_description="List all request types")
async def get_request_types():
    types_col = db.get_collection("request_types")
    count = await types_col.count_documents({})
    if count == 0:
        default_types = [
            {"name": "VM Creation"},
            {"name": "VM Management"},
            {"name": "DC Entry"},
            {"name": "Hardware Issuance"},
            {"name": "Hardware Replacement"}
        ]
        await types_col.insert_many(default_types)
    
    cursor = types_col.find({})
    types = await cursor.to_list(length=100)
    return [{"id": str(t["_id"]), "name": t["name"]} for t in types]


@router.post("/types", response_description="Create a new request type")
async def create_request_type(payload: dict = Body(...), current_user: dict = Depends(get_current_user)):
    name = payload.get("name")
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
        
    types_col = db.get_collection("request_types")
    existing = await types_col.find_one({"name": {"$regex": f"^{name}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=400, detail=f"Request type '{name}' already exists")
        
    res = await types_col.insert_one({"name": name})
    return {"id": str(res.inserted_id), "name": name}


@router.put("/types/{id}", response_description="Update a request type")
async def update_request_type(id: str, payload: dict = Body(...), current_user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")
    name = payload.get("name")
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    types_col = db.get_collection("request_types")
    existing = await types_col.find_one({"name": {"$regex": f"^{name}$", "$options": "i"}, "_id": {"$ne": ObjectId(id)}})
    if existing:
        raise HTTPException(status_code=400, detail=f"Request type '{name}' already exists")
    await types_col.update_one({"_id": ObjectId(id)}, {"$set": {"name": name}})
    return {"id": id, "name": name}


@router.delete("/types/{id}", response_description="Delete a request type")
async def delete_request_type(id: str, current_user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")
    types_col = db.get_collection("request_types")
    res = await types_col.delete_one({"_id": ObjectId(id)})
    if res.deleted_count == 1:
        return {"message": "Request type deleted successfully"}
    raise HTTPException(status_code=404, detail="Request type not found")


@router.get("/visitor-logs", response_description="List all visitor logs", dependencies=[Depends(require_privilege("View Visitor Logs"))])
async def list_visitor_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1),
    search: Optional[str] = None
):
    query = {}
    if search:
        query["$or"] = [
            {"visitorName": {"$regex": search, "$options": "i"}},
            {"division": {"$regex": search, "$options": "i"}},
            {"purpose": {"$regex": search, "$options": "i"}},
            {"itemsToBring": {"$regex": search, "$options": "i"}}
        ]
    
    col = db.get_collection("visitor_logs")
    total = await col.count_documents(query)
    cursor = col.find(query).sort("entryTime", -1).skip(skip).limit(limit)
    items = await cursor.to_list(length=limit)
    
    departments_col = db.get_collection("departments")
    dept_map = {}
    
    for item in items:
        item["_id"] = str(item["_id"])
        div = item.get("division")
        if div and ObjectId.is_valid(div):
            if div not in dept_map:
                dept = await departments_col.find_one({"_id": ObjectId(div)})
                dept_map[div] = dept.get("name", div) if dept else div
            item["division"] = dept_map[div]
            
    return {"data": items, "total": total}

@router.post("/visitor-logs", response_description="Create a new visitor log", status_code=status.HTTP_201_CREATED)
async def create_visitor_log(
    payload: VisitorLogCreate = Body(...),
    current_user: dict = Depends(get_current_user),
    _auth = Depends(require_privilege("Create Visitor Logs"))
):
    col = db.get_collection("visitor_logs")
    log_dict = payload.model_dump()
    log_dict["loggedBy"] = current_user.get("sub", "system")
    log_dict["createdAt"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    
    res = await col.insert_one(log_dict)
    log_dict["_id"] = str(res.inserted_id)
    
    from notification_helper import log_page_update
    await log_page_update("visitor-logs", username=current_user.get("sub", ""))
    return log_dict

@router.put("/visitor-logs/{id}", response_description="Update a visitor log")
async def update_visitor_log(
    id: str,
    payload: VisitorLogUpdate = Body(...),
    current_user: dict = Depends(get_current_user),
    _auth = Depends(require_privilege("Update Visitor Logs"))
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")
    
    col = db.get_collection("visitor_logs")
    existing = await col.find_one({"_id": ObjectId(id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Visitor log not found")
        
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if update_data:
        await col.update_one({"_id": ObjectId(id)}, {"$set": update_data})
        
    refreshed = await col.find_one({"_id": ObjectId(id)})
    refreshed["_id"] = str(refreshed["_id"])
    
    from notification_helper import log_page_update
    await log_page_update("visitor-logs", username=current_user.get("sub", ""))
    return refreshed

@router.delete("/visitor-logs/{id}", response_description="Delete a visitor log")
async def delete_visitor_log(
    id: str,
    current_user: dict = Depends(get_current_user),
    _auth = Depends(require_privilege("Delete Visitor Logs"))
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")
        
    col = db.get_collection("visitor_logs")
    res = await col.delete_one({"_id": ObjectId(id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Visitor log not found")
        
    from notification_helper import log_page_update
    await log_page_update("visitor-logs", username=current_user.get("sub", ""))
    return {"message": "Visitor log deleted successfully"}



@router.get("/{id}/logs", response_description="Get history logs for a request", dependencies=[Depends(require_privilege("View Request"))])
async def get_request_logs(id: str, current_user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")
    logs_col = db.get_collection("request_logs")
    cursor = logs_col.find({"requestId": id}).sort("timestamp", 1)
    logs = await cursor.to_list(length=None)
    for log in logs:
        log["_id"] = str(log["_id"])
    return logs


@router.post("/upload-stage-file", response_description="Upload PDF attachment for a request stage")
async def upload_stage_file(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    if not file.filename.lower().endswith((".pdf", ".doc", ".docx", ".png", ".jpg", ".jpeg")):
        raise HTTPException(status_code=400, detail="Only PDF and standard document files are allowed")
    
    base_dir = "uploads/request_stages"
    os.makedirs(base_dir, exist_ok=True)
    
    timestamp = int(datetime.now().timestamp())
    clean_filename = re.sub(r'[^\w\.-]', '_', file.filename)
    unique_name = f"{timestamp}_{clean_filename}"
    file_path = os.path.join(base_dir, unique_name)
    
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
        
    return {
        "fileUrl": f"/uploads/request_stages/{unique_name}",
        "fileName": file.filename
    }


@router.get("/stage-info/{request_type}/{stage_name}", response_description="Get stage info including attachments")
async def get_stage_info(request_type: str, stage_name: str, current_user: dict = Depends(get_current_user)):
    routing = await get_routing_for_type(request_type)
    if not routing or not routing.get("stages"):
        return {"stage": None}
    
    for s in routing["stages"]:
        if s.get("stageName") == stage_name:
            return {"stage": s}
            
    return {"stage": None}


@router.get("/stages/{request_type}", response_description="Get stages for a request type", dependencies=[Depends(require_privilege("View Request"))])
async def get_stages(request_type: str, current_user: dict = Depends(get_current_user)):
    """Return the configured stages for a given request type."""
    routing = await get_routing_for_type(request_type)
    if not routing:
        return {"stages": []}
    stages = routing.get("stages", [])
    return {"stages": [s.get("stageName", "") for s in stages]}


@router.post("/", response_description="Create a request", response_model=RequestModel, status_code=status.HTTP_201_CREATED, response_model_by_alias=False, dependencies=[Depends(require_privilege("Create Request"))])
async def create_item(
    payload: CreateRequestModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    item_dict = payload.model_dump()
    requester = current_user.get("sub", "")
    item_dict["createdBy"] = requester
    now = datetime.now(timezone.utc).isoformat()
    item_dict["createdAt"] = now
    item_dict["updatedAt"] = now
    item_dict["requestId"] = await get_next_sequence("requests_sequence", "REQ")
    item_dict = recalculate_vm_name(item_dict)

    # Look up the routing configuration for this request type
    routing = await get_routing_for_type(payload.requestType)

    if routing and routing.get("stages"):
        sorted_stages = sorted(routing["stages"], key=lambda s: s.get("order", 0))
        stages = get_applicable_stages(sorted_stages, item_dict)
        if stages:
            first_stage = stages[0]
            item_dict["status"] = first_stage.get("stageName", "Pending")
            item_dict["currentStageIndex"] = 0

            # Resolve assignees for the first stage
            assignees = await resolve_assignees(first_stage, requester, request_doc=item_dict)
            item_dict["currentAssignedUsers"] = assignees
        else:
            item_dict["status"] = "Pending"
            item_dict["currentStageIndex"] = 0
            item_dict["currentAssignedUsers"] = []
    else:
        item_dict["status"] = "Pending"
        item_dict["currentStageIndex"] = 0
        item_dict["currentAssignedUsers"] = []

    new_item = await collection.insert_one(item_dict)
    created = await collection.find_one({"_id": new_item.inserted_id})
    if created:
        await log_request_action(
            request_id=str(created["_id"]),
            action="Created",
            details=f"Request created with status '{created.get('status')}'",
            username=requester
        )
        if created.get("status") == "Completed":
            await add_visitor_log_on_completion(created, requester)
        from notification_helper import log_page_update
        await log_page_update("requests", username=requester)
        if created.get("requestType") == "DC Entry":
            await log_page_update("visitor-logs", username=requester)
        if routing and routing.get("stages") and 'first_stage' in locals() and first_stage:
            await send_stage_email_notification(
                stage=first_stage,
                request_doc=created,
                action_type="Created",
                actor_username=requester
            )
    return created


@router.put("/{id}", response_description="Update a request", response_model=RequestModel, response_model_by_alias=False)
async def update_item(id: str, payload: UpdateRequestModel = Body(...), current_user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    existing = await collection.find_one({"_id": ObjectId(id)})
    if not existing:
        raise HTTPException(status_code=404, detail=f"Request {id} not found")

    # Authorize: superuser OR has 'Update Request' OR is currently assigned to this request
    is_superuser = current_user.get("isSuperuser", False)
    username = current_user.get("sub", "")
    privileges = current_user.get("privileges", [])
    assigned_users = existing.get("currentAssignedUsers") or []
    is_own_stage1 = existing.get("createdBy") == username and existing.get("currentStageIndex", 0) == 0

    if not is_superuser and "Update Request" not in privileges and username not in assigned_users and not is_own_stage1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to update this request. Must be superuser, have 'Update Request' privilege, be assigned to this request, or be the creator in Stage 1."
        )

    item_dict = {k: v for k, v in payload.model_dump().items() if v is not None}
    item_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()
    merged_details = {**(existing.get("details") or {}), **(item_dict.get("details") or {})}
    merged_doc = recalculate_vm_name({**existing, **item_dict, "details": merged_details})
    if "details" in merged_doc:
        item_dict["details"] = merged_doc["details"]

    # If status is being changed, handle stage progression
    new_status = item_dict.get("status")
    old_status = existing.get("status")
    status_changed = False
    if new_status and new_status != old_status:
        if not is_superuser and username not in assigned_users:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only currently assigned users can change the status."
            )
        status_changed = True
        request_type = existing.get("requestType") or existing.get("category", "")
        routing = await get_routing_for_type(request_type)

        if routing and routing.get("stages"):
            sorted_stages = sorted(routing["stages"], key=lambda s: s.get("order", 0))
            merged_doc = {**existing, **item_dict}
            stages = get_applicable_stages(sorted_stages, merged_doc)
            stage_names = [s.get("stageName", "") for s in stages]

            if new_status in stage_names:
                new_index = stage_names.index(new_status)
                item_dict["currentStageIndex"] = new_index
                target_stage = stages[new_index]

                # Resolve assignees for the new stage
                requester = existing.get("createdBy", "")
                assignees = await resolve_assignees(stages[new_index], requester, request_doc=merged_doc)
                item_dict["currentAssignedUsers"] = assignees
            elif new_status in ["Completed", "Rejected"]:
                # Terminal status
                item_dict["currentAssignedUsers"] = []
                item_dict["currentStageIndex"] = len(stages)
                target_stage = next((s for s in stages if s.get("stageName") == new_status), None)

    update_result = await collection.update_one(
        {"_id": ObjectId(id)}, {"$set": item_dict}
    )

    updated = await collection.find_one({"_id": ObjectId(id)})
    if updated:
        if updated.get("status") == "Completed":
            await deduct_inventory_on_completion(updated, username)
            await add_vm_details_on_completion(updated, username)
            await add_visitor_log_on_completion(updated, username)
            updated = await collection.find_one({"_id": ObjectId(id)})
        
        # Log update action
        if status_changed:
            action = f"Status Transition ({new_status})"
            details = f"Status changed from '{old_status}' to '{new_status}'"
        else:
            action = "Update"
            details = "Request details updated"
        await log_request_action(
            request_id=id,
            action=action,
            details=details,
            username=username,
            remarks=payload.remarks
        )
        from notification_helper import log_page_update
        await log_page_update("requests", username=username)
        if updated.get("requestType") == "DC Entry":
            await log_page_update("visitor-logs", username=username)
        if status_changed and 'target_stage' in locals() and target_stage:
            await send_stage_email_notification(
                stage=target_stage,
                request_doc=updated,
                action_type="Status Changed",
                actor_username=username,
                remarks=payload.remarks
            )
    return updated


@router.get("/{id}/next-assignees", response_description="Get assignees for next stage")
async def get_next_assignees(id: str, current_user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    existing = await collection.find_one({"_id": ObjectId(id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Request not found")

    request_type = existing.get("requestType") or existing.get("category", "")
    routing = await get_routing_for_type(request_type)
    if not routing or not routing.get("stages"):
        return {"assignees": []}

    sorted_stages = sorted(routing["stages"], key=lambda s: s.get("order", 0))
    stages = get_applicable_stages(sorted_stages, existing)
    curr_status = existing.get("status", "")
    current_index = next((i for i, s in enumerate(stages) if s.get("stageName") == curr_status), existing.get("currentStageIndex", 0))
    next_index = current_index + 1

    if next_index >= len(stages):
        return {"assignees": []}

    next_stage = stages[next_index]
    assignment_type = next_stage.get("assignmentType", "")
    assigned_to = next_stage.get("assignedTo", "")

    if assignment_type == "Mixed":
        items = assigned_to if isinstance(assigned_to, list) else ([assigned_to] if isinstance(assigned_to, str) else [])
        if len(items) > 1:
            return {"assignees": items, "isGroup": True, "nextStageName": next_stage.get("stageName", "")}
            
    return {"assignees": [], "isGroup": False, "nextStageName": next_stage.get("stageName", "")}

@router.put("/{id}/advance", response_description="Advance request to next stage", response_model=RequestModel, response_model_by_alias=False)
async def advance_stage(id: str, payload: Optional[dict] = Body(default=None), current_user: dict = Depends(get_current_user)):
    """Advance the request to the next stage in the routing configuration."""
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    existing = await collection.find_one({"_id": ObjectId(id)})
    if not existing:
        raise HTTPException(status_code=404, detail=f"Request {id} not found")

    # Authorize: superuser OR has 'Update Request' OR is currently assigned to this request
    is_superuser = current_user.get("isSuperuser", False)
    username = current_user.get("sub", "")
    privileges = current_user.get("privileges", [])
    assigned_users = existing.get("currentAssignedUsers") or []

    if not is_superuser and username not in assigned_users:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to advance this request. Must be superuser or be assigned to this request."
        )

    # If payload is provided, update those fields first
    if payload:
        update_fields = {}
        if "details" in payload:
            existing_details = existing.get("details") or {}
            if isinstance(existing_details, dict) and isinstance(payload["details"], dict):
                update_fields["details"] = {**existing_details, **payload["details"]}
            else:
                update_fields["details"] = payload["details"]
            merged_doc = recalculate_vm_name({**existing, "details": update_fields["details"]})
            update_fields["details"] = merged_doc["details"]
        if "remarks" in payload:
            update_fields["remarks"] = payload["remarks"]
        if update_fields:
            await collection.update_one({"_id": ObjectId(id)}, {"$set": update_fields})
            existing = await collection.find_one({"_id": ObjectId(id)})

    request_type = existing.get("requestType") or existing.get("category", "")
    routing = await get_routing_for_type(request_type)

    if not routing or not routing.get("stages"):
        routing = {
            "requestType": request_type,
            "stages": [
                {
                    "stageName": "Pending Approval",
                    "order": 1,
                    "assignmentType": "Role",
                    "assignedTo": "Admin"
                },
                {
                    "stageName": "Completed",
                    "order": 2,
                    "assignmentType": "Role",
                    "assignedTo": "Admin"
                }
            ]
        }

    sorted_stages = sorted(routing["stages"], key=lambda s: s.get("order", 0))
    stages = get_applicable_stages(sorted_stages, existing)
    curr_status = existing.get("status", "")
    current_index = next((i for i, s in enumerate(stages) if s.get("stageName") == curr_status), existing.get("currentStageIndex", 0))
    next_index = current_index + 1

    if request_type in ["VM Creation", "VM Management"] and ("creation" in curr_status.lower() or "created" in curr_status.lower()):
        details = existing.get("details") or {}
        target_name = details.get("vmName") or details.get("applications") or f"VM_{details.get('ip', '').replace('.', '_')}"
        
        cluster_name = details.get("cluster")
        if cluster_name:
            clusters_col = db.get_collection("clusters")
            cluster_obj = await clusters_col.find_one({"clusterName": cluster_name})
            vc_ip = cluster_obj.get("ipAddress") if cluster_obj else None
            
            if vc_ip:
                vc_col = db.get_collection("vcenter_details")
                vc = await vc_col.find_one({"ipAddress": vc_ip})
                
                if vc:
                    from services.vcenter.session_manager import vcenter_session_manager
                    from services.vcenter.inventory_service import vcenter_inventory_service
                    
                    try:
                        session_id = await vcenter_session_manager.get_session(vc["ipAddress"], vc["username"], vc["password"])
                        if session_id:
                            all_vms = await vcenter_inventory_service.get_vms(vc["ipAddress"], session_id, cluster_id=None)
                            
                            matched_vm_id = None
                            for vm in all_vms:
                                vm_name_vc = vm.get("name") or vm.get("vmName") or ""
                                if vm_name_vc.lower() == target_name.lower():
                                    matched_vm_id = vm.get("vm") or vm.get("vm_id") or vm.get("id")
                                    break
                                    
                            if not matched_vm_id:
                                raise HTTPException(status_code=400, detail=f"VM '{target_name}' is not yet created in vCenter. Cannot advance stage.")
                                
                            # If created, give vm id to the app vm same as of the vcenter vm
                            update_fields_details = details.copy()
                            update_fields_details["vmId"] = matched_vm_id
                            await collection.update_one({"_id": ObjectId(id)}, {"$set": {"details": update_fields_details}})
                            existing["details"] = update_fields_details
                    except HTTPException:
                        raise
                    except Exception as e:
                        import logging
                        logging.getLogger("requests_router").error(f"Error checking VM creation in vCenter: {e}")
                        raise HTTPException(status_code=500, detail=f"Error communicating with vCenter: {e}")

    if next_index >= len(stages):
        # All stages completed
        update_data = {
            "status": "Completed",
            "currentStageIndex": len(stages),
            "currentAssignedUsers": [],
            "updatedAt": datetime.now(timezone.utc).isoformat()
        }
    else:
        next_stage = stages[next_index]
        requester = existing.get("createdBy", "")
        if payload and payload.get("selectedAssignee"):
            selected = payload["selectedAssignee"]
            temp_stage = {"assignmentType": "Mixed", "assignedTo": [selected]}
            assignees = await resolve_assignees(temp_stage, requester)
        else:
            assignees = await resolve_assignees(next_stage, requester, request_doc=existing)
                
        update_data = {
            "status": next_stage.get("stageName", ""),
            "currentStageIndex": next_index,
            "currentAssignedUsers": assignees,
            "updatedAt": datetime.now(timezone.utc).isoformat()
        }

    old_status = existing.get("status")
    await collection.update_one({"_id": ObjectId(id)}, {"$set": update_data})
    updated = await collection.find_one({"_id": ObjectId(id)})
    if updated:
        if updated.get("status") == "Completed":
            await deduct_inventory_on_completion(updated, username)
            await add_vm_details_on_completion(updated, username)
            await add_visitor_log_on_completion(updated, username)
            updated = await collection.find_one({"_id": ObjectId(id)})
        
        # Log advance action
        new_status = updated.get("status")
        remarks = payload.get("remarks") if payload else None
        terms_note = " (Agreed stage terms & conditions)" if payload and payload.get("termsAgreed") else ""
        await log_request_action(
            request_id=id,
            action=f"Advanced ({new_status})",
            details=f"Request advanced from stage '{old_status}' to '{new_status}'{terms_note}",
            username=username,
            remarks=remarks
        )
        from notification_helper import log_page_update
        await log_page_update("requests", username=username)
        if updated.get("requestType") == "DC Entry":
            await log_page_update("visitor-logs", username=username)
        if next_index < len(stages):
            await send_stage_email_notification(
                stage=stages[next_index],
                request_doc=updated,
                action_type="Advanced",
                actor_username=username,
                remarks=remarks
            )
        else:
            completed_stage = next((s for s in stages if s.get("stageName") == "Completed"), None)
            if completed_stage:
                await send_stage_email_notification(
                    stage=completed_stage,
                    request_doc=updated,
                    action_type="Completed",
                    actor_username=username,
                    remarks=remarks
                )
    return updated


@router.post("/{id}/backward", response_description="Send request back to previous stage", response_model=RequestModel, response_model_by_alias=False)
async def backward_stage(
    id: str,
    payload: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    existing = await collection.find_one({"_id": ObjectId(id)})
    if not existing:
        raise HTTPException(status_code=404, detail=f"Request {id} not found")

    is_superuser = current_user.get("isSuperuser", False)
    username = current_user.get("sub", "")
    privileges = current_user.get("privileges", [])
    assigned_users = existing.get("currentAssignedUsers") or []

    if not is_superuser and username not in assigned_users:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to send back this request. Must be superuser or be assigned to this request."
        )

    reason = payload.get("reason")
    if not reason:
        raise HTTPException(status_code=400, detail="Reason is required")

    request_type = existing.get("requestType") or existing.get("category", "")
    routing = await get_routing_for_type(request_type)

    if not routing or not routing.get("stages"):
        raise HTTPException(status_code=400, detail="No routing stages configured for this request type")

    sorted_stages = sorted(routing["stages"], key=lambda s: s.get("order", 0))
    stages = get_applicable_stages(sorted_stages, existing)
    curr_status = existing.get("status", "")
    current_index = next((i for i, s in enumerate(stages) if s.get("stageName") == curr_status), existing.get("currentStageIndex", 0))
    
    prev_index = current_index - 1

    if prev_index < 0:
        raise HTTPException(status_code=400, detail="Request is already at the first stage")

    prev_stage = stages[prev_index]
    requester = existing.get("createdBy", "")
    assignees = await resolve_assignees(prev_stage, requester, request_doc=existing)
    
    update_data = {
        "status": prev_stage.get("stageName", ""),
        "currentStageIndex": prev_index,
        "currentAssignedUsers": assignees,
        "updatedAt": datetime.now(timezone.utc).isoformat()
    }

    old_status = existing.get("status")
    await collection.update_one({"_id": ObjectId(id)}, {"$set": update_data})
    
    updated = await collection.find_one({"_id": ObjectId(id)})
    if updated:
        new_status = updated.get("status")
        local_time_formatted = datetime.now().strftime("%Y-%m-%d %I:%M %p")
        details = f"Request sent back from stage '{old_status}' to '{new_status}' at {local_time_formatted}. Reason: {reason}"
        
        await log_request_action(
            request_id=id,
            action=f"Sent Back ({new_status})",
            details=details,
            username=username,
            remarks=reason
        )
        from notification_helper import log_page_update
        await log_page_update("requests", username=username)
        if updated.get("requestType") == "DC Entry":
            await log_page_update("visitor-logs", username=username)
        await send_stage_email_notification(
            stage=prev_stage,
            request_doc=updated,
            action_type="Sent Back",
            actor_username=username,
            remarks=reason
        )
            
    return updated


@router.delete("/{id}", response_description="Delete a request")
async def delete_item(id: str, current_user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    existing = await collection.find_one({"_id": ObjectId(id)})
    if not existing:
        raise HTTPException(status_code=404, detail=f"Request {id} not found")

    is_superuser = current_user.get("isSuperuser", False)
    username = current_user.get("sub", "")
    privileges = current_user.get("privileges", [])
    is_own_stage1 = existing.get("createdBy") == username and existing.get("currentStageIndex", 0) == 0

    if not is_superuser and "Delete Request" not in privileges and not is_own_stage1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to delete this request. Must be stage 1 of your own request, or have Delete Request privilege."
        )

    delete_result = await collection.delete_one({"_id": ObjectId(id)})

    if delete_result.deleted_count == 1:
        return JSONResponse(status_code=status.HTTP_200_OK, content={"message": "Deleted successfully"})

    raise HTTPException(status_code=404, detail=f"Request {id} not found")
