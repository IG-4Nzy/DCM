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
