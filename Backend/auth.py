from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from database import db

router = APIRouter()

SECRET_KEY = "super-secret-jwt-key-replace-me-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480 # Token valid for 8 hours

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    token: str
    role: str
    username: str
    privileges: list[str]
    isSuperuser: bool = False

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

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
        
    role = user.get("role", "User")
    
    roles_collection = db.get_collection("roles")
    role_obj = await roles_collection.find_one({"name": role})
    privileges = role_obj.get("privileges", []) if role_obj else []
    
    is_superuser = user.get("is_superuser", False)
    
    # Generate the JWT
    access_token = create_access_token(data={"sub": user["username"], "role": role, "privileges": privileges, "isSuperuser": is_superuser})
    
    return LoginResponse(
        token=access_token,
        role=role,
        username=user["username"],
        privileges=privileges,
        isSuperuser=is_superuser
    )
