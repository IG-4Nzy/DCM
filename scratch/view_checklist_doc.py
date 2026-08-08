import asyncio
import sys
sys.path.append("/home/vssc/Desktop/DCM/Backend")

from database import db

async def main():
    bms_coll = db.get_collection("bms_checklists")
    cluster_coll = db.get_collection("cluster_checklists")
    
    print("--- BMS Checklist sample doc ---")
    doc = await bms_coll.find_one({})
    if doc:
        for k, v in doc.items():
            if k != "data":
                print(f"  {k}: {v}")
            else:
                print(f"  data: {list(v.keys())[:3]}... ({len(v)} categories)")
    else:
        print("  No document found.")

    print("\n--- Cluster Checklist sample doc ---")
    doc2 = await cluster_coll.find_one({})
    if doc2:
        for k, v in doc2.items():
            if k != "data":
                print(f"  {k}: {v}")
            else:
                print(f"  data: {list(v.keys())[:3]}... ({len(v)} categories)")
    else:
        print("  No document found.")

if __name__ == "__main__":
    asyncio.run(main())
