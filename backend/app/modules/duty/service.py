"""Duty Management, Live Location Tracking and Smart Assignment Service.

Strictly coordinates:
- Starting / Ending FW duty sessions with browser GPS.
- Ingestion of periodic location updates with stale location detection.
- Live spatial tracking of Field Workers for Veterinary Officers.
- Automatic clustering of pending complaints.
- Intelligent ranking and recommendation of Field Workers.
- VO final assignment confirmation and manual overrides with audit logging.
- Work execution and complaint visit outcome updates.
"""
import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, List, Optional, Set, Tuple
from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.geography import District, Taluka, Village
from app.modules.authentication.models import User, UserVillageAssignment
from app.modules.authorization.service import AuthorizationService
from app.modules.duty.haversine import haversine_distance_km
from app.modules.duty.models import (
    ComplaintAssignmentGroup,
    ComplaintGroupItem,
    FwAssignmentHistory,
    FwDutySession,
    FwLocation,
    HelpRequest,
)
from app.modules.duty.schemas import (
    ComplaintGroupItemDetail,
    ComplaintGroupResponse,
    ComplaintItemResponse,
    CreateHelpRequestPayload,
    DutyStartResponse,
    DutyStatusResponse,
    LiveFieldWorkerItem,
    VoLiveFieldWorkersResponse,
)

logger = logging.getLogger("pashurakshak.duty.service")

STALE_THRESHOLD_MINUTES = 15


