"""Master Data API Endpoints (Species, Disease, Vaccine Masters)."""
import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db_session
from app.modules.authentication.models import User
from app.modules.authorization.service import AuthorizationService
from app.modules.master_data.schemas import (
    DiseaseCreate,
    DiseaseResponse,
    DiseaseUpdate,
    DiseaseVaccineMappingItem,
    MasterOverviewResponse,
    SpeciesCreate,
    SpeciesResponse,
    SpeciesUpdate,
    VaccineCreate,
    VaccineResponse,
    VaccineUpdate,
)
from app.modules.master_data.service import MasterDataService

router = APIRouter(prefix="", tags=["Animal & Disease Masters"])


def _extract_ip(request: Request) -> Optional[str]:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def _require_admin(user: User):
    """Ensure user is an administrator or has master configuration permission."""
    if user.role not in ("SYS_ADMIN", "ADMIN", "SUPER_ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="આ માસ્ટર રેકોર્ડનું સંચાલન કરવાની પરવાનગી ફક્ત એડમિનિસ્ટ્રેટર પાસે છે."
        )


# ---------------------------------------------------------------------------
# Overview & Mapping
# ---------------------------------------------------------------------------
@router.get("/overview", response_model=MasterOverviewResponse, summary="Get summary metrics of all master data")
async def get_overview(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
) -> MasterOverviewResponse:
    service = MasterDataService(db)
    return await service.get_master_overview()


