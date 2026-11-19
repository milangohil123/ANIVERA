# PashuRakshak Botad — Decision Review Report
**Project:** PS000195 · **Name:** PashuRakshak Botad · **Date:** 31 October 2026  
**Document:** Phase 1 Consistency & Decision Audit · **Status:** Awaiting Stakeholder Review (Phase 1 Analysis Only)  
**Authoritative Baseline:** `APPFLOW.md` v0.4, `DECISION_REGISTER.md` (DEC-001..032), `STAKEHOLDER_PERMISSION_MATRIX.md`

> [!IMPORTANT]
> This review evaluates all 18 entries in `WORKFLOW_CONFLICTS.md` against established project decisions and technical source code (`pashurakshak_schema_v0.2.sql` vs `BACKENDDATABASESCHEMA.md` v0.3).
> **No database execution was performed** (no PostgreSQL 16 environment present). Original SQL has not been overwritten.

---

## 1. Classification Scheme
- **A — Baseline-established correction:** The approved project documents (`APPFLOW.md` v0.4, `DECISION_REGISTER.md`, `STAKEHOLDER_PERMISSION_MATRIX.md`) already define the rule.
- **B — Technical correction:** The intended workflow is clear, but implementation requires safe schema alignment, foreign key correction, or vocabulary mapping.
- **C — Stakeholder approval required:** The documents do not establish an answer, or conflicting policy decisions exist.
- **D — Documentation clarification:** System behavior is established, but wording, version labels, or comments are ambiguous.
- **E — False positive / resolved:** Inspection of actual source files confirms the conflict does not exist or has already been satisfied.

---

## 2. Decision-by-Decision Evaluation of 18 Conflicts

### CONFLICT-01: Farmer Self-Registration Setting Contradicts Workflow Rule 7
- **Source File & Line:** `pashurakshak_schema_v0.2.sql` line 1307; `farmers` table line 196.
- **Actual Evidence:**
  ```sql
  INSERT INTO system_settings(key,value) VALUES ('farmer_self_registration_enabled','true');
  -- and farmers table:
  registration_path text NOT NULL CHECK (registration_path IN ('SELF','STAFF_ASSISTED','IMPORT','COOPERATIVE_ASSISTED'))
  ```
- **Authoritative Requirement:** `APPFLOW.md` Rule 1 & Workflow B ("No public signup, farmer self-registration or farmer-created account"); `DECISION_REGISTER.md` DEC-011 ("No public farmer self-registration"); `STAKEHOLDER_PERMISSION_MATRIX.md` §3 ("Farmer: No public signup").
- **Classification:** **A — Baseline-established correction**.
- **Recommended Action:**
  1. In SQL patch, set `farmer_self_registration_enabled` to `'false'`.
  2. In `farmers` (or `owners`) table DDL, remove `'SELF'` from `registration_path` CHECK constraint.
  3. Ensure no public signup route exists in API specification (`TRD.md`).
- **Affected Files:** `pashurakshak_schema_v0.2.sql`, `pashurakshak_schema_v0.3_patch.sql`, `BACKENDDATABASESCHEMA.md`, `TRD.md`.
- **Approval Needed:** YES (requires formal approval to modify DDL constraints and seed data).
- **Required Tests:** `T-AUTH-003` (verify public signup API returns 404/403), `T-REG-SELF` (verify DB rejects `registration_path = 'SELF'`).

---

### CONFLICT-02: Campaign Creator Role Assigned to SYS_ADMIN Instead of DAHO
- **Source File & Line:** `pashurakshak_schema_v0.2.sql` line 631 comment, lines 1293–1295 seed.
- **Actual Evidence:**
  ```sql
  -- SQL v0.2 line 631:
  created_by uuid NOT NULL REFERENCES users(id), -- System Administrator only (service-enforced)
  -- SQL v0.2 line 1293:
  ('SYS_ADMIN','campaign.configure'),('SYS_ADMIN','campaign.assign_workers')
  ```
