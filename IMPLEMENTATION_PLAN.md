# PashuRakshak Botad — Implementation Plan

**Status:** Dependency-ordered roadmap. Estimates and departmental approvals are not assumed.  
**Workflow authority:** APPFLOW. Requirements: PRD. Technical design: TRD. Persistence: final schema/SQL. Permissions: `STAKEHOLDER_PERMISSION_MATRIX.md`.

## 1. Invariants every stage must preserve

- DAHO manages district setup, campaigns and vaccine stock within assigned district.
- VO assigns FWs within authorised villages.
- FW is primary animal registrar. VO fallback requires explicit authorised FW-unavailability record and reason.
- Farmer record creation and login provisioning are separate; OTP authenticates an existing provisioned account only; no public farmer self-registration.
- Cooperative may propose/coordinate camps; VO decides as defined by APPFLOW. Camp coordination does not authorise vaccination.
- Only separately authorised vaccinators may administer/record vaccination.
- Routine vaccination has no mandatory VO approval; vaccine batch is optional; VO audit/correction requires reason.
- Suspected disease remains unconfirmed until authorised veterinary review. Alerts are not diagnoses. No reports does not mean disease-free.
- Ownership transfer is request followed by authorised decision.
- In-app notifications persist independently of SMS.
- Server derives and enforces district/village scope.
- Bharat Pashudhan 12-digit tag is optional external ID, distinct from internal animal ID.
- Seven-day default configurable offline authorisation; expiry requires online reauthentication; pending records are never silently deleted; warn before logout.
- Government integrations pending approval; SMS/WhatsApp simulated until approved credentials.
- No invented clinical rules, schedules, doses, disease thresholds or government processes.

## 2. Approved stack

Frontend: React, Vite, TypeScript, Tailwind, PWA, React Router, TanStack Query, React Hook Form, Zod, Dexie/IndexedDB, MapLibre GL JS.  
Backend: Python 3.12, FastAPI, SQLAlchemy 2.0, Pydantic, Alembic.  
Database: PostgreSQL 16, local `pashurakshak_db`, pgAdmin 4. Docker optional. No assumed Supabase/Firebase/MongoDB/cloud database.

## 3. Delivery rules

Inspect before editing; reuse working code; backend permissions are authoritative; use migrations; add tests per stage; use idempotency for retries; preserve audit history; do not implement unresolved policy; update `PROJECT_MEMORY_AI_HANDOVER.md` at each stage.

## 4. Ordered implementation stages

### Stage 0 — Repository and requirements baseline
**Objective:** Establish verified current state without destructive changes.  
**Prerequisites:** Workspace access.  
**Tasks:** Inventory repo/branches/files; read all core docs; inspect SQL patch order and validation evidence; locate UI references; record Node/Python/PostgreSQL versions; run baseline checks; list conflicts with exact file/section.  
**Stakeholders:** Map DAHO, VO, FW, cooperative, farmer, SYS_ADMIN and separately authorised vaccinator journeys.  
**UI:** Inventory existing routes; map to screen IDs in UI_UX_DESIGN.  
**API:** Inventory routes, auth, permissions, scope, audit.  
**DB:** Inventory schema, migrations, seeds, constraints, indexes.  
**Validation/edge cases:** Check existing tests for scope, FW-first, provisioning separation, camp/vaccinator, disease review, offline pending data.  
**Outputs:** Repository audit, file map, baseline test report, conflict list.  
**Acceptance:** No destructive action; exact versions and paths recorded.  
**Tests:** Existing non-destructive checks.  
**Recovery:** Missing sources recorded; continue independent tasks.  
**Memory:** Record exact baseline and next Stage 1.

### Stage 1 — Database/backend foundation
**Objective:** Reproducible FastAPI/PostgreSQL foundation.  
**Prerequisites:** Stage 0 and schema conflict review.  
**Tasks:** Configure Python 3.12/FastAPI/SQLAlchemy/Pydantic/Alembic; PostgreSQL 16 connection; health endpoint; structured errors/log redaction; transactions; migrations; clean DB smoke tests. Docker optional.  
**Stakeholders:** No operational action before auth/scope controls.  
**UI:** Preserve frontend build; health integration only if needed.  
**API:** Health/readiness and standard errors.  
**DB:** Apply reviewed schema; verify PK/FK/unique/check/index.  
**Validation/edge cases:** Missing env, DB unavailable, migration failure, rollback safety.  
**Outputs:** Backend skeleton, env example, migrations, tests, setup notes.  
**Acceptance:** Clean DB migrates reproducibly; no secret committed.  
**Tests:** Clean migration and schema smoke tests.  
**Recovery:** Use disposable DB; never drop user data.  
**Memory:** Record DB version, revision, commands/results; next Stage 2.

