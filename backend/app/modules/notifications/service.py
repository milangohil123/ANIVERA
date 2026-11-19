"""Service layer for In-App Notifications and simulated external dispatch."""
import logging
import uuid
from typing import Any, Dict, List, Optional, Set
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.authentication.models import User, UserVillageAssignment
from app.modules.notifications.models import Notification
from app.modules.notifications.repository import NotificationRepository
from app.modules.notifications.schemas import (
    NotificationListResponse,
    NotificationResponse,
    UnreadCountResponse,
)

logger = logging.getLogger("pashurakshak.notifications")

# Gujarati templates for in-app display and simulated dispatch
GUJARATI_TEMPLATES: Dict[str, Dict[str, str]] = {
    "REPORT_SUBMITTED": {
        "title": "નવો રોગ અહેવાલ",
        "body": "ગામ {village_name} માં {disease_name} નો શંકાસ્પદ કેસ નોંધાયેલ છે (રિપોર્ટ: {report_no}).",
    },
    "REPORT_REVIEWED": {
        "title": "અહેવાલ સમીક્ષા પૂર્ણ",
        "body": "તમારા રોગ અહેવાલ (રિપોર્ટ: {report_no}) ની સ્થિતિ હવે '{status}' છે.",
    },
    "CAMP_CONFIRMED": {
        "title": "પશુ આરોગ્ય કેમ્પ મંજૂર",
        "body": "{camp_date} ના રોજ ગામ {village_name} માં પશુ આરોગ્ય કેમ્પ મંજૂર કરવામાં આવ્યો છે.",
    },
    "CAMP_RESCHEDULED": {
        "title": "કેમ્પ તારીખ બદલાઈ",
        "body": "ગામ {village_name} માં કેમ્પ નવી તારીખ {camp_date} પર ફરીથી ગોઠવવામાં આવ્યો છે.",
    },
    "TRANSFER_REQUESTED": {
        "title": "માલિકી ફેરબદલ વિનંતી",
        "body": "પશુ {animal_code} ની માલિકી ફેરબદલ માટે નવી વિનંતી પ્રાપ્ત થઈ છે.",
    },
    "TRANSFER_DECIDED": {
        "title": "માલિકી ફેરબદલ નિર્ણય",
        "body": "પશુ {animal_code} ની માલિકી ફેરબદલ વિનંતી {decision} કરવામાં આવી છે.",
    },
    "ACCOUNT_PROVISIONED": {
        "title": "પશુપાલક એકાઉન્ટ સક્રિય",
        "body": "તમારું પશુપાલક પોર્ટલ એકાઉન્ટ સફળતાપૂર્વક અધિકૃત અને સક્રિય કરવામાં આવ્યું છે.",
    },
    "CAMPAIGN_CONFIRMED": {
        "title": "રસીકરણ અભિયાન શરૂ",
        "body": "તમારા ગામ {village_name} માં રસીકરણ અભિયાન '{campaign_name}' શરૂ કરવામાં આવ્યું છે. તમારા {target_count} પશુઓ આ અભિયાન હેઠળ પાત્ર છે.",
    },
    "CAMPAIGN_STAFF_ALERT": {
        "title": "નવું રસીકરણ અભિયાન ફાળવણી",
        "body": "ગામ {village_name} માં રસીકરણ અભિયાન '{campaign_name}' શરૂ થયેલ છે. કૃપા કરીને 'બાકી' યાદી મુજબ રસીકરણ શરૂ કરો.",
    },
    "CAMPAIGN_VO_ASSIGNMENT": {
        "title": "નવી ઝુંબેશ સોંપણી",
        "body": "ગામ {village_name} માટે રસીકરણ ઝુંબેશ '{campaign_name}' ({disease_code}) તમને સોંપવામાં આવી છે. કૃપા કરીને સ્વીકારો અથવા નકારો.",
    },
    "CAMPAIGN_ASSIGNMENT_ACCEPTED": {
        "title": "ઝુંબેશ સોંપણી સ્વીકૃત",
        "body": "ડૉ. {vo_name} દ્વારા ગામ {village_name} માટે ઝુંબેશ '{campaign_name}' ની સોંપણી સ્વીકારવામાં આવી છે.",
    },
    "CAMPAIGN_ASSIGNMENT_REJECTED": {
        "title": "ઝુંબેશ સોંપણી અસ્વીકૃત",
        "body": "ડૉ. {vo_name} દ્વારા ગામ {village_name} માટે ઝુંબેશ '{campaign_name}' ની સોંપણી અસ્વીકાર કરવામાં આવી છે. કારણ: {reason}",
    },
    "VO_VILLAGE_ASSIGNMENT": {
        "title": "નવા ગામની ફાળવણી",
        "body": "તમને {village_name} ગામના વેટરનરી ઓફિસર તરીકે નિયુક્ત કરવામાં આવ્યા છે.",
    },
    "VO_VILLAGE_ENDED": {
        "title": "ગામ ફાળવણી સમાપ્ત",
        "body": "ગામ {village_name} માટે તમારી વેટરનરી ઓફિસર તરીકેની ફાળવણી સમાપ્ત કરવામાં આવી છે.",
    },
    "FARMER_VO_ASSIGNED": {
        "title": "નવા વેટરનરી ઓફિસરની નિમણૂક",
        "body": "તમારા ગામ {village_name} માટે ડૉ. {vo_name} ની વેટરનરી ઓફિસર તરીકે નિમણૂક કરવામાં આવી છે.",
    },
    "GP_VO_ASSIGNED": {
        "title": "ગ્રામ પંચાયત વેટરનરી ઓફિસર ફાળવણી",
        "body": "તમારા પંચાયત વિસ્તારના ગામ {village_name} માટે વેટરનરી ઓફિસર તરીકે ડૉ. {vo_name} ની ફાળવણી કરવામાં આવી છે.",
    },
    "COOP_VO_ASSIGNED": {
        "title": "ડેરી મંડળી વેટરનરી અધિકારી ફાળવણી",
        "body": "તમારા મંડળી કાર્યક્ષેત્ર ગામ {village_name} માટે વેટરનરી ઓફિસર તરીકે ડૉ. {vo_name} ની નિમણૂક કરવામાં આવી છે.",
    },
    "CAMPAIGN_FARMER_ANNOUNCEMENT": {
        "title": "આગામી પશુ રસીકરણ ઝુંબેશ",
        "body": "તમારા ગામ {village_name} માં રસીકરણ ઝુંબેશ '{campaign_name}' ({disease_code}) શરૂ થનાર છે. કૃપા કરીને તમારા પશુઓને રસીકરણ માટે તૈયાર રાખો.",
    },
    "CAMPAIGN_GP_ANNOUNCEMENT": {
        "title": "ગ્રામ પંચાયત પશુ રસીકરણ ઝુંબેશ સૂચના",
        "body": "તમારા પંચાયત વિસ્તારના ગામ {village_name} માં રસીકરણ ઝુંબેશ '{campaign_name}' ({disease_code}) ની જાહેરાત કરવામાં આવી છે.",
    },
    "CAMPAIGN_COOP_ANNOUNCEMENT": {
        "title": "ડેરી સહકારી મંડળી રસીકરણ ઝુંબેશ સૂચના",
        "body": "ગામ {village_name} માં રસીકરણ ઝુંબેશ '{campaign_name}' ({disease_code}) શરૂ કરાઈ છે. પશુપાલકોને સહભાગી થવા અનુરોધ છે.",
    },
}


