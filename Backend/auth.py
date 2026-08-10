from fastapi import APIRouter, HTTPException, status, Depends, Body
from pydantic import BaseModel
from typing import Optional, Union, List
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from database import db, get_local_now
from auth_utils import get_current_user

router = APIRouter()

SECRET_KEY = "super-secret-jwt-key-replace-me-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480 # Token valid for 8 hours

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    token: str
    role: Union[str, list[str]]
    username: str
    privileges: list[str]
    isSuperuser: bool = False
    showBirthdayWish: bool = False
    displayName: Optional[str] = None

class UpdateProfileModel(BaseModel):
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    dob: Optional[str] = None
    mobile: Optional[str] = None
    bloodGroup: Optional[str] = None
    address: Optional[str] = None
    passNumber: Optional[str] = None
    stickyNoteEnabled: Optional[bool] = None
    stickyNoteContent: Optional[str] = None
    stickyNotePositionX: Optional[int] = None
    stickyNotePositionY: Optional[int] = None

class ChangePasswordRequest(BaseModel):
    currentPassword: str
    newPassword: str

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(hours=8)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def is_birthday_today(dob: Optional[str], today: datetime) -> bool:
    if not dob:
        return False

    formats = ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y")
    for date_format in formats:
        try:
            parsed = datetime.strptime(dob[:10], date_format)
            return parsed.month == today.month and parsed.day == today.day
        except ValueError:
            continue

    return False

