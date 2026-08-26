from fastapi import APIRouter, HTTPException, status, Body, Query, Depends, Response, Request
from auth_utils import require_privilege, get_current_user
from fastapi.responses import JSONResponse
from typing import Optional
from database import db
from models import DepartmentModel, CreateDepartmentModel, UpdateDepartmentModel, PaginatedDepartmentsModel
from bson import ObjectId
from history_helper import record_audit_log, compute_diff_details, get_client_ip

router = APIRouter()
departments_collection = db.get_collection("departments")

@router.get("/", response_description="List all departments", response_model=PaginatedDepartmentsModel, response_model_by_alias=False)
async def list_departments(
    skip: int = Query(0, ge=0),
    pagination: bool = Query(True),
    limit: int = Query(10, ge=1),
    sortBy: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    order: str = Query("asc"),
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    is_superuser = current_user.get("isSuperuser", False)
    privileges = current_user.get("privileges", [])
    
    allowed = (
        is_superuser or
        "View Department" in privileges or
        "Create Observation" in privileges or
        "Update Observation" in privileges or
        "Create User" in privileges or
        "Update User" in privileges or
        "View Works" in privileges or
        "View All Department Works" in privileges or
        "View Work" in privileges or
        "View Work Log" in privileges or
        "View All Work Logs" in privileges or
        "View Attendance" in privileges or
        "View Morning Checklist" in privileges or
        "View BMS Checklist" in privileges or
        "View Cluster Checklist" in privileges or
        "View Announcements" in privileges
    )
    if not allowed and pagination:
        raise HTTPException(status_code=403, detail="Not enough permissions to view departments")
        
    if not pagination:
        query["status"] = {"$ne": False}
        
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
        
    actual_sort_by = sortBy or sort_by or "name"
    sort_order = 1 if order == "asc" else -1
    
    total = await departments_collection.count_documents(query)
    cursor = departments_collection.find(query).sort(actual_sort_by, sort_order)
    if pagination:
        cursor = cursor.skip(skip).limit(limit)
        departments = await cursor.to_list(length=limit)
    else:
        departments = await cursor.to_list(length=None)
            
    return {"data": departments, "total": total}

@router.post("/", response_description="Create a new department", response_model=DepartmentModel, status_code=status.HTTP_201_CREATED, response_model_by_alias=False, dependencies=[Depends(require_privilege("Create Department"))])
async def create_department(
    request: Request,
    department: CreateDepartmentModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    department_dict = department.model_dump()
    
    # Check if department with same name exists
    existing = await departments_collection.find_one({"name": {"$regex": f"^{department_dict['name']}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=400, detail="Department with this name already exists")
        
    new_department = await departments_collection.insert_one(department_dict)
    created_department = await departments_collection.find_one({"_id": new_department.inserted_id})
    if created_department:
        actor_name = current_user.get("sub") or current_user.get("username") or "Unknown"
        actor_ip = get_client_ip(request)
        dept_head_str = created_department.get("departmentHead") or "None"
        await record_audit_log(
            request=request,
            current_user=current_user,
            action=f"Create Department: {created_department.get('name')}",
            details=f"Department '{created_department.get('name')}' created (Head: {dept_head_str}) by '{actor_name}' from IP {actor_ip}",
            after_state=created_department
        )
    return created_department

@router.get("/{id}", response_description="Get a single department", response_model=DepartmentModel, response_model_by_alias=False, dependencies=[Depends(require_privilege("View Department"))])
async def show_department(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")
        
    department = await departments_collection.find_one({"_id": ObjectId(id)})
    if department is None:
        raise HTTPException(status_code=404, detail=f"Department {id} not found")

    return department

@router.put("/{id}", response_description="Update a department", response_model=DepartmentModel, response_model_by_alias=False, dependencies=[Depends(require_privilege("Update Department"))])
async def update_department(
    id: str,
    request: Request,
    department: UpdateDepartmentModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    existing_department = await departments_collection.find_one({"_id": ObjectId(id)})
    if not existing_department:
        raise HTTPException(status_code=404, detail=f"Department {id} not found")

    department_dict = {k: v for k, v in department.model_dump().items() if v is not None}

    if len(department_dict) >= 1:
        if "name" in department_dict:
            existing = await departments_collection.find_one({
                "name": {"$regex": f"^{department_dict['name']}$", "$options": "i"},
                "_id": {"$ne": ObjectId(id)}
            })
            if existing:
                raise HTTPException(status_code=400, detail="Department with this name already exists")

        update_result = await departments_collection.update_one(
            {"_id": ObjectId(id)}, {"$set": department_dict}
        )

    updated_department = await departments_collection.find_one({"_id": ObjectId(id)})
    if updated_department:
        actor_name = current_user.get("sub") or current_user.get("username") or "Unknown"
        actor_ip = get_client_ip(request)
        diff_text = compute_diff_details(existing_department, updated_department)
        await record_audit_log(
            request=request,
            current_user=current_user,
            action=f"Update Department: {existing_department.get('name')}",
            details=f"Updated fields for department '{existing_department.get('name')}': {diff_text} by '{actor_name}' from IP {actor_ip}",
            before_state=existing_department,
            after_state=updated_department
        )
        return updated_department

    raise HTTPException(status_code=404, detail=f"Department {id} not found")

@router.delete("/{id}", response_description="Delete a department", dependencies=[Depends(require_privilege("Delete Department"))])
async def delete_department(
    id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    existing_department = await departments_collection.find_one({"_id": ObjectId(id)})
    if not existing_department:
        raise HTTPException(status_code=404, detail=f"Department {id} not found")

    delete_result = await departments_collection.delete_one({"_id": ObjectId(id)})

    if delete_result.deleted_count == 1:
        actor_name = current_user.get("sub") or current_user.get("username") or "Unknown"
        actor_ip = get_client_ip(request)
        await record_audit_log(
            request=request,
            current_user=current_user,
            action=f"Delete Department: {existing_department.get('name')}",
            details=f"Deleted department '{existing_department.get('name')}' (ID: {id}) by '{actor_name}' from IP {actor_ip}",
            before_state=existing_department
        )
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    raise HTTPException(status_code=404, detail=f"Department {id} not found")
