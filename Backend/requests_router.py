from fastapi import APIRouter, HTTPException, status, Body, Query, Depends
from auth_utils import require_privilege, get_current_user
from fastapi.responses import JSONResponse
from typing import Optional, List
from database import db
from models import RequestModel, CreateRequestModel, UpdateRequestModel, PaginatedRequestsModel
from bson import ObjectId
from datetime import datetime, timezone

router = APIRouter()
collection = db.get_collection("requests")
routings_collection = db.get_collection("request_routings")
departments_collection = db.get_collection("departments")
users_collection = db.get_collection("users")


async def get_routing_for_type(request_type: str):
    """Fetch the routing configuration for a given request type."""
    # Try exact match first
    routing = await routings_collection.find_one({"requestType": request_type})
    if routing:
        return routing

    # Fallback mappings for common aliases
    fallbacks = {
        "VM Creation": ["VM Request", "VM_Request", "VM_Creation"],
        "VM Request": ["VM Creation", "VM_Creation", "VM_Request"],
        "DC Entry": ["DC_Entry", "Datacentre Entry", "Datacentre_Entry"],
        "Datacentre Entry": ["DC Entry", "DC_Entry"],
        "Hardware Issuance": ["Hardware_Issuance", "Hardware Issuing", "Hardware_Issuing"],
        "Hardware Replacement": ["Hardware_Replacement", "Hardware Replacing", "Hardware_Replacing"]
    }
    
    aliases = fallbacks.get(request_type, [])
    for alias in aliases:
        routing = await routings_collection.find_one({"requestType": alias})
        if routing:
            return routing

    # Fallback to case-insensitive exact match
    routing = await routings_collection.find_one({"requestType": {"$regex": f"^{request_type}$", "$options": "i"}})
    if routing:
        return routing

    # Substring search as a last resort
    routing = await routings_collection.find_one({"requestType": {"$regex": request_type, "$options": "i"}})
    return routing


async def resolve_assignees(stage: dict, requester_username: str) -> List[str]:
    """Resolve the actual usernames to assign based on the assignment type."""
    assignment_type = stage.get("assignmentType", "")
    assigned_to = stage.get("assignedTo", "")

    if assignment_type == "RequesterDeptHead":
        # Find the requester's department, then get department head
        user = await users_collection.find_one({"username": requester_username})
        if user and user.get("department"):
            dept = await departments_collection.find_one({"name": user["department"]})
            if dept and dept.get("departmentHead"):
                return [dept["departmentHead"]]
        return []

    elif assignment_type == "DeptStaffs":
        # Assign to all staff in the given department
        dept_name = assigned_to
        if dept_name:
            staff_cursor = users_collection.find({"department": dept_name, "status": True})
            staff_list = await staff_cursor.to_list(length=None)
            return [s["username"] for s in staff_list if s.get("username")]
        return []

    elif assignment_type == "SpecificUser":
        if assigned_to:
            return [assigned_to]
        return []

    elif assignment_type == "TargetApprover":
        # Legacy: assigned_to holds the target approver username
        if assigned_to:
            return [assigned_to]
        return []

    elif assignment_type == "TargetApproverDeptStaffs":
        # Legacy: get all staffs from the target approver's department
        if assigned_to:
            user = await users_collection.find_one({"username": assigned_to})
            if user and user.get("department"):
                staff_cursor = users_collection.find({"department": user["department"], "status": True})
                staff_list = await staff_cursor.to_list(length=None)
                return [s["username"] for s in staff_list if s.get("username")]
        return []

    return []


