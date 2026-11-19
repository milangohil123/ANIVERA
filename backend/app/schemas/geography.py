"""Pydantic schemas for Geography entities."""
import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class DistrictRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    name_gu: str
    name_en: str
    active: bool
    created_at: datetime
    updated_at: datetime


class TalukaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    district_id: uuid.UUID
    code: str
    name_gu: str
    name_en: str


class VillageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    taluka_id: uuid.UUID
    district_id: uuid.UUID
    name_gu: str
    name_en: str
    census_code: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    coord_status: str
    is_pilot: bool
    active: bool
    created_at: datetime
    updated_at: datetime

