import asyncio
from database import db

async def test():
    names = await db.list_collection_names()
    for n in sorted(names):
        count = await db.get_collection(n).count_documents({})
        if "server" in n.lower() or "physical" in n.lower() or "vm" in n.lower() or "storage" in n.lower() or "datastore" in n.lower():
            print(f"  {n}: {count} docs")

asyncio.run(test())
