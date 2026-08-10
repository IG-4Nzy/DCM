import os
import sys
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from urllib.parse import urlparse

MONGO_URI = os.getenv("MONGO_URI", "mongodb://admin:password@localhost:27017/dcm_database?authSource=admin")

async def update_vm_network_types():
    print(f"Connecting to MongoDB at {MONGO_URI}...")
    client = AsyncIOMotorClient(MONGO_URI)
    parsed = urlparse(MONGO_URI)
    db_name = parsed.path.lstrip("/") if parsed.path and parsed.path != "/" else "dcm_database"
    db = client[db_name]
    collection = db.get_collection("vm_details")

    vms = await collection.find({}).to_list(length=None)
    print(f"Found {len(vms)} VM documents in database.")

    internet_count = 0
    intranet_count = 0
    skipped_count = 0

    for vm in vms:
        ip = str(vm.get("ipAddress") or vm.get("ip") or "").strip()
        new_network_type = None

        if ip.startswith("192.168"):
            new_network_type = "internet"
        elif ip.startswith("10."):
            new_network_type = "intranet"

        if new_network_type:
            await collection.update_one(
                {"_id": vm["_id"]},
                {"$set": {"networkType": new_network_type}}
            )
            if new_network_type == "internet":
                internet_count += 1
            else:
                intranet_count += 1
            print(f"Updated VM '{vm.get('vmName') or vm.get('vmId')}' (IP: {ip}) -> {new_network_type}")
        else:
            skipped_count += 1

    print("\n--- Summary ---")
    print(f"Total VMs processed: {len(vms)}")
    print(f"Marked as Internet (192.168.*): {internet_count}")
    print(f"Marked as Intranet (10.*): {intranet_count}")
    print(f"Skipped (No matching IP rule): {skipped_count}")

if __name__ == "__main__":
    asyncio.run(update_vm_network_types())
