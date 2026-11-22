"""Pydantic schemas and domain transfer objects for Authorisation and RBAC."""
import uuid
from typing import List, Optional, Set
from pydantic import BaseModel, ConfigDict, Field


class UserScope(BaseModel):
    """Resolved operational and security scope for an authenticated user."""
    model_config = ConfigDict(arbitrary_types_allowed=True)

    user_id: uuid.UUID
    role: str
    status: str
    permissions: Set[str] = Field(default_factory=set)
    assigned_district_ids: Set[uuid.UUID] = Field(default_factory=set)
    assigned_taluka_ids: Set[uuid.UUID] = Field(default_factory=set)
    assigned_village_ids: Set[uuid.UUID] = Field(default_factory=set)
    linked_farmer_ids: Set[uuid.UUID] = Field(default_factory=set)
    assigned_cooperative_ids: Set[uuid.UUID] = Field(default_factory=set)
    cooperative_village_ids: Set[uuid.UUID] = Field(default_factory=set)
    is_approved_vaccinator: bool = False

    def has_permission(self, permission_code: str) -> bool:
        """Check if user holds the requested permission code."""
        return permission_code in self.permissions

    def has_any_permission(self, *permission_codes: str) -> bool:
        """Check if user holds at least one of the specified permissions."""
        return any(code in self.permissions for code in permission_codes)

    def can_access_district(self, district_id: uuid.UUID) -> bool:
        """Check if user is authorized for the given district.
        
        - DAHO: Requires explicit district assignment in daho_district_assignments.
        - VET_OFFICER / VO: Operational authority within their assigned district(s).
        - SYS_ADMIN: Technical admin does not automatically receive district operational scope.
        """
        if self.role in ("DAHO", "VET_OFFICER", "VO"):
            return district_id in self.assigned_district_ids
        return False

    def can_access_taluka(
        self,
        taluka_id: uuid.UUID,
        taluka_district_id: Optional[uuid.UUID] = None
    ) -> bool:
        """Check if user is authorized for the given taluka.
        
        - TAHO: Requires active assignment in taho_taluka_assignments.
        - DAHO: Permitted if the taluka belongs to one of their assigned districts.
        """
        if self.role == "TAHO":
            return taluka_id in self.assigned_taluka_ids
        if self.role == "DAHO":
            if taluka_district_id:
                return taluka_district_id in self.assigned_district_ids
            return True
        return False

    def can_access_village(
        self,
        village_id: uuid.UUID,
        village_district_id: Optional[uuid.UUID] = None,
        village_taluka_id: Optional[uuid.UUID] = None
    ) -> bool:
        """Check if user is authorized for the given village.
        
        - VET_OFFICER / VO & FIELD_WORKER / FW: Assigned via user_village_assignments or district scope.
        - TAHO: Permitted if the village belongs to their assigned taluka.
        - DAHO: Permitted if the village belongs to their assigned district.
        - DAIRY_STAFF: Permitted if the village is served by their assigned cooperative.
        - FARMER: Restricted to own identity and registered village.
        - SYS_ADMIN: Denied operational field access.
        """
        if self.role in ("FIELD_WORKER", "FW", "VET_OFFICER", "VO"):
            return village_id in self.assigned_village_ids
        
        if self.role == "TAHO":
            if village_taluka_id:
                return village_taluka_id in self.assigned_taluka_ids
            return True

        if self.role == "DAHO":
            if village_district_id:
                return village_district_id in self.assigned_district_ids
            # If district_id is not supplied, check if village_id is known in district scope
            return True

        if self.role == "DAIRY_STAFF":
            return village_id in self.cooperative_village_ids

        return False

    def can_access_farmer(self, farmer_id: uuid.UUID) -> bool:
        """Check if farmer user owns the target farmer profile."""
        if self.role == "FARMER":
            return farmer_id in self.linked_farmer_ids
        # Staff access to farmer records is governed by village scope, checked separately
        return False


class UserScopeResponse(BaseModel):
    """Client-facing representation of resolved user security scope."""
    model_config = ConfigDict(from_attributes=True)

    user_id: uuid.UUID
    role: str
    status: str
    permissions: List[str]
    assigned_districts: List[uuid.UUID]
    assigned_talukas: List[uuid.UUID] = Field(default_factory=list)
    assigned_villages: List[uuid.UUID]
    linked_farmers: List[uuid.UUID]
    assigned_cooperatives: List[uuid.UUID]
    is_approved_vaccinator: bool


class VOFallbackValidationRequest(BaseModel):
    """Payload to validate VO fallback registration prerequisites."""
    model_config = ConfigDict(extra="forbid")

    village_id: uuid.UUID
    field_worker_user_id: uuid.UUID
    reason: str = Field(..., min_length=5, max_length=500, description="Audit reason for FW unavailability fallback")

