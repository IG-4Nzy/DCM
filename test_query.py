import os
from bson import ObjectId
from pymongo import MongoClient

def main():
    mongo_uri = os.getenv("MONGO_URI", "mongodb://admin:password@localhost:27017/dcm_database?authSource=admin")
    client = MongoClient(mongo_uri)
    db = client.get_database()
    if db.name == "admin" or not db.name:
        db = client["dcm_database"]

    # Assume we are a restricted user with NO view all privilege
    is_superuser = False
    privs = [] # No privileges
    
    admin = None # Cleared filter
    
    target_username = "dcs_dev" # Let's assume we are dcs_dev
    users_col = db["users"]
    user_doc = users_col.find_one({"username": target_username})
    target_user_id = str(user_doc["_id"]) if user_doc else None
    
    user_admin_identifiers = [target_username]
    if target_user_id:
        user_admin_identifiers.append(target_user_id)
        
    print(f"User admin identifiers: {user_admin_identifiers}")

    no_admin_conditions = [
        {"admin": None},
        {"admin": ""},
        {"admin": []},
        {"admin": {"$exists": False}}
    ]

    has_appliance_all = is_superuser or "View All Server Details" in privs or "View All Network Device" in privs
    has_storage_all = is_superuser or "View All Server Details" in privs or "View All Storage Device" in privs
    has_node_all = is_superuser or "View All Server Details" in privs
    has_physical_all = is_superuser or "View All Server Details" in privs or "Physical Server View" in privs

    def get_category_admin_cond(allow_all: bool) -> dict:
        if allow_all:
            if not admin:
                return {}
            elif admin.lower() == "unassigned":
                return {"$or": no_admin_conditions}
            elif admin.lower() == "assigned":
                return {"admin": {"$in": user_admin_identifiers}}
            elif admin.lower() == "my_unassigned":
                return {"$or": [{"admin": {"$in": user_admin_identifiers}}, *no_admin_conditions]}
            else:
                return {"admin": {"$in": [admin]}}
        else:
            if not admin:
                return {"$or": [{"admin": {"$in": user_admin_identifiers}}, *no_admin_conditions]}
            elif admin.lower() == "unassigned":
                return {"$or": no_admin_conditions}
            elif admin.lower() == "assigned":
                return {"admin": {"$in": user_admin_identifiers}}
            elif admin.lower() == "my_unassigned":
                return {"$or": [{"admin": {"$in": user_admin_identifiers}}, *no_admin_conditions]}
            else:
                return {"admin": {"$in": user_admin_identifiers}}

    # Mimic the 'else' (All Devices) block
    app_cond = {"isAppliance": True}
    app_admin = get_category_admin_cond(has_appliance_all)
    if app_admin:
        app_cond.update(app_admin)

    store_cond = {"isStorage": True}
    store_admin = get_category_admin_cond(has_storage_all)
    if store_admin:
        store_cond.update(store_admin)

    physical_cond = {"isPhysical": True}
    physical_admin = get_category_admin_cond(has_physical_all)
    if physical_admin:
        physical_cond.update(physical_admin)

    node_cond = {
        "isAppliance": {"$ne": True},
        "isStorage": {"$ne": True},
        "isPhysical": {"$ne": True}
    }
    node_admin = get_category_admin_cond(has_node_all)
    if node_admin:
        node_cond.update(node_admin)

    query = {
        "$or": [
            app_cond,
            store_cond,
            physical_cond,
            node_cond
        ]
    }
    
    print("\nCompiled Query for nodes:")
    import pprint
    pprint.pprint(query)
    
    nodes_col = db["nodes"]
    results = list(nodes_col.find(query))
    print(f"\nNumber of matching nodes in DB: {len(results)}")
    for r in results:
        print(f"Node: {r.get('node')}, admin: {r.get('admin')}, isAppliance: {r.get('isAppliance')}, isStorage: {r.get('isStorage')}, isPhysical: {r.get('isPhysical')}")

if __name__ == "__main__":
    main()
