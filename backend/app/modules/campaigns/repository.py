"""Asynchronous database repository for Campaigns domain."""
import uuid
from datetime import date, datetime, timezone
from typing import List, Optional, Set, Tuple
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.animals.models import Animal
from app.modules.authentication.models import AuditEvent, User
from app.modules.campaigns.models import (
    Campaign,
    CampaignAnimalTarget,
    CampaignAssignment,
    CampaignProgramme,
    CampaignVillage,
    CampaignVillageVerification,
    ScheduleVersion,
)


class CampaignRepository:
    """Repository managing campaigns, target villages, programmes, and worker assignments."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_campaign_by_id(self, campaign_id: uuid.UUID) -> Optional[Campaign]:
        """Fetch a campaign by technical primary key."""
        stmt = select(Campaign).where(Campaign.id == campaign_id)
        res = await self.db.execute(stmt)
        return res.scalars().first()

    async def get_campaign_by_code(self, code: str) -> Optional[Campaign]:
        """Fetch a campaign by unique code."""
        stmt = select(Campaign).where(Campaign.code == code.strip())
        res = await self.db.execute(stmt)
        return res.scalars().first()

    async def list_campaigns(
        self,
        allowed_village_ids: Optional[Set[uuid.UUID]] = None,
        allowed_taluka_ids: Optional[Set[uuid.UUID]] = None,
        allowed_district_ids: Optional[Set[uuid.UUID]] = None,
        status_filter: Optional[str] = None,
        offset: int = 0,
        limit: int = 50,
        worker_user_id: Optional[uuid.UUID] = None,
        created_by: Optional[uuid.UUID] = None,
    ) -> List[Campaign]:
        """List campaigns scoped to accessible villages, talukas, districts, worker assignments, or creator."""
        from app.models.geography import Village

        stmt = select(Campaign)

        conditions = []
        if allowed_village_ids:
            conditions.append(
                Campaign.id.in_(
                    select(CampaignVillage.campaign_id).where(
                        CampaignVillage.village_id.in_(allowed_village_ids)
                    )
                )
            )

        if allowed_taluka_ids:
            # 1. Any campaign having villages in the allowed talukas
            conditions.append(
                Campaign.id.in_(
                    select(CampaignVillage.campaign_id)
                    .join(Village, Village.id == CampaignVillage.village_id)
                    .where(Village.taluka_id.in_(allowed_taluka_ids))
                )
            )
            # 2. Any campaign created by TAHO assigned to allowed talukas
            from app.modules.authentication.models import TahoTalukaAssignment
            conditions.append(
                Campaign.created_by.in_(
                    select(TahoTalukaAssignment.taho_user_id).where(
                        TahoTalukaAssignment.taluka_id.in_(allowed_taluka_ids),
                        TahoTalukaAssignment.ended_at.is_(None)
                    )
                )
            )

        if allowed_district_ids:
            # 1. Any campaign having villages in the allowed districts
            conditions.append(
                Campaign.id.in_(
                    select(CampaignVillage.campaign_id)
                    .join(Village, Village.id == CampaignVillage.village_id)
                    .where(Village.district_id.in_(allowed_district_ids))
                )
            )
            # 2. Any campaign created by DAHO assigned to allowed districts
            from app.modules.authentication.models import DahoDistrictAssignment
            conditions.append(
                Campaign.created_by.in_(
                    select(DahoDistrictAssignment.daho_user_id).where(
                        DahoDistrictAssignment.district_id.in_(allowed_district_ids),
                        DahoDistrictAssignment.ended_at.is_(None)
                    )
                )
            )

        if worker_user_id:
            conditions.append(
                Campaign.id.in_(
                    select(CampaignAssignment.campaign_id).where(
                        CampaignAssignment.worker_user_id == worker_user_id,
                        CampaignAssignment.ended_at.is_(None)
                    )
                )
            )

        if created_by:
            conditions.append(Campaign.created_by == created_by)

        # If any scoping filter was passed (even empty)
        has_filter = (
            allowed_village_ids is not None
            or allowed_taluka_ids is not None
            or allowed_district_ids is not None
            or worker_user_id is not None
            or created_by is not None
        )

        if conditions:
            stmt = stmt.where(or_(*conditions))
        elif has_filter:
            return []

        if status_filter:
            stmt = stmt.where(Campaign.status == status_filter)

        stmt = stmt.order_by(Campaign.created_at.desc()).offset(offset).limit(limit)
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def create_campaign(
        self,
        code: str,
        name: str,
        created_by: uuid.UUID,
        schedule_version_id: Optional[uuid.UUID] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Campaign:
        """Create a new campaign record in DRAFT status."""
        campaign = Campaign(
            id=uuid.uuid4(),
            code=code.strip(),
            name=name.strip(),
            status="DRAFT",
            schedule_version_id=schedule_version_id,
            start_date=start_date,
            end_date=end_date,
            created_by=created_by,
            created_at=datetime.now(timezone.utc)
        )
        self.db.add(campaign)
        await self.db.flush()
        return campaign

    async def set_campaign_villages(
        self,
        campaign_id: uuid.UUID,
        village_ids: List[uuid.UUID]
    ) -> None:
        """Associate villages with a campaign."""
        existing = await self.get_campaign_villages(campaign_id)
        existing_set = set(existing)
        for v_id in village_ids:
            if v_id not in existing_set:
                cv = CampaignVillage(campaign_id=campaign_id, village_id=v_id)
                self.db.add(cv)
                existing_set.add(v_id)
        await self.db.flush()

    async def set_campaign_programmes(
        self,
        campaign_id: uuid.UUID,
        programmes: List[Tuple[str, str]]
    ) -> None:
        """Associate species and programme combinations with a campaign."""
        existing = await self.get_campaign_programmes(campaign_id)
        existing_set = {(p.species_code, p.programme_code) for p in existing}
        for species_code, programme_code in programmes:
            sp = species_code.strip()
            pr = programme_code.strip()
            if (sp, pr) not in existing_set:
                cp = CampaignProgramme(
                    campaign_id=campaign_id,
                    species_code=sp,
                    programme_code=pr
                )
                self.db.add(cp)
                existing_set.add((sp, pr))
        await self.db.flush()

    async def get_campaign_villages(self, campaign_id: uuid.UUID) -> List[uuid.UUID]:
        """Fetch all village IDs included in a campaign."""
        stmt = select(CampaignVillage.village_id).where(CampaignVillage.campaign_id == campaign_id)
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def get_campaign_programmes(self, campaign_id: uuid.UUID) -> List[CampaignProgramme]:
        """Fetch all covered programmes for a campaign."""
        stmt = select(CampaignProgramme).where(CampaignProgramme.campaign_id == campaign_id)
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def activate_campaign(
        self,
        campaign: Campaign,
        schedule_version_id: uuid.UUID,
        start_date: date,
        activated_by: uuid.UUID,
        end_date: Optional[date] = None
    ) -> None:
        """Activate campaign and snapshot eligible animal targets per database design."""
        now_utc = datetime.now(timezone.utc)
        campaign.status = "ACTIVE"
        campaign.schedule_version_id = schedule_version_id
        campaign.start_date = start_date
        campaign.end_date = end_date
        campaign.activated_by = activated_by
        campaign.activated_at = now_utc

        # Snapshot eligible animal targets in campaign villages matching campaign species
        villages = await self.get_campaign_villages(campaign.id)
        prog_rows = await self.get_campaign_programmes(campaign.id)

        if villages and prog_rows:
            species_set = {p.species_code for p in prog_rows}
            animals_stmt = select(Animal.id, Animal.species_code).where(
                Animal.village_id.in_(villages),
                Animal.status == "ACTIVE",
                Animal.species_code.in_(species_set)
            )
            animals_res = await self.db.execute(animals_stmt)
            animal_rows = animals_res.fetchall()

            existing_stmt = select(CampaignAnimalTarget.animal_id, CampaignAnimalTarget.programme_code).where(
                CampaignAnimalTarget.campaign_id == campaign.id
            )
            existing_res = await self.db.execute(existing_stmt)
            existing_pairs = {(r[0], r[1]) for r in existing_res.fetchall()}

            for animal_id, sp_code in animal_rows:
                # Find programmes matching this species in campaign
                matching_progs = [p.programme_code for p in prog_rows if p.species_code == sp_code]
                for p_code in matching_progs:
                    if (animal_id, p_code) not in existing_pairs:
                        target = CampaignAnimalTarget(
                            campaign_id=campaign.id,
                            animal_id=animal_id,
                            programme_code=p_code,
                            snapshot_at=now_utc,
                            excluded=False
                        )
                        self.db.add(target)
                        existing_pairs.add((animal_id, p_code))

        await self.db.flush()

    async def count_target_animals(self, campaign_id: uuid.UUID) -> int:
        """Count total snapshotted target animals for the campaign."""
        stmt = select(func.count(func.distinct(CampaignAnimalTarget.animal_id))).where(
            CampaignAnimalTarget.campaign_id == campaign_id,
            CampaignAnimalTarget.excluded.is_(False)
        )
        res = await self.db.execute(stmt)
        return res.scalar() or 0

    async def get_active_assignment(
        self,
        campaign_id: uuid.UUID,
        village_id: uuid.UUID,
        worker_user_id: uuid.UUID
    ) -> Optional[CampaignAssignment]:
        """Fetch active assignment for worker in village for this campaign."""
        stmt = select(CampaignAssignment).where(
            CampaignAssignment.campaign_id == campaign_id,
            CampaignAssignment.village_id == village_id,
            CampaignAssignment.worker_user_id == worker_user_id,
            CampaignAssignment.ended_at.is_(None)
        )
        res = await self.db.execute(stmt)
        return res.scalars().first()

    async def create_assignment(
        self,
        campaign_id: uuid.UUID,
        village_id: uuid.UUID,
        worker_user_id: uuid.UUID,
        assigned_by: uuid.UUID
    ) -> CampaignAssignment:
        """Assign field worker to a campaign village."""
        assignment = CampaignAssignment(
            id=uuid.uuid4(),
            campaign_id=campaign_id,
            village_id=village_id,
            worker_user_id=worker_user_id,
            assigned_by=assigned_by,
            assigned_at=datetime.now(timezone.utc)
        )
        self.db.add(assignment)
        await self.db.flush()
        return assignment

    async def list_assignments(
        self,
        campaign_id: uuid.UUID,
        village_id: Optional[uuid.UUID] = None
    ) -> List[CampaignAssignment]:
        """List assignments for a campaign."""
        stmt = select(CampaignAssignment).where(
            CampaignAssignment.campaign_id == campaign_id,
            CampaignAssignment.ended_at.is_(None)
        )
        if village_id:
            stmt = stmt.where(CampaignAssignment.village_id == village_id)
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def record_audit_event(
        self,
        action: str,
        result: str,
        actor_user_id: Optional[uuid.UUID],
        actor_role: Optional[str],
        object_type: Optional[str] = None,
        object_id: Optional[str] = None,
        village_id: Optional[uuid.UUID] = None,
        reason: Optional[str] = None,
        ip: Optional[str] = None
    ) -> None:
        """Record an immutable audit event for campaign actions."""
        evt = AuditEvent(
            action=action,
            result=result,
            actor_user_id=actor_user_id,
            actor_role=actor_role,
            object_type=object_type,
            object_id=object_id,
            village_id=village_id,
            reason=reason,
            ip=ip
        )
        self.db.add(evt)
        await self.db.flush()

    async def get_village_verification(
        self,
        campaign_id: uuid.UUID,
        village_id: uuid.UUID
    ) -> Optional[CampaignVillageVerification]:
        """Fetch village verification record for a campaign."""
        stmt = select(CampaignVillageVerification).where(
            CampaignVillageVerification.campaign_id == campaign_id,
            CampaignVillageVerification.village_id == village_id
        )
        res = await self.db.execute(stmt)
        return res.scalars().first()

    async def upsert_village_verification(
        self,
        campaign_id: uuid.UUID,
        village_id: uuid.UUID,
        status: Optional[str] = None,
        assigned_vo_id: Optional[uuid.UUID] = None,
        assigned_fw_id: Optional[uuid.UUID] = None,
        animals_visited_count: Optional[int] = None,
        vaccinations_completed_count: Optional[int] = None,
        pending_animals_count: Optional[int] = None,
        field_observations: Optional[str] = None,
        completion_notes: Optional[str] = None,
        evidence_photo_urls: Optional[List[str]] = None,
        submitted_by: Optional[uuid.UUID] = None,
        submitted_at: Optional[datetime] = None,
        verified_by: Optional[uuid.UUID] = None,
        verified_at: Optional[datetime] = None,
        verification_notes: Optional[str] = None,
        rejection_reason: Optional[str] = None,
        reopened_by: Optional[uuid.UUID] = None,
        reopened_at: Optional[datetime] = None,
    ) -> CampaignVillageVerification:
        """Create or update a village verification record."""
        verif = await self.get_village_verification(campaign_id, village_id)
        now_dt = datetime.now(timezone.utc)
        if not verif:
            verif = CampaignVillageVerification(
                id=uuid.uuid4(),
                campaign_id=campaign_id,
                village_id=village_id,
                status=status or "ASSIGNED",
                assigned_vo_id=assigned_vo_id,
                assigned_fw_id=assigned_fw_id,
                animals_visited_count=animals_visited_count or 0,
                vaccinations_completed_count=vaccinations_completed_count or 0,
                pending_animals_count=pending_animals_count or 0,
                field_observations=field_observations,
                completion_notes=completion_notes,
                evidence_photo_urls=evidence_photo_urls or [],
                submitted_by=submitted_by,
                submitted_at=submitted_at,
                verified_by=verified_by,
                verified_at=verified_at,
                verification_notes=verification_notes,
                rejection_reason=rejection_reason,
                reopened_by=reopened_by,
                reopened_at=reopened_at,
                created_at=now_dt,
                updated_at=now_dt
            )
            self.db.add(verif)
        else:
            if status is not None:
                verif.status = status
            if assigned_vo_id is not None:
                verif.assigned_vo_id = assigned_vo_id
            if assigned_fw_id is not None:
                verif.assigned_fw_id = assigned_fw_id
            if animals_visited_count is not None:
                verif.animals_visited_count = animals_visited_count
            if vaccinations_completed_count is not None:
                verif.vaccinations_completed_count = vaccinations_completed_count
            if pending_animals_count is not None:
                verif.pending_animals_count = pending_animals_count
            if field_observations is not None:
                verif.field_observations = field_observations
            if completion_notes is not None:
                verif.completion_notes = completion_notes
            if evidence_photo_urls is not None:
                verif.evidence_photo_urls = evidence_photo_urls
            if submitted_by is not None:
                verif.submitted_by = submitted_by
            if submitted_at is not None:
                verif.submitted_at = submitted_at
            if verified_by is not None:
                verif.verified_by = verified_by
            if verified_at is not None:
                verif.verified_at = verified_at
            if verification_notes is not None:
                verif.verification_notes = verification_notes
            if rejection_reason is not None:
                verif.rejection_reason = rejection_reason
            if reopened_by is not None:
                verif.reopened_by = reopened_by
            if reopened_at is not None:
                verif.reopened_at = reopened_at
            verif.updated_at = now_dt

        await self.db.flush()
        return verif

    async def list_village_verifications(
        self,
        campaign_id: uuid.UUID,
        status: Optional[str] = None
    ) -> List[CampaignVillageVerification]:
        """List village verification items for a campaign."""
        stmt = select(CampaignVillageVerification).where(CampaignVillageVerification.campaign_id == campaign_id)
        if status:
            stmt = stmt.where(CampaignVillageVerification.status == status)
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def end_active_assignments(
        self,
        campaign_id: uuid.UUID,
        village_id: uuid.UUID,
        worker_user_id: Optional[uuid.UUID] = None
    ) -> None:
        """End active assignments for village/campaign to preserve historical records on reassignment."""
        stmt = select(CampaignAssignment).where(
            CampaignAssignment.campaign_id == campaign_id,
            CampaignAssignment.village_id == village_id,
            CampaignAssignment.ended_at.is_(None)
        )
        if worker_user_id:
            stmt = stmt.where(CampaignAssignment.worker_user_id == worker_user_id)
        res = await self.db.execute(stmt)
        now_dt = datetime.now(timezone.utc)
        for ca in res.scalars().all():
            ca.ended_at = now_dt
        await self.db.flush()


