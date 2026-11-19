# PashuRakshak Botad — Antigravity Execution Prompts (Stages 0–12)

**Use:** Execute one stage at a time in Google Antigravity. Paste the selected stage prompt, not the entire file, unless needed. Each stage is independently understandable and must preserve the same APPFLOW workflow.

## Global contract — applies to every stage

You are continuing the existing PashuRakshak Botad project. Read `PROJECT_MEMORY_AI_HANDOVER.md` first. Inspect the actual repository, documents, code, migrations and tests before editing. Reuse working code. Do not restart, overwrite validated work, rename files unnecessarily or silently change approved decisions.

### Workflow invariants — never violate
1. DAHO manages district operational setup, campaigns and vaccine stock within the assigned district.
2. VO assigns FWs within authorised villages.
3. FW is primary animal registrar. VO fallback is allowed only with an explicit authorised FW-unavailability record and reason. No invented timeout/attendance rule.
4. Farmer record creation and login provisioning are separate. OTP authenticates an existing provisioned account only. No public farmer self-registration.
5. Cooperative may propose/coordinate camps; VO confirms/reschedules/rejects according to APPFLOW. Camp coordination does not grant vaccination authority.
6. Only separately authorised vaccinators may administer/record vaccination.
7. Routine vaccination needs no mandatory VO approval. Batch number is optional. VO audit/correction requires a reason and history.
8. Disease reports remain suspected until authorised veterinary review. Alerts are not diagnosis/outbreak confirmation. No reports does not mean disease-free.
9. Ownership transfer is a request followed by an authorised decision; request alone does not change owner.
10. In-app notifications persist independently of SMS/WhatsApp.
11. Server derives district/village scope from trusted assignments; never trust client-supplied scope IDs.
12. Bharat Pashudhan 12-digit tag is optional external ID, separate from internal animal ID.
13. Offline authorisation defaults to seven days and is admin-configurable. Expiry requires online reauthentication. Pending records are never silently deleted; warn before logout.
14. Government integrations are pending approval; SMS/WhatsApp are simulated until approved credentials exist.
15. Gujarati UI, English technical documentation, Western digits (0–9).

### Approved stack
Frontend: React + Vite + TypeScript + Tailwind; PWA, Dexie/IndexedDB, React Router, TanStack Query, React Hook Form, Zod, MapLibre GL JS.  
Backend: Python 3.12, FastAPI, SQLAlchemy 2.0, Pydantic, Alembic.  
Database: PostgreSQL 16, local `pashurakshak_db`, pgAdmin 4. Docker optional. Do not assume Supabase/Firebase/MongoDB/cloud DB.

### Security and quality
Backend authorisation is authoritative; deny by default. Validate server-side. Use migrations, transactions, audit trails and idempotency for retries. Do not invent clinical rules, doses, schedules, disease thresholds or government/departmental procedures. If a policy is unresolved, keep the action safely blocked/pending and add it to `DECISION_REGISTER.md`.

### Mandatory end-of-stage action
Run relevant tests and report exact commands/results. Update `PROJECT_MEMORY_AI_HANDOVER.md` with: completed work, files created/modified, database/migration changes, decisions, tests/results, failures, unresolved issues and exact next stage. Never claim unrun tests passed. If context runs out, save work and wait for the user's `CONTINUE`; on CONTINUE read handover and resume the exact next task.

---

## STAGE 0 — Repository audit and verified baseline

**Objective:** Establish actual project state without destructive changes.

**Prerequisites:** Workspace/repository access.

**Exact tasks:**
1. Inventory files, branches, frontend/backend structure, scripts, migrations, tests, environment templates and generated docs.
2. Read PRD, APPFLOW, TRD, schema, SQL, validation report, UI/UX references, permission matrix, edge catalogue and decision register.
3. Verify actual versions and identify conflicts with exact file/section references.
4. Locate approved UI/UX PDF v0.2.1 and original image ZIP; do not invent measured design values if missing.
5. Locate SQL patches and inspect patch order/content before running anything; prevent duplicate application.
6. Record Node/Python/PostgreSQL versions; never print secrets.
7. Run existing non-destructive baseline tests and record output.

