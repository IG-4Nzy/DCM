import os
import motor.motor_asyncio
from urllib.parse import urlparse

MONGO_URI = os.getenv("MONGO_URI", "mongodb://admin:password@localhost:27017/dcm_database?authSource=admin")

client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)

# Parse database name from the URI path, fallback to 'dcm_database'
_parsed = urlparse(MONGO_URI)
_db_name = _parsed.path.lstrip("/") if _parsed.path and _parsed.path != "/" else "dcm_database"
db = client[_db_name]

import zoneinfo
from datetime import datetime

def get_local_now() -> datetime:
    tz = zoneinfo.ZoneInfo("Asia/Kolkata")
    return datetime.now(tz).replace(tzinfo=None)

async def get_next_sequence(sequence_name: str, prefix: str) -> str:
    seq_collection = db.get_collection("sequences")
    year_str = get_local_now().strftime("%Y")
    # We can reset the sequence per year or keep it running. Let's make it continuous but with year in format.
    seq_doc = await seq_collection.find_one_and_update(
        {"_id": sequence_name},
        {"$inc": {"sequence_value": 1}},
        upsert=True,
        return_document=True
    )
    seq_num = seq_doc["sequence_value"]
    return f"{prefix}{year_str}{seq_num:03d}"
