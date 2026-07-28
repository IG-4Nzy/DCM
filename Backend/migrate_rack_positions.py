import asyncio
import re
from database import db

COLLECTION_NAME = "nodes"


def normalize_position(raw: str) -> str:
    token = raw.strip()

    if not token:
        return token

    if re.match(r"^M \d{2}$", token):
        return token

    match = re.match(r"^[Mm][\s\-]?(\d+)$", token)
    if match:
        return f"M {int(match.group(1)):02d}"

    match = re.match(r"^(\d+)$", token)
    if match:
        return f"M {int(match.group(1)):02d}"

    return token


def normalize_rack_position(raw_value: str) -> str:
    if not raw_value:
        return raw_value

    return ", ".join(
        normalize_position(x)
        for x in raw_value.split(",")
    )


async def migrate(dry_run=True):

    collection = db.get_collection(COLLECTION_NAME)

    cursor = collection.find({
        "rackPosition": {
            "$exists": True,
            "$nin": [None, ""]
        }
    })

    docs = await cursor.to_list(length=None)

    updated = 0
    skipped = 0

    print(f"Found {len(docs)} documents.\n")

    for doc in docs:

        old = doc.get("rackPosition")

        if not isinstance(old, str):
            skipped += 1
            continue

        new = normalize_rack_position(old)

        if old == new:
            skipped += 1
            continue

        name = (
            doc.get("node")
            or doc.get("serverName")
            or str(doc["_id"])
        )

        print(f'{name}: "{old}" -> "{new}"')

        if not dry_run:
            await collection.update_one(
                {"_id": doc["_id"]},
                {"$set": {"rackPosition": new}}
            )

        updated += 1

    print("\nSummary")
    print("-------")
    print("Updated :", updated)
    print("Skipped :", skipped)


if __name__ == "__main__":
    asyncio.run(migrate(dry_run=False))