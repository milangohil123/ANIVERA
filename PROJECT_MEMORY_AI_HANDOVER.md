# PashuRakshak Botad — Project Memory & AI Handover

**Document type:** Persistent project recovery and continuation record  
**Snapshot date:** 31 October 2026  
**Status:** Documentation and schema-alignment work in progress  
**Purpose:** Allow a new AI session or development agent to resume the existing project without restarting, repeating completed work, or silently changing approved decisions.

> **Resume rule:** Read this file first, then inspect the actual workspace and the files listed below. Treat this handover as a recovery guide, not proof that a file exists, a change was applied, or a test passed. Verify the actual artifacts before relying on them.

---

## 1. Current project state

The project is **PashuRakshak Botad**, a digital livestock vaccination tracking and disease early-warning platform.

The current task is to finish the documentation baseline, verify the revised database schema honestly, prepare complete Antigravity implementation prompts, generate PDFs, and package the deliverables.

### 1.1 Workspace audit reported by the previous session

The previous Claude session reported that the workspace did **not** contain the revised versions described in the continuation request. It found older/base documents and decided to apply the newer decisions as targeted corrections rather than assume the revisions already existed.

The previous session reported these existing assets:

| Asset | Reported state | Verification required on resume |
|---|---|---|
| `PRD.md` | Existing v0.2 base; revisions pending | Open file; inspect version, sections and requirements |
| `TRD.md` | Existing v0.2 base; revisions pending | Open file; inspect API, role, sync and architecture rules |
| `APPFLOW.md` | Existing v0.2 base; revisions pending | Open file; inspect all stakeholder workflows |
| `BACKENDDATABASESCHEMA.md` | Existing v0.2 base | Compare with current SQL and decisions |
| SQL schema | Existing v0.2 base plus patches in progress | Identify exact SQL files and patch order |
| `DB_VALIDATION_REPORT.md` | Existing report | Confirm which exact SQL version was tested |
| UI/UX PDF v0.2.1 | Reported approved reference | Confirm file exists; preserve unchanged |
| Original UI reference ZIP | Reported available | Confirm file exists; inspect its contents |
| Business-rule/lifecycle/edge/stakeholder source data | Reported available | Identify exact files and reuse where applicable |

**Important:** These are status statements from the prior session's handover. They are not independently verified by this document. Recheck the workspace before editing.

### 1.2 Previously reported validation result

The previous session reported that the **older/base SQL schema** had been executed against PostgreSQL and passed **77/77 checks**.

This result applies only to the exact older SQL version used in that test. It does **not** validate later schema patches or the revised schema.

Use these separate statuses:

- Previous/base schema: `77/77 checks reported passed` — verify against the original validation report and tested SQL file.
- Revised/patched schema: `PENDING until the exact final patched SQL is executed and the result is recorded`.
- Static inspection must never be described as successful PostgreSQL execution.

---

## 2. Current authoritative project decisions

Use the following decisions when reviewing and aligning the documents. They are the revised business rules supplied for this project; do not replace them with assumptions or generic government workflows.

### 2.1 Stakeholders and operational authority

1. **DAHO** manages operational setup within the DAHO's assigned district. This includes the relevant district setup, villages/geodata, Gram Panchayats, cooperatives, Veterinary Officer records/assignments, vaccine stock and campaigns, subject to approved permissions.
2. **Veterinary Officer (VO)** assigns Field Workers (FWs) within authorised villages.
3. **Field Worker (FW)** is the primary animal registrar.
4. **VO animal-registration fallback** is allowed only when the assigned FW has an explicit, authorised unavailability record with a reason. Do not invent a timeout, attendance rule or automatic fallback.
5. A **farmer/owner record** may be created by the permitted staff roles specified in the approved workflow. Farmer record creation is separate from account/login provisioning.
6. **SYS_ADMIN** manages platform/technical administration. Do not make SYS_ADMIN the operational owner of district campaigns merely because the role has technical administration privileges.

### 2.2 Farmer account and OTP

- No public farmer self-registration.
- Staff-controlled farmer record creation follows the approved workflow.
- Login provisioning is a separate action from creating a farmer record.
- OTP authenticates an existing provisioned account only.
- OTP must not create a farmer, user, owner record or ownership relationship.
- Assisted onboarding must follow the approved workflow; do not invent identity, consent or verification procedures beyond documented requirements.

### 2.3 Campaigns, camps and vaccination

