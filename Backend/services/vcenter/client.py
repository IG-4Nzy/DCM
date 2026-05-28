import httpx
import warnings
from typing import Optional

# Suppress SSL warnings for self-signed vCenter certificates
warnings.filterwarnings("ignore", message="Unverified HTTPS request")

class HTTPXClientSingleton:
    _instance: Optional['HTTPXClientSingleton'] = None
    _client: Optional[httpx.AsyncClient] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(HTTPXClientSingleton, cls).__new__(cls)
        return cls._instance

    def get_client(self, verify_ssl: bool = False) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            # Configure pooling, timeouts, HTTP/2 and retries
            limits = httpx.Limits(
                max_keepalive_connections=50,
                max_connections=200,
                keepalive_expiry=30.0
            )
            timeout = httpx.Timeout(
                timeout=15.0,
                connect=3.0,
                read=12.0
            )
            # Create a reusable HTTPX AsyncClient with HTTP/2 support enabled
            self._client = httpx.AsyncClient(
                verify=verify_ssl,
                limits=limits,
                timeout=timeout,
                http2=True,
                follow_redirects=True
            )
        return self._client

    async def close_client(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

# Global instance of the HTTPX Singleton
vcenter_http_client = HTTPXClientSingleton()