@router.get("/", response_description="List all requests", response_model=PaginatedRequestsModel, response_model_by_alias=False, dependencies=[Depends(require_privilege("View Request"))])
async def list_items(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1),
    pagination: bool = Query(True),
    search: Optional[str] = None,
    completed: Optional[bool] = Query(None),
    sortBy: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    order: str = Query("desc"),
    current_user: dict = Depends(get_current_user)
):
    conditions = []

    is_superuser = current_user.get("isSuperuser", False)
    if not is_superuser:
        username = current_user.get("sub", "")
        # Show requests created by the user OR assigned to them
        conditions.append({
            "$or": [
                {"createdBy": username},
                {"currentAssignedUsers": username}
            ]
        })

    if search:
        conditions.append({"requestType": {"$regex": search, "$options": "i"}})

    if completed is not None:
        if completed:
            conditions.append({"status": "Completed"})
        else:
            conditions.append({"status": {"$ne": "Completed"}})

    if len(conditions) > 1:
        query = {"$and": conditions}
    elif len(conditions) == 1:
        query = conditions[0]
    else:
        query = {}

    actual_sort_by = sortBy or sort_by or "createdAt"
    sort_order = 1 if order == "asc" else -1

    total = await collection.count_documents(query)
    cursor = collection.find(query).sort(actual_sort_by, sort_order)

    if pagination:
        cursor = cursor.skip(skip).limit(limit)
        items = await cursor.to_list(length=limit)
    else:
        items = await cursor.to_list(length=None)

    return {"data": items, "total": total}


@router.get("/stages/{request_type}", response_description="Get stages for a request type", dependencies=[Depends(require_privilege("View Request"))])
async def get_stages(request_type: str, current_user: dict = Depends(get_current_user)):
    """Return the configured stages for a given request type."""
    routing = await get_routing_for_type(request_type)
    if not routing:
        return {"stages": []}
    stages = routing.get("stages", [])
    return {"stages": [s.get("stageName", "") for s in stages]}


