"""FastAPI RESTful endpoints for Animal Management domain."""
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db_session
from app.modules.authentication.models import User
from app.modules.animals.schemas import (
    AnimalCreate,
    AnimalDetailResponse,
    AnimalExternalIdCreate,
    AnimalExternalIdResponse,
    AnimalHistoryResponse,
    AnimalOwnershipTransferRequest,
    AnimalOwnershipTransferResponse,
    AnimalQRTokenAssignRequest,
    AnimalQRTokenResponse,
    AnimalResponse,
    AnimalTransferDecisionRequest,
    AnimalUpdate,
    AnimalVerificationRequest,
    AnimalVerificationResponse,
    TagCheckResponse,
)
from app.modules.animals.service import AnimalService

router = APIRouter(prefix="", tags=["Animal Management"])


def _extract_ip(request: Request) -> Optional[str]:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


@router.get("", response_model=List[AnimalResponse], summary="List animals in caller scope")
async def list_animals(
    village_id: Optional[uuid.UUID] = Query(None, description="Filter by village"),
    farmer_id: Optional[uuid.UUID] = Query(None, description="Filter by owner farmer"),
    species_code: Optional[str] = Query(None, description="Filter by species (e.g. CATTLE)"),
    status: Optional[str] = Query("ACTIVE", description="Filter by status"),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> List[AnimalResponse]:
    service = AnimalService(db)
    return await service.list_animals(current_user, village_id, farmer_id, species_code, status, offset, limit)


@router.get("/check-tag/{tag_value}", response_model=TagCheckResponse, summary="Check if physical tag is registered")
async def check_tag_by_path(
    tag_value: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> TagCheckResponse:
    service = AnimalService(db)
    return await service.check_tag(tag_value, current_user)


@router.get("/tag-check", response_model=TagCheckResponse, summary="Check if physical tag is registered (query param)")
async def check_tag_by_query(
    tag_value: str = Query(..., description="Tag, Barcode or QR string to check"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> TagCheckResponse:
    service = AnimalService(db)
    return await service.check_tag(tag_value, current_user)


@router.get("/lookup", response_model=AnimalDetailResponse, summary="Universal animal lookup by token, tag, barcode, or animal code")
async def universal_lookup(
    identifier: str = Query(..., description="Base32 QR token, physical tag, barcode, or animal code"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> AnimalDetailResponse:
    service = AnimalService(db)
    return await service.lookup_by_tag(identifier, current_user)


@router.get("/lookup/qr/{token:path}", response_model=AnimalDetailResponse, summary="Lookup animal by Base32 QR token")
async def lookup_by_qr(
    token: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> AnimalDetailResponse:
    service = AnimalService(db)
    return await service.lookup_by_qr(token, current_user)


@router.get("/lookup/tag/{tag_value:path}", response_model=AnimalDetailResponse, summary="Lookup animal by Bharat Pashudhan tag or external tag")
async def lookup_by_tag(
    tag_value: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> AnimalDetailResponse:
    service = AnimalService(db)
    return await service.lookup_by_tag(tag_value, current_user)


@router.get("/{animal_id}", response_model=AnimalDetailResponse, summary="Get animal details")
async def get_animal(
    animal_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> AnimalDetailResponse:
    service = AnimalService(db)
    return await service.get_animal(animal_id, current_user)


@router.get(
    "/{animal_id}/history",
    response_model=AnimalHistoryResponse,
    summary="Get complete chronological vaccination and disease history"
)
async def get_animal_history(
    animal_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> AnimalHistoryResponse:
    service = AnimalService(db)
    return await service.get_animal_history(animal_id, current_user, _extract_ip(request))



@router.post("", response_model=AnimalDetailResponse, status_code=status.HTTP_201_CREATED, summary="Register an animal")
async def register_animal(
    payload: AnimalCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> AnimalDetailResponse:
    service = AnimalService(db)
    return await service.register_animal(payload, current_user, _extract_ip(request))


@router.put("/{animal_id}", response_model=AnimalResponse, summary="Update animal details")
async def update_animal(
    animal_id: uuid.UUID,
    payload: AnimalUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> AnimalResponse:
    service = AnimalService(db)
    return await service.update_animal(animal_id, payload, current_user, _extract_ip(request))


@router.post(
    "/{animal_id}/qr-token",
    response_model=AnimalQRTokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Assign or re-tag animal with physical QR token"
)
async def assign_qr_token(
    animal_id: uuid.UUID,
    payload: AnimalQRTokenAssignRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> AnimalQRTokenResponse:
    service = AnimalService(db)
    return await service.assign_qr_token(animal_id, payload, current_user, _extract_ip(request))


@router.post(
    "/{animal_id}/external-ids",
    response_model=AnimalExternalIdResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Attach Bharat Pashudhan or ear tag"
)
async def add_external_id(
    animal_id: uuid.UUID,
    payload: AnimalExternalIdCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> AnimalExternalIdResponse:
    service = AnimalService(db)
    return await service.add_external_id(animal_id, payload, current_user, _extract_ip(request))


@router.post(
    "/{animal_id}/transfers",
    response_model=AnimalOwnershipTransferResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit an ownership transfer request (stores pending request)"
)
async def request_transfer(
    animal_id: uuid.UUID,
    payload: AnimalOwnershipTransferRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> AnimalOwnershipTransferResponse:
    service = AnimalService(db)
    return await service.request_transfer(animal_id, payload, current_user, _extract_ip(request))


@router.post(
    "/{animal_id}/transfer",
    response_model=AnimalOwnershipTransferResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit an ownership transfer request (backward compatible alias)"
)
async def transfer_ownership_alias(
    animal_id: uuid.UUID,
    payload: AnimalOwnershipTransferRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> AnimalOwnershipTransferResponse:
    service = AnimalService(db)
    return await service.request_transfer(animal_id, payload, current_user, _extract_ip(request))


@router.get(
    "/{animal_id}/transfers",
    response_model=List[AnimalOwnershipTransferResponse],
    summary="List ownership transfer requests for an animal"
)
async def list_transfers(
    animal_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> List[AnimalOwnershipTransferResponse]:
    service = AnimalService(db)
    return await service.list_transfers(animal_id, current_user, _extract_ip(request))


@router.post(
    "/{animal_id}/transfers/{transfer_id}/decide",
    response_model=AnimalOwnershipTransferResponse,
    status_code=status.HTTP_200_OK,
    summary="Review and decide (approve or reject) an ownership transfer request"
)
async def decide_transfer(
    animal_id: uuid.UUID,
    transfer_id: uuid.UUID,
    payload: AnimalTransferDecisionRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> AnimalOwnershipTransferResponse:
    service = AnimalService(db)
    return await service.decide_transfer(animal_id, transfer_id, payload, current_user, _extract_ip(request))


@router.post(
    "/{animal_id}/verify",
    response_model=AnimalVerificationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record physical field verification"
)
async def verify_animal(
    animal_id: uuid.UUID,
    payload: AnimalVerificationRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
) -> AnimalVerificationResponse:
    service = AnimalService(db)
    return await service.verify_animal(animal_id, payload, current_user, _extract_ip(request))