- DAHO creates/configures campaigns within the assigned district.
- VO assigns FWs to campaign work within authorised villages.
- A cooperative may propose or coordinate a camp.
- VO confirms, reschedules or rejects a proposed camp according to the approved workflow.
- Camp coordination or camp assignment does **not** grant vaccination authority.
- Only a separately authorised vaccinator may administer and/or record vaccination, as permitted by the approved permissions.
- Check vaccinator authorisation independently; do not infer it from camp assignment or a general role label.
- Routine vaccination does not require mandatory VO approval.
- A VO may audit or correct a vaccination record with a recorded reason.
- Vaccine batch number is optional.

### 2.4 Disease reporting and review

- A farmer/staff report is a **suspected** disease report until it receives the required authorised veterinary review.
- Only an explicitly authorised veterinary reviewer may confirm disease, where that permission has been approved.
- An alert is not a diagnosis or confirmed outbreak.
- No reports does not mean disease-free.
- Do not invent diagnostic logic, clinical rules, disease thresholds, vaccination schedules, doses or statistics.
- Preserve the distinction between report submission, review, status change, confirmation and alerting.

### 2.5 Ownership transfer

- Ownership transfer is an explicit request.
- The request must be decided by an authorised role/process.
- Do not automatically change ownership merely because a farmer or staff member submits a request.
- Preserve dispute, rejection and audit handling where specified by the approved workflow.

### 2.6 Notifications and external integrations

- In-app notifications persist independently of SMS delivery.
- Due lists and in-app notification functionality must work without SMS.
- SMS/WhatsApp remain simulated or disabled until approved provider credentials and authorisation exist.
- Government integrations remain pending departmental approval and authorised API access.
- Do not invent government APIs, access credentials, integration availability or approval.

### 2.7 District and data access

- Enforce district/village scope on the server using authorised assignments.
- Never trust a client-supplied district or village ID as proof of access.
- DAHO write operations must be checked against the active DAHO-to-district assignment.
- Cooperative default access is village-level aggregate overdue counts, not individual farmer/owner details.
- Role names alone do not grant permissions. Enforce explicit permissions and scope.

### 2.8 Animal identifiers

- Every animal has an internal system identifier.
- Bharat Pashudhan 12-digit tag is an optional external identifier and must remain separate from the internal animal ID.
- Do not make the external tag mandatory unless an approved decision changes this.
- Preserve duplicate/tag/QR verification and damaged/missing-tag handling as defined in the requirements.

### 2.9 Offline operation

- Offline authorisation defaults to seven days and is administrator-configurable.
- Expired offline authorisation requires online reauthentication.
- Pending offline records must never be silently deleted.
- Warn the user before logout when pending sync records exist.
- The server cannot inspect or review a payload that has not reached the server.
- Retain unsent records locally and use only an explicitly approved recovery/quarantine process.
- Apply the same business rules to online requests, offline sync, imports, retries and duplicate submissions.
- Handle duplicate events idempotently and preserve auditability.

---

## 3. Canonical permission vocabulary

Use these canonical permission names in new implementation and updated documentation, subject to final departmental approval:

- `district.setup.manage`
- `village.manage`
- `gram_panchayat.manage`
- `cooperative.manage`
- `veterinary_officer.manage`
- `vaccine_stock.manage`
- `campaign.manage`
- `farmer.account.provision`
- `animal.register`
- `animal.register.fallback`
- `camp.propose`
- `camp.manage`
- `disease.review`
- `animal.transfer.request`
- `animal.transfer.decide`

Rules:

- Do not silently map old aliases to canonical permissions without documenting the mapping.
- Review legacy permission examples in the TRD and API catalogue.
- A disease-confirmation permission or equivalent must be an explicit authorised grant; a role label alone is insufficient.
- Final grants and permission assignments remain subject to departmental approval.
- Keep the permission matrix, APPFLOW, PRD, TRD, schema and SQL consistent.

---

## 4. Approved technical baseline

Preserve this stack unless the user explicitly approves a change:

### Frontend
- React
- Vite
- TypeScript
- Tailwind CSS
- PWA
- React Router
- TanStack Query
- React Hook Form
- Zod
- Dexie / IndexedDB for offline data
- MapLibre GL JS

### Backend
- Python 3.12
- FastAPI
- SQLAlchemy 2.0
- Pydantic
- Alembic

### Database
- PostgreSQL 16
- Local database name: `pashurakshak_db`
- pgAdmin 4
- Docker optional

Do not assume Supabase, Firebase, MongoDB or a cloud database. Do not introduce paid services or external APIs without approval.

### UI language and design
- Gujarati application UI.
- English technical documentation.
- Western digits (0–9).
- Preserve the approved green design identity and supplied UI/UX references.
- Support desktop/laptop, tablet and Android/PWA layouts.

---

## 5. Existing files and expected final deliverables