@router.post("/", response_description="Create a request", response_model=RequestModel, status_code=status.HTTP_201_CREATED, response_model_by_alias=False, dependencies=[Depends(require_privilege("Create Request"))])
async def create_item(
    payload: CreateRequestModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    item_dict = payload.model_dump()
    requester = current_user.get("sub", "")
    item_dict["createdBy"] = requester
    now = datetime.now(timezone.utc).isoformat()
    item_dict["createdAt"] = now
    item_dict["updatedAt"] = now

    # Look up the routing configuration for this request type
    routing = await get_routing_for_type(payload.requestType)

    if routing and routing.get("stages"):
        stages = sorted(routing["stages"], key=lambda s: s.get("order", 0))
        first_stage = stages[0]
        item_dict["status"] = first_stage.get("stageName", "Pending")
        item_dict["currentStageIndex"] = 0

        # Resolve assignees for the first stage
        assignees = await resolve_assignees(first_stage, requester)
        item_dict["currentAssignedUsers"] = assignees
    else:
        item_dict["status"] = "Pending"
        item_dict["currentStageIndex"] = 0
        item_dict["currentAssignedUsers"] = []

    new_item = await collection.insert_one(item_dict)
    created = await collection.find_one({"_id": new_item.inserted_id})
    return created


@router.put("/{id}", response_description="Update a request", response_model=RequestModel, response_model_by_alias=False)
async def update_item(id: str, payload: UpdateRequestModel = Body(...), current_user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    existing = await collection.find_one({"_id": ObjectId(id)})
    if not existing:
        raise HTTPException(status_code=404, detail=f"Request {id} not found")

    # Authorize: superuser OR has 'Update Request' OR is currently assigned to this request
    is_superuser = current_user.get("isSuperuser", False)
    username = current_user.get("sub", "")
    privileges = current_user.get("privileges", [])
    assigned_users = existing.get("currentAssignedUsers") or []

    if not is_superuser and "Update Request" not in privileges and username not in assigned_users:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to update this request. Must be superuser, have 'Update Request' privilege, or be assigned to this request."
        )

    item_dict = {k: v for k, v in payload.model_dump().items() if v is not None}
    item_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()

    # If status is being changed, handle stage progression
    new_status = item_dict.get("status")
    if new_status and new_status != existing.get("status"):
        request_type = existing.get("requestType") or existing.get("category", "")
        routing = await get_routing_for_type(request_type)

        if routing and routing.get("stages"):
            stages = sorted(routing["stages"], key=lambda s: s.get("order", 0))
            stage_names = [s.get("stageName", "") for s in stages]

            if new_status in stage_names:
                new_index = stage_names.index(new_status)
                item_dict["currentStageIndex"] = new_index

                # Resolve assignees for the new stage
                requester = existing.get("createdBy", "")
                assignees = await resolve_assignees(stages[new_index], requester)
                item_dict["currentAssignedUsers"] = assignees
            elif new_status in ["Completed", "Rejected"]:
                # Terminal status
                item_dict["currentAssignedUsers"] = []
                item_dict["currentStageIndex"] = len(stages)

    update_result = await collection.update_one(
        {"_id": ObjectId(id)}, {"$set": item_dict}
    )

    updated = await collection.find_one({"_id": ObjectId(id)})
    return updated


@router.put("/{id}/advance", response_description="Advance request to next stage", response_model=RequestModel, response_model_by_alias=False)
async def advance_stage(id: str, payload: Optional[dict] = Body(default=None), current_user: dict = Depends(get_current_user)):
    """Advance the request to the next stage in the routing configuration."""
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    existing = await collection.find_one({"_id": ObjectId(id)})
    if not existing:
        raise HTTPException(status_code=404, detail=f"Request {id} not found")

    # Authorize: superuser OR has 'Update Request' OR is currently assigned to this request
    is_superuser = current_user.get("isSuperuser", False)
    username = current_user.get("sub", "")
    privileges = current_user.get("privileges", [])
    assigned_users = existing.get("currentAssignedUsers") or []

    if not is_superuser and "Update Request" not in privileges and username not in assigned_users:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to advance this request. Must be superuser, have 'Update Request' privilege, or be assigned to this request."
        )

    # If payload is provided, update those fields first
    if payload:
        update_fields = {}
        if "details" in payload:
            existing_details = existing.get("details") or {}
            if isinstance(existing_details, dict) and isinstance(payload["details"], dict):
                update_fields["details"] = {**existing_details, **payload["details"]}
            else:
                update_fields["details"] = payload["details"]
        if "remarks" in payload:
            update_fields["remarks"] = payload["remarks"]
        if update_fields:
            await collection.update_one({"_id": ObjectId(id)}, {"$set": update_fields})
            existing = await collection.find_one({"_id": ObjectId(id)})

    request_type = existing.get("requestType") or existing.get("category", "")
    routing = await get_routing_for_type(request_type)

    if not routing or not routing.get("stages"):
        raise HTTPException(status_code=400, detail="No routing configuration found for this request type")

    stages = sorted(routing["stages"], key=lambda s: s.get("order", 0))
    current_index = existing.get("currentStageIndex", 0)
    next_index = current_index + 1

    if next_index >= len(stages):
        # All stages completed
        update_data = {
            "status": "Completed",
            "currentStageIndex": len(stages),
            "currentAssignedUsers": [],
            "updatedAt": datetime.now(timezone.utc).isoformat()
        }
    else:
        next_stage = stages[next_index]
        requester = existing.get("createdBy", "")
        assignees = await resolve_assignees(next_stage, requester)
        update_data = {
            "status": next_stage.get("stageName", ""),
            "currentStageIndex": next_index,
            "currentAssignedUsers": assignees,
            "updatedAt": datetime.now(timezone.utc).isoformat()
        }

    await collection.update_one({"_id": ObjectId(id)}, {"$set": update_data})
    updated = await collection.find_one({"_id": ObjectId(id)})
    return updated



@router.delete("/{id}", response_description="Delete a request", dependencies=[Depends(require_privilege("Delete Request"))])
async def delete_item(id: str, current_user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    delete_result = await collection.delete_one({"_id": ObjectId(id)})

    if delete_result.deleted_count == 1:
        return JSONResponse(status_code=status.HTTP_200_OK, content={"message": "Deleted successfully"})

    raise HTTPException(status_code=404, detail=f"Request {id} not found")
