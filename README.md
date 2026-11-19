# PashuRakshak Botad

Digital livestock vaccination tracking and disease early-warning platform.

> This README is the setup/documentation entry point. Verify actual repository paths, package scripts, migration revisions and environment variable names before running commands. Never copy secrets into source control.

## 1. Core project rules

- Gujarati application UI; English technical documentation; Western digits (0–9).
- Preserve approved green UI identity and supplied references.
- DAHO manages district operational setup, campaigns and vaccine stock within assigned district.
- VO assigns FWs within authorised villages.
- FW is primary animal registrar; VO fallback requires explicit authorised FW-unavailability record and reason.
- Farmer record creation and login provisioning are separate. OTP authenticates an existing provisioned account only. No public farmer self-registration.
- Cooperative may propose/coordinate camps; VO decides as defined by APPFLOW. Camp coordination does not authorise vaccination.
- Only separately authorised vaccinators may administer/record vaccination.
- Routine vaccination requires no mandatory VO approval; batch number is optional; VO correction/audit requires reason.
- Suspected disease is not confirmed until authorised veterinary review. Alerts are not diagnoses. No reports does not mean disease-free.
- Ownership transfer requires request and authorised decision.
- In-app notifications persist independently of SMS.
- Pending offline records are never silently deleted; warn before logout.
- Government integrations remain pending approval; SMS/WhatsApp simulated until approved credentials.

## 2. Technology stack

**Frontend:** React, Vite, TypeScript, Tailwind CSS, PWA, React Router, TanStack Query, React Hook Form, Zod, Dexie/IndexedDB, MapLibre GL JS.  
**Backend:** Python 3.12, FastAPI, SQLAlchemy 2.0, Pydantic, Alembic.  
**Database:** PostgreSQL 16, local database `pashurakshak_db`, pgAdmin 4. Docker optional. No assumed Supabase/Firebase/MongoDB/cloud DB.

## 3. Project repository layout

```text
PASHURAKSHAK/
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── security.py
│   │   │   ├── logging.py
│   │   │   └── exceptions.py
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── router.py
│   │   │       └── endpoints/
│   │   ├── db/
│   │   │   ├── session.py
│   │   │   ├── base.py
│   │   │   └── migrations/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── repositories/
│   │   ├── services/
│   │   ├── dependencies/
│   │   └── modules/
│   │       ├── authentication/
│   │       ├── users/
│   │       ├── administration/
│   │       ├── farmers/
│   │       ├── animals/
│   │       ├── campaigns/
│   │       ├── vaccinations/
│   │       ├── inventory/
│   │       ├── disease_surveillance/
│   │       ├── camps/
│   │       ├── attachments/
│   │       ├── notifications/
│   │       ├── synchronization/
│   │       └── reports/
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── security/
│   ├── requirements.txt
│   ├── .env.example
│   └── README.md
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── modules/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── routes/
│   │   ├── types/
│   │   ├── utils/
│   │   ├── offline/
│   │   └── i18n/
│   ├── public/
│   ├── package.json
│   ├── vite.config.ts
│   └── README.md
│
├── database/
│   ├── base/
│   │   └── pashurakshak_schema_v0.2.sql
│   ├── patches/
│   │   └── pashurakshak_schema_v0.3.1_patch.sql
│   ├── verification/
│   │   └── verify_schema_v0.3.1.sql
│   └── README.md
│
├── storage/
│   └── README.md
│
├── documentation/
│   ├── PRD.md
│   ├── APPFLOW.md
│   ├── TRD.md
│   ├── BACKENDDATABASESCHEMA.md
│   ├── STAKEHOLDER_PERMISSION_MATRIX.md
│   ├── DECISION_REGISTER.md
│   ├── EDGE_CASE_CATALOGUE.md
│   ├── IMPLEMENTATION_PLAN.md
│   └── PROJECT_MEMORY_AI_HANDOVER.md
│
├── .gitignore
└── README.md
```

## 4. Prerequisites

- Node.js compatible with the Vite project.
- Python 3.12.
- PostgreSQL 16.
- pgAdmin 4 (optional GUI).
- Git.
- Gujarati-capable font/device rendering.
- Approved credentials only for authorised integrations.

Record exact installed versions in the project handover.

## 5. Environment configuration

Use ignored local environment files created from examples. Never commit `.env`, passwords, OTP secrets, API keys or production credentials.

Backend configuration categories (actual names must match code): database URL, app environment, signing/session secret, OTP provider/development flag, upload/storage configuration, CORS origins and logging level.

Frontend configuration categories: backend API base URL, approved map configuration if used, PWA settings.

