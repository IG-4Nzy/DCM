import os
import re
import motor.motor_asyncio
from urllib.parse import urlparse

MONGO_URI = os.getenv("MONGO_URI", "mongodb://admin:password@localhost:27017/dcm_database?authSource=admin")

client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI, maxPoolSize=200, minPoolSize=10)

# Parse database name from the URI path, fallback to 'dcm_database'
_parsed = urlparse(MONGO_URI)
_db_name = _parsed.path.lstrip("/") if _parsed.path and _parsed.path != "/" else "dcm_database"
_raw_db = client[_db_name]

# NoSQL/Regex injection prevention layers
def sanitize_regex_value(val):
    if not isinstance(val, str):
        return val
    # If the string starts with developer-defined regex constructs, do not escape it
    if val.startswith("^") or val.startswith("(^|,)") or val.startswith(".*^"):
        return val
    return re.escape(val)

def sanitize_query(val):
    if isinstance(val, dict):
        new_dict = {}
        for k, v in val.items():
            if k == "$regex":
                new_dict[k] = sanitize_regex_value(v)
            else:
                new_dict[k] = sanitize_query(v)
        return new_dict
    elif isinstance(val, list):
        return [sanitize_query(item) for item in val]
    else:
        return val

class SafeCollection:
    def __init__(self, collection):
        self._collection = collection

    def __getattr__(self, name):
        attr = getattr(self._collection, name)
        if callable(attr):
            query_methods = {
                "find", "find_one", "count_documents", "update_one", "update_many",
                "delete_one", "delete_many", "find_one_and_update", "find_one_and_delete",
                "find_one_and_replace", "distinct"
            }
            if name in query_methods:
                return self._wrap_query_method(attr, name)
            elif name == "aggregate":
                return self._wrap_aggregate_method(attr)
        return attr

    def _wrap_query_method(self, method, name):
        def wrapped(*args, **kwargs):
            args_list = list(args)
            if args_list:
                args_list[0] = sanitize_query(args_list[0])
            elif "filter" in kwargs:
                kwargs["filter"] = sanitize_query(kwargs["filter"])
            elif "query" in kwargs:
                kwargs["query"] = sanitize_query(kwargs["query"])
            return method(*args_list, **kwargs)
        return wrapped

    def _wrap_aggregate_method(self, method):
        def wrapped(*args, **kwargs):
            args_list = list(args)
            if args_list:
                args_list[0] = sanitize_query(args_list[0])
            elif "pipeline" in kwargs:
                kwargs["pipeline"] = sanitize_query(kwargs["pipeline"])
            return method(*args_list, **kwargs)
        return wrapped

class SafeDatabase:
    def __init__(self, db):
        self._db = db

    def __getattr__(self, name):
        attr = getattr(self._db, name)
        class_name = attr.__class__.__name__
        if "Collection" in class_name:
            return SafeCollection(attr)
        return attr

    def __getitem__(self, name):
        coll = self._db[name]
        return SafeCollection(coll)

    def get_collection(self, name, *args, **kwargs):
        coll = self._db.get_collection(name, *args, **kwargs)
        return SafeCollection(coll)

db = SafeDatabase(_raw_db)

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
