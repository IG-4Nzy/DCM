import time
import asyncio
from typing import Any, Dict, Optional, Callable, Awaitable

class InMemoryTTLCache:
    def __init__(self):
        # Key -> {"value": Any, "expires_at": float, "revalidate_at": float}
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._locks: Dict[str, asyncio.Lock] = {}
        self._global_lock = asyncio.Lock()

    async def get_lock(self, key: str) -> asyncio.Lock:
        async with self._global_lock:
            if key not in self._locks:
                self._locks[key] = asyncio.Lock()
            return self._locks[key]

    async def get(self, key: str) -> Optional[Any]:
        entry = self._cache.get(key)
        if not entry:
            return None
        
        now = time.time()
        if now > entry["expires_at"]:
            # Hard expired
            return None
        return entry["value"]

    async def set(self, key: str, value: Any, ttl: float, revalidate_ttl: float = 0.0) -> None:
        now = time.time()
        self._cache[key] = {
            "value": value,
            "expires_at": now + ttl,
            "revalidate_at": now + ttl + revalidate_ttl
        }

    async def get_or_fetch(
        self, 
        key: str, 
        fetch_func: Callable[[], Awaitable[Any]], 
        ttl: float, 
        revalidate_ttl: float = 0.0
    ) -> Any:
        lock = await self.get_lock(key)
        async with lock:
            entry = self._cache.get(key)
            now = time.time()
            
            # Case 1: Fresh Cache Hit
            if entry and now < entry["expires_at"]:
                return entry["value"]
                
            # Case 2: Stale-While-Revalidate Hit
            if entry and now < entry["revalidate_at"]:
                # Trigger background revalidation fetch asynchronously
                asyncio.create_task(self._revalidate(key, fetch_func, ttl, revalidate_ttl))
                return entry["value"]
                
            # Case 3: Miss or expired revalidation - Sync fetch
            value = await fetch_func()
            await self.set(key, value, ttl, revalidate_ttl)
            return value

    async def _revalidate(
        self, 
        key: str, 
        fetch_func: Callable[[], Awaitable[Any]], 
        ttl: float, 
        revalidate_ttl: float
    ) -> None:
        try:
            value = await fetch_func()
            await self.set(key, value, ttl, revalidate_ttl)
        except Exception as e:
            # Silently log/ignore background revalidation errors to avoid crashing the request
            pass

    async def clear(self) -> None:
        async with self._global_lock:
            self._cache.clear()
            self._locks.clear()

# Global Singleton Cache Instance
global_cache = InMemoryTTLCache()
