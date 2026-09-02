import asyncio
from database import db

async def test():
    col = db.get_collection("physical_servers")
    count = await col.count_documents({})
    print(f"Total physical servers: {count}")
    docs = await col.find({}).to_list(length=5)
    for d in docs:
        ip = d.get("ipAddress")
        print(f"  _id={d['_id']}, ipAddress={ip!r}, type={type(ip).__name__}, node={d.get('node')!r}")

asyncio.run(test())
