from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
import os
import sys

# Import SECRET_KEY and ALGORITHM from auth
# If they are not accessible, we should move them to a config or redefine here
try:
    from auth import SECRET_KEY, ALGORITHM
except ImportError:
    SECRET_KEY = "super-secret-jwt-key-replace-me-in-production"
    ALGORITHM = "HS256"

async def update_attendance_on_request(username: str, user_dept: str, user_role: str):
    try:
        from database import db
        from datetime import datetime
        
        config_collection = db.get_collection("attendance_config")
        config = await config_collection.find_one({}) or {}
        tracked_role = config.get("trackedRole")

        should_track = True
        user_roles = user_role
        if isinstance(user_roles, str):
            user_roles = [user_roles]
        elif not isinstance(user_roles, list):
            user_roles = []
            
        if tracked_role and tracked_role != "All Roles" and tracked_role not in user_roles:
            should_track = False

        if should_track:
            now_local = datetime.now()
            today_str = now_local.strftime("%Y-%m-%d")
            
            attendance_collection = db.get_collection("attendance")
            existing = await attendance_collection.find_one({
                "username": username,
                "date": today_str
            })
            
            if not existing:
                await attendance_collection.insert_one({
                    "username": username,
                    "department": user_dept or "Unassigned",
                    "date": today_str,
                    "firstLogin": now_local.isoformat(),
                    "lastLogout": now_local.isoformat(),
                    "workedHours": 0.0,
                    "regularizeStatus": "None",
                    "regularizeReason": None,
                    "regularizeRemarks": None
                })
            else:
                if existing.get("regularizeStatus") != "Approved":
                    first_login_str = existing.get("firstLogin")
                    worked_hours = 0.0
                    if first_login_str:
                        try:
                            first_login_dt = datetime.fromisoformat(first_login_str)
                            duration = now_local - first_login_dt
                            worked_hours = round(duration.total_seconds() / 3600.0, 2)
                        except Exception:
                            pass
                    
                    await attendance_collection.update_one(
                        {"_id": existing["_id"]},
                        {
                            "$set": {
                                "lastLogout": now_local.isoformat(),
                                "workedHours": worked_hours
                            }
                        }
                    )
    except Exception as e:
        print(f"Error auto-updating attendance on request: {e}")

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        try:
            from database import db
            from datetime import datetime, timezone
            import asyncio
            username = payload.get("sub")
            if username:
                role = payload.get("role", "User")
                department = payload.get("department", "")
                users_col = db.get_collection("users")
                asyncio.create_task(users_col.update_one(
                    {"username": username},
                    {"$set": {"lastActive": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")}}
                ))
                asyncio.create_task(update_attendance_on_request(username, department, role))
        except Exception as e:
            print("Error updating user activity:", e)
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

def require_privilege(required_privilege: str):
    def privilege_checker(current_user: dict = Depends(get_current_user)):
        is_superuser = current_user.get("isSuperuser", False)
        if is_superuser:
            return current_user
            
        user_privileges = current_user.get("privileges", [])
        if required_privilege not in user_privileges:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Not enough permissions. Requires: {required_privilege}"
            )
        return current_user
    return privilege_checker

def require_any_privilege(allowed_privileges: list):
    def privilege_checker(current_user: dict = Depends(get_current_user)):
        is_superuser = current_user.get("isSuperuser", False)
        if is_superuser:
            return current_user
            
        user_privileges = current_user.get("privileges", [])
        if not any(p in user_privileges for p in allowed_privileges):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Not enough permissions. Requires one of: {', '.join(allowed_privileges)}"
            )
        return current_user
    return privilege_checker
