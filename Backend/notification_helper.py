from database import db
from datetime import datetime, timezone

async def log_page_update(module: str, department: str = None, username: str = None, assignee: str = None):
    try:
        col = db.get_collection("page_updates")
        doc = {
            "module": module,
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "department": department,
            "username": username,
            "assignee": assignee
        }
        await col.insert_one(doc)
    except Exception as e:
        print(f"Error logging page update: {e}")
