# PashuRakshak Backend Service

**Project:** PS000195 — Digital Livestock Vaccination Tracking and Disease Early-Warning Platform (Botad)  
**Framework:** FastAPI + SQLAlchemy 2.0 + PostgreSQL 16 (asyncpg driver)  
**Validation:** Pydantic v2

---

## Directory Architecture

```text
backend/
├── app/
│   ├── main.py                  # Application entry point, CORS, lifespan & router
│   ├── core/
│   │   ├── config.py            # Pydantic v2 application settings & environment
│   │   ├── security.py          # Argon2id hashing, JWT creation & decoding
│   │   ├── logging.py           # Structured JSON logger configuration
│   │   └── exceptions.py        # Domain & HTTP exception definitions
│   ├── api/
│   │   └── v1/
│   │       ├── router.py        # Central API v1 routing registry
│   │       └── endpoints/
│   │           └── health.py    # GET /api/v1/health endpoint
│   ├── db/
│   │   ├── session.py           # SQLAlchemy async engine, session factory & cleanup
│   │   ├── base.py              # DeclarativeBase model registry
│   │   └── migrations/          # Alembic migrations directory
│   ├── models/                  # SQLAlchemy ORM models matching PostgreSQL tables
│   │   ├── geography.py         # District, Taluka, Village models
│   │   └── reference.py         # Species, Breed, Programme, SystemSetting models
│   ├── schemas/                 # Pydantic validation & transfer schemas
│   │   ├── health.py            # HealthResponse schema
│   │   ├── geography.py         # DistrictRead, TalukaRead, VillageRead
│   │   └── reference.py         # SpeciesRead, BreedRead, ProgrammeRead, SystemSettingRead
│   ├── repositories/            # Database access layer
│   │   ├── base.py              # Generic BaseRepository
│   │   ├── health.py            # HealthRepository (ping check)
│   │   └── geography.py         # GeographyRepository (districts & villages)
│   ├── services/                # Business logic & transaction orchestration
│   │   └── health_service.py    # HealthService
│   ├── dependencies/            # FastAPI dependency injections
│   │   └── db.py                # get_db_session dependency
│   └── modules/                 # Modular domain features (scaffolded)
│       ├── authentication/
│       ├── users/
│       ├── administration/
│       ├── farmers/
│       ├── animals/
│       ├── campaigns/
│       ├── vaccinations/
│       ├── inventory/
│       ├── disease_surveillance/
│       ├── camps/
│       ├── attachments/
│       ├── notifications/
│       ├── synchronization/
│       └── reports/
├── tests/
│   ├── conftest.py              # Pytest async fixtures & client setup
│   ├── unit/                    # Unit tests
│   ├── integration/
│   │   └── test_database.py     # Database connectivity & health integration tests
│   └── security/                # Permission matrix & RBAC tests
├── requirements.txt
├── .env.example
└── README.md
```

---

## Step 2: PostgreSQL Database Integration

### 1. Connection Architecture
- **Driver:** `asyncpg` via SQLAlchemy 2.0 asynchronous engine (`create_async_engine`).
- **Connection URL:** `DATABASE_URL="postgresql+asyncpg://<username>:<password>@<host>:<port>/<dbname>"`.
- **Connection Pooling:**
  - `DB_POOL_SIZE = 10`
  - `DB_MAX_OVERFLOW = 20`
  - `DB_POOL_TIMEOUT = 30`
  - `DB_POOL_RECYCLE = 1800`
  - `DB_POOL_PRE_PING = True`
- **Session Lifecycle:** Managed through `async_session_factory` and FastAPI's `get_db_session` dependency. Every request receives a dedicated session with automatic transaction rollback on unhandled error and guaranteed closure in the `finally` block.
- **Engine Shutdown:** Registered in FastAPI lifespan context; executes `await async_engine.dispose()` on server shutdown.

### 2. Implemented Foundational Models
The ORM models accurately map existing PostgreSQL 16 tables without schema generation (`create_all()` is strictly forbidden):
- `District` (`districts`)
- `Taluka` (`talukas`)
- `Village` (`villages`)
- `Species` (`species`)
- `Breed` (`breeds`)
- `Programme` (`programmes`)
- `SystemSetting` (`system_settings`)

### 3. Health & Readiness Endpoint
**Endpoint:** `GET /api/v1/health`

