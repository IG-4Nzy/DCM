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
import asyncio
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
        return {"autoRefresh": False, "refreshIntervalSeconds": 30}
    return {
        "autoRefresh": False,
        "refreshIntervalSeconds": doc.get("refreshIntervalSeconds", 30),
        "updatedAt": doc.get("updatedAt"),
        "updatedBy": doc.get("updatedBy")
    }

@router.put("/config", response_description="Update global vCenter auto refresh configuration")
async def update_vcenter_config(
    payload: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    refresh_interval = payload.get("refreshIntervalSeconds", 30)

    update_data = {
        "autoRefresh": False,
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
async def refresh_vcenter_by_id(
    id: str,
    current_user: dict = Depends(require_any_privilege(["View Server Monitoring", "view_own_vcenter_vm_monitoring", "View Own vCenter VM Monitoring"]))
):
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
        # Enrich with vcenter metadata (same as monitor endpoint)
        snapshot["id"] = id
        snapshot["name"] = vcenter.get("name")
        snapshot["ipAddress"] = vcenter.get("ipAddress", "")
        snapshot["version"] = vcenter.get("vcenterVersion", "8.0.2")
        snapshot["type"] = vcenter.get("vcenterType", "vCenter Server Appliance")
        snapshot["licenceExpiry"] = vcenter.get("licenceExpiry", "2029-12-31")
        # Filter VMs based on user privilege — same as monitor endpoint
        snapshot["vms"] = await filter_vms_by_owner_ip(snapshot.get("vms") or [], current_user)
        return snapshot
    
    return {"status": "success", "message": f"Telemetry refresh triggered for vCenter {id}"}

# ─────────────────────────────────────────────────────────
# CRUD ENDPOINTS (preserved from original)
# ─────────────────────────────────────────────────────────

@router.get("/", response_description="List all vCenter details", response_model=PaginatedVCenterDetailsModel, response_model_by_alias=False)
async def list_items(
    clusterId: Optional[str] = Query(None, description="The ID of the cluster"),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1),
    pagination: bool = Query(True),
    search: Optional[str] = None,
    sortBy: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    order: str = Query("desc"),
    current_user: dict = Depends(require_any_privilege(["View Cluster", "View Server Monitoring", "view_own_vcenter_vm_monitoring", "View Own vCenter VM Monitoring"]))
):
    query = {}
    
    privs = current_user.get("privileges", [])
    has_view_all = current_user.get("isSuperuser", False) or "View All Server Details" in privs
    
    if not has_view_all:
        username = current_user.get("sub") or current_user.get("username")
        # Find user's admin identifiers
        users_col = db.get_collection("users")
        user_doc = await users_col.find_one({"username": username})
        admins = {username}
        if user_doc:
            admins.add(str(user_doc["_id"]))
            if user_doc.get("username"):
                admins.add(user_doc["username"])
        
        # Get all VMs where user is admin (by admin field)
        vm_col = db.get_collection("vm_details")
        user_vms = await vm_col.find({"admin": {"$in": list(admins)}}).to_list(length=None)
        user_cluster_ids = {vm.get("clusterId") for vm in user_vms if vm.get("clusterId")}

        # Also find clusters via IP mapping (matches filter_vms_by_owner_ip logic)
        # Get IPs from user's owned VMs
        owned_ips = set()
        for vm in user_vms:
            ip_val = vm.get("ipAddress") or vm.get("ip")
            if ip_val:
                if isinstance(ip_val, list):
                    for item in ip_val:
                        if item and str(item).strip() and str(item).strip() != "0.0.0.0":
                            owned_ips.add(str(item).strip())
                elif isinstance(ip_val, str):
                    for item in ip_val.replace(",", " ").split():
                        item_clean = item.strip()
                        if item_clean and item_clean != "0.0.0.0":
                            owned_ips.add(item_clean)

        # If user has owned IPs, find ALL VMs with those IPs to discover additional clusters
        if owned_ips:
            ip_regex = "|".join([ip.replace(".", "\\.") for ip in owned_ips])
            ip_matched_vms = await vm_col.find({
                "$or": [
                    {"ipAddress": {"$in": list(owned_ips)}},
                    {"ipAddress": {"$regex": ip_regex}},
                    {"ip": {"$in": list(owned_ips)}}
                ]
            }).to_list(length=None)
            for vm in ip_matched_vms:
                cid = vm.get("clusterId")
                if cid and cid != "undefined":
                    user_cluster_ids.add(cid)

        # Also check vcenter telemetry for VMs matching user's IPs
        if owned_ips:
            telemetry_col = db.get_collection("vcenter_telemetry")
            all_telemetry = await telemetry_col.find({}).to_list(length=None)
            for t_doc in all_telemetry:
                vms_data = t_doc.get("vms") or []
                for tvm in vms_data:
                    tvm_ip = tvm.get("ipAddress") or tvm.get("ip") or tvm.get("guest_ip") or ""
                    tvm_ips = set()
                    if isinstance(tvm_ip, list):
                        for item in tvm_ip:
                            if item and str(item).strip() and str(item).strip() != "0.0.0.0":
                                tvm_ips.add(str(item).strip())
                    elif isinstance(tvm_ip, str):
                        for item in tvm_ip.replace(",", " ").split():
                            item_clean = item.strip()
                            if item_clean and item_clean != "0.0.0.0":
                                tvm_ips.add(item_clean)
                    if any(ip in owned_ips for ip in tvm_ips):
                        # This vcenter has a VM matching the user's IP
                        vc_id = t_doc.get("vcenterId")
                        if vc_id:
                            # Find the vcenter's clusterId
                            vc_doc = await collection.find_one({"_id": ObjectId(vc_id) if ObjectId.is_valid(str(vc_id)) else vc_id})
                            if vc_doc and vc_doc.get("clusterId"):
                                user_cluster_ids.add(vc_doc["clusterId"])
                        break  # Already found a match in this vcenter
        
        # Remove invalid cluster IDs
        user_cluster_ids.discard("")
        user_cluster_ids.discard("undefined")
        user_cluster_ids.discard(None)

        if clusterId:
            if clusterId in user_cluster_ids:
                query["clusterId"] = clusterId
            else:
                # Force query to return nothing since user has no access to this cluster
                query["clusterId"] = "non-existent-cluster-id"
        else:
            query["clusterId"] = {"$in": list(user_cluster_ids)}
    else:
        if clusterId:
            query["clusterId"] = clusterId
    
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"ipAddress": {"$regex": search, "$options": "i"}}
        ]

    actual_sort_by = sortBy or sort_by or "createdAt"
    sort_order = 1 if order == "asc" else -1

    cursor = collection.find(query).sort(actual_sort_by, sort_order)
    raw_items = await cursor.to_list(length=None)

    # If user doesn't have View All Server Details, verify each vCenter actually contains at least 1 VM for this user
    if not has_view_all:
        filtered_items = []
        snap_col = db.get_collection("vcenter_telemetry")
        for item in raw_items:
            vc_id = str(item["_id"])
            snapshot = await snap_col.find_one({"vcenterId": vc_id})
            if snapshot and snapshot.get("vms"):
                user_vms_in_vc = await filter_vms_by_owner_ip(snapshot.get("vms"), current_user)
                if len(user_vms_in_vc) > 0:
                    filtered_items.append(item)
            else:
                # If no telemetry snapshot yet, check if vm_details has any VM for this clusterId belonging to user
                vc_cluster_id = item.get("clusterId")
                if vc_cluster_id and vc_cluster_id in user_cluster_ids:
                    filtered_items.append(item)
        items = filtered_items
    else:
        items = raw_items

    total = len(items)
    if pagination:
        start_idx = skip
        end_idx = skip + limit
        items = items[start_idx:end_idx]

    return {"data": items, "total": total}


@router.post("/", response_description="Create vCenter Details", response_model=VCenterDetailsModel, status_code=status.HTTP_201_CREATED, response_model_by_alias=False, dependencies=[Depends(require_any_privilege(["Create vCenter Appliance", "Create Cluster", "Create Server Monitoring"]))])
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


@router.post("/fetch-clusters-preview", response_description="Fetch cluster names directly from live vCenter REST API", dependencies=[Depends(require_any_privilege(["Create vCenter Appliance", "Create Cluster", "Create Server Monitoring"]))])
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


@router.put("/{id}", response_description="Update vCenter details", response_model=VCenterDetailsModel, response_model_by_alias=False, dependencies=[Depends(require_any_privilege(["Update vCenter Appliance", "Update Cluster", "Update Server Monitoring"]))])
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


@router.delete("/{id}", response_description="Delete vCenter details", dependencies=[Depends(require_any_privilege(["Delete vCenter Appliance", "Delete Cluster", "Delete Server Monitoring"]))])
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