- **Authoritative Requirement:** `APPFLOW.md` Workflow A step 7, Workflow D step 1 ("DAHO creates campaign"); `DECISION_REGISTER.md` DEC-012; `STAKEHOLDER_PERMISSION_MATRIX.md` ("Create/configure campaign: DAHO Default assigned district; SYS_ADMIN No by default").
- **Classification:** **A — Baseline-established correction**.
- **Recommended Action:**
  1. Revoke `campaign.configure` and `campaign.assign_workers` from `SYS_ADMIN` in default seed.
  2. Grant `campaign.configure` and `campaign.manage` to `DAHO` in role seed (already aligned in `BACKENDDATABASESCHEMA.md` §5).
  3. Update table comment on `campaigns.created_by` to reference DAHO.
- **Affected Files:** `pashurakshak_schema_v0.2.sql`, `pashurakshak_schema_v0.3_patch.sql`, `TRD.md`.
- **Approval Needed:** YES (role seed correction).
- **Required Tests:** `T-CAMP-001` (DAHO creates campaign in assigned district succeeds), `T-CAMP-002` (SYS_ADMIN blocked from creating campaign).

---

### CONFLICT-03: PRD §12 Legacy Role Matrix Shows FW Assigns Workers to Campaigns
- **Source File & Line:** `PRD.md` §12 legacy table row "Assign field workers to campaigns".
- **Actual Evidence:** Table cell shows FW = Yes, DAHO = No, VO = Yes.
- **Authoritative Requirement:** `APPFLOW.md` Workflow D & Corrections Table in `PRD.md` §12; `DECISION_REGISTER.md` DEC-006, DEC-012; `STAKEHOLDER_PERMISSION_MATRIX.md` §3 ("Assign FW: VO Default, FW No, DAHO Not default action").
- **Classification:** **A — Baseline-established correction**.
- **Recommended Action:** Update `PRD.md` §12 legacy table cell: FW = No, VO = Yes, DAHO = No (with footnote referencing APPFLOW v0.4).
- **Affected Files:** `PRD.md` §12.
- **Approval Needed:** YES (PRD is a controlled document).
- **Required Tests:** `T-SCOPE-002` (FW attempting campaign worker assignment returns 403).

---

### CONFLICT-04: TRD `POST /imports` Endpoint Permission Lists VO Only
- **Source File & Line:** `TRD.md` §8.1 endpoint table for `POST /imports`.
- **Actual Evidence:** Permission column lists `VET_OFFICER` only.
- **Authoritative Requirement:** `APPFLOW.md` Workflow J ("Field Worker is the primary import actor for village data; VO may import as fallback with an explicit FW-unavailability record"); `STAKEHOLDER_PERMISSION_MATRIX.md` §3 notes `import.run` is available to FW as an explicit grant.
- **Classification:** **B — Technical correction**.
- **Recommended Action:** Update `TRD.md` §8.1 to state: `VET_OFFICER` (default), `FIELD_WORKER` (if explicitly granted `import.run`); per-row FW-first priority check enforced.
- **Affected Files:** `TRD.md` §8.1.
- **Approval Needed:** YES (API contract documentation update).
- **Required Tests:** `T-IMP-001` (FW with `import.run` grant imports for assigned village), `T-IMP-002` (VO fallback blocked if assigned FW is available).

---

### CONFLICT-05: Schema Document Header Version Mismatch (v0.3 vs v0.4)
- **Source File & Line:** `BACKENDDATABASESCHEMA.md` line 2 vs `DB_VALIDATION_REPORT.md` title.
- **Actual Evidence:** `BACKENDDATABASESCHEMA.md` header says "Version: v0.3 APPFLOW-aligned consolidated draft", while §14 review and `DB_VALIDATION_REPORT.md` refer to v0.4.
- **Authoritative Requirement:** Document metadata consistency. The content is aligned with `APPFLOW.md` v0.4.
- **Classification:** **D — Documentation clarification**.
- **Recommended Action:** Update header in `BACKENDDATABASESCHEMA.md` to: "Version: v0.4 (Consolidated APPFLOW v0.4 Alignment Draft)" and update changelog.
- **Affected Files:** `BACKENDDATABASESCHEMA.md`.
- **Approval Needed:** NO (editorial clarification).
- **Required Tests:** None.

