
import asyncio, uuid
from app.db.session import async_session_factory
from app.modules.health_cases.service import HealthWorkflowService
from app.modules.health_cases.schemas import CaseTreatmentVerificationRequest
from app.modules.authentication.models import User
from sqlalchemy import select

async def run():
    async with async_session_factory() as session:
        report_id = uuid.UUID("e0bc2a73-21f6-48a1-bdfe-8433ba1966bc")
        taho_res = await session.execute(select(User).where(User.username == "taho_palak").limit(1))
        taho_user = taho_res.scalar_one_or_none()
        if not taho_user:
            taho_user = (await session.execute(select(User).where(User.role == "TAHO").limit(1))).scalar_one()

        service = HealthWorkflowService(session)
        payload = CaseTreatmentVerificationRequest(
            action="APPROVED",
            decision="APPROVED",
            verification_notes="Approved"
        )
        try:
            res = await service.verify_taho_treatment(report_id, payload, taho_user)
            print("SUCCESS VERIFYING:", res["status"], res["action"])
        except Exception as e:
            print("ERROR IN VERIFY:", type(e), e)

asyncio.run(run())
