from fastapi import APIRouter, Depends, Body, HTTPException
from auth_utils import get_current_user
from database import db
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import Dict, List, Optional
from bson import ObjectId

router = APIRouter()

class RouteVisitModel(BaseModel):
    route: str

@router.post("/visit")
async def record_page_visit(
    payload: RouteVisitModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    username = current_user.get("sub")
    route = payload.route
    
    visits_col = db.get_collection("user_page_visits")
    now_str = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    
    await visits_col.update_one(
        {"username": username, "route": route},
        {"$set": {"lastVisitedAt": now_str}},
        upsert=True
    )
    return {"status": "success", "visitedAt": now_str}

@router.get("/unread", response_description="Get unread flags for all menu routes")
async def get_unread_flags(current_user: dict = Depends(get_current_user)):
    username = current_user.get("sub")
    is_superuser = current_user.get("isSuperuser", False)
    user_privileges = current_user.get("privileges", [])
    
    users_col = db.get_collection("users")
    visits_col = db.get_collection("user_page_visits")
    updates_col = db.get_collection("page_updates")
    
    # Load user details
    user_rec = await users_col.find_one({"username": username})
    if not user_rec:
        raise HTTPException(status_code=404, detail="User record not found")
        
    user_dept = user_rec.get("department", "General")
    user_id_str = str(user_rec["_id"])
    
    # Define routes and corresponding configs
    # route -> {module, privileges}
    route_configs = {
        "/users": {
            "module": "users",
            "privileges": ["View All Users", "View Department Users", "Create User", "Update User", "Delete User"]
        },
        "/roles": {
            "module": "roles",
            "privileges": ["View Role", "Create Role", "Update Role", "Delete Role"]
        },
        "/works": {
            "module": "works",
            "privileges": ["View All Work", "View Assigned Work", "Create Work", "Update Work", "Delete Work"]
        },
        "/departments": {
            "module": "departments",
            "privileges": ["View Department", "Create Department", "Update Department", "Delete Department"]
        },
        "/roaster": {
            "module": "roasters",
            "privileges": ["View Roaster", "Create Roaster", "Update Roaster", "Delete Roaster"]
        },
        "/observations": {
            "module": "observations",
            "privileges": ["View Observations", "Create Observation", "Update Observation", "Delete Observation"]
        },
        "/inventory": {
            "module": "inventory",
            "privileges": ["View All Inventory", "View Department Inventory", "Create Inventory", "Update Inventory", "Delete Inventory"]
        },
        "/configurations": {
            "module": "configurations",
            "privileges": ["View Configurations", "Create Configuration", "Update Configurations", "Delete Configurations"]
        },
        "/clusters": {
            "module": "clusters",
            "privileges": ["View Cluster", "Create Cluster", "Update Cluster", "Delete Cluster"]
        },
        "/requests": {
            "module": "requests",
            "privileges": ["View Request", "Create Request", "Update Request", "Delete Request"]
        },
        "/server-monitoring": {
            "module": "server-monitoring",
            "privileges": ["View Server Monitoring"]
        },
        "/attendance": {
            "module": "attendance",
            "privileges": ["View All Attendance", "View Departmental Attendance", "View Self Attendance"]
        },
        "/documentations": {
            "module": "documentations",
            "privileges": ["View Documentation"]
        },
        "/daily-activities": {
            "module": "daily-activities",
            "privileges": [
                "View BMS Checklist", "Create BMS Checklist", "Update BMS Checklist", "Delete BMS Checklist",
                "View Morning Checklist", "Create Morning Checklist", "Update Morning Checklist", "Delete Morning Checklist"
            ]
        },
        "/visitor-logs": {
            "module": "visitor-logs",
            "privileges": ["View Request"]
        }
    }
    
    unread_flags = {}
    
    for route, config in route_configs.items():
        module = config["module"]
        required_privs = config["privileges"]
        
        # Check privilege
        has_priv = is_superuser or any(p in user_privileges for p in required_privs)
        if not has_priv:
            unread_flags[route] = False
            continue
            
        # Get user's last visited time for this route
        visit_doc = await visits_col.find_one({"username": username, "route": route})
        last_visited = visit_doc.get("lastVisitedAt", "1970-01-01T00:00:00Z") if visit_doc else "1970-01-01T00:00:00Z"
        
        # Find updates for this module after last visited time
        # Exclude edits made by the user themselves
        update_query = {
            "module": module,
            "timestamp": {"$gt": last_visited},
            "username": {"$ne": username}
        }
        
        updates_cursor = updates_col.find(update_query)
        updates = await updates_cursor.to_list(length=100)
        
        if not updates:
            unread_flags[route] = False
            continue
            
        # Apply scoped visibility filters on the updates
        is_unread = False
        for update in updates:
            up_dept = update.get("department")
            up_assignee = update.get("assignee")
            
            # 1. Daily Activities (Checklists) - only unread if same department
            if module == "daily-activities":
                if is_superuser or (up_dept and up_dept == user_dept):
                    is_unread = True
                    break
                    
            # 2. Roasters - only same department
            elif module == "roasters":
                if is_superuser or (up_dept and up_dept == user_dept):
                    is_unread = True
                    break
                    
            # 3. Works - assignee check
            elif module == "works":
                if is_superuser or "View All Work" in user_privileges:
                    is_unread = True
                    break
                elif "View Assigned Work" in user_privileges:
                    if up_assignee == user_id_str:
                        is_unread = True
                        break
                        
            # 4. Observations - same department
            elif module == "observations":
                if is_superuser or (up_dept and up_dept == user_dept):
                    is_unread = True
                    break
                    
            # 5. Inventory - same department if departmental
            elif module == "inventory":
                if is_superuser or "View All Inventory" in user_privileges:
                    is_unread = True
                    break
                elif "View Department Inventory" in user_privileges:
                    if up_dept and up_dept == user_dept:
                        is_unread = True
                        break
                        
            # 6. Attendance - same department
            elif module == "attendance":
                if is_superuser or "View All Attendance" in user_privileges:
                    is_unread = True
                    break
                elif "View Departmental Attendance" in user_privileges:
                    if up_dept and up_dept == user_dept:
                        is_unread = True
                        break
                elif "View Self Attendance" in user_privileges:
                    # If regular user, show unread only if the change is a regularization status update for their own logs
                    # The update document logs attendance changes with department, but since it's their own log,
                    # up_assignee (if added, or just department) could match. For simplicity, if same department is ok
                    if up_dept and up_dept == user_dept:
                        is_unread = True
                        break
            
            # Default fallback for other modules (users, roles, departments, requests, documentations, clusters)
            else:
                is_unread = True
                break
                
        unread_flags[route] = is_unread
        
    return unread_flags
