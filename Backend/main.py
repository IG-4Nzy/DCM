from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from routes import router as items_router
from auth import router as auth_router
from users import router as users_router
from roles import router as roles_router
from works import router as works_router
from departments import router as departments_router
from roasters import router as roasters_router
from observations import router as observations_router
from inventory import router as inventory_router
from cluster_types import router as cluster_types_router
from hypervisors import router as hypervisors_router
from nodes import router as nodes_router
from server_racks import router as server_racks_router
from server_models import router as server_models_router
from node_details import router as node_details_router
from clusters import router as clusters_router
from ad_details import router as ad_details_router
from vcenter_details import router as vcenter_details_router
from vm_details import router as vm_details_router
from requests_router import router as requests_router
from request_routings import router as request_routings_router

app = FastAPI(
    title="DCM Backend",
    description="FastAPI backend with MongoDB for DCM project",
    version="1.0.0"
)

import os

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
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
app.include_router(roasters_router, tags=["roasters"], prefix="/api/roasters")
app.include_router(observations_router, tags=["observations"], prefix="/api/observations")
app.include_router(inventory_router, tags=["inventory"], prefix="/api/inventory")
app.include_router(cluster_types_router, tags=["cluster_types"], prefix="/api/cluster-types")
app.include_router(hypervisors_router, tags=["hypervisors"], prefix="/api/hypervisors")
app.include_router(nodes_router, tags=["nodes"], prefix="/api/nodes")
app.include_router(server_racks_router, tags=["server_racks"], prefix="/api/server-racks")
app.include_router(server_models_router, tags=["server_models"], prefix="/api/server-models")
app.include_router(node_details_router, tags=["node_details"], prefix="/api/node-details")
app.include_router(clusters_router, tags=["clusters"], prefix="/api/clusters")
app.include_router(ad_details_router, tags=["ad_details"], prefix="/api/ad-details")
app.include_router(vcenter_details_router, tags=["vcenter_details"], prefix="/api/vcenter-details")
app.include_router(vm_details_router, tags=["vm_details"], prefix="/api/vm-details")
app.include_router(requests_router, tags=["requests"], prefix="/api/requests")
app.include_router(request_routings_router, tags=["request_routings"], prefix="/api/request-routings")

import os
os.makedirs("uploads/works", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.get("/", tags=["root"])
async def root():
    return {"message": "Welcome to the DCM API"}
