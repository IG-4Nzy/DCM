"""
Migration script for Inventory module.

This script updates existing returnable inventory items so that the 'quantity'
field represents the available stock (total minus checked-out items), rather
than the total quantity.

Before this migration:
  - quantity = total items (e.g. 10)
  - currentHolders = [holder1, holder2]  (2 items out)
  - Available was computed as quantity - len(currentHolders) = 8

After this migration:
  - quantity = available items (e.g. 8)
  - currentHolders = [holder1, holder2]  (2 items out)
  - Total is computed as quantity + len(currentHolders) = 10

Run with: python migrate_inventory.py
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "dcm")


async def migrate():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    collection = db["inventory"]

    # Find all returnable items that have at least one current holder
    cursor = collection.find({
        "isReturnable": True,
        "currentHolders": {"$exists": True, "$not": {"$size": 0}}
    })

    updated = 0
    skipped = 0

    async for item in cursor:
        item_id = item["_id"]
        item_name = item.get("itemName", "Unknown")
        current_qty = item.get("quantity", 0)
        holders = item.get("currentHolders", [])
        holders_count = len(holders)

        # New quantity = current total quantity - holders count
        new_qty = current_qty - holders_count

        if new_qty < 0:
            print(f"  WARNING: {item_name} (id={item_id}) would have negative quantity "
                  f"({current_qty} - {holders_count} = {new_qty}). Setting to 0.")
            new_qty = 0

        if new_qty == current_qty:
            skipped += 1
            continue

        await collection.update_one(
            {"_id": item_id},
            {"$set": {"quantity": new_qty}}
        )

        print(f"  Migrated: {item_name} — qty {current_qty} → {new_qty} "
              f"(holders: {holders_count})")
        updated += 1

    print(f"\nMigration complete. Updated: {updated}, Skipped: {skipped}")
    client.close()


if __name__ == "__main__":
    asyncio.run(migrate())