### Stage 2 — Authentication, sessions and permissions
**Objective:** Authenticate existing provisioned users and enforce explicit permissions.  
**Prerequisites:** Stage 1.  
**Tasks:** OTP provider boundary; clearly labelled dev stub only if no approved provider; OTP login-only; sessions/expiry; explicit permission checks; deny by default; server-derived DAHO/VO/FW scope.  
**Stakeholders:** Provisioned roles only; no public farmer signup.  
**UI:** AUTH-01/02/03, expired session and logout.  
**API:** Auth request/verify/logout/session and permission dependencies.  
**DB:** User/account, auth/session, roles/permissions, assignments, audit per final schema.  
**Validation/edge cases:** Invalid/expired OTP, provider failure, unprovisioned user, role tampering, cross-scope request.  
**Outputs:** Auth services, middleware, screens and tests.  
**Acceptance:** OTP cannot create records; ungranted APIs denied.  
**Tests:** Direct API RBAC/scope tests.  
**Recovery:** Keep dev auth isolated; never bypass auth.  
**Memory:** Record auth mode and next Stage 3.

### Stage 3 — District setup and assignments
**Objective:** Implement DAHO district setup and VO worker assignments.  
**Prerequisites:** Stage 2.  
**Tasks:** DAHO manages villages/geodata, Gram Panchayats, cooperatives, VO records/assignments within assigned district; VO assigns FWs within authorised villages; validate relationships; audit changes.  
**Stakeholders:** DAHO district setup; VO assignments; FW sees assigned work.  
**UI:** DASH-DAHO, SETUP-VILLAGE/GP/COOP/VO, DASH-VO, FW-ASSIGN.  
**API:** Setup CRUD and assignment endpoints per TRD.  
**DB:** District, village, GP, cooperative, VO, FW and assignment entities in final schema.  
**Validation/edge cases:** Unassigned district, invalid hierarchy, duplicate, revoked assignment, out-of-scope worker.  
**Outputs:** APIs, pages, tests and audit.  
**Acceptance:** DAHO assigned-district scope; VO authorised-village scope.  
**Tests:** Positive and cross-scope tests.  
**Recovery:** Reject invalid relationships; do not auto-create unknown villages.  
**Memory:** Record modules and next Stage 4.

### Stage 4 — Farmer records and login provisioning
**Objective:** Controlled onboarding with distinct farmer/account records.  
**Prerequisites:** Stages 2–3.  
**Tasks:** Farmer creation only by approved staff roles; separate audited provisioning via `farmer.account.provision`; OTP existing-account only; duplicate/shared-mobile rules only as approved; assisted/no-smartphone path only as documented.  
**Stakeholders:** Staff create records; authorised staff provision login; farmer logs in after provisioning.  
**UI:** FARMER-LIST/FORM/ACCOUNT and AUTH screens.  
**API:** Farmer record and separate provisioning endpoints.  
**DB:** Farmer/owner, user/account, provisioning/audit entities per final schema.  
**Validation/edge cases:** Duplicate/shared mobile, no smartphone, wrong village, public signup, OTP for nonexistent account.  
**Outputs:** APIs, screens and tests.  
**Acceptance:** No public signup; creation does not auto-create account.  
**Tests:** OTP cannot create/link farmer/user.  
**Recovery:** Hold ambiguous duplicates; no silent merge.  
**Memory:** Record creator grants/open decisions; next Stage 5.

### Stage 5 — Animal registry and FW-first fallback
**Objective:** Animal identity and registrar-authority enforcement.  
**Prerequisites:** Stages 2–4.  
**Tasks:** Internal ID separate from optional 12-digit external tag; FW primary; VO fallback only with valid explicit authorised unavailability record and reason; same rule for API/import/offline/retry; duplicate identifiers/QR; approved owner linkage.  
**Stakeholders:** FW primary; VO conditional fallback.  
**UI:** ANIMAL-LIST/FORM/DETAIL and QR states.  
**API:** Registration, identifier verification, detail/history.  
**DB:** Animal, identifiers, owner link, FW availability, audit.  
**Validation/edge cases:** Duplicate/missing/damaged tag, FW available, missing/expired evidence, offline fallback.  
**Outputs:** Registry APIs/UI/tests.  
**Acceptance:** Optional external tag; VO fallback blocked without evidence.  
**Tests:** Online and sync/import enforcement.  
**Recovery:** Preserve local draft; do not bypass fallback.  
**Memory:** Record all ingestion-path gates; next Stage 6.

