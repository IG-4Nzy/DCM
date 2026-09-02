import asyncio
from database import db
import re

async def test():
    col = db.get_collection("nodes")
    
    # Test $or with different regex approaches
    esc = re.escape("192.168")
    print(f"Escaped string: {esc!r}")
    
    # Test 1: $or with $regex string
    q1 = {"$or": [{"ip": {"$regex": esc, "$options": "i"}}]}
    r1 = await col.find(q1).to_list(length=None)
    print(f"Test 1 ($or with $regex string): {len(r1)}")
    
    # Test 2: $or with compiled regex
    q2 = {"$or": [{"ip": re.compile(esc, re.I)}]}
    r2 = await col.find(q2).to_list(length=None)
    print(f"Test 2 ($or with compiled regex): {len(r2)}")
    
    # Test 3: $or with simple regex, no escape
    q3 = {"$or": [{"ip": {"$regex": "192", "$options": "i"}}]}
    r3 = await col.find(q3).to_list(length=None)
    print(f"Test 3 ($or simple regex '192'): {len(r3)}")
    
    # Test 4: $and wrapping $or
    q4 = {"$and": [{"$or": [{"ip": {"$regex": esc, "$options": "i"}}]}]}
    r4 = await col.find(q4).to_list(length=None)
    print(f"Test 4 ($and wrapping $or): {len(r4)}")

    # Test 5: plain $or with more conditions like in real code
    q5 = {"$or": [
        {"node": {"$regex": esc, "$options": "i"}},
        {"ipAddress": {"$regex": esc, "$options": "i"}},
        {"ip": {"$regex": esc, "$options": "i"}},
    ]}
    r5 = await col.find(q5).to_list(length=None)
    print(f"Test 5 ($or with multiple conditions): {len(r5)}")
    
    # Test 6: just ip regex, no $or
    q6 = {"ip": {"$regex": esc, "$options": "i"}}
    r6 = await col.find(q6).to_list(length=None)
    print(f"Test 6 (direct regex, no $or): {len(r6)}")

asyncio.run(test())