---

### CONFLICT-06: Permission Vocabulary: `animal.create` vs `animal.register`
- **Source File & Line:** `pashurakshak_schema_v0.2.sql` line 1253; `BACKENDDATABASESCHEMA.md` §5; `STAKEHOLDER_PERMISSION_MATRIX.md` §2.
- **Actual Evidence:** SQL v0.2 and Schema v0.3 use `animal.create` / `animal.create.fallback`. Matrix and Decision Register use `animal.register` / `animal.register.fallback`.
- **Authoritative Requirement:** `DECISION_REGISTER.md` DEC-031 ("Canonical permission vocabulary used for new implementation. Legacy aliases need mapping").
- **Classification:** **B — Technical correction**.
- **Recommended Action:** Retain `animal.register` as the canonical capability name in requirements and API contracts. In database seed, adopt `animal.register` (and `animal.register.fallback`) for forward consistency, and provide backward-compatible aliases if needed.
- **Affected Files:** `pashurakshak_schema_v0.3_patch.sql`, `BACKENDDATABASESCHEMA.md` §5, `DECISION_REGISTER.md` §4.
- **Approval Needed:** YES (permission seed change).
- **Required Tests:** `T-AUTH-PERM-001` (FW assigned `animal.register` passes registration gate).

---

### CONFLICT-07: SQL v0.2 Missing 10 Key Architectural Tables
- **Source File & Line:** `pashurakshak_schema_v0.2.sql` (entire file).
- **Actual Evidence:** Tables defined in `BACKENDDATABASESCHEMA.md` v0.3 but completely absent from `pashurakshak_schema_v0.2.sql`:
  1. `districts`
  2. `daho_district_assignments`
  3. `gram_panchayats`
  4. `gram_panchayat_villages`
  5. `gram_panchayat_staff_assignments`
  6. `field_worker_availability_records`
  7. `veterinary_officer_profiles`
  8. `vaccine_products`
  9. `vaccine_stock_lots`
  10. `vaccine_stock_transactions`
  Also missing: foreign keys on `talukas.district_id` and `villages.district_id`.
- **Authoritative Requirement:** `APPFLOW.md` Workflows A, C, D; `DECISION_REGISTER.md` DEC-005, DEC-008.
- **Classification:** **B — Technical correction**.
- **Recommended Action:** Prepare additive `pashurakshak_schema_v0.3_patch.sql` containing DDL for the 10 missing tables and FK alterations in strict topological order. Do NOT overwrite v0.2 SQL. Label patch as unvalidated until PostgreSQL 16 run.
- **Affected Files:** `pashurakshak_schema_v0.3_patch.sql`, `SQL_SCHEMA_GAP_ANALYSIS.md`.
- **Approval Needed:** YES (DDL patch creation).
- **Required Tests:** PostgreSQL 16 migration-up test on clean schema.

---

### CONFLICT-08: Reported Missing `ownership_transfers` Table
- **Source File & Line:** `pashurakshak_schema_v0.2.sql` lines 387–409.
- **Actual Evidence:** `CREATE TABLE ownership_transfers` exists in full with constraints, audit columns, and partial unique index `uq_open_transfer`.
- **Authoritative Requirement:** `APPFLOW.md` Workflow L; `DECISION_REGISTER.md` DEC-022.
- **Classification:** **E — False positive / resolved**.
- **Recommended Action:** Mark as resolved / verified present. No code changes.
- **Affected Files:** `WORKFLOW_CONFLICTS.md`.
- **Approval Needed:** NO.
- **Required Tests:** Verify existing SQL syntax.

---