### Stage 6 — Campaigns, assignments and camps
**Objective:** Separate campaign ownership, FW assignment and camp coordination.  
**Prerequisites:** Stages 2–5.  
**Tasks:** DAHO creates/configures campaigns; VO assigns FWs within authorised villages; cooperative may propose/coordinate camp; VO confirms/reschedules/rejects; camp assignment never grants vaccination authority; unresolved overlap/cancellation policy goes to decision register.  
**Stakeholders:** DAHO campaign owner; VO assigns/decides; cooperative proposes.  
**UI:** CAMPAIGN-LIST/FORM, CAMP-LIST/FORM, FW-ASSIGN.  
**API:** Campaign, worker assignment, camp proposal/decision.  
**DB:** Campaign, assignments, camp, status history, audit.  
**Validation/edge cases:** SYS_ADMIN campaign attempt, VO config without grant, out-of-scope village, cooperative self-confirm, cancellation/overlap.  
**Outputs:** APIs/pages/tests.  
**Acceptance:** Correct owner and separation of camp/vaccinator authority.  
**Tests:** RBAC and scope.  
**Recovery:** Keep unresolved camp state pending; no invented priority.  
**Memory:** Record permissions/tests; next Stage 7.

### Stage 7 — Vaccine stock and vaccination
**Objective:** Auditable inventory and authorised vaccination events.  
**Prerequisites:** Stages 2–6 and reviewed stock transaction model.  
**Tasks:** Ledger-based approved stock movements; actor/time/quantity/reason/reference; transaction-safe balance; separate vaccinator permission; batch optional; no mandatory VO approval; VO audit/correction with reason and history. No invented doses/schedules.  
**Stakeholders:** DAHO/authorised stock manager; separately authorised vaccinator; VO audit as granted.  
**UI:** STOCK-DASH/ENTRY, VACCINATION-FORM, ANIMAL-DETAIL.  
**API:** Stock movement and vaccination/correction.  
**DB:** Stock ledger/item/location and vaccination event/audit per final schema.  
**Validation/edge cases:** Unauthorised edit, insufficient/concurrent stock, duplicate movement, optional batch, camp-only actor.  
**Outputs:** APIs, UI, ledger tests.  
**Acceptance:** Traceable stock; camp does not confer authority; batch nullable.  
**Tests:** Transaction and permission tests.  
**Recovery:** Roll back invalid movement; no silent balance repair.  
**Memory:** Record model/permissions; next Stage 8.

### Stage 8 — Disease reporting and veterinary review
**Objective:** Suspected reports and authorised review.  
**Prerequisites:** Stages 2–5 and approved report fields.  
**Tasks:** Submit reports/attachments; retain suspected/pending status; authorised review queue; separate confirmation grant if required; audit reviewer/decision/time/reason; no automatic diagnosis/threshold/outbreak.  
**Stakeholders:** Permitted reporters; authorised veterinary reviewer.  
**UI:** DISEASE-REPORT/QUEUE/DETAIL.  
**API:** Report, attachment, review/decision/history.  
**DB:** Report, attachment, review, status history, audit.  
**Validation/edge cases:** Duplicate, missing fields according to approved requiredness, delayed/conflicting review, unauthorised confirmation, zero reports.  
**Outputs:** APIs/UI/tests.  
**Acceptance:** No automatic confirmation; no disease-free inference.  
**Tests:** Reviewer permission and status transitions.  
**Recovery:** Keep suspected/pending; route conflicts to authorised review.  
**Memory:** Record state model; next Stage 9.

### Stage 9 — Ownership transfer and notifications
**Objective:** Authorised transfer decision and durable in-app notifications.  
**Prerequisites:** Stages 2–5.  
**Tasks:** Transfer request then explicit decision; owner unchanged before approval; record reason/history; persistent in-app notifications; external channels simulated until approved credentials; avoid sensitive previews.  
**Stakeholders:** Eligible requester; authorised decision-maker; recipients.  
**UI:** TRANSFER-REQUEST/REVIEW, NOTIFY-LIST.  
**API:** Transfer request/decision/history, notification list/read/create.  
**DB:** Transfer request/decision/owner history, notification/delivery attempt.  
**Validation/edge cases:** Conflicting requests, self-approval, rejection, SMS failure, duplicate notice.  
**Outputs:** APIs/screens/tests.  
**Acceptance:** Request does not change owner; in-app persists independently.  
**Tests:** Transfer and notification failure tests.  
**Recovery:** Keep pending; retry external delivery without duplicating in-app record.  
**Memory:** Record behaviour; next Stage 10.

