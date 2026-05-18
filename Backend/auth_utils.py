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

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
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
