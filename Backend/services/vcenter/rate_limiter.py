import logging
import asyncio
from typing import Dict, Optional

logger = logging.getLogger("vcenter.rate_limiter")

class VCenterRateLimiter:
    def __init__(self):
        # Maps ip_address to semaphore limits to control outbound concurrency
        self._semaphores: Dict[str, asyncio.Semaphore] = {}
        self._lock = asyncio.Lock()

    async def get_semaphore(self, ip_address: str, max_concurrent: int = 4) -> asyncio.Semaphore:
        async with self._lock:
            if ip_address not in self._semaphores:
                self._semaphores[ip_address] = asyncio.Semaphore(max_concurrent)
            return self._semaphores[ip_address]

    async def execute_request(self, ip_address: str, request_func, max_concurrent: int = 4):
        sem = await self.get_semaphore(ip_address, max_concurrent)
        async with sem:
            return await request_func()

# Global Rate Limiter instance
vcenter_rate_limiter = VCenterRateLimiter()
