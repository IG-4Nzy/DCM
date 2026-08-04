from fastapi import APIRouter, HTTPException, status, Body, Query, Depends, Response, Request
from auth_utils import require_privilege, require_any_privilege, get_current_user
from fastapi.responses import JSONResponse
from typing import List, Optional
from database import db
from models import UserModel, CreateUserModel, UpdateUserModel, PaginatedUsersModel
from bson import ObjectId
from history_helper import record_audit_log, compute_diff_details, get_client_ip
import bcrypt

async def sync_department_head(username: str, department: Optional[str], is_dept_head: Optional[bool], old_username: Optional[str] = None):
    if is_dept_head is None:
        return
    departments_collection = db.get_collection("departments")
    
    # Clear out the old username if provided
    if old_username:
        cursor = departments_collection.find({"departmentHead": old_username})
        async for dept in cursor:
            await departments_collection.update_one(
                {"_id": dept["_id"]},
                {"$set": {"departmentHead": None}}
            )

    cursor = departments_collection.find({"departmentHead": username})
    async for dept in cursor:
        dept_match = str(dept["_id"]) == department or dept.get("name") == department
        if not is_dept_head or not dept_match:
            await departments_collection.update_one(
                {"_id": dept["_id"]},
                {"$set": {"departmentHead": None}}
            )
            
    if is_dept_head and department:
        query = {"_id": ObjectId(department)} if ObjectId.is_valid(department) else {"name": department}
        await departments_collection.update_one(
            query,
            {"$set": {"departmentHead": username}}
        )

router = APIRouter()
users_collection = db.get_collection("users")

async def check_replacement_constraint(replacement_for: Optional[str], exclude_user_id: Optional[str] = None):
    if not replacement_for:
        return
    if not ObjectId.is_valid(replacement_for):
        raise HTTPException(status_code=400, detail="Invalid replacement user ID format")
    
    rep_user = await users_collection.find_one({"_id": ObjectId(replacement_for)})
    if not rep_user:
        raise HTTPException(status_code=404, detail="Relieved user not found")
    
    # Check status of relieved user
    if rep_user.get("status") is not False:
        raise HTTPException(status_code=400, detail="Relieved user must be inactive")
    
    # Check uniqueness: "only can be add to one user"
    dup_query = {"replacementFor": replacement_for}
    if exclude_user_id:
        dup_query["_id"] = {"$ne": ObjectId(exclude_user_id)}
    
    dup_user = await users_collection.find_one(dup_query)
    if dup_user:
        raise HTTPException(status_code=400, detail=f"User '{dup_user.get('username')}' has already replaced this relieved user")

async def populate_replacement_names(users):
    if not users:
        return
    
    is_single = isinstance(users, dict)
    users_list = [users] if is_single else users
    
    rep_ids = []
    for u in users_list:
        rep_id = u.get("replacementFor")
        if rep_id and ObjectId.is_valid(rep_id):
            rep_ids.append(ObjectId(rep_id))
            
    if not rep_ids:
        return
        
    replaced_users = await users_collection.find({"_id": {"$in": rep_ids}}).to_list(length=None)
    replaced_map = {str(ru["_id"]): ru.get("username", "") for ru in replaced_users}
    
    for u in users_list:
        rep_id = u.get("replacementFor")
        if rep_id:
            u["replacementForName"] = replaced_map.get(rep_id)

@router.post("/heartbeat", status_code=status.HTTP_200_OK)
async def user_heartbeat(current_user: dict = Depends(get_current_user)):
    return {"status": "online"}

