import asyncio
import bcrypt
from database import db, MONGO_URI
from urllib.parse import urlparse
import pymongo.errors

async def create_super_user(username: str, password: str):
    # Mask password for secure logging
    parsed = urlparse(MONGO_URI)
    masked_uri = MONGO_URI
    if parsed.password:
        masked_uri = MONGO_URI.replace(parsed.password, "******")
    print(f"Connecting to MongoDB with URI: {masked_uri}")

    users_collection = db.get_collection("users")
    
    try:
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
    except pymongo.errors.OperationFailure as e:
        print("\n" + "="*60)
        print("DATABASE AUTHENTICATION / CONNECTION ERROR:")
        print(f"Details: {e}")
        print("\nHow to fix:")
        print("1. If running with docker compose, make sure you ran 'docker-compose down && docker-compose up -d'")
        print("   to recreate the containers so that new env variables are applied.")
        print("2. You can also explicitly pass your production MONGO_URI to this script:")
        print("   docker exec -e MONGO_URI=\"mongodb://user:pass@host:port/db\" -it dcm_backend python3 create_superuser.py <username> <password>")
        print("="*60 + "\n")

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