**Stakeholder workflows:** Map DAHO, VO, FW, cooperative, farmer, SYS_ADMIN and separately authorised vaccinator journeys; note any mismatch with APPFLOW.

**UI work:** Inventory routes/pages; map them to screen IDs in `UI_UX_DESIGN.md`. Do not redesign.

**Backend/API work:** Inventory routes, authentication, permission dependencies, district/village scope, audit and error handling.

**DB work:** Inventory tables, columns, constraints, indexes, seeds, migrations and exact SQL version tested.

**Validation/edge cases:** Check existing coverage for FW-first/VO fallback, OTP login-only, provisioning separation, campaign ownership, camp/vaccinator separation, disease review, transfer and offline retention.

**Expected outputs:** Repository audit, file map, baseline test report, conflict list and handover update.

**Acceptance criteria:** Actual file paths/versions recorded; no destructive changes; missing references explicitly identified; no unsupported completion claims.

**Tests:** Existing non-destructive test/lint/build commands.

**Failure recovery:** If a source is missing, record its path and continue independent work. Do not create a fake replacement and call it approved.

**Memory update:** Record exact baseline and next Stage 1 task.

---

## STAGE 1 — Database and backend foundation

**Objective:** Establish reproducible FastAPI/PostgreSQL foundation.

**Prerequisites:** Stage 0 complete; schema conflicts identified.

**Exact tasks:**
1. Configure Python 3.12, FastAPI, SQLAlchemy 2.0, Pydantic and Alembic using existing conventions.
2. Configure PostgreSQL 16 connection through environment variables; DB name `pashurakshak_db`.
3. Add health/readiness endpoint without exposing secrets.
4. Add consistent errors, safe logging/redaction, transaction boundaries and settings validation.
5. Create/reconcile migrations against approved final SQL/schema; avoid manual drift.
6. Add clean-database migration and schema smoke tests.
7. Keep Docker optional.

**Stakeholder workflows:** No business operation is enabled until authentication and scope controls are in place.

**UI:** Preserve frontend build; add only necessary health/API connection state.

**API:** Health/readiness and standard error response.

**DB:** Apply approved DDL/migrations; verify PK, FK, unique/check constraints and indexes.

**Validation/edge cases:** Missing env, DB unavailable, migration failure, rollback and schema drift.

**Expected outputs:** Backend skeleton, config example, migrations, tests and setup notes.

**Acceptance criteria:** Clean PostgreSQL 16 test DB migrates reproducibly; secrets are not committed; actual results documented.

**Tests:** Clean migration, connection and schema smoke tests.

**Failure recovery:** Use disposable test DB; never drop user data. Fix migration and rerun clean test.

**Memory update:** Record DB version, migration revision, commands/results and next Stage 2.

---

## STAGE 2 — Authentication, sessions and permissions

**Objective:** Authenticate existing provisioned users and enforce explicit permissions.

**Prerequisites:** Stage 1.

**Exact tasks:**
1. Implement login/OTP provider interface. If approved credentials are absent, use a clearly labelled development stub; never claim production OTP.
2. OTP verifies existing provisioned accounts only.
3. Keep farmer master record creation separate from account provisioning.
4. Implement session expiry/logout and approved security controls.
5. Implement explicit permissions, deny-by-default dependencies and audit.
6. Resolve DAHO district assignment and VO/FW village assignment server-side.
7. Recheck scope on protected requests; ignore client permission/scope claims.

**Stakeholder workflows:** All provisioned roles authenticate; no public farmer signup.

**UI:** AUTH-01/02/03, expired session and logout states in Gujarati.

**API:** Auth request/verify/logout/session endpoints and permission dependencies; match TRD routes.

**DB:** User/account, auth/session, role/permission, assignments and audit entities from final schema.

**Validation/edge cases:** Invalid/expired OTP, provider failure, unprovisioned user, role tampering, expired session, cross-scope request.

**Expected outputs:** Auth services, middleware/dependencies, screens and tests.

**Acceptance criteria:** OTP cannot create/link farmer/user; ungranted action denied by API; scope server-derived.

