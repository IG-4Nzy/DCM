import asyncio
from database import db

async def test():
    col = db.get_collection("physical_servers")
    docs = await col.find({}).to_list(length=5)
    for d in docs:
        print("Server:", d.get("ipAddress"), d.get("applications"), d.get("node"))

asyncio.run(test())