### CONFLICT-09: Reported Missing `disease.review` in `VET_OFFICER` Seed
- **Source File & Line:** `pashurakshak_schema_v0.2.sql` line 1280 vs `BACKENDDATABASESCHEMA.md` line 1402.
- **Actual Evidence:**
  - In `pashurakshak_schema_v0.2.sql` line 1280: `('VET_OFFICER','disease.review')` IS present.
  - In `BACKENDDATABASESCHEMA.md` line 1402: `disease.review` was inadvertently replaced by `disease.report` only.
- **Authoritative Requirement:** `APPFLOW.md` Workflow G step 2; `STAKEHOLDER_PERMISSION_MATRIX.md` §3 ("Review suspected disease: VO disease.review").
- **Classification:** **A — Baseline-established correction**.
- **Recommended Action:** Update `BACKENDDATABASESCHEMA.md` §5 role seed to restore `('VET_OFFICER','disease.review')`. Ensure SQL v0.3 patch includes it.
- **Affected Files:** `BACKENDDATABASESCHEMA.md`, `pashurakshak_schema_v0.3_patch.sql`.
- **Approval Needed:** YES.
- **Required Tests:** `T-DIS-002` (VO opens and reviews disease report).

---

### CONFLICT-10: `farmer.account.provision` Missing from Permissions Seed
- **Source File & Line:** `pashurakshak_schema_v0.2.sql` lines 1252–1272.
- **Actual Evidence:** In SQL v0.2, `farmer.account.provision` is not inserted into `permissions` table, but is referenced in `role_permissions` in schema draft. If executed, foreign key constraint would fail.
- **Authoritative Requirement:** `APPFLOW.md` Workflow B step 7; `DECISION_REGISTER.md` DEC-009, DEC-010; `STAKEHOLDER_PERMISSION_MATRIX.md` §2.
- **Classification:** **B — Technical correction**.
- **Recommended Action:** Add `('farmer.account.provision', 'Provision/link/activate login account for an existing farmer profile')` to `permissions` seed in patch.
- **Affected Files:** `pashurakshak_schema_v0.3_patch.sql`, `BACKENDDATABASESCHEMA.md`.
- **Approval Needed:** YES.
- **Required Tests:** Referential integrity seed validation.

---

### CONFLICT-11: DAHO Lacks `campaign.configure` in Role Seed
- **Source File & Line:** `pashurakshak_schema_v0.2.sql` lines 1290–1291.
- **Actual Evidence:** DAHO seed in v0.2 SQL contains: `aggregate.view`, `map.view`, `campaign.view`, `disease.review`, `vaccinator.approve`, `export.run`, `audit.read_summary`. Missing `campaign.configure`.
- **Authoritative Requirement:** `APPFLOW.md` Workflow A step 7, Workflow D; `DECISION_REGISTER.md` DEC-012; `STAKEHOLDER_PERMISSION_MATRIX.md` §3.
- **Classification:** **A — Baseline-established correction**.
- **Recommended Action:** Add `('DAHO', 'campaign.configure')` and `('DAHO', 'campaign.manage')` to `role_permissions` in patch. (Already present in `BACKENDDATABASESCHEMA.md` §5).
- **Affected Files:** `pashurakshak_schema_v0.3_patch.sql`.
- **Approval Needed:** YES.
- **Required Tests:** `T-CAMP-001`.

---

### CONFLICT-12: DAHO District-Scoped Operational Administration vs SYS_ADMIN
- **Source File & Line:** `pashurakshak_schema_v0.2.sql` line 1290 vs `BACKENDDATABASESCHEMA.md` line 1410.
- **Actual Evidence:** In SQL v0.2, DAHO has no district management permissions. In `BACKENDDATABASESCHEMA.md` v0.3, DAHO is granted specific scoped capabilities: `district.setup.manage`, `village.manage`, `gram_panchayat.manage`, `cooperative.manage`, `veterinary_officer.manage`, `vaccine_stock.manage`.
- **Authoritative Requirement:** `APPFLOW.md` Workflow A; `DECISION_REGISTER.md` DEC-005; `STAKEHOLDER_PERMISSION_MATRIX.md` §1 & §3.
- **Classification:** **A — Baseline-established correction**.
- **Recommended Action:** Apply the granular district permissions from `BACKENDDATABASESCHEMA.md` v0.3 into the SQL v0.3 patch. Enforce backend middleware checking `daho_district_assignments`. Do not grant global `user.manage` or `config.manage` to DAHO.
- **Affected Files:** `pashurakshak_schema_v0.3_patch.sql`, `TRD.md`.
- **Approval Needed:** YES.
- **Required Tests:** `T-SCOPE-DAHO-001` (DAHO manages villages in assigned district), `T-SCOPE-DAHO-002` (DAHO denied access to other district).

