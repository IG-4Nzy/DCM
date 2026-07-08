import asyncio
from database import db

async def main():
    depts_cur = db.get_collection("departments").find({})
    depts = await depts_cur.to_list(length=None)
    dept_map = {d["name"]: str(d["_id"]) for d in depts}
    
    collection_name = "announcements"
    cursor = db.get_collection(collection_name).find({})
    docs = await cursor.to_list(length=None)
    for d in docs:
        if "mentionedDepartment" in d and isinstance(d["mentionedDepartment"], str) and d["mentionedDepartment"] != "":
            old_dept = d["mentionedDepartment"]
            new_dept = dept_map.get(old_dept, old_dept)
            if new_dept != old_dept:
                await db.get_collection(collection_name).update_one({"_id": d["_id"]}, {"$set": {"mentionedDepartment": new_dept}})
                print(f"Updated {collection_name} {d['_id']} mentionedDepartment to {new_dept}")
                    
asyncio.run(main())
