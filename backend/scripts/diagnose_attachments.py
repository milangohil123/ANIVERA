"""Diagnostic script to inspect disease_reports and attachments in pashurakshak_db.

Usage:
    python scripts/diagnose_attachments.py
    python scripts/diagnose_attachments.py --report-id <uuid>
"""
import argparse
import asyncio
import sys
import uuid
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy import select, func
from app.db.session import async_session_factory
from app.modules.disease_surveillance.models import DiseaseReport, DiseaseReportAttachment
from app.modules.sync.models import SyncBatch, SyncReceipt, SyncConflict
from app.core.storage import get_disease_attachment_storage


async def diagnose(target_report_id: str = None):
    print("=" * 65)
    print("  PASHURAKSHAK STEP 8.2 ATTACHMENT AUDIT & DIAGNOSTIC TOOL")
    print("=" * 65)

    storage = get_disease_attachment_storage()

    async with async_session_factory() as session:
        # Check target UUID if supplied
        if target_report_id:
            try:
                target_uuid = uuid.UUID(target_report_id.strip())
            except ValueError:
                print(f"\n[ERROR] Provided report ID '{target_report_id}' is NOT a valid UUID.\n")
                return

            print(f"\nTarget UUID: {target_uuid}")
            report = await session.get(DiseaseReport, target_uuid)
            if not report:
                print(f"  [RESULT 1: Report Status]: NOT FOUND in 'disease_reports' table (HTTP 404 root cause).")
                print("  -> The report ID does not exist on the server. If submitted offline, ensure sync completed.")
            else:
                print(f"  [RESULT 1: Report Status]: FOUND in 'disease_reports' table.")
                print(f"      - Disease Code : {report.disease_code}")
                print(f"      - Village ID   : {report.village_id}")
                print(f"      - Status       : {report.status}")
                print(f"      - Reported At  : {report.received_at}")

                # Check attachments for this report
                stmt_att = select(DiseaseReportAttachment).where(DiseaseReportAttachment.report_id == target_uuid)
                atts = (await session.execute(stmt_att)).scalars().all()
                print(f"\n  [RESULT 2: Attachments]: Found {len(atts)} attachment records linked to this report.")
                for idx, a in enumerate(atts, 1):
                    file_exists = await storage.exists(a.file_path)
                    print(f"      [{idx}] Attachment ID: {a.id}")
                    print(f"          - File Path  : {a.file_path}")
                    print(f"          - MIME Type  : {a.mime_type}")
                    print(f"          - Size Bytes : {a.size_bytes}")
                    print(f"          - On Disk    : {'EXISTS (Valid)' if file_exists else 'MISSING (Storage 404)'}")

        # Summary of latest database activity
        print("\n" + "-" * 65)
        print("  LATEST SYSTEM REPORTS & SYNC STATE IN DATABASE")
        print("-" * 65)

        reports_count = (await session.execute(select(func.count()).select_from(DiseaseReport))).scalar()
        print(f"Total disease_reports in DB: {reports_count}")
        stmt_rep = select(DiseaseReport).order_by(DiseaseReport.received_at.desc()).limit(5)
        latest_reports = (await session.execute(stmt_rep)).scalars().all()
        for r in latest_reports:
            print(f"  - Report ID: {r.report_id} | Disease: {r.disease_code} | Village: {r.village_id} | Status: {r.status}")

        att_count = (await session.execute(select(func.count()).select_from(DiseaseReportAttachment))).scalar()
        print(f"\nTotal attachments in DB: {att_count}")
        stmt_atts = select(DiseaseReportAttachment).order_by(DiseaseReportAttachment.uploaded_at.desc()).limit(5)
        latest_atts = (await session.execute(stmt_atts)).scalars().all()
        for a in latest_atts:
            file_exists = await storage.exists(a.file_path)
            print(f"  - Att ID: {a.id} | Report ID: {a.report_id} | File On Disk: {file_exists}")

        receipt_count = (await session.execute(select(func.count()).select_from(SyncReceipt))).scalar()
        print(f"\nTotal sync receipts in DB: {receipt_count}")
        stmt_rcpt = select(SyncReceipt).order_by(SyncReceipt.processed_at.desc()).limit(5)
        latest_rcpts = (await session.execute(stmt_rcpt)).scalars().all()
        for rc in latest_rcpts:
            print(f"  - Event: {rc.event_id} | Type: {rc.event_type} | Status: {rc.status} | Code: {rc.code}")
            print(f"    Errors : {rc.errors}")
            print(f"    Payload: {rc.payload}")

    print("=" * 65 + "\n")


def main():
    parser = argparse.ArgumentParser(description="PashuRakshak Attachment Diagnostic Tool")
    parser.add_argument("--report-id", default=None, help="Specific disease report UUID to inspect")
    args = parser.parse_args()
    asyncio.run(diagnose(args.report_id))


if __name__ == "__main__":
    main()
