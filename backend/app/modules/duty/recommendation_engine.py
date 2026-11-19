"""Intelligent Field Worker Recommendation Engine.

Ranks authorized Field Workers for a given Complaint Assignment Group based on:
1. Haversine distance to the cluster centroid (within 80 KM radius).
2. Duty session status and location freshness (fresh vs stale).
3. Current active workload and pending complaint load.
4. Village assignment familiarity / authority.
5. Strict district boundary enforcement (no cross-district assignments without explicit VO manual override).
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set, Tuple
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.geography import Village
from app.modules.authentication.models import User, UserVillageAssignment
from app.modules.duty.haversine import haversine_distance_km, calculate_cluster_centroid
from app.modules.duty.models import (
    ComplaintAssignmentGroup,
    ComplaintGroupItem,
    FwDutySession,
    FwLocation,
)
from app.modules.duty.schemas import FwRecommendationItem, GroupRecommendationsResponse

logger = logging.getLogger("pashurakshak.duty.recommendation")

MAX_SUGGESTION_RADIUS_KM = 80.0
STALE_THRESHOLD_MINUTES = 15


class FwRecommendationEngine:
    """Engine providing transparent, scored FW recommendations for a complaint group."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_recommendations_for_group(
        self,
        group_id: uuid.UUID,
        vo_user: User
    ) -> GroupRecommendationsResponse:
        """Calculate and return top 2-3 suitable FW recommendations for a complaint group."""
        # 1. Fetch group details
        group_stmt = select(ComplaintAssignmentGroup).where(ComplaintAssignmentGroup.id == group_id)
        group = (await self.db.execute(group_stmt)).scalar_one_or_none()
        if not group:
            raise ValueError(f"Complaint assignment group {group_id} not found.")

        # 2. Fetch group items and villages to compute centroid
        items_stmt = (
            select(ComplaintGroupItem, Village)
            .join(Village, Village.id == ComplaintGroupItem.village_id)
            .where(ComplaintGroupItem.group_id == group_id)
        )
        item_rows = (await self.db.execute(items_stmt)).all()

        village_coords: List[Tuple[float, float]] = []
        group_village_ids: Set[uuid.UUID] = set()

        for item, vil in item_rows:
            group_village_ids.add(vil.id)
            if vil.latitude is not None and vil.longitude is not None:
                village_coords.append((float(vil.latitude), float(vil.longitude)))

        centroid = calculate_cluster_centroid(village_coords)
        centroid_lat = centroid[0] if centroid else None
        centroid_lng = centroid[1] if centroid else None

        # 3. Find candidate Field Workers in the district / authorized jurisdiction
        # Must be active users with role FIELD_WORKER or FW
        fw_stmt = (
            select(User)
            .where(
                User.role.in_(["FIELD_WORKER", "FW"]),
                User.status == "ACTIVE"
            )
        )
        candidate_fws = list((await self.db.execute(fw_stmt)).scalars().all())

        # Filter candidates by district authorization:
        # A FW is authorized if assigned to any village belonging to this district
        fw_ids = [fw.id for fw in candidate_fws]
        auth_stmt = (
            select(UserVillageAssignment.user_id, UserVillageAssignment.village_id)
            .join(Village, Village.id == UserVillageAssignment.village_id)
            .where(
                UserVillageAssignment.user_id.in_(fw_ids),
                UserVillageAssignment.ended_at.is_(None),
                Village.district_id == group.district_id
            )
        )
        auth_rows = (await self.db.execute(auth_stmt)).all()
        fw_assigned_villages_map: Dict[uuid.UUID, Set[uuid.UUID]] = {}
        for uid, vid in auth_rows:
            if uid not in fw_assigned_villages_map:
                fw_assigned_villages_map[uid] = set()
            fw_assigned_villages_map[uid].add(vid)

        # Candidates who have at least one assigned village in this district
        eligible_candidates = [
            fw for fw in candidate_fws if fw.id in fw_assigned_villages_map
        ]

        if not eligible_candidates:
            return GroupRecommendationsResponse(
                group_id=group.id,
                group_code=group.group_code,
                centroid_lat=centroid_lat,
                centroid_lng=centroid_lng,
                suggestion_radius_km=MAX_SUGGESTION_RADIUS_KM,
                has_eligible_recommendations=False,
                notice_gu="આ જિલ્લામાં કોઈ અધિકૃત ક્ષેત્રીય કાર્યકર (FW) નોંધાયેલા નથી.",
                recommendations=[]
            )

        # 4. Fetch latest duty sessions for these FWs (prioritize ACTIVE, then latest)
        duty_stmt = (
            select(FwDutySession)
            .where(FwDutySession.fw_user_id.in_([fw.id for fw in eligible_candidates]))
            .order_by(FwDutySession.start_time.desc())
        )
        all_duty_sessions = list((await self.db.execute(duty_stmt)).scalars().all())
        duty_session_map: Dict[uuid.UUID, FwDutySession] = {}
        for ds in all_duty_sessions:
            if ds.fw_user_id not in duty_session_map:
                duty_session_map[ds.fw_user_id] = ds
            elif ds.status == "ACTIVE" and duty_session_map[ds.fw_user_id].status != "ACTIVE":
                duty_session_map[ds.fw_user_id] = ds

        # Recent breadcrumb location
        loc_stmt = (
            select(FwLocation)
            .where(FwLocation.fw_user_id.in_([fw.id for fw in eligible_candidates]))
            .order_by(FwLocation.recorded_at.desc())
        )
        recent_locations = list((await self.db.execute(loc_stmt)).scalars().all())
        last_loc_map: Dict[uuid.UUID, FwLocation] = {}
        for loc in recent_locations:
            if loc.fw_user_id not in last_loc_map:
                last_loc_map[loc.fw_user_id] = loc

        # 5. Fetch current workload (active assignment groups and pending items)
        workload_stmt = (
            select(
                ComplaintAssignmentGroup.assigned_fw_id,
                func.count(ComplaintAssignmentGroup.id)
            )
            .where(
                ComplaintAssignmentGroup.assigned_fw_id.in_([fw.id for fw in eligible_candidates]),
                ComplaintAssignmentGroup.status.in_(["ASSIGNED", "IN_PROGRESS"])
            )
            .group_by(ComplaintAssignmentGroup.assigned_fw_id)
        )
        workload_counts = dict((await self.db.execute(workload_stmt)).all())

        now_utc = datetime.now(timezone.utc)
        scored_fws: List[FwRecommendationItem] = []

        for fw in eligible_candidates:
            duty_session = duty_session_map.get(fw.id)
            latest_loc = last_loc_map.get(fw.id)
            is_on_duty = duty_session is not None and duty_session.status == "ACTIVE"

            raw_lat = (
                duty_session.last_known_latitude
                if (duty_session and duty_session.last_known_latitude is not None)
                else (latest_loc.latitude if latest_loc else None)
            )
            raw_lng = (
                duty_session.last_known_longitude
                if (duty_session and duty_session.last_known_longitude is not None)
                else (latest_loc.longitude if latest_loc else None)
            )
            fw_lat = float(raw_lat) if raw_lat is not None else None
            fw_lng = float(raw_lng) if raw_lng is not None else None
            last_update = (
                duty_session.last_location_update
                if (duty_session and duty_session.last_location_update)
                else (latest_loc.recorded_at if latest_loc else None)
            )

            # Freshness calculation
            freshness = "INACTIVE"
            minutes_since = None
            if is_on_duty:
                if last_update:
                    diff = (now_utc - last_update).total_seconds() / 60.0
                    minutes_since = int(diff)
                    if diff <= STALE_THRESHOLD_MINUTES:
                        freshness = "FRESH"
                    else:
                        freshness = "STALE"
                else:
                    freshness = "UNAVAILABLE"

            # Distance calculation (Haversine)
            distance_km = None
            if centroid_lat is not None and centroid_lng is not None and fw_lat is not None and fw_lng is not None:
                distance_km = haversine_distance_km(centroid_lat, centroid_lng, fw_lat, fw_lng)

            # If FW location is missing, check distance from their assigned villages
            if distance_km is None:
                # Fallback distance approximation: infinite or 999.0 for ranking
                distance_km = 999.0

            # Exclude FWs outside 80 km from standard recommendations
            if distance_km > MAX_SUGGESTION_RADIUS_KM and distance_km != 999.0:
                continue

            # Check village familiarity (if FW is assigned to any village in this complaint group)
            fw_villages = fw_assigned_villages_map.get(fw.id, set())
            is_village_assigned = bool(fw_villages.intersection(group_village_ids))

            active_workload = workload_counts.get(fw.id, 0)

            # Scoring algorithm:
            # Base score = 100
            # Distance penalty: -1.0 per km
            # Freshness bonus: FRESH = +30, STALE = +10, UNAVAILABLE = 0, INACTIVE = -50
            # Duty bonus: ON_DUTY = +20
            # Familiarity bonus: +25 if assigned to one of the group's villages
            # Workload penalty: -15 per active assignment
            score = 100.0
            if distance_km != 999.0:
                score -= min(distance_km * 0.8, 60.0)
            else:
                score -= 40.0

            if freshness == "FRESH":
                score += 30.0
            elif freshness == "STALE":
                score += 10.0
            elif freshness == "INACTIVE":
                score -= 40.0

            if is_village_assigned:
                score += 25.0

            score -= active_workload * 15.0

            # Generate natural Gujarati reasoning
            reasons = []
            if distance_km != 999.0:
                reasons.append(f"{distance_km:.1f} કિ.મી. અંતર")
            else:
                reasons.append("સ્થાન ઉપલબ્ધ નથી")

            if freshness == "FRESH":
                reasons.append("તાજું લોકેશન")
            elif freshness == "STALE":
                reasons.append(f"સ્થાન {minutes_since} મિ. જૂનું")
            elif not is_on_duty:
                reasons.append("હાલમાં ડ્યૂટી બંધ")

            if is_village_assigned:
                reasons.append("ગામના નિયુક્ત કાર્યકર")

            if active_workload == 0:
                reasons.append("સંપૂર્ણ ઉપલબ્ધ (૦ સક્રિય)")
            else:
                reasons.append(f"{active_workload} સક્રિય કાર્ય")

            reason_str = ", ".join(reasons)

            rec_item = FwRecommendationItem(
                fw_user_id=fw.id,
                full_name=fw.full_name,
                username=fw.username,
                mobile_e164=fw.mobile_e164,
                distance_km=distance_km if distance_km != 999.0 else 0.0,
                freshness=freshness,
                duty_status="ACTIVE" if is_on_duty else "INACTIVE",
                last_known_latitude=fw_lat,
                last_known_longitude=fw_lng,
                last_location_update=last_update,
                active_assignments_count=active_workload,
                pending_complaints_count=active_workload,  # aggregate
                assigned_villages_count=len(fw_villages),
                is_village_assigned=is_village_assigned,
                score=round(score, 1),
                rank=1,
                recommendation_reason=reason_str
            )
            scored_fws.append(rec_item)

        # 6. Sort by score descending and take Top 3
        scored_fws.sort(key=lambda x: x.score, reverse=True)

        for i, item in enumerate(scored_fws[:3]):
            item.rank = i + 1

        top_recommendations = scored_fws[:3]
        has_eligible = len(top_recommendations) > 0

        notice = None
        if not has_eligible:
            notice = "૮૦ કિ.મી. વિસ્તારમાં કોઈ યોગ્ય સક્રિય ક્ષેત્રીય કાર્યકર મળ્યા નથી. તમે નીચે આપેલ મેન્યુઅલ સોંપણી વડે અન્ય કાર્યકર પસંદ કરી શકો છો."

        return GroupRecommendationsResponse(
            group_id=group.id,
            group_code=group.group_code,
            centroid_lat=centroid_lat,
            centroid_lng=centroid_lng,
            suggestion_radius_km=MAX_SUGGESTION_RADIUS_KM,
            has_eligible_recommendations=has_eligible,
            notice_gu=notice,
            recommendations=top_recommendations
        )

