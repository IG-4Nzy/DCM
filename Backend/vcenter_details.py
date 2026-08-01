"""
vCenter Details — CRUD + Monitoring Router

Refactored to enterprise-grade architecture:
- Removed ALL subprocess curl fallbacks
- Removed ALL blocking socket calls
- Removed ALL random/fake metric generation
- Removed ad-hoc file-append diagnostics_log
- Delegates session management to VCenterSessionManager
- Delegates inventory queries to VCenterInventoryService (with TTL cache)
- Delegates metrics to VCenterMetricsService
- Delegates health probes to VCenterHealthService
- All HTTP calls use shared HTTPX AsyncClient singleton with connection pooling
- Per-vCenter rate limiting via asyncio Semaphore
"""

import logging
from fastapi import APIRouter, HTTPException, status, Body, Query, Depends, Response
from auth_utils import require_privilege, require_any_privilege, get_current_user, filter_vms_by_owner_ip
from typing import Optional
from database import db
from models import VCenterDetailsModel, CreateVCenterDetailsModel, UpdateVCenterDetailsModel, PaginatedVCenterDetailsModel
from bson import ObjectId
from datetime import datetime, timezone

from services.vcenter.session_manager import vcenter_session_manager
from services.vcenter.inventory_service import vcenter_inventory_service
from services.vcenter.metrics_service import vcenter_metrics_service
from services.vcenter.health_service import vcenter_health_service

logger = logging.getLogger("vcenter.router")

router = APIRouter()
collection = db.get_collection("vcenter_details")


def _percent_used(capacity, free) -> float:
    if not capacity:
        return 0.0
    return round(max(0.0, min(100.0, ((capacity - free) / capacity) * 100)), 1)


def _host_name(host: dict) -> str:
    return host.get("name") or host.get("host") or host.get("host_id") or "esxi-host"


def _host_id(host: dict) -> str:
    return host.get("host") or host.get("host_id") or host.get("name") or ""


def _vm_host_ref(vm: dict) -> str:
    return vm.get("host") or vm.get("hostName") or vm.get("host_name") or ""


# ─────────────────────────────────────────────────────────
# CONFIGURATION & MANUAL REFRESH ENDPOINTS
# ─────────────────────────────────────────────────────────

config_collection = db.get_collection("vcenter_config")

@router.get("/config", response_description="Get global vCenter auto refresh configuration")
async def get_vcenter_config():
    doc = await config_collection.find_one({"_id": "vcenter_global_config"})
    if not doc:
        return {"autoRefresh": True, "refreshIntervalSeconds": 30}
    return {
        "autoRefresh": doc.get("autoRefresh", True),
        "refreshIntervalSeconds": doc.get("refreshIntervalSeconds", 30),
        "updatedAt": doc.get("updatedAt"),
        "updatedBy": doc.get("updatedBy")
    }

