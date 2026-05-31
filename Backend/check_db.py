import asyncio
import os
import pymongo.errors
from database import client, MONGO_URI
from urllib.parse import urlparse

async def check_connection():
    # Mask password for security
    parsed = urlparse(MONGO_URI)
    masked_uri = MONGO_URI
    if parsed.password:
        masked_uri = MONGO_URI.replace(parsed.password, "******")
    
    print("=" * 60)
    print("DIAGNOSTIC: MONGODB CONNECTION CHECK")
    print(f"Target URI: {masked_uri}")
    print("=" * 60)
    
    try:
        # The ping command is cheap and does not require special permissions
        print("Sending ping to MongoDB server...")
        await client.admin.command('ping')
        print("✅ Connection Successful! MongoDB server responded to ping.")
        
        # Fetch server build info
        info = await client.server_info()
        print(f"✅ Server Info retrieved: version {info.get('version', 'unknown')}")
        
        # List databases
        dbs = await client.list_database_names()
        print(f"✅ Available Databases: {dbs}")
        print("=" * 60)
        print("RESULT: 100% HEALTHY CONNECTIVITY")
        print("=" * 60)
        
    except pymongo.errors.ServerSelectionTimeoutError as e:
        print("\n❌ Connection Error: Could not reach the MongoDB server.")
        print("   Make sure MongoDB is running and the hostname/port are correct.")
        print(f"   Details: {e}")
        print("=" * 60)
    except pymongo.errors.OperationFailure as e:
        print("\n❌ Authentication Error: Connected but credentials failed.")
        print("   Verify that the username, password, and authSource in MONGO_URI are correct.")
        print(f"   Details: {e}")
        print("=" * 60)
    except Exception as e:
        print(f"\n❌ Unexpected Error: {e}")
        print("=" * 60)

if __name__ == "__main__":
    loop = asyncio.get_event_loop()
    loop.run_until_complete(check_connection())