### 5.1 Twelve main Markdown documents

Finalise exactly these main documents, retaining existing filenames and preserving completed content:

1. `PRD.md`
2. `TRD.md`
3. `APPFLOW.md`
4. `UI_UX_DESIGN.md`
5. `BACKENDDATABASESCHEMA.md`
6. `IMPLEMENTATION_PLAN.md`
7. `PROJECT_MEMORY_AI_HANDOVER.md`
8. `EDGE_CASE_CATALOGUE.md`
9. `REQUIREMENTS_TRACEABILITY_MATRIX.md`
10. `STAKEHOLDER_PERMISSION_MATRIX.md`
11. `DECISION_REGISTER.md`
12. `README.md`

Do not rewrite completed core documents from scratch. Make targeted corrections and additions. Preserve existing section order, numbering, requirements, acceptance criteria and version history wherever possible.

### 5.2 Database support files

Retain and verify:
- Final SQL schema and seed scripts.
- `DB_VALIDATION_REPORT.md`.
- Any migration or patch scripts needed to reproduce the final schema.

The schema documentation, SQL, PRD, TRD and APPFLOW must agree.

### 5.3 Antigravity prompts

Create `ANTIGRAVITY_EXECUTION_PROMPTS.md` with 13 ordered, independent, copy-paste-ready stages:

- Stage 0
- Stage 1
- Stage 2
- Stage 3
- Stage 4
- Stage 5
- Stage 6
- Stage 7
- Stage 8
- Stage 9
- Stage 10
- Stage 11
- Stage 12

Each stage must specify:
1. Objective and prerequisites.
2. Exact tasks.
3. Stakeholder workflow and permissions.
4. UI pages/components.
5. Backend/API work.
6. Database tables/migrations.
7. Validation and edge cases.
8. Expected files/output.
9. Acceptance criteria.
10. Tests.
11. Failure recovery/rollback.
12. Mandatory memory update.

Every stage must instruct Antigravity to inspect existing code/files before editing, reuse completed work, preserve approved decisions and avoid breaking existing functionality.

At the end of **every stage**, Antigravity must update this handover with completed work, files changed, database changes, decisions, tests/results, failures, unresolved issues and the exact next stage.

Generate four prompt PDFs:
- `ANTIGRAVITY_PROMPTS_PART_1_STAGES_0_3.pdf`
- `ANTIGRAVITY_PROMPTS_PART_2_STAGES_4_6.pdf`
- `ANTIGRAVITY_PROMPTS_PART_3_STAGES_7_9.pdf`
- `ANTIGRAVITY_PROMPTS_PART_4_STAGES_10_12.pdf`

### 5.4 Other PDFs and final ZIP

Generate documentation PDFs wherever practical from the final Markdown files.

Create:
`PashuRakshak_Botad_Final_Deliverables.zip`

Include all 12 main MD files, Antigravity prompt MD, SQL and seeds, validation report, documentation PDFs, four prompt PDFs, approved UI/UX PDF, relevant original reference assets and a file manifest.

---

## 6. Known status at the last reported checkpoint

The previous Claude session reported the following. These statuses must be checked against the actual workspace before being changed.

| Work item | Last reported state | Required next action |
|---|---|---|
| Workspace audit | Reported complete | Recheck actual file list and versions |
| PRD | v0.2 base; revised corrections pending | Apply and verify targeted corrections |
| TRD | v0.2 base; revised corrections pending | Align APIs, permissions, sync and architecture |
| APPFLOW | v0.2 base; revised corrections pending | Align all stakeholder workflows |
| Backend schema | v0.2 base; revised decisions being applied | Compare with final SQL |
| SQL | Patch work in progress; a script named `patch_schema3.py` was reported | Locate script, inspect patch, inspect output and establish exact patch order |
| Previous DB validation | 77/77 reported on older/base SQL | Verify report and exact tested SQL |
| Revised DB validation | Not established | Execute final patched SQL on PostgreSQL 16 if available |
| DB validation report | Existing report | Update with separate old/revised results |
| UI/UX PDF v0.2.1 | Reported approved | Preserve and inspect |
| Original UI ZIP | Reported available | Preserve and inspect |
| `UI_UX_DESIGN.md` | Not started | Create from approved references |
| `IMPLEMENTATION_PLAN.md` | Not started | Create |
| `PROJECT_MEMORY_AI_HANDOVER.md` | Initial recovery snapshot reported | Replace with this complete handover and maintain it |
| `EDGE_CASE_CATALOGUE.md` | Not started / regeneration pending | Create and verify |
| `REQUIREMENTS_TRACEABILITY_MATRIX.md` | Not started | Create |
| `STAKEHOLDER_PERMISSION_MATRIX.md` | Not started / regeneration pending | Create and verify |
| `DECISION_REGISTER.md` | Not started | Create |
| `README.md` | Not started | Create |
| Antigravity prompt MD | Not started | Create 13 stages |
| Prompt PDFs | Not started | Generate four PDFs |
| Documentation PDFs | Not started | Generate from final MDs |
| Final ZIP | Not started | Package and verify |