Do not include live government/SMS credentials unless approved. Do not invent provider URLs.

## 6. Database setup

1. Install/start PostgreSQL 16.
2. Create local database `pashurakshak_db`.
3. Create a least-privilege development DB user.
4. Configure the DB URL through ignored `.env`.
5. Apply base schema `database/base/pashurakshak_schema_v0.2.sql` followed by patch `database/patches/pashurakshak_schema_v0.3.1_patch.sql`.
6. Run verification script `database/verification/verify_schema_v0.3.1.sql`.
7. Load only reviewed development seeds.
8. Run schema and integration tests.
9. Record server version, migration revision, exact commands and output in `DB_VALIDATION_REPORT.md`.

Illustrative commands:

```bash
createdb -U postgres pashurakshak_db
psql -U postgres -d pashurakshak_db -f database/base/pashurakshak_schema_v0.2.sql
psql -U postgres -d pashurakshak_db -f database/patches/pashurakshak_schema_v0.3.1_patch.sql
psql -U postgres -d pashurakshak_db -f database/verification/verify_schema_v0.3.1.sql
```

Never drop/reset a database containing user data; use a separate test database for clean migration validation.

## 7. Backend setup

Illustrative virtual environment commands:

```bash
cd backend
python -m venv .venv
```

Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

macOS/Linux:

```bash
source .venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Run FastAPI development server:

```bash
uvicorn app.main:app --reload --port 8000
```

## 8. Frontend setup

Illustrative commands:

```bash
cd frontend
npm install
npm run dev
```

Check `npm run` output for actual lint, type-check, build and preview commands.

## 9. Authentication and authorisation

- OTP authenticates an existing provisioned account only.
- Farmer record and login provisioning are separate.
- No public farmer self-registration.
- Backend permissions are authoritative.
- DAHO district and VO/FW village scope are resolved server-side.
- Client-supplied scope IDs are not trusted.
- Cooperative default view is village aggregate overdue counts, not individual owner details.
- Camp participation does not grant vaccinator authority.
- Disease review/confirmation requires explicit authority.

## 10. Offline/PWA

- Seven-day offline authorisation default; admin-configurable.
- Expiry requires online reauthentication.
- Pending records are never silently deleted.
- Warn before logout if sync is pending.
- Use idempotency and safe retries.
- Server cannot review an unsent payload.
- Record exact offline-supported actions in TRD and test Android/PWA behaviour.

## 11. Integrations

Government integrations are pending departmental approval and authorised API access. SMS/WhatsApp are simulated until approved provider credentials exist. In-app notifications and due lists must work independently.

## 12. Documentation map

| File | Purpose |
|---|---|
| `documentation/PRD.md` | Functional requirements and acceptance criteria |
| `documentation/TRD.md` | Architecture, APIs, sync and technical constraints |
| `documentation/APPFLOW.md` | Authoritative stakeholder workflows |
| `documentation/BACKENDDATABASESCHEMA.md` | Data model and relationships |
| `documentation/IMPLEMENTATION_PLAN.md` | Dependency-ordered implementation roadmap |
| `documentation/PROJECT_MEMORY_AI_HANDOVER.md` | AI continuation/recovery state |
| `documentation/EDGE_CASE_CATALOGUE.md` | Edge cases, responses and tests |
| `documentation/STAKEHOLDER_PERMISSION_MATRIX.md` | Roles, permissions and scope |
| `documentation/DECISION_REGISTER.md` | Baseline, open and pending decisions |
| `DB_VALIDATION_REPORT.md` | Actual database validation evidence |

If documents conflict, do not invent a resolution. Use the project source hierarchy, record the conflict in the decision register and update impacted documents together.

## 13. Testing and release

Before a release candidate:
- Run frontend lint/type/build/tests.
- Run backend unit/integration tests.
- Apply migrations to a clean PostgreSQL 16 test database.
- Test role and district/village access directly against APIs.
- Test FW-first registration and VO fallback.
- Test farmer/account provisioning and OTP separation.
- Test camp/vaccinator separation.
- Test disease review and ownership-transfer decisions.
- Test offline expiry, pending logout, partial sync, duplicate retry and lost acknowledgement.
- Test Gujarati rendering on Android and desktop.
- Record exact commands, environment, results and limitations.

Do not claim performance, concurrency, security certification or production readiness without evidence.

## 14. Pending approvals

See `DECISION_REGISTER.md`: final role grants, vaccinator permission, disease-confirmation authority, transfer decision authority, duplicate/shared-mobile policy, offline device/recovery policy, retention, export grants, government API access, SMS/WhatsApp provider and exact visual tokens.
