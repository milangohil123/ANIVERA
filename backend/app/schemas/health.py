"""Pydantic schemas for service and database health checks."""
from pydantic import BaseModel, ConfigDict, Field


class HealthResponse(BaseModel):
    """Health check response schema."""
    model_config = ConfigDict(extra="forbid")

    status: str = Field(..., description="Overall application status ('healthy' or 'unhealthy')")
    database: str = Field(..., description="Database connectivity status ('connected' or 'disconnected')")