@router.put("/config", response_description="Update global vCenter auto refresh configuration")
async def update_vcenter_config(
    payload: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    auto_refresh = payload.get("autoRefresh")
    refresh_interval = payload.get("refreshIntervalSeconds", 30)

    if auto_refresh is None:
        raise HTTPException(status_code=400, detail="Field 'autoRefresh' boolean is required.")

    update_data = {
        "autoRefresh": bool(auto_refresh),
        "refreshIntervalSeconds": int(refresh_interval),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "updatedBy": current_user.get("sub", "")
    }

    await config_collection.update_one(
        {"_id": "vcenter_global_config"},
        {"$set": update_data},
        upsert=True
    )

    return update_data

@router.post("/refresh-all", response_description="Trigger manual telemetry refresh for all registered vCenters")
async def refresh_all_vcenters():
    from tasks.telemetry_scheduler import vcenter_telemetry_scheduler
    vcenters_cursor = collection.find({})
    vcenters = await vcenters_cursor.to_list(length=None)
    
    if not vcenters:
        return {"status": "success", "message": "No vCenters registered.", "refreshedCount": 0}

    refreshed_count = 0
    for vc in vcenters:
        try:
            # Fire in background so endpoint returns instantly without timing out Axios
            asyncio.create_task(vcenter_telemetry_scheduler.force_refresh_vcenter(vc))
            refreshed_count += 1
        except Exception as e:
            logger.error(f"Manual refresh failed for vCenter {vc.get('ipAddress')}: {e}")

    return {
        "status": "success",
        "message": f"Successfully triggered manual telemetry refresh for {refreshed_count} vCenter instance(s).",
        "refreshedCount": refreshed_count
    }

@router.post("/{id}/refresh", response_description="Trigger manual telemetry refresh for a specific vCenter")
async def refresh_vcenter_by_id(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    vcenter = await collection.find_one({"_id": ObjectId(id)})
    if not vcenter:
        raise HTTPException(status_code=404, detail="vCenter not found")

    from tasks.telemetry_scheduler import vcenter_telemetry_scheduler
    try:
        # Wait up to 10 seconds for synchronous update; continue in background if slower
        await asyncio.wait_for(vcenter_telemetry_scheduler.force_refresh_vcenter(vcenter), timeout=10.0)
    except asyncio.TimeoutError:
        logger.info(f"Manual refresh for vCenter {id} is taking longer than 10s; processing in background")
    except Exception as e:
        logger.error(f"Manual refresh error for vCenter {id}: {e}")

    snap_col = db.get_collection("vcenter_telemetry")
    snapshot = await snap_col.find_one({"vcenterId": id})
    if snapshot:
        snapshot.pop("_id", None)
        return snapshot
    
    return {"status": "success", "message": f"Telemetry refresh triggered for vCenter {id}"}

# ─────────────────────────────────────────────────────────
# CRUD ENDPOINTS (preserved from original)
# ─────────────────────────────────────────────────────────

@router.get("/", response_description="List all vCenter details", response_model=PaginatedVCenterDetailsModel, response_model_by_alias=False, dependencies=[Depends(require_any_privilege(["View Cluster", "View Server Monitoring", "view_own_vcenter_vm_monitoring"]))])
async def list_items(
    clusterId: Optional[str] = Query(None, description="The ID of the cluster"),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1),
    pagination: bool = Query(True),
    search: Optional[str] = None,
    sortBy: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    order: str = Query("desc")
):
    query = {}
    if clusterId:
        query["clusterId"] = clusterId
    
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"ipAddress": {"$regex": search, "$options": "i"}}
        ]

    actual_sort_by = sortBy or sort_by or "createdAt"
    sort_order = 1 if order == "asc" else -1

    total = await collection.count_documents(query)
    cursor = collection.find(query).sort(actual_sort_by, sort_order)
    
    if pagination:
        cursor = cursor.skip(skip).limit(limit)
        items = await cursor.to_list(length=limit)
    else:
        items = await cursor.to_list(length=None)

    return {"data": items, "total": total}


