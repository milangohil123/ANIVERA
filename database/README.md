# PashuRakshak Botad — Database Architecture & Migrations

This directory contains the database schema specifications, SQL migrations, patches, and verification scripts for the PashuRakshak Botad platform.

## Directory Structure

```text
database/
├── base/
│   └── pashurakshak_schema_v0.2.sql          # Primary baseline SQL schema (PostgreSQL 16)
├── patches/
│   └── pashurakshak_schema_v0.3.1_patch.sql  # Certified additive alignment patch
├── verification/
│   └── verify_schema_v0.3.1.sql              # Post-migration verification queries
└── README.md
```

## Target Database Environment

- **Engine:** PostgreSQL 16.x (e.g. 16.15)
- **Database Name:** `pashurakshak_db`
- **Extensions:** `citext`, `btree_gist`
- **Connection Driver:** `asyncpg` via SQLAlchemy 2.0 (`postgresql+asyncpg://...`)

## Execution Sequence

In pgAdmin 4 or `psql` connected to `pashurakshak_db`:

1. **Base Schema:** Execute `base/pashurakshak_schema_v0.2.sql` (wrapped in `BEGIN; ... COMMIT;`).
2. **Additive Patch:** Execute `patches/pashurakshak_schema_v0.3.1_patch.sql`.
3. **Verification:** Run `verification/verify_schema_v0.3.1.sql` to confirm all 55 base tables, 6 views, triggers, and permissions are correctly in place.

## Step 2: FastAPI Backend Integration

The backend is connected to `pashurakshak_db` without modifying, dropping, or re-creating tables:
- **Async Connection Engine:** Managed via SQLAlchemy 2.0 `create_async_engine` using `DATABASE_URL`.
- **Connection Pool:** Configured with `pool_size=10`, `max_overflow=20`, `pool_timeout=30`, `pool_recycle=1800`, `pool_pre_ping=True`.
- **Lifespan Pool Management:** Connection pool is cleanly disposed on application shutdown via `close_db_connection()`.
- **Mapped Foundational Models:**
  - `District` (`districts`)
  - `Taluka` (`talukas`)
  - `Village` (`villages`)
  - `Species` (`species`)
  - `Breed` (`breeds`)
  - `Programme` (`programmes`)
  - `SystemSetting` (`system_settings`)
- **Health Endpoint:** `GET /api/v1/health` executes a ping query (`SELECT 1`) to independently verify application and database readiness.