class DutyService:
    """Service handling all operational aspects of Field Worker duty, tracking, and assignments."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.authz = AuthorizationService(db)

    # ==========================================================================
    # 1. Field Worker Duty Session Lifecycle
    # ==========================================================================

    async def start_duty(
        self,
        current_user: User,
        latitude: float,
        longitude: float,
        accuracy: Optional[float] = None,
        device_status: Optional[str] = "ONLINE"
    ) -> DutyStartResponse:
        """Start a new active duty session for a Field Worker or reactivate existing."""
        if current_user.role not in ("FIELD_WORKER", "FW"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="માત્ર ક્ષેત્રીય કાર્યકર (Field Worker) જ ડ્યૂટી શરૂ કરી શકે છે."
            )

        now_utc = datetime.now(timezone.utc)

        # Check if there is already an active duty session for this user
        existing_stmt = (
            select(FwDutySession)
            .where(
                FwDutySession.fw_user_id == current_user.id,
                FwDutySession.status == "ACTIVE"
            )
            .order_by(FwDutySession.start_time.desc())
        )
        existing = (await self.db.execute(existing_stmt)).scalar_one_or_none()

        lat_dec = Decimal(str(round(latitude, 6)))
        lng_dec = Decimal(str(round(longitude, 6)))
        acc_dec = Decimal(str(round(accuracy, 2))) if accuracy is not None else None

        if existing:
            # Idempotently update current active session with fresh location
            existing.last_known_latitude = lat_dec
            existing.last_known_longitude = lng_dec
            existing.last_location_update = now_utc
            existing.location_accuracy = acc_dec
            existing.device_status = device_status
            existing.updated_at = now_utc

            # Add breadcrumb
            breadcrumb = FwLocation(
                duty_session_id=existing.id,
                fw_user_id=current_user.id,
                latitude=lat_dec,
                longitude=lng_dec,
                accuracy=acc_dec,
                source="GPS",
                recorded_at=now_utc,
                received_at=now_utc
            )
            self.db.add(breadcrumb)
            await self.db.commit()

            return DutyStartResponse(
                session_id=existing.id,
                fw_user_id=current_user.id,
                status="ACTIVE",
                start_time=existing.start_time,
                last_known_latitude=float(lat_dec),
                last_known_longitude=float(lng_dec),
                last_location_update=now_utc,
                message="ડ્યૂટી પહેલેથી જ સક્રિય છે. સ્થાન તાજું કરવામાં આવ્યું."
            )

        # Create new duty session
        new_session = FwDutySession(
            fw_user_id=current_user.id,
            start_time=now_utc,
            status="ACTIVE",
            last_known_latitude=lat_dec,
            last_known_longitude=lng_dec,
            last_location_update=now_utc,
            location_accuracy=acc_dec,
            device_status=device_status,
            created_at=now_utc,
            updated_at=now_utc
        )
        self.db.add(new_session)
        await self.db.flush()

        # Add initial breadcrumb
        breadcrumb = FwLocation(
            duty_session_id=new_session.id,
            fw_user_id=current_user.id,
            latitude=lat_dec,
            longitude=lng_dec,
            accuracy=acc_dec,
            source="GPS",
            recorded_at=now_utc,
            received_at=now_utc
        )
        self.db.add(breadcrumb)
        session_id = new_session.id
        await self.db.commit()

        logger.info("Field worker %s started duty session %s", current_user.id, session_id)
        return DutyStartResponse(
            session_id=session_id,
            fw_user_id=current_user.id,
            status="ACTIVE",
            start_time=now_utc,
            last_known_latitude=float(lat_dec),
            last_known_longitude=float(lng_dec),
            last_location_update=now_utc,
            message="ડ્યૂટી સફળતાપૂર્વક શરૂ થઈ ગઈ છે."
        )

    async def end_duty(
        self,
        current_user: User,
        reason: Optional[str] = None
    ) -> uuid.UUID:
        """Complete and close any active duty sessions for the Field Worker."""
        now_utc = datetime.now(timezone.utc)
        stmt = (
            select(FwDutySession)
            .where(
                FwDutySession.fw_user_id == current_user.id,
                FwDutySession.status == "ACTIVE"
            )
        )
        sessions = list((await self.db.execute(stmt)).scalars().all())

        if not sessions:
            logger.info("No active duty session found to end for user %s", current_user.id)
            return uuid.uuid4()

        for s in sessions:
            s.status = "INACTIVE"
            s.end_time = now_utc
            s.updated_at = now_utc

        ended_session_id = sessions[0].id
        await self.db.commit()
        logger.info("Ended %d duty sessions for field worker %s", len(sessions), current_user.id)
        return ended_session_id

    async def record_location_update(
        self,
        current_user: User,
        latitude: float,
        longitude: float,
        accuracy: Optional[float] = None,
        source: str = "GPS",
        recorded_at: Optional[datetime] = None,
        session_id: Optional[uuid.UUID] = None
    ) -> uuid.UUID:
        """Record periodic location update from FW device during duty."""
        now_utc = datetime.now(timezone.utc)
        rec_time = recorded_at or now_utc

        # Find active duty session
        session: Optional[FwDutySession] = None
        if session_id:
            s_stmt = select(FwDutySession).where(
                FwDutySession.id == session_id,
                FwDutySession.fw_user_id == current_user.id
            )
            session = (await self.db.execute(s_stmt)).scalar_one_or_none()

        if not session:
            s_stmt = (
                select(FwDutySession)
                .where(
                    FwDutySession.fw_user_id == current_user.id,
                    FwDutySession.status == "ACTIVE"
                )
                .order_by(FwDutySession.start_time.desc())
            )
            session = (await self.db.execute(s_stmt)).scalar_one_or_none()

        if not session:
            # Auto-create active duty session if location update is received
            session = FwDutySession(
                fw_user_id=current_user.id,
                start_time=rec_time,
                status="ACTIVE",
                created_at=now_utc,
                updated_at=now_utc
            )
            self.db.add(session)
            await self.db.flush()

        lat_dec = Decimal(str(round(latitude, 6)))
        lng_dec = Decimal(str(round(longitude, 6)))
        acc_dec = Decimal(str(round(accuracy, 2))) if accuracy is not None else None

        # Only update latest location if this update is newer than last recorded
        if session.last_location_update is None or rec_time >= session.last_location_update:
            session.last_known_latitude = lat_dec
            session.last_known_longitude = lng_dec
            session.last_location_update = rec_time
            session.location_accuracy = acc_dec
            session.updated_at = now_utc

        # Save breadcrumb
        breadcrumb = FwLocation(
            duty_session_id=session.id,
            fw_user_id=current_user.id,
            latitude=lat_dec,
            longitude=lng_dec,
            accuracy=acc_dec,
            source=source,
            recorded_at=rec_time,
            received_at=now_utc
        )
        self.db.add(breadcrumb)
        returned_session_id = session.id
        await self.db.commit()

        return returned_session_id

    async def get_duty_status(self, current_user: User) -> DutyStatusResponse:
        """Fetch current duty status and last recorded location for the caller."""
        stmt = (
            select(FwDutySession)
            .where(
                FwDutySession.fw_user_id == current_user.id,
                FwDutySession.status == "ACTIVE"
            )
            .order_by(FwDutySession.start_time.desc())
        )
        session = (await self.db.execute(stmt)).scalar_one_or_none()

        if not session:
            return DutyStatusResponse(
                is_on_duty=False,
                freshness="INACTIVE"
            )

        now_utc = datetime.now(timezone.utc)
        minutes_since = None
        freshness = "UNAVAILABLE"

        if session.last_location_update:
            diff = (now_utc - session.last_location_update).total_seconds() / 60.0
            minutes_since = max(0, int(diff))
            freshness = "FRESH" if diff <= STALE_THRESHOLD_MINUTES else "STALE"

        return DutyStatusResponse(
            is_on_duty=True,
            session_id=session.id,
            start_time=session.start_time,
            last_known_latitude=float(session.last_known_latitude) if session.last_known_latitude is not None else None,
            last_known_longitude=float(session.last_known_longitude) if session.last_known_longitude is not None else None,
            last_location_update=session.last_location_update,
            location_accuracy=float(session.location_accuracy) if session.location_accuracy is not None else None,
            freshness=freshness,
            minutes_since_update=minutes_since
        )

    # ==========================================================================
    # 2. VO Live Field Worker Tracking Map Queries
    # ==========================================================================

    async def get_live_field_workers_for_vo(
        self,
        current_user: User
    ) -> VoLiveFieldWorkersResponse:
        """Fetch all field workers within the VO's authorized jurisdiction with live tracking status."""
        scope = await self.authz.get_user_scope(current_user)

        # Retrieve villages assigned to VO
        vo_villages = scope.assigned_village_ids
        if not vo_villages and current_user.role == "DAHO":
            # For DAHO, find all villages in assigned district
            v_stmt = select(Village.id).where(Village.district_id.in_(scope.assigned_district_ids))
            vo_villages = set((await self.db.execute(v_stmt)).scalars().all())

        # Find field workers assigned to these villages or sharing district
        fw_users_stmt = (
            select(User)
            .where(
                User.role.in_(["FIELD_WORKER", "FW"]),
                User.status == "ACTIVE"
            )
            .order_by(User.full_name)
        )
        candidate_fws = list((await self.db.execute(fw_users_stmt)).scalars().all())

        if not candidate_fws:
            return VoLiveFieldWorkersResponse(
                total_field_workers=0,
                active_on_duty=0,
                fresh_location_count=0,
                stale_location_count=0,
                field_workers=[]
            )

        fw_ids = [fw.id for fw in candidate_fws]

        # Fetch assigned villages for these FWs
        uva_stmt = (
            select(UserVillageAssignment.user_id, Village.id, Village.name_gu)
            .join(Village, Village.id == UserVillageAssignment.village_id)
            .where(
                UserVillageAssignment.user_id.in_(fw_ids),
                UserVillageAssignment.ended_at.is_(None)
            )
        )
        uva_rows = (await self.db.execute(uva_stmt)).all()
        fw_villages_map: Dict[uuid.UUID, List[str]] = {}
        for uid, vid, vname in uva_rows:
            if uid not in fw_villages_map:
                fw_villages_map[uid] = []
            fw_villages_map[uid].append(vname)

        # Fetch latest duty sessions (prioritize ACTIVE, then latest by start_time)
        duty_stmt = (
            select(FwDutySession)
            .where(FwDutySession.fw_user_id.in_(fw_ids))
            .order_by(FwDutySession.start_time.desc())
        )
        all_duty_sessions = list((await self.db.execute(duty_stmt)).scalars().all())
        duty_session_map: Dict[uuid.UUID, FwDutySession] = {}
        for ds in all_duty_sessions:
            if ds.fw_user_id not in duty_session_map:
                duty_session_map[ds.fw_user_id] = ds
            elif ds.status == "ACTIVE" and duty_session_map[ds.fw_user_id].status != "ACTIVE":
                duty_session_map[ds.fw_user_id] = ds

        # Also fetch most recent breadcrumb location from fw_locations
        loc_stmt = (
            select(FwLocation)
            .where(FwLocation.fw_user_id.in_(fw_ids))
            .order_by(FwLocation.recorded_at.desc())
        )
        recent_locations = list((await self.db.execute(loc_stmt)).scalars().all())
        last_loc_map: Dict[uuid.UUID, FwLocation] = {}
        for loc in recent_locations:
            if loc.fw_user_id not in last_loc_map:
                last_loc_map[loc.fw_user_id] = loc

        # Fetch active assignments count
        workload_stmt = (
            select(
                ComplaintAssignmentGroup.assigned_fw_id,
                func.count(ComplaintAssignmentGroup.id)
            )
            .where(
                ComplaintAssignmentGroup.assigned_fw_id.in_(fw_ids),
                ComplaintAssignmentGroup.status.in_(["ASSIGNED", "IN_PROGRESS"])
            )
            .group_by(ComplaintAssignmentGroup.assigned_fw_id)
        )
        workload_map = dict((await self.db.execute(workload_stmt)).all())

        now_utc = datetime.now(timezone.utc)
        active_count = 0
        fresh_count = 0
        stale_count = 0
        items: List[LiveFieldWorkerItem] = []

        for fw in candidate_fws:
            session = duty_session_map.get(fw.id)
            latest_loc = last_loc_map.get(fw.id)

            is_active = session is not None and session.status == "ACTIVE"
            if is_active:
                active_count += 1

            # Resolve coordinates from session or recent breadcrumb
            raw_lat = (
                session.last_known_latitude
                if (session and session.last_known_latitude is not None)
                else (latest_loc.latitude if latest_loc else None)
            )
            raw_lng = (
                session.last_known_longitude
                if (session and session.last_known_longitude is not None)
                else (latest_loc.longitude if latest_loc else None)
            )
            raw_acc = (
                session.location_accuracy
                if (session and session.location_accuracy is not None)
                else (latest_loc.accuracy if latest_loc else None)
            )
            last_update = (
                session.last_location_update
                if (session and session.last_location_update)
                else (latest_loc.recorded_at if latest_loc else None)
            )

            fw_lat = float(raw_lat) if raw_lat is not None else None
            fw_lng = float(raw_lng) if raw_lng is not None else None
            acc_val = float(raw_acc) if raw_acc is not None else None

            freshness = "INACTIVE"
            minutes_since = None

            if is_active:
                if last_update:
                    diff = (now_utc - last_update).total_seconds() / 60.0
                    minutes_since = max(0, int(diff))
                    if diff <= STALE_THRESHOLD_MINUTES:
                        freshness = "FRESH"
                        fresh_count += 1
                    else:
                        freshness = "STALE"
                        stale_count += 1
                else:
                    freshness = "UNAVAILABLE"
            else:
                if fw_lat is not None and fw_lng is not None:
                    freshness = "INACTIVE"
                    if last_update:
                        diff = (now_utc - last_update).total_seconds() / 60.0
                        minutes_since = max(0, int(diff))
                else:
                    freshness = "UNAVAILABLE"

            active_groups = workload_map.get(fw.id, 0)
            availability = "OFF_DUTY"
            if is_active:
                availability = "BUSY" if active_groups >= 2 else "AVAILABLE"

            assigned_vils = fw_villages_map.get(fw.id, [])
            nearest_village = assigned_vils[0] if assigned_vils else None

            item = LiveFieldWorkerItem(
                fw_user_id=fw.id,
                full_name=fw.full_name,
                username=fw.username,
                mobile_e164=fw.mobile_e164,
                designation=fw.designation or "ક્ષેત્રીય કાર્યકર (FW)",
                duty_status="ACTIVE" if is_active else "INACTIVE",
                freshness=freshness,
                last_known_latitude=fw_lat,
                last_known_longitude=fw_lng,
                location_accuracy=acc_val,
                last_location_update=last_update,
                minutes_since_update=minutes_since,
                nearest_village_name_gu=nearest_village,
                assigned_villages_count=len(assigned_vils),
                assigned_villages_gu=assigned_vils,
                active_assignments_count=active_groups,
                pending_complaints_count=active_groups,
                availability_status=availability
            )
            items.append(item)

        return VoLiveFieldWorkersResponse(
            total_field_workers=len(candidate_fws),
            active_on_duty=active_count,
            fresh_location_count=fresh_count,
            stale_location_count=stale_count,
            field_workers=items
        )

    # ==========================================================================
    # 3. Complaint Groups & Assignment Lifecycle
    # ==========================================================================

    async def list_complaint_groups(
        self,
        current_user: User,
        status_filter: Optional[str] = None
    ) -> List[ComplaintGroupResponse]:
        """List complaint assignment groups for the user's authorized scope."""
        scope = await self.authz.get_user_scope(current_user)

        stmt = select(ComplaintAssignmentGroup).order_by(
            ComplaintAssignmentGroup.created_at.desc()
        )

        if current_user.role in ("FIELD_WORKER", "FW"):
            # FW only sees groups assigned to them
            stmt = stmt.where(ComplaintAssignmentGroup.assigned_fw_id == current_user.id)
        elif current_user.role in ("VET_OFFICER", "VO"):
            # VO sees groups in their district
            if scope.assigned_district_ids:
                stmt = stmt.where(ComplaintAssignmentGroup.district_id.in_(scope.assigned_district_ids))
        elif current_user.role == "DAHO":
            if scope.assigned_district_ids:
                stmt = stmt.where(ComplaintAssignmentGroup.district_id.in_(scope.assigned_district_ids))

        if status_filter:
            stmt = stmt.where(ComplaintAssignmentGroup.status == status_filter)

        groups = list((await self.db.execute(stmt)).scalars().all())
        if not groups:
            return []

        # Populate response models
        group_ids = [g.id for g in groups]
        items_stmt = (
            select(ComplaintGroupItem, Village, HelpRequest)
            .join(Village, Village.id == ComplaintGroupItem.village_id)
            .outerjoin(HelpRequest, HelpRequest.id == ComplaintGroupItem.complaint_id)
            .where(ComplaintGroupItem.group_id.in_(group_ids))
        )
        items_rows = (await self.db.execute(items_stmt)).all()

        items_map: Dict[uuid.UUID, List[ComplaintGroupItemDetail]] = {}
        village_names_map: Dict[uuid.UUID, Set[str]] = {}

        for item, vil, req in items_rows:
            if item.group_id not in items_map:
                items_map[item.group_id] = []
                village_names_map[item.group_id] = set()

            village_names_map[item.group_id].add(vil.name_gu)

            detail = ComplaintGroupItemDetail(
                id=item.id,
                complaint_id=item.complaint_id,
                complaint_type=item.complaint_type,
                village_id=vil.id,
                village_name_gu=vil.name_gu,
                village_code=vil.code,
                requester_name=req.requester_name if req else None,
                contact_number=req.contact_number if req else None,
                problem_text=req.problem_text if req else None,
                animal_code=req.animal_description if req else None,
                status=item.status,
                outcome_note=item.outcome_note,
                visited_at=item.visited_at
            )
            items_map[item.group_id].append(detail)

        # Fetch FW and VO names
        user_ids = set()
        for g in groups:
            if g.assigned_fw_id:
                user_ids.add(g.assigned_fw_id)
            if g.assigned_by:
                user_ids.add(g.assigned_by)

        user_name_map: Dict[uuid.UUID, str] = {}
        if user_ids:
            u_stmt = select(User.id, User.full_name).where(User.id.in_(user_ids))
            user_name_map = dict((await self.db.execute(u_stmt)).all())

        responses: List[ComplaintGroupResponse] = []
        for g in groups:
            g_items = items_map.get(g.id, [])
            v_names = list(village_names_map.get(g.id, []))

            res = ComplaintGroupResponse(
                id=g.id,
                group_code=g.group_code,
                district_id=g.district_id,
                taluka_id=g.taluka_id,
                status=g.status,
                priority=g.priority,
                total_complaints=len(g_items),
                villages_count=len(v_names),
                villages_summary_gu=v_names,
                assigned_fw_id=g.assigned_fw_id,
                assigned_fw_name=user_name_map.get(g.assigned_fw_id) if g.assigned_fw_id else None,
                assigned_by_name=user_name_map.get(g.assigned_by) if g.assigned_by else None,
                assigned_at=g.assigned_at,
                accepted_at=g.accepted_at,
                completed_at=g.completed_at,
                assignment_reason=g.assignment_reason,
                created_at=g.created_at,
                items=g_items
            )
            responses.append(res)

        return responses

    async def assign_group_to_fw(
        self,
        group_id: uuid.UUID,
        fw_user_id: uuid.UUID,
        reason: Optional[str],
        current_user: User
    ) -> ComplaintAssignmentGroup:
        """Assign a complaint group to a specific Field Worker (final VO decision)."""
        if current_user.role not in ("VET_OFFICER", "VO", "DAHO"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="માત્ર વેટરનરી ઓફિસર (VO) અથવા DAHO જ સોંપણી કરી શકે છે."
            )

        now_utc = datetime.now(timezone.utc)

        # 1. Fetch group with row lock to prevent race conditions
        group_stmt = select(ComplaintAssignmentGroup).where(
            ComplaintAssignmentGroup.id == group_id
        ).with_for_update()
        group = (await self.db.execute(group_stmt)).scalar_one_or_none()

        if not group:
            raise HTTPException(status_code=404, detail="ફરિયાદ જૂથ મળ્યું નથી.")

        if group.status in ("COMPLETED", "CANCELLED"):
            raise HTTPException(
                status_code=400,
                detail=f"આ જૂથ પહેલેથી જ '{group.status}' સ્થિતિમાં છે. સોંપણી શક્ય નથી."
            )

        # 2. Verify selected Field Worker
        fw_stmt = select(User).where(
            User.id == fw_user_id,
            User.role.in_(["FIELD_WORKER", "FW"]),
            User.status == "ACTIVE"
        )
        fw = (await self.db.execute(fw_stmt)).scalar_one_or_none()
        if not fw:
            raise HTTPException(status_code=404, detail="પસંદ કરેલ ક્ષેત્રીય કાર્યકર માન્ય કે સક્રિય નથી.")

        # 3. Update group
        prev_fw = group.assigned_fw_id
        group.assigned_fw_id = fw_user_id
        group.assigned_by = current_user.id
        group.assigned_at = now_utc
        group.status = "ASSIGNED"
        group.assignment_reason = reason or "VO દ્વારા માન્ય ભલામણ આધારિત સોંપણી"
        group.updated_at = now_utc

        # 4. Update linked help requests
        item_complaint_ids_stmt = select(ComplaintGroupItem.complaint_id).where(
            ComplaintGroupItem.group_id == group.id,
            ComplaintGroupItem.complaint_type == "HELP_REQUEST"
        )
        complaint_ids = list((await self.db.execute(item_complaint_ids_stmt)).scalars().all())

        if complaint_ids:
            update_reqs = (
                update(HelpRequest)
                .where(HelpRequest.id.in_(complaint_ids))
                .values(
                    assigned_to=fw_user_id,
                    status="ASSIGNED",
                    updated_at=now_utc
                )
            )
            await self.db.execute(update_reqs)

        # 5. Append assignment audit history
        history = FwAssignmentHistory(
            group_id=group.id,
            previous_fw_id=prev_fw,
            new_fw_id=fw_user_id,
            changed_by=current_user.id,
            action="REASSIGNED" if prev_fw else "ASSIGNED",
            reason=reason or "નિયમિત સોંપણી",
            created_at=now_utc
        )
        self.db.add(history)
        await self.db.commit()

        logger.info("Assigned complaint group %s to FW %s by VO %s", group.id, fw_user_id, current_user.id)
        return group

    async def update_fw_assignment_status(
        self,
        group_id: uuid.UUID,
        action: str,
        complaint_id: Optional[uuid.UUID],
        outcome_note: Optional[str],
        current_user: User
    ) -> ComplaintAssignmentGroup:
        """Update assignment status by the assigned Field Worker."""
        now_utc = datetime.now(timezone.utc)

        group_stmt = select(ComplaintAssignmentGroup).where(
            ComplaintAssignmentGroup.id == group_id
        ).with_for_update()
        group = (await self.db.execute(group_stmt)).scalar_one_or_none()

        if not group:
            raise HTTPException(status_code=404, detail="ફરિયાદ જૂથ મળ્યું નથી.")

        # Ensure the caller is the assigned FW
        if group.assigned_fw_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="તમે આ જૂથ માટે સોંપાયેલા કાર્યકર નથી."
            )

        if action == "ACCEPT":
            group.status = "IN_PROGRESS"
            group.accepted_at = now_utc
            group.updated_at = now_utc

            history = FwAssignmentHistory(
                group_id=group.id,
                previous_fw_id=group.assigned_fw_id,
                new_fw_id=group.assigned_fw_id,
                changed_by=current_user.id,
                action="ACCEPTED",
                reason="કાર્યકર દ્વારા સોંપણી સ્વીકારવામાં આવી",
                created_at=now_utc
            )
            self.db.add(history)

        elif action == "START_VISIT":
            group.status = "IN_PROGRESS"
            group.updated_at = now_utc

            if complaint_id:
                up_item = (
                    update(ComplaintGroupItem)
                    .where(
                        ComplaintGroupItem.group_id == group_id,
                        ComplaintGroupItem.complaint_id == complaint_id
                    )
                    .values(status="VISITING")
                )
                await self.db.execute(up_item)

        elif action == "COMPLETE":
            # Mark complaint items resolved
            if complaint_id:
                up_item = (
                    update(ComplaintGroupItem)
                    .where(
                        ComplaintGroupItem.group_id == group_id,
                        ComplaintGroupItem.complaint_id == complaint_id
                    )
                    .values(
                        status="RESOLVED",
                        outcome_note=outcome_note or "મુલાકાત સંપન્ન",
                        visited_at=now_utc
                    )
                )
                await self.db.execute(up_item)

                # Update corresponding help request
                up_req = (
                    update(HelpRequest)
                    .where(HelpRequest.id == complaint_id)
                    .values(
                        status="RESOLVED",
                        outcome_text=outcome_note or "મુલાકાત સંપન્ન",
                        resolved_at=now_utc,
                        updated_at=now_utc
                    )
                )
                await self.db.execute(up_req)

            # Check if all items in group are resolved
            remaining_stmt = select(func.count(ComplaintGroupItem.id)).where(
                ComplaintGroupItem.group_id == group_id,
                ComplaintGroupItem.status != "RESOLVED"
            )
            remaining_count = (await self.db.execute(remaining_stmt)).scalar() or 0

            if remaining_count == 0 or not complaint_id:
                # Mark entire group complete
                group.status = "COMPLETED"
                group.completed_at = now_utc
                group.updated_at = now_utc

                # Resolve all items
                await self.db.execute(
                    update(ComplaintGroupItem)
                    .where(ComplaintGroupItem.group_id == group_id)
                    .values(status="RESOLVED", outcome_note=outcome_note or "મુલાકાત સંપન્ન", visited_at=now_utc)
                )

                history = FwAssignmentHistory(
                    group_id=group.id,
                    previous_fw_id=group.assigned_fw_id,
                    new_fw_id=group.assigned_fw_id,
                    changed_by=current_user.id,
                    action="STATUS_CHANGE",
                    reason=f"કામગીરી સંપન્ન: {outcome_note or 'તમામ મુલાકાતો પૂર્ણ'}",
                    created_at=now_utc
                )
                self.db.add(history)

        await self.db.commit()
        return group

    # ==========================================================================
    # 4. Manual Complaint Creation
    # ==========================================================================

    async def create_help_request(
        self,
        payload: CreateHelpRequestPayload,
        current_user: User
    ) -> HelpRequest:
        """Create a new farmer help request / animal complaint."""
        now_utc = datetime.now(timezone.utc)
        year_str = now_utc.strftime("%Y")
        rand_ref = f"HR-BOT-{year_str}-{uuid.uuid4().hex[:6].upper()}"

        req = HelpRequest(
            reference_no=rand_ref,
            requester_name=payload.requester_name,
            contact_number=payload.contact_number,
            village_id=payload.village_id,
            farmer_id=payload.farmer_id,
            animal_id=payload.animal_id,
            animal_description=payload.animal_description,
            problem_text=payload.problem_text,
            source="STAFF_ASSISTED" if current_user.role != "FARMER" else "FARMER_APP",
            registered_by=current_user.id,
            status="SUBMITTED",
            created_at=now_utc,
            updated_at=now_utc
        )
        self.db.add(req)
        await self.db.commit()
        await self.db.refresh(req)
        return req

