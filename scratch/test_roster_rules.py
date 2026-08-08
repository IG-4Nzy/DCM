import asyncio
import sys
from datetime import datetime, timezone
sys.path.append("/home/vssc/Desktop/DCM/Backend")

from database import db
from models import RoasterStatusModel

async def test_workflow():
    print("--- STARTING WORKFLOW TESTS ---")
    mail_config_col = db.get_collection("mail_config")
    roaster_status_col = db.get_collection("roaster_status")
    last_sent_col = db.get_collection("last_sent_emails")

    # 1. Update/Setup Mail Config
    print("1. Testing Mail Config Save & Fetch...")
    await mail_config_col.update_one(
        {"_id": "mail_config"},
        {"$set": {
            "host": "localhost",
            "port": 1025,
            "username": "test_user",
            "password": "test_password",
            "fromEmail": "noreply@dcm.local",
            "useTls": False,
            "useSsl": False,
            "savedEmails": ["test1@vssc.gov.in", "test2@vssc.gov.in", "test3@vssc.gov.in"]
        }},
        upsert=True
    )
    
    config = await mail_config_col.find_one({"_id": "mail_config"})
    print("Saved Emails in DB:", config.get("savedEmails"))
    assert config.get("savedEmails") == ["test1@vssc.gov.in", "test2@vssc.gov.in", "test3@vssc.gov.in"], "Saved emails mismatch"

    # 2. Testing Send Email Rules on Roster
    print("\n2. Testing Roster Email Approval Rules...")
    week_start = "2026-08-10"
    dept = "General"

    # Reset any existing status
    await roaster_status_col.delete_many({"weekStartDate": week_start, "department": dept})

    # Try sending before approval/status exists
    print("Attempting to send unapproved roster email...")
    from roasters import send_roster_email
    from fastapi import HTTPException

    try:
        # Mock payload
        payload = {"emails": "recipient@vssc.gov.in", "department": dept, "weekStartDate": week_start}
        await send_roster_email(payload=payload, current_user={"sub": "admin", "isSuperuser": True})
        print("FAIL: Sent unapproved roster email without error!")
    except HTTPException as e:
        print(f"SUCCESS: Caught expected error for unapproved roster: {e.status_code} - {e.detail}")
        assert e.status_code == 400
        assert "must be approved" in e.detail

    # Approve the roster
    print("Setting roster status to Approved...")
    await roaster_status_col.update_one(
        {"weekStartDate": week_start, "department": dept},
        {"$set": {
            "status": "Approved",
            "updatedByFullName": "Admin Test",
            "updatedAt": datetime.now(timezone.utc).isoformat(),
            "emailSent": False
        }},
        upsert=True
    )

    # Send approved roster email
    print("Attempting to send approved roster email...")
    # Mock send_email in mail_utils to prevent actual SMTP connection failure in test
    import mail_utils
    original_send_email = mail_utils.send_email
    async def mock_send_email(*args, **kwargs):
        print(f"Mocked send_email called with: to={kwargs.get('to_emails')}, subject={kwargs.get('subject')}")
        return True
    mail_utils.send_email = mock_send_email

    try:
        payload = {"emails": "recipient@vssc.gov.in", "department": dept, "weekStartDate": week_start}
        res = await send_roster_email(payload=payload, current_user={"sub": "admin", "isSuperuser": True})
        print("Roster email API response:", res)
        assert res.get("success") is True
    except Exception as e:
        print("FAIL: Failed to send approved email:", e)
        raise e

    # Verify emailSent set to True
    status_doc = await roaster_status_col.find_one({"weekStartDate": week_start, "department": dept})
    print("Roster status after first send:", status_doc.get("status"), "emailSent:", status_doc.get("emailSent"))
    assert status_doc.get("emailSent") is True

    # Try sending again (should be blocked)
    print("Attempting to send roster email a second time...")
    try:
        payload = {"emails": "recipient@vssc.gov.in", "department": dept, "weekStartDate": week_start}
        await send_roster_email(payload=payload, current_user={"sub": "admin", "isSuperuser": True})
        print("FAIL: Sent duplicate roster email without error!")
    except HTTPException as e:
        print(f"SUCCESS: Caught expected duplicate error: {e.status_code} - {e.detail}")
        assert e.status_code == 400
        assert "already been sent" in e.detail

    # 3. Verify Last Sent email saved
    print("\n3. Testing last_sent_emails collection persistence...")
    last_sent_doc = await last_sent_col.find_one({"_id": dept})
    print("Saved last sent emails for department:", last_sent_doc.get("emails"))
    assert last_sent_doc.get("emails") == "recipient@vssc.gov.in"

    # Reset mock
    mail_utils.send_email = original_send_email
    print("\n--- ALL TESTS PASSED SUCCESSFULLY ---")

if __name__ == "__main__":
    asyncio.run(test_workflow())
