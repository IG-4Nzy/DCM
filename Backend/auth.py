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
ACCESS_TOKEN_EXPIRE_MINUTES = 960 # Token valid for 16 hours

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

class ChangePasswordRequest(BaseModel):
    currentPassword: str
    newPassword: str

def create_access_token(data: dict):
    to_encode = data.copy()
    # Permanent token: no "exp" claim added
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
    for role_name in user_roles:
        role_obj = await roles_collection.find_one({"name": role_name})
        if role_obj:
            privileges_set.update(role_obj.get("privileges", []))
    privileges = list(privileges_set)
    
    is_superuser = user.get("is_superuser", False)
    
    # Generate the JWT
    access_token = create_access_token(data={
        "sub": user["username"], 
        "role": role, 
        "privileges": privileges, 
        "isSuperuser": is_superuser,
        "department": user.get("department", "")
    })
    
    is_first_login_today = False

    # Record first login of the day in attendance — and block late logins
    try:
        config_collection = db.get_collection("attendance_config")
        config = await config_collection.find_one({}) or {}
        tracked_role = config.get("trackedRole")

        should_track = True
        if tracked_role and tracked_role != "All Roles" and role != tracked_role:
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
                # If they logged in again during their active previous day's shift, mark it as active
                if is_prev_day and not details["is_closed"] and existing_attendance.get("loggedOut", False):
                    await attendance_collection.update_one(
                        {"_id": existing_attendance["_id"]},
                        {"$set": {"loggedOut": False}}
                    )
                # If there's already a pending/rejected late attempt, keep blocking
                late_status = existing_attendance.get("lateApprovalStatus")
                if existing_attendance.get("isLateAttempt"):
                    if late_status == "Pending":
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="You are late, you are not allowed to login, contact your department head"
                        )
                    elif late_status == "Rejected":
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="Your late login request has been rejected, contact your department head"
                        )
                    # If "Approved", fall through and allow login
            else:
                # We only create a record for today_str. If target_date is prev_day_str,
                # but no record exists, we should not create one.
                if target_date == today_str:
                    # Determine shift start from roster
                    from attendance import determine_shift_for_user
                    roaster_col = db.get_collection("roasters")
                    user_dept = user.get("department") or "Unassigned"
                    roaster = await roaster_col.find_one({
                        "date": today_str,
                        "assignees": user["username"]
                    })

                    config_shifts = config.get("shifts", [])
                    config_roster_rows = config.get("rosterRows", [])
                    default_start = config.get("shiftStart", "09:00")
                    grace_minutes = config.get("lateGracePeriod", 30)

                    shift_name, shift_start_str, shift_end_str = determine_shift_for_user(
                        user["username"], roaster, config_shifts, config_roster_rows, default_start
                    )

                    is_first_login_today = True
                    
                    # Calculate the late threshold
                    sh, sm = map(int, shift_start_str.split(":"))
                    threshold = now_local.replace(hour=sh, minute=sm, second=0, microsecond=0)
                    from datetime import timedelta as td
                    threshold += td(minutes=grace_minutes)

                    is_late = now_local > threshold

                    if is_late and not is_superuser:
                        # Create a pending late attendance record and block login
                        await attendance_collection.insert_one({
                            "username": user["username"],
                            "department": user_dept,
                            "date": today_str,
                            "firstLogin": now_local.isoformat(),
                            "lastLogout": None,
                            "workedHours": 0.0,
                            "regularizeStatus": "None",
                            "regularizeReason": None,
                            "regularizeRemarks": None,
                            "isLateAttempt": True,
                            "lateApprovalStatus": "Pending",
                            "shiftName": shift_name,
                            "shiftStart": shift_start_str,
                            "shiftEnd": shift_end_str
                        })
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="You are late, you are not allowed to login, contact your department head"
                        )

                    # Not late — normal attendance record
                    await attendance_collection.insert_one({
                        "username": user["username"],
                        "department": user_dept,
                        "date": today_str,
                        "firstLogin": now_local.isoformat(),
                        "lastLogout": None,
                        "workedHours": 0.0,
                        "regularizeStatus": "None",
                        "regularizeReason": None,
                        "regularizeRemarks": None,
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
        role=role,
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
                    worked_hours = round(duration.total_seconds() / 3600.0, 2)
                    
                await attendance_collection.update_one(
                    {"_id": existing_attendance["_id"]},
                    {
                        "$set": {
                            "lastLogout": now_local.isoformat(),
                            "workedHours": worked_hours,
                            "loggedOut": True
                        }
                    }
                )
            else:
                # We only create a record for today_str. If target_date is prev_day_str,
                # but no record exists, we should not create one.
                if target_date == today_str:
                    await attendance_collection.insert_one({
                        "username": username,
                        "department": current_user.get("department") or "Unassigned",
                        "date": today_str,
                        "firstLogin": now_local.isoformat(),
                        "lastLogout": now_local.isoformat(),
                        "workedHours": 0.0,
                        "regularizeStatus": "None",
                        "regularizeReason": None,
                        "regularizeRemarks": None,
                        "loggedOut": True
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
    
    # Return all user fields except password
    return {
        "id": str(user["_id"]),
        "username": user.get("username", ""),
        "role": user.get("role", ""),
        "status": user.get("status", True),
        "firstName": user.get("firstName", ""),
        "lastName": user.get("lastName", ""),
        "dob": user.get("dob", ""),
        "mobile": user.get("mobile", ""),
        "bloodGroup": user.get("bloodGroup", ""),
        "address": user.get("address", ""),
        "dateOfJoin": user.get("dateOfJoin", ""),
        "department": user.get("department", ""),
    }

@router.put("/me", response_description="Update current user profile")
async def update_my_profile(profile: UpdateProfileModel = Body(...), current_user: dict = Depends(get_current_user)):
    users_collection = db.get_collection("users")
    username = current_user.get("sub")
    
    update_data = {k: v for k, v in profile.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    from bson import ObjectId
    result = await users_collection.update_one(
        {"username": username}, {"$set": update_data}
    )
    
    user = await users_collection.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "id": str(user["_id"]),
        "username": user.get("username", ""),
        "role": user.get("role", ""),
        "status": user.get("status", True),
        "firstName": user.get("firstName", ""),
        "lastName": user.get("lastName", ""),
        "dob": user.get("dob", ""),
        "mobile": user.get("mobile", ""),
        "bloodGroup": user.get("bloodGroup", ""),
        "address": user.get("address", ""),
        "dateOfJoin": user.get("dateOfJoin", ""),
        "department": user.get("department", ""),
    }

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
