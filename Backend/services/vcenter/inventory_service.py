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
            # Modern Endpoint
            try:
                res = await client.get(f"https://{ip_address}/api/vcenter/vm/{vm_id}/guest/networking", headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    if isinstance(data, dict):
                        for addr in data.get("ip_addresses", []):
                            ip = addr.get("ip_address") if isinstance(addr, dict) else addr
                            if ip and not ip.startswith("fe80") and not ip.startswith("::") and ":" not in ip:
                                return ip
            except Exception as e:
                logger.warning(f"Failed modern guest networking lookup for {vm_id}: {e}")

            # Legacy Endpoint
            try:
                res = await client.get(f"https://{ip_address}/rest/vcenter/vm/{vm_id}/guest/networking", headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    val = data.get("value", {}) if isinstance(data, dict) else {}
                    if isinstance(val, dict):
                        for addr in val.get("ip_addresses", []):
                            ip = addr.get("ip_address") if isinstance(addr, dict) else addr
                            if ip and not ip.startswith("fe80") and not ip.startswith("::") and ":" not in ip:
                                return ip
            except Exception as e:
                logger.warning(f"Failed legacy guest networking lookup for {vm_id}: {e}")
            return None

        key = f"vcenter:{ip_address}:vm:{vm_id}:guest_ip"
        return await global_cache.get_or_fetch(
            key,
            lambda: vcenter_rate_limiter.execute_request(ip_address, fetch),
            ttl=300.0,
            revalidate_ttl=60.0
        )

# Global Inventory Service
vcenter_inventory_service = VCenterInventoryService()
