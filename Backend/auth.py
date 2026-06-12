from fastapi import APIRouter, HTTPException, status, Depends, Body
from pydantic import BaseModel
from typing import Optional, Union, List
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from database import db
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
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
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

    # Record first login of the day in attendance
    try:
        config_collection = db.get_collection("attendance_config")
        config = await config_collection.find_one({}) or {}
        tracked_role = config.get("trackedRole")

        should_track = True
        if tracked_role and tracked_role != "All Roles" and role != tracked_role:
            should_track = False

        if should_track:
            now_local = datetime.now()
            today_str = now_local.strftime("%Y-%m-%d")
            
            attendance_collection = db.get_collection("attendance")
            existing_attendance = await attendance_collection.find_one({
                "username": user["username"],
                "date": today_str
            })
            
            if not existing_attendance:
                is_first_login_today = True
                await attendance_collection.insert_one({
                    "username": user["username"],
                    "department": user.get("department") or "Unassigned",
                    "date": today_str,
                    "firstLogin": now_local.isoformat(),
                    "lastLogout": None,
                    "workedHours": 0.0,
                    "regularizeStatus": "None",
                    "regularizeReason": None,
                    "regularizeRemarks": None
                })
    except Exception as e:
        print(f"Error auto-logging attendance: {e}")
    
    return LoginResponse(
        token=access_token,
        role=role,
        username=user["username"],
        privileges=privileges,
        isSuperuser=is_superuser,
        showBirthdayWish=is_first_login_today and is_birthday_today(user.get("dob"), datetime.now()),
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
            now_local = datetime.now()
            today_str = now_local.strftime("%Y-%m-%d")
            
            attendance_collection = db.get_collection("attendance")
            existing_attendance = await attendance_collection.find_one({
                "username": username,
                "date": today_str
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
                            "workedHours": worked_hours
                        }
                    }
                )
            else:
                await attendance_collection.insert_one({
                    "username": username,
                    "department": current_user.get("department") or "Unassigned",
                    "date": today_str,
                    "firstLogin": now_local.isoformat(),
                    "lastLogout": now_local.isoformat(),
                    "workedHours": 0.0,
                    "regularizeStatus": "None",
                    "regularizeReason": None,
                    "regularizeRemarks": None
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
