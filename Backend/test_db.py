from database import db
import asyncio

async def run():
    doc = await db.get_collection("users").find_one()
    print(doc)

asyncio.run(run())
