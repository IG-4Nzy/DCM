import asyncio
import bcrypt
from database import db

async def create_super_user(username: str, password: str):
    users_collection = db.get_collection("users")
    
    # Check if exists
    existing_user = await users_collection.find_one({"username": username})
    if existing_user:
        print(f"User {username} already exists.")
        return
        
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    user_data = {
        "username": username,
        "password": hashed_password,
        "role": "Admin",
        "is_superuser": True
    }
    
    await users_collection.insert_one(user_data)
    print(f"Superuser {username} created successfully!")

if __name__ == "__main__":
    import sys
    if len(sys.argv) != 3:
        print("Usage: python create_superuser.py <username> <password>")
        sys.exit(1)
    
    username = sys.argv[1]
    password = sys.argv[2]
    
    # Run async function
    loop = asyncio.get_event_loop()
    loop.run_until_complete(create_super_user(username, password))
