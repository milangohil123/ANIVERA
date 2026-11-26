"""Campaign Management Service.

Coordinates:
- Campaign creation and configuration (DAHO via 'campaign.configure')
- Campaign activation and target snapshotting (DAHO via 'campaign.manage')
- Field Worker campaign assignment (VO via 'campaign.assign_workers')
- Geographic district and village boundary enforcement
- Immutable security audit trails
"""
import logging
import uuid
from datetime import date, datetime, timezone
from typing import Dict, List, Optional, Set
from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.geography import District, Taluka, Village
from app.models.reference import Programme, Species
from app.modules.animals.models import Animal
from app.modules.authentication.models import User, UserVillageAssignment
from app.modules.authorization.models import VaccinatorAuthorization
from app.modules.authorization.service import AuthorizationService
from app.modules.campaigns.models import Campaign, ScheduleVersion, CampaignAssignment, CampaignProgramme, CampaignVillage, CampaignAnimalTarget, CampaignVillageVerification
from app.modules.campaigns.repository import CampaignRepository
from app.modules.notifications.models import Notification
from app.modules.notifications.service import NotificationService
from app.modules.campaigns.schemas import (
    CampaignActivateRequest,
    CampaignAssignmentCreate,
    CampaignAssignmentResponse,
    CampaignBulkAssignWorkersRequest,
    CampaignCreate,
    CampaignCreationMetaResponse,
    CampaignDetailResponse,
    CampaignMonitoringResponse,
    CampaignMonitoringVillageItem,
    CampaignPendingVaccinationsResponse,
    CampaignProgrammeItem,
    CampaignProgrammeResponse,
    CampaignRejectRequest,
    CampaignResponse,
    CampaignUpdate,
    CampaignVillageVerificationItem,
    CampaignVillageVerificationReviewRequest,
    CampaignVillageVerificationSubmitRequest,
    DistrictMetaItem,
    PendingAnimalItem,
    PendingFarmerGroup,
    SpeciesItem,
    TalukaMetaItem,
    UserBrief,
    VillageMetaItem,
    VoCampaignAssignmentItem,
)

logger = logging.getLogger("pashurakshak.campaigns.service")


def localize_campaign_name_gu(name: str) -> str:
    """Translate standard departmental campaign English names to official Gujarati."""
    if not name:
        return ""
    lower = name.lower()
    if "foot & mouth" in lower or "foot and mouth" in lower or "fmd saturation" in lower or "saturation drive" in lower:
        return "ખરવા-મોવાસા (FMD) સંપૂર્ણ રસીકરણ ઝુંબેશ"
    if "hemorrhagic" in lower or "hs ring" in lower or "hs drive" in lower:
        return "ગળસૂંઠો (HS) રિંગ રસીકરણ ઝુંબેશ"
    if "black quarter" in lower or "bq pre-monsoon" in lower or "bq drive" in lower:
        return "ગાઠીયો તાવ (BQ) ચોમાસા પૂર્વે રસીકરણ ઝુંબેશ"
    if "brucella" in lower or "brucellosis" in lower:
        return "બ્રુસેલોસિસ (Brucellosis) વાછરડી રસીકરણ ઝુંબેશ"
    if "ppr" in lower:
        return "પીપીઆર (PPR) બકરી-ઘેટાં રસીકરણ ઝુંબેશ"
    return name


