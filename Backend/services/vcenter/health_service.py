import time
import socket
import logging
import asyncio
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from services.vcenter.client import vcenter_http_client
from services.vcenter.session_manager import vcenter_session_manager

logger = logging.getLogger("vcenter.health")

class VCenterHealthService:
    async def perform_health_check(self, ip_address: str, username: Optional[str] = None, password: Optional[str] = None) -> Dict[str, Any]:
        start_time = time.time()
        reachable = False
        authenticated = False
        api_status = "unhealthy"
        session_valid = False
        
        # 1. Non-blocking TCP Socket Check on HTTPS management port 443
        try:
            # We perform non-blocking socket connect by executing run_in_executor
            loop = asyncio.get_event_loop()
            def try_connect():
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                    s.settimeout(1.0)
                    s.connect((ip_address, 443))
                    return True
            reachable = await loop.run_in_executor(None, try_connect)
        except Exception as e:
            logger.warning(f"Connection check failed for vCenter {ip_address}: {e}")

        latency = round((time.time() - start_time) * 1000)

        # 2. Authenticated Session validation
        if reachable and username and password:
            try:
                session_id = await vcenter_session_manager.get_session(ip_address, username, password)
                if session_id:
                    authenticated = True
                    session_valid = True
                    api_status = "healthy"
            except Exception as e:
                logger.error(f"Failed session evaluation check for vCenter health at {ip_address}: {e}")

        return {
            "reachable": reachable,
            "authenticated": authenticated,
            "latencyMs": latency,
            "apiStatus": api_status,
            "lastSuccessfulSync": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z") if reachable else None,
            "sessionValid": session_valid
        }

vcenter_health_service = VCenterHealthService()
