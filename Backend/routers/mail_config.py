import logging
from typing import Optional, List
from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel, Field
from database import db
from auth_utils import require_privilege, get_current_user

router = APIRouter()
logger = logging.getLogger("mail_config.router")

class MailConfigSchema(BaseModel):
    host: str = Field(..., description="SMTP server hostname or IP")
    port: int = Field(..., description="SMTP server port")
    username: str = Field(..., description="SMTP login username")
    password: str = Field(..., description="SMTP login password")
    fromEmail: str = Field(..., description="Sender from email address")
    useTls: bool = Field(False, description="Enable TLS connection")
    useSsl: bool = Field(False, description="Enable SSL connection")
    savedEmails: Optional[List[str]] = Field(default=[], description="List of general saved emails")
    savedEmailsRoster: Optional[List[str]] = Field(default=[], description="List of default emails for roster")
    savedEmailsDailyChecklist: Optional[List[str]] = Field(default=[], description="List of default emails for daily/cluster checklist")
    savedEmailsBmsChecklist: Optional[List[str]] = Field(default=[], description="List of default emails for BMS checklist")
    savedEmailsAccounts: Optional[List[str]] = Field(default=[], description="List of default emails for accounts/salary")
    savedEmailsIncident: Optional[List[str]] = Field(default=[], description="List of default emails for incidents")
    rosterMailEnabled: Optional[bool] = Field(default=True, description="Enable roster mail send feature")
    dailyChecklistMailEnabled: Optional[bool] = Field(default=True, description="Enable daily/cluster checklist mail send feature")
    bmsChecklistMailEnabled: Optional[bool] = Field(default=True, description="Enable BMS checklist mail send feature")
    accountsMailEnabled: Optional[bool] = Field(default=True, description="Enable accounts/salary mail send feature")
    incidentMailEnabled: Optional[bool] = Field(default=True, description="Enable incident mail send feature")

class TestMailSchema(BaseModel):
    toEmail: str = Field(..., description="Recipient email address")
    subject: Optional[str] = Field("Test Connection Email", description="Subject line for testing")
    body: Optional[str] = Field("This is a test email from Datacentre Management System (DCM).", description="Email body text")

@router.get("/", response_description="Get Mail Configuration", dependencies=[Depends(require_privilege("Mail Config View"))])
async def get_mail_config():
    config_col = db.get_collection("mail_config")
    config = await config_col.find_one({"_id": "mail_config"})
    if not config:
        # Default fallback (Gmail online server config for development)
        config = {
            "_id": "mail_config",
            "host": "smtp.gmail.com",
            "port": 587,
            "username": "vssc.dcm.dev@gmail.com",
            "password": "your_gmail_app_password",
            "fromEmail": "vssc.dcm.dev@gmail.com",
            "useTls": True,
            "useSsl": False,
            "savedEmails": [],
            "savedEmailsRoster": [],
            "savedEmailsDailyChecklist": [],
            "savedEmailsBmsChecklist": [],
            "savedEmailsAccounts": [],
            "savedEmailsIncident": [],
            "rosterMailEnabled": True,
            "dailyChecklistMailEnabled": True,
            "bmsChecklistMailEnabled": True,
            "accountsMailEnabled": True,
            "incidentMailEnabled": True
        }
        await config_col.insert_one(config)
    
    config["_id"] = str(config["_id"])
    if "savedEmails" not in config:
        config["savedEmails"] = []
    if "savedEmailsRoster" not in config:
        config["savedEmailsRoster"] = []
    if "savedEmailsDailyChecklist" not in config:
        config["savedEmailsDailyChecklist"] = []
    if "savedEmailsBmsChecklist" not in config:
        config["savedEmailsBmsChecklist"] = []
    if "savedEmailsAccounts" not in config:
        config["savedEmailsAccounts"] = []
    if "savedEmailsIncident" not in config:
        config["savedEmailsIncident"] = []
    if "rosterMailEnabled" not in config:
        config["rosterMailEnabled"] = True
    if "dailyChecklistMailEnabled" not in config:
        config["dailyChecklistMailEnabled"] = True
    if "bmsChecklistMailEnabled" not in config:
        config["bmsChecklistMailEnabled"] = True
    if "accountsMailEnabled" not in config:
        config["accountsMailEnabled"] = True
    if "incidentMailEnabled" not in config:
        config["incidentMailEnabled"] = True
    return config

