import asyncio
from database import db
import re

async def test():
    col = db.get_collection("physical_servers")
    await col.insert_one({"ipAddress": "192.168.1.100", "applications": "test"})
    
    escaped = re.escape("192")
    pat = re.compile(escaped, re.I)
    
    query = {"$or": [{"ipAddress": pat}]}
    print("Using re.compile:")
    async for doc in col.find(query):
        print(doc)
        
    query2 = {"$or": [{"ipAddress": {"$regex": escaped, "$options": "i"}}]}
    print("Using $regex:")
    async for doc in col.find(query2):
        print(doc)
        
    await col.delete_many({"applications": "test"})

asyncio.run(test())