**Successful Response (HTTP 200):**
```json
{
  "status": "healthy",
  "database": "connected"
}
```

**Degraded / Outage Response (HTTP 503):**
```json
{
  "status": "unhealthy",
  "database": "disconnected"
}
```
*Security Note:* Connection errors are safely caught and logged. Under no circumstances are database credentials, internal hostnames, or raw exception traces returned to the client.

---

## Setup & Running Locally

1. Create a virtual environment:
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Copy `.env.example` to `.env` and fill in local database credentials:
   ```bash
   cp .env.example .env
   ```
4. Start the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
5. Interactive OpenAPI docs: `http://localhost:8000/docs`
6. Health Check: `http://localhost:8000/api/v1/health`

---

## Running Database Integration Tests

Execute the integration test suite:
```bash
pytest tests/integration/test_database.py -v
```

Tests cover:
- Direct database query execution (`SELECT 1`).
- Read-only queries against existing reference tables (`species`, `districts`).
- Session lifecycle and context cleanup.
- Error handling on failed database connection without leaking secrets.
- Health endpoint response when connected (HTTP 200) vs disconnected (HTTP 503).

---

## Step 3: Authentication & Login Architecture

### 1. Authentication Workflows
- **Staff Authentication (`POST /api/v1/auth/staff/login`):**
  - Username + Argon2id password verification.
  - Case-insensitive username lookup (backed by PostgreSQL `citext`).
  - Active status verification (`status == 'ACTIVE'`).
  - Account lockout protection: 5 failed attempts locks account for 15 minutes (`locked_until`).
  - Issues signed short-lived JWT access token (15 mins) and opaque rotating refresh token (7 days).
- **Farmer Authentication (`POST /api/v1/auth/farmer/request-otp` & `POST /api/v1/auth/farmer/verify-otp`):**
  - Self-registration is strictly disabled per Decision Register & APPFLOW Workflow B.
  - Request OTP returns neutral response regardless of whether number exists to prevent phone enumeration.
  - OTP dispatch is only triggered for provisioned farmers (`users.role = 'FARMER'` and `farmer_account_provisioning.activation_status = 'ACTIVE'`).
  - 6-digit numeric OTP generated, hashed via SHA-256 into `otp_challenges` (valid for 5 minutes, max 3 attempts).
  - Pluggable OTP provider (`SimulatedOTPProvider` avoids fake external SMS services during local dev & testing).
  - Verification prevents replay attacks by marking `consumed_at = now()` immediately upon success.
- **Session & Token Management (`POST /api/v1/auth/refresh` & `POST /api/v1/auth/logout`):**
  - Rotating refresh tokens: SHA-256 hash stored in `refresh_tokens` table.
  - Using a refresh token revokes it and creates a linked new one (`rotated_from`).
  - Logout explicitly revokes the active refresh token.
- **Profile & Permissions (`GET /api/v1/auth/me`):**
  - Protected by `get_current_user` JWT bearer dependency.
  - Loads user identity, active village assignments (`user_village_assignments`), DAHO district assignments (`daho_district_assignments`), and aggregated permissions (`role_permissions` + `user_permission_grants`).
  - Includes `offline_valid_until` timestamp (7-day offline validity period).
- **Immutable Auditing:**
  - Every login attempt (success, password mismatch, lockout, suppressed OTP, token refresh, logout) writes an immutable record to `audit_events`.

### 2. Running Authentication Integration Tests

Execute the authentication test suite:
```bash
pytest tests/integration/test_auth.py -v
```

Tests cover all 11 core scenarios:
1. Valid staff login (returns JWT + refresh token).
2. Invalid staff password (returns 401, increments failed attempts).
3. Inactive/locked staff account (returns 403).
4. Valid provisioned farmer OTP flow (request -> simulated OTP -> verify -> tokens).
5. Invalid OTP code (returns 400).
6. Expired OTP challenge (returns 400).
7. OTP reuse prevention / replay protection (second verify attempt fails).
8. Unprovisioned farmer login rejection (neutral response, OTP suppressed).
9. Expired JWT access token (returns 401).
10. Invalid JWT access token (returns 401).
11. Logout & refresh token invalidation (refresh fails after logout).

---

## Step 4: Role-Based Access Control (RBAC) & Scope Enforcement

