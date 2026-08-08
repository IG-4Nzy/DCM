import asyncio
import sys
import bcrypt

sys.path.append("/home/vssc/Desktop/DCM/Backend")
from database import db

async def main():
    users_coll = db.get_collection("users")
    hashed_password = bcrypt.hashpw(b"admin", bcrypt.gensalt()).decode('utf-8')
    result = await users_coll.update_one(
        {"username": "admin"},
        {"$set": {
            "password": hashed_password,
            "isSuperuser": True
        }}
    )
    print(f"Password reset to admin: matched={result.matched_count}, modified={result.modified_count}")

if __name__ == "__main__":
    asyncio.run(main())
