"""Automatic Complaint Grouping Engine.

Clusters eligible pending farmer complaints / emergency animal cases by geographic proximity.
Zero paid APIs. Employs pure Haversine distance matrix clustering.
"""
import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, List, Optional, Set, Tuple
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.geography import Village, Taluka, District
from app.modules.duty.haversine import haversine_distance_km, calculate_cluster_centroid
from app.modules.duty.models import (
    ComplaintAssignmentGroup,
    ComplaintGroupItem,
    HelpRequest,
)

logger = logging.getLogger("pashurakshak.duty.grouping")

# Clustering proximity threshold: Villages within 20 km of each other are clustered into the same assignment group
MAX_INTER_VILLAGE_CLUSTER_DISTANCE_KM = 20.0
MAX_GROUP_RADIUS_KM = 80.0


class ComplaintGroupingService:
    """Service to automatically identify nearby pending complaints and organize them into assignment groups."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def generate_groups_for_district(
        self,
        district_id: uuid.UUID,
        taluka_id: Optional[uuid.UUID] = None,
        assigned_village_ids: Optional[Set[uuid.UUID]] = None
    ) -> List[ComplaintAssignmentGroup]:
        """Group eligible unassigned complaints within the given district/jurisdiction."""
        # 1. Fetch all pending unassigned complaints
        stmt = (
            select(HelpRequest, Village)
            .join(Village, Village.id == HelpRequest.village_id)
            .where(
                HelpRequest.status.in_(["SUBMITTED", "PENDING"]),
                HelpRequest.assigned_to.is_(None),
                Village.district_id == district_id
            )
        )

        if taluka_id:
            stmt = stmt.where(Village.taluka_id == taluka_id)
        if assigned_village_ids:
            stmt = stmt.where(HelpRequest.village_id.in_(assigned_village_ids))

        rows = (await self.db.execute(stmt)).all()
        if not rows:
            logger.info("No unassigned pending complaints found for grouping in district %s", district_id)
            return []

        # 2. Filter out complaints that are already part of an active assignment group
        existing_group_item_stmt = (
            select(ComplaintGroupItem.complaint_id)
            .join(ComplaintAssignmentGroup, ComplaintAssignmentGroup.id == ComplaintGroupItem.group_id)
            .where(
                ComplaintAssignmentGroup.status.in_(["PENDING", "RECOMMENDATION_READY", "ASSIGNED", "IN_PROGRESS"]),
                ComplaintGroupItem.status.in_(["PENDING", "VISITING"])
            )
        )
        already_grouped_ids = set((await self.db.execute(existing_group_item_stmt)).scalars().all())

        eligible_complaints: List[Tuple[HelpRequest, Village]] = [
            (req, vil) for req, vil in rows if req.id not in already_grouped_ids
        ]

        if not eligible_complaints:
            logger.info("All pending complaints are already included in active assignment groups.")
            return []

        # 3. Organize complaints by village
        village_complaints_map: Dict[uuid.UUID, List[HelpRequest]] = {}
        village_info_map: Dict[uuid.UUID, Village] = {}

        for req, vil in eligible_complaints:
            if vil.id not in village_complaints_map:
                village_complaints_map[vil.id] = []
                village_info_map[vil.id] = vil
            village_complaints_map[vil.id].append(req)

        # 4. Proximity-based greedy clustering of villages
        # Separate villages with valid coordinates vs without
        villages_with_coords: List[uuid.UUID] = []
        villages_without_coords: List[uuid.UUID] = []

        for v_id, vil in village_info_map.items():
            if vil.latitude is not None and vil.longitude is not None:
                villages_with_coords.append(v_id)
            else:
                villages_without_coords.append(v_id)

        clusters: List[List[uuid.UUID]] = []
        visited_villages: Set[uuid.UUID] = set()

        for v_id in villages_with_coords:
            if v_id in visited_villages:
                continue

            current_cluster = [v_id]
            visited_villages.add(v_id)
            v_vil = village_info_map[v_id]

            # Find nearby unvisited villages within clustering threshold
            for other_id in villages_with_coords:
                if other_id in visited_villages:
                    continue
                o_vil = village_info_map[other_id]

                dist = haversine_distance_km(
                    float(v_vil.latitude), float(v_vil.longitude),
                    float(o_vil.latitude), float(o_vil.longitude)
                )

                if dist is not None and dist <= MAX_INTER_VILLAGE_CLUSTER_DISTANCE_KM:
                    current_cluster.append(other_id)
                    visited_villages.add(other_id)

            clusters.append(current_cluster)

        # Villages without coordinates get individual single-village groups
        for v_id in villages_without_coords:
            clusters.append([v_id])

        # 5. Persist each cluster as a ComplaintAssignmentGroup with items
        created_groups: List[ComplaintAssignmentGroup] = []

        for cluster in clusters:
            # Collect all complaints in this cluster
            cluster_complaints: List[HelpRequest] = []
            for v_id in cluster:
                cluster_complaints.extend(village_complaints_map.get(v_id, []))

            if not cluster_complaints:
                continue

            # Determine priority
            is_urgent = False
            for c in cluster_complaints:
                text_lower = (c.problem_text or "").lower()
                if any(w in text_lower for w in ["તાવ", "ખરવા", "લમ્પી", "ગળસૂંઠો", "emergency", "urgent", "તાત્કાલિક"]):
                    is_urgent = True
                    break

            priority = "URGENT" if is_urgent else ("HIGH" if len(cluster_complaints) >= 4 else "NORMAL")

            # Representative taluka
            cluster_taluka_id = village_info_map[cluster[0]].taluka_id if cluster else None

            # Generate unique group code: GRP-YYYY-XXXX
            year_str = datetime.now(timezone.utc).strftime("%Y")
            rand_suffix = uuid.uuid4().hex[:5].upper()
            group_code = f"GRP-{year_str}-{rand_suffix}"

            group = ComplaintAssignmentGroup(
                group_code=group_code,
                district_id=district_id,
                taluka_id=cluster_taluka_id,
                status="RECOMMENDATION_READY",
                priority=priority,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            self.db.add(group)
            await self.db.flush()

            # Add group items
            for c in cluster_complaints:
                item = ComplaintGroupItem(
                    group_id=group.id,
                    complaint_id=c.id,
                    complaint_type="HELP_REQUEST",
                    village_id=c.village_id,
                    status="PENDING",
                )
                self.db.add(item)

            created_groups.append(group)

        await self.db.commit()
        logger.info("Successfully generated %d complaint assignment groups.", len(created_groups))
        return created_groups

