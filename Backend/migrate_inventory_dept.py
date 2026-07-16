import asyncio
from database import db
from bson import ObjectId

async def migrate():
    print("Starting migration for Inventory departments...")
    
    # Fetch all departments and build name -> ObjectId map
    depts_cur = db.get_collection("departments").find({})
    depts = await depts_cur.to_list(length=None)
    dept_map = {d["name"].lower().strip(): d["_id"] for d in depts}
    
    print("Available Departments:")
    for name, oid in dept_map.items():
        print(f"  {name} -> {oid}")

    inventory_col = db.get_collection("inventory")
    cursor = inventory_col.find({})
    items = await cursor.to_list(length=None)
    
    updated_count = 0
    skipped_count = 0
    
    for item in items:
        dept = item.get("department")
        if dept:
            # If it's already an ObjectId, skip
            if isinstance(dept, ObjectId):
                skipped_count += 1
                continue
                
            # If it's a valid ObjectId string, convert it to ObjectId
            if ObjectId.is_valid(str(dept)):
                await inventory_col.update_one(
                    {"_id": item["_id"]},
                    {"$set": {"department": ObjectId(str(dept))}}
                )
                updated_count += 1
                continue
                
            # Otherwise, it might be a department name
            dept_key = str(dept).lower().strip()
            if dept_key in dept_map:
                new_dept = dept_map[dept_key]
                await inventory_col.update_one(
                    {"_id": item["_id"]},
                    {"$set": {"department": new_dept}}
                )
                print(f"Migrated item '{item.get('itemName')}' department from '{dept}' to {new_dept}")
                updated_count += 1
            else:
                print(f"WARNING: Department '{dept}' for item '{item.get('itemName')}' not found in departments list!")
                skipped_count += 1
        else:
            skipped_count += 1
            
    print(f"\nMigration complete. Updated: {updated_count}, Skipped: {skipped_count}")

if __name__ == "__main__":
    asyncio.run(migrate())
