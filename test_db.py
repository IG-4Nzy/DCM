from pymongo import MongoClient
import json
client = MongoClient("mongodb://localhost:27017/")
db = client["dcm"]
users = list(db["users"].find({"isSuperuser": {"$ne": True}}).limit(2))
for u in users:
    print(f"User {u['username']}: dept={u.get('department')}, role={u.get('role')}")

dept = db["departments"].find_one()
if dept:
    print(f"Dept: id={dept['_id']}, name={dept['name']}")

role = db["roles"].find_one()
if role:
    print(f"Role: id={role['_id']}, name={role['name']}")

att = db["attendance_config"].find_one()
if att:
    print(f"TrackedRole in attendance_config: {att.get('trackedRole')}")
