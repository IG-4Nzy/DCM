import sys
import os
import asyncio

# add backend path
sys.path.append(os.path.join(os.path.dirname(__file__), "../Backend"))

from database import db

async def main():
    routings = db.get_collection("request_routings")
    routing = await routings.find_one({"requestType": "VM Creation"})
    if not routing:
        print("No routing found for VM Creation")
        return
    print("Routing stages:")
    for i, s in enumerate(routing.get("stages", [])):
        print(f"Stage {i}: {s.get('stageName')}")
        print(f"  conditionField: {s.get('conditionField')}")
        print(f"  conditionOperator: {s.get('conditionOperator')}")
        print(f"  conditionValue: {s.get('conditionValue')}")

asyncio.run(main())
