import asyncio
from database import db

async def main():
    docs = await db.get_collection("announcements").find({}).to_list(length=None)
    for doc in docs:
        print(doc)

asyncio.run(main())