@router.post("/", response_description="Create vCenter Details", response_model=VCenterDetailsModel, status_code=status.HTTP_201_CREATED, response_model_by_alias=False, dependencies=[Depends(require_any_privilege(["Create vCenter Appliance", "Create Cluster"]))])
async def create_item(
    payload: CreateVCenterDetailsModel = Body(...),
    current_user: dict = Depends(get_current_user)
):
    item_dict = payload.model_dump()
    cluster_id = item_dict.get("clusterId", "")

    # Programmatically aggregate resource capacity (CPU, RAM, HDD) from ESXi nodes of this cluster
    node_collection = db.get_collection("node_details")
    nodes_cursor = node_collection.find({"clusterId": cluster_id})
    nodes_list = await nodes_cursor.to_list(length=None)

    total_cores = 0
    total_ram = 0
    total_hdd = 0

    for node in nodes_list:
        total_cores += int(node.get("totalCpu") or 0)
        total_ram += int(node.get("totalRam") or 0)
        total_hdd += int(node.get("totalHardisk") or 0)

    # Populate harvested resources and default settings dynamically
    item_dict["cpuCores"] = item_dict.get("cpuCores") or (f"{total_cores} Cores" if total_cores > 0 else "--")
    item_dict["ram"] = item_dict.get("ram") or (f"{total_ram} GB" if total_ram > 0 else "--")
    item_dict["hdd"] = item_dict.get("hdd") or (f"{total_hdd} GB" if total_hdd > 0 else "--")
    item_dict["vcenterVersion"] = item_dict.get("vcenterVersion") or "8.0.2"
    item_dict["vcenterType"] = item_dict.get("vcenterType") or "vCenter Server Appliance (vCSA)"
    item_dict["licenceExpiry"] = item_dict.get("licenceExpiry") or "2031-12-31"
    item_dict["ha"] = item_dict.get("ha") or "Enabled"
    item_dict["drs"] = item_dict.get("drs") or "Enabled"
    item_dict["storage"] = item_dict.get("storage") or "vSAN Datastore"
    item_dict["portGroups"] = item_dict.get("portGroups") or "VLAN-10-Prod"
    item_dict["vmImageBackupLocation"] = item_dict.get("vmImageBackupLocation") or "/mnt/backup/vms"

    item_dict["createdBy"] = current_user.get("sub", "")
    item_dict["createdAt"] = datetime.now(timezone.utc).isoformat()
    item_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()

    new_item = await collection.insert_one(item_dict)
    created = await collection.find_one({"_id": new_item.inserted_id})
    return created


@router.post("/fetch-clusters-preview", response_description="Fetch cluster names directly from live vCenter REST API", dependencies=[Depends(require_any_privilege(["Create vCenter Appliance", "Create Cluster"]))])
async def fetch_clusters_preview(
    payload: dict = Body(...)
):
    """
    Authenticates to a vCenter instance and fetches cluster names for dropdown selection.
    Uses the shared session manager and inventory service — no subprocess curl.
    """
    ip_address = payload.get("ipAddress")
    username = payload.get("username")
    password = payload.get("password")
    
    if not ip_address or not username or not password:
        raise HTTPException(
            status_code=400,
            detail="Missing connection parameters: IP Address, Username, and Password are required."
        )
        
    try:
        logger.info(f"fetch_clusters_preview invoked for IP={ip_address}")
        session_id = await vcenter_session_manager.get_session(ip_address, username, password)
        
        if not session_id:
            raise HTTPException(
                status_code=401,
                detail="vCenter Authentication failed. Verify connection credentials."
            )
            
        clusters_data = await vcenter_inventory_service.get_clusters(ip_address, session_id)

        if clusters_data is None:
            raise HTTPException(
                status_code=502,
                detail="Failed to fetch clusters from vCenter REST API."
            )
            
        # Format to match dropdown
        return {"clusters": [{"id": c.get("cluster"), "name": c.get("name")} for c in clusters_data]}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in fetch_clusters_preview for {ip_address}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred: {str(e)}"
        )