**Tests:** Direct API RBAC/scope tests for each role.

**Failure recovery:** Keep development auth isolated; disable unsafe endpoints instead of bypassing auth.

**Memory update:** Record auth mode, permission model, tests and next Stage 3.

---

## STAGE 3 — District setup and staff assignments

**Objective:** Implement DAHO district setup and VO FW assignment workflows.

**Prerequisites:** Stage 2.

**Exact tasks:**
1. DAHO manages villages/geodata, Gram Panchayats, cooperatives and VO records/assignments within assigned district and explicit permissions.
2. VO assigns FWs within authorised villages.
3. Validate parent/child relationships and duplicate identifiers.
4. Audit privileged setup and assignment changes.
5. Reject client-supplied district/village scope escalation.

**Stakeholder workflows:** DAHO setup; VO assignment; FW sees assigned work only.

**UI:** DASH-DAHO, SETUP-VILLAGE, SETUP-GP, SETUP-COOP, SETUP-VO, DASH-VO, FW-ASSIGN.

**API:** Setup CRUD and FW assignment endpoints as specified in TRD.

**DB:** District, village, GP, cooperative, VO, FW and assignment entities from final schema.

**Validation/edge cases:** Unassigned district, invalid hierarchy, duplicate record, revoked assignment, out-of-scope FW.

**Expected outputs:** Setup APIs/pages, audit and tests.

**Acceptance criteria:** DAHO limited to assigned district; VO limited to authorised villages.

**Tests:** Positive and negative scope tests.

**Failure recovery:** Reject invalid relationships; never auto-create unknown villages.

**Memory update:** Record completed modules and next Stage 4.

---

## STAGE 4 — Farmer records and login provisioning

**Objective:** Implement staff-controlled farmer onboarding with separate account provisioning.

**Prerequisites:** Stages 2–3.

**Exact tasks:**
1. Allow farmer record creation only for roles explicitly authorised in APPFLOW/permission matrix.
2. Separate farmer record from user/login account.
3. Implement separate audited `farmer.account.provision` action.
4. OTP authenticates existing provisioned account only.
5. Apply duplicate/shared-mobile rules only if approved; otherwise flag for authorised review and never auto-merge.
6. Implement no-smartphone/assisted onboarding only as documented; do not invent verification/consent.
7. Mobile change only if approved workflow exists.

**Stakeholder workflows:** Approved staff create farmer; authorised staff provision login; farmer logs in after provisioning.

**UI:** FARMER-LIST, FARMER-FORM, FARMER-ACCOUNT and AUTH screens.

**API:** Farmer record route and separate account-provisioning route.

**DB:** Farmer/owner, user/account, provisioning and audit entities in final schema.

**Validation/edge cases:** Duplicate/shared mobile, no smartphone, wrong village, missing fields, public signup, OTP for nonexistent account.

**Expected outputs:** Farmer APIs/forms and tests.

**Acceptance criteria:** No public signup; record creation does not auto-create login; OTP cannot create records.

**Tests:** Provisioning separation and unauthorised access.

**Failure recovery:** Hold ambiguous duplicate records; no silent merge/overwrite.

**Memory update:** Record allowed creator roles/open decisions and next Stage 5.

---

## STAGE 5 — Animal registry and FW-first fallback

**Objective:** Implement animal identity and registration authority exactly.

**Prerequisites:** Stages 2–4.

**Exact tasks:**
1. Internal animal ID distinct from optional Bharat Pashudhan 12-digit tag.
2. FW is primary registrar in assigned village.
3. VO fallback only with explicit authorised FW-unavailability record and reason.
4. Enforce same rule for online API, imports, offline sync, retries and background jobs.
5. Implement duplicate identifier/QR checks and safe manual lookup if scan fails.
6. Implement animal detail/history and approved owner linkage.
7. Do not invent flock/group or lifecycle semantics not in approved sources.

**Stakeholder workflows:** FW primary; VO conditional fallback; other access only with explicit grant.

**UI:** ANIMAL-LIST, ANIMAL-FORM, ANIMAL-DETAIL, QR/identifier states.

**API:** Registration, identifier verification, details/history and approved correction routes.

