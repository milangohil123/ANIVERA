"""Storage reconciliation CLI for safe orphan file detection and pruning.

Safety Invariants:
1. Never unlinks files modified within the grace window (default 24 hours).
2. Never unlinks files referenced by an existing row in disease_report_attachments.
3. Defaults strictly to dry-run mode unless --prune is explicitly provided.
"""
import argparse
import asyncio
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Set
from sqlalchemy import select
from app.core.config import settings
from app.db.session import async_session_factory
from app.modules.disease_surveillance.models import DiseaseReportAttachment


async def scan_and_reconcile(
    storage_dir: Path,
    grace_hours: float = 24.0,
    prune: bool = False
) -> None:
    """Scan storage directory, cross-reference against database, and report/prune verified orphans."""
    print(f"[{datetime.now(timezone.utc).isoformat()}] Starting storage reconciliation...")
    print(f"Target Directory: {storage_dir}")
    print(f"Grace Window:     {grace_hours} hours")
    print(f"Execution Mode:   {'PRUNE (destructive)' if prune else 'DRY RUN (read-only audit)'}")

    if not storage_dir.exists():
        print(f"Storage directory does not exist: {storage_dir}")
        return

    now_ts = time.time()
    grace_threshold_ts = now_ts - (grace_hours * 3600.0)

    # 1. Scan filesystem for candidates older than grace window
    candidate_files: List[Path] = []
    scanned_count = 0
    skipped_active_count = 0

    for root, _, files in os.walk(storage_dir):
        for f in files:
            scanned_count += 1
            f_path = Path(root) / f
            try:
                mtime = f_path.stat().st_mtime
                if mtime < grace_threshold_ts:
                    candidate_files.append(f_path)
                else:
                    skipped_active_count += 1
            except OSError:
                continue

    print(f"Scanned {scanned_count} files on disk. {skipped_active_count} files in active grace window (< {grace_hours}h old).")
    print(f"Evaluating {len(candidate_files)} older candidates against database...")

    if not candidate_files:
        print("No candidate orphan files found.")
        return

    # 2. Convert candidate files to relative paths as stored in database
    file_map = {}
    for p in candidate_files:
        try:
            rel = p.relative_to(storage_dir).as_posix()
            file_map[rel] = p
        except ValueError:
            continue

    all_rel_paths = list(file_map.keys())

    # 3. Query PostgreSQL in batches to identify referenced files
    referenced_paths: Set[str] = set()
    batch_size = 500

    async with async_session_factory() as session:
        for i in range(0, len(all_rel_paths), batch_size):
            batch = all_rel_paths[i : i + batch_size]
            stmt = select(DiseaseReportAttachment.file_path).where(
                DiseaseReportAttachment.file_path.in_(batch)
            )
            res = await session.execute(stmt)
            for row in res.scalars().all():
                # Normalize database path
                referenced_paths.add(row.replace("\\", "/").lstrip("/"))

    # 4. Filter verified orphans: on disk, older than grace period, NOT in DB
    orphan_rel_paths = [rel for rel in all_rel_paths if rel not in referenced_paths]

    total_orphan_bytes = 0
    for rel in orphan_rel_paths:
        try:
            total_orphan_bytes += file_map[rel].stat().st_size
        except OSError:
            pass

    print("\n--- RECONCILIATION SUMMARY ---")
    print(f"Total Disk Files Scanned:       {scanned_count}")
    print(f"Protected by Active Grace:      {skipped_active_count}")
    print(f"Referenced by Database:         {len(referenced_paths)}")
    print(f"Verified Orphan Files:          {len(orphan_rel_paths)}")
    print(f"Orphan Data Volume:             {total_orphan_bytes / (1024 * 1024):.2f} MB")

    if not orphan_rel_paths:
        print("Storage is 100% clean. Zero orphan files detected.")
        return

    # 5. Report or Prune
    if not prune:
        print("\n[DRY RUN] The following verified orphan files would be pruned with --prune:")
        for rel in orphan_rel_paths[:20]:
            print(f"  - {rel}")
        if len(orphan_rel_paths) > 20:
            print(f"  ... and {len(orphan_rel_paths) - 20} more.")
        print("\nNo files were deleted. Re-run with --prune to unlink orphan files.")
    else:
        print("\n[PRUNING] Unlinking verified orphan files from disk...")
        pruned_count = 0
        pruned_bytes = 0
        for rel in orphan_rel_paths:
            f_path = file_map[rel]
            try:
                sz = f_path.stat().st_size
                f_path.unlink()
                pruned_count += 1
                pruned_bytes += sz
            except Exception as exc:
                print(f"  Failed to delete {rel}: {exc}")

        print(f"Successfully pruned {pruned_count} orphan files ({pruned_bytes / (1024 * 1024):.2f} MB freed).")


def main() -> None:
    parser = argparse.ArgumentParser(description="PashuRakshak Safe Storage Reconciliation Tool")
    parser.add_argument(
        "--grace-hours",
        type=float,
        default=24.0,
        help="Ignore files modified within this many hours (default: 24.0)"
    )
    parser.add_argument(
        "--prune",
        action="store_true",
        default=False,
        help="Explicitly unlink verified orphan files. Defaults to dry-run if omitted."
    )
    args = parser.parse_args()

    storage_root = Path(settings.DISEASE_ATTACHMENTS_DIR).resolve()
    asyncio.run(scan_and_reconcile(storage_root, grace_hours=args.grace_hours, prune=args.prune))


if __name__ == "__main__":
    main()

