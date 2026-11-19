"""FastAPI RESTful endpoints for Administrative Management module."""
import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db_session
from app.modules.authentication.models import User
from app.modules.administration.schemas import (
    CooperativeCreate,
    CooperativeResponse,
    CooperativeStaffAssignRequest,
    CooperativeStaffAssignmentResponse,
    CooperativeUpdate,
    CooperativeVillageMapRequest,
    DahoDistrictAssignRequest,
    DahoDistrictAssignResponse,
    DistrictCreate,
    DistrictResponse,
    DistrictSummaryResponse,
    DistrictUpdate,
    FieldWorkerCreate,
    FieldWorkerResponse,
    FieldWorkerUpdate,
    GPVillageMapRequest,
    GPVillageMappingResponse,
    GramPanchayatCreate,
    GramPanchayatResponse,
    GramPanchayatUpdate,
    StaffStatusUpdate,
    TalukaCreate,
    TalukaResponse,
    TalukaUpdate,
    UserVillageAssignRequest,
    UserVillageAssignResponse,
    UserVillageBulkAssignRequest,
    UserVillageBulkAssignResponse,
    VeterinaryOfficerCreate,
    VeterinaryOfficerResponse,
    VeterinaryOfficerUpdate,
    VillageCreate,
    VillageResponse,
    VillageUpdate,
)
from app.modules.administration.service import AdministrationService
from app.modules.administration.super_admin_service import SuperAdminService
from app.modules.administration.super_admin_schemas import (
    AssignmentActionResponse,
    CustomJurisdictionCreateRequest,
    CustomJurisdictionResponse,
    DahoAccountCreateRequest,
    DahoAccountResponse,
    DistrictHierarchyResponse,
    DistrictReassignRequest,
    DistrictReleaseRequest,
    GeodataCommitRequest,
    GeodataImportResult,
    GeodataValidationReport,
    SuperAdminOverviewResponse,
    GeographicQualityAuditResponse,
)

router = APIRouter(prefix="", tags=["Administrative Management"])


def _extract_ip(request: Request) -> Optional[str]:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


