"""Pydantic schemas for authentication and login workflows."""
import re
import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class StaffLoginRequest(BaseModel):
    """Staff username/password login request payload."""
    model_config = ConfigDict(extra="forbid")

    username: str = Field(..., min_length=1, max_length=100, description="Staff unique username")
    password: str = Field(..., min_length=1, max_length=256, description="Staff account password")
    device_id: Optional[uuid.UUID] = Field(None, description="Client device identifier")
    device_label: Optional[str] = Field(None, max_length=100, description="Optional client device label")


class FarmerOtpRequest(BaseModel):
    """Farmer mobile OTP request payload."""
    model_config = ConfigDict(extra="forbid")

    mobile_e164: str = Field(
        ...,
        description="Mobile number in E.164 format, e.g. +919876543210"
    )

    @field_validator("mobile_e164")
    @classmethod
    def validate_e164(cls, v: str) -> str:
        pattern = r"^\+[1-9][0-9]{7,14}$"
        if not re.match(pattern, v):
            raise ValueError("Mobile number must be in valid E.164 format (e.g. +919876543210)")
        return v


class FarmerOtpRequestResponse(BaseModel):
    """Neutral confirmation response for farmer OTP requests."""
    model_config = ConfigDict(extra="forbid")

    message: str = Field(
        default="If this mobile number is registered and provisioned, an OTP has been sent.",
        description="Neutral status message preventing phone number enumeration"
    )
    status: str = Field(default="REQUESTED")
    debug_otp: Optional[str] = Field(None, description="Simulated OTP populated in local development only")


class FarmerOtpVerifyRequest(BaseModel):
    """Farmer OTP verification payload."""
    model_config = ConfigDict(extra="forbid")

    mobile_e164: str = Field(..., description="Mobile number in E.164 format")
    otp_code: str = Field(..., min_length=4, max_length=8, description="Received OTP code")
    device_id: Optional[uuid.UUID] = Field(None, description="Client device identifier")
    device_label: Optional[str] = Field(None, max_length=100, description="Optional client device label")

    @field_validator("mobile_e164")
    @classmethod
    def validate_e164(cls, v: str) -> str:
        pattern = r"^\+[1-9][0-9]{7,14}$"
        if not re.match(pattern, v):
            raise ValueError("Mobile number must be in valid E.164 format")
        return v

    @field_validator("otp_code")
    @classmethod
    def validate_otp_numeric(cls, v: str) -> str:
        if not v.isdigit():
            raise ValueError("OTP code must consist only of digits")
        return v


class RefreshTokenRequest(BaseModel):
    """Refresh token request payload."""
    model_config = ConfigDict(extra="forbid")

    refresh_token: str = Field(..., min_length=1, description="Opaque refresh token")


class LogoutRequest(BaseModel):
    """Explicit logout request payload."""
    model_config = ConfigDict(extra="forbid")

    refresh_token: Optional[str] = Field(None, description="Optional refresh token to revoke")


class UserBasic(BaseModel):
    """Basic user profile returned upon authentication."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    username: Optional[str] = None
    mobile_e164: Optional[str] = None
    role: str
    designation: Optional[str] = None
    organisation: Optional[str] = None
    must_change_password: bool


class TokenResponse(BaseModel):
    """Standard JWT authentication response schema."""
    model_config = ConfigDict(extra="forbid")

    access_token: str = Field(..., description="Short-lived JWT access token")
    token_type: str = Field(default="bearer")
    expires_in: int = Field(..., description="Access token expiration period in seconds")
    refresh_token: str = Field(..., description="Rotating refresh token")
    user: UserBasic
    offline_valid_until: datetime = Field(..., description="Offline grant validity timestamp")


class UserProfileResponse(BaseModel):
    """Detailed authenticated user profile schema for GET /auth/me."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    username: Optional[str] = None
    mobile_e164: Optional[str] = None
    role: str
    designation: Optional[str] = None
    organisation: Optional[str] = None
    status: str
    must_change_password: bool
    assigned_villages: List[uuid.UUID] = Field(default_factory=list)
    assigned_districts: List[uuid.UUID] = Field(default_factory=list)
    permissions: List[str] = Field(default_factory=list)
    offline_valid_until: datetime

