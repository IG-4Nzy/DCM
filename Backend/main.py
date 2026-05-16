from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import router as items_router
from auth import router as auth_router
from users import router as users_router

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

@app.get("/", tags=["root"])
async def root():
    return {"message": "Welcome to the DCM API"}