def render_gujarati_notification(kind: str, message_key: str, params: Dict[str, Any]) -> Dict[str, str]:
    """Render localized Gujarati title and body safely using template parameters."""
    tpl = GUJARATI_TEMPLATES.get(message_key) or GUJARATI_TEMPLATES.get(kind)
    if not tpl:
        return {
            "title": "સૂચના",
            "body": f"{message_key}: {', '.join(f'{k}={v}' for k, v in params.items())}" if params else message_key
        }

    title = tpl["title"]
    try:
        body = tpl["body"].format(**{k: str(v) for k, v in params.items()})
    except KeyError:
        # Fallback if a parameter is missing in payload
        body = tpl["body"]
    return {"title": title, "body": body}


class NotificationService:
    """Coordinates persistent in-app notifications and simulated external dispatch."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = NotificationRepository(db)

    def _to_response(self, notif: Notification) -> NotificationResponse:
        rendered = render_gujarati_notification(notif.kind, notif.message_key, notif.params or {})
        return NotificationResponse(
            id=notif.id,
            recipient_user_id=notif.recipient_user_id,
            kind=notif.kind,
            message_key=notif.message_key,
            params=notif.params or {},
            related_type=notif.related_type,
            related_id=notif.related_id,
            status=notif.status,
            created_at=notif.created_at,
            read_at=notif.read_at,
            title_gu=rendered["title"],
            message_gu=rendered["body"]
        )

    async def list_notifications(
        self,
        current_user: User,
        status_filter: Optional[str] = None,
        offset: int = 0,
        limit: int = 50
    ) -> NotificationListResponse:
        """List notifications for current user with localization and total counts."""
        items, total = await self.repo.list_by_recipient(
            recipient_user_id=current_user.id,
            status_filter=status_filter,
            offset=offset,
            limit=limit
        )
        unread_count = await self.repo.count_unread(current_user.id)
        return NotificationListResponse(
            items=[self._to_response(i) for i in items],
            total=total,
            unread_count=unread_count
        )

    async def get_unread_count(self, current_user: User) -> UnreadCountResponse:
        """Get unread notifications count for shell header badge."""
        count = await self.repo.count_unread(current_user.id)
        return UnreadCountResponse(unread_count=count)

    async def mark_as_read(self, notification_id: uuid.UUID, current_user: User) -> NotificationResponse:
        """Mark single notification as read, ensuring ownership."""
        notif = await self.repo.get_by_id(notification_id, current_user.id)
        if not notif:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
        await self.repo.mark_as_read(notif)
        await self.db.commit()
        return self._to_response(notif)

    async def mark_all_as_read(self, current_user: User) -> int:
        """Mark all unread notifications as read for current user."""
        count = await self.repo.mark_all_as_read(current_user.id)
        await self.db.commit()
        return count

    async def notify(
        self,
        recipient_user_id: uuid.UUID,
        kind: str,
        message_key: str,
        params: Optional[Dict[str, Any]] = None,
        related_type: Optional[str] = None,
        related_id: Optional[Any] = None,
        scope_village_id: Optional[uuid.UUID] = None
    ) -> Optional[Notification]:
        """Scope-checked notification dispatcher.
        
        Enforces:
        - Recipient must exist and be ACTIVE.
        - If scope_village_id is supplied, verifies recipient has active village authority (unless DAHO/SYS_ADMIN).
        - Persists in-app notification row.
        - Triggers simulated external SMS/WhatsApp adapter.
        """
        user_res = await self.db.execute(select(User).where(User.id == recipient_user_id))
        recipient = user_res.scalars().first()
        if not recipient or recipient.status != "ACTIVE":
            logger.info("Notification suppressed: recipient %s is not active", recipient_user_id)
            return None

        # Verify geographic scope if village boundary is specified
        if scope_village_id and recipient.role not in ("DAHO", "SYS_ADMIN"):
            uva_res = await self.db.execute(
                select(UserVillageAssignment).where(
                    UserVillageAssignment.user_id == recipient.id,
                    UserVillageAssignment.village_id == scope_village_id,
                    UserVillageAssignment.ended_at.is_(None)
                )
            )
            if not uva_res.scalars().first():
                logger.warning(
                    "Scope check failed: user %s has no active assignment to village %s; suppressing notification",
                    recipient.id, scope_village_id
                )
                return None

        # 1. Persist notification
        notif = await self.repo.create(
            recipient_user_id=recipient.id,
            kind=kind,
            message_key=message_key,
            params=params or {},
            related_type=related_type,
            related_id=str(related_id) if related_id is not None else None
        )

        # 2. Simulated External Delivery Adapter (SMS / WhatsApp)
        rendered = render_gujarati_notification(kind, message_key, params or {})
        target_phone = recipient.mobile_e164 or "NO_PHONE"
        logger.info(
            "[SIMULATED EXTERNAL NOTIFICATION] Provider: SIMULATED | To: %s (%s) | Title: %s | Message: %s",
            recipient.username, target_phone, rendered["title"], rendered["body"]
        )

        return notif

    async def dispatch_village_vo_assignment_notifications(
        self,
        village_id: uuid.UUID,
        vo_user: User,
        daho_user: User
    ) -> Dict[str, int]:
        """Dispatch persistent, role-appropriate in-app notifications for VO village assignment.
        
        Stakeholders notified:
        1. Assigned VO (notified of newly assigned village).
        2. Registered Farmers in that village (notified about their assigned VO).
        3. Gram Panchayat associated with that village (official governance notification).
        4. Dairy Cooperative associated with that village (cooperative outreach notification).
        """
        from app.models.geography import Village, Taluka, District
        from app.modules.farmers.models import Farmer, FarmerAccountProvisioning
        from app.modules.authorization.models import (
            FarmerUserLink,
            CooperativeVillage,
            CooperativeStaffAssignment,
        )
        from app.modules.administration.models import (
            GramPanchayat,
            GramPanchayatVillage,
            GramPanchayatStaffAssignment,
            Cooperative,
        )

        # 1. Resolve Village Context
        village = await self.db.get(Village, village_id)
        if not village:
            logger.warning("Cannot dispatch assignment notifications: village %s not found", village_id)
            return {"vo": 0, "farmers": 0, "gp": 0, "coop": 0}

        taluka = await self.db.get(Taluka, village.taluka_id) if village.taluka_id else None
        district = await self.db.get(District, village.district_id) if village.district_id else None

        village_name = village.name_gu or village.name_en or village.code
        taluka_name = taluka.name_gu or taluka.name_en if taluka else ""
        district_name = district.name_gu or district.name_en if district else ""
        vo_name = vo_user.full_name or vo_user.username or "ડૉ. વેટરનરી અધિકારી"
        vo_desig = vo_user.designation or "વેટરનરી ઓફિસર"

        dispatched_counts = {"vo": 0, "farmers": 0, "gp": 0, "coop": 0}

        # ---------------------------------------------------------------------
        # 1. Assigned VO Notification
        # ---------------------------------------------------------------------
        vo_notif = await self.notify(
            recipient_user_id=vo_user.id,
            kind="VO_VILLAGE_ASSIGNMENT",
            message_key="VO_VILLAGE_ASSIGNMENT",
            params={
                "village_id": str(village.id),
                "village_code": village.code,
                "village_name": village_name,
                "taluka_name": taluka_name,
                "district_name": district_name,
                "assigned_by_name": daho_user.full_name or daho_user.username or "DAHO",
            },
            related_type="village",
            related_id=str(village.id)
        )
        if vo_notif:
            dispatched_counts["vo"] = 1

        # ---------------------------------------------------------------------
        # 2. Farmers in Village Notifications
        # ---------------------------------------------------------------------
        farmer_recipient_ids: Set[uuid.UUID] = set()

        # A. Provisioned Farmer Accounts
        f_prov_stmt = (
            select(FarmerAccountProvisioning.user_id)
            .join(Farmer, Farmer.id == FarmerAccountProvisioning.farmer_id)
            .where(
                Farmer.village_id == village.id,
                FarmerAccountProvisioning.revoked_at.is_(None)
            )
        )
        for row in (await self.db.execute(f_prov_stmt)).fetchall():
            farmer_recipient_ids.add(row[0])

        # B. Linked Farmer User Accounts
        f_link_stmt = (
            select(FarmerUserLink.user_id)
            .join(Farmer, Farmer.id == FarmerUserLink.farmer_id)
            .where(Farmer.village_id == village.id)
        )
        for row in (await self.db.execute(f_link_stmt)).fetchall():
            farmer_recipient_ids.add(row[0])

        # C. Active Users with role FARMER matching registered mobile in this village
        f_mob_stmt = (
            select(User.id)
            .where(
                User.role == "FARMER",
                User.status == "ACTIVE",
                User.mobile_e164.in_(
                    select(Farmer.mobile_e164).where(
                        Farmer.village_id == village.id,
                        Farmer.mobile_e164.isnot(None)
                    )
                )
            )
        )
        for row in (await self.db.execute(f_mob_stmt)).fetchall():
            farmer_recipient_ids.add(row[0])

        for f_user_id in farmer_recipient_ids:
            fn = await self.notify(
                recipient_user_id=f_user_id,
                kind="FARMER_VO_ASSIGNED",
                message_key="FARMER_VO_ASSIGNED",
                params={
                    "village_id": str(village.id),
                    "village_name": village_name,
                    "vo_name": vo_name,
                    "vo_designation": vo_desig,
                    "vo_mobile": vo_user.mobile_e164 or ""
                },
                related_type="village",
                related_id=str(village.id)
            )
            if fn:
                dispatched_counts["farmers"] += 1

        # ---------------------------------------------------------------------
        # 3. Gram Panchayat Notifications
        # ---------------------------------------------------------------------
        gp_recipient_ids: Set[uuid.UUID] = set()
        gp_stmt = (
            select(GramPanchayatVillage.gram_panchayat_id)
            .where(
                GramPanchayatVillage.village_id == village.id,
                GramPanchayatVillage.ended_at.is_(None)
            )
        )
        gp_ids = [r[0] for r in (await self.db.execute(gp_stmt)).fetchall()]

        for gp_id in gp_ids:
            # GP staff
            gps_stmt = (
                select(GramPanchayatStaffAssignment.user_id)
                .where(
                    GramPanchayatStaffAssignment.gram_panchayat_id == gp_id,
                    GramPanchayatStaffAssignment.ended_at.is_(None)
                )
            )
            for r in (await self.db.execute(gps_stmt)).fetchall():
                gp_recipient_ids.add(r[0])

            # GP creator
            gp_obj = await self.db.get(GramPanchayat, gp_id)
            if gp_obj and gp_obj.created_by:
                gp_recipient_ids.add(gp_obj.created_by)

        for gp_uid in gp_recipient_ids:
            gpn = await self.notify(
                recipient_user_id=gp_uid,
                kind="GP_VO_ASSIGNED",
                message_key="GP_VO_ASSIGNED",
                params={
                    "village_id": str(village.id),
                    "village_name": village_name,
                    "vo_name": vo_name,
                    "vo_designation": vo_desig
                },
                related_type="village",
                related_id=str(village.id)
            )
            if gpn:
                dispatched_counts["gp"] += 1

        # ---------------------------------------------------------------------
        # 4. Dairy Cooperative Notifications
        # ---------------------------------------------------------------------
        coop_recipient_ids: Set[uuid.UUID] = set()
        cv_stmt = select(CooperativeVillage.cooperative_id).where(CooperativeVillage.village_id == village.id)
        coop_ids = [r[0] for r in (await self.db.execute(cv_stmt)).fetchall()]

        for c_id in coop_ids:
            # Staff assigned to coop
            cs_stmt = (
                select(CooperativeStaffAssignment.user_id)
                .where(
                    CooperativeStaffAssignment.cooperative_id == c_id,
                    CooperativeStaffAssignment.ended_at.is_(None)
                )
            )
            for r in (await self.db.execute(cs_stmt)).fetchall():
                coop_recipient_ids.add(r[0])

            # Coop creator
            c_obj = await self.db.get(Cooperative, c_id)
            if c_obj and c_obj.created_by:
                coop_recipient_ids.add(c_obj.created_by)

        for coop_uid in coop_recipient_ids:
            cn = await self.notify(
                recipient_user_id=coop_uid,
                kind="COOP_VO_ASSIGNED",
                message_key="COOP_VO_ASSIGNED",
                params={
                    "village_id": str(village.id),
                    "village_name": village_name,
                    "vo_name": vo_name,
                    "vo_designation": vo_desig
                },
                related_type="village",
                related_id=str(village.id)
            )
            if cn:
                dispatched_counts["coop"] += 1

        return dispatched_counts

    async def dispatch_village_vo_ended_notification(
        self,
        village_id: uuid.UUID,
        vo_user: User,
        daho_user: User
    ) -> None:
        """Notify VO that their village assignment has ended."""
        from app.models.geography import Village
        village = await self.db.get(Village, village_id)
        village_name = village.name_gu or village.name_en or village.code if village else "ગામ"
        await self.notify(
            recipient_user_id=vo_user.id,
            kind="VO_VILLAGE_ENDED",
            message_key="VO_VILLAGE_ENDED",
            params={
                "village_id": str(village_id),
                "village_name": village_name,
                "ended_by_name": daho_user.full_name or daho_user.username or "DAHO"
            },
            related_type="village",
            related_id=str(village_id)
        )

    async def dispatch_campaign_stakeholder_notifications(
        self,
        campaign: Any,
        village_id: uuid.UUID,
        daho_user: User,
        disease_code: str = "FMD",
        species_names_gu: Optional[List[str]] = None
    ) -> Dict[str, int]:
        """Dispatch campaign / zumbesh assignment notifications to:
        1. Authorized VO for the village (with PENDING_ACCEPTANCE status).
        2. Registered Farmers in that village (view-only campaign announcement).
        3. Gram Panchayat (informative campaign alert).
        4. Dairy Cooperative (informative campaign alert).
        """
        from app.models.geography import Village
        from app.modules.farmers.models import Farmer, FarmerAccountProvisioning
        from app.modules.authorization.models import (
            FarmerUserLink,
            CooperativeVillage,
            CooperativeStaffAssignment,
        )
        from app.modules.administration.models import (
            GramPanchayat,
            GramPanchayatVillage,
            GramPanchayatStaffAssignment,
            Cooperative,
        )

        village = await self.db.get(Village, village_id)
        v_name = village.name_gu or village.name_en or village.code if village else "ગામ"

        dispatched = {"vo": 0, "farmers": 0, "gp": 0, "coop": 0}

        # 1. Resolve authorized VO for this village
        vo_stmt = (
            select(User)
            .join(UserVillageAssignment, UserVillageAssignment.user_id == User.id)
            .where(
                UserVillageAssignment.village_id == village_id,
                UserVillageAssignment.ended_at.is_(None),
                User.role.in_(["VET_OFFICER", "VO"]),
                func.upper(User.status) == "ACTIVE"
            )
        )
        vo_user = (await self.db.execute(vo_stmt)).scalars().first()
        if vo_user:
            vo_notif = await self.notify(
                recipient_user_id=vo_user.id,
                kind="CAMPAIGN_VO_ASSIGNMENT",
                message_key="CAMPAIGN_VO_ASSIGNMENT",
                params={
                    "campaign_id": str(campaign.id),
                    "campaign_code": campaign.code,
                    "campaign_name": campaign.name,
                    "disease_code": disease_code,
                    "village_id": str(village_id),
                    "village_name": v_name,
                    "start_date": str(campaign.start_date) if campaign.start_date else "",
                    "end_date": str(campaign.end_date) if campaign.end_date else "",
                    "species_list": species_names_gu or [],
                    "acceptance_status": "PENDING_ACCEPTANCE",
                    "rejection_reason": None,
                    "daho_name": daho_user.full_name or daho_user.username or "DAHO",
                },
                related_type="campaign",
                related_id=str(campaign.id)
            )
            if vo_notif:
                dispatched["vo"] = 1

        # 2. Farmers in Village
        farmer_recipient_ids: Set[uuid.UUID] = set()
        f_prov_stmt = (
            select(FarmerAccountProvisioning.user_id)
            .join(Farmer, Farmer.id == FarmerAccountProvisioning.farmer_id)
            .where(
                Farmer.village_id == village_id,
                FarmerAccountProvisioning.revoked_at.is_(None)
            )
        )
        for row in (await self.db.execute(f_prov_stmt)).fetchall():
            farmer_recipient_ids.add(row[0])

        f_link_stmt = (
            select(FarmerUserLink.user_id)
            .join(Farmer, Farmer.id == FarmerUserLink.farmer_id)
            .where(Farmer.village_id == village_id)
        )
        for row in (await self.db.execute(f_link_stmt)).fetchall():
            farmer_recipient_ids.add(row[0])

        f_mob_stmt = (
            select(User.id)
            .where(
                User.role == "FARMER",
                User.status == "ACTIVE",
                User.mobile_e164.in_(
                    select(Farmer.mobile_e164).where(
                        Farmer.village_id == village_id,
                        Farmer.mobile_e164.isnot(None)
                    )
                )
            )
        )
        for row in (await self.db.execute(f_mob_stmt)).fetchall():
            farmer_recipient_ids.add(row[0])

        for f_uid in farmer_recipient_ids:
            fn = await self.notify(
                recipient_user_id=f_uid,
                kind="CAMPAIGN_FARMER_ANNOUNCEMENT",
                message_key="CAMPAIGN_FARMER_ANNOUNCEMENT",
                params={
                    "campaign_id": str(campaign.id),
                    "campaign_name": campaign.name,
                    "disease_code": disease_code,
                    "village_id": str(village_id),
                    "village_name": v_name
                },
                related_type="campaign",
                related_id=str(campaign.id)
            )
            if fn:
                dispatched["farmers"] += 1

        # 3. Gram Panchayat in Village
        gp_recipient_ids: Set[uuid.UUID] = set()
        gp_stmt = (
            select(GramPanchayatVillage.gram_panchayat_id)
            .where(
                GramPanchayatVillage.village_id == village_id,
                GramPanchayatVillage.ended_at.is_(None)
            )
        )
        for gp_id in [r[0] for r in (await self.db.execute(gp_stmt)).fetchall()]:
            gps_stmt = (
                select(GramPanchayatStaffAssignment.user_id)
                .where(
                    GramPanchayatStaffAssignment.gram_panchayat_id == gp_id,
                    GramPanchayatStaffAssignment.ended_at.is_(None)
                )
            )
            for r in (await self.db.execute(gps_stmt)).fetchall():
                gp_recipient_ids.add(r[0])
            gp_obj = await self.db.get(GramPanchayat, gp_id)
            if gp_obj and gp_obj.created_by:
                gp_recipient_ids.add(gp_obj.created_by)

        for gp_uid in gp_recipient_ids:
            gpn = await self.notify(
                recipient_user_id=gp_uid,
                kind="CAMPAIGN_GP_ANNOUNCEMENT",
                message_key="CAMPAIGN_GP_ANNOUNCEMENT",
                params={
                    "campaign_id": str(campaign.id),
                    "campaign_name": campaign.name,
                    "disease_code": disease_code,
                    "village_id": str(village_id),
                    "village_name": v_name
                },
                related_type="campaign",
                related_id=str(campaign.id)
            )
            if gpn:
                dispatched["gp"] += 1

        # 4. Dairy Cooperative in Village
        coop_recipient_ids: Set[uuid.UUID] = set()
        cv_stmt = select(CooperativeVillage.cooperative_id).where(CooperativeVillage.village_id == village_id)
        for c_id in [r[0] for r in (await self.db.execute(cv_stmt)).fetchall()]:
            cs_stmt = (
                select(CooperativeStaffAssignment.user_id)
                .where(
                    CooperativeStaffAssignment.cooperative_id == c_id,
                    CooperativeStaffAssignment.ended_at.is_(None)
                )
            )
            for r in (await self.db.execute(cs_stmt)).fetchall():
                coop_recipient_ids.add(r[0])
            c_obj = await self.db.get(Cooperative, c_id)
            if c_obj and c_obj.created_by:
                coop_recipient_ids.add(c_obj.created_by)

        for coop_uid in coop_recipient_ids:
            cn = await self.notify(
                recipient_user_id=coop_uid,
                kind="CAMPAIGN_COOP_ANNOUNCEMENT",
                message_key="CAMPAIGN_COOP_ANNOUNCEMENT",
                params={
                    "campaign_id": str(campaign.id),
                    "campaign_name": campaign.name,
                    "disease_code": disease_code,
                    "village_id": str(village_id),
                    "village_name": v_name
                },
                related_type="campaign",
                related_id=str(campaign.id)
            )
            if cn:
                dispatched["coop"] += 1

        return dispatched


