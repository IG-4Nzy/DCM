import asyncio
from Backend.requests_router import resolve_assignees

async def main():
    stage = {"assignmentType": "Mixed", "assignedTo": ["Role:Admin"]}
    # It would call resolve_assignees recursively.
    pass

asyncio.run(main())
