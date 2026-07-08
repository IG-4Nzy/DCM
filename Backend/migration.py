import asyncio
from database import db
from bson import ObjectId

async def migrate():
    print("Starting migration...")
    
    # 1. Fetch all roles and build name -> id map
    roles_cur = db.get_collection("roles").find({})
    roles = await roles_cur.to_list(length=None)
    role_map = {r["name"]: str(r["_id"]) for r in roles}

    # 2. Fetch all departments and build name -> id map
    depts_cur = db.get_collection("departments").find({})
    depts = await depts_cur.to_list(length=None)
    dept_map = {d["name"]: str(d["_id"]) for d in depts}

    print("Role Map:", role_map)
    print("Dept Map:", dept_map)

    # Migrate Users (Roles and Departments)
    users_cur = db.get_collection("users").find({})
    users = await users_cur.to_list(length=None)
    
    for u in users:
        updates = {}
        # Update Role
        if "role" in u:
            if isinstance(u["role"], list):
                new_roles = [role_map.get(r, r) for r in u["role"]]
                updates["role"] = new_roles
            elif isinstance(u["role"], str):
                updates["role"] = role_map.get(u["role"], u["role"])
                
        # Update Department
        if "department" in u and isinstance(u["department"], str):
            updates["department"] = dept_map.get(u["department"], u["department"])
            
        if updates:
            await db.get_collection("users").update_one({"_id": u["_id"]}, {"$set": updates})
            print(f"Updated user {u['username']} with {updates}")

    # Helper to migrate 'department' field for a given collection
    async def migrate_dept_field(collection_name):
        cursor = db.get_collection(collection_name).find({})
        docs = await cursor.to_list(length=None)
        for d in docs:
            if "department" in d and isinstance(d["department"], str):
                new_dept = dept_map.get(d["department"], d["department"])
                if new_dept != d["department"]:
                    await db.get_collection(collection_name).update_one({"_id": d["_id"]}, {"$set": {"department": new_dept}})
                    print(f"Updated {collection_name} {d['_id']} department to {new_dept}")

    # Migrate all relevant collections
    collections_with_dept = [
        "roasters", "roaster_status", "roaster_drafts", "roaster_splitup",
        "bms_checklist_config", "cluster_checklist_config", "morning_checklist_config",
        "bms_checklists", "cluster_checklists", "morning_checklists",
        "daily_activities", "periodic_activities", "observations"
    ]
    
    for col in collections_with_dept:
        await migrate_dept_field(col)

    # Migrate attendance_config for trackedRole
    attendance_config_cur = db.get_collection("attendance_config").find({})
    att_configs = await attendance_config_cur.to_list(length=None)
    for ac in att_configs:
        if "trackedRole" in ac and isinstance(ac["trackedRole"], str):
            new_role = role_map.get(ac["trackedRole"], ac["trackedRole"])
            if new_role != ac["trackedRole"]:
                await db.get_collection("attendance_config").update_one({"_id": ac["_id"]}, {"$set": {"trackedRole": new_role}})
                print(f"Updated attendance_config {ac['_id']} trackedRole to {new_role}")

    print("Migration complete!")

if __name__ == "__main__":
    asyncio.run(migrate())
