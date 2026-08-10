import asyncio
from database import db

async def test():
    users_coll = db.get_collection("users")
    user = await users_coll.find_one({})
    if user:
        print(f"Role value: {user.get('role')} (type: {type(user.get('role'))})")

asyncio.run(test())
