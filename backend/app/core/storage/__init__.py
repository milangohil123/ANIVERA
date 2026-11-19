"""Storage driver factory and exports."""
from pathlib import Path
from typing import Optional
from app.core.config import settings
from app.core.storage.base import StorageDriver
from app.core.storage.local import LocalStorageDriver
from app.core.storage.s3 import S3StorageDriver

_disease_storage_driver: Optional[StorageDriver] = None


def get_disease_attachment_storage() -> StorageDriver:
    """Singleton factory for disease attachment storage."""
    global _disease_storage_driver
    if _disease_storage_driver is None:
        _disease_storage_driver = LocalStorageDriver(settings.DISEASE_ATTACHMENTS_DIR)
    return _disease_storage_driver


__all__ = [
    "StorageDriver",
    "LocalStorageDriver",
    "S3StorageDriver",
    "get_disease_attachment_storage",
]

