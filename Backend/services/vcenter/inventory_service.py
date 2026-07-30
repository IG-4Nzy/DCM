import logging
import asyncio
from typing import List, Dict, Any, Optional
from services.vcenter.client import vcenter_http_client
from services.vcenter.session_manager import vcenter_session_manager
from services.vcenter.rate_limiter import vcenter_rate_limiter
from services.vcenter.cache import global_cache

logger = logging.getLogger("vcenter.inventory")

class VCenterInventoryService:
    def __init__(self):
        pass

    async def get_clusters(self, ip_address: str, session_id: str) -> List[Dict[str, Any]]:
        client = vcenter_http_client.get_client()
        headers = {"vmware-api-session-id": session_id}

        async def fetch():
            # Try Modern Endpoint first
            try:
                res = await client.get(f"https://{ip_address}/api/vcenter/cluster", headers=headers)
                if res.status_code == 200:
                    return res.json()
            except Exception as e:
                logger.warning(f"Failed modern cluster retrieval: {e}")

            # Try Legacy REST endpoint fallback
            res = await client.get(f"https://{ip_address}/rest/vcenter/cluster", headers=headers)
            if res.status_code == 200:
                data = res.json()
                return data.get("value", []) if isinstance(data, dict) else data
            return []

        key = f"vcenter:{ip_address}:clusters"
        # Cached for 60 seconds (with stale-while-revalidate allowed up to 120s)
        return await global_cache.get_or_fetch(
            key, 
            lambda: vcenter_rate_limiter.execute_request(ip_address, fetch),
            ttl=60.0,
            revalidate_ttl=60.0
        )

    async def get_hosts(self, ip_address: str, session_id: str, cluster_id: Optional[str] = None) -> List[Dict[str, Any]]:
        client = vcenter_http_client.get_client()
        headers = {"vmware-api-session-id": session_id}
        
        # Scoped filters to avoid massive overhead
        params = {}
        if cluster_id and not (len(str(cluster_id)) == 24 and all(c in "0123456789abcdefABCDEF" for c in str(cluster_id))):
            params["filter.clusters"] = str(cluster_id)

        async def fetch():
            try:
                res = await client.get(f"https://{ip_address}/api/vcenter/host", headers=headers, params=params)
                if res.status_code == 200:
                    return res.json()
            except Exception as e:
                logger.warning(f"Failed modern hosts lookup: {e}")

            # Legacy endpoint
            res = await client.get(f"https://{ip_address}/rest/vcenter/host", headers=headers, params=params)
            if res.status_code == 200:
                data = res.json()
                return data.get("value", []) if isinstance(data, dict) else data
            return []

        key = f"vcenter:{ip_address}:hosts:{cluster_id or 'all'}"
        return await global_cache.get_or_fetch(
            key,
            lambda: vcenter_rate_limiter.execute_request(ip_address, fetch),
            ttl=120.0,
            revalidate_ttl=60.0
        )

    async def get_vms(self, ip_address: str, session_id: str, cluster_id: Optional[str] = None, limit: int = 5000) -> List[Dict[str, Any]]:
        client = vcenter_http_client.get_client()
        headers = {"vmware-api-session-id": session_id}

        params = {}
        # Only pass cluster filter if cluster_id is a vCenter cluster moref (not a 24-char MongoDB ObjectID)
        if cluster_id and not (len(str(cluster_id)) == 24 and all(c in "0123456789abcdefABCDEF" for c in str(cluster_id))):
            params["filter.clusters"] = str(cluster_id)

        async def fetch():
            try:
                # Query VMs list with property selections/pagination where possible
                res = await client.get(f"https://{ip_address}/api/vcenter/vm", headers=headers, params=params)
                if res.status_code == 200:
                    vms = res.json()
                    return vms[:limit] if isinstance(vms, list) else vms
            except Exception as e:
                logger.warning(f"Failed modern guest vms retrieval: {e}")

            # Legacy fallback
            res = await client.get(f"https://{ip_address}/rest/vcenter/vm", headers=headers, params=params)
            if res.status_code == 200:
                data = res.json()
                vms_list = data.get("value", []) if isinstance(data, dict) else data
                return vms_list[:limit]
            return []

        key = f"vcenter:{ip_address}:vms:{cluster_id or 'all'}"
        return await global_cache.get_or_fetch(
            key,
            lambda: vcenter_rate_limiter.execute_request(ip_address, fetch),
            ttl=180.0,
            revalidate_ttl=60.0
        )

    async def get_datastores(self, ip_address: str, session_id: str) -> List[Dict[str, Any]]:
        client = vcenter_http_client.get_client()
        headers = {"vmware-api-session-id": session_id}

        async def fetch():
            try:
                res = await client.get(f"https://{ip_address}/api/vcenter/datastore", headers=headers)
                if res.status_code == 200:
                    return res.json()
            except Exception as e:
                logger.warning(f"Failed modern datastores list retrieval: {e}")

            res = await client.get(f"https://{ip_address}/rest/vcenter/datastore", headers=headers)
            if res.status_code == 200:
                data = res.json()
                return data.get("value", []) if isinstance(data, dict) else data
            return []

        key = f"vcenter:{ip_address}:datastores"
        return await global_cache.get_or_fetch(
            key,
            lambda: vcenter_rate_limiter.execute_request(ip_address, fetch),
            ttl=180.0,
            revalidate_ttl=60.0
        )

    async def get_vm_guest_ip(self, ip_address: str, session_id: str, vm_id: str) -> Optional[str]:
        client = vcenter_http_client.get_client()
        headers = {"vmware-api-session-id": session_id}

        async def fetch():
            found_ips = []
            def extract_ips(obj):
                if isinstance(obj, dict):
                    if "ip_address" in obj and isinstance(obj["ip_address"], str):
                        found_ips.append(obj["ip_address"])
                    if "ipAddress" in obj and isinstance(obj["ipAddress"], str):
                        found_ips.append(obj["ipAddress"])
                    for v in obj.values():
                        extract_ips(v)
                elif isinstance(obj, list):
                    for item in obj:
                        extract_ips(item)

            endpoints_to_try = [
                f"/api/vcenter/vm/{vm_id}/guest/identity",
                f"/api/vcenter/vm/{vm_id}/guest/networking",
                f"/api/vcenter/vm/{vm_id}/guest/networking/interfaces",
                f"/rest/vcenter/vm/{vm_id}/guest/identity",
                f"/rest/vcenter/vm/{vm_id}/guest/networking",
                f"/rest/vcenter/vm/{vm_id}/guest/networking/interfaces"
            ]
            
            for endpoint in endpoints_to_try:
                try:
                    res = await client.get(f"https://{ip_address}{endpoint}", headers=headers)
                    if res.status_code == 200:
                        data = res.json()
                        extract_ips(data)
                        for ip in found_ips:
                            if ip and not ip.startswith("fe80") and not ip.startswith("::") and ":" not in ip and ip != "127.0.0.1":
                                return ip
                except Exception as e:
                    logger.debug(f"Failed guest IP lookup on {endpoint} for {vm_id}: {e}")
                    
            return None

        key = f"vcenter:{ip_address}:vm:{vm_id}:guest_ip"
        return await global_cache.get_or_fetch(
            key,
            lambda: vcenter_rate_limiter.execute_request(ip_address, fetch),
            ttl=300.0,
            revalidate_ttl=60.0
        )

    async def get_vm_hardware_details(self, ip_address: str, session_id: str, vm_id: str) -> Dict[str, Any]:
        client = vcenter_http_client.get_client()
        headers = {"vmware-api-session-id": session_id}

        async def fetch():
            details = {"cpu": "", "ram": "", "hdd": "", "osAndExpiry": ""}
            # 1. Try modern /api/vcenter/vm/{vm_id}
            try:
                res = await client.get(f"https://{ip_address}/api/vcenter/vm/{vm_id}", headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    cpu_obj = data.get("cpu", {})
                    count = cpu_obj.get("count") if isinstance(cpu_obj, dict) else cpu_obj
                    if count:
                        details["cpu"] = f"{count} vCPU" if int(count) > 1 else "1 vCPU"

                    mem_obj = data.get("memory", {})
                    size_mb = mem_obj.get("size_MiB") if isinstance(mem_obj, dict) else mem_obj
                    if isinstance(size_mb, (int, float)) and size_mb > 0:
                        if size_mb >= 1024:
                            details["ram"] = f"{round(size_mb / 1024)} GB"
                        else:
                            details["ram"] = f"{int(size_mb)} MB"

                    details["osAndExpiry"] = str(data.get("guest_OS") or data.get("guest_fullname") or "").strip()

                    disks = data.get("disks", {})
                    total_bytes = 0
                    if isinstance(disks, dict):
                        for d_info in disks.values():
                            if isinstance(d_info, dict) and "capacity" in d_info:
                                total_bytes += float(d_info.get("capacity") or 0)
                    elif isinstance(disks, list):
                        for d_info in disks:
                            if isinstance(d_info, dict):
                                val = d_info.get("value", d_info)
                                cap = val.get("capacity", 0) if isinstance(val, dict) else 0
                                total_bytes += float(cap or 0)

                    if total_bytes > 0:
                        gb = round(total_bytes / (1024 ** 3))
                        details["hdd"] = f"{gb} GB" if gb >= 1 else f"{round(total_bytes / (1024 ** 2))} MB"
                    return details
            except Exception as e:
                logger.debug(f"Failed modern vm details lookup for {vm_id}: {e}")

            # 2. Try legacy /rest/vcenter/vm/{vm_id}
            try:
                res = await client.get(f"https://{ip_address}/rest/vcenter/vm/{vm_id}", headers=headers)
                if res.status_code == 200:
                    body = res.json()
                    data = body.get("value", body) if isinstance(body, dict) else {}
                    cpu_obj = data.get("cpu", {})
                    count = cpu_obj.get("count") if isinstance(cpu_obj, dict) else cpu_obj
                    if count:
                        details["cpu"] = f"{count} vCPU" if int(count) > 1 else "1 vCPU"

                    mem_obj = data.get("memory", {})
                    size_mb = mem_obj.get("size_MiB") if isinstance(mem_obj, dict) else mem_obj
                    if isinstance(size_mb, (int, float)) and size_mb > 0:
                        if size_mb >= 1024:
                            details["ram"] = f"{round(size_mb / 1024)} GB"
                        else:
                            details["ram"] = f"{int(size_mb)} MB"

                    details["osAndExpiry"] = str(data.get("guest_OS") or data.get("guest_fullname") or "").strip()

                    disks = data.get("disks", [])
                    total_bytes = 0
                    if isinstance(disks, list):
                        for d_info in disks:
                            if isinstance(d_info, dict):
                                val = d_info.get("value", d_info)
                                cap = val.get("capacity", 0) if isinstance(val, dict) else 0
                                total_bytes += float(cap or 0)
                    if total_bytes > 0:
                        gb = round(total_bytes / (1024 ** 3))
                        details["hdd"] = f"{gb} GB" if gb >= 1 else f"{round(total_bytes / (1024 ** 2))} MB"
                    return details
            except Exception as e:
                logger.debug(f"Failed legacy vm details lookup for {vm_id}: {e}")

            return details

        key = f"vcenter:{ip_address}:vm:{vm_id}:hw_details"
        return await global_cache.get_or_fetch(
            key,
            lambda: vcenter_rate_limiter.execute_request(ip_address, fetch),
            ttl=300.0,
            revalidate_ttl=60.0
        )

    async def get_vm_snapshots(self, ip_address: str, session_id: str, vm_id: str) -> List[Dict[str, Any]]:
        client = vcenter_http_client.get_client()
        headers = {"vmware-api-session-id": session_id}

        async def fetch():
            snapshots = []
            def parse_snapshots(obj):
                if isinstance(obj, list):
                    for item in obj:
                        parse_snapshots(item)
                elif isinstance(obj, dict):
                    name = obj.get("name") or obj.get("snapshot_name") or obj.get("title")
                    if name:
                        snapshots.append({
                            "name": str(name),
                            "snapshotId": str(obj.get("snapshot") or obj.get("id") or ""),
                            "description": str(obj.get("description") or obj.get("remarks") or ""),
                            "createdAt": str(obj.get("create_time") or obj.get("created_at") or obj.get("createTime") or "")
                        })
                    if "children" in obj:
                        parse_snapshots(obj["children"])
                    if "childSnapshotList" in obj:
                        parse_snapshots(obj["childSnapshotList"])

            endpoints_to_try = [
                f"/api/vcenter/vm/{vm_id}/snapshot",
                f"/api/vcenter/vm/{vm_id}/snapshots",
                f"/rest/vcenter/vm/{vm_id}/snapshot",
                f"/rest/vcenter/vm/{vm_id}"
            ]

            for endpoint in endpoints_to_try:
                try:
                    res = await client.get(f"https://{ip_address}{endpoint}", headers=headers)
                    if res.status_code == 200:
                        data = res.json()
                        val = data.get("value", data) if isinstance(data, dict) else data
                        if isinstance(val, dict) and ("snapshots" in val or "snapshot" in val):
                            parse_snapshots(val.get("snapshots") or val.get("snapshot"))
                        elif isinstance(val, list):
                            parse_snapshots(val)
                        if snapshots:
                            return snapshots
                except Exception as e:
                    logger.debug(f"Failed snapshot lookup on {endpoint} for {vm_id}: {e}")

            return snapshots

        key = f"vcenter:{ip_address}:vm:{vm_id}:snapshots"
        return await global_cache.get_or_fetch(
            key,
            lambda: vcenter_rate_limiter.execute_request(ip_address, fetch),
            ttl=300.0,
            revalidate_ttl=60.0
        )

    async def get_vm_templates(self, ip_address: str, session_id: str) -> List[Dict[str, Any]]:
        client = vcenter_http_client.get_client()
        headers = {"vmware-api-session-id": session_id}

        async def fetch():
            templates = []
            endpoints = [
                "/api/vcenter/vm?filter.is_template=true",
                "/rest/vcenter/vm?filter.is_template=true",
                "/api/content/library/item"
            ]
            for ep in endpoints:
                try:
                    res = await client.get(f"https://{ip_address}{ep}", headers=headers)
                    if res.status_code == 200:
                        data = res.json()
                        items = data.get("value", data) if isinstance(data, dict) else data
                        if isinstance(items, list):
                            for t in items:
                                t_name = t.get("name") or t.get("vm_name") or t.get("title")
                                if t_name:
                                    templates.append({
                                        "name": str(t_name),
                                        "templateId": str(t.get("vm") or t.get("id") or ""),
                                        "remarks": f"Template in vCenter ({t.get('power_state', 'OFF')})",
                                        "createdAt": str(t.get("created_at") or "")
                                    })
                        if templates:
                            return templates
                except Exception as e:
                    logger.debug(f"Failed template lookup on {ep}: {e}")
            return templates

        key = f"vcenter:{ip_address}:templates"
        return await global_cache.get_or_fetch(
            key,
            lambda: vcenter_rate_limiter.execute_request(ip_address, fetch),
            ttl=300.0,
            revalidate_ttl=60.0
        )

    async def get_vm_clones(self, ip_address: str, session_id: str, vm_name: str) -> List[Dict[str, Any]]:
        client = vcenter_http_client.get_client()
        headers = {"vmware-api-session-id": session_id}

        async def fetch():
            clones = []
            try:
                res = await client.get(f"https://{ip_address}/api/vcenter/vm", headers=headers)
                if res.status_code == 200:
                    all_vms = res.json()
                    if isinstance(all_vms, list):
                        for v in all_vms:
                            name = str(v.get("name") or "")
                            if name and name.lower() != vm_name.lower() and (
                                vm_name.lower() in name.lower() or 
                                "clone" in name.lower() or 
                                "copy" in name.lower()
                            ):
                                clones.append({
                                    "name": name,
                                    "cloneId": str(v.get("vm") or ""),
                                    "remarks": f"Cloned VM in vCenter ({v.get('power_state', 'OFF')})",
                                    "createdAt": ""
                                })
            except Exception as e:
                logger.debug(f"Failed clone lookup for {vm_name}: {e}")
            return clones

        key = f"vcenter:{ip_address}:vm:{vm_name}:clones"
        return await global_cache.get_or_fetch(
            key,
            lambda: vcenter_rate_limiter.execute_request(ip_address, fetch),
            ttl=300.0,
            revalidate_ttl=60.0
        )

    async def find_vm_by_ip(self, ip_address: str, session_id: str, target_vm_ip: str) -> Optional[Dict[str, Any]]:
        if not target_vm_ip or target_vm_ip in ("--", "N/A"):
            return None
        vms = await self.get_vms(ip_address, session_id)
        for v in vms:
            vm_id = v.get("vm") or v.get("id")
            if not vm_id:
                continue
            ip_val = v.get("ip_address") or v.get("ipAddress")
            if ip_val and str(ip_val).strip() == target_vm_ip.strip():
                return v
            guest_ip = await self.get_vm_guest_ip(ip_address, session_id, str(vm_id))
            if guest_ip and str(guest_ip).strip() == target_vm_ip.strip():
                return v
        return None

    async def get_snapshots_and_clones_by_ip(self, ip_address: str, session_id: str, target_vm_ip: str, vm_name: str) -> Dict[str, Any]:
        result = {"snapshots": [], "clones": [], "vcenterVmId": None}
        matched_vm = await self.find_vm_by_ip(ip_address, session_id, target_vm_ip)
        if matched_vm:
            vm_id = matched_vm.get("vm") or matched_vm.get("id")
            v_name = matched_vm.get("name") or vm_name
            result["vcenterVmId"] = vm_id
            if vm_id:
                result["snapshots"] = await self.get_vm_snapshots(ip_address, session_id, str(vm_id))
            result["clones"] = await self.get_vm_clones(ip_address, session_id, str(v_name))
        else:
            result["clones"] = await self.get_vm_clones(ip_address, session_id, vm_name)
        return result

# Global Inventory Service
vcenter_inventory_service = VCenterInventoryService()
