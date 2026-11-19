"""Veterinary Camps Management Service.

Coordinates:
- Camp proposals by Cooperatives / VOs ('camp.propose' / 'camp.coordinate')
- Camp review, confirmation, rescheduling, and cancellation by VOs ('camp.manage')
- Temporal exclusion enforcement preventing overlapping confirmed camps in one village
- Camp staff attendance coordination
- Immutable security audit trails
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Set
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.administration.models import Cooperative
from app.modules.authentication.models import User
from app.modules.authorization.service import AuthorizationService
from app.modules.campaigns.models import Campaign, CampaignVillage
from app.modules.camps.models import Camp, CampStaff
from app.modules.camps.repository import CampRepository
from app.modules.camps.schemas import (
    CampCancelRequest,
    CampCompleteRequest,
    CampConfirmRequest,
    CampCreate,
    CampRescheduleRequest,
    CampResponse,
    CampStaffCreate,
    CampStaffResponse,
)

logger = logging.getLogger("pashurakshak.camps.service")


class CampService:
    """Service orchestrating veterinary camp workflows and scheduling."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = CampRepository(db)
        self.authz_service = AuthorizationService(db)

    async def propose_camp(
        self,
        payload: CampCreate,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> CampResponse:
        """Submit a veterinary camp or doorstep round proposal (DEC-013)."""
        await self.authz_service.assert_any_permission(
            current_user,
            [
                "camp.propose",
                "camp.coordinate",
                "camp.manage",
                "campaign.manage",
                "campaign.configure",
                "district.setup.manage",
            ],
            ip=client_ip
        )

        # Enforce village scope
        await self.authz_service.assert_village_scope(current_user, payload.village_id, ip=client_ip)

        # Validate time ordering
        if payload.planned_end <= payload.planned_start:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Camp planned_end must be strictly after planned_start"
            )

        # Cooperative validation
        if payload.organizer_type in ("COOPERATIVE", "JOINT"):
            if not payload.cooperative_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="cooperative_id is mandatory for COOPERATIVE and JOINT camps"
                )
            coop = await self.db.get(Cooperative, payload.cooperative_id)
            if not coop:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cooperative not found")

        # Validate campaign participation
        campaign = await self.db.get(Campaign, payload.campaign_id)
        if not campaign:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

        cv_stmt = select(CampaignVillage).where(
            CampaignVillage.campaign_id == payload.campaign_id,
            CampaignVillage.village_id == payload.village_id
        )
        if not (await self.db.execute(cv_stmt)).scalars().first():
            if current_user.role in ("DAHO", "SYS_ADMIN"):
                self.db.add(CampaignVillage(campaign_id=payload.campaign_id, village_id=payload.village_id))
                await self.db.flush()
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="The specified village is not registered in this campaign"
                )

        camp = await self.repo.create_camp(
            campaign_id=payload.campaign_id,
            village_id=payload.village_id,
            organizer_type=payload.organizer_type,
            cooperative_id=payload.cooperative_id,
            planned_start=payload.planned_start,
            planned_end=payload.planned_end,
            location_text=payload.location_text,
            proposed_by=current_user.id,
            expected_farmers=payload.expected_farmers,
            vaccine_availability=payload.vaccine_availability,
            vaccine_note=payload.vaccine_note
        )

        await self.repo.record_audit_event(
            action="CAMP_PROPOSED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="camp",
            object_id=str(camp.id),
            reason=f"Proposed {camp.organizer_type} camp in village {camp.village_id}",
            ip=client_ip
        )
        await self.db.commit()
        return CampResponse.model_validate(camp)

    async def confirm_camp(
        self,
        camp_id: uuid.UUID,
        payload: CampConfirmRequest,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> CampResponse:
        """Confirm a proposed camp by Veterinary Officer (DEC-013: VO confirms camps)."""
        await self.authz_service.assert_any_permission(
            current_user,
            ["camp.manage", "campaign.manage"],
            ip=client_ip
        )

        camp = await self.repo.get_camp_by_id(camp_id)
        if not camp:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camp not found")

        # Caller must hold scope in the camp's village
        await self.authz_service.assert_village_scope(current_user, camp.village_id, ip=client_ip)

        if camp.status != "PROPOSED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Only PROPOSED camps can be confirmed (current status: {camp.status})"
            )

        # Enforce no temporal overlap in same village
        has_overlap = await self.repo.has_overlapping_confirmed_camp(
            village_id=camp.village_id,
            planned_start=camp.planned_start,
            planned_end=camp.planned_end,
            exclude_camp_id=camp.id
        )
        if has_overlap:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A confirmed camp already exists in this village during the scheduled time window"
            )

        camp = await self.repo.confirm_camp(
            camp=camp,
            confirmed_by=current_user.id,
            vaccine_availability=payload.vaccine_availability,
            vaccine_note=payload.vaccine_note
        )

        await self.repo.record_audit_event(
            action="CAMP_CONFIRMED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="camp",
            object_id=str(camp.id),
            reason=f"Confirmed camp {camp.camp_code or str(camp.id)} in village {camp.village_id}",
            ip=client_ip
        )

        # Notify camp creator / cooperative staff
        try:
            from app.modules.notifications.service import NotificationService
            from app.models.geography import Village
            notif_service = NotificationService(self.db)
            vil_res = await self.db.execute(select(Village.name_gu).where(Village.id == camp.village_id))
            vil_name = vil_res.scalar_one_or_none() or "બોટાદ"
            if camp.created_by:
                await notif_service.notify(
                    recipient_user_id=camp.created_by,
                    kind="CAMP_CONFIRMED",
                    message_key="CAMP_CONFIRMED",
                    params={
                        "camp_date": camp.planned_start.strftime("%d/%m/%Y"),
                        "village_name": vil_name
                    },
                    related_type="camp",
                    related_id=str(camp.id)
                )
        except Exception as n_err:
            logger.warning("Notification dispatch error on camp confirm: %s", n_err)

        await self.db.commit()
        return CampResponse.model_validate(camp)

    async def cancel_camp(
        self,
        camp_id: uuid.UUID,
        payload: CampCancelRequest,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> CampResponse:
        """Cancel a camp with mandatory documented reason."""
        await self.authz_service.assert_any_permission(
            current_user,
            ["camp.manage", "campaign.manage"],
            ip=client_ip
        )

        camp = await self.repo.get_camp_by_id(camp_id)
        if not camp:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camp not found")

        await self.authz_service.assert_village_scope(current_user, camp.village_id, ip=client_ip)

        if camp.status in ("COMPLETED", "CANCELLED"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot cancel a camp with status '{camp.status}'"
            )

        camp = await self.repo.cancel_camp(
            camp=camp,
            cancelled_by=current_user.id,
            reason=payload.cancelled_reason
        )

        await self.repo.record_audit_event(
            action="CAMP_CANCELLED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="camp",
            object_id=str(camp.id),
            reason=f"Cancelled camp: {payload.cancelled_reason}",
            ip=client_ip
        )
        await self.db.commit()
        return CampResponse.model_validate(camp)

    async def reschedule_camp(
        self,
        camp_id: uuid.UUID,
        payload: CampRescheduleRequest,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> CampResponse:
        """Reschedule a camp to a new time window."""
        await self.authz_service.assert_any_permission(
            current_user,
            ["camp.manage", "campaign.manage"],
            ip=client_ip
        )

        camp = await self.repo.get_camp_by_id(camp_id)
        if not camp:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camp not found")

        await self.authz_service.assert_village_scope(current_user, camp.village_id, ip=client_ip)

        if payload.new_planned_end <= payload.new_planned_start:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="new_planned_end must be strictly after new_planned_start"
            )

        new_camp = await self.repo.reschedule_camp(
            camp=camp,
            rescheduled_by=current_user.id,
            new_start=payload.new_planned_start,
            new_end=payload.new_planned_end,
            reason=payload.reason
        )

        await self.repo.record_audit_event(
            action="CAMP_RESCHEDULED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="camp",
            object_id=str(new_camp.id),
            reason=f"Rescheduled from camp {camp_id}: {payload.reason}",
            ip=client_ip
        )

        # Notify camp creator / staff
        try:
            from app.modules.notifications.service import NotificationService
            from app.models.geography import Village
            notif_service = NotificationService(self.db)
            vil_res = await self.db.execute(select(Village.name_gu).where(Village.id == camp.village_id))
            vil_name = vil_res.scalar_one_or_none() or "બોટાદ"
            if camp.created_by:
                await notif_service.notify(
                    recipient_user_id=camp.created_by,
                    kind="CAMP_RESCHEDULED",
                    message_key="CAMP_RESCHEDULED",
                    params={
                        "camp_date": payload.new_planned_start.strftime("%d/%m/%Y"),
                        "village_name": vil_name
                    },
                    related_type="camp",
                    related_id=str(new_camp.id)
                )
        except Exception as n_err:
            logger.warning("Notification dispatch error on camp reschedule: %s", n_err)

        await self.db.commit()
        return CampResponse.model_validate(new_camp)

    async def complete_camp(
        self,
        camp_id: uuid.UUID,
        payload: CampCompleteRequest,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> CampResponse:
        """Mark camp operations as concluded."""
        await self.authz_service.assert_any_permission(
            current_user,
            ["camp.manage", "campaign.manage"],
            ip=client_ip
        )

        camp = await self.repo.get_camp_by_id(camp_id)
        if not camp:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camp not found")

        await self.authz_service.assert_village_scope(current_user, camp.village_id, ip=client_ip)

        if camp.status != "CONFIRMED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Only CONFIRMED camps can be marked COMPLETED (current status: {camp.status})"
            )

        camp = await self.repo.complete_camp(
            camp=camp,
            completed_by=current_user.id,
            notes=payload.notes
        )

        await self.repo.record_audit_event(
            action="CAMP_COMPLETED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="camp",
            object_id=str(camp.id),
            reason=f"Completed camp {camp.camp_code or str(camp.id)}",
            ip=client_ip
        )
        await self.db.commit()
        return CampResponse.model_validate(camp)

    async def add_staff(
        self,
        camp_id: uuid.UUID,
        payload: CampStaffCreate,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> CampStaffResponse:
        """Assign expected staff attendee to camp (note: camp staff assignment does NOT confer clinical vaccinator authorization)."""
        await self.authz_service.assert_any_permission(
            current_user,
            ["camp.manage", "campaign.manage"],
            ip=client_ip
        )

        camp = await self.repo.get_camp_by_id(camp_id)
        if not camp:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camp not found")

        await self.authz_service.assert_village_scope(current_user, camp.village_id, ip=client_ip)

        target_user = await self.db.get(User, payload.user_id)
        if not target_user or target_user.status != "ACTIVE":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assigned staff user must be active")

        staff = await self.repo.add_camp_staff(
            camp_id=camp.id,
            user_id=payload.user_id,
            camp_role=payload.camp_role,
            assigned_by=current_user.id
        )

        await self.repo.record_audit_event(
            action="CAMP_STAFF_ASSIGNED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="camp_staff",
            object_id=str(camp.id),
            reason=f"Assigned staff {target_user.email} as {payload.camp_role}",
            ip=client_ip
        )
        await self.db.commit()
        return CampStaffResponse.model_validate(staff)

    async def list_camps(
        self,
        status_filter: Optional[str] = None,
        campaign_id: Optional[uuid.UUID] = None,
        cooperative_id: Optional[uuid.UUID] = None,
        offset: int = 0,
        limit: int = 50,
        current_user: User = None,
        client_ip: Optional[str] = None
    ) -> List[CampResponse]:
        """List camps within caller's verified scope."""
        scope = await self.authz_service.assert_any_permission(
            current_user,
            ["camp.manage", "camp.view_coop", "camp.view_public", "aggregate.view"],
            ip=client_ip
        )

        allowed_villages: Optional[Set[uuid.UUID]] = None
        if current_user.role in ("FIELD_WORKER", "VET_OFFICER"):
            allowed_villages = scope.assigned_village_ids
        elif current_user.role == "DAIRY_STAFF":
            allowed_villages = scope.cooperative_village_ids

        camps = await self.repo.list_camps(
            allowed_village_ids=allowed_villages,
            status_filter=status_filter,
            campaign_id=campaign_id,
            cooperative_id=cooperative_id,
            offset=offset,
            limit=limit
        )
        return [CampResponse.model_validate(c) for c in camps]

    async def get_camp(
        self,
        camp_id: uuid.UUID,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> CampResponse:
        """Fetch camp details."""
        await self.authz_service.assert_any_permission(
            current_user,
            ["camp.manage", "camp.view_coop", "camp.view_public", "aggregate.view"],
            ip=client_ip
        )

        camp = await self.repo.get_camp_by_id(camp_id)
        if not camp:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camp not found")
        return CampResponse.model_validate(camp)