@router.get("/mapping", response_model=List[DiseaseVaccineMappingItem], summary="Get disease-to-vaccines hierarchical mapping")
async def get_disease_vaccine_mapping(
    active_only: bool = Query(False, description="Filter only active diseases and vaccines"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
) -> List[DiseaseVaccineMappingItem]:
    service = MasterDataService(db)
    return await service.get_disease_vaccine_mapping(active_only=active_only)


# ---------------------------------------------------------------------------
# Species Endpoints
# ---------------------------------------------------------------------------
@router.get("/species", response_model=List[SpeciesResponse], summary="List animal species")
async def list_species(
    active_only: bool = Query(False, description="Filter only active species"),
    include_archived: bool = Query(False, description="Include archived species"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
) -> List[SpeciesResponse]:
    service = MasterDataService(db)
    return await service.list_species(active_only=active_only, include_archived=include_archived)


@router.get("/species/{code}", response_model=SpeciesResponse, summary="Get species by code")
async def get_species(
    code: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
) -> SpeciesResponse:
    service = MasterDataService(db)
    return await service.get_species(code)


@router.post("/species", response_model=SpeciesResponse, status_code=status.HTTP_201_CREATED, summary="Create animal species")
async def create_species(
    data: SpeciesCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
) -> SpeciesResponse:
    _require_admin(current_user)
    service = MasterDataService(db)
    return await service.create_species(data, current_user.id)


@router.put("/species/{code}", response_model=SpeciesResponse, summary="Update animal species")
async def update_species(
    code: str,
    data: SpeciesUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
) -> SpeciesResponse:
    _require_admin(current_user)
    service = MasterDataService(db)
    return await service.update_species(code, data, current_user.id)


@router.patch("/species/{code}/toggle-active", response_model=SpeciesResponse, summary="Toggle species active status")
async def toggle_species_active(
    code: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
) -> SpeciesResponse:
    _require_admin(current_user)
    service = MasterDataService(db)
    return await service.toggle_species_active(code, current_user.id)


@router.delete("/species/{code}", summary="Delete or archive animal species")
async def delete_species(
    code: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    _require_admin(current_user)
    service = MasterDataService(db)
    return await service.delete_species(code, current_user.id)


# ---------------------------------------------------------------------------
# Disease Endpoints
# ---------------------------------------------------------------------------
@router.get("/diseases", response_model=List[DiseaseResponse], summary="List diseases")
async def list_diseases(
    active_only: bool = Query(False, description="Filter only active diseases"),
    species_code: Optional[str] = Query(None, description="Filter diseases applicable to this species"),
    include_archived: bool = Query(False, description="Include archived diseases"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
) -> List[DiseaseResponse]:
    service = MasterDataService(db)
    return await service.list_diseases(
        active_only=active_only,
        species_code=species_code,
        include_archived=include_archived
    )


@router.get("/diseases/{code}", response_model=DiseaseResponse, summary="Get disease by code")
async def get_disease(
    code: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
) -> DiseaseResponse:
    service = MasterDataService(db)
    return await service.get_disease(code)


@router.post("/diseases", response_model=DiseaseResponse, status_code=status.HTTP_201_CREATED, summary="Create disease master")
async def create_disease(
    data: DiseaseCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
) -> DiseaseResponse:
    _require_admin(current_user)
    service = MasterDataService(db)
    return await service.create_disease(data, current_user.id)


@router.put("/diseases/{code}", response_model=DiseaseResponse, summary="Update disease master")
async def update_disease(
    code: str,
    data: DiseaseUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
) -> DiseaseResponse:
    _require_admin(current_user)
    service = MasterDataService(db)
    return await service.update_disease(code, data, current_user.id)


@router.patch("/diseases/{code}/toggle-active", response_model=DiseaseResponse, summary="Toggle disease active status")
async def toggle_disease_active(
    code: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
) -> DiseaseResponse:
    _require_admin(current_user)
    service = MasterDataService(db)
    return await service.toggle_disease_active(code, current_user.id)


@router.delete("/diseases/{code}", summary="Delete or archive disease master")
async def delete_disease(
    code: str,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    _require_admin(current_user)
    service = MasterDataService(db)
    return await service.delete_disease(code, current_user.id)


# ---------------------------------------------------------------------------
# Vaccine Endpoints
# ---------------------------------------------------------------------------
@router.get("/vaccines", response_model=List[VaccineResponse], summary="List vaccine masters")
async def list_vaccines(
    active_only: bool = Query(False, description="Filter only active vaccines"),
    disease_code: Optional[str] = Query(None, description="Filter by disease code"),
    species_code: Optional[str] = Query(None, description="Filter by species code"),
    verification_status: Optional[str] = Query(None, description="Filter by VERIFIED or PENDING_VERIFICATION"),
    include_archived: bool = Query(False, description="Include archived vaccines"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
) -> List[VaccineResponse]:
    service = MasterDataService(db)
    return await service.list_vaccines(
        active_only=active_only,
        disease_code=disease_code,
        species_code=species_code,
        verification_status=verification_status,
        include_archived=include_archived
    )


@router.get("/vaccines/{vaccine_id}", response_model=VaccineResponse, summary="Get vaccine by ID")
async def get_vaccine(
    vaccine_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
) -> VaccineResponse:
    service = MasterDataService(db)
    return await service.get_vaccine(vaccine_id)


@router.post("/vaccines", response_model=VaccineResponse, status_code=status.HTTP_201_CREATED, summary="Create vaccine master")
async def create_vaccine(
    data: VaccineCreate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
) -> VaccineResponse:
    # If adding custom manual from campaign modal, mark as pending verification unless admin
    if current_user.role not in ("SYS_ADMIN", "ADMIN", "SUPER_ADMIN"):
        data.verification_status = "PENDING_VERIFICATION"
        data.is_custom_manual = True

    service = MasterDataService(db)
    return await service.create_vaccine(data, current_user.id)


@router.put("/vaccines/{vaccine_id}", response_model=VaccineResponse, summary="Update vaccine master")
async def update_vaccine(
    vaccine_id: uuid.UUID,
    data: VaccineUpdate,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
) -> VaccineResponse:
    _require_admin(current_user)
    service = MasterDataService(db)
    return await service.update_vaccine(vaccine_id, data, current_user.id)


@router.patch("/vaccines/{vaccine_id}/toggle-active", response_model=VaccineResponse, summary="Toggle vaccine active status")
async def toggle_vaccine_active(
    vaccine_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
) -> VaccineResponse:
    _require_admin(current_user)
    service = MasterDataService(db)
    return await service.toggle_vaccine_active(vaccine_id, current_user.id)


@router.patch("/vaccines/{vaccine_id}/verify", response_model=VaccineResponse, summary="Verify or update veterinary verification status")
async def set_vaccine_verification(
    vaccine_id: uuid.UUID,
    verification_status: str = Query("VERIFIED", description="VERIFIED or PENDING_VERIFICATION"),
    verified_source: Optional[str] = Query(None, description="e.g. DAHD Guidelines / ICAR Formulary"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
) -> VaccineResponse:
    _require_admin(current_user)
    service = MasterDataService(db)
    return await service.set_vaccine_verification(
        vaccine_id=vaccine_id,
        verification_status=verification_status,
        verified_source=verified_source,
        actor_id=current_user.id
    )


@router.delete("/vaccines/{vaccine_id}", summary="Archive vaccine master")
async def delete_vaccine(
    vaccine_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    _require_admin(current_user)
    service = MasterDataService(db)
    return await service.delete_vaccine(vaccine_id, current_user.id)
