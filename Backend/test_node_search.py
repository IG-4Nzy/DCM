import asyncio
from database import db
import re

async def test():
    col = db.get_collection("nodes")
    
    # Test searching for "192.168"
    search = "192.168"
    escaped = re.escape(search.strip())
    or_conds = [
        {"node": {"$regex": escaped, "$options": "i"}},
        {"ipAddress": {"$regex": escaped, "$options": "i"}},
        {"ip": {"$regex": escaped, "$options": "i"}},
        {"managementIp": {"$regex": escaped, "$options": "i"}},
    ]
    query = {"$or": or_conds}
    
    docs = await col.find(query).to_list(length=None)
    print(f"Search '{search}' found {len(docs)} results:")
    for d in docs:
        print(f"  node={d.get('node')!r}, ip={d.get('ip')!r}")

asyncio.run(test())