@router.post("/login", response_model=LoginResponse)
async def login(credentials: LoginRequest):
    users_collection = db.get_collection("users")
    user = await users_collection.find_one({"username": credentials.username})
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
        
    is_valid = bcrypt.checkpw(credentials.password.encode('utf-8'), user["password"].encode('utf-8'))
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
        
    if user.get("status") is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Contact your administrator"
        )
        
    role = user.get("role", "User")
    
    user_roles = role
    if isinstance(user_roles, str):
        user_roles = [user_roles]
    elif not isinstance(user_roles, list):
        user_roles = ["User"]
        
    roles_collection = db.get_collection("roles")
    privileges_set = set()
    role_names = []
    from bson import ObjectId
    for role_id in user_roles:
        role_obj = None
        if ObjectId.is_valid(role_id):
            role_obj = await roles_collection.find_one({"_id": ObjectId(role_id)})
        if not role_obj:
            role_obj = await roles_collection.find_one({"name": role_id})
        if role_obj:
            privileges_set.update(role_obj.get("privileges", []))
            if role_obj.get("name"):
                role_names.append(role_obj.get("name"))
        else:
            role_names.append(role_id)
            
    privileges = list(privileges_set)
    resolved_role = role_names[0] if len(role_names) == 1 else role_names
    
    is_superuser = user.get("is_superuser", False)
    
    import uuid
    is_monitor = user.get("isMonitorUser", False)
    if is_monitor:
        session_key = user.get("session_key") or str(uuid.uuid4())
    else:
        session_key = str(uuid.uuid4())
    await users_collection.update_one(
        {"username": user["username"]},
        {"$set": {"session_key": session_key}}
    )
    
    token_expiry = timedelta(days=3650) if is_monitor else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # Generate the JWT
    access_token = create_access_token(
    data={
        "sub": user["username"],
        "role": resolved_role,
        "roleIds": user_roles,
        "privileges": privileges,
        "isSuperuser": is_superuser,
        "department": user.get("department", ""),
        "session_key": session_key,
        "isMonitorUser": is_monitor
    },
    expires_delta=token_expiry
)
    
    is_first_login_today = False

    # Record first login of the day in attendance — and block late logins
    try:
        config_collection = db.get_collection("attendance_config")
        config = await config_collection.find_one({}) or {}
        tracked_role = config.get("trackedRole")
        late_login_restriction = config.get("lateLoginRestriction", True)

        should_track = True
        if user.get("username") == "dcs_dev":
            should_track = False
        elif tracked_role and tracked_role != "All Roles" and tracked_role not in user_roles:
            should_track = False

        if should_track:
            now_local = get_local_now()
            today_str = now_local.strftime("%Y-%m-%d")
            
            # Close any past open attendance records using the user's lastActive before it gets updated
            try:
                from attendance_helpers import close_past_open_attendances
                await close_past_open_attendances(user["username"], now_local, user.get("lastActive"))
            except Exception as e:
                print(f"Error closing past open attendances in login: {e}")
            
            from attendance_helpers import get_target_attendance_date_details
            details = await get_target_attendance_date_details(user["username"], now_local)
            target_date = details["date"]
            is_prev_day = details["is_prev_day"]
            
            attendance_collection = db.get_collection("attendance")
            existing_attendance = await attendance_collection.find_one({
                "username": user["username"],
                "date": target_date
            })

            if existing_attendance:
                # If they logged in again during their active shift (same day or active previous night shift), reactivate it
                if existing_attendance.get("loggedOut", False):
                    if not is_prev_day or not details.get("is_closed", False):
                        await attendance_collection.update_one(
                            {"_id": existing_attendance["_id"]},
                            {"$set": {"loggedOut": False}}
                        )
                # If there's already a pending/rejected late attempt, keep blocking only if restriction is enabled
                late_status = existing_attendance.get("lateApprovalStatus")
                if existing_attendance.get("isLateAttempt") and late_login_restriction:
                    all_checklist_privileges = [
                        "View BMS Checklist", "View All Department BMS Checklist", "Create BMS Checklist", "Update BMS Checklist", "Delete BMS Checklist", "Edit BMS Checklist Field",
                        "View Cluster Checklist", "View All Department Cluster Checklist", "Create Cluster Checklist", "Update Cluster Checklist", "Delete Cluster Checklist", "Edit Cluster Checklist Field",
                        "View Morning Checklist", "Create Morning Checklist", "Update Morning Checklist", "Delete Morning Checklist", "Edit Morning Checklist Field",
                        "View Work Log", "View All Work Logs", "Create Work Log", "Update Work Log", "Delete Work Log",
                        "View All Work", "View All Department Works", "View Assigned Work", "View Emergency Work",
                        "Create Work", "Create Emergency Work", "Update Work", "Delete Work"
                    ]
                    restricted_privileges = [p for p in all_checklist_privileges if p in privileges]
                    restricted_token = create_access_token(
                        data={
                            "sub": user["username"],
                            "role": role,
                            "privileges": restricted_privileges,
                            "isSuperuser": False,
                            "department": user.get("department", ""),
                            "session_key": session_key
                        },
                        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
                    )

                    if late_status == "Pending":
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail={
                                "message": "You are late, you are not allowed to login, contact your department head",
                                "restricted_token": restricted_token,
                                "role": resolved_role,
                                "privileges": restricted_privileges,
                                "isSuperuser": False,
                                "username": user["username"],
                                "displayName": " ".join(part for part in [user.get("firstName", ""), user.get("lastName", "")] if part) or user["username"]
                            }
                        )
                    elif late_status == "Rejected":
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail={
                                "message": "Your late login request has been rejected, contact your department head",
                                "restricted_token": restricted_token,
                                "role": resolved_role,
                                "privileges": restricted_privileges,
                                "isSuperuser": False,
                                "username": user["username"],
                                "displayName": " ".join(part for part in [user.get("firstName", ""), user.get("lastName", "")] if part) or user["username"]
                            }
                        )
                    # If "Approved", fall through and allow login
            else:
                # Determine shift details for target_date
                from attendance_helpers import get_shift_details_for_date
                shift_name, shift_start_str, shift_end_str = await get_shift_details_for_date(
                    user["username"], target_date
                )
                
                user_dept = user.get("department") or "Unassigned"
                grace_minutes = config.get("lateGracePeriod", 30)

                is_first_login_today = (target_date == today_str)
                
                # Calculate the late threshold
                sh, sm = map(int, shift_start_str.split(":"))
                target_dt = datetime.strptime(target_date, "%Y-%m-%d")
                threshold = now_local.replace(
                    year=target_dt.year, month=target_dt.month, day=target_dt.day,
                    hour=sh, minute=sm, second=0, microsecond=0
                )
                from datetime import timedelta as td
                threshold += td(minutes=grace_minutes)

                is_late = now_local > threshold

                if is_late and not is_superuser:
                    if late_login_restriction:
                        all_checklist_privileges = [
                            "View BMS Checklist", "View All Department BMS Checklist", "Create BMS Checklist", "Update BMS Checklist", "Delete BMS Checklist", "Edit BMS Checklist Field",
                            "View Cluster Checklist", "View All Department Cluster Checklist", "Create Cluster Checklist", "Update Cluster Checklist", "Delete Cluster Checklist", "Edit Cluster Checklist Field",
                            "View Morning Checklist", "Create Morning Checklist", "Update Morning Checklist", "Delete Morning Checklist", "Edit Morning Checklist Field",
                            "View Work Log", "View All Work Logs", "Create Work Log", "Update Work Log", "Delete Work Log",
                            "View All Work", "View All Department Works", "View Assigned Work", "View Emergency Work",
                            "Create Work", "Create Emergency Work", "Update Work", "Delete Work"
                        ]
                        restricted_privileges = [p for p in all_checklist_privileges if p in privileges]
                        restricted_token = create_access_token(
                            data={
                                "sub": user["username"],
                                "role": "Restricted",
                                "privileges": restricted_privileges,
                                "isSuperuser": False,
                                "department": user.get("department", ""),
                                "session_key": session_key
                            },
                            expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
                        )

                        # Create a pending late attendance record and block login
                        await attendance_collection.insert_one({
                            "username": user["username"],
                            "department": user_dept,
                            "date": target_date,
                            "firstLogin": now_local.isoformat(),
                            "lastLogout": None,
                            "workedHours": 0.0,
                            "regularizeStatus": "None",
                            "regularizeReason": None,
                            "regularizeRemarks": None,
                            "isLateAttempt": True,
                            "lateApprovalStatus": "Pending",
                            "loggedOut": False,
                            "shiftName": shift_name,
                            "shiftStart": shift_start_str,
                            "shiftEnd": shift_end_str
                        })
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail={
                                "message": "You are late, you are not allowed to login, contact your department head",
                                "restricted_token": restricted_token,
                                "role": role,
                                "privileges": restricted_privileges,
                                "isSuperuser": False,
                                "username": user["username"],
                                "displayName": " ".join(part for part in [user.get("firstName", ""), user.get("lastName", "")] if part) or user["username"]
                            }
                        )
                    else:
                        # Create an approved late attendance record and allow login
                        await attendance_collection.insert_one({
                            "username": user["username"],
                            "department": user_dept,
                            "date": target_date,
                            "firstLogin": now_local.isoformat(),
                            "lastLogout": None,
                            "workedHours": 0.0,
                            "regularizeStatus": "None",
                            "regularizeReason": None,
                            "regularizeRemarks": None,
                            "isLateAttempt": True,
                            "lateApprovalStatus": "Approved",
                            "loggedOut": False,
                            "shiftName": shift_name,
                            "shiftStart": shift_start_str,
                            "shiftEnd": shift_end_str
                        })
                else:
                    # Not late — normal attendance record
                    await attendance_collection.insert_one({
                        "username": user["username"],
                        "department": user_dept,
                        "date": target_date,
                        "firstLogin": now_local.isoformat(),
                        "lastLogout": None,
                        "workedHours": 0.0,
                        "regularizeStatus": "None",
                        "regularizeReason": None,
                        "regularizeRemarks": None,
                        "loggedOut": False,
                        "shiftName": shift_name,
                        "shiftStart": shift_start_str,
                        "shiftEnd": shift_end_str
                    })
    except HTTPException:
        raise  # Re-raise HTTP exceptions (late login block)
    except Exception as e:
        print(f"Error auto-logging attendance: {e}")
    
    return LoginResponse(
        token=access_token,
        role=resolved_role,
        username=user["username"],
        privileges=privileges,
        isSuperuser=is_superuser,
        showBirthdayWish=is_first_login_today and is_birthday_today(user.get("dob"), get_local_now()),
        displayName=" ".join(
            part for part in [user.get("firstName", ""), user.get("lastName", "")] if part
        ) or user["username"]
    )