**DB:** Animal, identifiers, owner link, FW availability evidence and audit entities.

**Validation/edge cases:** Duplicate/missing/damaged tag, FW available, missing/expired evidence, offline fallback, wrong owner.

**Expected outputs:** Registry APIs/UI and tests.

**Acceptance criteria:** External tag optional; internal ID distinct; VO fallback blocked without valid evidence.

**Tests:** Online, import and sync path tests.

**Failure recovery:** Preserve local draft; reject/hold invalid fallback rather than bypassing.

**Memory update:** Record enforcement across all ingestion paths and next Stage 6.

---

## STAGE 6 — Campaigns, FW assignments and camps

**Objective:** Separate campaign ownership, worker assignment and camp coordination.

**Prerequisites:** Stages 2–5.

**Exact tasks:**
1. DAHO creates/configures campaigns within assigned district.
2. VO assigns FWs within authorised villages.
3. Cooperative may propose/coordinate camps.
4. VO confirms/reschedules/rejects proposals according to APPFLOW.
5. Camp assignment never grants vaccinator authority.
6. Implement overlap/cancellation/no-show rules only when defined; otherwise flag for decision.
7. Audit campaign/camp transitions.

**Stakeholder workflows:** DAHO campaign owner; VO assigns and decides camps; cooperative proposes/coordinates.

**UI:** CAMPAIGN-LIST/FORM, CAMP-LIST/FORM, FW-ASSIGN.

**API:** Campaign CRUD/status, worker assignment, camp proposal/decision.

**DB:** Campaign, assignments, camp, status history and audit.

**Validation/edge cases:** SYS_ADMIN campaign attempt, VO config without grant, wrong village, cooperative self-approval, cancelled/overlapping camp.

**Expected outputs:** APIs, screens and tests.

**Acceptance criteria:** DAHO campaign ownership preserved; VO assignment scope enforced; camp does not imply vaccinator authority.

**Tests:** Campaign/camp RBAC and scope tests.

**Failure recovery:** Keep unresolved camp decision pending; no invented priority/reassignment.

**Memory update:** Record permissions and test outcomes; next Stage 7.

---

## STAGE 7 — Vaccine stock and vaccination records

**Objective:** Implement auditable stock movements and authorised vaccination events.

**Prerequisites:** Stages 2–6 and reviewed stock model.

**Exact tasks:**
1. Implement stock ledger using approved transaction types only.
2. Record actor/time/quantity/reason/reference/location fields as defined by final schema.
3. Use transaction-safe balance checks; reject invalid/negative balance.
4. Vaccination event requires separate vaccinator authorisation.
5. Vaccine batch number is optional.
6. Routine vaccination has no mandatory VO approval.
7. VO audit/correction requires explicit permission and reason; preserve history.
8. Do not invent doses/schedules/clinical constraints.

**Stakeholder workflows:** DAHO/authorised stock manager handles stock; separately authorised vaccinator records event; VO audits/corrects if granted.

**UI:** STOCK-DASH, STOCK-ENTRY, VACCINATION-FORM, ANIMAL-DETAIL.

**API:** Stock receipt/issue/approved adjustment; vaccination event and correction.

**DB:** Stock item/location/ledger, vaccination event and audit per final schema.

**Validation/edge cases:** Unauthorised stock edit, insufficient/concurrent stock, duplicate movement, missing reason, optional batch, camp-only actor.

**Expected outputs:** Inventory/vaccination APIs, UI and tests.

**Acceptance criteria:** Ledger traceable; no camp-implied authority; no mandatory VO approval; batch nullable.

**Tests:** Stock transaction, concurrency and vaccinator permission tests.

**Failure recovery:** Roll back invalid movements; never silently repair balances.

**Memory update:** Record stock model and vaccination permission; next Stage 8.

---

## STAGE 8 — Disease reports and veterinary review

**Objective:** Implement suspected reporting and authorised veterinary review.

**Prerequisites:** Stages 2–5 and approved report fields.