# ==============================================================================
# 1. District Endpoints
# ==============================================================================
@router.get("/districts", response_model=List[DistrictResponse], summary="List districts in caller scope")
async def list_districts(
    active_only: bool = Query(False),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> List[DistrictResponse]:
    service = AdministrationService(db)
    return await service.list_districts(current_user, active_only, offset, limit)


@router.get("/districts/{district_id}", response_model=DistrictResponse, summary="Get district details")
async def get_district(
    district_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> DistrictResponse:
    service = AdministrationService(db)
    return await service.get_district(district_id, current_user)


@router.post("/districts", response_model=DistrictResponse, status_code=status.HTTP_201_CREATED, summary="Create a district")
async def create_district(
    payload: DistrictCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> DistrictResponse:
    service = AdministrationService(db)
    return await service.create_district(payload, current_user, _extract_ip(request))


@router.put("/districts/{district_id}", response_model=DistrictResponse, summary="Update district information")
async def update_district(
    district_id: uuid.UUID,
    payload: DistrictUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> DistrictResponse:
    service = AdministrationService(db)
    return await service.update_district(district_id, payload, current_user, _extract_ip(request))


@router.get("/districts/{district_id}/summary", response_model=DistrictSummaryResponse, summary="Get district administrative summary")
async def get_district_summary(
    district_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> DistrictSummaryResponse:
    service = AdministrationService(db)
    return await service.get_district_summary(district_id, current_user)


# ==============================================================================
# 2. Taluka Endpoints
# ==============================================================================
@router.get("/talukas", response_model=List[TalukaResponse], summary="List talukas")
async def list_talukas(
    district_id: Optional[uuid.UUID] = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> List[TalukaResponse]:
    service = AdministrationService(db)
    return await service.list_talukas(district_id, current_user, offset, limit)


@router.get("/talukas/{taluka_id}", response_model=TalukaResponse, summary="Get taluka details")
async def get_taluka(
    taluka_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> TalukaResponse:
    service = AdministrationService(db)
    return await service.get_taluka(taluka_id, current_user)


@router.post("/talukas", response_model=TalukaResponse, status_code=status.HTTP_201_CREATED, summary="Create taluka")
async def create_taluka(
    payload: TalukaCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> TalukaResponse:
    service = AdministrationService(db)
    return await service.create_taluka(payload, current_user, _extract_ip(request))


@router.put("/talukas/{taluka_id}", response_model=TalukaResponse, summary="Update taluka")
async def update_taluka(
    taluka_id: uuid.UUID,
    payload: TalukaUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> TalukaResponse:
    service = AdministrationService(db)
    return await service.update_taluka(taluka_id, payload, current_user, _extract_ip(request))


# ==============================================================================
# 3. Village Endpoints
# ==============================================================================
@router.get("/villages", response_model=List[VillageResponse], summary="List villages in caller scope")
async def list_villages(
    district_id: Optional[uuid.UUID] = Query(None),
    taluka_id: Optional[uuid.UUID] = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> List[VillageResponse]:
    service = AdministrationService(db)
    return await service.list_villages(district_id, taluka_id, current_user, offset, limit)


@router.get("/villages/{village_id}", response_model=VillageResponse, summary="Get village details")
async def get_village(
    village_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> VillageResponse:
    service = AdministrationService(db)
    return await service.get_village(village_id, current_user)


@router.post("/villages", response_model=VillageResponse, status_code=status.HTTP_201_CREATED, summary="Create village")
async def create_village(
    payload: VillageCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> VillageResponse:
    service = AdministrationService(db)
    return await service.create_village(payload, current_user, _extract_ip(request))


@router.put("/villages/{village_id}", response_model=VillageResponse, summary="Update village information")
async def update_village(
    village_id: uuid.UUID,
    payload: VillageUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> VillageResponse:
    service = AdministrationService(db)
    return await service.update_village(village_id, payload, current_user, _extract_ip(request))


# ==============================================================================
# 4. Gram Panchayat Endpoints
# ==============================================================================
@router.get("/gram-panchayats", response_model=List[GramPanchayatResponse], summary="List Gram Panchayats")
async def list_gram_panchayats(
    district_id: Optional[uuid.UUID] = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> List[GramPanchayatResponse]:
    service = AdministrationService(db)
    return await service.list_gram_panchayats(current_user, district_id, offset, limit)


@router.get("/gram-panchayats/{gp_id}", response_model=GramPanchayatResponse, summary="Get Gram Panchayat details")
async def get_gram_panchayat(
    gp_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> GramPanchayatResponse:
    service = AdministrationService(db)
    return await service.get_gram_panchayat(gp_id, current_user)


@router.post("/gram-panchayats", response_model=GramPanchayatResponse, status_code=status.HTTP_201_CREATED, summary="Create Gram Panchayat")
async def create_gram_panchayat(
    payload: GramPanchayatCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> GramPanchayatResponse:
    service = AdministrationService(db)
    return await service.create_gram_panchayat(payload, current_user, _extract_ip(request))


@router.put("/gram-panchayats/{gp_id}", response_model=GramPanchayatResponse, summary="Update Gram Panchayat")
async def update_gram_panchayat(
    gp_id: uuid.UUID,
    payload: GramPanchayatUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> GramPanchayatResponse:
    service = AdministrationService(db)
    return await service.update_gram_panchayat(gp_id, payload, current_user, _extract_ip(request))


@router.post("/gram-panchayats/{gp_id}/villages", response_model=GPVillageMappingResponse, status_code=status.HTTP_201_CREATED, summary="Map village to Gram Panchayat")
async def map_gp_village(
    gp_id: uuid.UUID,
    payload: GPVillageMapRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> GPVillageMappingResponse:
    service = AdministrationService(db)
    return await service.map_gp_village(gp_id, payload.village_id, current_user, _extract_ip(request))


# ==============================================================================
# 5. Cooperative Endpoints
# ==============================================================================
@router.get("/cooperatives", response_model=List[CooperativeResponse], summary="List cooperatives in scope")
async def list_cooperatives(
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> List[CooperativeResponse]:
    service = AdministrationService(db)
    return await service.list_cooperatives(current_user, offset, limit)


@router.get("/cooperatives/{coop_id}", response_model=CooperativeResponse, summary="Get cooperative details")
async def get_cooperative(
    coop_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> CooperativeResponse:
    service = AdministrationService(db)
    return await service.get_cooperative(coop_id, current_user)


@router.post("/cooperatives", response_model=CooperativeResponse, status_code=status.HTTP_201_CREATED, summary="Create dairy cooperative")
async def create_cooperative(
    payload: CooperativeCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> CooperativeResponse:
    service = AdministrationService(db)
    return await service.create_cooperative(payload, current_user, _extract_ip(request))


@router.put("/cooperatives/{coop_id}", response_model=CooperativeResponse, summary="Update cooperative")
async def update_cooperative(
    coop_id: uuid.UUID,
    payload: CooperativeUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> CooperativeResponse:
    service = AdministrationService(db)
    return await service.update_cooperative(coop_id, payload, current_user, _extract_ip(request))


@router.post("/cooperatives/{coop_id}/villages", status_code=status.HTTP_201_CREATED, summary="Map village to cooperative")
async def map_cooperative_village(
    coop_id: uuid.UUID,
    payload: CooperativeVillageMapRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, str]:
    service = AdministrationService(db)
    return await service.map_cooperative_village(coop_id, payload.village_id, current_user, _extract_ip(request))


@router.post("/cooperatives/{coop_id}/staff", response_model=CooperativeStaffAssignmentResponse, status_code=status.HTTP_201_CREATED, summary="Assign staff to cooperative")
async def assign_cooperative_staff(
    coop_id: uuid.UUID,
    payload: CooperativeStaffAssignRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> CooperativeStaffAssignmentResponse:
    service = AdministrationService(db)
    return await service.assign_cooperative_staff(coop_id, payload.user_id, payload.coop_role, current_user, _extract_ip(request))


# ==============================================================================
# 6. Veterinary Officer Endpoints
# ==============================================================================
@router.get("/veterinary-officers", response_model=List[VeterinaryOfficerResponse], summary="List Veterinary Officers")
async def list_veterinary_officers(
    district_id: Optional[uuid.UUID] = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> List[VeterinaryOfficerResponse]:
    service = AdministrationService(db)
    return await service.list_veterinary_officers(current_user, district_id, offset, limit)


@router.get("/veterinary-officers/{vo_user_id}", response_model=VeterinaryOfficerResponse, summary="Get Veterinary Officer profile")
async def get_veterinary_officer(
    vo_user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> VeterinaryOfficerResponse:
    service = AdministrationService(db)
    return await service.get_veterinary_officer(vo_user_id, current_user)


@router.post("/veterinary-officers", response_model=VeterinaryOfficerResponse, status_code=status.HTTP_201_CREATED, summary="Provision a Veterinary Officer account")
async def create_veterinary_officer(
    payload: VeterinaryOfficerCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> VeterinaryOfficerResponse:
    service = AdministrationService(db)
    return await service.create_veterinary_officer(payload, current_user, _extract_ip(request))


@router.put("/veterinary-officers/{vo_user_id}", response_model=VeterinaryOfficerResponse, summary="Update Veterinary Officer profile")
async def update_veterinary_officer(
    vo_user_id: uuid.UUID,
    payload: VeterinaryOfficerUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> VeterinaryOfficerResponse:
    service = AdministrationService(db)
    return await service.update_veterinary_officer(vo_user_id, payload, current_user, _extract_ip(request))


@router.patch("/veterinary-officers/{vo_user_id}/status", summary="Activate or deactivate a Veterinary Officer")
async def update_vo_status(
    vo_user_id: uuid.UUID,
    payload: StaffStatusUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, str]:
    service = AdministrationService(db)
    return await service.update_staff_status(vo_user_id, payload.status, payload.reason, current_user, _extract_ip(request))


# ==============================================================================
# 7. Field Worker Endpoints
# ==============================================================================
@router.get("/field-workers", response_model=List[FieldWorkerResponse], summary="List Field Workers")
async def list_field_workers(
    district_id: Optional[uuid.UUID] = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> List[FieldWorkerResponse]:
    service = AdministrationService(db)
    return await service.list_field_workers(current_user, district_id, offset, limit)


@router.get("/field-workers/{fw_user_id}", response_model=FieldWorkerResponse, summary="Get Field Worker details")
async def get_field_worker(
    fw_user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> FieldWorkerResponse:
    service = AdministrationService(db)
    return await service.get_field_worker(fw_user_id, current_user)


@router.post("/field-workers", response_model=FieldWorkerResponse, status_code=status.HTTP_201_CREATED, summary="Provision a Field Worker account")
async def create_field_worker(
    payload: FieldWorkerCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> FieldWorkerResponse:
    service = AdministrationService(db)
    return await service.create_field_worker(payload, current_user, _extract_ip(request))


@router.put("/field-workers/{fw_user_id}", response_model=FieldWorkerResponse, summary="Update Field Worker details")
async def update_field_worker(
    fw_user_id: uuid.UUID,
    payload: FieldWorkerUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> FieldWorkerResponse:
    service = AdministrationService(db)
    return await service.update_field_worker(fw_user_id, payload, current_user, _extract_ip(request))


@router.patch("/field-workers/{fw_user_id}/status", summary="Activate or deactivate a Field Worker")
async def update_fw_status(
    fw_user_id: uuid.UUID,
    payload: StaffStatusUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, str]:
    service = AdministrationService(db)
    return await service.update_staff_status(fw_user_id, payload.status, payload.reason, current_user, _extract_ip(request))


# ==============================================================================
# 8. Administrative Assignments
# ==============================================================================
@router.post("/assignments/vo-village", response_model=UserVillageAssignResponse, status_code=status.HTTP_201_CREATED, summary="Assign Veterinary Officer to village")
async def assign_vo_village(
    payload: UserVillageAssignRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> UserVillageAssignResponse:
    service = AdministrationService(db)
    return await service.assign_vo_to_village(payload.user_id, payload.village_id, current_user, _extract_ip(request))


@router.post("/assignments/vo-village/bulk", response_model=UserVillageBulkAssignResponse, status_code=status.HTTP_201_CREATED, summary="Bulk assign Veterinary Officer to multiple villages")
async def assign_vo_village_bulk(
    payload: UserVillageBulkAssignRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> UserVillageBulkAssignResponse:
    service = AdministrationService(db)
    return await service.assign_vo_villages_bulk(payload.user_id, payload.village_ids, current_user, _extract_ip(request))


@router.post("/assignments/vo-village/end", summary="End Veterinary Officer village assignment")
async def end_vo_village(
    payload: UserVillageAssignRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, str]:
    service = AdministrationService(db)
    return await service.end_vo_village_assignment(payload.user_id, payload.village_id, current_user, _extract_ip(request))


@router.post("/assignments/fw-village", response_model=UserVillageAssignResponse, status_code=status.HTTP_201_CREATED, summary="Assign Field Worker to village")
async def assign_fw_village(
    payload: UserVillageAssignRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> UserVillageAssignResponse:
    service = AdministrationService(db)
    return await service.assign_fw_to_village(payload.user_id, payload.village_id, current_user, _extract_ip(request))


@router.post("/assignments/fw-village/end", summary="End Field Worker village assignment")
async def end_fw_village(
    payload: UserVillageAssignRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, str]:
    service = AdministrationService(db)
    return await service.end_fw_village_assignment(payload.user_id, payload.village_id, current_user, _extract_ip(request))


@router.post("/assignments/daho-district", response_model=DahoDistrictAssignResponse, status_code=status.HTTP_201_CREATED, summary="Assign DAHO to district (Platform Admin only)")
async def assign_daho_district(
    payload: DahoDistrictAssignRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> DahoDistrictAssignResponse:
    service = AdministrationService(db)
    return await service.assign_daho_to_district(payload.daho_user_id, payload.district_id, current_user, _extract_ip(request))


# ==============================================================================
# 9. SUPER_ADMIN State-Level Administration Endpoints
# ==============================================================================
@router.get("/super-admin/geodata/quality-audit", response_model=GeographicQualityAuditResponse, summary="Statewide & Jamnagar Geographic Data Quality Audit")
async def get_geographic_quality_audit(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> GeographicQualityAuditResponse:
    if current_user.role not in ("SUPER_ADMIN", "SYS_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Super Admin authorization required.")
    service = SuperAdminService(db)
    return await service.get_geographic_quality_audit()


@router.get("/super-admin/overview", response_model=SuperAdminOverviewResponse, summary="Super Admin State-level administrative KPIs & overview")
async def get_super_admin_overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> SuperAdminOverviewResponse:
    if current_user.role not in ("SUPER_ADMIN", "SYS_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Super Admin authorization required.")
    service = SuperAdminService(db)
    return await service.get_overview()


@router.post("/super-admin/daho-accounts", response_model=DahoAccountResponse, status_code=status.HTTP_201_CREATED, summary="Create DAHO administrative account with district assignment")
async def create_daho_account(
    payload: DahoAccountCreateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> DahoAccountResponse:
    if current_user.role not in ("SUPER_ADMIN", "SYS_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Super Admin authorization required.")
    service = SuperAdminService(db)
    return await service.create_daho_account(payload, current_user, _extract_ip(request))


@router.post("/districts/{district_id}/reassign", response_model=AssignmentActionResponse, summary="Safely reassign district to another DAHO with downstream preservation")
async def reassign_district(
    district_id: uuid.UUID,
    payload: DistrictReassignRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> AssignmentActionResponse:
    if current_user.role not in ("SUPER_ADMIN", "SYS_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Super Admin authorization required.")
    service = SuperAdminService(db)
    return await service.reassign_district(district_id, payload.new_daho_user_id, payload.reason, current_user, _extract_ip(request))


@router.post("/districts/{district_id}/release", response_model=AssignmentActionResponse, summary="Release active DAHO assignment for a district")
async def release_district(
    district_id: uuid.UUID,
    payload: DistrictReleaseRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> AssignmentActionResponse:
    if current_user.role not in ("SUPER_ADMIN", "SYS_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Super Admin authorization required.")
    service = SuperAdminService(db)
    return await service.release_district(district_id, payload.reason, current_user, _extract_ip(request))


@router.get("/districts/{district_id}/hierarchy", response_model=DistrictHierarchyResponse, summary="Get full district hierarchy (Talukas -> Villages) & assignment history")
async def get_district_hierarchy(
    district_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> DistrictHierarchyResponse:
    service = SuperAdminService(db)
    return await service.get_district_hierarchy(district_id)


@router.post("/districts/{district_id}/custom-boundary", response_model=CustomJurisdictionResponse, status_code=status.HTTP_201_CREATED, summary="Save versioned custom operational jurisdiction")
async def save_custom_jurisdiction(
    district_id: uuid.UUID,
    payload: CustomJurisdictionCreateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> CustomJurisdictionResponse:
    if current_user.role not in ("SUPER_ADMIN", "SYS_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Super Admin authorization required.")
    service = SuperAdminService(db)
    return await service.save_custom_jurisdiction(district_id, payload, current_user, _extract_ip(request))


@router.post("/geography/validate-import", response_model=GeodataValidationReport, summary="Validate imported GIS geographic dataset before commit")
async def validate_geodata_import(
    payload: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> GeodataValidationReport:
    if current_user.role not in ("SUPER_ADMIN", "SYS_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Super Admin authorization required.")
    service = SuperAdminService(db)
    features = payload.get("features", [])
    source_name = payload.get("source_name", "Official Administrative Source")
    dataset_version = payload.get("dataset_version", "1.0")
    return await service.validate_geodata_import(features, source_name, dataset_version)


@router.post("/geography/commit-import", response_model=GeodataImportResult, status_code=status.HTTP_201_CREATED, summary="Commit verified geographic dataset (Talukas & Villages) to database")
async def commit_geodata_import(
    payload: GeodataCommitRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> GeodataImportResult:
    if current_user.role not in ("SUPER_ADMIN", "SYS_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Super Admin authorization required.")
    service = SuperAdminService(db)
    return await service.commit_geodata_import(payload, current_user, _extract_ip(request))


@router.post("/districts/{district_id}/seed-official-hierarchy", response_model=GeodataImportResult, status_code=status.HTTP_200_OK, summary="Seed / synchronize official district geographic master data")
async def seed_official_district_hierarchy(
    district_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> GeodataImportResult:
    if current_user.role not in ("SUPER_ADMIN", "SYS_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Super Admin authorization required.")
    service = SuperAdminService(db)
    return await service.seed_official_district_hierarchy(district_id, current_user, _extract_ip(request))


