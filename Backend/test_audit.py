import asyncio
from database import db
from bson import ObjectId

async def main():
    col = db.get_collection("attendance")
    doc_id = "6a165ca74a180922210b3a2b"
    print("Querying ObjectId...")
    doc = await col.find_one({"_id": ObjectId(doc_id)})
    print("Result by ObjectId:", doc)
    
    print("Querying String...")
    doc_str = await col.find_one({"_id": doc_id})
    print("Result by String:", doc_str)

if __name__ == "__main__":
    asyncio.run(main())