**Exact tasks:**
1. Implement permitted farmer/staff report submission and attachments.
2. Keep report suspected/pending until authorised review.
3. Implement review queue for explicit veterinary reviewer permission.
4. Keep review and confirmation grants distinct where required.
5. Store reviewer, decision, timestamp, reason and audit.
6. Do not implement automatic diagnosis, disease thresholds or outbreak confirmation.
7. Never represent no reports as disease-free.

**Stakeholder workflows:** Permitted reporter submits; authorised veterinary reviewer reviews/decides.

**UI:** DISEASE-REPORT, DISEASE-QUEUE, DISEASE-DETAIL.

**API:** Report, attachment, review/decision/history endpoints.

**DB:** Disease report, attachment, review, status history and audit.

**Validation/edge cases:** Duplicate report, missing fields according to approved requiredness, delayed/conflicting review, unauthorised confirmation, zero reports.

**Expected outputs:** APIs, UI and tests.

**Acceptance criteria:** No automatic confirmation; alerts are not diagnoses; reviewer permission enforced.

**Tests:** State-transition and unauthorised-confirmation tests.

**Failure recovery:** Keep pending/suspected; route conflict to authorised review.

**Memory update:** Record state model and next Stage 9.

---

## STAGE 9 — Ownership transfer and persistent notifications

**Objective:** Implement authorised transfer decisions and durable in-app notifications.

**Prerequisites:** Stages 2–5.

**Exact tasks:**
1. Submit ownership-transfer request.
2. Allow decision only to explicitly authorised role.
3. Keep owner unchanged until approval.
4. Record decision/reason/history.
5. Implement persistent in-app notifications and read/unread state.
6. SMS/WhatsApp simulated until approved credentials; in-app works independently.
7. Avoid sensitive data in notification previews.

**Stakeholder workflows:** Eligible requester submits; authorised decision-maker decides; recipient receives in-app notice.

**UI:** TRANSFER-REQUEST, TRANSFER-REVIEW, NOTIFY-LIST.

**API:** Transfer request/decision/history and notification create/list/read.

**DB:** Transfer request, decision, owner history, notification and delivery attempt.

**Validation/edge cases:** Conflicting requests, unauthorised self-approval, rejection, SMS failure, duplicate notification.

**Expected outputs:** APIs/screens/tests.

**Acceptance criteria:** Request does not change owner; decision audited; in-app notice persists on SMS failure.

**Tests:** Transfer and channel-failure tests.

**Failure recovery:** Keep pending requests; retry external delivery without duplicate in-app record.

**Memory update:** Record transfer/notification results; next Stage 10.

---

## STAGE 10 — Offline PWA and reliable sync

**Objective:** Implement approved offline operations without silent data loss.

**Prerequisites:** Core APIs/data models.

**Exact tasks:**
1. Implement PWA and Dexie/IndexedDB queue.
2. Define exact offline-supported actions from approved docs; do not assume all admin/approval actions are offline.
3. Implement seven-day default configurable offline authorisation.
4. Require online reauthentication after expiry; retain pending data.
5. Add idempotency keys, retry/backoff, acknowledgement tracking and conflict states.
6. Revalidate permissions, assignments and business rules server-side at sync.
7. Server cannot inspect unreceived payload; client retains it under approved recovery rules.
8. Warn before logout with pending sync; do not delete queue.
9. Test Android/PWA network and storage transitions.

**Stakeholder workflows:** Approved field users primarily; other offline actions only if explicitly approved.

**UI:** Offline banner, SYNC-QUEUE, pending count, conflict screen, logout warning.

**API:** Sync upload/acknowledgement/status.

**DB:** Sync/idempotency/audit metadata and domain tables.

**Validation/edge cases:** Expiry, partial sync, duplicate event, lost ACK, concurrent edit, second device, device loss, storage quota, dependency ordering, pending logout.

**Expected outputs:** Offline service, queue, sync API, recovery UI and tests.

**Acceptance criteria:** No silent deletion; retries idempotent; expired grant blocks new protected actions; pending data remains visible.

**Tests:** Offline expiry, partial sync, lost ACK, duplicate retry and Android/PWA tests.

**Failure recovery:** Preserve queue; quarantine only via approved process; never claim server reviewed unsent payload.

