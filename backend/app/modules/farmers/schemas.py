"""Pydantic v2 schemas for Farmer domain."""
import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class FarmerCreate(BaseModel):
    """Payload to register a new livestock farmer."""
    full_name: str = Field(..., min_length=2, max_length=200, description="Farmer full name")
    village_id: uuid.UUID = Field(..., description="Village where the farmer resides")
    mobile_e164: Optional[str] = Field(
        None,
        pattern=r"^\+[1-9][0-9]{7,14}$",
        description="E.164 phone number"
    )
    mobile_shared: bool = Field(False, description="Whether the phone number is shared across family")
    has_smartphone: str = Field("UNKNOWN", pattern="^(UNKNOWN|YES|NO)$")
    address_text: Optional[str] = Field(None, max_length=500)
    registration_path: str = Field(
        "STAFF_ASSISTED",
        pattern="^(STAFF_ASSISTED|IMPORT|COOPERATIVE_ASSISTED)$",
        description="Registration channel"
    )
    data_consent: bool = Field(True, description="Farmer consent for registration and data processing")
    outreach_consent: str = Field("UNKNOWN", pattern="^(UNKNOWN|GRANTED|WITHDRAWN)$")
    consent_basis: Optional[str] = Field(None, max_length=200)


class FarmerUpdate(BaseModel):
    """Payload to update an existing farmer profile."""
    full_name: Optional[str] = Field(None, min_length=2, max_length=200)
    mobile_e164: Optional[str] = Field(None, pattern=r"^\+[1-9][0-9]{7,14}$")
    mobile_shared: Optional[bool] = None
    has_smartphone: Optional[str] = Field(None, pattern="^(UNKNOWN|YES|NO)$")
    address_text: Optional[str] = Field(None, max_length=500)
    outreach_consent: Optional[str] = Field(None, pattern="^(UNKNOWN|GRANTED|WITHDRAWN)$")
    consent_basis: Optional[str] = Field(None, max_length=200)
    active: Optional[bool] = None
    inactive_reason: Optional[str] = Field(None, max_length=500)


class FarmerResponse(BaseModel):
    """Summary farmer response schema."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    farmer_code: Optional[str]
    full_name: str
    name_norm: str
    mobile_e164: Optional[str]
    mobile_status: str
    mobile_shared: bool
    has_smartphone: str
    village_id: uuid.UUID
    address_text: Optional[str]
    registration_status: str
    registration_path: str
    active: bool
    created_at: datetime
    updated_at: datetime


class FarmerDetailResponse(FarmerResponse):
    """Comprehensive farmer response with verification and linked account info."""
    registered_by: Optional[uuid.UUID] = None
    data_consent_at: Optional[datetime] = None
    outreach_consent: str = "UNKNOWN"
    verified_by: Optional[uuid.UUID] = None
    verified_at: Optional[datetime] = None
    owned_animals_count: int = 0
    has_login_account: bool = False
    login_user_id: Optional[uuid.UUID] = None


class FarmerAccountProvisionRequest(BaseModel):
    """Payload to provision a login user account for an existing farmer profile."""
    username: Optional[str] = Field(None, min_length=3, max_length=50, description="Optional custom login username")
    password: Optional[str] = Field(None, min_length=8, description="Initial password if non-OTP login is used")


class FarmerAccountProvisionResponse(BaseModel):
    """Response returned upon provisioning a farmer login account."""
    model_config = ConfigDict(from_attributes=True)

    user_id: uuid.UUID
    farmer_id: uuid.UUID
    username: Optional[str]
    mobile_e164: Optional[str]
    activation_status: str
    provisioned_at: datetime


class FarmerVerificationRequest(BaseModel):
    """Payload to record a formal farmer verification."""
    method: str = Field("STAFF_IN_PERSON", pattern="^(OTP|STAFF_IN_PERSON|DEPARTMENT_APPROVED_METHOD)$")
    notes: Optional[str] = Field(None, max_length=500)


class FarmerVerificationResponse(BaseModel):
    """Response returned upon recording a farmer verification."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    farmer_id: uuid.UUID
    method: str
    outcome: str
    verified_by: Optional[uuid.UUID]
    notes: Optional[str]
    at: datetime

