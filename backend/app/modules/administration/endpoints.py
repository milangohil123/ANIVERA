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
from app.modules.authorization.service import AuthorizationService
from app.modules.administration.cooperative_schemas import (
    CooperativeDetailResponse,
    CooperativeMemberItem,
    CooperativeMemberLinkRequest,
    CooperativeRegisterRequest,
    CooperativeStatusRequest,
    CooperativeSummaryItem,
    CooperativeUpdateRequest,
)
from app.modules.administration.daho_cooperative_service import DahoCooperativeService
from app.modules.administration.service import AdministrationService
from app.modules.administration.super_admin_service import SuperAdminService
from app.modules.administration.taho_service import TahoService
from app.modules.administration.super_admin_schemas import (
    AssignmentActionResponse,
    CustomJurisdictionCreateRequest,
    CustomJurisdictionResponse,
    DahoAccountCreateRequest,
    DahoAccountResponse,
    DistrictHierarchyResponse,
    DistrictReassignRequest,
    DistrictReleaseRequest,
    EmailLogsListResponse,
    GeodataCommitRequest,
    GeodataImportResult,
    GeodataValidationReport,
    SuperAdminOverviewResponse,
    GeographicQualityAuditResponse,
    TahoAccountCreateRequest,
    TahoAccountResponse,
    TalukaAssignTahoRequest,
    TalukaReleaseTahoRequest,
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


@router.post("/assignments/fw-village/bulk", response_model=UserVillageBulkAssignResponse, status_code=status.HTTP_201_CREATED, summary="Bulk assign Field Worker to multiple villages")
async def assign_fw_village_bulk(
    payload: UserVillageBulkAssignRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> UserVillageBulkAssignResponse:
    service = AdministrationService(db)
    return await service.assign_fw_villages_bulk(payload.user_id, payload.village_ids, current_user, _extract_ip(request))


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


@router.get("/super-admin/charts-analytics", summary="State-level real database analytics & metrics for dashboard charts")
async def get_super_admin_charts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    if current_user.role not in ("SUPER_ADMIN", "SYS_ADMIN", "ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Super Admin authorization required.")
    service = SuperAdminService(db)
    return await service.get_dashboard_charts()


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


# ==============================================================================
# 9. Email Delivery Logs Endpoints
# ==============================================================================
@router.get("/super-admin/email-logs", response_model=EmailLogsListResponse, summary="Retrieve outbound SMTP email delivery audit logs")
async def get_email_logs(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> EmailLogsListResponse:
    if current_user.role not in ("SUPER_ADMIN", "SYS_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Super Admin authorization required.")
    service = SuperAdminService(db)
    res = await service.get_email_logs(limit, offset)
    return EmailLogsListResponse(**res)


@router.post("/super-admin/email-logs/{log_id}/retry", summary="Retry sending a failed or pending activation email")
async def retry_email_log(
    log_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    if current_user.role not in ("SUPER_ADMIN", "SYS_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Super Admin authorization required.")
    service = SuperAdminService(db)
    return await service.retry_email_log(log_id)


# ==============================================================================
# 10. DAHO Multi-District Jurisdiction & Taluka/TAHO Management Endpoints
# ==============================================================================
@router.get("/daho/assigned-districts", summary="Retrieve all active districts assigned to caller DAHO")
async def get_daho_assigned_districts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    if current_user.role not in ("DAHO", "SUPER_ADMIN", "SYS_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access restricted to DAHO or State Administrators.")

    auth_svc = AuthorizationService(db)
    scope = await auth_svc.get_user_scope(current_user)
    from app.models.geography import District
    from sqlalchemy import select

    if current_user.role in ("SUPER_ADMIN", "SYS_ADMIN"):
        stmt = select(District).where(District.active == True).order_by(District.name_en)
    else:
        stmt = select(District).where(District.id.in_(scope.assigned_district_ids), District.active == True).order_by(District.name_en)

    districts = list((await db.execute(stmt)).scalars().all())
    return [
        {
            "id": str(d.id),
            "district_id": str(d.id),
            "code": d.code,
            "name_en": d.name_en,
            "name_gu": d.name_gu
        }
        for d in districts
    ]


@router.get("/daho/district-overview", summary="Retrieve real calculated database KPIs for a district")
async def get_daho_district_overview(
    district_id: uuid.UUID = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    auth_svc = AuthorizationService(db)
    await auth_svc.assert_district_scope(current_user, district_id)

    service = SuperAdminService(db)
    return await service.get_daho_district_overview(district_id)


@router.get("/daho/talukas", summary="Retrieve all talukas in district with active TAHO details")
async def get_daho_talukas(
    district_id: uuid.UUID = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    auth_svc = AuthorizationService(db)
    await auth_svc.assert_district_scope(current_user, district_id)

    service = SuperAdminService(db)
    return await service.get_daho_talukas(district_id)


@router.get("/daho/taho-search", summary="Search available TAHO accounts by name, email, or mobile")
async def search_taho_accounts(
    q: Optional[str] = Query(None),
    district_id: Optional[uuid.UUID] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    if current_user.role not in ("DAHO", "SUPER_ADMIN", "SYS_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")
    service = SuperAdminService(db)
    return await service.search_taho_accounts(q, district_id)


@router.post("/daho/taho-accounts", response_model=TahoAccountResponse, summary="Create a new TAHO account with real activation email")
async def create_taho_account(
    payload: TahoAccountCreateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    if current_user.role not in ("DAHO", "SUPER_ADMIN", "SYS_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only DAHO and Super Admin can create TAHO accounts.")

    # If taluka_id provided and caller is DAHO, ensure taluka is within caller's district
    if payload.taluka_id and current_user.role == "DAHO":
        auth_svc = AuthorizationService(db)
        await auth_svc.assert_taluka_scope(current_user, payload.taluka_id)

    service = SuperAdminService(db)
    res = await service.create_taho_account(payload.model_dump(), current_user, _extract_ip(request))
    return TahoAccountResponse(**res)


@router.post("/daho/talukas/{taluka_id}/assign-taho", summary="Assign or reassign a TAHO officer to a Taluka")
async def assign_taho_to_taluka(
    taluka_id: uuid.UUID,
    payload: TalukaAssignTahoRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    auth_svc = AuthorizationService(db)
    await auth_svc.assert_taluka_scope(current_user, taluka_id)

    service = SuperAdminService(db)
    return await service.assign_taho_to_taluka(
        taluka_id=taluka_id,
        taho_user_id=payload.taho_user_id,
        reason=payload.reason or "Administrative Assignment",
        actor_user=current_user,
        client_ip=_extract_ip(request)
    )


@router.post("/daho/talukas/{taluka_id}/release-taho", summary="Release currently assigned TAHO officer from a Taluka")
async def release_taho_from_taluka(
    taluka_id: uuid.UUID,
    payload: TalukaReleaseTahoRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    auth_svc = AuthorizationService(db)
    await auth_svc.assert_taluka_scope(current_user, taluka_id)

    service = SuperAdminService(db)
    return await service.release_taho_from_taluka(
        taluka_id=taluka_id,
        reason=payload.reason,
        actor_user=current_user,
        client_ip=_extract_ip(request)
    )


@router.get("/daho/animals", summary="Retrieve district-scoped animal records with owner and vaccination count")
async def get_daho_animals(
    district_id: uuid.UUID = Query(...),
    search: Optional[str] = Query(None),
    species: Optional[str] = Query(None),
    taluka_id: Optional[uuid.UUID] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    auth_svc = AuthorizationService(db)
    await auth_svc.assert_district_scope(current_user, district_id)

    service = SuperAdminService(db)
    return await service.get_daho_animals(
        district_id=district_id,
        search=search,
        species=species,
        taluka_id=taluka_id,
        page=page,
        page_size=page_size
    )


@router.get("/daho/farmers", summary="Retrieve district-scoped farmer records with registered animals")
async def get_daho_farmers(
    district_id: uuid.UUID = Query(...),
    search: Optional[str] = Query(None),
    taluka_id: Optional[uuid.UUID] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    auth_svc = AuthorizationService(db)
    await auth_svc.assert_district_scope(current_user, district_id)

    service = SuperAdminService(db)
    return await service.get_daho_farmers(
        district_id=district_id,
        search=search,
        taluka_id=taluka_id,
        page=page,
        page_size=page_size
    )


@router.get("/daho/disease-alerts", summary="Retrieve early warning cluster signals and active disease alerts for district")
async def get_daho_disease_alerts(
    district_id: uuid.UUID = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    auth_svc = AuthorizationService(db)
    await auth_svc.assert_district_scope(current_user, district_id)

    service = SuperAdminService(db)
    return await service.get_daho_disease_alerts(district_id=district_id)


@router.get("/daho/gis-quality", summary="Perform GIS completeness audit for villages within district")
async def get_daho_gis_quality(
    district_id: uuid.UUID = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    auth_svc = AuthorizationService(db)
    await auth_svc.assert_district_scope(current_user, district_id)

    service = SuperAdminService(db)
    return await service.get_daho_gis_quality(district_id=district_id)


@router.get("/daho/vaccination-records", summary="Retrieve district-scoped animal vaccination telemetry")
async def get_daho_vaccination_records(
    district_id: uuid.UUID = Query(...),
    taluka_id: Optional[uuid.UUID] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    auth_svc = AuthorizationService(db)
    await auth_svc.assert_district_scope(current_user, district_id)

    service = SuperAdminService(db)
    return await service.get_daho_vaccination_records(
        district_id=district_id,
        taluka_id=taluka_id,
        page=page,
        page_size=page_size
    )


# ==============================================================================
# 11. TAHO Operational & Administration Suite Endpoints
# ==============================================================================
@router.get("/taho/overview", summary="Retrieve assigned Taluka KPIs, multi-dimensional charts, and actionable insights")
async def get_taho_overview(
    taluka_id: Optional[uuid.UUID] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    if current_user.role not in ("TAHO", "SUPER_ADMIN", "SYS_ADMIN", "DAHO"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access restricted to TAHO officers.")
    service = TahoService(db)
    return await service.get_taho_overview(current_user, taluka_id)


@router.get("/taho/hierarchy", summary="Retrieve assigned Taluka GeoJSON boundaries and villages with analytics")
async def get_taho_hierarchy(
    taluka_id: Optional[uuid.UUID] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    if current_user.role not in ("TAHO", "SUPER_ADMIN", "SYS_ADMIN", "DAHO"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access restricted to TAHO officers.")
    service = TahoService(db)
    return await service.get_taho_hierarchy(current_user, taluka_id)


@router.get("/taho/village-analytics", summary="Retrieve in-depth analytics for a clicked village on the Taluka GIS map")
async def get_taho_village_analytics(
    village_id: uuid.UUID = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    if current_user.role not in ("TAHO", "SUPER_ADMIN", "SYS_ADMIN", "DAHO"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access restricted to TAHO officers.")
    service = TahoService(db)
    return await service.get_village_analytics(current_user, village_id)


@router.get("/taho/gis-analytics", summary="Retrieve filter-based GIS analytics, layer color assignments, legend and charts")
async def get_taho_gis_analytics(
    layer_mode: str = Query("coverage", description="Layer visualization mode: coverage, disease, pending, campaign, population, risk"),
    village_id: Optional[uuid.UUID] = Query(None),
    vaccine_code: Optional[str] = Query(None),
    disease_code: Optional[str] = Query(None),
    campaign_id: Optional[uuid.UUID] = Query(None),
    species_code: Optional[str] = Query(None),
    vaccination_status: Optional[str] = Query(None),
    disease_status: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    vo_id: Optional[uuid.UUID] = Query(None),
    fw_id: Optional[uuid.UUID] = Query(None),
    coverage_range: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    if current_user.role not in ("TAHO", "SUPER_ADMIN", "SYS_ADMIN", "DAHO"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access restricted to TAHO officers.")
    service = TahoService(db)
    return await service.get_gis_analytics(
        taho_user=current_user,
        layer_mode=layer_mode,
        village_id=village_id,
        vaccine_code=vaccine_code,
        disease_code=disease_code,
        campaign_id=campaign_id,
        species_code=species_code,
        vaccination_status=vaccination_status,
        disease_status=disease_status,
        start_date=start_date,
        end_date=end_date,
        vo_id=vo_id,
        fw_id=fw_id,
        coverage_range=coverage_range
    )


@router.get("/taho/veterinary-officers", summary="List Veterinary Officers operating in this Taluka")
async def list_taho_vos(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    if current_user.role not in ("TAHO", "SUPER_ADMIN", "SYS_ADMIN", "DAHO"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access restricted to TAHO officers.")
    service = TahoService(db)
    return await service.list_vos(current_user)


@router.post("/taho/veterinary-officers", status_code=status.HTTP_201_CREATED, summary="Create new VO account with email activation")
async def create_taho_vo(
    payload: Dict[str, Any],
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    if current_user.role not in ("TAHO", "SUPER_ADMIN", "SYS_ADMIN", "DAHO"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access restricted to TAHO officers.")
    service = TahoService(db)
    return await service.create_vo(current_user, payload, _extract_ip(request))


@router.patch("/taho/veterinary-officers/{vo_id}/status", summary="Activate or deactivate a Veterinary Officer")
async def update_taho_vo_status(
    vo_id: uuid.UUID,
    payload: StaffStatusUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    if current_user.role not in ("TAHO", "SUPER_ADMIN", "SYS_ADMIN", "DAHO"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access restricted to TAHO officers.")
    service = TahoService(db)
    return await service.update_vo_status(current_user, vo_id, payload.status, payload.reason, _extract_ip(request))


@router.get("/taho/field-workers", summary="List Field Workers operating in this Taluka")
async def list_taho_fws(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    if current_user.role not in ("TAHO", "SUPER_ADMIN", "SYS_ADMIN", "DAHO"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access restricted to TAHO officers.")
    service = TahoService(db)
    return await service.list_fws(current_user)


@router.post("/taho/field-workers", status_code=status.HTTP_201_CREATED, summary="Create new Field Worker account with location-based assignment and email activation")
async def create_taho_fw(
    payload: Dict[str, Any],
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    if current_user.role not in ("TAHO", "SUPER_ADMIN", "SYS_ADMIN", "DAHO"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access restricted to TAHO officers.")
    service = TahoService(db)
    return await service.create_fw(current_user, payload, _extract_ip(request))


@router.patch("/taho/field-workers/{fw_id}/status", summary="Activate or deactivate a Field Worker")
async def update_taho_fw_status(
    fw_id: uuid.UUID,
    payload: StaffStatusUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    if current_user.role not in ("TAHO", "SUPER_ADMIN", "SYS_ADMIN", "DAHO"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access restricted to TAHO officers.")
    service = TahoService(db)
    return await service.update_fw_status(current_user, fw_id, payload.status, payload.reason, _extract_ip(request))


@router.post("/taho/staff/assign-villages", summary="TAHO: Bulk assign or reassign villages to VO or FW")
async def assign_taho_staff_villages(
    payload: UserVillageBulkAssignRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    if current_user.role not in ("TAHO", "SUPER_ADMIN", "SYS_ADMIN", "DAHO"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access restricted to TAHO officers.")
    service = TahoService(db)
    return await service.assign_staff_villages(current_user, payload.user_id, payload.village_ids, _extract_ip(request))


@router.get("/taho/campaigns", summary="List vaccination campaigns active in this Taluka")
async def list_taho_campaigns(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    if current_user.role not in ("TAHO", "SUPER_ADMIN", "SYS_ADMIN", "DAHO"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access restricted to TAHO officers.")
    service = TahoService(db)
    return await service.list_campaigns(current_user)


@router.post("/taho/campaigns", status_code=status.HTTP_201_CREATED, summary="Create new Taluka-level campaign with target villages")
async def create_taho_campaign(
    payload: Dict[str, Any],
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    if current_user.role not in ("TAHO", "SUPER_ADMIN", "SYS_ADMIN", "DAHO"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access restricted to TAHO officers.")
    service = TahoService(db)
    return await service.create_campaign(current_user, payload, _extract_ip(request))


@router.get("/taho/vaccinations", summary="Retrieve Taluka-scoped vaccination telemetry")
async def list_taho_vaccinations(
    village_id: Optional[uuid.UUID] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    if current_user.role not in ("TAHO", "SUPER_ADMIN", "SYS_ADMIN", "DAHO"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access restricted to TAHO officers.")
    service = TahoService(db)
    return await service.list_vaccinations(current_user, village_id=village_id, page=page, page_size=page_size)


@router.get("/taho/animals", summary="Retrieve Taluka-scoped animal records with owner details")
async def list_taho_animals(
    search: Optional[str] = Query(None),
    species: Optional[str] = Query(None),
    village_id: Optional[uuid.UUID] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    if current_user.role not in ("TAHO", "SUPER_ADMIN", "SYS_ADMIN", "DAHO"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access restricted to TAHO officers.")
    service = TahoService(db)
    return await service.list_animals(current_user, search=search, species=species, village_id=village_id, page=page, page_size=page_size)


@router.get("/taho/farmers", summary="Retrieve Taluka-scoped farmer directory with animal counts")
async def list_taho_farmers(
    search: Optional[str] = Query(None),
    village_id: Optional[uuid.UUID] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    if current_user.role not in ("TAHO", "SUPER_ADMIN", "SYS_ADMIN", "DAHO"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access restricted to TAHO officers.")
    service = TahoService(db)
    return await service.list_farmers(current_user, search=search, village_id=village_id, page=page, page_size=page_size)


@router.get("/taho/surveillance", summary="Retrieve Taluka-scoped disease surveillance reports")
async def list_taho_surveillance(
    village_id: Optional[uuid.UUID] = Query(None),
    disease_code: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    if current_user.role not in ("TAHO", "SUPER_ADMIN", "SYS_ADMIN", "DAHO"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access restricted to TAHO officers.")
    service = TahoService(db)
    return await service.list_surveillance(current_user, village_id=village_id, disease_code=disease_code, status=status)


@router.get("/taho/disease-alerts", summary="Retrieve Taluka disease cluster and surge signals")
async def list_taho_disease_alerts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    if current_user.role not in ("TAHO", "SUPER_ADMIN", "SYS_ADMIN", "DAHO"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access restricted to TAHO officers.")
    service = TahoService(db)
    return await service.list_disease_alerts(current_user)


@router.post("/taho/demo/seed", summary="Seed 2 interconnected demonstration records per module (Requirement 19)")
async def seed_taho_demo(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    if current_user.role not in ("TAHO", "SUPER_ADMIN", "SYS_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access restricted to TAHO or Admin.")
    service = TahoService(db)
    return await service.seed_demo_data(current_user, _extract_ip(request))


@router.post("/taho/demo/reset", summary="Cleanly remove demonstration records from Taluka")
async def reset_taho_demo(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    if current_user.role not in ("TAHO", "SUPER_ADMIN", "SYS_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access restricted to TAHO or Admin.")
    service = TahoService(db)
    return await service.reset_demo_data(current_user, _extract_ip(request))


# ==============================================================================
# 9. DAHO Dairy Cooperative Management Endpoints
# ==============================================================================
@router.get("/daho/cooperatives", response_model=List[CooperativeSummaryItem], summary="DAHO: List cooperatives in assigned district")
async def list_daho_cooperatives(
    district_id: Optional[uuid.UUID] = Query(None),
    taluka_id: Optional[uuid.UUID] = Query(None),
    village_id: Optional[uuid.UUID] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    if current_user.role not in ("DAHO", "SUPER_ADMIN", "SYS_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access restricted to DAHO or Platform Admin.")
    service = DahoCooperativeService(db)
    return await service.list_cooperatives(
        current_user=current_user,
        district_id=district_id,
        taluka_id=taluka_id,
        village_id=village_id,
        status_filter=status,
        search=search,
        limit=limit,
        offset=offset,
    )


@router.post("/daho/cooperatives", response_model=CooperativeDetailResponse, status_code=status.HTTP_201_CREATED, summary="DAHO: Create cooperative and provision account")
async def create_daho_cooperative(
    payload: CooperativeRegisterRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    if current_user.role not in ("DAHO", "SUPER_ADMIN", "SYS_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access restricted to DAHO or Platform Admin.")
    service = DahoCooperativeService(db)
    return await service.create_cooperative(current_user, payload, _extract_ip(request))


@router.get("/daho/cooperatives/{coop_id}", response_model=CooperativeDetailResponse, summary="DAHO: Get single cooperative details")
async def get_daho_cooperative(
    coop_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    if current_user.role not in ("DAHO", "SUPER_ADMIN", "SYS_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access restricted to DAHO or Platform Admin.")
    service = DahoCooperativeService(db)
    return await service.get_cooperative(current_user, coop_id)


@router.put("/daho/cooperatives/{coop_id}", response_model=CooperativeDetailResponse, summary="DAHO: Update cooperative profile")
async def update_daho_cooperative(
    coop_id: uuid.UUID,
    payload: CooperativeUpdateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    if current_user.role not in ("DAHO", "SUPER_ADMIN", "SYS_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access restricted to DAHO or Platform Admin.")
    service = DahoCooperativeService(db)
    return await service.update_cooperative(current_user, coop_id, payload, _extract_ip(request))


@router.patch("/daho/cooperatives/{coop_id}/status", response_model=CooperativeDetailResponse, summary="DAHO: Activate or deactivate cooperative")
async def set_daho_cooperative_status(
    coop_id: uuid.UUID,
    payload: CooperativeStatusRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    if current_user.role not in ("DAHO", "SUPER_ADMIN", "SYS_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access restricted to DAHO or Platform Admin.")
    service = DahoCooperativeService(db)
    return await service.set_cooperative_status(current_user, coop_id, payload, _extract_ip(request))


@router.post("/daho/cooperatives/{coop_id}/resend-email", summary="DAHO: Resend onboarding credentials email")
async def resend_daho_cooperative_email(
    coop_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    if current_user.role not in ("DAHO", "SUPER_ADMIN", "SYS_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access restricted to DAHO or Platform Admin.")
    service = DahoCooperativeService(db)
    return await service.resend_onboarding_email(current_user, coop_id, _extract_ip(request))


@router.get("/daho/cooperatives/{coop_id}/members", response_model=List[CooperativeMemberItem], summary="DAHO: List cooperative member farmers")
async def list_daho_cooperative_members(
    coop_id: uuid.UUID,
    search: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    if current_user.role not in ("DAHO", "SUPER_ADMIN", "SYS_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access restricted to DAHO or Platform Admin.")
    service = DahoCooperativeService(db)
    return await service.list_cooperative_members(current_user, coop_id, search=search, limit=limit, offset=offset)


@router.post("/daho/cooperatives/{coop_id}/members", response_model=CooperativeMemberItem, summary="DAHO: Link farmer to cooperative")
async def link_daho_cooperative_member(
    coop_id: uuid.UUID,
    payload: CooperativeMemberLinkRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    if current_user.role not in ("DAHO", "SUPER_ADMIN", "SYS_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access restricted to DAHO or Platform Admin.")
    service = DahoCooperativeService(db)
    return await service.link_farmer(current_user, coop_id, payload, _extract_ip(request))


@router.delete("/daho/cooperatives/{coop_id}/members/{farmer_id}", summary="DAHO: Unlink farmer from cooperative")
async def unlink_daho_cooperative_member(
    coop_id: uuid.UUID,
    farmer_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    if current_user.role not in ("DAHO", "SUPER_ADMIN", "SYS_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access restricted to DAHO or Platform Admin.")
    service = DahoCooperativeService(db)
    return await service.unlink_farmer(current_user, coop_id, farmer_id, _extract_ip(request))


@router.post("/daho/cooperatives/seed-demo", summary="DAHO: Seed 2 demo cooperatives with members")
async def seed_daho_demo_cooperatives(
    district_id: uuid.UUID = Query(..., description="Target district ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    if current_user.role not in ("DAHO", "SUPER_ADMIN", "SYS_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access restricted to DAHO or Platform Admin.")
    service = DahoCooperativeService(db)
    return await service.seed_demo_data(current_user, district_id)


@router.post("/daho/cooperatives/reset-demo", summary="DAHO: Reset and clean demo cooperatives")
async def reset_daho_demo_cooperatives(
    district_id: uuid.UUID = Query(..., description="Target district ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    if current_user.role not in ("DAHO", "SUPER_ADMIN", "SYS_ADMIN"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access restricted to DAHO or Platform Admin.")
    service = DahoCooperativeService(db)
    return await service.reset_demo_data(current_user, district_id)


@router.get("/daho/cooperatives/assigned-villages", summary="DAHO: Get map of village IDs already assigned to a cooperative")
async def get_assigned_cooperative_villages(
    district_id: Optional[uuid.UUID] = Query(default=None, description="Optional filter by district ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    service = DahoCooperativeService(db)
    return await service.get_assigned_villages(district_id)