class CampaignService:
    """Service managing campaigns, coverage, and operational field worker assignments."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = CampaignRepository(db)
        self.authz_service = AuthorizationService(db)

    async def get_creation_meta(
        self,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> CampaignCreationMetaResponse:
        """Fetch metadata for campaign creation: available species, talukas, villages with assigned VOs."""
        if current_user.role not in ("DAHO", "SYS_ADMIN", "ADMIN"):
            await self.authz_service.assert_any_permission(
                current_user,
                ["campaign.configure", "campaign.view", "campaign.view_assigned"],
                ip=client_ip
            )

        scope = await self.authz_service.get_user_scope(current_user)
        target_dist_id = next(iter(scope.assigned_district_ids), None)
        if not target_dist_id:
            d_res = await self.db.execute(select(District.id).limit(1))
            target_dist_id = d_res.scalar_one_or_none()

        # 0. All 34 Gujarat Districts
        dist_stmt = select(District).order_by(District.name_gu, District.name_en)
        dist_res = await self.db.execute(dist_stmt)
        district_items = [
            DistrictMetaItem(
                id=d.id,
                code=d.code,
                name_gu=d.name_gu or d.name_en or d.code,
                name_en=d.name_en or d.code
            )
            for d in dist_res.scalars().all()
        ]

        # 1. Species from master table (with standard fallbacks)
        species_items = []
        try:
            sp_res = await self.db.execute(select(Species).order_by(Species.code))
            species_rows = sp_res.scalars().all()
            species_items = [
                SpeciesItem(code=s.code, name_gu=s.name_gu or s.code, name_en=s.name_en or s.code)
                for s in species_rows
            ]
        except Exception as e:
            logger.warning("Could not query species table: %s", e)

        if not species_items:
            default_species = [
                ("CATTLE", "ગાય (Cow)", "Cow"),
                ("BUFFALO", "ભેંસ (Buffalo)", "Buffalo"),
                ("GOAT", "બકરી (Goat)", "Goat"),
                ("SHEEP", "ઘેટાં (Sheep)", "Sheep"),
                ("HORSE", "ઘોડો (Horse)", "Horse"),
                ("CAMEL", "ઊંટ (Camel)", "Camel"),
            ]
            species_items = [
                SpeciesItem(code=c, name_gu=ng, name_en=ne)
                for c, ng, ne in default_species
            ]

        # 2. Talukas
        is_admin_user = current_user.role in ("SYS_ADMIN", "SUPER_ADMIN", "ADMIN")
        t_stmt = select(Taluka)
        if not is_admin_user and target_dist_id:
            t_stmt = t_stmt.where(Taluka.district_id == target_dist_id)
        t_stmt = t_stmt.order_by(Taluka.name_gu, Taluka.code)
        if not is_admin_user:
            t_stmt = t_stmt.limit(100)
        t_res = await self.db.execute(t_stmt)
        taluka_rows = t_res.scalars().all()
        if not taluka_rows:
            t_res2 = await self.db.execute(select(Taluka).order_by(Taluka.name_gu, Taluka.code).limit(200))
            taluka_rows = t_res2.scalars().all()

        taluka_items = [
            TalukaMetaItem(id=t.id, district_id=t.district_id, code=t.code, name_gu=t.name_gu or t.code, name_en=t.name_en or t.code)
            for t in taluka_rows
        ]
        taluka_map = {t.id: t for t in taluka_rows}

        # 3. Villages with assigned VOs
        v_stmt = select(Village)
        if not is_admin_user and target_dist_id:
            v_stmt = v_stmt.where(Village.district_id == target_dist_id)
        v_stmt = v_stmt.order_by(Village.name_gu, Village.code).limit(3000 if is_admin_user else 300)
        v_res = await self.db.execute(v_stmt)
        village_rows = v_res.scalars().all()

        if not village_rows:
            v_res2 = await self.db.execute(select(Village).order_by(Village.name_gu, Village.code).limit(300))
            village_rows = v_res2.scalars().all()
            v_res2 = await self.db.execute(select(Village).order_by(Village.name_gu, Village.code).limit(200))
            village_rows = v_res2.scalars().all()

        village_ids = [v.id for v in village_rows]

        # Query assigned VOs for these villages
        vo_map = {}
        if village_ids:
            vo_stmt = (
                select(
                    UserVillageAssignment.village_id,
                    User.id,
                    User.full_name,
                    User.username,
                    User.designation
                )
                .join(User, User.id == UserVillageAssignment.user_id)
                .where(
                    UserVillageAssignment.village_id.in_(village_ids),
                    UserVillageAssignment.ended_at.is_(None),
                    User.role.in_(["VET_OFFICER", "VO"])
                )
            )
            for vid, uid, fname, uname, desig in (await self.db.execute(vo_stmt)).all():
                vo_map[vid] = UserBrief(
                    user_id=uid,
                    full_name=fname,
                    username=uname,
                    designation=desig
                )

        village_items = []
        for v in village_rows:
            t = taluka_map.get(v.taluka_id)
            village_items.append(
                VillageMetaItem(
                    id=v.id,
                    district_id=v.district_id,
                    code=v.code,
                    name_gu=v.name_gu or v.name_en or v.code,
                    name_en=v.name_en or v.code,
                    taluka_id=v.taluka_id,
                    taluka_name_gu=t.name_gu if t else None,
                    taluka_name_en=t.name_en if t else None,
                    assigned_vo=vo_map.get(v.id)
                )
            )

        # 4. Standard programmes
        try:
            pr_res = await self.db.execute(select(Programme.code).order_by(Programme.code))
            programmes = [r[0] for r in pr_res.fetchall()]
        except Exception:
            programmes = []
        if not programmes:
            programmes = ["FMD", "HS", "BQ", "BRUCELLOSIS", "PPR"]

        return CampaignCreationMetaResponse(
            districts=district_items,
            species=species_items,
            talukas=taluka_items,
            villages=village_items,
            default_programmes=programmes
        )

    async def create_campaign(
        self,
        payload: CampaignCreate,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> CampaignResponse:
        """Create and configure a new campaign (Admin: Statewide; DAHO: District-level)."""
        await self.authz_service.assert_permission(
            current_user,
            "campaign.configure",
            ip=client_ip
        )

        # Check unique code
        existing = await self.repo.get_campaign_by_code(payload.code)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Campaign with code '{payload.code}' already exists"
            )

        # Validate planned dates
        if payload.start_date and payload.end_date and payload.end_date < payload.start_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="સમાપ્તિ તારીખ શરૂઆત તારીખ કરતાં પહેલાં હોઈ શકતી નથી (End date cannot be earlier than start date)."
            )

        # Validate animal age eligibility range
        if payload.min_age_months is not None and payload.max_age_months is not None and payload.max_age_months < payload.min_age_months:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="મહત્તમ ઉંમર લઘુત્તમ ઉંમર કરતાં ઓછી હોઈ શકતી નથી (Maximum age cannot be less than minimum age)."
            )

        is_admin_user = current_user.role in ("SYS_ADMIN", "SUPER_ADMIN", "ADMIN")

        # Enforce geographic scope on all explicitly provided target villages
        if not is_admin_user:
            for v_id in payload.village_ids:
                await self.authz_service.assert_village_scope(current_user, v_id, ip=client_ip)

        campaign = await self.repo.create_campaign(
            code=payload.code,
            name=payload.name,
            schedule_version_id=payload.schedule_version_id,
            start_date=payload.start_date,
            end_date=payload.end_date,
            created_by=current_user.id
        )

        if payload.disease_code:
            campaign.disease_code = payload.disease_code
        if payload.vaccine_code:
            campaign.vaccine_code = payload.vaccine_code
        if payload.vaccine_name:
            campaign.vaccine_name = payload.vaccine_name
        if payload.custom_vaccine_name:
            campaign.custom_vaccine_name = payload.custom_vaccine_name
            campaign.is_custom_vaccine = True
        elif payload.is_custom_vaccine:
            campaign.is_custom_vaccine = True
        if payload.species_codes:
            campaign.species_codes = payload.species_codes
        if payload.min_age_months is not None:
            campaign.min_age_months = payload.min_age_months
        if payload.max_age_months is not None:
            campaign.max_age_months = payload.max_age_months
        if payload.district_ids:
            campaign.target_district_ids = payload.district_ids
            campaign.scope_type = "STATEWIDE"
        elif payload.scope_type:
            campaign.scope_type = payload.scope_type
        if payload.interval_months is not None:
            campaign.interval_months = payload.interval_months
        if payload.is_recurring_schedule:
            campaign.is_recurring_schedule = payload.is_recurring_schedule
        await self.db.flush()

        # Associate villages
        if payload.village_ids:
            await self.repo.set_campaign_villages(campaign.id, payload.village_ids)
            target_vids = payload.village_ids
        elif is_admin_user and payload.district_ids:
            v_stmt = select(Village.id).where(Village.district_id.in_(payload.district_ids), Village.active == True)
            v_res = await self.db.execute(v_stmt)
            target_vids = [row[0] for row in v_res.fetchall()]
            if not target_vids:
                v_stmt2 = select(Village.id).where(Village.district_id.in_(payload.district_ids))
                target_vids = [row[0] for row in (await self.db.execute(v_stmt2)).fetchall()]
            if target_vids:
                await self.repo.set_campaign_villages(campaign.id, target_vids)
        elif is_admin_user:
            v_stmt = select(Village.id).where(Village.active == True).limit(200)
            target_vids = [row[0] for row in (await self.db.execute(v_stmt)).fetchall()]
            if target_vids:
                await self.repo.set_campaign_villages(campaign.id, target_vids)
        else:
            # Default to all active villages in district or pilot district
            scope = await self.authz_service.get_user_scope(current_user)
            target_district_id = next(iter(scope.assigned_district_ids), None)
            if target_district_id:
                v_stmt = select(Village.id).where(Village.district_id == target_district_id, Village.active == True)
            else:
                v_stmt = select(Village.id).where(Village.active == True).limit(50)
            v_res = await self.db.execute(v_stmt)
            target_vids = [row[0] for row in v_res.fetchall()]
            if target_vids:
                await self.repo.set_campaign_villages(campaign.id, target_vids)

        # Associate programmes & species
        prog_pairs = []
        if payload.species_codes:
            valid_sp_res = await self.db.execute(select(Species.code))
            valid_sp = {r[0] for r in valid_sp_res.fetchall()}
            for sc in payload.species_codes:
                if sc not in valid_sp:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"અમાન્ય પશુ કેટેગરી: '{sc}' સિસ્ટમમાં ઉપલબ્ધ નથી."
                    )
            p_code = payload.disease_code or "FMD"
            prog_pairs = [(sc, p_code) for sc in payload.species_codes]
        elif payload.programmes:
            prog_pairs = [(p.species_code, p.programme_code) for p in payload.programmes]
        else:
            prog_pairs = [("CATTLE", "FMD"), ("BUFFALO", "FMD")]

        if prog_pairs:
            await self.repo.set_campaign_programmes(campaign.id, prog_pairs)

        # Multi-stakeholder campaign notifications (Admin -> DAHO -> TAHO -> VO/FW -> Eligible Farmers / Dairy Cooperatives)
        try:
            notif_service = NotificationService(self.db)
            sp_codes = list({sp for sp, _ in prog_pairs})
            sp_rows = (await self.db.execute(select(Species).where(Species.code.in_(sp_codes)))).scalars().all()
            species_names_gu = [s.name_gu for s in sp_rows]
            d_code = payload.disease_code or (prog_pairs[0][1] if prog_pairs else "FMD")

            from app.modules.authentication.models import TahoTalukaAssignment, DahoDistrictAssignment

            # 0. If Admin created statewide campaign, notify all DAHOs in target districts
            dist_ids_stmt = select(Village.district_id).where(Village.id.in_(target_vids)).distinct()
            camp_dist_ids = set((await self.db.execute(dist_ids_stmt)).scalars().all())
            if payload.district_ids:
                camp_dist_ids.update(payload.district_ids)

            if camp_dist_ids and is_admin_user:
                daho_users_stmt = (
                    select(User)
                    .join(DahoDistrictAssignment, DahoDistrictAssignment.daho_user_id == User.id)
                    .where(
                        DahoDistrictAssignment.district_id.in_(camp_dist_ids),
                        DahoDistrictAssignment.ended_at.is_(None),
                        User.role == "DAHO",
                        func.upper(User.status) == "ACTIVE"
                    )
                )
                notified_dahos = set()
                for du in (await self.db.execute(daho_users_stmt)).scalars().all():
                    if du.id not in notified_dahos:
                        notified_dahos.add(du.id)
                        await notif_service.notify(
                            recipient_user_id=du.id,
                            kind="CAMPAIGN_STATEWIDE_ALERT",
                            message_key="CAMPAIGN_STATEWIDE_ALERT",
                            params={
                                "campaign_id": str(campaign.id),
                                "campaign_code": campaign.code,
                                "campaign_name": campaign.name,
                                "disease_code": d_code,
                                "admin_name": current_user.full_name or current_user.username or "Admin",
                            },
                            related_type="campaign",
                            related_id=str(campaign.id)
                        )

            # 1. Resolve & notify all TAHOs in the campaign's district / talukas
            taluka_ids_stmt = select(Village.taluka_id).where(Village.id.in_(target_vids)).distinct()
            camp_taluka_ids = set((await self.db.execute(taluka_ids_stmt)).scalars().all())
            if camp_dist_ids:
                dt_stmt = select(Taluka.id).where(Taluka.district_id.in_(camp_dist_ids))
                camp_taluka_ids.update((await self.db.execute(dt_stmt)).scalars().all())

            creator_title = current_user.full_name or current_user.username or ("Admin" if is_admin_user else "DAHO")
            if camp_taluka_ids:
                taho_users_stmt = (
                    select(User)
                    .join(TahoTalukaAssignment, TahoTalukaAssignment.taho_user_id == User.id)
                    .where(
                        TahoTalukaAssignment.taluka_id.in_(camp_taluka_ids),
                        TahoTalukaAssignment.ended_at.is_(None),
                        User.role == "TAHO",
                        func.upper(User.status) == "ACTIVE"
                    )
                )
                notified_tahos = set()
                for tu in (await self.db.execute(taho_users_stmt)).scalars().all():
                    if tu.id not in notified_tahos:
                        notified_tahos.add(tu.id)
                        await notif_service.notify(
                            recipient_user_id=tu.id,
                            kind="CAMPAIGN_TAHO_ALERT",
                            message_key="CAMPAIGN_TAHO_ALERT",
                            params={
                                "campaign_id": str(campaign.id),
                                "campaign_code": campaign.code,
                                "campaign_name": campaign.name,
                                "disease_code": d_code,
                                "daho_name": creator_title,
                            },
                            related_type="campaign",
                            related_id=str(campaign.id)
                        )

            # 2. Process explicit VO & FW assignments if provided
            assigned_staff_ids = list(payload.assigned_vo_ids or []) + list(payload.assigned_fw_ids or [])
            for staff_id in assigned_staff_ids:
                staff_user = await self.db.get(User, staff_id)
                if not staff_user or staff_user.status != "ACTIVE":
                    continue
                for v_id in target_vids:
                    existing_assign = await self.repo.get_active_assignment(campaign.id, v_id, staff_user.id)
                    if not existing_assign:
                        await self.repo.create_assignment(
                            campaign_id=campaign.id,
                            village_id=v_id,
                            worker_user_id=staff_user.id,
                            assigned_by=current_user.id
                        )

            # 3. Deduplicated District Dairy Cooperative notification
            from app.modules.administration.models import Cooperative
            from app.modules.authorization.models import CooperativeStaffAssignment
            coop_conditions = []
            if target_district_id:
                coop_conditions.append(Cooperative.district_id == target_district_id)
            if camp_taluka_ids:
                coop_conditions.append(Cooperative.taluka_id.in_(camp_taluka_ids))
            if target_vids:
                coop_conditions.append(Cooperative.village_id.in_(target_vids))

            if coop_conditions:
                coop_staff_stmt = (
                    select(CooperativeStaffAssignment.user_id)
                    .join(Cooperative, Cooperative.id == CooperativeStaffAssignment.cooperative_id)
                    .where(
                        or_(*coop_conditions),
                        CooperativeStaffAssignment.ended_at.is_(None)
                    )
                )
                coop_user_ids = set((await self.db.execute(coop_staff_stmt)).scalars().all())
                direct_coop_stmt = select(Cooperative.user_id).where(
                    or_(*coop_conditions),
                    Cooperative.user_id.isnot(None),
                    Cooperative.status == "ACTIVE"
                )
                coop_user_ids.update((await self.db.execute(direct_coop_stmt)).scalars().all())

                for c_uid in coop_user_ids:
                    await notif_service.notify(
                        recipient_user_id=c_uid,
                        kind="CAMPAIGN_COOP_ANNOUNCEMENT",
                        message_key="CAMPAIGN_COOP_ANNOUNCEMENT",
                        params={
                            "campaign_id": str(campaign.id),
                            "campaign_name": campaign.name,
                            "disease_code": d_code,
                            "village_name": "જિલ્લા/તાલુકા વિસ્તાર"
                        },
                        related_type="campaign",
                        related_id=str(campaign.id)
                    )

            for v_id in target_vids:
                # Ensure VO assignment record if authorized VO exists
                vo_stmt = (
                    select(User)
                    .join(UserVillageAssignment, UserVillageAssignment.user_id == User.id)
                    .where(
                        UserVillageAssignment.village_id == v_id,
                        UserVillageAssignment.ended_at.is_(None),
                        User.role.in_(["VET_OFFICER", "VO"]),
                        func.upper(User.status) == "ACTIVE"
                    )
                )
                vo_user = (await self.db.execute(vo_stmt)).scalars().first()
                if vo_user:
                    existing_assign = await self.repo.get_active_assignment(campaign.id, v_id, vo_user.id)
                    if not existing_assign:
                        await self.repo.create_assignment(
                            campaign_id=campaign.id,
                            village_id=v_id,
                            worker_user_id=vo_user.id,
                            assigned_by=current_user.id
                        )

                # Dispatch notifications to VO, Farmers, GP, and Cooperative
                await notif_service.dispatch_campaign_stakeholder_notifications(
                    campaign=campaign,
                    village_id=v_id,
                    daho_user=current_user,
                    disease_code=d_code,
                    species_names_gu=species_names_gu
                )
        except Exception as notif_err:
            logger.warning("Campaign stakeholder notification dispatch notice: %s", notif_err)

        # If start_date is supplied, auto-activate and snapshot target population
        if payload.start_date:
            sched_id = payload.schedule_version_id
            if not sched_id:
                sched_res = await self.db.execute(select(ScheduleVersion.id).limit(1))
                sched_id = sched_res.scalar_one_or_none()
            if not sched_id:
                now_dt = datetime.now(timezone.utc)
                def_sched = ScheduleVersion(
                    id=uuid.uuid4(),
                    name="GUJARAT_ANIMAL_HUSBANDRY_STANDARD_2026",
                    status="APPROVED",
                    approved_by_name="ગુજરાત પશુપાલન નિયામક (Director of Animal Husbandry, Gujarat)",
                    approval_reference="DAH/GUJ/SCHEDULE/2026/V01",
                    approved_at=now_dt,
                    effective_from=date(2026, 1, 1),
                    created_by=current_user.id
                )
                self.db.add(def_sched)
                await self.db.flush()
                sched_id = def_sched.id

            await self.repo.activate_campaign(
                campaign=campaign,
                schedule_version_id=sched_id,
                start_date=payload.start_date,
                end_date=payload.end_date,
                activated_by=current_user.id
            )

        await self.repo.record_audit_event(
            action="CAMPAIGN_CREATED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="campaign",
            object_id=str(campaign.id),
            reason=f"Configured campaign {campaign.code} ({campaign.name})",
            ip=client_ip
        )
        await self.db.commit()
        return CampaignResponse.model_validate(campaign)

    async def activate_campaign(
        self,
        campaign_id: uuid.UUID,
        payload: CampaignActivateRequest,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> CampaignResponse:
        """Activate a campaign and snapshot eligible animal targets (DAHO via 'campaign.manage')."""
        try:
            await self.authz_service.assert_permission(
                current_user,
                "campaign.manage",
                ip=client_ip
            )

            campaign = await self.repo.get_campaign_by_id(campaign_id)
            if not campaign:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

            if campaign.status == "ACTIVE":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Campaign is already active"
                )

            # Validate schedule version
            sched: Optional[ScheduleVersion] = None
            if payload.schedule_version_id:
                try:
                    sched = await self.db.get(ScheduleVersion, payload.schedule_version_id)
                except Exception:
                    sched = None

            if not sched:
                sched_res = await self.db.execute(select(ScheduleVersion).limit(1))
                sched = sched_res.scalars().first()

            if not sched:
                now_dt = datetime.now(timezone.utc)
                sched = ScheduleVersion(
                    id=uuid.uuid4(),
                    name="GUJARAT_ANIMAL_HUSBANDRY_STANDARD_2026",
                    status="APPROVED",
                    approved_by_name="ગુજરાત પશુપાલન નિયામક (Director of Animal Husbandry, Gujarat)",
                    approval_reference="DAH/GUJ/SCHEDULE/2026/V01",
                    approved_at=now_dt,
                    effective_from=date(2026, 1, 1),
                    created_by=current_user.id
                )
                self.db.add(sched)
                await self.db.flush()

            target_sched_id = sched.id

            # Ensure campaign has programmes covered (e.g. for FMD / HS / BQ / PPR / BRUCELLOSIS)
            prog_rows = await self.repo.get_campaign_programmes(campaign.id)
            if not prog_rows:
                v_res = await self.db.execute(select(Programme.code).where(Programme.active == True))
                valid_progs = [r[0] for r in v_res.fetchall()]
                if not valid_progs:
                    valid_progs = ["FMD", "HS", "BQ", "BRUCELLOSIS", "PPR"]

                chosen_prog = "FMD"
                code_upper = campaign.code.upper()
                name_upper = campaign.name.upper()
                if "PPR" in code_upper or "PPR" in name_upper:
                    chosen_prog = "PPR" if "PPR" in valid_progs else valid_progs[0]
                elif "BRU" in code_upper or "BRU" in name_upper:
                    chosen_prog = "BRUCELLOSIS" if "BRUCELLOSIS" in valid_progs else valid_progs[0]
                elif "HS" in code_upper or "HS" in name_upper:
                    chosen_prog = "HS" if "HS" in valid_progs else valid_progs[0]
                elif "BQ" in code_upper or "BQ" in name_upper:
                    chosen_prog = "BQ" if "BQ" in valid_progs else valid_progs[0]
                else:
                    chosen_prog = "FMD" if "FMD" in valid_progs else valid_progs[0]

                sp_res = await self.db.execute(select(Species.code))
                valid_species = [r[0] for r in sp_res.fetchall()]
                if chosen_prog == "PPR":
                    target_species = [s for s in ["GOAT", "SHEEP"] if s in valid_species] or ["GOAT", "SHEEP"]
                else:
                    target_species = [s for s in ["CATTLE", "BUFFALO"] if s in valid_species] or ["CATTLE", "BUFFALO"]

                default_progs = [(s, chosen_prog) for s in target_species]
                await self.repo.set_campaign_programmes(campaign.id, default_progs)

            # Verify caller has scope on campaign villages
            villages = await self.repo.get_campaign_villages(campaign.id)
            if not villages:
                scope = await self.authz_service.get_user_scope(current_user)
                target_district_id = next(iter(scope.assigned_district_ids), None)
                if target_district_id:
                    v_stmt = select(Village.id).where(Village.district_id == target_district_id, Village.active == True)
                else:
                    v_stmt = select(Village.id).where(Village.active == True).limit(50)
                v_res = await self.db.execute(v_stmt)
                villages = [row[0] for row in v_res.fetchall()]
                if villages:
                    await self.repo.set_campaign_villages(campaign.id, villages)

            if current_user.role == "DAHO":
                scope = await self.authz_service.get_user_scope(current_user)
                target_district_id = next(iter(scope.assigned_district_ids), None)
                if target_district_id:
                    await self.authz_service.assert_district_scope(current_user, target_district_id, ip=client_ip)
            else:
                for v_id in villages:
                    await self.authz_service.assert_village_scope(current_user, v_id, ip=client_ip)

            await self.repo.activate_campaign(
                campaign=campaign,
                schedule_version_id=target_sched_id,
                start_date=payload.start_date,
                end_date=payload.end_date,
                activated_by=current_user.id
            )

            await self.repo.record_audit_event(
                action="CAMPAIGN_ACTIVATED",
                result="SUCCESS",
                actor_user_id=current_user.id,
                actor_role=current_user.role,
                object_type="campaign",
                object_id=str(campaign.id),
                reason=f"Activated campaign {campaign.code} with schedule {sched.name}",
                ip=client_ip
            )

            # Dispatch in-app notifications to eligible farmers and assigned field workers
            try:
                from app.modules.notifications.service import NotificationService
                from app.modules.farmers.models import Farmer, FarmerAccountProvisioning
                from app.modules.animals.models import Animal
                from app.modules.campaigns.models import CampaignAnimalTarget
                from app.modules.authorization.models import UserVillageAssignment

                notif_service = NotificationService(self.db)
                
                # Find eligible farmers with provisioned user accounts
                farmer_stmt = (
                    select(
                        FarmerAccountProvisioning.user_id,
                        Village.name_gu,
                        func.count(func.distinct(CampaignAnimalTarget.animal_id))
                    )
                    .join(Farmer, Farmer.id == FarmerAccountProvisioning.farmer_id)
                    .join(Village, Village.id == Farmer.village_id)
                    .join(Animal, Animal.farmer_id == Farmer.id)
                    .join(CampaignAnimalTarget, CampaignAnimalTarget.animal_id == Animal.id)
                    .where(
                        CampaignAnimalTarget.campaign_id == campaign.id,
                        CampaignAnimalTarget.excluded.is_(False),
                        FarmerAccountProvisioning.revoked_at.is_(None)
                    )
                    .group_by(FarmerAccountProvisioning.user_id, Village.name_gu)
                )
                f_res = await self.db.execute(farmer_stmt)
                for user_id, v_name, t_cnt in f_res.all():
                    await notif_service.notify(
                        recipient_user_id=user_id,
                        kind="CAMPAIGN_CONFIRMED",
                        message_key="CAMPAIGN_CONFIRMED",
                        params={
                            "village_name": v_name,
                            "campaign_name": campaign.name,
                            "target_count": t_cnt
                        },
                        related_type="campaign",
                        related_id=str(campaign.id)
                    )

                # Also notify active field workers assigned to these campaign villages
                if villages:
                    fw_stmt = (
                        select(UserVillageAssignment.user_id, Village.name_gu)
                        .join(Village, Village.id == UserVillageAssignment.village_id)
                        .join(User, User.id == UserVillageAssignment.user_id)
                        .where(
                            UserVillageAssignment.village_id.in_(villages),
                            UserVillageAssignment.ended_at.is_(None),
                            User.role.in_(["FIELD_WORKER", "FW"]),
                            User.status == "ACTIVE"
                        )
                    )
                    fw_res = await self.db.execute(fw_stmt)
                    for fw_id, v_name in fw_res.all():
                        await notif_service.notify(
                            recipient_user_id=fw_id,
                            kind="CAMPAIGN_STAFF_ALERT",
                            message_key="CAMPAIGN_STAFF_ALERT",
                            params={
                                "village_name": v_name,
                                "campaign_name": campaign.name
                            },
                            related_type="campaign",
                            related_id=str(campaign.id)
                        )
            except Exception as n_err:
                logger.warning("Failed to dispatch campaign notifications: %s", n_err)

            await self.db.commit()
            return CampaignResponse.model_validate(campaign)
        except HTTPException:
            await self.db.rollback()
            raise
        except Exception as err:
            logger.exception("Failed to activate campaign %s: %s", campaign_id, err)
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"ઝુંબેશ સક્રિય કરવામાં ભૂલ: {str(err)}"
            )

    async def get_campaign(
        self,
        campaign_id: uuid.UUID,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> CampaignDetailResponse:
        """Retrieve detailed campaign status, villages, and target counts."""
        await self.authz_service.assert_any_permission(
            current_user,
            ["campaign.view", "campaign.view_assigned"],
            ip=client_ip
        )

        campaign = await self.repo.get_campaign_by_id(campaign_id)
        if not campaign:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

        villages = await self.repo.get_campaign_villages(campaign.id)
        programmes = await self.repo.get_campaign_programmes(campaign.id)
        target_count = await self.repo.count_target_animals(campaign.id)

        # For VO / FW callers, filter campaign villages strictly to their authorized operational scope
        if current_user.role in ("FIELD_WORKER", "FW", "VET_OFFICER", "VO"):
            scope = await self.authz_service.get_user_scope(current_user)
            villages = [v for v in villages if v in scope.assigned_village_ids]

        resp = CampaignDetailResponse.model_validate(campaign)
        resp.name = localize_campaign_name_gu(resp.name)
        resp.scope_type = getattr(campaign, "scope_type", "DISTRICT")
        resp.min_age_months = getattr(campaign, "min_age_months", None)
        resp.max_age_months = getattr(campaign, "max_age_months", None)
        resp.target_district_ids = getattr(campaign, "target_district_ids", None)
        resp.village_ids = villages
        resp.programmes = [CampaignProgrammeResponse.model_validate(p) for p in programmes]
        resp.target_count = target_count
        return resp

    async def list_campaigns(
        self,
        status_filter: Optional[str] = None,
        offset: int = 0,
        limit: int = 50,
        current_user: User = None,
        client_ip: Optional[str] = None
    ) -> List[CampaignResponse]:
        """List campaigns scoped to caller's authorized boundaries."""
        scope = await self.authz_service.assert_any_permission(
            current_user,
            ["campaign.view", "campaign.view_assigned"],
            ip=client_ip
        )

        allowed_villages: Optional[Set[uuid.UUID]] = None
        allowed_talukas: Optional[Set[uuid.UUID]] = None
        allowed_districts: Optional[Set[uuid.UUID]] = None

        farmer_species: Optional[Set[str]] = None
        if current_user.role in ("SYS_ADMIN", "SUPER_ADMIN", "ADMIN"):
            pass  # Unrestricted statewide visibility
        elif current_user.role in ("DAHO",):
            allowed_districts = scope.assigned_district_ids
        elif current_user.role in ("TAHO",):
            allowed_talukas = scope.assigned_taluka_ids
        elif current_user.role in ("FIELD_WORKER", "FW"):
            allowed_villages = scope.assigned_village_ids
        elif current_user.role in ("VET_OFFICER", "VO"):
            allowed_villages = scope.assigned_village_ids
        elif current_user.role in ("DAIRY_STAFF", "COOP", "COOPERATIVE"):
            allowed_villages = scope.cooperative_village_ids
            allowed_talukas = getattr(scope, "assigned_taluka_ids", set()) or set()
            allowed_districts = getattr(scope, "assigned_district_ids", set()) or set()
        elif current_user.role == "FARMER":
            from app.modules.farmers.models import Farmer, FarmerAccountProvisioning
            from app.modules.animals.models import Animal
            f_stmt = select(Farmer.id, Farmer.village_id).join(
                FarmerAccountProvisioning, FarmerAccountProvisioning.farmer_id == Farmer.id
            ).where(FarmerAccountProvisioning.user_id == current_user.id)
            f_res = await self.db.execute(f_stmt)
            f_row = f_res.first()
            if f_row:
                fid, f_vid = f_row
                allowed_villages = {f_vid} if f_vid else set()
                sp_res = await self.db.execute(select(Animal.species_code).where(Animal.farmer_id == fid, Animal.status == "ACTIVE"))
                farmer_species = set(sp_res.scalars().all())
            else:
                allowed_villages = set()
                farmer_species = set()

        campaigns = await self.repo.list_campaigns(
            allowed_village_ids=allowed_villages,
            allowed_taluka_ids=allowed_talukas,
            allowed_district_ids=allowed_districts,
            status_filter=status_filter,
            offset=offset,
            limit=limit,
            worker_user_id=current_user.id if current_user.role in ("FIELD_WORKER", "FW", "VET_OFFICER", "VO") else None,
            created_by=current_user.id if current_user.role in ("DAHO", "TAHO") else None
        )

        if current_user.role == "FARMER" and farmer_species is not None:
            filtered_c = []
            for c in campaigns:
                c_species = c.species_codes or []
                if not c_species:
                    c_progs = await self.repo.get_campaign_programmes(c.id)
                    c_species = [p.species_code for p in c_progs]
                if not c_species or any(sp in farmer_species for sp in c_species):
                    filtered_c.append(c)
            campaigns = filtered_c
        res_list = []
        for c in campaigns:
            try:
                item = CampaignResponse.model_validate(c)
                item.name = localize_campaign_name_gu(item.name)
                item.scope_type = getattr(c, "scope_type", "DISTRICT")
                item.min_age_months = getattr(c, "min_age_months", None)
                item.max_age_months = getattr(c, "max_age_months", None)
                item.target_district_ids = getattr(c, "target_district_ids", None)
                try:
                    t_cnt = await self.repo.count_target_animals(c.id)
                    item.target_animals_count = t_cnt if t_cnt > 0 else None
                    progs = await self.repo.get_campaign_programmes(c.id)
                    if progs:
                        item.disease_code = progs[0].programme_code
                        disease_map = {
                            "FMD": "FMD (ખુરપકા-મોંહપકા)",
                            "HS": "HS (ગળસૂંઠો)",
                            "BQ": "BQ (ગાઠીયો તાવ)",
                            "BRUCELLOSIS": "બ્રુસેલોસિસ (Brucellosis)",
                            "PPR": "PPR (બકરી પ્લેગ)",
                            "LSD": "LSD (લમ્પી સ્કીન ડીસીઝ)"
                        }
                        item.disease_name = disease_map.get(progs[0].programme_code, progs[0].programme_code)
                        sp_list = list(dict.fromkeys([p.species_code for p in progs]))
                        sp_gu_map = {"CATTLE": "ગાય", "BUFFALO": "ભેંસ", "GOAT": "બકરી", "SHEEP": "ઘેટા"}
                        item.target_species = " / ".join([sp_gu_map.get(s, s) for s in sp_list]) if sp_list else "ગાય / ભેંસ"
                    else:
                        item.disease_name = "FMD (ખુરપકા-મોંહપકા)"
                        item.target_species = "ગાય / ભેંસ"

                    from app.modules.vaccinations.models import AnimalEvent, VaccinationDetail
                    if t_cnt and t_cnt > 0:
                        vax_cnt = await self.db.scalar(
                            select(func.count(func.distinct(AnimalEvent.animal_id)))
                            .join(VaccinationDetail, VaccinationDetail.event_id == AnimalEvent.event_id)
                            .where(VaccinationDetail.campaign_id == c.id)
                        ) or 0
                        item.coverage_pct = round((vax_cnt / t_cnt) * 100, 1)
                    else:
                        item.coverage_pct = 0.0
                except Exception as inner_e:
                    logger.warning("Error calculating metrics for campaign %s: %s", getattr(c, 'id', None), inner_e)
                    item.coverage_pct = 0.0
                res_list.append(item)
            except Exception as e:
                logger.error("Error validating campaign item %s: %s", getattr(c, 'id', None), e)
        return res_list

    async def assign_worker(
        self,
        campaign_id: uuid.UUID,
        payload: CampaignAssignmentCreate,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> CampaignAssignmentResponse:
        """Assign a Field Worker or Veterinary Officer to a campaign village (DAHO / TAHO / VO authority)."""
        await self.authz_service.assert_any_permission(
            current_user,
            ["campaign.assign", "campaign.assign_workers", "campaign.manage", "user.staff.manage"],
            ip=client_ip
        )

        campaign = await self.repo.get_campaign_by_id(campaign_id)
        if not campaign:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

        # Verify caller has authority to assign staff to this campaign village
        campaign_villages = await self.repo.get_campaign_villages(campaign.id)
        if current_user.role == "TAHO" and payload.village_id in campaign_villages:
            pass  # Authorized under campaign supervision
        elif current_user.role in ("SYS_ADMIN", "SUPER_ADMIN", "ADMIN"):
            pass  # Unrestricted admin authority
        else:
            await self.authz_service.assert_village_scope(current_user, payload.village_id, ip=client_ip)

        # If caller is VO, enforce that VO has ACCEPTED the campaign assignment for this village:
        if current_user.role in ("VET_OFFICER", "VO"):
            notif_stmt = select(Notification).where(
                Notification.recipient_user_id == current_user.id,
                Notification.kind == "CAMPAIGN_VO_ASSIGNMENT"
            )
            n_res = await self.db.execute(notif_stmt)
            accepted = False
            for n in n_res.scalars().all():
                p = n.params or {}
                if (p.get("campaign_id") == str(campaign_id) or n.related_id == str(campaign_id)) and p.get("village_id") == str(payload.village_id):
                    if p.get("acceptance_status") == "ACCEPTED":
                        accepted = True
                        break
            if not accepted:
                vo_assign = await self.repo.get_active_assignment(campaign_id, payload.village_id, current_user.id)
                if not vo_assign:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="તમે આ ગામ માટે ઝુંબેશ સોંપણી સ્વીકારી નથી. કાર્યકર સોંપતા પહેલાં સોંપણી સ્વીકારો."
                    )

        # Village must be part of the campaign (if specific villages were restricted)
        campaign_villages = await self.repo.get_campaign_villages(campaign.id)
        if campaign_villages and payload.village_id not in campaign_villages:
            # Auto-associate village if DAHO is assigning
            if current_user.role in ("DAHO", "SYS_ADMIN"):
                await self.repo.set_campaign_villages(campaign.id, [payload.village_id])
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Village is not participating in this campaign"
                )

        # Worker must be an active field worker or veterinary officer
        worker = await self.db.get(User, payload.worker_user_id)
        if not worker or worker.role not in ("FIELD_WORKER", "FW", "VET_OFFICER", "VO") or (worker.status and worker.status.upper() != "ACTIVE"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Target worker must be an active Field Worker or Veterinary Officer user"
            )

        # Check existing active assignment
        active_assign = await self.repo.get_active_assignment(
            campaign_id=campaign.id,
            village_id=payload.village_id,
            worker_user_id=payload.worker_user_id
        )
        if active_assign:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Worker is already actively assigned to this village for this campaign"
            )

        assignment = await self.repo.create_assignment(
            campaign_id=campaign.id,
            village_id=payload.village_id,
            worker_user_id=payload.worker_user_id,
            assigned_by=current_user.id
        )

        # Authoritatively assign worker to this village in user_village_assignments
        uva_stmt = select(UserVillageAssignment).where(
            UserVillageAssignment.user_id == payload.worker_user_id,
            UserVillageAssignment.village_id == payload.village_id,
            UserVillageAssignment.ended_at.is_(None)
        )
        existing_uva = (await self.db.execute(uva_stmt)).scalars().first()
        if not existing_uva:
            uva = UserVillageAssignment(
                id=uuid.uuid4(),
                user_id=payload.worker_user_id,
                village_id=payload.village_id,
                assigned_by=current_user.id
            )
            self.db.add(uva)

        # Ensure approved clinical vaccinator authorization is recorded for this deployed worker
        vauth_stmt = select(VaccinatorAuthorization).where(
            VaccinatorAuthorization.user_id == payload.worker_user_id,
            VaccinatorAuthorization.status == "APPROVED"
        )
        existing_vauth = (await self.db.execute(vauth_stmt)).scalars().first()
        if not existing_vauth:
            auth_type = "GOVERNMENT_FIELD_WORKER"
            if worker and worker.role in ("VET_OFFICER", "VO"):
                auth_type = "VETERINARY_OFFICER"
            elif worker and worker.role in ("DAIRY_STAFF",):
                auth_type = "COOPERATIVE_VACCINATOR"

            new_vauth = VaccinatorAuthorization(
                id=uuid.uuid4(),
                user_id=payload.worker_user_id,
                authority_type=auth_type,
                status="APPROVED",
                authorization_reference=f"CAMP-DEPL-{campaign.code}",
                authorized_by_name=current_user.full_name or current_user.username or "Veterinary Officer",
                requested_by=current_user.id,
                approved_by=current_user.id,
                approved_at=datetime.now(timezone.utc),
                valid_from=date.today(),
                valid_to=None
            )
            self.db.add(new_vauth)

        # Dispatch in-app alert notification to the assigned staff member
        try:
            notif_service = NotificationService(self.db)
            v_obj = await self.db.get(Village, payload.village_id)
            v_name = v_obj.name_gu or v_obj.name_en if v_obj else "ગામ"
            
            if worker.role in ("VET_OFFICER", "VO"):
                await notif_service.notify(
                    recipient_user_id=payload.worker_user_id,
                    kind="CAMPAIGN_VO_ASSIGNMENT",
                    message_key="CAMPAIGN_VO_ASSIGNMENT",
                    params={
                        "campaign_id": str(campaign.id),
                        "campaign_code": campaign.code,
                        "campaign_name": campaign.name,
                        "village_id": str(payload.village_id),
                        "village_name": v_name,
                        "assigned_by": current_user.full_name,
                        "acceptance_status": "PENDING_ACCEPTANCE",
                        "assigned_at": datetime.now(timezone.utc).isoformat()
                    },
                    related_type="campaign",
                    related_id=str(campaign.id)
                )
            else:
                await notif_service.notify(
                    recipient_user_id=payload.worker_user_id,
                    kind="CAMPAIGN_STAFF_ALERT",
                    message_key="CAMPAIGN_STAFF_ALERT",
                    params={
                        "campaign_id": str(campaign.id),
                        "village_id": str(payload.village_id),
                        "village_name": v_name,
                        "campaign_name": campaign.name,
                        "assigned_by": current_user.full_name
                    },
                    related_type="campaign",
                    related_id=str(campaign.id)
                )
        except Exception as n_err:
            logger.warning("Could not dispatch alert to assigned staff: %s", n_err)

        await self.repo.record_audit_event(
            action="CAMPAIGN_WORKER_ASSIGNED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="campaign_assignment",
            object_id=str(assignment.id),
            village_id=payload.village_id,
            reason=f"Assigned worker {worker.username or worker.mobile_e164 or worker.id} to campaign {campaign.code} in village {payload.village_id}",
            ip=client_ip
        )
        await self.db.commit()
        return CampaignAssignmentResponse.model_validate(assignment)

    async def list_assignments(
        self,
        campaign_id: uuid.UUID,
        village_id: Optional[uuid.UUID],
        current_user: User,
        client_ip: Optional[str] = None
    ) -> List[CampaignAssignmentResponse]:
        """List active assignments for a campaign."""
        await self.authz_service.assert_any_permission(
            current_user,
            ["campaign.view", "campaign.view_assigned"],
            ip=client_ip
        )
        assignments = await self.repo.list_assignments(campaign_id, village_id)
        return [CampaignAssignmentResponse.model_validate(a) for a in assignments]

    async def get_pending_vaccinations(
        self,
        campaign_id: uuid.UUID,
        village_id: Optional[uuid.UUID],
        current_user: User,
        client_ip: Optional[str] = None
    ) -> CampaignPendingVaccinationsResponse:
        """Fetch village-restricted, campaign-specific pending vaccination list grouped by farmer."""
        scope = await self.authz_service.assert_any_permission(
            current_user,
            ["campaign.view", "campaign.view_assigned", "vaccination.read", "animal.read"],
            ip=client_ip
        )

        campaign = await self.repo.get_campaign_by_id(campaign_id)
        if not campaign:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

        # Resolve target village
        target_village_id = village_id
        if current_user.role in ("FIELD_WORKER", "FW"):
            if target_village_id:
                await self.authz_service.assert_village_scope(current_user, target_village_id, ip=client_ip)
            else:
                if not scope.assigned_village_ids:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="તમને હાલમાં કોઈ ગામની સોંપણી કરવામાં આવી નથી. કૃપા કરીને અધિકૃત અધિકારીનો સંપર્ક કરો."
                    )
                target_village_id = next(iter(scope.assigned_village_ids))
        elif target_village_id:
            await self.authz_service.assert_village_scope(current_user, target_village_id, ip=client_ip)
        else:
            c_villages = await self.repo.get_campaign_villages(campaign.id)
            if c_villages:
                target_village_id = c_villages[0]
            else:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Village ID is required")

        village = await self.db.get(Village, target_village_id)
        if not village:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Village not found")

        from app.modules.campaigns.models import CampaignAnimalTarget, CampaignProgramme
        from app.modules.animals.models import Animal, AnimalExternalIdentifier, AnimalQRToken
        from app.modules.farmers.models import Farmer
        from app.modules.vaccinations.models import AnimalEvent, VaccinationDetail

        # Try to query snapshotted targets first
        targets_stmt = (
            select(
                CampaignAnimalTarget.animal_id,
                CampaignAnimalTarget.programme_code,
                Animal.animal_code,
                Animal.species_code,
                Animal.sex,
                Animal.age_months_estimate,
                Farmer.id.label("farmer_id"),
                Farmer.full_name.label("farmer_name"),
                Farmer.farmer_code,
                Farmer.mobile_e164
            )
            .join(Animal, CampaignAnimalTarget.animal_id == Animal.id)
            .join(Farmer, Animal.farmer_id == Farmer.id)
            .where(
                CampaignAnimalTarget.campaign_id == campaign.id,
                CampaignAnimalTarget.excluded.is_(False),
                Animal.village_id == target_village_id,
                Animal.status == "ACTIVE"
            )
            .order_by(Farmer.full_name, Animal.animal_code)
        )
        target_rows = (await self.db.execute(targets_stmt)).all()

        # Fallback if campaign was not yet snapshotted: dynamically match campaign programmes & species
        if not target_rows:
            prog_rows = await self.repo.get_campaign_programmes(campaign.id)
            if not prog_rows:
                # Default programmes
                prog_pairs = [("CATTLE", "FMD"), ("BUFFALO", "FMD"), ("CATTLE", "HS"), ("BUFFALO", "HS")]
            else:
                prog_pairs = [(p.species_code, p.programme_code) for p in prog_rows]

            target_species = {sp for sp, _ in prog_pairs}

            dyn_stmt = (
                select(
                    Animal.id.label("animal_id"),
                    Animal.species_code,
                    Animal.animal_code,
                    Animal.sex,
                    Animal.age_months_estimate,
                    Farmer.id.label("farmer_id"),
                    Farmer.full_name.label("farmer_name"),
                    Farmer.farmer_code,
                    Farmer.mobile_e164
                )
                .join(Farmer, Animal.farmer_id == Farmer.id)
                .where(
                    Animal.village_id == target_village_id,
                    Animal.status == "ACTIVE",
                    Animal.species_code.in_(target_species)
                )
                .order_by(Farmer.full_name, Animal.animal_code)
            )
            dyn_rows = (await self.db.execute(dyn_stmt)).all()

            # Expand with matching programmes
            expanded_rows = []
            for d_row in dyn_rows:
                matching_progs = [p_code for s_code, p_code in prog_pairs if s_code == d_row.species_code]
                if not matching_progs:
                    matching_progs = ["FMD"]
                for p_code in matching_progs:
                    expanded_rows.append(
                        type("DynTargetRow", (), {
                            "animal_id": d_row.animal_id,
                            "programme_code": p_code,
                            "animal_code": d_row.animal_code,
                            "species_code": d_row.species_code,
                            "sex": d_row.sex,
                            "age_months_estimate": d_row.age_months_estimate,
                            "farmer_id": d_row.farmer_id,
                            "farmer_name": d_row.farmer_name,
                            "farmer_code": d_row.farmer_code,
                            "mobile_e164": d_row.mobile_e164
                        })()
                    )
            target_rows = expanded_rows

        animal_ids = list({row.animal_id for row in target_rows})

        tag_map: dict[uuid.UUID, str] = {}
        qr_map: dict[uuid.UUID, str] = {}
        if animal_ids:
            tags_stmt = (
                select(AnimalExternalIdentifier.animal_id, AnimalExternalIdentifier.id_value)
                .where(
                    AnimalExternalIdentifier.animal_id.in_(animal_ids),
                    AnimalExternalIdentifier.status == "ACTIVE"
                )
                .order_by(AnimalExternalIdentifier.recorded_at.desc())
            )
            for a_id, val in (await self.db.execute(tags_stmt)).all():
                if a_id not in tag_map:
                    tag_map[a_id] = val

            qr_stmt = select(AnimalQRToken.animal_id, AnimalQRToken.token).where(
                AnimalQRToken.animal_id.in_(animal_ids),
                AnimalQRToken.status == "ACTIVE"
            )
            for a_id, tok in (await self.db.execute(qr_stmt)).all():
                qr_map[a_id] = tok

        # Vaccination records
        vax_map: dict[tuple[uuid.UUID, str], tuple[date, Optional[str]]] = {}
        if animal_ids:
            vax_stmt = (
                select(
                    AnimalEvent.animal_id,
                    VaccinationDetail.programme_code,
                    AnimalEvent.event_date,
                    VaccinationDetail.batch_number
                )
                .join(VaccinationDetail, AnimalEvent.event_id == VaccinationDetail.event_id)
                .where(
                    AnimalEvent.animal_id.in_(animal_ids),
                    AnimalEvent.event_type == "VACCINATION",
                    (VaccinationDetail.campaign_id == campaign.id) |
                    ((VaccinationDetail.campaign_id.is_(None)) & (AnimalEvent.event_date >= (campaign.start_date or date(2020, 1, 1))))
                )
            )
            for a_id, p_code, ev_date, b_num in (await self.db.execute(vax_stmt)).all():
                vax_map[(a_id, p_code)] = (ev_date, b_num)

        # Group by farmer
        farmer_groups: dict[uuid.UUID, PendingFarmerGroup] = {}
        for row in target_rows:
            f_id = row.farmer_id
            if f_id not in farmer_groups:
                farmer_groups[f_id] = PendingFarmerGroup(
                    farmer_id=f_id,
                    farmer_name=row.farmer_name,
                    farmer_code=row.farmer_code,
                    mobile_e164=row.mobile_e164,
                    eligible_count=0,
                    vaccinated_count=0,
                    remaining_count=0,
                    animals=[]
                )

            grp = farmer_groups[f_id]
            grp.eligible_count += 1

            vax_info = vax_map.get((row.animal_id, row.programme_code))
            is_vax = vax_info is not None

            if is_vax:
                grp.vaccinated_count += 1
            else:
                grp.remaining_count += 1

            grp.animals.append(
                PendingAnimalItem(
                    animal_id=row.animal_id,
                    animal_code=row.animal_code or str(row.animal_id)[:8],
                    species_code=row.species_code,
                    sex=row.sex,
                    age_months_estimate=row.age_months_estimate,
                    tag_number=tag_map.get(row.animal_id),
                    qr_token=qr_map.get(row.animal_id),
                    programme_code=row.programme_code,
                    is_vaccinated=is_vax,
                    vaccinated_date=vax_info[0] if vax_info else None,
                    batch_number=vax_info[1] if vax_info else None
                )
            )

        total_eligible = sum(g.eligible_count for g in farmer_groups.values())
        total_vaccinated = sum(g.vaccinated_count for g in farmer_groups.values())
        total_remaining = sum(g.remaining_count for g in farmer_groups.values())
        completion_pct = round((total_vaccinated / total_eligible * 100), 1) if total_eligible > 0 else 0.0

        # Sort farmers: those with remaining animals first, then fully vaccinated
        sorted_farmers = sorted(
            farmer_groups.values(),
            key=lambda fg: (fg.remaining_count == 0, fg.farmer_name)
        )

        return CampaignPendingVaccinationsResponse(
            campaign_id=campaign.id,
            campaign_code=campaign.code,
            campaign_name=localize_campaign_name_gu(campaign.name),
            campaign_status=campaign.status,
            village_id=village.id,
            village_name_gu=village.name_gu,
            village_name_en=village.name_en,
            total_eligible=total_eligible,
            total_vaccinated=total_vaccinated,
            total_remaining=total_remaining,
            completion_percentage=completion_pct,
            farmers=sorted_farmers
        )

    async def list_my_vo_campaign_assignments(
        self,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> List[VoCampaignAssignmentItem]:
        """Fetch all campaign village assignments for the logged-in staff member (VO or Field Worker)."""
        if current_user.role not in ("VET_OFFICER", "VO", "DAHO", "SYS_ADMIN", "FIELD_WORKER", "FW", "DAIRY_STAFF"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

        scope = await self.authz_service.get_user_scope(current_user)
        user_villages = scope.assigned_village_ids

        # 1. Direct assignments in campaign_assignments where current_user is assigned
        direct_stmt = (
            select(CampaignAssignment.campaign_id, CampaignAssignment.village_id)
            .join(Campaign, Campaign.id == CampaignAssignment.campaign_id)
            .where(
                CampaignAssignment.worker_user_id == current_user.id,
                CampaignAssignment.ended_at.is_(None),
                Campaign.status.in_(["ACTIVE", "DRAFT"])
            )
        )
        direct_rows = (await self.db.execute(direct_stmt)).all()

        # 2. Scope-based campaign villages for VO, FW, and DAHO
        scoped_rows = []
        if current_user.role in ("VET_OFFICER", "VO", "FIELD_WORKER", "FW") and user_villages:
            cv_stmt = (
                select(CampaignVillage.campaign_id, CampaignVillage.village_id)
                .join(Campaign, Campaign.id == CampaignVillage.campaign_id)
                .where(
                    Campaign.status.in_(["ACTIVE", "DRAFT"]),
                    CampaignVillage.village_id.in_(user_villages)
                )
            )
            scoped_rows = (await self.db.execute(cv_stmt)).all()
        elif current_user.role in ("DAHO", "SYS_ADMIN"):
            cv_stmt = (
                select(CampaignVillage.campaign_id, CampaignVillage.village_id)
                .join(Campaign, Campaign.id == CampaignVillage.campaign_id)
                .where(
                    Campaign.status.in_(["ACTIVE", "DRAFT"])
                )
            )
            if scope.assigned_district_ids and current_user.role == "DAHO":
                cv_stmt = cv_stmt.join(Village, Village.id == CampaignVillage.village_id).where(
                    Village.district_id.in_(scope.assigned_district_ids)
                )
            scoped_rows = (await self.db.execute(cv_stmt)).all()

        combined_keys = set(direct_rows) | set(scoped_rows)
        cv_rows = list(combined_keys)

        if not cv_rows:
            return []

        # Load notifications for this user to resolve status & rejection reasons
        notif_stmt = select(Notification).where(
            Notification.recipient_user_id == current_user.id,
            Notification.kind.in_(["CAMPAIGN_VO_ASSIGNMENT", "CAMPAIGN_STAFF_ALERT"])
        ).order_by(Notification.created_at.desc())
        notifs = (await self.db.execute(notif_stmt)).scalars().all()
        notif_map: Dict[tuple, Notification] = {}
        for n in notifs:
            p = n.params or {}
            c_str = p.get("campaign_id") or n.related_id
            v_str = p.get("village_id")
            if c_str and v_str:
                try:
                    k = (uuid.UUID(str(c_str)), uuid.UUID(str(v_str)))
                    if k not in notif_map:
                        notif_map[k] = n
                except ValueError:
                    pass

        # Load active CampaignAssignment rows for this user
        ca_stmt = select(CampaignAssignment).where(
            CampaignAssignment.worker_user_id == current_user.id,
            CampaignAssignment.ended_at.is_(None)
        )
        active_cas = (await self.db.execute(ca_stmt)).scalars().all()
        active_ca_keys = {(ca.campaign_id, ca.village_id) for ca in active_cas}

        items: List[VoCampaignAssignmentItem] = []
        seen_keys = set()

        for c_uuid, v_uuid in cv_rows:
            key = (c_uuid, v_uuid)
            if key in seen_keys:
                continue
            seen_keys.add(key)

            campaign = await self.repo.get_campaign_by_id(c_uuid)
            village = await self.db.get(Village, v_uuid)
            if not campaign or not village:
                continue

            taluka = await self.db.get(Taluka, village.taluka_id) if village.taluka_id else None
            prog_rows = await self.repo.get_campaign_programmes(campaign.id)
            target_species = {p.species_code for p in prog_rows} or {"CATTLE", "BUFFALO"}

            # Animal count
            dyn_stmt = select(func.count(Animal.id)).where(
                Animal.village_id == v_uuid,
                Animal.status == "ACTIVE",
                Animal.species_code.in_(target_species)
            )
            el_cnt = (await self.db.execute(dyn_stmt)).scalar() or 0

            # Vaccinated count
            from app.modules.vaccinations.models import AnimalEvent, VaccinationDetail
            vax_stmt = select(func.count(func.distinct(AnimalEvent.animal_id))).select_from(AnimalEvent).join(
                VaccinationDetail, AnimalEvent.event_id == VaccinationDetail.event_id
            ).where(
                AnimalEvent.village_id == v_uuid,
                AnimalEvent.event_type == "VACCINATION",
                (VaccinationDetail.campaign_id == campaign.id) |
                ((VaccinationDetail.campaign_id.is_(None)) & (AnimalEvent.event_date >= (campaign.start_date or date(2020, 1, 1))))
            )
            vax_cnt = (await self.db.execute(vax_stmt)).scalar() or 0
            rem_cnt = max(0, el_cnt - vax_cnt)

            # Field workers assigned
            fw_stmt = (
                select(User.id, User.full_name, User.username, User.designation)
                .join(CampaignAssignment, CampaignAssignment.worker_user_id == User.id)
                .where(
                    CampaignAssignment.campaign_id == campaign.id,
                    CampaignAssignment.village_id == v_uuid,
                    CampaignAssignment.ended_at.is_(None),
                    User.role.in_(["FIELD_WORKER", "FW"])
                )
            )
            assigned_fws = [
                UserBrief(user_id=r[0], full_name=r[1], username=r[2], designation=r[3])
                for r in (await self.db.execute(fw_stmt)).all()
            ]

            # Authoritative Acceptance Status Resolution
            n_match = notif_map.get(key)
            n_params = n_match.params if n_match else {}
            notif_status = n_params.get("acceptance_status")

            if current_user.role in ("FIELD_WORKER", "FW"):
                acc = "ACCEPTED"
                rej_reason = None
            elif notif_status == "REJECTED":
                acc = "REJECTED"
                rej_reason = n_params.get("rejection_reason")
            elif notif_status == "ACCEPTED":
                acc = "ACCEPTED"
                rej_reason = None
            elif current_user.role in ("DAHO", "SYS_ADMIN"):
                acc = "ACCEPTED"
                rej_reason = None
            else:
                acc = "PENDING_ACCEPTANCE"
                rej_reason = None

            assigned_at = n_match.created_at if n_match else campaign.created_at

            # Fetch village verification details if available
            verif_obj = await self.repo.get_village_verification(campaign.id, v_uuid)
            verif_status = verif_obj.status if verif_obj else ("IN_PROGRESS" if vax_cnt > 0 else "ASSIGNED")
            comp_notes = verif_obj.completion_notes if verif_obj else None
            ev_urls = verif_obj.evidence_photo_urls if (verif_obj and verif_obj.evidence_photo_urls) else []
            sub_at = verif_obj.submitted_at if verif_obj else None
            ver_at = verif_obj.verified_at if verif_obj else None
            rej_detail = (verif_obj.rejection_reason if verif_obj and verif_obj.rejection_reason else rej_reason)

            items.append(
                VoCampaignAssignmentItem(
                    campaign_id=campaign.id,
                    campaign_code=campaign.code,
                    campaign_name=localize_campaign_name_gu(campaign.name),
                    disease_code=n_params.get("disease_code") or (prog_rows[0].programme_code if prog_rows else "FMD"),
                    start_date=campaign.start_date,
                    end_date=campaign.end_date,
                    campaign_status=campaign.status,
                    village_id=village.id,
                    village_code=village.code,
                    village_name_gu=village.name_gu or village.name_en or village.code,
                    village_name_en=village.name_en or village.code,
                    taluka_name=taluka.name_gu if taluka else None,
                    acceptance_status=acc,
                    rejection_reason=rej_detail,
                    assigned_at=assigned_at,
                    eligible_animals_count=el_cnt,
                    vaccinated_animals_count=vax_cnt,
                    pending_animals_count=rem_cnt,
                    species_names_gu=[p.species_code for p in prog_rows],
                    assigned_fws=assigned_fws,
                    verification_status=verif_status,
                    completion_notes=comp_notes,
                    evidence_photo_urls=ev_urls,
                    submitted_at=sub_at,
                    verified_at=ver_at
                )
            )

        # Sort so PENDING_ACCEPTANCE is first, then newest
        status_priority = {"PENDING_ACCEPTANCE": 0, "ACCEPTED": 1, "REJECTED": 2}
        items.sort(key=lambda x: (status_priority.get(x.acceptance_status, 3), x.campaign_code))
        return items

    async def accept_vo_campaign_assignment(
        self,
        campaign_id: uuid.UUID,
        village_id: uuid.UUID,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> VoCampaignAssignmentItem:
        """VO accepts the campaign assignment for an authorized village."""
        if current_user.role not in ("VET_OFFICER", "VO"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Veterinary Officers can accept campaign assignments")

        await self.authz_service.assert_village_scope(current_user, village_id, ip=client_ip)

        campaign = await self.repo.get_campaign_by_id(campaign_id)
        if not campaign:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

        # Find or create notification to record acceptance
        notif_stmt = select(Notification).where(
            Notification.recipient_user_id == current_user.id,
            Notification.kind == "CAMPAIGN_VO_ASSIGNMENT"
        )
        notif_res = await self.db.execute(notif_stmt)
        found_notif = False
        for n in notif_res.scalars().all():
            params = dict(n.params or {})
            if (params.get("campaign_id") == str(campaign_id) or n.related_id == str(campaign_id)) and params.get("village_id") == str(village_id):
                params["acceptance_status"] = "ACCEPTED"
                params["accepted_at"] = datetime.now(timezone.utc).isoformat()
                params["accepted_by_user_id"] = str(current_user.id)
                params["rejection_reason"] = None
                n.params = params
                n.status = "READ"
                self.db.add(n)
                found_notif = True

        if not found_notif:
            v_obj = await self.db.get(Village, village_id)
            v_name = (v_obj.name_gu or v_obj.name_en or v_obj.code) if v_obj else "ગામ"
            new_notif = Notification(
                id=uuid.uuid4(),
                recipient_user_id=current_user.id,
                kind="CAMPAIGN_VO_ASSIGNMENT",
                message_key="CAMPAIGN_VO_ASSIGNMENT",
                params={
                    "campaign_id": str(campaign.id),
                    "campaign_code": campaign.code,
                    "campaign_name": campaign.name,
                    "disease_code": "FMD",
                    "village_id": str(village_id),
                    "village_name": v_name,
                    "start_date": str(campaign.start_date) if campaign.start_date else "",
                    "end_date": str(campaign.end_date) if campaign.end_date else "",
                    "species_list": [],
                    "acceptance_status": "ACCEPTED",
                    "accepted_at": datetime.now(timezone.utc).isoformat(),
                    "accepted_by_user_id": str(current_user.id),
                    "rejection_reason": None,
                },
                related_type="campaign",
                related_id=str(campaign.id),
                status="READ",
                created_at=datetime.now(timezone.utc),
                read_at=datetime.now(timezone.utc)
            )
            self.db.add(new_notif)

        # Ensure active CampaignAssignment row for VO
        existing = await self.repo.get_active_assignment(campaign_id, village_id, current_user.id)
        if not existing:
            await self.repo.create_assignment(
                campaign_id=campaign_id,
                village_id=village_id,
                worker_user_id=current_user.id,
                assigned_by=current_user.id
            )

        # 1. Notify DAHO of acceptance
        try:
            notif_service = NotificationService(self.db)
            v_obj = await self.db.get(Village, village_id)
            v_name = (v_obj.name_gu or v_obj.name_en or v_obj.code) if v_obj else "ગામ"
            await notif_service.notify(
                recipient_user_id=campaign.created_by,
                kind="CAMPAIGN_ASSIGNMENT_ACCEPTED",
                message_key="CAMPAIGN_ASSIGNMENT_ACCEPTED",
                params={
                    "vo_name": current_user.full_name,
                    "village_name": v_name,
                    "campaign_name": campaign.name
                },
                related_type="campaign",
                related_id=str(campaign_id)
            )

            # 2. Notify active Field Workers assigned to this village
            fw_stmt = (
                select(UserVillageAssignment.user_id)
                .join(User, User.id == UserVillageAssignment.user_id)
                .where(
                    UserVillageAssignment.village_id == village_id,
                    UserVillageAssignment.ended_at.is_(None),
                    User.role.in_(["FIELD_WORKER", "FW"]),
                    User.status == "ACTIVE"
                )
            )
            for fw_id in (await self.db.execute(fw_stmt)).scalars().all():
                await notif_service.notify(
                    recipient_user_id=fw_id,
                    kind="CAMPAIGN_STAFF_ALERT",
                    message_key="CAMPAIGN_STAFF_ALERT",
                    params={
                        "village_name": v_name,
                        "campaign_name": campaign.name,
                        "vo_name": current_user.full_name
                    },
                    related_type="campaign",
                    related_id=str(campaign_id)
                )
        except Exception as e:
            logger.warning("Could not dispatch acceptance notifications: %s", e)

        await self.repo.record_audit_event(
            action="CAMPAIGN_VO_ACCEPTED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="campaign",
            object_id=str(campaign_id),
            village_id=village_id,
            reason=f"VO {current_user.username} accepted campaign {campaign.code} for village {village_id}",
            ip=client_ip
        )
        await self.db.commit()

        my_list = await self.list_my_vo_campaign_assignments(current_user, client_ip)
        match = next((i for i in my_list if i.campaign_id == campaign_id and i.village_id == village_id), None)
        if not match:
            v_obj = await self.db.get(Village, village_id)
            taluka = await self.db.get(Taluka, v_obj.taluka_id) if v_obj and v_obj.taluka_id else None
            return VoCampaignAssignmentItem(
                campaign_id=campaign.id,
                campaign_code=campaign.code,
                campaign_name=localize_campaign_name_gu(campaign.name),
                campaign_status=campaign.status,
                village_id=village_id,
                village_code=v_obj.code if v_obj else "",
                village_name_gu=v_obj.name_gu if v_obj else "",
                village_name_en=v_obj.name_en if v_obj else "",
                taluka_name=taluka.name_gu if taluka else None,
                acceptance_status="ACCEPTED",
                rejection_reason=None,
                assigned_at=datetime.now(timezone.utc),
                eligible_animals_count=0,
                vaccinated_animals_count=0,
                pending_animals_count=0,
                species_names_gu=[],
                assigned_fws=[]
            )
        return match

    async def reject_vo_campaign_assignment(
        self,
        campaign_id: uuid.UUID,
        village_id: uuid.UUID,
        payload: CampaignRejectRequest,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> VoCampaignAssignmentItem:
        """VO rejects the campaign assignment with a mandatory reason."""
        if current_user.role not in ("VET_OFFICER", "VO"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Veterinary Officers can reject campaign assignments")

        await self.authz_service.assert_village_scope(current_user, village_id, ip=client_ip)

        campaign = await self.repo.get_campaign_by_id(campaign_id)
        if not campaign:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

        # Find notification to update status
        notif_stmt = select(Notification).where(
            Notification.recipient_user_id == current_user.id,
            Notification.kind == "CAMPAIGN_VO_ASSIGNMENT"
        )
        notif_res = await self.db.execute(notif_stmt)
        for n in notif_res.scalars().all():
            params = dict(n.params or {})
            if (params.get("campaign_id") == str(campaign_id) or n.related_id == str(campaign_id)) and params.get("village_id") == str(village_id):
                params["acceptance_status"] = "REJECTED"
                params["rejection_reason"] = payload.reason.strip()
                params["rejected_at"] = datetime.now(timezone.utc).isoformat()
                n.params = params
                n.status = "READ"
                self.db.add(n)

        # End active CampaignAssignment row for VO
        existing = await self.repo.get_active_assignment(campaign_id, village_id, current_user.id)
        if existing:
            existing.ended_at = datetime.now(timezone.utc)
            self.db.add(existing)

        # Notify DAHO
        try:
            notif_service = NotificationService(self.db)
            v_obj = await self.db.get(Village, village_id)
            v_name = v_obj.name_gu or v_obj.name_en if v_obj else "ગામ"
            await notif_service.notify(
                recipient_user_id=campaign.created_by,
                kind="CAMPAIGN_ASSIGNMENT_REJECTED",
                message_key="CAMPAIGN_ASSIGNMENT_REJECTED",
                params={
                    "vo_name": current_user.full_name,
                    "village_name": v_name,
                    "campaign_name": campaign.name,
                    "reason": payload.reason.strip()
                },
                related_type="campaign",
                related_id=str(campaign_id)
            )
        except Exception as e:
            logger.warning("Could not notify DAHO of VO rejection: %s", e)

        await self.repo.record_audit_event(
            action="CAMPAIGN_VO_REJECTED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="campaign",
            object_id=str(campaign_id),
            village_id=village_id,
            reason=f"VO {current_user.username} rejected campaign {campaign.code} for village {village_id}: {payload.reason}",
            ip=client_ip
        )
        await self.db.commit()

        my_list = await self.list_my_vo_campaign_assignments(current_user, client_ip)
        match = next((i for i in my_list if i.campaign_id == campaign_id and i.village_id == village_id), None)
        if not match:
            v_obj = await self.db.get(Village, village_id)
            return VoCampaignAssignmentItem(
                campaign_id=campaign.id,
                campaign_code=campaign.code,
                campaign_name=localize_campaign_name_gu(campaign.name),
                campaign_status=campaign.status,
                village_id=village_id,
                village_code=v_obj.code if v_obj else "",
                village_name_gu=v_obj.name_gu if v_obj else "",
                village_name_en=v_obj.name_en if v_obj else "",
                acceptance_status="REJECTED",
                rejection_reason=payload.reason.strip(),
                assigned_at=datetime.now(timezone.utc),
                eligible_animals_count=0,
                vaccinated_animals_count=0,
                pending_animals_count=0,
                assigned_fws=[]
            )
        return match

    async def get_campaign_monitoring(
        self,
        campaign_id: uuid.UUID,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> CampaignMonitoringResponse:
        """Fetch full monitoring drill-down for DAHO and authorized staff."""
        await self.authz_service.assert_any_permission(
            current_user,
            ["campaign.view", "campaign.manage", "aggregate.view"],
            ip=client_ip
        )

        campaign = await self.repo.get_campaign_by_id(campaign_id)
        if not campaign:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

        villages = await self.repo.get_campaign_villages(campaign.id)
        prog_rows = await self.repo.get_campaign_programmes(campaign.id)
        target_species = {p.species_code for p in prog_rows} or {"CATTLE", "BUFFALO"}
        p_code = prog_rows[0].programme_code if prog_rows else "FMD"

        # Fetch notifications to know VO acceptance statuses
        notif_stmt = select(Notification).where(
            Notification.kind == "CAMPAIGN_VO_ASSIGNMENT",
            Notification.related_id == str(campaign_id)
        )
        notif_res = await self.db.execute(notif_stmt)
        notif_map = {}
        for n in notif_res.scalars().all():
            p = n.params or {}
            vid = p.get("village_id")
            if vid:
                notif_map[vid] = (
                    p.get("acceptance_status") or "PENDING_ACCEPTANCE",
                    p.get("rejection_reason"),
                    n.created_at
                )

        from app.modules.vaccinations.models import AnimalEvent, VaccinationDetail

        verif_rows = await self.repo.list_village_verifications(campaign.id)
        verif_map = {v.village_id: v for v in verif_rows}

        village_items: List[CampaignMonitoringVillageItem] = []
        tot_eligible = 0
        tot_vaccinated = 0

        for v_id in villages:
            v_obj = await self.db.get(Village, v_id)
            if not v_obj:
                continue
            taluka = await self.db.get(Taluka, v_obj.taluka_id) if v_obj.taluka_id else None

            # Assigned VO
            vo_stmt = (
                select(User.id, User.full_name, User.username, User.designation)
                .join(UserVillageAssignment, UserVillageAssignment.user_id == User.id)
                .where(
                    UserVillageAssignment.village_id == v_id,
                    UserVillageAssignment.ended_at.is_(None),
                    User.role.in_(["VET_OFFICER", "VO"]),
                    func.upper(User.status) == "ACTIVE"
                )
            )
            vo_row = (await self.db.execute(vo_stmt)).first()
            assigned_vo = UserBrief(
                user_id=vo_row[0],
                full_name=vo_row[1],
                username=vo_row[2],
                designation=vo_row[3]
            ) if vo_row else None

            # Acceptance status
            notif_info = notif_map.get(str(v_id))
            if not assigned_vo:
                acc_status = "UNASSIGNED"
                rej_reason = None
                assigned_dt = None
            elif notif_info:
                acc_status = notif_info[0]
                rej_reason = notif_info[1]
                assigned_dt = notif_info[2]
            else:
                va = await self.repo.get_active_assignment(campaign.id, v_id, assigned_vo.user_id)
                acc_status = "ACCEPTED" if va else "PENDING_ACCEPTANCE"
                rej_reason = None
                assigned_dt = va.assigned_at if va else campaign.created_at

            # Eligible animals count in this village
            dyn_stmt = select(func.count(Animal.id)).where(
                Animal.village_id == v_id,
                Animal.status == "ACTIVE",
                Animal.species_code.in_(target_species)
            )
            v_eligible = (await self.db.execute(dyn_stmt)).scalar() or 0

            # Vaccinated count
            vax_stmt = select(func.count(func.distinct(AnimalEvent.animal_id))).select_from(AnimalEvent).join(
                VaccinationDetail, AnimalEvent.event_id == VaccinationDetail.event_id
            ).where(
                AnimalEvent.village_id == v_id,
                AnimalEvent.event_type == "VACCINATION",
                (VaccinationDetail.campaign_id == campaign.id) |
                ((VaccinationDetail.campaign_id.is_(None)) & (AnimalEvent.event_date >= (campaign.start_date or date(2020, 1, 1))))
            )
            v_vax = (await self.db.execute(vax_stmt)).scalar() or 0
            v_rem = max(0, v_eligible - v_vax)
            v_pct = round((v_vax / v_eligible * 100), 1) if v_eligible > 0 else 0.0

            tot_eligible += v_eligible
            tot_vaccinated += v_vax

            # Assigned FWs
            fw_stmt = (
                select(User.id, User.full_name, User.username, User.designation)
                .join(CampaignAssignment, CampaignAssignment.worker_user_id == User.id)
                .where(
                    CampaignAssignment.campaign_id == campaign.id,
                    CampaignAssignment.village_id == v_id,
                    CampaignAssignment.ended_at.is_(None),
                    User.role.in_(["FIELD_WORKER", "FW"])
                )
            )
            assigned_fws = [
                UserBrief(user_id=r[0], full_name=r[1], username=r[2], designation=r[3])
                for r in (await self.db.execute(fw_stmt)).all()
            ]

            # Verification status & submission details
            verif = verif_map.get(v_id)
            if verif and verif.status:
                v_verif_status = verif.status
            elif v_vax > 0:
                v_verif_status = "IN_PROGRESS"
            elif assigned_vo or assigned_fws:
                v_verif_status = "ASSIGNED"
            else:
                v_verif_status = "UNASSIGNED"

            sub_user = await self.db.get(User, verif.submitted_by) if (verif and verif.submitted_by) else None
            ver_user = await self.db.get(User, verif.verified_by) if (verif and verif.verified_by) else None

            village_items.append(
                CampaignMonitoringVillageItem(
                    village_id=v_obj.id,
                    village_code=v_obj.code,
                    village_name_gu=v_obj.name_gu or v_obj.name_en or v_obj.code,
                    village_name_en=v_obj.name_en or v_obj.code,
                    taluka_name=taluka.name_gu if taluka else None,
                    assigned_vo=assigned_vo,
                    vo_acceptance_status=acc_status,
                    rejection_reason=rej_reason or (verif.rejection_reason if verif else None),
                    assigned_at=assigned_dt,
                    eligible_count=v_eligible,
                    vaccinated_count=v_vax,
                    remaining_count=v_rem,
                    completion_percentage=v_pct,
                    assigned_fws=assigned_fws,
                    verification_status=v_verif_status,
                    submitted_at=verif.submitted_at if verif else None,
                    submitted_by_name=sub_user.full_name if sub_user else None,
                    completion_notes=verif.completion_notes if verif else None,
                    evidence_photo_urls=verif.evidence_photo_urls if (verif and verif.evidence_photo_urls) else [],
                    verified_at=verif.verified_at if verif else None,
                    verified_by_name=ver_user.full_name if ver_user else None,
                    verification_notes=verif.verification_notes if verif else None
                )
            )

        tot_rem = max(0, tot_eligible - tot_vaccinated)
        overall_pct = round((tot_vaccinated / tot_eligible * 100), 1) if tot_eligible > 0 else 0.0

        assigned_cnt = sum(1 for v in village_items if v.assigned_vo or v.assigned_fws)
        in_prog_cnt = sum(1 for v in village_items if v.verification_status == "IN_PROGRESS" or (v.vaccinated_count > 0 and v.verification_status not in ("VERIFIED_COMPLETED", "SUBMITTED_FOR_VERIFICATION")))
        sub_cnt = sum(1 for v in village_items if v.verification_status == "SUBMITTED_FOR_VERIFICATION")
        ver_cnt = sum(1 for v in village_items if v.verification_status == "VERIFIED_COMPLETED")
        rej_cnt = sum(1 for v in village_items if v.verification_status == "REJECTED")
        unassigned_cnt = sum(1 for v in village_items if not v.assigned_vo and not v.assigned_fws)
        staff_uids = set()
        for v in village_items:
            if v.assigned_vo:
                staff_uids.add(v.assigned_vo.user_id)
            for f in v.assigned_fws:
                staff_uids.add(f.user_id)

        return CampaignMonitoringResponse(
            campaign_id=campaign.id,
            campaign_code=campaign.code,
            campaign_name=localize_campaign_name_gu(campaign.name),
            disease_code=p_code,
            campaign_status=campaign.status,
            start_date=campaign.start_date,
            end_date=campaign.end_date,
            planned_target_count=None,
            actual_eligible_count=tot_eligible,
            total_vaccinated_count=tot_vaccinated,
            total_remaining_count=tot_rem,
            overall_completion_percentage=overall_pct,
            assigned_villages_count=assigned_cnt,
            in_progress_villages_count=in_prog_cnt,
            submitted_villages_count=sub_cnt,
            verified_villages_count=ver_cnt,
            rejected_villages_count=rej_cnt,
            unassigned_villages_count=unassigned_cnt,
            assigned_staff_count=len(staff_uids),
            villages=village_items
        )

    async def assign_workers_bulk(
        self,
        campaign_id: uuid.UUID,
        payload: CampaignBulkAssignWorkersRequest,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> List[CampaignAssignmentResponse]:
        """Assign a staff member (VO or FW) to multiple campaign villages."""
        await self.authz_service.assert_any_permission(
            current_user,
            ["campaign.assign", "campaign.assign_workers", "campaign.manage", "user.staff.manage"],
            ip=client_ip
        )
        campaign = await self.repo.get_campaign_by_id(campaign_id)
        if not campaign:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

        worker = await self.db.get(User, payload.worker_user_id)
        if not worker or worker.role not in ("FIELD_WORKER", "FW", "VET_OFFICER", "VO") or (worker.status and worker.status.upper() != "ACTIVE"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Target worker must be an active Field Worker or Veterinary Officer"
            )

        is_vo = worker.role in ("VET_OFFICER", "VO")
        notif_service = NotificationService(self.db)
        results = []

        campaign_villages = await self.repo.get_campaign_villages(campaign.id)
        for v_id in payload.village_ids:
            # Check village scope: if caller is TAHO/Admin and village is part of the campaign, authorize deployment
            if current_user.role == "TAHO" and v_id in campaign_villages:
                pass  # Authorized under campaign supervision
            elif current_user.role in ("SYS_ADMIN", "SUPER_ADMIN", "ADMIN"):
                pass  # Statewide admin authority
            else:
                await self.authz_service.assert_village_scope(current_user, v_id, ip=client_ip)

            # Check existing active assignment
            active_assign = await self.repo.get_active_assignment(
                campaign_id=campaign.id,
                village_id=v_id,
                worker_user_id=payload.worker_user_id
            )
            if active_assign:
                results.append(active_assign)
                continue

            assignment = await self.repo.create_assignment(
                campaign_id=campaign.id,
                village_id=v_id,
                worker_user_id=payload.worker_user_id,
                assigned_by=current_user.id
            )
            results.append(assignment)

            # Ensure user_village_assignments
            uva_stmt = select(UserVillageAssignment).where(
                UserVillageAssignment.user_id == payload.worker_user_id,
                UserVillageAssignment.village_id == v_id,
                UserVillageAssignment.ended_at.is_(None)
            )
            if not (await self.db.execute(uva_stmt)).scalars().first():
                self.db.add(UserVillageAssignment(
                    id=uuid.uuid4(),
                    user_id=payload.worker_user_id,
                    village_id=v_id,
                    assigned_by=current_user.id
                ))

            # Upsert CampaignVillageVerification
            await self.repo.upsert_village_verification(
                campaign_id=campaign.id,
                village_id=v_id,
                status="ASSIGNED",
                assigned_vo_id=payload.worker_user_id if is_vo else None,
                assigned_fw_id=payload.worker_user_id if not is_vo else None,
            )

            # In-app notification
            try:
                v_obj = await self.db.get(Village, v_id)
                v_name = v_obj.name_gu or v_obj.name_en if v_obj else "ગામ"
                await notif_service.notify(
                    recipient_user_id=payload.worker_user_id,
                    kind="CAMPAIGN_VO_ASSIGNMENT" if is_vo else "CAMPAIGN_STAFF_ALERT",
                    message_key="CAMPAIGN_VO_ASSIGNMENT" if is_vo else "CAMPAIGN_STAFF_ALERT",
                    params={
                        "campaign_id": str(campaign.id),
                        "campaign_code": campaign.code,
                        "campaign_name": campaign.name,
                        "village_id": str(v_id),
                        "village_name": v_name,
                        "assigned_by": current_user.full_name or current_user.username,
                        "acceptance_status": "PENDING_ACCEPTANCE" if is_vo else "ACCEPTED",
                        "assigned_at": datetime.now(timezone.utc).isoformat()
                    },
                    related_type="campaign",
                    related_id=str(campaign.id)
                )
            except Exception as e:
                logger.warning("Could not dispatch alert for bulk assign: %s", e)

        await self.repo.record_audit_event(
            action="CAMPAIGN_WORKER_BULK_ASSIGNED",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="campaign_assignment",
            object_id=str(campaign.id),
            reason=f"Bulk assigned worker {worker.username} to {len(payload.village_ids)} villages",
            ip=client_ip
        )
        await self.db.commit()
        return [CampaignAssignmentResponse.model_validate(a) for a in results]

    async def submit_village_verification(
        self,
        campaign_id: uuid.UUID,
        village_id: uuid.UUID,
        payload: CampaignVillageVerificationSubmitRequest,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> CampaignVillageVerificationItem:
        """Field Worker or VO submits completed campaign village work for verification."""
        await self.authz_service.assert_any_permission(
            current_user,
            ["vaccination.record", "campaign.manage", "field_worker.manage", "veterinary_officer.manage"],
            ip=client_ip
        )
        campaign = await self.repo.get_campaign_by_id(campaign_id)
        if not campaign:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

        village = await self.db.get(Village, village_id)
        if not village:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Village not found")

        from app.modules.vaccinations.models import AnimalEvent, VaccinationDetail
        from app.modules.animals.models import Animal

        # Count actual vaccinations done in this village under this campaign
        vax_stmt = select(func.count(func.distinct(AnimalEvent.animal_id))).select_from(AnimalEvent).join(
            VaccinationDetail, AnimalEvent.event_id == VaccinationDetail.event_id
        ).where(
            AnimalEvent.village_id == village_id,
            AnimalEvent.event_type == "VACCINATION",
            (VaccinationDetail.campaign_id == campaign.id) |
            ((VaccinationDetail.campaign_id.is_(None)) & (AnimalEvent.event_date >= (campaign.start_date or date(2020, 1, 1))))
        )
        vax_done = (await self.db.execute(vax_stmt)).scalar() or 0

        # Total eligible animals in this village
        prog_rows = await self.repo.get_campaign_programmes(campaign.id)
        target_species = {p.species_code for p in prog_rows} or {"CATTLE", "BUFFALO"}
        dyn_stmt = select(func.count(Animal.id)).where(
            Animal.village_id == village_id,
            Animal.status == "ACTIVE",
            Animal.species_code.in_(target_species)
        )
        total_eligible = (await self.db.execute(dyn_stmt)).scalar() or 0
        rem_count = max(0, total_eligible - vax_done)

        visited_count = payload.animals_visited_count or vax_done
        if vax_done == 0 and visited_count == 0 and not (payload.completion_notes or payload.field_observations):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ગામમાં કોઈ વાસ્તવિક રસીકરણ કે મુલાકાત નોંધાયેલ નથી. ચકાસણી માટે વાસ્તવિક રેકોર્ડ અથવા વિગત જરૂરી છે."
            )

        now_dt = datetime.now(timezone.utc)
        verif = await self.repo.upsert_village_verification(
            campaign_id=campaign_id,
            village_id=village_id,
            status="SUBMITTED_FOR_VERIFICATION",
            animals_visited_count=max(visited_count, vax_done),
            vaccinations_completed_count=vax_done,
            pending_animals_count=rem_count,
            field_observations=payload.field_observations,
            completion_notes=payload.completion_notes,
            evidence_photo_urls=payload.evidence_photo_urls or [],
            submitted_by=current_user.id,
            submitted_at=now_dt
        )

        # In-app notifications to TAHO and DAHO
        try:
            notif_service = NotificationService(self.db)
            v_name = village.name_gu or village.name_en or village.code

            from app.modules.authentication.models import TahoTalukaAssignment
            taho_stmt = (
                select(User.id)
                .join(TahoTalukaAssignment, TahoTalukaAssignment.taho_user_id == User.id)
                .where(
                    TahoTalukaAssignment.taluka_id == village.taluka_id,
                    TahoTalukaAssignment.ended_at.is_(None),
                    User.role == "TAHO",
                    User.status == "ACTIVE"
                )
            )
            taho_ids = (await self.db.execute(taho_stmt)).scalars().all()
            for tid in taho_ids:
                await notif_service.notify(
                    recipient_user_id=tid,
                    kind="CAMPAIGN_VERIFICATION_SUBMITTED",
                    message_key="CAMPAIGN_VERIFICATION_SUBMITTED",
                    params={
                        "campaign_id": str(campaign.id),
                        "campaign_name": campaign.name,
                        "village_id": str(village.id),
                        "village_name": v_name,
                        "submitted_by": current_user.full_name or current_user.username,
                        "vaccinated_count": vax_done
                    },
                    related_type="campaign",
                    related_id=str(campaign.id)
                )

            if campaign.created_by:
                await notif_service.notify(
                    recipient_user_id=campaign.created_by,
                    kind="CAMPAIGN_VERIFICATION_SUBMITTED",
                    message_key="CAMPAIGN_VERIFICATION_SUBMITTED",
                    params={
                        "campaign_id": str(campaign.id),
                        "campaign_name": campaign.name,
                        "village_id": str(village.id),
                        "village_name": v_name,
                        "submitted_by": current_user.full_name or current_user.username,
                        "vaccinated_count": vax_done
                    },
                    related_type="campaign",
                    related_id=str(campaign.id)
                )
        except Exception as e:
            logger.warning("Could not send verification submission notifications: %s", e)

        await self.repo.record_audit_event(
            action="CAMPAIGN_WORK_SUBMITTED_FOR_VERIFICATION",
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="campaign_village_verification",
            object_id=str(verif.id),
            village_id=village_id,
            reason=f"Submitted campaign verification for {v_name} with {vax_done} vaccinations",
            ip=client_ip
        )
        await self.db.commit()

        taluka = await self.db.get(Taluka, village.taluka_id) if village.taluka_id else None
        return CampaignVillageVerificationItem(
            id=verif.id,
            campaign_id=campaign_id,
            village_id=village_id,
            village_name_gu=village.name_gu or village.code,
            village_name_en=village.name_en or village.code,
            village_code=village.code,
            taluka_name=taluka.name_gu if taluka else None,
            status=verif.status,
            animals_visited_count=verif.animals_visited_count,
            vaccinations_completed_count=verif.vaccinations_completed_count,
            pending_animals_count=verif.pending_animals_count,
            field_observations=verif.field_observations,
            completion_notes=verif.completion_notes,
            evidence_photo_urls=verif.evidence_photo_urls or [],
            submitted_by=verif.submitted_by,
            submitted_by_name=current_user.full_name or current_user.username,
            submitted_at=verif.submitted_at
        )

    async def verify_village_completion(
        self,
        campaign_id: uuid.UUID,
        village_id: uuid.UUID,
        payload: CampaignVillageVerificationReviewRequest,
        current_user: User,
        client_ip: Optional[str] = None
    ) -> CampaignVillageVerificationItem:
        """DAHO or TAHO reviews, approves, rejects or reopens village campaign work."""
        if current_user.role not in ("DAHO", "TAHO", "SYS_ADMIN", "SUPER_ADMIN"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only DAHO, TAHO or System Admin can verify campaign work")

        await self.authz_service.assert_village_scope(current_user, village_id, ip=client_ip)

        campaign = await self.repo.get_campaign_by_id(campaign_id)
        if not campaign:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

        village = await self.db.get(Village, village_id)
        if not village:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Village not found")

        v_name = village.name_gu or village.name_en or village.code
        now_dt = datetime.now(timezone.utc)

        if payload.action == "APPROVE":
            new_status = "VERIFIED_COMPLETED"
            verif = await self.repo.upsert_village_verification(
                campaign_id=campaign_id,
                village_id=village_id,
                status=new_status,
                verified_by=current_user.id,
                verified_at=now_dt,
                verification_notes=payload.verification_notes,
                rejection_reason=None
            )
            audit_action = "CAMPAIGN_WORK_VERIFIED_COMPLETED"
            notif_kind = "CAMPAIGN_VERIFICATION_APPROVED"
        elif payload.action == "REJECT":
            if not (payload.rejection_reason or payload.verification_notes):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="અસ્વીકાર માટે કારણ દાખલ કરવું ફરજિયાત છે.")
            new_status = "REJECTED"
            verif = await self.repo.upsert_village_verification(
                campaign_id=campaign_id,
                village_id=village_id,
                status=new_status,
                verified_by=current_user.id,
                verified_at=now_dt,
                rejection_reason=payload.rejection_reason or payload.verification_notes,
                verification_notes=payload.verification_notes
            )
            audit_action = "CAMPAIGN_WORK_VERIFICATION_REJECTED"
            notif_kind = "CAMPAIGN_VERIFICATION_REJECTED"
        elif payload.action == "REOPEN":
            new_status = "REOPENED"
            verif = await self.repo.upsert_village_verification(
                campaign_id=campaign_id,
                village_id=village_id,
                status=new_status,
                reopened_by=current_user.id,
                reopened_at=now_dt,
                verification_notes=payload.verification_notes
            )
            audit_action = "CAMPAIGN_WORK_REOPENED"
            notif_kind = "CAMPAIGN_VERIFICATION_REOPENED"
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid verification action")

        # Notify assigned staff (VO and FW)
        try:
            notif_service = NotificationService(self.db)
            staff_stmt = select(CampaignAssignment.worker_user_id).where(
                CampaignAssignment.campaign_id == campaign_id,
                CampaignAssignment.village_id == village_id,
                CampaignAssignment.ended_at.is_(None)
            )
            staff_ids = set((await self.db.execute(staff_stmt)).scalars().all())
            if verif.submitted_by:
                staff_ids.add(verif.submitted_by)

            for s_uid in staff_ids:
                await notif_service.notify(
                    recipient_user_id=s_uid,
                    kind=notif_kind,
                    message_key=notif_kind,
                    params={
                        "campaign_id": str(campaign.id),
                        "campaign_name": campaign.name,
                        "village_id": str(village.id),
                        "village_name": v_name,
                        "verifier_name": current_user.full_name or current_user.username,
                        "action": payload.action,
                        "status": new_status,
                        "notes": payload.verification_notes or payload.rejection_reason or ""
                    },
                    related_type="campaign",
                    related_id=str(campaign.id)
                )
        except Exception as e:
            logger.warning("Could not dispatch verification status notifications: %s", e)

        await self.repo.record_audit_event(
            action=audit_action,
            result="SUCCESS",
            actor_user_id=current_user.id,
            actor_role=current_user.role,
            object_type="campaign_village_verification",
            object_id=str(verif.id),
            village_id=village_id,
            reason=f"{payload.action} verification for village {v_name}: {payload.verification_notes or payload.rejection_reason or ''}",
            ip=client_ip
        )
        await self.db.commit()

        taluka = await self.db.get(Taluka, village.taluka_id) if village.taluka_id else None
        sub_user = await self.db.get(User, verif.submitted_by) if verif.submitted_by else None
        return CampaignVillageVerificationItem(
            id=verif.id,
            campaign_id=campaign_id,
            village_id=village_id,
            village_name_gu=village.name_gu or village.code,
            village_name_en=village.name_en or village.code,
            village_code=village.code,
            taluka_name=taluka.name_gu if taluka else None,
            status=verif.status,
            animals_visited_count=verif.animals_visited_count,
            vaccinations_completed_count=verif.vaccinations_completed_count,
            pending_animals_count=verif.pending_animals_count,
            field_observations=verif.field_observations,
            completion_notes=verif.completion_notes,
            evidence_photo_urls=verif.evidence_photo_urls or [],
            submitted_by=verif.submitted_by,
            submitted_by_name=sub_user.full_name if sub_user else None,
            submitted_at=verif.submitted_at,
            verified_by=verif.verified_by,
            verified_by_name=current_user.full_name or current_user.username,
            verified_at=verif.verified_at,
            verification_notes=verif.verification_notes,
            rejection_reason=verif.rejection_reason
        )

    async def list_village_verifications(
        self,
        campaign_id: uuid.UUID,
        status_filter: Optional[str],
        current_user: User,
        client_ip: Optional[str] = None
    ) -> List[CampaignVillageVerificationItem]:
        """List village verification items for a campaign."""
        await self.authz_service.assert_any_permission(
            current_user,
            ["campaign.view", "campaign.manage", "aggregate.view"],
            ip=client_ip
        )
        verif_rows = await self.repo.list_village_verifications(campaign_id, status=status_filter)
        results = []
        for v in verif_rows:
            v_obj = await self.db.get(Village, v.village_id)
            taluka = await self.db.get(Taluka, v_obj.taluka_id) if (v_obj and v_obj.taluka_id) else None
            sub_user = await self.db.get(User, v.submitted_by) if v.submitted_by else None
            ver_user = await self.db.get(User, v.verified_by) if v.verified_by else None
            vo_user = await self.db.get(User, v.assigned_vo_id) if v.assigned_vo_id else None

            assigned_vo_brief = UserBrief(
                user_id=vo_user.id,
                full_name=vo_user.full_name,
                username=vo_user.username,
                designation=vo_user.designation
            ) if vo_user else None

            results.append(
                CampaignVillageVerificationItem(
                    id=v.id,
                    campaign_id=v.campaign_id,
                    village_id=v.village_id,
                    village_name_gu=v_obj.name_gu or v_obj.code if v_obj else "",
                    village_name_en=v_obj.name_en or v_obj.code if v_obj else "",
                    village_code=v_obj.code if v_obj else "",
                    taluka_name=taluka.name_gu if taluka else None,
                    status=v.status,
                    assigned_vo=assigned_vo_brief,
                    assigned_fws=[],
                    animals_visited_count=v.animals_visited_count,
                    vaccinations_completed_count=v.vaccinations_completed_count,
                    pending_animals_count=v.pending_animals_count,
                    field_observations=v.field_observations,
                    completion_notes=v.completion_notes,
                    evidence_photo_urls=v.evidence_photo_urls or [],
                    submitted_by=v.submitted_by,
                    submitted_by_name=sub_user.full_name if sub_user else None,
                    submitted_at=v.submitted_at,
                    verified_by=v.verified_by,
                    verified_by_name=ver_user.full_name if ver_user else None,
                    verified_at=v.verified_at,
                    verification_notes=v.verification_notes,
                    rejection_reason=v.rejection_reason
                )
            )
        return results