### 1. Architecture Overview
Step 4 introduces an authorization and geographic boundary enforcement guard layer:
- **Canonical Permission Check:** Enforced via `require_permission(code)` and `require_any_permission(*codes)` dependencies. Resolves role defaults from `role_permissions` and dynamic active grants from `user_permission_grants`.
- **Geographic Scope Enforcement:**
  - **DAHO (District Scope):** Enforced via `verify_district_scope(district_id)`. Verifies trusted assignment in `daho_district_assignments`.
  - **VO & Field Worker (Village Scope):** Enforced via `verify_village_scope(village_id)`. Verifies direct operational assignment in `user_village_assignments`.
  - **DAHO over Villages:** Allowed if the target village's district matches the DAHO's assigned district.
  - **Dairy Staff (Cooperative Scope):** Limited to villages mapped to the assigned cooperative in `cooperative_villages`.
- **Farmer Record-Level Ownership:** Enforced via `verify_farmer_ownership(farmer_id)`. Farmers can only access records mapped in `farmer_user_links` / `farmer_account_provisioning`.
- **Workflow Guards:**
  - **VO Fallback Animal Registration:** Pre-checks `animal.create.fallback`, VO village assignment, active `UNAVAILABLE` declaration in `field_worker_availability_records`, and a non-empty audit reason.
  - **Vaccinator Clinical Credentials:** Pre-checks approved entry in `vaccinator_authorizations` (`require_vaccinator_authorization`).
  - **Disease Confirmation:** Strict requirement of explicit `disease.confirm` grant (`require_disease_confirmation_authority`).
  - **SYS_ADMIN Platform Boundaries:** Platform administrators are denied operational campaign, district, and village field actions without explicit operational grants.
- **Security Audit Logging:** Denied permissions, cross-district, and cross-village attempts are written to `audit_events`.

### 2. Reusable FastAPI Dependencies
Importable from `app.dependencies.rbac`:
- `get_user_scope`
- `require_role(*roles)`
- `require_permission(code)`
- `require_any_permission(*codes)`
- `verify_district_scope`
- `verify_village_scope`
- `verify_farmer_ownership`
- `require_vaccinator_authorization`
- `require_disease_confirmation_authority`

### 3. Running Security & Authorisation Integration Tests

Execute the security test suite:
```bash
pytest tests/integration/test_rbac.py -v
```

Tests cover:
1. Valid canonical permission check (HTTP 200).
2. Missing permission denial (HTTP 403 + audit event).
3. DAHO cross-district access rejection (HTTP 403).
4. Field Worker cross-village access rejection (HTTP 403).
5. Farmer cross-account record access rejection (HTTP 403).
6. SYS_ADMIN operational restrictions (denied operational scope).
7. Individual permission grant and revocation lifecycle.
8. Inactive account access rejection (HTTP 403).
9. Expired or malformed JWT rejection (HTTP 401).
10. VO fallback registration prerequisites (requires formal FW unavailability & reason).
11. Vaccinator clinical credential authorization requirement.

---

## Step 5: Administrative Management Backend

### 1. Module Overview
Step 5 implements the complete Administrative Management backend under `/api/v1/administration` covering 8 administrative sub-modules:
- **District Management (`/districts`):** List, retrieve, create, update, and get summary statistics for districts. Enforces DAHO district assignment and unique district codes.
- **Taluka Management (`/talukas`):** Manage talukas under parent districts. Enforces parent district existence and DAHO operational scope.
- **Village Management (`/villages`):** Manage villages under talukas. Validates parent taluka-district relationships and coordinate status (`VERIFIED` vs `UNAVAILABLE`).
- **Gram Panchayat Management (`/gram-panchayats`):** Manage Gram Panchayats and map governed villages (`/gram-panchayats/{gp_id}/villages`).
- **Cooperative Management (`/cooperatives`):** Manage dairy cooperatives, served village mappings (`/cooperatives/{coop_id}/villages`), and staff assignments (`/cooperatives/{coop_id}/staff`). Isolates dairy staff to their assigned cooperative.
- **Veterinary Officer Management (`/veterinary-officers`):** Provision staff accounts, manage professional profiles (`veterinary_officer_profiles`), and update operational status. Preserves fallback-only animal registration (`animal.create.fallback`) without granting primary registration or unapproved disease confirmation.
- **Field Worker Management (`/field-workers`):** Provision primary animal registrar accounts (`role = 'FIELD_WORKER'`), update profile information, and activate/deactivate accounts.
- **Administrative Assignment Management (`/assignments`):** Authorise VO-to-village assignments, end village assignments, and manage DAHO-to-district assignments (SYS_ADMIN only).

