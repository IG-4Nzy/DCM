import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt
import uuid

async def test():
    client = AsyncIOMotorClient("mongodb://127.0.0.1:27017")
    db = client["dcm"]
    users = db["users"]
    user = await users.find_one({})
    print(user["username"], user.get("session_key"))

asyncio.run(test())
