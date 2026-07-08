import asyncio
from database import db

async def main():
    depts_cur = db.get_collection("departments").find({})
    depts = await depts_cur.to_list(length=None)
    dept_map = {d["name"]: str(d["_id"]) for d in depts}
    
    async def migrate_dept_field(collection_name):
        cursor = db.get_collection(collection_name).find({})
        docs = await cursor.to_list(length=None)
        for d in docs:
            if "department" in d and isinstance(d["department"], str):
                new_dept = dept_map.get(d["department"], d["department"])
                if new_dept != d["department"]:
                    await db.get_collection(collection_name).update_one({"_id": d["_id"]}, {"$set": {"department": new_dept}})
                    print(f"Updated {collection_name} {d['_id']} department to {new_dept}")
                    
    await migrate_dept_field("roaster_status")

asyncio.run(main())