### 2. Endpoints Summary (Hardened & Permissions-Enforced)

| Method | Endpoint | Authority Required | Description & Constraints |
|---|---|---|---|
| `GET` | `/api/v1/administration/districts` | `district.setup.manage` / `aggregate.view` | List districts in caller scope (403 for unauthorized roles like FARMER) |
| `GET` | `/api/v1/administration/districts/{id}` | `district.setup.manage` / `aggregate.view` | Get district details (DAHO scoped) |
| `POST` | `/api/v1/administration/districts` | `district.setup.manage` | Create district (SYS_ADMIN without explicit individual grant rejected 403; duplicate returns 409) |
| `PUT` | `/api/v1/administration/districts/{id}` | `district.setup.manage` | Update district (DAHO scoped) |
| `GET` | `/api/v1/administration/districts/{id}/summary` | `district.setup.manage` / `aggregate.view` | Get administrative summary counts (DAHO scoped) |
| `GET` | `/api/v1/administration/talukas` | `district.setup.manage` / `village.manage` / `aggregate.view` | List talukas (DAHO scoped) |
| `GET` | `/api/v1/administration/talukas/{id}` | `district.setup.manage` / `village.manage` / `aggregate.view` | Get taluka details (DAHO scoped) |
| `POST` | `/api/v1/administration/talukas` | `district.setup.manage` | Create taluka under district (parent existence validated; duplicate returns 409) |
| `PUT` | `/api/v1/administration/talukas/{id}` | `district.setup.manage` | Update taluka information |
| `GET` | `/api/v1/administration/villages` | `village.manage` / `aggregate.view` / `animal.read` | List villages (scoped to caller) |
| `GET` | `/api/v1/administration/villages/{id}` | `village.manage` / `aggregate.view` / `animal.read` | Get village details (scoped to caller) |
| `POST` | `/api/v1/administration/villages` | `village.manage` | Create village with parent validation (mismatched taluka-district returns 400; duplicate returns 409) |
| `PUT` | `/api/v1/administration/villages/{id}` | `village.manage` | Update village details & coordinates |
| `GET` | `/api/v1/administration/gram-panchayats` | `gram_panchayat.manage` / `aggregate.view` | List Gram Panchayats (DAHO scoped) |
| `GET` | `/api/v1/administration/gram-panchayats/{id}` | `gram_panchayat.manage` / `aggregate.view` | Get Gram Panchayat & mapped villages |
| `POST` | `/api/v1/administration/gram-panchayats` | `gram_panchayat.manage` | Create Gram Panchayat (duplicate code returns 409) |
| `PUT` | `/api/v1/administration/gram-panchayats/{id}` | `gram_panchayat.manage` | Update Gram Panchayat |
| `POST` | `/api/v1/administration/gram-panchayats/{id}/villages` | `gram_panchayat.manage` | Map village to GP (mismatched taluka returns 400; duplicate active mapping returns 409) |
| `GET` | `/api/v1/administration/cooperatives` | `cooperative.manage` / `coop.manage` / `camp.view_coop` / `aggregate.view` | List cooperatives (dairy staff isolated to assigned cooperatives) |
| `GET` | `/api/v1/administration/cooperatives/{id}` | `cooperative.manage` / `coop.manage` / `camp.view_coop` / `aggregate.view` | Get cooperative details (dairy staff isolated) |
| `POST` | `/api/v1/administration/cooperatives` | `cooperative.manage` | Create cooperative (duplicate code returns 409) |
| `PUT` | `/api/v1/administration/cooperatives/{id}` | `cooperative.manage` | Update cooperative |
| `POST` | `/api/v1/administration/cooperatives/{id}/villages` | `cooperative.manage` | Map served village to cooperative (duplicate returns 409) |
| `POST` | `/api/v1/administration/cooperatives/{id}/staff` | `coop.manage` / `cooperative.manage` | Assign dairy staff to cooperative (duplicate active role assignment returns 409) |
| `GET` | `/api/v1/administration/veterinary-officers` | `veterinary_officer.manage` / `user.manage` / `aggregate.view` | List VOs in caller district scope |
| `GET` | `/api/v1/administration/veterinary-officers/{id}` | `veterinary_officer.manage` / `user.manage` / `aggregate.view` | Get VO profile and active village assignments |
| `POST` | `/api/v1/administration/veterinary-officers` | `veterinary_officer.manage` / `user.manage` | Provision VO with Argon2id hash (preserves fallback animal.create.fallback) |
| `PUT` | `/api/v1/administration/veterinary-officers/{id}` | `veterinary_officer.manage` / `user.manage` | Update VO profile details |
| `PATCH` | `/api/v1/administration/veterinary-officers/{id}/status` | `user.manage` | Activate/deactivate VO account |
| `GET` | `/api/v1/administration/field-workers` | `user.manage` / `veterinary_officer.manage` / `aggregate.view` | List Field Workers in caller scope |
| `GET` | `/api/v1/administration/field-workers/{id}` | `user.manage` / `veterinary_officer.manage` / `aggregate.view` | Get Field Worker details |
| `POST` | `/api/v1/administration/field-workers` | `user.manage` strictly | Provision Field Worker account (`veterinary_officer.manage` disallowed) |
| `PUT` | `/api/v1/administration/field-workers/{id}` | `user.manage` | Update Field Worker details |
| `PATCH` | `/api/v1/administration/field-workers/{id}/status` | `user.manage` | Activate/deactivate Field Worker |
| `POST` | `/api/v1/administration/assignments/vo-village` | `veterinary_officer.manage` / `user.manage` | Assign VO to village (duplicate active assignment returns 409) |
| `POST` | `/api/v1/administration/assignments/vo-village/end` | `veterinary_officer.manage` / `user.manage` | End VO village assignment (retains history via `ended_at`) |
| `POST` | `/api/v1/administration/assignments/daho-district` | `user.manage` (SYS_ADMIN only) | Assign DAHO to operational district (duplicate returns 409) |

