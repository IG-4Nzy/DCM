import asyncio
from database import db

async def test():
    col = db.get_collection("nodes")
    count = await col.count_documents({})
    print(f"Total nodes: {count}")
    docs = await col.find({}).to_list(length=10)
    for d in docs:
        print(f"  node={d.get('node')!r}, ip={d.get('ip')!r}, ipAddress={d.get('ipAddress')!r}, isPhysical={d.get('isPhysical')}, isStorage={d.get('isStorage')}, isAppliance={d.get('isAppliance')}")

asyncio.run(test())
