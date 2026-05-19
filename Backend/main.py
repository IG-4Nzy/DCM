from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from routes import router as items_router
from auth import router as auth_router
from users import router as users_router
from roles import router as roles_router
from works import router as works_router
from departments import router as departments_router

app = FastAPI(
    title="DCM Backend",
    description="FastAPI backend with MongoDB for DCM project",
    version="1.0.0"
)

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Change this to specific domains in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(items_router, tags=["items"], prefix="/items")
app.include_router(auth_router, tags=["auth"], prefix="/api/auth")
app.include_router(users_router, tags=["users"], prefix="/api/users")
app.include_router(roles_router, tags=["roles"], prefix="/api/roles")
app.include_router(works_router, tags=["works"], prefix="/api/works")
app.include_router(departments_router, tags=["departments"], prefix="/api/departments")

import os
os.makedirs("uploads/works", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.get("/", tags=["root"])
async def root():
    return {"message": "Welcome to the DCM API"}