### 3. Running Administrative Integration Tests

Execute the administrative integration test suite:
```bash
pytest tests/integration/test_administration.py -v
```

The test suite covers 21 comprehensive scenarios:
1. DAHO assigned district access and cross-district denial (403).
2. SYS_ADMIN district creation authority check (SYS_ADMIN without grant rejected 403; with grant succeeds 201; duplicate returns 409; audit logged).
3. Taluka parent validation and cross-district creation prevention.
4. Village creation, mismatched taluka-district relationship rejection (400), and coordinate status.
5. Gram Panchayat creation and village mapping under DAHO scope.
6. Cooperative creation, village mapping, and dairy staff scope restriction.
7. VO provisioning, profile creation, and fallback-only role permission preservation (`animal.create.fallback`).
8. Field Worker provisioning, status deactivation, and role separation from VO.
9. VO-to-village operational assignment creation and termination.
10. DAHO-to-district assignment restricted strictly to SYS_ADMIN.
11. Unauthenticated request rejection (401).
12. Administrative GET endpoints reject unauthorized roles (FARMER / unpermitted FW receive 403).
13. Duplicate Gram Panchayat village mapping returns 409 Conflict.
14. Mismatched taluka Gram Panchayat village mapping returns 400 Bad Request.
15. Duplicate Cooperative village mapping returns 409 Conflict.
16. Duplicate Cooperative staff assignment returns 409 Conflict.
17. Duplicate VO village assignment returns 409 Conflict.
18. Duplicate DAHO district assignment returns 409 Conflict.
19. Field Worker provisioning rejected without `user.manage` (403).
20. Ending VO village assignment preserves historical record with `ended_at`.
21. District summary scope enforcement (unassigned district summary returns 403).

---

## Step 6: Farmer and Animal Management Backend

### 1. Module Overview
Step 6 implements the complete Farmer and Animal Management backend providing:
- **Decoupled Farmer Registration & Account Provisioning:**
  - Physical farmer registration (`POST /api/v1/farmers`): Staff-assisted creation in authorized village with normalized duplicate checking (`name_norm`) and mandatory data consent.
  - Login user account provisioning (`POST /api/v1/farmers/{id}/provision-account`): Separate operational step strictly requiring canonical authority `farmer.account.provision`. Links login user to farmer profile via `farmer_user_links` and `farmer_account_provisioning`.
  - Farmer verification (`POST /api/v1/farmers/{id}/verify`): Records formal in-person verification log in `farmer_verifications`.
