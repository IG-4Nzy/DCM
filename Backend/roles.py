from fastapi import APIRouter, HTTPException, status, Body, Query, Depends, Response, Request
from auth_utils import require_privilege, get_current_user
from fastapi.responses import JSONResponse
from typing import List, Optional
from database import db
from models import RoleModel, CreateRoleModel, UpdateRoleModel, PaginatedRolesModel
from bson import ObjectId
from history_helper import record_audit_log, compute_diff_details, get_client_ip
import json
import os

router = APIRouter()
roles_collection = db.get_collection("roles")

@router.get("/", response_description="List all roles", response_model=PaginatedRolesModel, response_model_by_alias=False)
async def list_roles(
    skip: int = Query(0, ge=0),
    pagination: bool = Query(True),
    limit: int = Query(5, ge=1),
    sortBy: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    order: str = Query("asc"),
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    is_superuser = current_user.get("isSuperuser", False)
    privileges = current_user.get("privileges", [])
    
    allowed = (
        is_superuser or 
        "View Role" in privileges or 
        "Create Observation" in privileges or 
        "Update Observation" in privileges or
        "Create User" in privileges or
        "Update User" in privileges
    )
    if not allowed and pagination:
        raise HTTPException(status_code=403, detail="Not enough privileges to view roles")

    query = {}
    if not pagination:
        query["status"] = {"$ne": False}

    if search:
        if not pagination:
            query = {
                "$and": [
                    {"status": {"$ne": False}},
                    {"name": {"$regex": search, "$options": "i"}}
                ]
            }
        else:
            query = {
                "name": {"$regex": search, "$options": "i"}
            }
        
    actual_sort_by = sortBy or sort_by or "name"
    sort_order = 1 if order == "asc" else -1
    
    total = await roles_collection.count_documents(query)
    cursor = roles_collection.find(query).sort(actual_sort_by, sort_order)
    if pagination:
        cursor = cursor.skip(skip).limit(limit)
        roles = await cursor.to_list(length=limit)
    else:
        roles = await cursor.to_list(length=None)
    

    users_collection = db.get_collection("users")
    for role in roles:
        if "status" not in role:
            role["status"] = True
        if "privileges" not in role:
            role["privileges"] = []
        if "lateLoginPrivileges" not in role:
            role["lateLoginPrivileges"] = []
        
        role_id_str = str(role["_id"])
        users_count = await users_collection.count_documents({
            "$or": [
                {"role": role_id_str},
                {"role": {"$in": [role_id_str]}}
            ]
        })
        role["usersCount"] = users_count

            
    return {"data": roles, "total": total}

@router.post("/", response_description="Create a new role", response_model=RoleModel, status_code=status.HTTP_201_CREATED, response_model_by_alias=False, dependencies=[Depends(require_privilege("Create Role"))])
async def create_role(
    request: Request,
    role: CreateRoleModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    role_dict = role.model_dump()
    
    if await roles_collection.find_one({"name": role_dict["name"]}):
        raise HTTPException(status_code=400, detail="Role already exists")
        
    new_role = await roles_collection.insert_one(role_dict)
    created_role = await roles_collection.find_one({"_id": new_role.inserted_id})
    if created_role:
        actor_name = current_user.get("sub") or current_user.get("username") or "Unknown"
        actor_ip = get_client_ip(request)
        privs_count = len(created_role.get("privileges", []))
        await record_audit_log(
            request=request,
            current_user=current_user,
            action=f"Create Role: {created_role.get('name')}",
            details=f"Role '{created_role.get('name')}' created with {privs_count} privileges by '{actor_name}' from IP {actor_ip}",
            after_state=created_role
        )
    return created_role

@router.get("/privileges", response_description="List all available privileges")
async def list_privileges():
    file_path = os.path.join(os.path.dirname(__file__), "privileges.json")
    try:
        with open(file_path, "r") as f:
            privileges = json.load(f)
    except Exception:
        privileges = []
        
    return {
        "data": privileges
    }

@router.get("/{id}", response_description="Get a single role", response_model=RoleModel, response_model_by_alias=False, dependencies=[Depends(require_privilege("View Role"))])
async def show_role(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")
        
    if (role := await roles_collection.find_one({"_id": ObjectId(id)})) is not None:
        if "status" not in role:
            role["status"] = True
        if "privileges" not in role:
            role["privileges"] = []
        if "lateLoginPrivileges" not in role:
            role["lateLoginPrivileges"] = []
        return role
    raise HTTPException(status_code=404, detail=f"Role {id} not found")

@router.put("/{id}", response_description="Update a role", response_model=RoleModel, response_model_by_alias=False, dependencies=[Depends(require_privilege("Update Role"))])
async def update_role(
    id: str,
    request: Request,
    role: UpdateRoleModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    existing_role = await roles_collection.find_one({"_id": ObjectId(id)})
    if not existing_role:
        raise HTTPException(status_code=404, detail=f"Role {id} not found")

    role_dict = {k: v for k, v in role.model_dump().items() if v is not None}

    if len(role_dict) >= 1:
        update_result = await roles_collection.update_one(
            {"_id": ObjectId(id)}, {"$set": role_dict}
        )

    updated_role = await roles_collection.find_one({"_id": ObjectId(id)})
    if updated_role:
        if "status" not in updated_role:
            updated_role["status"] = True
        if "privileges" not in updated_role:
            updated_role["privileges"] = []
        if "lateLoginPrivileges" not in updated_role:
            updated_role["lateLoginPrivileges"] = []
            
        actor_name = current_user.get("sub") or current_user.get("username") or "Unknown"
        actor_ip = get_client_ip(request)
        diff_text = compute_diff_details(existing_role, updated_role)
        await record_audit_log(
            request=request,
            current_user=current_user,
            action=f"Update Role: {existing_role.get('name')}",
            details=f"Updated fields for role '{existing_role.get('name')}': {diff_text} by '{actor_name}' from IP {actor_ip}",
            before_state=existing_role,
            after_state=updated_role
        )
        return updated_role

    raise HTTPException(status_code=404, detail=f"Role {id} not found")

@router.delete("/{id}", response_description="Delete a role", dependencies=[Depends(require_privilege("Delete Role"))])
async def delete_role(
    id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    existing_role = await roles_collection.find_one({"_id": ObjectId(id)})
    if not existing_role:
        raise HTTPException(status_code=404, detail=f"Role {id} not found")

    delete_result = await roles_collection.delete_one({"_id": ObjectId(id)})

    if delete_result.deleted_count == 1:
        actor_name = current_user.get("sub") or current_user.get("username") or "Unknown"
        actor_ip = get_client_ip(request)
        await record_audit_log(
            request=request,
            current_user=current_user,
            action=f"Delete Role: {existing_role.get('name')}",
            details=f"Deleted role '{existing_role.get('name')}' (ID: {id}) by '{actor_name}' from IP {actor_ip}",
            before_state=existing_role
        )
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    raise HTTPException(status_code=404, detail=f"Role {id} not found")