@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    username = current_user.get("sub")
    if not username:
        raise HTTPException(status_code=400, detail="Invalid session")
        
    try:
        users_collection = db.get_collection("users")
        await users_collection.update_one(
            {"username": username},
            {"$set": {"lastActive": None}}
        )
    except Exception as e:
        print(f"Error clearing lastActive on logout: {e}")

    try:
        config_collection = db.get_collection("attendance_config")
        config = await config_collection.find_one({}) or {}
        tracked_role = config.get("trackedRole")

        should_track = True
        user_role = current_user.get("role")
        if isinstance(user_role, list):
            user_roles = user_role
        elif isinstance(user_role, str):
            user_roles = [user_role]
        else:
            user_roles = []

        if tracked_role and tracked_role != "All Roles" and tracked_role not in user_roles:
            should_track = False

        if should_track:
            now_local = get_local_now()
            today_str = now_local.strftime("%Y-%m-%d")
            
            from attendance_helpers import get_target_attendance_date_details
            details = await get_target_attendance_date_details(username, now_local)
            target_date = details["date"]
            
            attendance_collection = db.get_collection("attendance")
            existing_attendance = await attendance_collection.find_one({
                "username": username,
                "date": target_date
            })
            
            if existing_attendance:
                first_login_str = existing_attendance.get("firstLogin")
                worked_hours = 0.0
                if first_login_str:
                    first_login_dt = datetime.fromisoformat(first_login_str)
                    duration = now_local - first_login_dt
                    worked_hours = round(duration.total_seconds() / 3600.0, 1)
                    
                # Apply the logout update rule: only update if now_local > existing lastLogout
                existing_logout_str = existing_attendance.get("lastLogout")
                should_update_logout = True
                if existing_logout_str:
                    try:
                        existing_logout_dt = datetime.fromisoformat(existing_logout_str)
                        if now_local <= existing_logout_dt:
                            should_update_logout = False
                    except Exception:
                        pass
                
                update_fields = {"loggedOut": True}
                if should_update_logout:
                    update_fields["lastLogout"] = now_local.isoformat()
                    update_fields["workedHours"] = worked_hours
                else:
                    if first_login_str and existing_logout_str:
                        try:
                            first_login_dt = datetime.fromisoformat(first_login_str)
                            existing_logout_dt = datetime.fromisoformat(existing_logout_str)
                            update_fields["workedHours"] = round((existing_logout_dt - first_login_dt).total_seconds() / 3600.0, 1)
                        except Exception:
                            pass

                await attendance_collection.update_one(
                    {"_id": existing_attendance["_id"]},
                    {"$set": update_fields}
                )
            else:
                from attendance_helpers import get_shift_details_for_date
                shift_name, shift_start_str, shift_end_str = await get_shift_details_for_date(
                    username, target_date
                )
                await attendance_collection.insert_one({
                    "username": username,
                    "department": current_user.get("department") or "Unassigned",
                    "date": target_date,
                    "firstLogin": now_local.isoformat(),
                    "lastLogout": now_local.isoformat(),
                    "workedHours": 0.0,
                    "regularizeStatus": "None",
                    "regularizeReason": None,
                    "regularizeRemarks": None,
                    "loggedOut": True,
                    "shiftName": shift_name,
                    "shiftStart": shift_start_str,
                    "shiftEnd": shift_end_str
                })
    except Exception as e:
        print(f"Error auto-logging logout: {e}")
        
    return {"message": "Logged out successfully"}

