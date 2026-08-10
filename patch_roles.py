import re
with open("Backend/roles.py", "r") as f:
    content = f.read()

replacement = """
    users_collection = db.get_collection("users")
    for role in roles:
        if "status" not in role:
            role["status"] = True
        if "privileges" not in role:
            role["privileges"] = []
        
        role_id_str = str(role["_id"])
        users_count = await users_collection.count_documents({
            "$or": [
                {"role": role_id_str},
                {"role": {"$in": [role_id_str]}}
            ]
        })
        role["usersCount"] = users_count
"""

content = re.sub(
    r'    for role in roles:\n        if "status" not in role:\n            role\["status"\] = True\n        if "privileges" not in role:\n            role\["privileges"\] = \[\]',
    replacement,
    content
)

with open("Backend/roles.py", "w") as f:
    f.write(content)