### Stage 10 — Offline PWA and sync
**Objective:** Reliable offline work without silent data loss.  
**Prerequisites:** Core APIs/data models.  
**Tasks:** PWA and Dexie; define only approved offline actions; seven-day configurable authorisation; online reauth after expiry; idempotency/retry/ack/conflict; revalidate permission/scope on server; warn before logout; preserve pending queue. Server cannot inspect unreceived payload.  
**Stakeholders:** Approved field users; admin actions offline only if explicitly approved.  
**UI:** Offline banner, SYNC-QUEUE, conflict and logout warning.  
**API:** Sync upload/ack/status.  
**DB:** Sync/idempotency/audit metadata and domain tables.  
**Validation/edge cases:** Expiry, partial sync, duplicate event, lost ACK, concurrent edit, second device, device loss, storage quota, dependency ordering.  
**Outputs:** Offline service, queue, sync API, tests.  
**Acceptance:** No silent deletion; idempotent retry; expired grant blocks new protected actions.  
**Tests:** Android/PWA network and recovery tests.  
**Recovery:** Preserve queue; quarantine only by approved process.  
**Memory:** Record offline scope/protocol; next Stage 11.

### Stage 11 — Reports, maps, exports, privacy and security
**Objective:** Complete role-scoped reporting and security verification.  
**Prerequisites:** Core workflows.  
**Tasks:** Approved metrics only; scope every report/map/export; cooperative aggregate-only default; explicit export grant; MapLibre with authorised data/list alternative; test injection, XSS, expiry, escalation, audit and privacy.  
**Stakeholders:** Each role sees permitted data only.  
**UI:** Dashboards, reports, maps and export states.  
**API:** Scoped report/map/export endpoints.  
**DB:** Reporting domains and audit/export records where schema supports them.  
**Validation/edge cases:** Cross-scope, cooperative privacy, export denial, stale assignment, malicious input, zero reports.  
**Outputs:** Reports/maps, security and QA report.  
**Acceptance:** No scope leakage or unsupported disease inference.  
**Tests:** Direct API security tests.  
**Recovery:** Disable unsafe export/report rather than weaken controls.  
**Memory:** Record results; next Stage 12.

### Stage 12 — Release, documentation and handover
**Objective:** Reproducible, verified release candidate.  
**Prerequisites:** Stages 0–11.  
**Tasks:** Clean PostgreSQL 16 migration/seed tests; frontend/backend/integration/E2E tests; workflow regression; Gujarati responsive checks; offline recovery tests; confirm integrations disabled/pending; complete docs; generate documentation PDFs and four prompt PDFs; ZIP and manifest; document limitations.  
**Stakeholders:** Verify DAHO, VO, FW, cooperative, farmer, SYS_ADMIN and separately authorised vaccinator journeys.  
**UI:** Verify all specified screens/states; do not claim screenshots not generated.  
**API:** Full route/RBAC/scope regression.  
**DB:** Final migration, constraints, indexes, representative queries.  
**Validation/edge cases:** Catalogue cases passed or explicitly blocked/pending.  
**Outputs:** Release candidate, docs, PDFs, ZIP, validation report and handover.  
**Acceptance:** Clean setup reproducible; claims backed by evidence.  
**Tests:** Record exact commands and outcomes.  
**Recovery:** Report failures honestly; do not call incomplete release complete.  
**Memory:** Record final artifact paths, evidence, known issues and next action.

## 5. Cross-stage mandatory regression tests

Test DAHO district enforcement; VO village assignment; FW-first/VO fallback evidence; farmer/account separation; OTP login-only; DAHO campaign ownership; cooperative/camp/vaccinator separation; suspected/review/confirmation; transfer request/decision; notification persistence; optional tag/batch; no mandatory VO vaccination approval; offline expiry/pending logout/partial sync/lost ACK; cooperative aggregate-only view; cross-scope denial and export permission.

## 6. Definition of done per stage

A stage is complete only when code and tests are saved, acceptance criteria are checked, failures/limitations recorded, no workflow conflict introduced, and `PROJECT_MEMORY_AI_HANDOVER.md` updated with files, migrations, decisions, exact test commands/results and exact next stage.