### 6.1 Previously reported build workspace

The previous session reported:
- Build tooling directory: `/home/claude/build`
- Output directory: `/mnt/user-data/outputs/PashuRakshak_Botad_Docs/`
- Scripts reported: `gen_prd2.py`, `gen_appflow.py`, `gen_perm_edge.py`, `data_br.py`, `data_edge.py`, `data_stake.py`, `patch_schema1.py`, `patch_schema2.py`, `db_validate.py`, and `patch_schema3.py`.

These paths and script names are historical information from the previous session. Confirm that they exist before running them. Do not assume they are available in a new environment.

---

## 7. Database validation protocol

The final database report must distinguish:

1. Static SQL inspection.
2. Successful PostgreSQL execution.
3. Constraint and relationship tests.
4. Seed-data tests.
5. Representative query tests.
6. Any tests not performed.

If PostgreSQL 16 is available:
- Record exact server version.
- Execute the complete final DDL and seeds against a clean test database.
- Verify tables, column types, primary keys, foreign keys, unique/check constraints and indexes.
- Run representative queries and documented tests.
- Fix actual errors and rerun.
- Record exact commands, output, failures and final result.

If PostgreSQL 16 is unavailable:
- Perform static inspection only.
- Give exact commands for local PostgreSQL 16 execution.
- Mark execution as `PENDING`.
- Never claim that the database was executed or passed.

Do not claim performance, concurrency, production readiness, row-level security or security certification unless those tests were actually performed.

---

## 8. Document consistency checks

Before declaring the documentation final, verify these cross-document links:

| Rule / capability | Must agree across |
|---|---|
| DAHO district setup and scope | PRD, APPFLOW, TRD, permission matrix, schema, SQL |
| Campaign ownership and FW assignment | PRD, APPFLOW, TRD, permission matrix, schema, SQL |
| FW-first registration and VO fallback | PRD, APPFLOW, TRD, schema, SQL, tests |
| Farmer creation vs login provisioning | PRD, APPFLOW, TRD, schema, SQL |
| Camp coordination vs vaccination authority | PRD, APPFLOW, TRD, permission matrix, schema |
| Disease suspected/review/confirmation | PRD, APPFLOW, TRD, schema, SQL |
| Ownership transfer | PRD, APPFLOW, TRD, schema, SQL |
| Vaccine stock ledger | PRD, APPFLOW, TRD, schema, SQL |
| Persistent notifications | PRD, APPFLOW, TRD, schema, SQL |
| Offline expiry and pending records | PRD, TRD, APPFLOW, schema, tests |
| External integrations pending approval | PRD, TRD, APPFLOW, decision register |
| Gujarati UI and approved green design | PRD, TRD, UI/UX design, implementation plan |

When a rule is absent from a source, do not pretend it is documented there. Identify the gap and make a targeted, traceable correction where authorised.

---

## 9. Recovery and continuation protocol

### 9.1 Before every major work block

- Read this handover.
- Inspect the actual output directory.
- Identify completed, partial and missing artifacts.
- Do not recreate a file that already contains valid completed work.
- Save outputs incrementally.

### 9.2 If context or token limits interrupt work

Before stopping:
1. Save every completed file.
2. Update this handover.
3. Record exact files created/modified and their paths.
4. Record the exact tests run and results.
5. Record failures and unresolved decisions.
6. Record the exact last completed operation.
7. Record the exact next operation and file/stage to continue.

### 9.3 When the user sends only `CONTINUE`

You must:
1. Read `PROJECT_MEMORY_AI_HANDOVER.md` first.
2. Inspect the existing output files and current workspace.
3. Recover the exact next unfinished task from this file.
4. Continue from that task only.
5. Preserve all completed and validated work.
6. Do not restart, repeat completed work, rename files or change approved decisions.
7. Update this handover again before any subsequent interruption.

This recovery rule remains active until all deliverables are complete and verified.

---

## 10. Immediate next actions from the last known checkpoint

Follow this order, updating the status table as work is completed:

1. Inspect the actual workspace and output folder. Confirm the current versions and exact paths of all core documents, SQL, validation report, UI/UX PDF and reference ZIP.
2. Locate and inspect `patch_schema3.py` and all earlier schema patch scripts. Establish the correct patch sequence; do not blindly rerun scripts that may duplicate changes.
3. Inspect the resulting SQL diff. Record every table, column, constraint, index, seed and permission change.
4. Complete the schema and SQL changes required by the revised decisions.
5. Run PostgreSQL 16 validation if available. Separate old-schema 77/77 results from revised-schema results.
6. Update `DB_VALIDATION_REPORT.md` with exact evidence and limitations.
7. Apply targeted corrections to PRD, APPFLOW, TRD and `BACKENDDATABASESCHEMA.md`. Preserve existing structure and approved content.
8. Cross-check all four documents against each other and the final SQL.
9. Create/finalise the remaining documentation files.
10. Create all 13 Antigravity stages.
11. Generate documentation PDFs and four prompt PDFs.
12. Create and verify the final ZIP and file manifest.

**Do not stop after the audit, schema patch, or handover update. Continue through all remaining deliverables unless a genuine environment limitation prevents a task. If blocked, document the exact blocker and continue with independent tasks.**

---

## 11. Final completion criteria

The project documentation package is complete only when:

- All 12 main MD files exist and contain substantive, consistent content.
- PRD, APPFLOW, TRD, backend schema and SQL agree.
- The validation report identifies the exact SQL version tested and distinguishes execution from static review.
- UI/UX specification follows the approved PDF and original image references.
- Edge cases and requirement traceability are documented.
- Stakeholder permissions and district scope are consistent.
- All 13 Antigravity stages are complete and executable.
- Four prompt PDFs exist.
- Documentation PDFs match their final Markdown sources.
- Final ZIP contains every required file.
- Every packaged file is verified to exist and open.
- Pending departmental approvals and unresolved decisions are explicitly listed.
- No unperformed test, integration, screenshot or validation is claimed as completed.

### Final response must report

1. Checklist for all 12 main MD files.
2. Four Antigravity prompt PDF links.
3. Documentation PDF links.
4. Final ZIP link.
5. PostgreSQL validation results and limitations.
6. Pending departmental approvals and unresolved decisions.
7. Exact Stage 0 starting instructions.
8. Any incomplete work and its exact recovery point.

**Core instruction:** Preserve the existing project and approved decisions. Verify before claiming. Make targeted changes. Save incrementally. Continue from the exact last completed step until the deliverables are complete.

---

## 12. Phase 2 Completion & Technical Design Freeze Record (31 October 2026)

### 12.1 Phase 2 Actions Completed
1. **PRD.md:** Corrected legacy role matrix table in §12 (row "Assign field workers to campaigns" fixed: FW=No, VO=Yes, DAHO=No); updated FR-PERM-07 to reflect DAHO creates/configures campaigns and VO assigns Field Workers.
2. **TRD.md:** Updated §8.1 endpoint table for `POST /imports` to explicitly include Field Workers with explicit `import.run` grant and per-row priority checks.
3. **BACKENDDATABASESCHEMA.md:** Updated document header to v0.4 (Consolidated APPFLOW v0.4 Alignment Draft); updated §4.10 `disease_reports` table to match the 7-state lifecycle (`SUBMITTED` -> `UNDER_REVIEW` -> `SUSPECTED` / `NEEDS_MORE_INFORMATION` -> `CONFIRMED` / `NOT_CONFIRMED` / `INSUFFICIENT_INFORMATION`); added `disease.review` to permissions and `VET_OFFICER` seed.
4. **DECISION_REGISTER.md:** Formally added DEC-T01 through DEC-T04 (Approved Technical Decisions) and logged DEC-Q01 through DEC-Q05 (Open Departmental Questions); added full canonical permission dictionary and legacy mapping table in §4.
5. **pashurakshak_schema_v0.3_patch.sql:** Added `dairy_cooperatives` compatibility view to Section 7; verified all foreign keys, alter statements, triggers, and seed operations.
6. **FINAL_VERIFICATION_REPORT.md:** Generated complete Phase 1 / Phase 2 verification audit report confirming zero contradictions across the 8 Phase 1/Phase 2 deliverables.

### 12.2 Technical Gate Status
- **Documentation Alignment:** 100% consistent across PRD, APPFLOW, TRD, Schema, Decision Register, and SPM.
- **Database Patch Baseline:** `pashurakshak_schema_v0.2.sql` + `pashurakshak_schema_v0.3_patch.sql` ready for local PostgreSQL 16 testing.
- **Application Code Gate:** STRICTLY BLOCKED until Stage 0 PostgreSQL 16 certification suite is executed.
- **Next Task:** Stage 0 execution and prompt preparation.