---

### CONFLICT-13: Camp Staff Assignment vs Vaccination Authorisation
- **Source File & Line:** `pashurakshak_schema_v0.2.sql` line 710 comment; `BACKENDDATABASESCHEMA.md` line 851.
- **Actual Evidence:** SQL explicitly notes: `camp_staff: who is expected at the camp (assignment is NOT authorisation to vaccinate)`. `vaccinator_authorizations` is a separate table with approval references.
- **Authoritative Requirement:** `APPFLOW.md` Workflow D & M; `DECISION_REGISTER.md` DEC-014, DEC-015.
- **Classification:** **E — False positive / resolved**.
- **Recommended Action:** Confirmed compliant across all documents. Mark as verified consistent.
- **Affected Files:** `WORKFLOW_CONFLICTS.md`.
- **Approval Needed:** NO.
- **Required Tests:** `T-VAX-AUTH-001` (camp coordinator without vaccinator authorisation blocked from recording event).

---

### CONFLICT-14: Vaccine Batch Number Optionality
- **Source File & Line:** `pashurakshak_schema_v0.2.sql` line 453; `BACKENDDATABASESCHEMA.md` line 566.
- **Actual Evidence:** `batch_number text` is nullable in `vaccination_details` in both documents.
- **Authoritative Requirement:** `APPFLOW.md` Workflow E step 6; `DECISION_REGISTER.md` DEC-018.
- **Classification:** **E — False positive / resolved**.
- **Recommended Action:** Confirmed compliant across all documents. Mark as verified consistent.
- **Affected Files:** `WORKFLOW_CONFLICTS.md`.
- **Approval Needed:** NO.
- **Required Tests:** `T-VAX-001` (successful vaccination record with `batch_number = NULL`).

---

### CONFLICT-15: Disease Report Initial Status: `SUBMITTED` vs `SUSPECTED`
- **Source File & Line:** `pashurakshak_schema_v0.2.sql` line 848 vs `BACKENDDATABASESCHEMA.md` line 984.
- **Actual Evidence:**
  - SQL v0.2 line 848: `status text NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED','UNDER_REVIEW','SUSPECTED','NEEDS_MORE_INFORMATION','CONFIRMED','NOT_CONFIRMED','INSUFFICIENT_INFORMATION'))`
  - Schema v0.3 line 984: `status text NOT NULL DEFAULT 'SUSPECTED' CHECK (status IN ('SUSPECTED','CONFIRMED','DISPROVED','INCOMPLETE'))`
  - `APPFLOW.md` Workflow G mermaid diagram: `S["Report SUBMITTED"] --> UR["UNDER_REVIEW by VO"] --> SU["SUSPECTED"]`
- **Authoritative Requirement:** `APPFLOW.md` Workflow G; `DECISION_REGISTER.md` DEC-020 ("Disease report remains suspected until authorised veterinary review").
- **Classification:** **A — Baseline-established correction**.
- **Recommended Action:** SQL v0.2 state machine (`SUBMITTED` -> `UNDER_REVIEW` -> `SUSPECTED` / `NEEDS_MORE_INFORMATION` -> `CONFIRMED` / `NOT_CONFIRMED` / `INSUFFICIENT_INFORMATION`) directly reflects `APPFLOW.md` Workflow G. `BACKENDDATABASESCHEMA.md` §4.10 must be updated to align with this comprehensive lifecycle rather than its simplified 4-state draft.
- **Affected Files:** `BACKENDDATABASESCHEMA.md` §4.10, `pashurakshak_schema_v0.3_patch.sql`.
- **Approval Needed:** YES.
- **Required Tests:** `T-DIS-LIFECYCLE-001` (report transitions from `SUBMITTED` through review states to final confirmation).

