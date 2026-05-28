import logging
from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from database import db
from auth_utils import get_current_user
from services.vcenter.health_service import vcenter_health_service

router = APIRouter()
logger = logging.getLogger("vcenter.router")

async def get_vcenter_telemetry_snapshot(vc_id: str) -> dict:
    snap_col = db.get_collection("vcenter_telemetry")
    snap = await snap_col.find_one({"vcenterId": vc_id})
    if not snap:
        # Graceful schema fallback structure
        return {
            "vcenterId": vc_id,
            "status": "Green",
            "metrics": {"cpuUsage": 0.0, "ramUsage": 0.0, "hddUsage": 0.0, "networkTraffic": 0.0},
            "hosts": [],
            "vms": [],
            "alarms": [],
            "events": []
        }
    snap["_id"] = str(snap["_id"])
    return snap

# Legacy /monitor compatibility endpoint so frontend doesn't break
@router.get("/{id}/monitor", tags=["telemetry"])
async def monitor_legacy(id: str, current_user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")
    snap = await get_vcenter_telemetry_snapshot(id)
    # Map back version and type
    vcenters_col = db.get_collection("vcenter_details")
    vc = await vcenters_col.find_one({"_id": ObjectId(id)})
    if vc:
        snap["name"] = vc.get("name")
        snap["ipAddress"] = vc.get("ipAddress")
        snap["version"] = vc.get("vcenterVersion", "8.0.2")
        snap["type"] = vc.get("vcenterType", "vCenter Server Appliance")
        snap["licenceExpiry"] = vc.get("licenceExpiry", "2029-12-31")
    return snap

@router.get("/{id}/monitor/summary", tags=["telemetry"])
async def monitor_summary(id: str, current_user: dict = Depends(get_current_user)):
    snap = await get_vcenter_telemetry_snapshot(id)
    return {
        "vcenterId": id,
        "status": snap.get("status"),
        "metrics": snap.get("metrics"),
        "lastUpdated": snap.get("lastUpdated")
    }

@router.get("/{id}/monitor/hosts", tags=["telemetry"])
async def monitor_hosts(id: str, current_user: dict = Depends(get_current_user)):
    snap = await get_vcenter_telemetry_snapshot(id)
    return {
        "vcenterId": id,
        "hosts": snap.get("hosts", [])
    }

@router.get("/{id}/monitor/vms", tags=["telemetry"])
async def monitor_vms(id: str, current_user: dict = Depends(get_current_user)):
    snap = await get_vcenter_telemetry_snapshot(id)
    return {
        "vcenterId": id,
        "vms": snap.get("vms", [])
    }

@router.get("/{id}/monitor/alarms", tags=["telemetry"])
async def monitor_alarms(id: str, current_user: dict = Depends(get_current_user)):
    snap = await get_vcenter_telemetry_snapshot(id)
    return {
        "vcenterId": id,
        "alarms": snap.get("alarms", [])
    }

@router.get("/{id}/monitor/events", tags=["telemetry"])
async def monitor_events(id: str, current_user: dict = Depends(get_current_user)):
    snap = await get_vcenter_telemetry_snapshot(id)
    return {
        "vcenterId": id,
        "events": snap.get("events", [])
    }

@router.get("/health/vcenter/{id}", tags=["health"])
async def check_health(id: str, current_user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    vcenters_col = db.get_collection("vcenter_details")
    vc = await vcenters_col.find_one({"_id": ObjectId(id)})
    if not vc:
        raise HTTPException(status_code=404, detail="vCenter details not found")

    ip = vc.get("ipAddress")
    username = vc.get("username")
    password = vc.get("password")

    if not ip:
        raise HTTPException(status_code=400, detail="vCenter IP address is not registered")

    health = await vcenter_health_service.perform_health_check(ip, username, password)
    return health
