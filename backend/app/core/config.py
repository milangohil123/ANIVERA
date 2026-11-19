"""Application configuration using Pydantic Settings."""
import os
from typing import List, Optional
from pydantic import field_validator

try:
    from pydantic_settings import BaseSettings, SettingsConfigDict  # type: ignore
except ImportError:  # pragma: no cover
    from pydantic import BaseModel

    class BaseSettings(BaseModel):  # type: ignore
        """Fallback when pydantic-settings is not installed."""
        def __init__(self, **kwargs):
            super().__init__(**kwargs)

    def SettingsConfigDict(**kwargs):  # type: ignore
        return kwargs


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

    PROJECT_NAME: str = os.getenv("PROJECT_NAME", "PashuRakshak Botad")
    VERSION: str = "0.3.1"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = os.getenv("DEBUG", "true").lower() in ("true", "1", "yes")
    API_V1_STR: str = os.getenv("API_V1_STR", "/api/v1")

    # Database Configuration (PostgreSQL 16)
    # Primary connection string format: postgresql+asyncpg://user:password@host:port/dbname
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://postgres:postgres@localhost:5432/pashurakshak_db"
    )
    
    # Connection Pooling Configuration
    DB_POOL_SIZE: int = int(os.getenv("DB_POOL_SIZE", "10"))
    DB_MAX_OVERFLOW: int = int(os.getenv("DB_MAX_OVERFLOW", "20"))
    DB_POOL_TIMEOUT: int = int(os.getenv("DB_POOL_TIMEOUT", "30"))
    DB_POOL_RECYCLE: int = int(os.getenv("DB_POOL_RECYCLE", "1800"))
    DB_POOL_PRE_PING: bool = os.getenv("DB_POOL_PRE_PING", "true").lower() in ("true", "1", "yes")

    @field_validator("DATABASE_URL", mode="after")
    @classmethod
    def assemble_async_db_url(cls, v: str) -> str:
        """Ensure async driver (asyncpg) is specified in DATABASE_URL."""
        if v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        if v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql+asyncpg://", 1)
        return v

    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "insecure-dev-secret-key-change-in-production-09a8f")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
    OFFLINE_AUTH_VALIDITY_DAYS: int = int(os.getenv("OFFLINE_AUTH_VALIDITY_DAYS", "7"))

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:4173",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:4173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

    # Storage paths
    STORAGE_LOCAL_ROOT: str = os.getenv("STORAGE_LOCAL_ROOT", "../storage")
    IMPORT_STORAGE_DIR: str = os.getenv("IMPORT_STORAGE_DIR", "../storage/imports")
    LABEL_STORAGE_DIR: str = os.getenv("LABEL_STORAGE_DIR", "../storage/labels")
    DISEASE_ATTACHMENTS_DIR: str = os.getenv("DISEASE_ATTACHMENTS_DIR", "../storage/attachments")

    # Media & Attachment settings
    MAX_ATTACHMENT_SIZE_BYTES: int = int(os.getenv("MAX_ATTACHMENT_SIZE_BYTES", str(5 * 1024 * 1024)))
    MAX_IMAGE_DIMENSION_PX: int = int(os.getenv("MAX_IMAGE_DIMENSION_PX", "4096"))
    PILLOW_MAX_IMAGE_PIXELS: int = int(os.getenv("PILLOW_MAX_IMAGE_PIXELS", "10000000"))

    # Adapter states
    BHARAT_PASHUDHAN_MODE: str = os.getenv("BHARAT_PASHUDHAN_MODE", "DISABLED")
    SMS_PROVIDER_MODE: str = os.getenv("SMS_PROVIDER_MODE", "SIMULATED")


settings = Settings()
