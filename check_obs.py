import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
client = AsyncIOMotorClient("mongodb://localhost:27017")
db = client["dcm"]
async def main():
    obs = await db.observations.find_one({})
    print(obs)
asyncio.run(main())
