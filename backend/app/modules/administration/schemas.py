"""Pydantic schemas for Administrative Management APIs."""
import re
import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


# ==============================================================================
# 1. District Schemas
# ==============================================================================
class DistrictCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str = Field(..., min_length=2, max_length=20, description="Unique uppercase district code, e.g. BOTAD")
    name_gu: str = Field(..., min_length=1, max_length=100, description="Gujarati district name")
    name_en: str = Field(..., min_length=1, max_length=100, description="English district name")
    active: bool = Field(default=True)

    @field_validator("code")
    @classmethod
    def uppercase_code(cls, v: str) -> str:
        return v.strip().upper()


class DistrictUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name_gu: Optional[str] = Field(None, min_length=1, max_length=100)
    name_en: Optional[str] = Field(None, min_length=1, max_length=100)
    active: Optional[bool] = None


class DistrictResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    name_gu: str
    name_en: str
    active: bool
    created_at: datetime
    updated_at: datetime


class DistrictSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    name_en: str
    name_gu: str
    active: bool
    taluka_count: int
    village_count: int
    gram_panchayat_count: int
    cooperative_count: int
    vo_count: int
    fw_count: int
    total_animals: int = 0
    total_farmers: int = 0
    total_vaccinations: int = 0
    pending_vaccinations: int = 0
    active_disease_reports: int = 0


# ==============================================================================
# 2. Taluka Schemas
# ==============================================================================
class TalukaCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    district_id: uuid.UUID
    code: str = Field(..., min_length=2, max_length=30)
    name_gu: str = Field(..., min_length=1, max_length=100)
    name_en: str = Field(..., min_length=1, max_length=100)

    @field_validator("code")
    @classmethod
    def clean_code(cls, v: str) -> str:
        return v.strip().upper()


class TalukaUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name_gu: Optional[str] = Field(None, min_length=1, max_length=100)
    name_en: Optional[str] = Field(None, min_length=1, max_length=100)


class TalukaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    district_id: uuid.UUID
    code: str
    name_gu: str
    name_en: str


# ==============================================================================
# 3. Village Schemas
# ==============================================================================
class VillageCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    district_id: uuid.UUID
    taluka_id: uuid.UUID
    code: str = Field(..., min_length=2, max_length=30)
    name_gu: str = Field(..., min_length=1, max_length=100)
    name_en: str = Field(..., min_length=1, max_length=100)
    census_code: Optional[str] = Field(None, max_length=50)
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    is_pilot: bool = Field(default=False)
    active: bool = Field(default=True)
    google_place_id: Optional[str] = Field(None, max_length=255)
    formatted_address: Optional[str] = Field(None, max_length=500)
    location_source: Optional[str] = Field(None, max_length=50)

    @field_validator("code")
    @classmethod
    def clean_code(cls, v: str) -> str:
        return v.strip().upper()


class VillageUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name_gu: Optional[str] = Field(None, min_length=1, max_length=100)
    name_en: Optional[str] = Field(None, min_length=1, max_length=100)
    census_code: Optional[str] = Field(None, max_length=50)
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    is_pilot: Optional[bool] = None
    active: Optional[bool] = None
    google_place_id: Optional[str] = Field(None, max_length=255)
    formatted_address: Optional[str] = Field(None, max_length=500)
    location_source: Optional[str] = Field(None, max_length=50)


class VillageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    district_id: uuid.UUID
    taluka_id: uuid.UUID
    code: str
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
    google_place_id: Optional[str] = None
    formatted_address: Optional[str] = None
    location_source: Optional[str] = None


# ==============================================================================
# 4. Gram Panchayat Schemas
# ==============================================================================
class GramPanchayatCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    taluka_id: uuid.UUID
    code: str = Field(..., min_length=2, max_length=30)
    name_gu: str = Field(..., min_length=1, max_length=100)
    name_en: str = Field(..., min_length=1, max_length=100)
    active: bool = Field(default=True)

    @field_validator("code")
    @classmethod
    def clean_code(cls, v: str) -> str:
        return v.strip().upper()


class GramPanchayatUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name_gu: Optional[str] = Field(None, min_length=1, max_length=100)
    name_en: Optional[str] = Field(None, min_length=1, max_length=100)
    active: Optional[bool] = None


class GramPanchayatResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    taluka_id: uuid.UUID
    code: str
    name_gu: str
    name_en: str
    active: bool
    created_at: datetime
    updated_at: datetime
    associated_village_ids: List[uuid.UUID] = Field(default_factory=list)


class GPVillageMapRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    village_id: uuid.UUID


class GPVillageMappingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    gram_panchayat_id: uuid.UUID
    village_id: uuid.UUID
    mapped_at: datetime
    ended_at: Optional[datetime] = None


# ==============================================================================
# 5. Cooperative Schemas
# ==============================================================================
class CooperativeCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str = Field(..., min_length=2, max_length=30)
    name_gu: str = Field(..., min_length=1, max_length=150)
    name_en: str = Field(..., min_length=1, max_length=150)
    org_type: str = Field(default="DAIRY_COOPERATIVE")
    status: str = Field(default="ACTIVE")

    @field_validator("code")
    @classmethod
    def clean_code(cls, v: str) -> str:
        return v.strip().upper()

    @field_validator("org_type")
    @classmethod
    def validate_org_type(cls, v: str) -> str:
        if v not in ("DAIRY_COOPERATIVE", "MILK_UNION", "OTHER"):
            raise ValueError("org_type must be DAIRY_COOPERATIVE, MILK_UNION, or OTHER")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in ("ACTIVE", "INACTIVE"):
            raise ValueError("status must be ACTIVE or INACTIVE")
        return v


class CooperativeUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name_gu: Optional[str] = Field(None, min_length=1, max_length=150)
    name_en: Optional[str] = Field(None, min_length=1, max_length=150)
    org_type: Optional[str] = None
    status: Optional[str] = None


class CooperativeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    name_gu: str
    name_en: str
    org_type: str
    status: str
    created_at: datetime
    served_village_ids: List[uuid.UUID] = Field(default_factory=list)


class CooperativeVillageMapRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    village_id: uuid.UUID


class CooperativeStaffAssignRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: uuid.UUID
    coop_role: str = Field(..., description="COORDINATOR, ADMIN, or VACCINATOR")

    @field_validator("coop_role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in ("COORDINATOR", "ADMIN", "VACCINATOR"):
            raise ValueError("coop_role must be COORDINATOR, ADMIN, or VACCINATOR")
        return v


class CooperativeStaffAssignmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    cooperative_id: uuid.UUID
    user_id: uuid.UUID
    coop_role: str
    assigned_at: datetime
    ended_at: Optional[datetime] = None


# ==============================================================================
# 6. Veterinary Officer & Field Worker Schemas
# ==============================================================================
class VeterinaryOfficerCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_name: str = Field(..., min_length=2, max_length=150)
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8, max_length=128)
    mobile_e164: Optional[str] = Field(None)
    designation: Optional[str] = Field(None, max_length=100)
    office_name: Optional[str] = Field(None, max_length=150)
    employee_ref: Optional[str] = Field(None, max_length=50)

    @field_validator("mobile_e164")
    @classmethod
    def validate_mobile(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not re.match(r"^\+[1-9][0-9]{7,14}$", v):
            raise ValueError("Mobile must be in valid E.164 format (e.g. +919876543210)")
        return v


class VeterinaryOfficerUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_name: Optional[str] = Field(None, min_length=2, max_length=150)
    designation: Optional[str] = Field(None, max_length=100)
    office_name: Optional[str] = Field(None, max_length=150)
    contact_mobile: Optional[str] = Field(None)

    @field_validator("contact_mobile")
    @classmethod
    def validate_mobile(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not re.match(r"^\+[1-9][0-9]{7,14}$", v):
            raise ValueError("Mobile must be in valid E.164 format")
        return v


class VeterinaryOfficerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    username: Optional[str] = None
    mobile_e164: Optional[str] = None
    designation: Optional[str] = None
    office_name: Optional[str] = None
    employee_ref: Optional[str] = None
    status: str
    assigned_village_ids: List[uuid.UUID] = Field(default_factory=list)
    created_at: datetime


class FieldWorkerCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_name: str = Field(..., min_length=2, max_length=150)
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8, max_length=128)
    mobile_e164: Optional[str] = Field(None)
    designation: Optional[str] = Field(None, max_length=100)
    organisation: Optional[str] = Field(None, max_length=150)

    @field_validator("mobile_e164")
    @classmethod
    def validate_mobile(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not re.match(r"^\+[1-9][0-9]{7,14}$", v):
            raise ValueError("Mobile must be in valid E.164 format")
        return v


class FieldWorkerUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_name: Optional[str] = Field(None, min_length=2, max_length=150)
    mobile_e164: Optional[str] = Field(None)
    designation: Optional[str] = Field(None, max_length=100)
    organisation: Optional[str] = Field(None, max_length=150)


class FieldWorkerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    username: Optional[str] = None
    mobile_e164: Optional[str] = None
    designation: Optional[str] = None
    organisation: Optional[str] = None
    status: str
    assigned_village_ids: List[uuid.UUID] = Field(default_factory=list)
    created_at: datetime


class StaffStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str = Field(..., description="ACTIVE, INACTIVE, or LOCKED")
    reason: Optional[str] = Field(None, max_length=255)

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in ("ACTIVE", "INACTIVE", "LOCKED"):
            raise ValueError("status must be ACTIVE, INACTIVE, or LOCKED")
        return v


# ==============================================================================
# 7. Assignment Schemas
# ==============================================================================
class UserVillageAssignRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: uuid.UUID
    village_id: uuid.UUID


class UserVillageAssignResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    village_id: uuid.UUID
    assigned_at: datetime
    ended_at: Optional[datetime] = None


class UserVillageBulkAssignRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: uuid.UUID
    village_ids: List[uuid.UUID]


class UserVillageBulkAssignResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: uuid.UUID
    assigned_count: int
    assigned_village_ids: List[uuid.UUID]
    message: str


class DahoDistrictAssignRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    daho_user_id: uuid.UUID
    district_id: uuid.UUID


class DahoDistrictAssignResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    daho_user_id: uuid.UUID
    district_id: uuid.UUID
    assigned_at: datetime
    ended_at: Optional[datetime] = None

