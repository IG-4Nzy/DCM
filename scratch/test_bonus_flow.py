import sys
sys.path.append("/home/vssc/Desktop/DCM/Backend")

import asyncio
from salary import save_bonus_entry, quick_add_all_bonus, BonusEntryModel, BonusQuickAddAllPayload
from database import db

async def test_flow():
    # Setup test employee
    test_id = "test_employee_123"
    await db["salary_bonus"].delete_one({"_id": test_id})
    
    # 1. Create a new employee with initial bonus
    print("1. Creating employee...")
    entry1 = BonusEntryModel(
        id=test_id,
        name="Test Employee",
        accumulatedAmount=1000.0,
        notes="Initial setup",
        month="2026-08",
        period="August 21 - September 20",
        resigned=False
    )
    user_mock = {"displayName": "Test Admin", "sub": "admin_sub"}
    
    await save_bonus_entry(entry1, user=user_mock)
    
    # Fetch and check
    doc = await db["salary_bonus"].find_one({"_id": test_id})
    print("After Creation additions:", doc.get("additions"))
    assert len(doc.get("additions", [])) == 1
    assert doc["additions"][0]["amount"] == 1000.0
    assert doc["additions"][0]["period"] == "August 21 - September 20"
    assert doc["additions"][0]["month"] == "2026-08"

    # 2. Add another month bonus (e.g. September 21 - October 20)
    print("2. Adding subsequent month bonus...")
    entry2 = BonusEntryModel(
        id=test_id,
        name="Test Employee",
        accumulatedAmount=2000.0,
        notes="Manual adjustment / monthly credit",
        month="2026-09",
        period="September 21 - October 20",
        resigned=False
    )
    await save_bonus_entry(entry2, user=user_mock)
    
    # Fetch and check
    doc = await db["salary_bonus"].find_one({"_id": test_id})
    print("After second month additions:", doc.get("additions"))
    assert len(doc.get("additions", [])) == 2
    assert doc["additions"][1]["amount"] == 1000.0
    assert doc["additions"][1]["period"] == "September 21 - October 20"
    
    # 3. Test Bulk Quick Add All
    print("3. Testing quick add all...")
    # Clean lastAddedMonth so it gets added
    await db["salary_bonus"].update_one({"_id": test_id}, {"$set": {"lastAddedMonth": None}})
    
    payload = BonusQuickAddAllPayload(
        amount=1000.0,
        month="2026-10",
        period="October 21 - November 20"
    )
    await quick_add_all_bonus(payload, user=user_mock)
    
    doc = await db["salary_bonus"].find_one({"_id": test_id})
    print("After quick add all additions:", doc.get("additions"))
    assert len(doc.get("additions", [])) == 3
    assert doc["additions"][2]["amount"] == 1000.0
    assert doc["additions"][2]["period"] == "October 21 - November 20"
    assert doc["accumulatedAmount"] == 3000.0

    # Clean up test employee
    await db["salary_bonus"].delete_one({"_id": test_id})
    print("All tests passed successfully!")

if __name__ == "__main__":
    asyncio.run(test_flow())
