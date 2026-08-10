import logging
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional
from services.vcenter.client import vcenter_http_client

logger = logging.getLogger("vcenter.session_manager")

class VCenterSessionManager:
    _instance: Optional['VCenterSessionManager'] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(VCenterSessionManager, cls).__new__(cls)
            # IP -> {"session_id": str, "expires_at": datetime, "username": str, "password": str}
            cls._instance._sessions = {}
            # IP -> asyncio.Lock
            cls._instance._locks = {}
            cls._instance._global_lock = asyncio.Lock()
        return cls._instance

    async def get_lock(self, ip_address: str) -> asyncio.Lock:
        async with self._global_lock:
            if ip_address not in self._locks:
                self._locks[ip_address] = asyncio.Lock()
            return self._locks[ip_address]

    async def get_session(self, ip_address: str, username: str, password: str, verify_ssl: bool = False) -> Optional[str]:
        lock = await self.get_lock(ip_address)
        async with lock:
            now = datetime.now(timezone.utc)
            cached = self._sessions.get(ip_address)

            # Re-use cached session if valid and not close to expiry (2 minutes grace period)
            if cached and cached["expires_at"] > now + timedelta(minutes=2):
                return cached["session_id"]

            logger.info(f"Initiating vCenter session connection to: {ip_address}")
            client = vcenter_http_client.get_client(verify_ssl=verify_ssl)

            try:
                # Attempt modern session endpoint
                response = await client.post(
                    f"https://{ip_address}/api/session",
                    auth=(username, password),
                    timeout=10.0
                )
                if response.status_code == 201 or response.status_code == 200:
                    session_id = response.json()
                    # Response can be a raw string or a dict/JSON wrapper
                    if isinstance(session_id, dict):
                        session_id = session_id.get("value") or session_id.get("session")
                    
                    if session_id:
                        self._sessions[ip_address] = {
                            "session_id": session_id,
                            "expires_at": now + timedelta(minutes=20),
                            "username": username,
                            "password": password
                        }
                        logger.info(f"Successfully obtained modern vCenter session token for: {ip_address}")
                        return session_id
            except Exception as e:
                logger.warning(f"Modern session endpoint failed for {ip_address}: {e}. Trying legacy CIS endpoint...")

            try:
                # Fallback to legacy REST session endpoint (vSphere 6.x / 7.x CIS)
                response = await client.post(
                    f"https://{ip_address}/rest/com/vmware/cis/session",
                    auth=(username, password),
                    timeout=10.0
                )
                if response.status_code == 200:
                    data = response.json()
                    session_id = data.get("value")
                    if session_id:
                        self._sessions[ip_address] = {
                            "session_id": session_id,
                            "expires_at": now + timedelta(minutes=20),
                            "username": username,
                            "password": password
                        }
                        logger.info(f"Successfully obtained legacy CIS vCenter session token for: {ip_address}")
                        return session_id
            except Exception as e:
                logger.error(f"Failed to authenticate with vCenter server at {ip_address} on legacy endpoint: {e}")

            return None

    async def keep_alive_sessions(self) -> None:
        """Background task to periodically refresh active sessions before they expire"""
        now = datetime.now(timezone.utc)
        for ip_address, session in list(self._sessions.items()):
            # If session expires in less than 5 minutes, trigger active refresh
            if session["expires_at"] < now + timedelta(minutes=5):
                logger.info(f"Pre-emptively renewing session for vCenter: {ip_address}")
                try:
                    await self.get_session(
                        ip_address=ip_address,
                        username=session["username"],
                        password=session["password"]
                    )
                except Exception as e:
                    logger.error(f"Failed background auto-renewal of vCenter session for {ip_address}: {e}")

# Global Session Manager instance
vcenter_session_manager = VCenterSessionManager()