@router.get("/me", response_description="Get current user profile")
async def get_my_profile(current_user: dict = Depends(get_current_user)):
    users_collection = db.get_collection("users")
    username = current_user.get("sub")
    user = await users_collection.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    roles_collection = db.get_collection("roles")
    role_id = user.get("role")
    role_name = ""
    from bson import ObjectId
    if role_id:
        if isinstance(role_id, list) and len(role_id) > 0:
            role_id_to_find = role_id[0]
        else:
            role_id_to_find = role_id
            
        role_obj = None
        if ObjectId.is_valid(role_id_to_find):
            role_obj = await roles_collection.find_one({"_id": ObjectId(role_id_to_find)})
        if not role_obj:
            role_obj = await roles_collection.find_one({"name": role_id_to_find})
        
        if role_obj and role_obj.get("name"):
            role_name = role_obj.get("name")
        else:
            role_name = role_id_to_find
    dept_val = user.get("department", "")
    if dept_val and ObjectId.is_valid(dept_val):
        departments_collection = db.get_collection("departments")
        dept_obj = await departments_collection.find_one({"_id": ObjectId(dept_val)})
        if dept_obj:
            dept_val = dept_obj.get("name", dept_val)

    # Return all user fields except password
    return {
        "id": str(user["_id"]),
        "username": user.get("username", ""),
        "role": role_name,
        "status": user.get("status", True),
        "firstName": user.get("firstName", ""),
        "lastName": user.get("lastName", ""),
        "dob": user.get("dob", ""),
        "mobile": user.get("mobile", ""),
        "bloodGroup": user.get("bloodGroup", ""),
        "address": user.get("address", ""),
        "passNumber": user.get("passNumber", ""),
        "dateOfJoin": user.get("dateOfJoin", ""),
        "department": dept_val,
        "stickyNoteEnabled": user.get("stickyNoteEnabled", False),
        "stickyNoteContent": user.get("stickyNoteContent", ""),
        "stickyNotePositionX": user.get("stickyNotePositionX", 100),
        "stickyNotePositionY": user.get("stickyNotePositionY", 100),
    }