- **Primary vs Fallback Animal Registration:**
  - Field Worker primary registration (`POST /api/v1/animals`): `FIELD_WORKER` with canonical `animal.create` within assigned village.
  - Veterinary Officer fallback registration (`POST /api/v1/animals`): `VET_OFFICER` with `animal.create.fallback`. Strict prerequisite: assigned Field Worker must be formally recorded as unavailable in `field_worker_availability_records`. Rejects with HTTP 403 Forbidden if FW is available.
- **Physical Tag & Cryptographic QR Token Lifecycle:**
  - Bharat Pashudhan 12-digit ear tags (`POST /api/v1/animals/{id}/external-ids`): Validates `^[0-9]{12}$` format and enforces active uniqueness (HTTP 409).
  - Physical QR token tagging (`POST /api/v1/animals/{id}/qr-token`): Assigns or auto-generates 26-character Base32 cryptographic tokens (`^[A-Z2-7]{26}$`). Re-tagging safely revokes prior active tokens with `RE_TAGGED`.
  - Fast field lookups: `GET /api/v1/animals/lookup/qr/{token}` and `GET /api/v1/animals/lookup/tag/{tag_value}`.
- **Ownership Transfer & Verification:**
  - Ownership transfer submission (`POST /api/v1/animals/{id}/transfers`): Staff or farmer submits transfer request. Stores pending request (`status='REQUESTED'`). Animal owner, village, and ownership history remain untouched. Enforces `uq_open_transfer` (duplicate open transfer returns HTTP 409 Conflict).
  - Transfer decision review (`POST /api/v1/animals/{id}/transfers/{transfer_id}/decide`): Requires `animal.transfer.decide` (granted to `VET_OFFICER` and `DAHO`). Unauthorized roles (Field Worker, Farmer) receive HTTP 403 Forbidden. Approval closes prior history row, appends new history row, updates animal owner/village, sets transfer status `COMPLETED`. Rejection requires non-empty `decision_note`, sets status `REJECTED`, preserves existing ownership intact.
  - Field verification (`POST /api/v1/animals/{id}/verify`): Records physical verification log in `animal_verifications`.

### 2. Endpoints Summary

| Method | Endpoint | Authority Required | Description & Constraints |
|---|---|---|---|
| `GET` | `/api/v1/farmers` | `farmer.read` / `own.read` / `aggregate.view` | List farmers in caller's verified geographic scope |
| `GET` | `/api/v1/farmers/{id}` | `farmer.read` / `own.read` / `aggregate.view` | Get farmer profile with owned animal count and linked account status |
| `POST` | `/api/v1/farmers` | `farmer.register` / `farmer.create` | Register new farmer (duplicate check returns 409 Conflict) |
| `PUT` | `/api/v1/farmers/{id}` | `farmer.edit` / `farmer.register` | Update farmer demographics within village scope |
| `POST` | `/api/v1/farmers/{id}/provision-account` | `farmer.account.provision` strictly | Decoupled account provisioning (duplicate returns 409 Conflict) |
| `POST` | `/api/v1/farmers/{id}/verify` | `farmer.verify` | Record in-person farmer verification |
| `GET` | `/api/v1/animals` | `animal.read` / `own.read` / `aggregate.view` | List animals in caller's verified scope |
| `GET` | `/api/v1/animals/{id}` | `animal.read` / `own.read` / `aggregate.view` | Get animal details with active tags and QR token |
| `GET` | `/api/v1/animals/lookup/qr/{token}` | `animal.read` / `own.read` / `aggregate.view` | Fast lookup by 26-char Base32 QR token |
| `GET` | `/api/v1/animals/lookup/tag/{tag_value}` | `animal.read` / `own.read` / `aggregate.view` | Fast lookup by Bharat Pashudhan 12-digit tag |
| `POST` | `/api/v1/animals` | `animal.create` (FW) / `animal.create.fallback` (VO) | Register animal (FW primary; VO fallback requires FW unavailability) |
| `PUT` | `/api/v1/animals/{id}` | `animal.edit` / `animal.create` | Update animal demographics and status |
| `POST` | `/api/v1/animals/{id}/qr-token` | `animal.tag` / `animal.edit` | Assign or auto-generate Base32 QR token |
| `POST` | `/api/v1/animals/{id}/external-ids` | `animal.edit` / `animal.tag` | Attach Bharat Pashudhan tag (duplicate returns 409) |
| `POST` | `/api/v1/animals/{id}/transfers` | `animal.transfer.request` | Submit ownership transfer request (stores pending request, owner untouched) |
| `GET` | `/api/v1/animals/{id}/transfers` | `animal.read` / `animal.transfer.request` | List ownership transfer requests for animal |
| `POST` | `/api/v1/animals/{id}/transfers/{transfer_id}/decide` | `animal.transfer.decide` strictly | Review and decide transfer (`APPROVE` or `REJECT`) |
| `POST` | `/api/v1/animals/{id}/verify` | `animal.verify` | Record physical animal verification |

