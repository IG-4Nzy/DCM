import asyncio
from database import db
import re

async def test():
    col = db.get_collection("physical_servers")
    await col.insert_one({"ipAddress": "192.168.1.100", "applications": "test"})
    
    part = "192.168.1.100"
    escaped = re.escape(part)
    regex_pat = re.compile(escaped, re.I)
    
    all_or = [
        {"ipAddress": regex_pat},
        {"applications": regex_pat},
        {"node": regex_pat},
        {"ram": regex_pat},
        {"hdd": regex_pat},
        {"cpu": regex_pat},
        {"backupLocation": regex_pat},
        {"adminName": regex_pat},
        {"adminContact": regex_pat},
        {"remarks": regex_pat},
        {"createdBy": regex_pat},
        {"createdAt": regex_pat},
        {"updatedAt": regex_pat},
    ]
    query = {"$and": [{"$or": all_or}]}
    
    try:
        docs = await col.find(query).to_list(length=None)
        print("Found docs:", len(docs))
        for d in docs:
            print(d.get("ipAddress"))
    except Exception as e:
        print("Error:", e)
        
    await col.delete_many({"applications": "test"})

asyncio.run(test())
