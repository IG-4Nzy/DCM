import asyncio
from pymongo import MongoClient

async def main():
    client = MongoClient("mongodb://localhost:27017")
    db = client["dcm_db"]
    routings = db.get_collection("request_routings")
    routing = routings.find_one({"requestType": "VM Creation"})
    if routing:
        print("Routing found:")
        for stage in routing.get("stages", []):
            print(f"Stage: {stage.get('stageName')}")
            print(f"  conditionField: {stage.get('conditionField')}")
            print(f"  conditionOperator: {stage.get('conditionOperator')}")
            print(f"  conditionValue: {stage.get('conditionValue')}")

asyncio.run(main())
