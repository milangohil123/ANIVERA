"""Local filesystem storage driver implementation."""
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncGenerator, Optional
import anyio


class LocalStorageDriver:
    """Stores files on the local filesystem with date-partitioning and traversal guardrails."""

    def __init__(self, root_dir: str | Path) -> None:
        self.root_path = Path(root_dir).resolve()
        self.root_path.mkdir(parents=True, exist_ok=True)

    def _get_extension(self, mime_type: str) -> str:
        """Map canonical MIME types to safe file extensions."""
        mapping = {
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/webp": ".webp",
            "application/pdf": ".pdf",
            "text/csv": ".csv",
        }
        return mapping.get(mime_type.lower(), ".bin")

    def _resolve_safe_path(self, relative_path: str) -> Path:
        """Ensure the relative path does not escape the storage root directory."""
        # Normalize separators
        clean_rel = relative_path.replace("\\", "/").lstrip("/")
        target_path = (self.root_path / clean_rel).resolve()
        if not str(target_path).startswith(str(self.root_path)):
            raise ValueError(f"Path traversal detected: {relative_path}")
        return target_path

    async def save(
        self,
        data: bytes,
        mime_type: str,
        subfolder: Optional[str] = None
    ) -> str:
        """Save data with date partitioning: {YYYY}/{MM}/{uuid}.{ext}."""
        now = datetime.now(timezone.utc)
        year_str = f"{now.year:04d}"
        month_str = f"{now.month:02d}"
        ext = self._get_extension(mime_type)
        file_id = uuid.uuid4().hex

        if subfolder:
            rel_dir = Path(subfolder.strip("/\\")) / year_str / month_str
        else:
            rel_dir = Path(year_str) / month_str

        full_dir = (self.root_path / rel_dir).resolve()
        await anyio.to_thread.run_sync(lambda: full_dir.mkdir(parents=True, exist_ok=True))

        filename = f"{file_id}{ext}"
        target_file = full_dir / filename
        rel_path = (rel_dir / filename).as_posix()

        async with await anyio.open_file(target_file, "wb") as f:
            await f.write(data)

        return rel_path

    async def read_bytes(self, relative_path: str) -> bytes:
        """Read full file contents from storage."""
        target_file = self._resolve_safe_path(relative_path)
        if not target_file.is_file():
            raise FileNotFoundError(f"Storage object not found: {relative_path}")
        async with await anyio.open_file(target_file, "rb") as f:
            return await f.read()

    async def get_stream(
        self,
        relative_path: str,
        chunk_size: int = 64 * 1024
    ) -> AsyncGenerator[bytes, None]:
        """Stream file in chunks."""
        target_file = self._resolve_safe_path(relative_path)
        if not target_file.is_file():
            raise FileNotFoundError(f"Storage object not found: {relative_path}")
        async with await anyio.open_file(target_file, "rb") as f:
            while True:
                chunk = await f.read(chunk_size)
                if not chunk:
                    break
                yield chunk

    async def delete(self, relative_path: str) -> bool:
        """Safely delete file from storage."""
        try:
            target_file = self._resolve_safe_path(relative_path)
            if target_file.is_file():
                await anyio.to_thread.run_sync(os.unlink, target_file)
                return True
            return False
        except Exception:
            return False

    async def exists(self, relative_path: str) -> bool:
        """Check if file exists on disk."""
        try:
            target_file = self._resolve_safe_path(relative_path)
            return target_file.is_file()
        except Exception:
            return False