@router.put("/{id}", response_description="Update vCenter details", response_model=VCenterDetailsModel, response_model_by_alias=False, dependencies=[Depends(require_any_privilege(["Update vCenter Appliance", "Update Cluster"]))])
async def update_item(id: str, payload: UpdateVCenterDetailsModel = Body(...)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    item_dict = {k: v for k, v in payload.model_dump().items() if v is not None}

    if len(item_dict) >= 1:
        item_dict["updatedAt"] = datetime.now(timezone.utc).isoformat()
        
        update_result = await collection.update_one(
            {"_id": ObjectId(id)}, {"$set": item_dict}
        )

        if update_result.modified_count == 1:
            if (updated := await collection.find_one({"_id": ObjectId(id)})) is not None:
                return updated

    if (existing := await collection.find_one({"_id": ObjectId(id)})) is not None:
        return existing

    raise HTTPException(status_code=404, detail="vCenter Details not found")


@router.delete("/{id}", response_description="Delete vCenter details", dependencies=[Depends(require_any_privilege(["Delete vCenter Appliance", "Delete Cluster"]))])
async def delete_item(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    delete_result = await collection.delete_one({"_id": ObjectId(id)})

    if delete_result.deleted_count == 1:
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    raise HTTPException(status_code=404, detail="vCenter Details not found")


# ─────────────────────────────────────────────────────────
# MONITOR ENDPOINT — reads pre-computed telemetry from DB
# The background scheduler writes to vcenter_telemetry.
# This endpoint NEVER hammers vCenter APIs directly.
# ─────────────────────────────────────────────────────────

@router.get("/{id}/monitor", response_description="Get live vCenter monitoring telemetry")
async def monitor_vcenter(id: str, current_user: dict = Depends(require_any_privilege(["View Server Monitoring", "view_own_vcenter_vm_monitoring", "View Own vCenter VM Monitoring"]))):
    """
    Returns the latest telemetry snapshot for a vCenter instance.
    Data is pre-collected by the background VCenterTelemetryScheduler and stored in MongoDB.
    If no pre-collected snapshot exists, performs a one-time live fetch as a warm-up.
    """
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    vcenter = await collection.find_one({"_id": ObjectId(id)})
    if not vcenter:
        raise HTTPException(status_code=404, detail="vCenter not found")

    cluster_id = vcenter.get("clusterId", "")
    ip_address = vcenter.get("ipAddress", "")
    username = vcenter.get("username")
    password = vcenter.get("password")

    # 1. Try reading pre-computed telemetry snapshot from MongoDB
    snap_col = db.get_collection("vcenter_telemetry")
    snapshot = await snap_col.find_one({"vcenterId": id})

    if snapshot:
        snapshot.pop("_id", None)
        # Enrich with latest vcenter metadata
        snapshot["id"] = id
        snapshot["name"] = vcenter.get("name")
        snapshot["ipAddress"] = ip_address
        snapshot["version"] = vcenter.get("vcenterVersion", "8.0.2")
        snapshot["type"] = vcenter.get("vcenterType", "vCenter Server Appliance")
        snapshot["licenceExpiry"] = vcenter.get("licenceExpiry", "2029-12-31")
        snapshot["vms"] = await filter_vms_by_owner_ip(snapshot.get("vms") or [], current_user)
        if not snapshot.get("hosts"):
            snapshot["hosts"] = []
        if not snapshot.get("alarms"):
            snapshot["alarms"] = []
        if not snapshot.get("events"):
            snapshot["events"] = []
        if not snapshot.get("metrics"):
            snapshot["metrics"] = {"cpuUsage": 0.0, "ramUsage": 0.0, "hddUsage": 0.0, "networkTraffic": 0.0}
        return snapshot

    # 2. No snapshot yet — perform a one-time warm-up fetch
    logger.info(f"No telemetry snapshot found for vCenter {id}. Performing warm-up fetch...")

    live_connected = False
    hosts_telemetry = []
    vms_telemetry = []
    alarms = []
    events = []
    metrics = {"cpuUsage": 0.0, "ramUsage": 0.0, "hddUsage": 0.0, "networkTraffic": 0.0}

    if ip_address and username and password:
        try:
            session_id = await vcenter_session_manager.get_session(ip_address, username, password)
            if session_id:
                live_connected = True

                # Fetch live inventory via service layer (cached + rate-limited)
                live_hosts = await vcenter_inventory_service.get_hosts(ip_address, session_id, cluster_id or None)
                live_vms = await vcenter_inventory_service.get_vms(ip_address, session_id, cluster_id or None)
                datastores = await vcenter_inventory_service.get_datastores(ip_address, session_id)
                metrics = await vcenter_metrics_service.get_live_metrics(ip_address, session_id)

                if datastores:
                    total_capacity = sum(float(ds.get("capacity") or 0) for ds in datastores)
                    total_free = sum(float(ds.get("free_space") or 0) for ds in datastores)
                    metrics["hddUsage"] = _percent_used(total_capacity, total_free)

                for h in live_hosts:
                    connection_state = str(h.get("connection_state") or h.get("status") or "").lower()
                    hosts_telemetry.append({
                        "id": _host_id(h),
                        "name": _host_name(h),
                        "ipAddress": h.get("ip_address") or h.get("ipAddress") or _host_name(h),
                        "status": "Connected" if connection_state in ("connected", "normal", "ok") else "Disconnected",
                        "cpuUsage": metrics.get("cpuUsage", 0.0),
                        "ramUsage": metrics.get("ramUsage", 0.0),
                        "cpuTemp": "--",
                        "ramTemp": "--",
                        "fanSpeed": "--",
                        "powerWatts": 0
                    })

                for vm in live_vms:
                    host_ref = _vm_host_ref(vm)
                    vms_telemetry.append({
                        "id": vm.get("vm") or vm.get("vm_id") or vm.get("name", "vm-instance"),
                        "name": vm.get("name", "vm-instance"),
                        "ipAddress": vm.get("ipAddress") or "0.0.0.0",
                        "node": host_ref or "Unassigned",
                        "hostId": host_ref,
                        "cpuUsage": 0.0,
                        "ramUsage": 0.0,
                        "status": "Running" if vm.get("power_state") in ("POWERED_ON", "poweredOn") else "Stopped"
                    })

                events.append({
                    "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                    "message": f"Live warm-up telemetry sync completed for vCenter at {ip_address}"
                })
        except Exception as e:
            logger.error(f"Warm-up fetch failed for vCenter {ip_address}: {e}", exc_info=True)

    # 3. Fallback to database-sourced node/VM data if live connection was not possible
    if not live_connected:
        node_collection = db.get_collection("node_details")
        nodes_list = await (node_collection.find({"clusterId": cluster_id}).to_list(length=None))

        vm_collection = db.get_collection("vm_details")
        vms_list = await (vm_collection.find({"clusterId": cluster_id}).to_list(length=None))

        for host in nodes_list:
            hosts_telemetry.append({
                "name": host.get("hostName") or host.get("name") or "esxi-host",
                "ipAddress": host.get("ipAddress", "0.0.0.0"),
                "status": "Connected",
                "cpuUsage": 0.0,
                "ramUsage": 0.0,
                "cpuTemp": "--",
                "ramTemp": "--",
                "fanSpeed": "--",
                "powerWatts": 0
            })

        for vm in vms_list:
            vms_telemetry.append({
                "name": vm.get("applications") or vm.get("name") or "vm-instance",
                "ipAddress": vm.get("ipAddress", "0.0.0.0"),
                "node": vm.get("node") or "esxi-host",
                "cpuUsage": 0.0,
                "ramUsage": 0.0,
                "status": "Running"
            })

        events.append({
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "message": "Telemetry populated from database records. Live vCenter connection was not available."
        })

        # Derive vCenter version from registered ESXi hypervisor data
        vcenter_version = vcenter.get("vcenterVersion", "8.0.2")
        if nodes_list:
            first_node = nodes_list[0]
            node_hypervisor = first_node.get("hypervisor", "")
            if "ESXi" in node_hypervisor:
                parts = node_hypervisor.split()
                vcenter_version = parts[1] if len(parts) > 1 else node_hypervisor
            elif node_hypervisor:
                vcenter_version = node_hypervisor

    else:
        vcenter_version = vcenter.get("vcenterVersion", "8.0.2")

    vms_telemetry = await filter_vms_by_owner_ip(vms_telemetry, current_user)

    return {
        "id": id,
        "name": vcenter.get("name"),
        "ipAddress": ip_address,
        "status": "Red" if any(a.get("severity") == "Critical" for a in alarms) else "Yellow" if alarms else "Green",
        "version": vcenter_version,
        "type": vcenter.get("vcenterType", "vCenter Server Appliance"),
        "licenceExpiry": vcenter.get("licenceExpiry", "2029-12-31"),
        "metrics": metrics,
        "hosts": hosts_telemetry,
        "vms": vms_telemetry,
        "alarms": alarms,
        "events": events
    }