@router.get("/", response_description="List all users", response_model=PaginatedUsersModel, response_model_by_alias=False)
async def list_users(
    skip: int = Query(0, ge=0),
    pagination: bool = Query(True),
    limit: int = Query(5, ge=1),
    sortBy: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    order: str = Query("asc"),
    search: Optional[str] = None,
    department: Optional[str] = None,
    role: Optional[str] = None,
    status: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if status == "active" or status is None:
        # Default: exclude inactive users unless explicitly asked
        query["status"] = {"$ne": False}
    elif status == "inactive":
        query["status"] = False
    # status == "all" → no status filter, show everyone
        
    is_superuser = current_user.get("isSuperuser", False)
    user_privileges = current_user.get("privileges", [])
    
    has_view_all_access = (
        is_superuser or 
        "View All Users" in user_privileges or 
        "View All Roaster" in user_privileges
    )
    only_dept_scoped = not has_view_all_access
    if not pagination:
        only_dept_scoped = False
    
    async def get_dept_filter(dept_val: str):
        if not dept_val:
            return dept_val
        dept_doc = await db.get_collection("departments").find_one({
            "$or": [
                {"name": dept_val},
                {"_id": ObjectId(dept_val) if ObjectId.is_valid(dept_val) else None}
            ]
        })
        if dept_doc:
            return {"$in": [str(dept_doc["_id"]), dept_doc.get("name", "")]}
        return dept_val

    if only_dept_scoped:
        query["department"] = await get_dept_filter(current_user.get("department") or "None")
    else:
        if department == "me":
            query["department"] = await get_dept_filter(current_user.get("department") or "None")
        elif department:
            query["department"] = await get_dept_filter(department)

    if role:
        query["role"] = role

    if search:
        search_query = {
            "$or": [
                {"username": {"$regex": search, "$options": "i"}},
                {"role": {"$regex": search, "$options": "i"}},
                {"firstName": {"$regex": search, "$options": "i"}},
                {"lastName": {"$regex": search, "$options": "i"}},
                {"$expr": {"$regexMatch": {"input": {"$concat": [{"$ifNull": ["$firstName", ""]}, " ", {"$ifNull": ["$lastName", ""]}]}, "regex": search, "options": "i"}}}
            ]
        }
        if query:
            query = {"$and": [query, search_query]}
        else:
            query = search_query
        
    actual_sort_by = sortBy or sort_by or "username"
    sort_order = 1 if order == "asc" else -1
    
    total = await users_collection.count_documents(query)
    cursor = users_collection.find(query).sort(actual_sort_by, sort_order)
    if pagination:
        cursor = cursor.skip(skip).limit(limit)
        users = await cursor.to_list(length=limit)
    else:
        users = await cursor.to_list(length=None)
    
    departments_collection = db.get_collection("departments")
    depts = await departments_collection.find({}, {"name": 1, "departmentHead": 1}).to_list(length=None)
    dept_heads = {d["departmentHead"] for d in depts if d.get("departmentHead")}

    for user in users:
        if "status" not in user:
            user["status"] = True
        user["isDepartmentHead"] = user.get("username") in dept_heads
        
        # Override lastActive for the current user to prevent page refresh race conditions
        if current_user and user.get("username") == current_user.get("sub") and user.get("status") is not False:
            from datetime import datetime, timezone
            user["lastActive"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            
    await populate_replacement_names(users)
    return {"data": users, "total": total}

@router.post("/", response_description="Create a new user", response_model=UserModel, status_code=status.HTTP_201_CREATED, response_model_by_alias=False, dependencies=[Depends(require_privilege("Create User"))])
async def create_user(
    request: Request,
    user: CreateUserModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    user_dict = user.model_dump()
    is_dept_head = user_dict.pop("isDepartmentHead", None)
    
    if await users_collection.find_one({"username": user_dict["username"]}):
        raise HTTPException(status_code=400, detail="Username already registered")
        
    # Check replacement constraints
    await check_replacement_constraint(user_dict.get("replacementFor"))
        
    pass_number = user_dict.get("passNumber")
    if pass_number and isinstance(pass_number, str) and pass_number.strip():
        if await users_collection.find_one({"passNumber": pass_number.strip()}):
            raise HTTPException(status_code=400, detail="Pass Number already exists")
            
    hashed_password = bcrypt.hashpw(user_dict["password"].encode('utf-8'), bcrypt.gensalt())
    user_dict["password"] = hashed_password.decode('utf-8')
    
    new_user = await users_collection.insert_one(user_dict)
    
    await sync_department_head(user_dict["username"], user_dict.get("department"), is_dept_head)
    
    created_user = await users_collection.find_one({"_id": new_user.inserted_id})
    if created_user:
        created_user["isDepartmentHead"] = is_dept_head or False
        await populate_replacement_names(created_user)
        
        actor_name = current_user.get("sub") or current_user.get("username") or "Unknown"
        actor_ip = get_client_ip(request)
        target_name = f"{created_user.get('firstName', '')} {created_user.get('lastName', '')}".strip() or created_user.get("username")
        await record_audit_log(
            request=request,
            current_user=current_user,
            action=f"Create User: {created_user.get('username')}",
            details=f"User '{created_user.get('username')}' ({target_name}) created in department '{created_user.get('department', '--')}' with role '{created_user.get('role', '--')}' by '{actor_name}' from IP {actor_ip}",
            after_state=created_user
        )
    return created_user

@router.get("/{id}", response_description="Get a single user", response_model=UserModel, response_model_by_alias=False, dependencies=[Depends(require_any_privilege(["View All Users", "View Department Users"]))])
async def show_user(id: str, current_user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")
        
    if (user := await users_collection.find_one({"_id": ObjectId(id)})) is not None:
        is_superuser = current_user.get("isSuperuser", False)
        user_privileges = current_user.get("privileges", [])
        only_dept_scoped = not (is_superuser or "View All Users" in user_privileges)
        
        if only_dept_scoped and user.get("department") != current_user.get("department"):
            raise HTTPException(status_code=403, detail="Not enough privileges to view users outside your department")

        if "status" not in user:
            user["status"] = True
        departments_collection = db.get_collection("departments")
        is_head = await departments_collection.find_one({"departmentHead": user.get("username")}) is not None
        user["isDepartmentHead"] = is_head
        
        # Override lastActive for the current user to prevent page refresh race conditions
        if current_user and user.get("username") == current_user.get("sub") and user.get("status") is not False:
            from datetime import datetime, timezone
            user["lastActive"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            
        await populate_replacement_names(user)
        return user
    raise HTTPException(status_code=404, detail=f"User {id} not found")

@router.put("/{id}", response_description="Update a user", response_model=UserModel, response_model_by_alias=False, dependencies=[Depends(require_privilege("Update User"))])
async def update_user(
    id: str,
    request: Request,
    user: UpdateUserModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    existing_user = await users_collection.find_one({"_id": ObjectId(id)})
    if not existing_user:
        raise HTTPException(status_code=404, detail=f"User {id} not found")

    user_dict = {k: v for k, v in user.model_dump().items() if v is not None}
    is_dept_head = user_dict.pop("isDepartmentHead", None)

    # Check replacement constraints if replacementFor is updated/added
    if "replacementFor" in user_dict:
        await check_replacement_constraint(user_dict.get("replacementFor"), id)

    if "passNumber" in user_dict:
        pass_number = user_dict["passNumber"]
        if pass_number and isinstance(pass_number, str) and pass_number.strip():
            existing_pass = await users_collection.find_one({
                "passNumber": pass_number.strip(),
                "_id": {"$ne": ObjectId(id)}
            })
            if existing_pass:
                raise HTTPException(status_code=400, detail="Pass Number already exists")

    if "password" in user_dict:
        user_dict["password"] = bcrypt.hashpw(user_dict["password"].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    if len(user_dict) >= 1:
        update_result = await users_collection.update_one(
            {"_id": ObjectId(id)}, {"$set": user_dict}
        )

    updated_user = await users_collection.find_one({"_id": ObjectId(id)})
    
    if is_dept_head is not None and updated_user:
        await sync_department_head(
            updated_user.get("username"),
            updated_user.get("department"),
            is_dept_head,
            existing_user.get("username") if existing_user.get("username") != updated_user.get("username") else None
        )

    if updated_user:
        if "status" not in updated_user:
            updated_user["status"] = True
        departments_collection = db.get_collection("departments")
        is_head = await departments_collection.find_one({"departmentHead": updated_user.get("username")}) is not None
        updated_user["isDepartmentHead"] = is_head
        await populate_replacement_names(updated_user)

        actor_name = current_user.get("sub") or current_user.get("username") or "Unknown"
        actor_ip = get_client_ip(request)
        diff_text = compute_diff_details(existing_user, updated_user)
        await record_audit_log(
            request=request,
            current_user=current_user,
            action=f"Update User: {existing_user.get('username')}",
            details=f"Updated fields for '{existing_user.get('username')}': {diff_text} by '{actor_name}' from IP {actor_ip}",
            before_state=existing_user,
            after_state=updated_user
        )
        return updated_user

    raise HTTPException(status_code=404, detail=f"User {id} not found")

@router.delete("/{id}", response_description="Delete a user", dependencies=[Depends(require_privilege("Delete User"))])
async def delete_user(
    id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    existing_user = await users_collection.find_one({"_id": ObjectId(id)})
    if not existing_user:
        raise HTTPException(status_code=404, detail=f"User {id} not found")

    delete_result = await users_collection.delete_one({"_id": ObjectId(id)})

    if delete_result.deleted_count == 1:
        actor_name = current_user.get("sub") or current_user.get("username") or "Unknown"
        actor_ip = get_client_ip(request)
        user_label = f"{existing_user.get('username')} ({existing_user.get('firstName', '')} {existing_user.get('lastName', '')})".strip()
        await record_audit_log(
            request=request,
            current_user=current_user,
            action=f"Delete User: {existing_user.get('username')}",
            details=f"Deleted user '{user_label}' (Department: {existing_user.get('department', '--')}) by '{actor_name}' from IP {actor_ip}",
            before_state=existing_user
        )
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    raise HTTPException(status_code=404, detail=f"User {id} not found")
