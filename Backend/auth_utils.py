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

async def update_attendance_on_request(username: str, user_dept: str, user_roles_ids: list):
    try:
        from database import db, get_local_now
        from datetime import datetime
        
        config_collection = db.get_collection("attendance_config")
        config = await config_collection.find_one({}) or {}
        tracked_role = config.get("trackedRole")

        should_track = True
        user_roles = user_roles_ids
        if isinstance(user_roles, str):
            user_roles = [user_roles]
        elif not isinstance(user_roles, list):
            user_roles = []
            
        if tracked_role and tracked_role != "All Roles" and tracked_role not in user_roles:
            should_track = False

        if should_track:
            now_local = get_local_now()
            today_str = now_local.strftime("%Y-%m-%d")
            
            # Close any past open attendance records (safety fallback)
            try:
                from attendance_helpers import close_past_open_attendances
                await close_past_open_attendances(username, now_local, None)
            except Exception as e:
                print(f"Error closing past open attendances in request: {e}")
            
            from attendance_helpers import get_target_attendance_date_details
            details = await get_target_attendance_date_details(username, now_local)
            target_date = details["date"]
            
            attendance_collection = db.get_collection("attendance")
            existing = await attendance_collection.find_one({
                "username": username,
                "date": target_date
            })
            
            if not existing:
                from attendance_helpers import get_shift_details_for_date
                shift_name, shift_start_str, shift_end_str = await get_shift_details_for_date(
                    username, target_date
                )
                await attendance_collection.insert_one({
                    "username": username,
                    "department": user_dept or "Unassigned",
                    "date": target_date,
                    "firstLogin": now_local.isoformat(),
                    "lastLogout": now_local.isoformat(),
                    "workedHours": 0.0,
                    "regularizeStatus": "None",
                    "regularizeReason": None,
                    "regularizeRemarks": None,
                    "loggedOut": False,
                    "shiftName": shift_name,
                    "shiftStart": shift_start_str,
                    "shiftEnd": shift_end_str
                })
            else:
                if existing.get("regularizeStatus") != "Approved" and not existing.get("loggedOut", False):
                    first_login_str = existing.get("firstLogin")
                    
                    # Apply Logout Update Rule
                    existing_logout_str = existing.get("lastLogout")
                    should_update_logout = True
                    if existing_logout_str:
                        try:
                            existing_logout_dt = datetime.fromisoformat(existing_logout_str)
                            if now_local <= existing_logout_dt:
                                should_update_logout = False
                        except Exception:
                            pass
                    
                    if should_update_logout:
                        worked_hours = 0.0
                        if first_login_str:
                            try:
                                first_login_dt = datetime.fromisoformat(first_login_str)
                                duration = now_local - first_login_dt
                                worked_hours = round(duration.total_seconds() / 3600.0, 1)
                            except Exception:
                                pass
                        
                        await attendance_collection.update_one(
                            {"_id": existing["_id"]},
                            {
                                "$set": {
                                    "lastLogout": now_local.isoformat(),
                                    "workedHours": worked_hours,
                                    "loggedOut": False
                                }
                            }
                        )
    except Exception as e:
        print(f"Error auto-updating attendance on request: {e}")

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        from database import db
        users_col = db.get_collection("users")
        user = await users_col.find_one({"username": username})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        user_session_key = user.get("session_key")
        token_session_key = payload.get("session_key")
        if user_session_key and user_session_key != token_session_key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session expired: logged in from another location",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        try:
            from datetime import datetime, timezone
            import asyncio
            
            # Use fresh data from DB instead of stale token payload for department
            payload["department"] = user.get("department", "")
            
            role_ids = payload.get("roleIds", [])
            department = payload.get("department", "")

            async def _update_last_active():
                await users_col.update_one(
                    {"username": username},
                    {"$set": {"lastActive": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")}}
                )

            asyncio.create_task(_update_last_active())
            asyncio.create_task(update_attendance_on_request(username, department, role_ids))
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

async def filter_vms_by_owner_ip(vms_list: list, current_user: dict) -> list:
    if not vms_list or not isinstance(vms_list, list):
        return []

    is_superuser = current_user.get("isSuperuser", False)
    privileges = current_user.get("privileges", [])

    # Superusers and users with "View Server Monitoring" see ALL VMs
    if is_superuser or "View Server Monitoring" in privileges:
        return vms_list

    # Check if user has "view_own_vcenter_vm_monitoring" or "View Own vCenter VM Monitoring"
    has_own_privilege = (
        "view_own_vcenter_vm_monitoring" in privileges or
        "View Own vCenter VM Monitoring" in privileges
    )
    if not has_own_privilege:
        return []

    username = current_user.get("sub") or current_user.get("username")
    if not username:
        return []

    from database import db
    from bson import ObjectId

    users_col = db.get_collection("users")
    user_doc = await users_col.find_one({"username": username})
    if not user_doc and ObjectId.is_valid(username):
        user_doc = await users_col.find_one({"_id": ObjectId(username)})

    admins = {username}
    if user_doc:
        admins.add(str(user_doc["_id"]))
        if user_doc.get("username"):
            admins.add(user_doc["username"])

    vm_col = db.get_collection("vm_details")
    owned_vms = await vm_col.find({"admin": {"$in": list(admins)}}).to_list(length=None)

    owned_ips = set()
    for vm in owned_vms:
        ip_val = vm.get("ipAddress") or vm.get("ip")
        if ip_val:
            if isinstance(ip_val, list):
                for item in ip_val:
                    if item and str(item).strip() and str(item).strip() != "0.0.0.0":
                        owned_ips.add(str(item).strip())
            elif isinstance(ip_val, str):
                for item in ip_val.replace(",", " ").split():
                    item_clean = item.strip()
                    if item_clean and item_clean != "0.0.0.0":
                        owned_ips.add(item_clean)

    filtered_vms = []
    for vm in vms_list:
        vm_ip_val = vm.get("ipAddress") or vm.get("ip") or vm.get("guest_ip")
        vm_ips = set()
        if vm_ip_val:
            if isinstance(vm_ip_val, list):
                for item in vm_ip_val:
                    if item and str(item).strip() and str(item).strip() != "0.0.0.0":
                        vm_ips.add(str(item).strip())
            elif isinstance(vm_ip_val, str):
                for item in vm_ip_val.replace(",", " ").split():
                    item_clean = item.strip()
                    if item_clean and item_clean != "0.0.0.0":
                        vm_ips.add(item_clean)

        if any(ip in owned_ips for ip in vm_ips):
            filtered_vms.append(vm)

    return filtered_vms
