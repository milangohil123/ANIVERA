"""Pydantic schemas for Reference entities."""
import uuid
from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict


class SpeciesRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    code: str
    name_gu: str
    name_en: str


class BreedRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    species_code: str
    name_gu: str
    name_en: str


class ProgrammeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    code: str
    name_en: str
    name_gu: Optional[str] = None
    active: bool


class SystemSettingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    key: str
    value: Dict[str, Any]
    updated_by: Optional[uuid.UUID] = None
    updated_at: datetime

