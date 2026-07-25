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
        if cluster_id:
            params["filter.clusters"] = cluster_id

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

    async def get_vms(self, ip_address: str, session_id: str, cluster_id: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        client = vcenter_http_client.get_client()
        headers = {"vmware-api-session-id": session_id}

        params = {}
        if cluster_id:
            params["filter.clusters"] = cluster_id

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

# Global Inventory Service
vcenter_inventory_service = VCenterInventoryService()
