import asyncio
from database import db
async def main():
    col = db.get_collection("attendance_config")
    doc = await col.find_one({})
    if doc and doc.get("trackedRole") == "Staff":
        await col.update_one({"_id": doc["_id"]}, {"$set": {"trackedRole": "6a0e788fd6d4a966ed56a509"}})
        print("Fixed trackedRole!")
asyncio.run(main())
