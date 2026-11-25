"""Master Data Service for PashuRakshak (Species, Disease, Vaccine Management)."""
import logging
import uuid
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.reference import Species
from app.modules.animals.models import Animal
from app.modules.campaigns.models import CampaignProgramme
from app.modules.disease_surveillance.models import DiseaseReport
from app.modules.master_data.models import DiseaseMaster, VaccineMaster
from app.modules.master_data.schemas import (
    DiseaseCreate,
    DiseaseResponse,
    DiseaseUpdate,
    DiseaseVaccineMappingItem,
    MasterOverviewResponse,
    SpeciesCreate,
    SpeciesResponse,
    SpeciesUpdate,
    VaccineCreate,
    VaccineResponse,
    VaccineUpdate,
)

logger = logging.getLogger("pashurakshak.master_data.service")


class MasterDataService:
    """Business logic for Animal, Disease and Vaccine Master Data."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # -----------------------------------------------------------------------
    # Species Management
    # -----------------------------------------------------------------------
    async def list_species(
        self,
        active_only: bool = False,
        include_archived: bool = False
    ) -> List[SpeciesResponse]:
        query = select(Species)
        if not include_archived:
            query = query.where(Species.archived == False)
        if active_only:
            query = query.where(Species.active == True)
        query = query.order_by(Species.code)

        result = await self.db.execute(query)
        rows = result.scalars().all()

        # Count animals per species for safe usage reporting
        counts_res = await self.db.execute(
            select(Animal.species_code, func.count(Animal.id))
            .group_by(Animal.species_code)
        )
        usage_map = {code: count for code, count in counts_res.all()}

        return [
            SpeciesResponse(
                code=s.code,
                name_gu=s.name_gu,
                name_en=s.name_en,
                name_hi=getattr(s, "name_hi", None),
                description=getattr(s, "description", None),
                active=getattr(s, "active", True),
                archived=getattr(s, "archived", False),
                usage_count=usage_map.get(s.code, 0)
            )
            for s in rows
        ]

    async def get_species(self, code: str) -> SpeciesResponse:
        code_upper = code.strip().upper()
        res = await self.db.execute(select(Species).where(Species.code == code_upper))
        species = res.scalar_one_or_none()
        if not species:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"પશુ પ્રજાતિ '{code_upper}' મળી નથી."
            )
        usage_res = await self.db.execute(
            select(func.count(Animal.id)).where(Animal.species_code == code_upper)
        )
        usage_count = usage_res.scalar() or 0

        return SpeciesResponse(
            code=species.code,
            name_gu=species.name_gu,
            name_en=species.name_en,
            name_hi=getattr(species, "name_hi", None),
            description=getattr(species, "description", None),
            active=getattr(species, "active", True),
            archived=getattr(species, "archived", False),
            usage_count=usage_count
        )

    async def create_species(self, data: SpeciesCreate, actor_id: uuid.UUID) -> SpeciesResponse:
        code_upper = data.code.strip().upper()
        existing = await self.db.execute(select(Species).where(Species.code == code_upper))
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"પ્રજાતિ કોડ '{code_upper}' પહેલેથી અસ્તિત્વમાં છે."
            )

        new_sp = Species(
            code=code_upper,
            name_gu=data.name_gu.strip(),
            name_en=data.name_en.strip(),
            name_hi=data.name_hi.strip() if data.name_hi else None,
            description=data.description.strip() if data.description else None,
            active=data.active,
            archived=False
        )
        self.db.add(new_sp)
        await self.db.commit()
        await self.db.refresh(new_sp)

        return SpeciesResponse(
            code=new_sp.code,
            name_gu=new_sp.name_gu,
            name_en=new_sp.name_en,
            name_hi=new_sp.name_hi,
            description=new_sp.description,
            active=new_sp.active,
            archived=new_sp.archived,
            usage_count=0
        )

    async def update_species(self, code: str, data: SpeciesUpdate, actor_id: uuid.UUID) -> SpeciesResponse:
        code_upper = code.strip().upper()
        res = await self.db.execute(select(Species).where(Species.code == code_upper))
        species = res.scalar_one_or_none()
        if not species:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"પ્રજાતિ '{code_upper}' મળી નથી.")

        if data.name_gu is not None:
            species.name_gu = data.name_gu.strip()
        if data.name_en is not None:
            species.name_en = data.name_en.strip()
        if data.name_hi is not None:
            species.name_hi = data.name_hi.strip() if data.name_hi else None
        if data.description is not None:
            species.description = data.description.strip() if data.description else None
        if data.active is not None:
            species.active = data.active

        await self.db.commit()
        await self.db.refresh(species)

        usage_res = await self.db.execute(
            select(func.count(Animal.id)).where(Animal.species_code == code_upper)
        )
        usage_count = usage_res.scalar() or 0

        return SpeciesResponse(
            code=species.code,
            name_gu=species.name_gu,
            name_en=species.name_en,
            name_hi=species.name_hi,
            description=species.description,
            active=species.active,
            archived=species.archived,
            usage_count=usage_count
        )

    async def toggle_species_active(self, code: str, actor_id: uuid.UUID) -> SpeciesResponse:
        code_upper = code.strip().upper()
        res = await self.db.execute(select(Species).where(Species.code == code_upper))
        species = res.scalar_one_or_none()
        if not species:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"પ્રજાતિ '{code_upper}' મળી નથી.")

        species.active = not species.active
        await self.db.commit()
        await self.db.refresh(species)

        usage_res = await self.db.execute(
            select(func.count(Animal.id)).where(Animal.species_code == code_upper)
        )
        usage_count = usage_res.scalar() or 0

        return SpeciesResponse(
            code=species.code,
            name_gu=species.name_gu,
            name_en=species.name_en,
            name_hi=species.name_hi,
            description=species.description,
            active=species.active,
            archived=species.archived,
            usage_count=usage_count
        )

    async def delete_species(self, code: str, actor_id: uuid.UUID) -> Dict[str, Any]:
        code_upper = code.strip().upper()
        res = await self.db.execute(select(Species).where(Species.code == code_upper))
        species = res.scalar_one_or_none()
        if not species:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"પ્રજાતિ '{code_upper}' મળી નથી.")

        # Check references in Animal
        anim_count = (await self.db.execute(
            select(func.count(Animal.id)).where(Animal.species_code == code_upper)
        )).scalar() or 0

        # Check references in CampaignProgramme
        camp_count = (await self.db.execute(
            select(func.count(CampaignProgramme.campaign_id)).where(CampaignProgramme.species_code == code_upper)
        )).scalar() or 0

        if anim_count > 0 or camp_count > 0:
            # Safe archive instead of breaking FK integrity
            species.active = False
            species.archived = True
            await self.db.commit()
            return {
                "action": "ARCHIVED",
                "message": f"પ્રજાતિ '{code_upper}' {anim_count} નોંધાયેલા પશુઓ/ઝુંબેશ સાથે જોડાયેલ હોવાથી તેને સંગ્રહિત (Archived / Deactivated) કરવામાં આવી છે.",
                "code": code_upper
            }

        # Safe to hard-delete
        await self.db.delete(species)
        await self.db.commit()
        return {
            "action": "DELETED",
            "message": f"પ્રજાતિ '{code_upper}' સફળતાપૂર્વક કાઢી નાખવામાં આવી.",
            "code": code_upper
        }

    # -----------------------------------------------------------------------
    # Disease Management
    # -----------------------------------------------------------------------
    async def list_diseases(
        self,
        active_only: bool = False,
        species_code: Optional[str] = None,
        include_archived: bool = False
    ) -> List[DiseaseResponse]:
        query = select(DiseaseMaster)
        if not include_archived:
            query = query.where(DiseaseMaster.archived == False)
        if active_only:
            query = query.where(DiseaseMaster.active == True)
        query = query.order_by(DiseaseMaster.code)

        result = await self.db.execute(query)
        diseases = result.scalars().all()

        # Vaccines count per disease
        v_res = await self.db.execute(
            select(VaccineMaster.disease_code, func.count(VaccineMaster.id))
            .where(VaccineMaster.archived == False)
            .group_by(VaccineMaster.disease_code)
        )
        vac_map = {code: count for code, count in v_res.all()}

        # Reports count per disease
        r_res = await self.db.execute(
            select(DiseaseReport.disease_code, func.count(DiseaseReport.report_id))
            .group_by(DiseaseReport.disease_code)
        )
        rep_map = {code: count for code, count in r_res.all()}

        out = []
        for d in diseases:
            species_list = d.applicable_species or []
            if species_code and species_code.upper() not in [s.upper() for s in species_list]:
                continue
            out.append(
                DiseaseResponse(
                    code=d.code,
                    name_en=d.name_en,
                    name_gu=d.name_gu,
                    name_hi=d.name_hi,
                    description=d.description,
                    applicable_species=species_list,
                    color=d.color or "#EF4444",
                    severity=d.severity or "HIGH",
                    active=d.active,
                    archived=d.archived,
                    created_at=d.created_at,
                    updated_at=d.updated_at,
                    vaccines_count=vac_map.get(d.code, 0),
                    reports_count=rep_map.get(d.code, 0)
                )
            )
        return out

    async def get_disease(self, code: str) -> DiseaseResponse:
        code_upper = code.strip().upper()
        res = await self.db.execute(select(DiseaseMaster).where(DiseaseMaster.code == code_upper))
        d = res.scalar_one_or_none()
        if not d:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"રોગ માસ્ટર '{code_upper}' મળ્યો નથી.")

        vac_count = (await self.db.execute(
            select(func.count(VaccineMaster.id)).where(VaccineMaster.disease_code == code_upper, VaccineMaster.archived == False)
        )).scalar() or 0

        rep_count = (await self.db.execute(
            select(func.count(DiseaseReport.report_id)).where(DiseaseReport.disease_code == code_upper)
        )).scalar() or 0

        return DiseaseResponse(
            code=d.code,
            name_en=d.name_en,
            name_gu=d.name_gu,
            name_hi=d.name_hi,
            description=d.description,
            applicable_species=d.applicable_species or [],
            color=d.color or "#EF4444",
            severity=d.severity or "HIGH",
            active=d.active,
            archived=d.archived,
            created_at=d.created_at,
            updated_at=d.updated_at,
            vaccines_count=vac_count,
            reports_count=rep_count
        )

    async def create_disease(self, data: DiseaseCreate, actor_id: uuid.UUID) -> DiseaseResponse:
        code_upper = data.code.strip().upper()
        existing = await self.db.execute(select(DiseaseMaster).where(DiseaseMaster.code == code_upper))
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"રોગ કોડ '{code_upper}' પહેલેથી અસ્તિત્વમાં છે."
            )

        new_d = DiseaseMaster(
            code=code_upper,
            name_en=data.name_en.strip(),
            name_gu=data.name_gu.strip(),
            name_hi=data.name_hi.strip() if data.name_hi else None,
            description=data.description.strip() if data.description else None,
            applicable_species=[s.strip().upper() for s in data.applicable_species if s.strip()],
            color=data.color or "#EF4444",
            severity=data.severity or "HIGH",
            active=data.active,
            archived=False
        )
        self.db.add(new_d)
        await self.db.commit()
        await self.db.refresh(new_d)

        return DiseaseResponse(
            code=new_d.code,
            name_en=new_d.name_en,
            name_gu=new_d.name_gu,
            name_hi=new_d.name_hi,
            description=new_d.description,
            applicable_species=new_d.applicable_species,
            color=new_d.color,
            severity=new_d.severity,
            active=new_d.active,
            archived=new_d.archived,
            created_at=new_d.created_at,
            updated_at=new_d.updated_at,
            vaccines_count=0,
            reports_count=0
        )

    async def update_disease(self, code: str, data: DiseaseUpdate, actor_id: uuid.UUID) -> DiseaseResponse:
        code_upper = code.strip().upper()
        res = await self.db.execute(select(DiseaseMaster).where(DiseaseMaster.code == code_upper))
        d = res.scalar_one_or_none()
        if not d:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"રોગ '{code_upper}' મળ્યો નથી.")

        if data.name_en is not None:
            d.name_en = data.name_en.strip()
        if data.name_gu is not None:
            d.name_gu = data.name_gu.strip()
        if data.name_hi is not None:
            d.name_hi = data.name_hi.strip() if data.name_hi else None
        if data.description is not None:
            d.description = data.description.strip() if data.description else None
        if data.applicable_species is not None:
            d.applicable_species = [s.strip().upper() for s in data.applicable_species if s.strip()]
        if data.color is not None:
            d.color = data.color
        if data.severity is not None:
            d.severity = data.severity
        if data.active is not None:
            d.active = data.active

        await self.db.commit()
        await self.db.refresh(d)

        return await self.get_disease(code_upper)

    async def toggle_disease_active(self, code: str, actor_id: uuid.UUID) -> DiseaseResponse:
        code_upper = code.strip().upper()
        res = await self.db.execute(select(DiseaseMaster).where(DiseaseMaster.code == code_upper))
        d = res.scalar_one_or_none()
        if not d:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"રોગ '{code_upper}' મળ્યો નથી.")

        d.active = not d.active
        await self.db.commit()
        await self.db.refresh(d)

        return await self.get_disease(code_upper)

    async def delete_disease(self, code: str, actor_id: uuid.UUID) -> Dict[str, Any]:
        code_upper = code.strip().upper()
        res = await self.db.execute(select(DiseaseMaster).where(DiseaseMaster.code == code_upper))
        d = res.scalar_one_or_none()
        if not d:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"રોગ '{code_upper}' મળ્યો નથી.")

        # Check references in DiseaseReport or VaccineMaster
        rep_count = (await self.db.execute(
            select(func.count(DiseaseReport.report_id)).where(DiseaseReport.disease_code == code_upper)
        )).scalar() or 0

        vac_count = (await self.db.execute(
            select(func.count(VaccineMaster.id)).where(VaccineMaster.disease_code == code_upper)
        )).scalar() or 0

        if rep_count > 0 or vac_count > 0:
            d.active = False
            d.archived = True
            await self.db.commit()
            return {
                "action": "ARCHIVED",
                "message": f"રોગ '{code_upper}' {rep_count} અહેવાલો / {vac_count} રસીઓ સાથે જોડાયેલ હોવાથી તેને સંગ્રહિત (Archived) કરવામાં આવ્યો છે.",
                "code": code_upper
            }

        await self.db.delete(d)
        await self.db.commit()
        return {
            "action": "DELETED",
            "message": f"રોગ '{code_upper}' સફળતાપૂર્વક કાઢી નાખવામાં આવ્યો.",
            "code": code_upper
        }

    # -----------------------------------------------------------------------
    # Vaccine Management
    # -----------------------------------------------------------------------
    async def list_vaccines(
        self,
        active_only: bool = False,
        disease_code: Optional[str] = None,
        species_code: Optional[str] = None,
        verification_status: Optional[str] = None,
        include_archived: bool = False
    ) -> List[VaccineResponse]:
        query = select(VaccineMaster)
        if not include_archived:
            query = query.where(VaccineMaster.archived == False)
        if active_only:
            query = query.where(VaccineMaster.active == True)
        if disease_code:
            query = query.where(VaccineMaster.disease_code == disease_code.strip().upper())
        if verification_status:
            query = query.where(VaccineMaster.verification_status == verification_status.strip().upper())
        query = query.order_by(VaccineMaster.code)

        result = await self.db.execute(query)
        vaccines = result.scalars().all()

        # Map disease names
        d_res = await self.db.execute(select(DiseaseMaster.code, DiseaseMaster.name_gu, DiseaseMaster.name_en))
        d_map = {row[0]: (row[1], row[2]) for row in d_res.all()}

        out = []
        for v in vaccines:
            sp_list = v.applicable_species or []
            if species_code and species_code.upper() not in [s.upper() for s in sp_list]:
                continue
            d_gu, d_en = d_map.get(v.disease_code, (v.disease_code, v.disease_code))
            out.append(
                VaccineResponse(
                    id=v.id,
                    code=v.code,
                    name_en=v.name_en,
                    name_gu=v.name_gu,
                    disease_code=v.disease_code,
                    disease_name_gu=d_gu,
                    disease_name_en=d_en,
                    applicable_species=sp_list,
                    administration_route=v.administration_route,
                    standard_dosage=v.standard_dosage,
                    schedule_interval=v.schedule_interval,
                    verification_status=v.verification_status,
                    verified_source=v.verified_source,
                    is_custom_manual=v.is_custom_manual,
                    description=v.description,
                    active=v.active,
                    archived=v.archived,
                    created_at=v.created_at,
                    updated_at=v.updated_at
                )
            )
        return out

    async def get_vaccine(self, vaccine_id: uuid.UUID) -> VaccineResponse:
        res = await self.db.execute(select(VaccineMaster).where(VaccineMaster.id == vaccine_id))
        v = res.scalar_one_or_none()
        if not v:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="રસી માસ્ટર મળી નથી.")

        d_res = await self.db.execute(select(DiseaseMaster).where(DiseaseMaster.code == v.disease_code))
        d = d_res.scalar_one_or_none()

        return VaccineResponse(
            id=v.id,
            code=v.code,
            name_en=v.name_en,
            name_gu=v.name_gu,
            disease_code=v.disease_code,
            disease_name_gu=d.name_gu if d else v.disease_code,
            disease_name_en=d.name_en if d else v.disease_code,
            applicable_species=v.applicable_species or [],
            administration_route=v.administration_route,
            standard_dosage=v.standard_dosage,
            schedule_interval=v.schedule_interval,
            verification_status=v.verification_status,
            verified_source=v.verified_source,
            is_custom_manual=v.is_custom_manual,
            description=v.description,
            active=v.active,
            archived=v.archived,
            created_at=v.created_at,
            updated_at=v.updated_at
        )

    async def create_vaccine(self, data: VaccineCreate, actor_id: uuid.UUID) -> VaccineResponse:
        code_clean = data.code.strip()
        existing = await self.db.execute(select(VaccineMaster).where(VaccineMaster.code == code_clean))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"રસી કોડ '{code_clean}' પહેલેથી અસ્તિત્વમાં છે.")

        new_v = VaccineMaster(
            code=code_clean,
            name_en=data.name_en.strip(),
            name_gu=data.name_gu.strip(),
            disease_code=data.disease_code.strip().upper(),
            applicable_species=[s.strip().upper() for s in data.applicable_species if s.strip()],
            administration_route=data.administration_route.strip() if data.administration_route else None,
            standard_dosage=data.standard_dosage.strip() if data.standard_dosage else None,
            schedule_interval=data.schedule_interval.strip() if data.schedule_interval else None,
            verification_status=data.verification_status.strip().upper() if data.verification_status else "VERIFIED",
            verified_source=data.verified_source.strip() if data.verified_source else None,
            is_custom_manual=data.is_custom_manual,
            description=data.description.strip() if data.description else None,
            active=data.active,
            archived=False
        )
        self.db.add(new_v)
        await self.db.commit()
        await self.db.refresh(new_v)

        return await self.get_vaccine(new_v.id)

    async def update_vaccine(self, vaccine_id: uuid.UUID, data: VaccineUpdate, actor_id: uuid.UUID) -> VaccineResponse:
        res = await self.db.execute(select(VaccineMaster).where(VaccineMaster.id == vaccine_id))
        v = res.scalar_one_or_none()
        if not v:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="રસી માસ્ટર મળી નથી.")

        if data.name_en is not None:
            v.name_en = data.name_en.strip()
        if data.name_gu is not None:
            v.name_gu = data.name_gu.strip()
        if data.disease_code is not None:
            v.disease_code = data.disease_code.strip().upper()
        if data.applicable_species is not None:
            v.applicable_species = [s.strip().upper() for s in data.applicable_species if s.strip()]
        if data.administration_route is not None:
            v.administration_route = data.administration_route.strip() if data.administration_route else None
        if data.standard_dosage is not None:
            v.standard_dosage = data.standard_dosage.strip() if data.standard_dosage else None
        if data.schedule_interval is not None:
            v.schedule_interval = data.schedule_interval.strip() if data.schedule_interval else None
        if data.verification_status is not None:
            v.verification_status = data.verification_status.strip().upper()
        if data.verified_source is not None:
            v.verified_source = data.verified_source.strip() if data.verified_source else None
        if data.description is not None:
            v.description = data.description.strip() if data.description else None
        if data.active is not None:
            v.active = data.active

        await self.db.commit()
        await self.db.refresh(v)

        return await self.get_vaccine(v.id)

    async def toggle_vaccine_active(self, vaccine_id: uuid.UUID, actor_id: uuid.UUID) -> VaccineResponse:
        res = await self.db.execute(select(VaccineMaster).where(VaccineMaster.id == vaccine_id))
        v = res.scalar_one_or_none()
        if not v:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="રસી માસ્ટર મળી નથી.")

        v.active = not v.active
        await self.db.commit()
        await self.db.refresh(v)

        return await self.get_vaccine(v.id)

    async def set_vaccine_verification(
        self,
        vaccine_id: uuid.UUID,
        verification_status: str,
        verified_source: Optional[str],
        actor_id: uuid.UUID
    ) -> VaccineResponse:
        res = await self.db.execute(select(VaccineMaster).where(VaccineMaster.id == vaccine_id))
        v = res.scalar_one_or_none()
        if not v:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="રસી માસ્ટર મળી નથી.")

        v.verification_status = verification_status.strip().upper()
        if verified_source is not None:
            v.verified_source = verified_source.strip()
        await self.db.commit()
        await self.db.refresh(v)

        return await self.get_vaccine(v.id)

    async def delete_vaccine(self, vaccine_id: uuid.UUID, actor_id: uuid.UUID) -> Dict[str, Any]:
        res = await self.db.execute(select(VaccineMaster).where(VaccineMaster.id == vaccine_id))
        v = res.scalar_one_or_none()
        if not v:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="રસી માસ્ટર મળી નથી.")

        # Archive safely to keep operational history intact
        v.active = False
        v.archived = True
        await self.db.commit()

        return {
            "action": "ARCHIVED",
            "message": f"રસી '{v.name_gu}' સફળતાપૂર્વક સંગ્રહિત/નિષ્ક્રિય કરવામાં આવી.",
            "id": str(v.id)
        }

    # -----------------------------------------------------------------------
    # Mapping and Overview
    # -----------------------------------------------------------------------
    async def get_disease_vaccine_mapping(self, active_only: bool = False) -> List[DiseaseVaccineMappingItem]:
        diseases = await self.list_diseases(active_only=active_only)
        vaccines = await self.list_vaccines(active_only=active_only)

        vac_by_disease: Dict[str, List[VaccineResponse]] = {}
        for vac in vaccines:
            vac_by_disease.setdefault(vac.disease_code, []).append(vac)

        out = []
        for d in diseases:
            out.append(
                DiseaseVaccineMappingItem(
                    disease_code=d.code,
                    disease_name_gu=d.name_gu,
                    disease_name_en=d.name_en,
                    color=d.color,
                    severity=d.severity,
                    applicable_species=d.applicable_species,
                    active=d.active,
                    vaccines=vac_by_disease.get(d.code, [])
                )
            )
        return out

    async def get_master_overview(self) -> MasterOverviewResponse:
        species_list = await self.list_species(include_archived=False)
        diseases_list = await self.list_diseases(include_archived=False)
        vaccines_list = await self.list_vaccines(include_archived=False)

        return MasterOverviewResponse(
            total_species=len(species_list),
            active_species=sum(1 for s in species_list if s.active),
            total_diseases=len(diseases_list),
            active_diseases=sum(1 for d in diseases_list if d.active),
            total_vaccines=len(vaccines_list),
            verified_vaccines=sum(1 for v in vaccines_list if v.verification_status == "VERIFIED"),
            pending_vaccines=sum(1 for v in vaccines_list if v.verification_status != "VERIFIED")
        )
