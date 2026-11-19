"""S3-compatible object storage driver implementation (optional future driver)."""
from typing import AsyncGenerator, Optional
from app.core.storage.base import StorageDriver


class S3StorageDriver:
    """Vendor-neutral S3-compatible driver for MinIO/Ceph/AWS S3.
    
    Disabled by default; activated only when S3 credentials and endpoint are configured.
    """

    def __init__(
        self,
        endpoint_url: Optional[str] = None,
        bucket_name: Optional[str] = None,
        access_key: Optional[str] = None,
        secret_key: Optional[str] = None,
        region: str = "us-east-1"
    ) -> None:
        self.endpoint_url = endpoint_url
        self.bucket_name = bucket_name or "pashurakshak-media"
        self.access_key = access_key
        self.secret_key = secret_key
        self.region = region

    async def save(
        self,
        data: bytes,
        mime_type: str,
        subfolder: Optional[str] = None
    ) -> str:
        raise NotImplementedError(
            "S3StorageDriver requires configured S3/MinIO service. Use LocalStorageDriver for development."
        )

    async def read_bytes(self, relative_path: str) -> bytes:
        raise NotImplementedError("S3StorageDriver not configured.")

    async def get_stream(
        self,
        relative_path: str,
        chunk_size: int = 64 * 1024
    ) -> AsyncGenerator[bytes, None]:
        raise NotImplementedError("S3StorageDriver not configured.")
        yield b""  # pragma: no cover

    async def delete(self, relative_path: str) -> bool:
        raise NotImplementedError("S3StorageDriver not configured.")

    async def exists(self, relative_path: str) -> bool:
        raise NotImplementedError("S3StorageDriver not configured.")

