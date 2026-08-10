import asyncio
import sys
sys.path.append("/home/vssc/Desktop/DCM/Backend")

from database import db

async def test_module_emails():
    print("--- STARTING MODULE EMAILS TEST ---")
    mail_config_col = db.get_collection("mail_config")

    # Update config with specific modules and a fallback general list
    await mail_config_col.update_one(
        {"_id": "mail_config"},
        {"$set": {
            "savedEmails": ["fallback@vssc.gov.in"],
            "savedEmailsRoster": ["roster1@vssc.gov.in", "roster2@vssc.gov.in"],
            "savedEmailsDailyChecklist": ["daily1@vssc.gov.in"],
            "savedEmailsBmsChecklist": ["bms1@vssc.gov.in"]
        }},
        upsert=True
    )

    from routers.mail_config import get_saved_emails

    # Test roster module
    emails_roster = await get_saved_emails(module="roster")
    print("Roster emails:", emails_roster)
    assert emails_roster == ["roster1@vssc.gov.in", "roster2@vssc.gov.in"]

    # Test daily checklist module
    emails_daily = await get_saved_emails(module="daily")
    print("Daily emails:", emails_daily)
    assert emails_daily == ["daily1@vssc.gov.in"]

    # Test bms checklist module
    emails_bms = await get_saved_emails(module="bms")
    print("BMS emails:", emails_bms)
    assert emails_bms == ["bms1@vssc.gov.in"]

    # Test fallback general (or non-existing module)
    emails_other = await get_saved_emails(module="other")
    print("Other module (fallback):", emails_other)
    assert emails_other == ["fallback@vssc.gov.in"]

    print("--- ALL MODULE EMAILS TESTS PASSED ---")

if __name__ == "__main__":
    asyncio.run(test_module_emails())
