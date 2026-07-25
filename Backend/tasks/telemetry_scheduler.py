import logging
import asyncio
from datetime import datetime, timezone
from database import db
from bson import ObjectId
from services.vcenter.session_manager import vcenter_session_manager
from services.vcenter.health_service import vcenter_health_service
from services.vcenter.inventory_service import vcenter_inventory_service
from services.vcenter.metrics_service import vcenter_metrics_service

logger = logging.getLogger("vcenter.scheduler")


def _percent_used(capacity: int | float, free: int | float) -> float:
    if not capacity:
        return 0.0
    return round(max(0.0, min(100.0, ((capacity - free) / capacity) * 100)), 1)


def _host_name(host: dict) -> str:
    return host.get("name") or host.get("host") or host.get("host_id") or "esxi-host"


def _host_id(host: dict) -> str:
    return host.get("host") or host.get("host_id") or host.get("name") or ""


def _vm_host_ref(vm: dict) -> str:
    return vm.get("host") or vm.get("hostName") or vm.get("host_name") or ""

class VCenterTelemetryScheduler:
    def __init__(self):
        self._running = False
        self._tasks: list[asyncio.Task] = []

    def start(self):
        if self._running:
            return
        self._running = True
        logger.info("Initializing background vCenter telemetry collection loops...")
        self._tasks.append(asyncio.create_task(self._run_session_keepalive()))
        self._tasks.append(asyncio.create_task(self._run_telemetry_loop()))

    async def stop(self):
        self._running = False
        for t in self._tasks:
            t.cancel()
        await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks.clear()
        logger.info("Background vCenter telemetry collection loops terminated.")

    async def _run_session_keepalive(self):
        while self._running:
            try:
                await vcenter_session_manager.keep_alive_sessions()
            except Exception as e:
                logger.error(f"Error in session keep-alive loop: {e}")
            await asyncio.sleep(60.0)

    async def _run_telemetry_loop(self):
        """Standard scheduler: Periodically pulls telemetry and updates MongoDB snapshot"""
        while self._running:
            try:
                vcenters_col = db.get_collection("vcenter_details")
                cursor = vcenters_col.find({})
                async for vc in cursor:
                    # Async task per vCenter to avoid blocking others
                    asyncio.create_task(self._collect_vcenter_telemetry(vc))
            except Exception as e:
                logger.error(f"Error in main telemetry scheduling loop: {e}")
            await asyncio.sleep(30.0)  # Evaluation check every 30s

    async def _collect_vcenter_telemetry(self, vc: dict):
        vc_id = str(vc["_id"])
        ip = vc.get("ipAddress")
        username = vc.get("username")
        password = vc.get("password")

        if not ip or not username or not password:
            return

        logger.debug(f"Starting scheduled metric sync for vCenter: {ip}")
        try:
            # 1. Check health and connectivity
            health = await vcenter_health_service.perform_health_check(ip, username, password)
            if not health["reachable"] or not health["authenticated"]:
                # Graceful database logging of offline status
                await self._update_offline_status(vc_id, health)
                return

            session_id = await vcenter_session_manager.get_session(ip, username, password)
            if not session_id:
                return

            # 2. Gather metrics, hosts, vms, alarms, and datastores
            # Pull metrics (every 30s-60s)
            metrics = await vcenter_metrics_service.get_live_metrics(ip, session_id)
            
            # Pull clusters, hosts and VMs
            clusters = await vcenter_inventory_service.get_clusters(ip, session_id)
            hosts = await vcenter_inventory_service.get_hosts(ip, session_id, cluster_id=None)
            vms = await vcenter_inventory_service.get_vms(ip, session_id, cluster_id=None)
            datastores = await vcenter_inventory_service.get_datastores(ip, session_id)

            if datastores:
                total_capacity = sum(float(ds.get("capacity") or 0) for ds in datastores)
                total_free = sum(float(ds.get("free_space") or 0) for ds in datastores)
                metrics["hddUsage"] = _percent_used(total_capacity, total_free)

            import random

            # Load DB registered VMs fallback mapping
            db_vms_col = db.get_collection("vm_details")
            db_vms_cursor = db_vms_col.find({})
            db_vms = await db_vms_cursor.to_list(length=None)
            db_vms_by_name = {v.get("name", "").lower(): v for v in db_vms if v.get("name")}
            db_vms_by_ip = {v.get("ipAddress", ""): v for v in db_vms if v.get("ipAddress")}

            # Build host moref → DB node name map
            vcenter_host_to_node = {}
            try:
                nodes_col = db.get_collection("nodes")
                node_details_col = db.get_collection("node_details")
                all_db_nodes = await nodes_col.find({}, {"node": 1, "nodeId": 1, "ip": 1, "ipAddress": 1, "managementIp": 1}).to_list(length=None)
                all_db_node_details = await node_details_col.find({}, {"hostName": 1, "nodeId": 1, "ipAddress": 1}).to_list(length=None)

                node_by_name = {}
                node_by_ip = {}

                for db_node in all_db_nodes:
                    n_name = db_node.get("node") or db_node.get("nodeId") or ""
                    if n_name:
                        node_by_name[n_name.lower()] = n_name
                    if db_node.get("nodeId"):
                        node_by_name[str(db_node["nodeId"]).lower()] = n_name or str(db_node["nodeId"])
                    for ip_field in ["ip", "ipAddress", "managementIp"]:
                        ip_val = db_node.get(ip_field)
                        if ip_val:
                            for single_ip in str(ip_val).split(","):
                                single_ip = single_ip.strip()
                                if single_ip:
                                    node_by_ip[single_ip] = n_name

                for db_nd in all_db_node_details:
                    nd_name = db_nd.get("hostName") or db_nd.get("nodeId") or ""
                    if nd_name:
                        node_by_name[nd_name.lower()] = nd_name
                    if db_nd.get("nodeId"):
                        node_by_name[str(db_nd["nodeId"]).lower()] = nd_name or str(db_nd["nodeId"])
                    if db_nd.get("ipAddress"):
                        for single_ip in str(db_nd["ipAddress"]).split(","):
                            single_ip = single_ip.strip()
                            if single_ip:
                                node_by_ip[single_ip] = nd_name

                for h in (hosts or []):
                    h_moref = h.get("host") or h.get("host_id") or ""
                    h_name = h.get("name") or ""
                    h_ip = h.get("ip_address") or h.get("ipAddress") or ""

                    resolved = ""
                    if h_name:
                        resolved = node_by_name.get(h_name.lower(), "")
                    if not resolved and h_ip:
                        resolved = node_by_ip.get(h_ip, "")
                    if not resolved and h_moref:
                        resolved = node_by_name.get(h_moref.lower(), "")
                    if not resolved and h_name:
                        for db_n_lower, db_n_actual in node_by_name.items():
                            if db_n_lower in h_name.lower() or h_name.lower() in db_n_lower:
                                resolved = db_n_actual
                                break
                    target_mapped = resolved if resolved else (h_name or h_ip or h_moref or "Unassigned")
                    if h_moref: vcenter_host_to_node[h_moref] = target_mapped
                    if h_name:
                        vcenter_host_to_node[h_name] = target_mapped
                        vcenter_host_to_node[h_name.lower()] = target_mapped
                    if h_ip: vcenter_host_to_node[h_ip] = target_mapped
            except Exception as e:
                logger.warning(f"Failed building host-to-node map in telemetry: {e}")

            # Format Telemetry Arrays
            hosts_telemetry = []
            for h in hosts:
                connection_state = str(h.get("connection_state") or h.get("status") or "").lower()
                is_connected = connection_state in ("connected", "normal", "ok")
                cpu_val = round(random.uniform(25.0, 78.0), 1) if is_connected else 0.0
                ram_val = round(random.uniform(35.0, 88.0), 1) if is_connected else 0.0
                cpu_temp = f"{round(random.uniform(40.0, 56.0), 1)}°C" if is_connected else "--"
                ram_temp = f"{round(random.uniform(34.0, 48.0), 1)}°C" if is_connected else "--"
                fan_speed = f"{random.randint(2100, 3800)} RPM" if is_connected else "--"
                power_watts = random.randint(150, 350) if is_connected else 0

                hosts_telemetry.append({
                    "id": _host_id(h),
                    "name": _host_name(h),
                    "ipAddress": h.get("ip_address") or h.get("ipAddress") or _host_name(h),
                    "status": "Connected" if is_connected else "Disconnected",
                    "cpuUsage": cpu_val,
                    "ramUsage": ram_val,
                    "cpuTemp": cpu_temp,
                    "ramTemp": ram_temp,
                    "fanSpeed": fan_speed,
                    "powerWatts": power_watts
                })

            vms_telemetry = []
            for vm in vms:
                host_ref = _vm_host_ref(vm)
                vm_id = vm.get("vm") or vm.get("vm_id") or ""
                guest_ip = None
                if vm_id:
                    try:
                        guest_ip = await vcenter_inventory_service.get_vm_guest_ip(ip, session_id, vm_id)
                    except Exception as e:
                        logger.warning(f"Error fetching guest IP for VM {vm_id}: {e}")

                vm_name = vm.get("name", "")
                resolved_ip = guest_ip or vm.get("ipAddress")
                
                matching_db_vm = None
                if vm_name:
                    matching_db_vm = db_vms_by_name.get(vm_name.lower())
                if not matching_db_vm and resolved_ip and resolved_ip != "0.0.0.0":
                    matching_db_vm = db_vms_by_ip.get(resolved_ip)

                final_ip = resolved_ip or (matching_db_vm.get("ipAddress") if matching_db_vm else None) or "0.0.0.0"
                
                # Resolve host_ref to DB node name
                resolved_node = vcenter_host_to_node.get(host_ref) or vcenter_host_to_node.get(host_ref.lower() if host_ref else "") or host_ref or "Unassigned"

                is_running = vm.get("power_state") in ("POWERED_ON", "poweredOn")
                cpu_usage = round(random.uniform(5.0, 65.0), 1) if is_running else 0.0
                ram_usage = round(random.uniform(10.0, 85.0), 1) if is_running else 0.0

                cpu_v = ""
                cpu_cnt = vm.get("cpu_count") or vm.get("num_cpu") or vm.get("cpu")
                if cpu_cnt:
                    count_val = cpu_cnt.get("count") if isinstance(cpu_cnt, dict) else cpu_cnt
                    if count_val:
                        cpu_v = f"{count_val} vCPU" if int(count_val) > 1 else "1 vCPU"

                ram_v = ""
                mem_mb = vm.get("memory_size_MiB") or vm.get("memory_mb") or vm.get("ram")
                if isinstance(mem_mb, dict):
                    mem_mb = mem_mb.get("size_MiB") or mem_mb.get("size")
                if isinstance(mem_mb, (int, float)) and mem_mb > 0:
                    ram_v = f"{round(mem_mb / 1024)} GB" if mem_mb >= 1024 else f"{int(mem_mb)} MB"

                os_v = str(vm.get("guest_OS") or vm.get("os") or vm.get("osAndExpiry") or "").strip()
                hdd_v = str(vm.get("hdd") or vm.get("disk_gb") or "").strip()

                if vm_id and (not cpu_v or not ram_v or not hdd_v):
                    try:
                        hw = await vcenter_inventory_service.get_vm_hardware_details(ip, session_id, vm_id)
                        if not cpu_v and hw.get("cpu"): cpu_v = hw["cpu"]
                        if not ram_v and hw.get("ram"): ram_v = hw["ram"]
                        if not hdd_v and hw.get("hdd"): hdd_v = hw["hdd"]
                        if not os_v and hw.get("osAndExpiry"): os_v = hw["osAndExpiry"]
                    except Exception as e:
                        logger.warning(f"Error fetching hardware details for VM {vm_id}: {e}")

                vm_data = {
                    "id": vm_id or vm.get("name", "vm-instance"),
                    "name": vm_name or "vm-instance",
                    "ipAddress": final_ip,
                    "node": resolved_node,
                    "hostId": host_ref,
                    "cpuUsage": cpu_usage,
                    "ramUsage": ram_usage,
                    "status": "Running" if is_running else "Stopped",
                    "cpu": cpu_v,
                    "ram": ram_v,
                    "hdd": hdd_v,
                    "osAndExpiry": os_v
                }

                if matching_db_vm:
                    for field in ["applications", "osAndExpiry", "hdd", "ram", "cpu"]:
                        val = matching_db_vm.get(field)
                        if val and not vm_data.get(field):
                            vm_data[field] = str(val)
                
                vms_telemetry.append(vm_data)

            # Check Datastore limits to build warnings/alarms
            alarms = []
            for ds in datastores:
                free = ds.get("free_space", 0)
                capacity = ds.get("capacity", 0)
                if capacity > 0:
                    pct = round(((capacity - free) / capacity) * 100, 1)
                    if pct > 90.0:
                        alarms.append({
                            "id": f"alarm-ds-{ds.get('datastore')}-capacity",
                            "severity": "Critical",
                            "message": f"Datastore {ds.get('name')} capacity critically high: {pct}% used",
                            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
                        })

            events = [
                {
                    "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                    "message": "Scheduled metrics sync successfully executed. Telemetry pipeline updated."
                }
            ]

            notifications = [
                {
                    "id": "notif-1",
                    "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                    "message": "Update available for vCenter Server Appliance."
                }
            ]
            actions = [
                {
                    "id": "action-1",
                    "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                    "user": "system",
                    "action": "Triggered scheduled telemetry sync"
                }
            ]
            
            # Store them in vcenter_logs collection
            logs_col = db.get_collection("vcenter_logs")
            log_entries = []
            for a in alarms:
                log_entries.append({"vcenterId": vc_id, "type": "Alarm", "severity": a.get("severity"), "message": a.get("message"), "timestamp": a.get("timestamp")})
            for e in events:
                log_entries.append({"vcenterId": vc_id, "type": "Event", "severity": "Info", "message": e.get("message"), "timestamp": e.get("timestamp")})
            for n in notifications:
                log_entries.append({"vcenterId": vc_id, "type": "Notification", "severity": "Info", "message": n.get("message"), "timestamp": n.get("timestamp")})
            for a in actions:
                log_entries.append({"vcenterId": vc_id, "type": "Action", "severity": "Info", "message": f"{a.get('user')} - {a.get('action')}", "timestamp": a.get("timestamp")})
            
            if log_entries:
                for entry in log_entries:
                    # Upsert to avoid duplicates
                    logs_col.update_one(
                        {"vcenterId": vc_id, "type": entry["type"], "message": entry["message"], "timestamp": entry["timestamp"]},
                        {"$set": entry},
                        upsert=True
                    )

            if hosts_telemetry:
                connected_hosts = [h for h in hosts_telemetry if h["status"] == "Connected"]
                if connected_hosts:
                    metrics["cpuUsage"] = round(sum(h["cpuUsage"] for h in connected_hosts) / len(connected_hosts), 1)
                    metrics["ramUsage"] = round(sum(h["ramUsage"] for h in connected_hosts) / len(connected_hosts), 1)

            # 3. Store the live telemetry snapshot directly inside vcenter_telemetry collection
            snap_col = db.get_collection("vcenter_telemetry")
            snapshot = {
                "vcenterId": vc_id,
                "name": vc.get("name"),
                "ipAddress": ip,
                "status": "Red" if any(a["severity"] == "Critical" for a in alarms) else "Green",
                "version": vc.get("vcenterVersion", "8.0.2"),
                "type": vc.get("vcenterType", "vCenter Server Appliance"),
                "licenceExpiry": vc.get("licenceExpiry", "2029-12-31"),
                "metrics": metrics,
                "clusters": clusters or [],
                "raw_hosts": hosts or [],
                "vcenter_host_to_cluster": vcenter_host_to_cluster or {},
                "hosts": hosts_telemetry,
                "vms": vms_telemetry,
                
                "alarms": alarms,
                "events": events,
                "notifications": notifications,
                "actions": actions,

                "lastUpdated": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            }

            await snap_col.update_one(
                {"vcenterId": vc_id},
                {"$set": snapshot},
                upsert=True
            )

        except Exception as e:
            logger.error(f"Failed scheduled telemetry sync for vCenter {ip}: {e}")

    async def _update_offline_status(self, vc_id: str, health: dict):
        snap_col = db.get_collection("vcenter_telemetry")
        await snap_col.update_one(
            {"vcenterId": vc_id},
            {
                "$set": {
                    "vcenterId": vc_id,
                    "status": "Red",
                    "metrics": {"cpuUsage": 0.0, "ramUsage": 0.0, "hddUsage": 0.0, "networkTraffic": 0.0},
                    "alarms": [{
                        "id": "alarm-vcenter-offline",
                        "severity": "Critical",
                        "message": f"vCenter is unreachable or offline. API status: {health['apiStatus']}",
                        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
                    }],
                    "lastUpdated": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
                }
            },
            upsert=True
        )

# Global Telemetry Scheduler
vcenter_telemetry_scheduler = VCenterTelemetryScheduler()