**Memory update:** Record supported actions, sync protocol and results; next Stage 11.

---

## STAGE 11 — Reports, maps, exports, privacy and security

**Objective:** Complete role-scoped reporting and security verification.

**Prerequisites:** Core workflows implemented.

**Exact tasks:**
1. Implement only approved metrics/report definitions.
2. Enforce scope on every report/map/export server-side.
3. Cooperative default is village-level aggregate overdue counts; no individual owner details.
4. Require explicit export permission and filter fields by role/scope.
5. Implement MapLibre only with authorised location data; provide list alternative.
6. Test input validation, output encoding, SQL injection resistance, session expiry, privilege escalation and audit.
7. Ensure reports/alerts are never labelled diagnosis/outbreak confirmation.
8. Review logs/notifications for sensitive-data leakage.

**Stakeholder workflows:** Every role sees only permitted data.

**UI:** Dashboards, reports, maps, export states and permission-denied states.

**API:** Scoped report/map/export endpoints.

**DB:** Approved reporting domains and audit/export records where schema supports them.

**Validation/edge cases:** Cross-scope, cooperative privacy, unauthorised export, stale assignment, malicious input, zero reports.

**Expected outputs:** Reports/maps, security tests and QA report.

**Acceptance criteria:** No scope leakage; export gated; no unsupported disease metrics/inference.

**Tests:** Direct API security tests and role matrix regression.

**Failure recovery:** Disable unsafe report/export rather than weakening permission checks.

**Memory update:** Record tests/findings and next Stage 12.

---

## STAGE 12 — Release candidate, documentation and handover

**Objective:** Produce a reproducible, verified release candidate and final package.

**Prerequisites:** Stages 0–11.

**Exact tasks:**
1. Run clean PostgreSQL 16 migrations and seed tests.
2. Run backend unit/integration tests and frontend lint/type/build/tests.
3. Run end-to-end regression for every workflow invariant.
4. Verify Gujarati UI on desktop, tablet and Android/PWA.
5. Verify offline expiry, pending logout, partial sync and lost acknowledgement.
6. Confirm unapproved government/SMS integrations are not active.
7. Complete README, implementation plan, edge catalogue, permission matrix, traceability and decision register.
8. Generate documentation PDFs and four prompt PDFs: Stages 0–3, 4–6, 7–9, 10–12.
9. Create final ZIP and manifest; verify each file exists and opens.
10. Record known limitations, pending approvals and exact commands/results.
11. Update handover with final paths and exact next action; mark complete only when evidence supports it.

**Stakeholder workflows:** Verify DAHO, VO, FW, cooperative, farmer, SYS_ADMIN and separately authorised vaccinator journeys.

**UI:** Verify screen catalogue/states; never claim screenshots not generated.

**API:** Full route, RBAC and scope regression.

**DB:** Final migrations, constraints, indexes and representative queries.

**Validation/edge cases:** Every edge case passed or explicitly blocked/pending.

**Expected outputs:** Release candidate, final docs, PDFs, ZIP, validation report and handover.

**Acceptance criteria:** Clean setup reproducible; every completion claim has evidence; pending approvals visible.

**Tests:** Record exact commands/environment/outcomes.

**Failure recovery:** Do not conceal failures; fix/rerun or mark incomplete with exact blocker.

**Memory update:** Record final artifact paths, test evidence, known issues and remaining work.

---

## Cross-stage mandatory regression tests

DAHO assigned-district enforcement; VO authorised-village assignment; FW-first/VO fallback evidence; farmer/account separation; OTP login-only; DAHO campaign ownership; cooperative camp/vaccinator separation; suspected/review/confirmation; transfer request/decision; in-app notification persistence; optional tag/batch; no mandatory VO vaccination approval; offline expiry/pending logout/partial sync/lost ACK; cooperative aggregate-only default; cross-scope denial; export permission.

## Definition of done for each stage

Code and tests saved; acceptance criteria individually checked; failures/limitations recorded; no workflow conflict introduced; `PROJECT_MEMORY_AI_HANDOVER.md` updated with files, migrations, decisions, exact test commands/results and exact next stage.
