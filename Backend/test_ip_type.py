import asyncio
from database import db
import re

async def test():
    col = db.get_collection("nodes")
    
    # Check direct field query
    doc = await col.find_one({"node": "Node 1"})
    if doc:
        ip_val = doc.get("ip")
        print(f"ip value: {ip_val!r}, type: {type(ip_val).__name__}")
        
        # Try different query approaches
        q1 = await col.find_one({"ip": "192.168.2.3"})
        print(f"Exact match: {q1 is not None}")
        
        q2 = await col.find_one({"ip": {"$regex": "192"}})
        print(f"Regex match: {q2 is not None}")
        
        q3 = await col.find_one({"ip": re.compile("192")})
        print(f"Compiled regex match: {q3 is not None}")
    
    # Also test with $or
    or_q = {"$or": [{"ip": {"$regex": "192\\.168", "$options": "i"}}]}
    docs = await col.find(or_q).to_list(length=None)
    print(f"\n$or query found: {len(docs)}")
    for d in docs:
        print(f"  ip={d.get('ip')!r}")

asyncio.run(test())
