"""Pydantic schemas for Animal, Disease and Vaccine Master Data."""
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Species Schemas
# ---------------------------------------------------------------------------
class SpeciesCreate(BaseModel):
    code: str = Field(..., min_length=2, max_length=50, description="Unique uppercase species code (e.g. CATTLE)")
    name_gu: str = Field(..., min_length=1, max_length=100, description="Gujarati name (દા.ત. ગાય)")
    name_en: str = Field(..., min_length=1, max_length=100, description="English name (e.g. Cow / Cattle)")
    name_hi: Optional[str] = Field(None, max_length=100, description="Hindi name (e.g. गाय)")
    description: Optional[str] = Field(None, max_length=500)
    active: bool = True


class SpeciesUpdate(BaseModel):
    name_gu: Optional[str] = Field(None, min_length=1, max_length=100)
    name_en: Optional[str] = Field(None, min_length=1, max_length=100)
    name_hi: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    active: Optional[bool] = None


class SpeciesResponse(BaseModel):
    code: str
    name_gu: str
    name_en: str
    name_hi: Optional[str] = None
    description: Optional[str] = None
    active: bool = True
    archived: bool = False
    usage_count: int = 0

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Disease Schemas
# ---------------------------------------------------------------------------
class DiseaseCreate(BaseModel):
    code: str = Field(..., min_length=2, max_length=50, description="Unique uppercase disease code (e.g. FMD)")
    name_en: str = Field(..., min_length=1, max_length=150, description="English name")
    name_gu: str = Field(..., min_length=1, max_length=150, description="Gujarati name")
    name_hi: Optional[str] = Field(None, max_length=150, description="Hindi name")
    description: Optional[str] = Field(None, max_length=1000)
    applicable_species: List[str] = Field(default_factory=list, description="Array of applicable species codes")
    color: Optional[str] = Field("#EF4444", max_length=20)
    severity: Optional[str] = Field("HIGH", max_length=20)
    active: bool = True


class DiseaseUpdate(BaseModel):
    name_en: Optional[str] = Field(None, min_length=1, max_length=150)
    name_gu: Optional[str] = Field(None, min_length=1, max_length=150)
    name_hi: Optional[str] = Field(None, max_length=150)
    description: Optional[str] = Field(None, max_length=1000)
    applicable_species: Optional[List[str]] = None
    color: Optional[str] = Field(None, max_length=20)
    severity: Optional[str] = Field(None, max_length=20)
    active: Optional[bool] = None


class DiseaseResponse(BaseModel):
    code: str
    name_en: str
    name_gu: str
    name_hi: Optional[str] = None
    description: Optional[str] = None
    applicable_species: List[str] = []
    color: Optional[str] = "#EF4444"
    severity: Optional[str] = "HIGH"
    active: bool = True
    archived: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    vaccines_count: int = 0
    reports_count: int = 0

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Vaccine Schemas
# ---------------------------------------------------------------------------
class VaccineCreate(BaseModel):
    code: str = Field(..., min_length=2, max_length=50, description="Unique vaccine code (e.g. VAC-FMD-01)")
    name_en: str = Field(..., min_length=1, max_length=200, description="English commercial / scientific name")
    name_gu: str = Field(..., min_length=1, max_length=200, description="Gujarati name")
    disease_code: str = Field(..., min_length=2, max_length=50, description="Target disease code")
    applicable_species: List[str] = Field(default_factory=list, description="List of target species codes")
    administration_route: Optional[str] = Field(None, max_length=50, description="e.g. S/C, I/M, Oral")
    standard_dosage: Optional[str] = Field(None, max_length=50, description="e.g. 2 ml, 1 ml")
    schedule_interval: Optional[str] = Field(None, max_length=100, description="e.g. Bi-annual (Every 6 months)")
    verification_status: str = Field("VERIFIED", description="VERIFIED or PENDING_VERIFICATION")
    verified_source: Optional[str] = Field(None, max_length=200, description="e.g. ICAR-IVRI / DAHD Guidelines")
    is_custom_manual: bool = False
    description: Optional[str] = Field(None, max_length=1000)
    active: bool = True


class VaccineUpdate(BaseModel):
    name_en: Optional[str] = Field(None, min_length=1, max_length=200)
    name_gu: Optional[str] = Field(None, min_length=1, max_length=200)
    disease_code: Optional[str] = Field(None, min_length=2, max_length=50)
    applicable_species: Optional[List[str]] = None
    administration_route: Optional[str] = Field(None, max_length=50)
    standard_dosage: Optional[str] = Field(None, max_length=50)
    schedule_interval: Optional[str] = Field(None, max_length=100)
    verification_status: Optional[str] = None
    verified_source: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    active: Optional[bool] = None


class VaccineResponse(BaseModel):
    id: uuid.UUID
    code: str
    name_en: str
    name_gu: str
    disease_code: str
    disease_name_gu: Optional[str] = None
    disease_name_en: Optional[str] = None
    applicable_species: List[str] = []
    administration_route: Optional[str] = None
    standard_dosage: Optional[str] = None
    schedule_interval: Optional[str] = None
    verification_status: str = "VERIFIED"
    verified_source: Optional[str] = None
    is_custom_manual: bool = False
    description: Optional[str] = None
    active: bool = True
    archived: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Mapping and Overview Schemas
# ---------------------------------------------------------------------------
class DiseaseVaccineMappingItem(BaseModel):
    disease_code: str
    disease_name_gu: str
    disease_name_en: str
    color: Optional[str] = "#EF4444"
    severity: Optional[str] = "HIGH"
    applicable_species: List[str] = []
    active: bool = True
    vaccines: List[VaccineResponse] = []


class MasterOverviewResponse(BaseModel):
    total_species: int
    active_species: int
    total_diseases: int
    active_diseases: int
    total_vaccines: int
    verified_vaccines: int
    pending_vaccines: int
