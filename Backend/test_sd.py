import asyncio
from database import db

async def test():
    col = db.get_collection("server_details")
    docs = await col.find({}).to_list(length=5)
    for d in docs:
        print(f"  _id={d['_id']}, keys={list(d.keys())}")
        ip = d.get("ipAddress")
        print(f"    ipAddress={ip!r}")

asyncio.run(test())