---

### CONFLICT-16: Persistent In-App Notifications Independence From SMS
- **Source File & Line:** `pashurakshak_schema_v0.2.sql` lines 1149–1161; `BACKENDDATABASESCHEMA.md` lines 1222–1239.
- **Actual Evidence:** Dedicated `notifications` table exists with recipient, status, and payload. SMS delivery uses separate `reminder_delivery_attempts` table.
- **Authoritative Requirement:** `APPFLOW.md` Notification Matrix & §1 Hand-off rule; `DECISION_REGISTER.md` DEC-023.
- **Classification:** **E — False positive / resolved**.
- **Recommended Action:** Confirmed compliant across all documents. Mark as verified consistent.
- **Affected Files:** `WORKFLOW_CONFLICTS.md`.
- **Approval Needed:** NO.
- **Required Tests:** None.

---

### CONFLICT-17: Offline Period 7-Day Approval Reference
- **Source File & Line:** `pashurakshak_schema_v0.2.sql` line 1303 comment; `DECISION_REGISTER.md` DEC-027.
- **Actual Evidence:** SQL comment says "approved default; administrator-configurable". `DECISION_REGISTER.md` DEC-027 classifies "Seven-day offline authorisation default; admin configurable" as a **Baseline** decision.
- **Authoritative Requirement:** `DECISION_REGISTER.md` DEC-027.
- **Classification:** **D — Documentation clarification**.
- **Recommended Action:** Clarify in `DECISION_REGISTER.md` that DEC-027 is the baseline project parameter, and record an open administrative question regarding formal departmental letter/order reference.
- **Affected Files:** `DECISION_REGISTER.md`.
- **Approval Needed:** NO.
- **Required Tests:** `T-OFF-002` (offline token expiry at 7 days).

---

### CONFLICT-18: Assumption-Marked Settings in SQL Seed
- **Source File & Line:** `pashurakshak_schema_v0.2.sql` lines 1305, 1310, 1313.
- **Actual Evidence:** `upload_max_mb` (10), `flock_registration_enabled` (false), `duplicate_event_window_days` (null) are tagged `[ASSUMPTION]` or `[PENDING]`.
- **Authoritative Requirement:** Non-negotiable rule: "Keep assumptions separate from approved requirements. Record unresolved values in DECISION_REGISTER.md".
- **Classification:** **D — Documentation clarification**.
- **Recommended Action:** Add explicit tracking entries in `DECISION_REGISTER.md` under §3 "Pending approvals and open decisions" for each parameter. Keep safe default values.
- **Affected Files:** `DECISION_REGISTER.md`.
- **Approval Needed:** NO.
- **Required Tests:** None.

---

## 3. Summary of Review Classifications
| Classification | Count | Conflicts |
|---|:---:|---|
| **A — Baseline-established correction** | 6 | CONFLICT-01, CONFLICT-02, CONFLICT-03, CONFLICT-09, CONFLICT-11, CONFLICT-12, CONFLICT-15 |
| **B — Technical correction** | 3 | CONFLICT-04, CONFLICT-06, CONFLICT-07, CONFLICT-10 |
| **C — Stakeholder approval required** | 0 | *(All conflicts had either clear baseline decisions or direct technical remedies)* |
| **D — Documentation clarification** | 4 | CONFLICT-05, CONFLICT-17, CONFLICT-18 |
| **E — False positive / resolved** | 5 | CONFLICT-08, CONFLICT-13, CONFLICT-14, CONFLICT-16 |
| **Total Evaluated** | **18** | |

*(Note: Certain conflicts combine category traits; the primary driver is tabulated above).*

