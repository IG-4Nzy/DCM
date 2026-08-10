import asyncio
import bcrypt
from database import db, MONGO_URI
from urllib.parse import urlparse
import pymongo.errors


async def change_password(username: str, new_password: str):
    # Mask password in MongoDB URI for logging
    parsed = urlparse(MONGO_URI)
    masked_uri = MONGO_URI
    if parsed.password:
        masked_uri = MONGO_URI.replace(parsed.password, "******")

    print(f"Connecting to MongoDB with URI: {masked_uri}")

    users_collection = db.get_collection("users")

    try:
        # Check if user exists
        existing_user = await users_collection.find_one(
            {"username": username}
        )

        if not existing_user:
            print(f"User '{username}' does not exist.")
            return

        # Generate new bcrypt password hash
        hashed_password = bcrypt.hashpw(
            new_password.encode("utf-8"),
            bcrypt.gensalt()
        ).decode("utf-8")

        # Update password
        result = await users_collection.update_one(
            {"username": username},
            {"$set": {"password": hashed_password}}
        )

        if result.modified_count == 1:
            print(f"Password changed successfully for user '{username}'.")
        else:
            print(f"Password was not changed for user '{username}'.")

    except pymongo.errors.OperationFailure as e:
        print("\n" + "=" * 60)
        print("DATABASE AUTHENTICATION / CONNECTION ERROR:")
        print(f"Details: {e}")
        print("\nHow to fix:")
        print("1. Verify your MONGO_URI is correct.")
        print("2. If using Docker, recreate containers:")
        print("   docker-compose down && docker-compose up -d")
        print("3. You can pass MONGO_URI explicitly:")
        print(
            "   docker exec -e "
            "MONGO_URI=\"mongodb://user:pass@host:port/db\" "
            "-it dcm_backend python3 change_password.py <username> <new_password>"
        )
        print("=" * 60 + "\n")


if __name__ == "__main__":
    import sys

    if len(sys.argv) != 3:
        print("Usage: python change_password.py <username> <new_password>")
        sys.exit(1)

    username = sys.argv[1]
    new_password = sys.argv[2]

    loop = asyncio.get_event_loop()
    loop.run_until_complete(change_password(username, new_password))