@router.put("/", response_description="Update Mail Configuration", dependencies=[Depends(require_privilege("Mail Config Update"))])
async def update_mail_config(payload: MailConfigSchema):
    config_col = db.get_collection("mail_config")
    
    update_data = {
        "host": payload.host,
        "port": payload.port,
        "username": payload.username,
        "password": payload.password,
        "fromEmail": payload.fromEmail,
        "useTls": payload.useTls,
        "useSsl": payload.useSsl,
        "savedEmails": payload.savedEmails or [],
        "savedEmailsRoster": payload.savedEmailsRoster or [],
        "savedEmailsDailyChecklist": payload.savedEmailsDailyChecklist or [],
        "savedEmailsBmsChecklist": payload.savedEmailsBmsChecklist or [],
        "savedEmailsAccounts": payload.savedEmailsAccounts or [],
        "savedEmailsIncident": payload.savedEmailsIncident or [],
        "rosterMailEnabled": payload.rosterMailEnabled if payload.rosterMailEnabled is not None else True,
        "dailyChecklistMailEnabled": payload.dailyChecklistMailEnabled if payload.dailyChecklistMailEnabled is not None else True,
        "bmsChecklistMailEnabled": payload.bmsChecklistMailEnabled if payload.bmsChecklistMailEnabled is not None else True,
        "accountsMailEnabled": payload.accountsMailEnabled if payload.accountsMailEnabled is not None else True,
        "incidentMailEnabled": payload.incidentMailEnabled if payload.incidentMailEnabled is not None else True
    }
    
    await config_col.update_one(
        {"_id": "mail_config"},
        {"$set": update_data},
        upsert=True
    )
    return {"message": "Mail configuration updated successfully", "config": update_data}

@router.get("/roster-mail-enabled", response_description="Check if roster email is enabled")
async def is_roster_mail_enabled(current_user: dict = Depends(get_current_user)):
    config_col = db.get_collection("mail_config")
    config = await config_col.find_one({"_id": "mail_config"})
    if not config:
        return {"enabled": True}
    return {"enabled": config.get("rosterMailEnabled", True)}

@router.get("/checklist-mail-enabled", response_description="Check if checklist emails are enabled")
async def is_checklist_mail_enabled(current_user: dict = Depends(get_current_user)):
    config_col = db.get_collection("mail_config")
    config = await config_col.find_one({"_id": "mail_config"})
    if not config:
        return {"dailyEnabled": True, "bmsEnabled": True}
    return {
        "dailyEnabled": config.get("dailyChecklistMailEnabled", True),
        "bmsEnabled": config.get("bmsChecklistMailEnabled", True)
    }

@router.get("/accounts-mail-enabled", response_description="Check if accounts email is enabled")
async def is_accounts_mail_enabled(current_user: dict = Depends(get_current_user)):
    config_col = db.get_collection("mail_config")
    config = await config_col.find_one({"_id": "mail_config"})
    if not config:
        return {"enabled": True}
    return {"enabled": config.get("accountsMailEnabled", True)}

@router.get("/saved-emails", response_description="Get list of saved emails")
async def get_saved_emails(
    module: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    config_col = db.get_collection("mail_config")
    config = await config_col.find_one({"_id": "mail_config"})
    if not config:
        return []
    
    if module == "roster":
        val = config.get("savedEmailsRoster")
        if val is not None and len(val) > 0:
            return val
    elif module == "daily" or module == "daily_checklist" or module == "cluster":
        val = config.get("savedEmailsDailyChecklist")
        if val is not None and len(val) > 0:
            return val
    elif module == "bms" or module == "bms_checklist":
        val = config.get("savedEmailsBmsChecklist")
        if val is not None and len(val) > 0:
            return val
    elif module == "accounts" or module == "salary":
        val = config.get("savedEmailsAccounts")
        if val is not None and len(val) > 0:
            return val
    elif module == "incident" or module == "observation_incident":
        val = config.get("savedEmailsIncident")
        if val is not None and len(val) > 0:
            return val

    return config.get("savedEmails", [])

@router.get("/last-sent", response_description="Get last sent emails for a department")
async def get_last_sent_email(
    department: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    col = db.get_collection("last_sent_emails")
    doc = await col.find_one({"_id": department})
    if not doc:
        return {"emails": ""}
    return {"emails": doc.get("emails", "")}

@router.post("/test", response_description="Send a test email", dependencies=[Depends(require_privilege("Mail Config Update"))])
async def test_send_mail(payload: TestMailSchema):
    from mail_utils import send_email
    try:
        await send_email(
            to_emails=[payload.toEmail],
            subject=payload.subject,
            body=payload.body
        )
        return {"success": True, "message": f"Test email successfully sent to {payload.toEmail}"}
    except Exception as e:
        logger.error(f"Failed to send test email: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send email: {str(e)}"
        )
