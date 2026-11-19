"""Storage driver protocol for vendor-neutral file persistence."""
from typing import AsyncGenerator, Optional, Protocol, runtime_checkable
from pathlib import Path


@runtime_checkable
class StorageDriver(Protocol):
    """Abstract interface for local or cloud object storage."""

    async def save(
        self,
        data: bytes,
        mime_type: str,
        subfolder: Optional[str] = None
    ) -> str:
        """Persist data and return the canonical relative storage path."""
        ...

    async def read_bytes(self, relative_path: str) -> bytes:
        """Read full binary content of the file."""
        ...

    async def get_stream(
        self,
        relative_path: str,
        chunk_size: int = 64 * 1024
    ) -> AsyncGenerator[bytes, None]:
        """Yield asynchronous chunks of the stored file."""
        ...

    async def delete(self, relative_path: str) -> bool:
        """Delete stored file if it exists. Returns True if deleted."""
        ...

    async def exists(self, relative_path: str) -> bool:
        """Check whether the file exists in storage."""
        ...