@router.put("/me", response_description="Update current user profile")
async def update_my_profile(profile: UpdateProfileModel = Body(...), current_user: dict = Depends(get_current_user)):
    users_collection = db.get_collection("users")
    username = current_user.get("sub")
    
    update_data = {k: v for k, v in profile.model_dump().items() if v is not None}
    
    if "passNumber" in update_data:
        pass_number = update_data["passNumber"]
        if pass_number:
            pass_number_stripped = pass_number.strip()
            existing = await users_collection.find_one({
                "passNumber": pass_number_stripped,
                "username": {"$ne": username}
            })
            if existing:
                raise HTTPException(status_code=400, detail="Pass number already exists")
            update_data["passNumber"] = pass_number_stripped

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    from bson import ObjectId
    result = await users_collection.update_one(
        {"username": username}, {"$set": update_data}
    )
    
    user = await users_collection.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return await get_my_profile(current_user)

@router.post("/change-password", response_description="Change current user password")
async def change_password(payload: ChangePasswordRequest = Body(...), current_user: dict = Depends(get_current_user)):
    users_collection = db.get_collection("users")
    username = current_user.get("sub")
    
    user = await users_collection.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Verify current password
    is_valid = bcrypt.checkpw(payload.currentPassword.encode('utf-8'), user["password"].encode('utf-8'))
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password"
        )
        
    # Hash new password
    hashed_password = bcrypt.hashpw(payload.newPassword.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    await users_collection.update_one(
        {"username": username},
        {"$set": {"password": hashed_password}}
    )
    
    return {"message": "Password changed successfully"}