### 3. Running Farmer and Animal Integration Tests

Execute the integration test suites:
```bash
pytest tests/integration/test_farmers.py -v
pytest tests/integration/test_animals.py -v
```

---

## Step 7: Core Operational Modules

### 1. Modules Overview
Step 7 implements the core operational domains:
- **Campaign Management (`/api/v1/campaigns`):**
  - DAHO creates campaigns (`POST /api/v1/campaigns`) with canonical authority `campaign.configure`.
  - DAHO activates campaigns (`POST /api/v1/campaigns/{id}/activate`) with `campaign.manage`, which snapshots eligible animal population targets into `campaign_animal_targets`.
  - Veterinary Officers assign Field Workers to campaign villages (`POST /api/v1/campaigns/{id}/assignments`) using `campaign.assign_workers`.
- **Veterinary Camps (`/api/v1/veterinary-camps` & `/api/v1/camps`):**
  - Camps proposed (`POST /api/v1/veterinary-camps`) in status `PROPOSED`.
  - Veterinary Officers review and confirm camps (`POST /api/v1/veterinary-camps/{id}/confirm`) with `camp.manage`. Enforces temporal overlap exclusion constraint (`excl_camp_overlap` -> HTTP 409 Conflict).
  - Cancellation requires mandatory documented reason; rescheduling creates a linked camp record.
- **Vaccine Inventory Management (`/api/v1/vaccine-inventory`):**
  - Catalogue product creation (`POST /api/v1/vaccine-inventory/products`).
  - Batch stock lot receipt (`POST /api/v1/vaccine-inventory/lots`) by DAHO (`vaccine_stock.manage`).
  - Dose issues (`POST /api/v1/vaccine-inventory/lots/{id}/issue`) enforcing non-negative balances.
  - Adjustments and wastage (`POST /api/v1/vaccine-inventory/lots/{id}/adjust`) with mandatory documented reason.
- **Vaccination Management & Health Events (`/api/v1/vaccinations`):**
  - Routine vaccination recording (`POST /api/v1/vaccinations`) strictly requires clinical vaccinator authorization (`is_approved_vaccinator`).
  - Batch number is optional (DEC-018); routine vaccination requires no mandatory VO approval (DEC-016: `review_status='NONE'`).
  - Treatment consultations (`POST /api/v1/vaccinations/treatments`) and history.
  - VO event reviews (`POST /api/v1/vaccinations/events/{id}/review`) and event corrections (`POST /api/v1/vaccinations/events/{id}/correct`).
- **Disease Surveillance & Reporting (`/api/v1/disease-reports`):**
  - Suspected disease incident reporting (`POST /api/v1/disease-reports`). Starts as `SUBMITTED` / UNCONFIRMED (DEC-020).
  - Veterinary Officer triage review (`POST /api/v1/disease-reports/{id}/reviews`) with status `SUSPECTED` or `NEEDS_MORE_INFORMATION`.
  - Final case confirmation or disproval (`POST /api/v1/disease-reports/{id}/decide`) strictly requires explicit departmental authorization `disease.confirm`. Standard VOs without `disease.confirm` are rejected with HTTP 403 Forbidden.
  - Village-level disease surveillance summary (`GET /api/v1/disease-reports/surveillance-summary`).

### 2. Running Step 7 Integration Tests

Execute the operational module integration test suites:
```bash
pytest tests/integration/test_campaigns.py -v
pytest tests/integration/test_camps.py -v
pytest tests/integration/test_inventory.py -v
pytest tests/integration/test_vaccinations.py -v
pytest tests/integration/test_disease_surveillance.py -v
```




