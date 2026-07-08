import asyncio
from database import db

async def main():
    doc = await db.get_collection("attendance_config").find_one({})
    print(doc)

asyncio.run(main())
