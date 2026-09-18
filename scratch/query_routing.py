from pymongo import MongoClient
import json
from bson import json_util

client = MongoClient("mongodb://localhost:27017/")
db = client["dcm_db"]
routings = db["request_routings"].find({"requestType": "VM Creation"})

for r in routings:
    print(json.dumps(r, default=json_util.default, indent=2))

