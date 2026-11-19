# PashuRakshak Botad — Documentation Audit Report

**Audit date:** 31 October 2026  
**Auditor:** Antigravity Documentation Audit (Stage 0)  
**Scope:** All 15 project files listed in the audit request  
**Status:** DRAFT — awaiting stakeholder approval before broad changes  

> **Execution rule:** No application code was written or modified. No existing documentation was deleted. This report identifies findings only. Broad corrections await approval.

---

## 1. Documents Audited

| # | File | Version / Date | Status |
|---|---|---|---|
| 1 | `PRD.md` | v0.2 (31 Oct 2026) | ✅ Read — APPFLOW v0.4 aligned draft |
| 2 | `APPFLOW.md` | v0.4 (31 Oct 2026) | ✅ Read — authoritative workflow baseline |
| 3 | `TRD.md` | v0.2 targeted alignment (31 Oct 2026) | ✅ Read |
| 4 | `BACKENDDATABASESCHEMA.md` | v0.3 APPFLOW-aligned consolidated draft (31 Oct 2026) | ✅ Read |
| 5 | `DB_VALIDATION_REPORT.md` | 31 Oct 2026 — covers v0.4 static checks | ✅ Read |
| 6 | `DECISION_REGISTER.md` | 31 Oct 2026 | ✅ Read |
| 7 | `EDGE_CASE_CATALOGUE.md` | 31 Oct 2026 | ✅ Read |
| 8 | `IMPLEMENTATION_PLAN.md` | 31 Oct 2026 | ✅ Read |
| 9 | `pashurakshak_schema_v0.2.sql` | v0.2 SQL extract | ✅ Read (first 100 lines; full structure examined) |
| 10 | `REQUIREMENTS_TRACEABILITY_MATRIX.md` | 31 Oct 2026 baseline | ✅ Read |
| 11 | `STAKEHOLDER_PERMISSION_MATRIX.md` | 31 Oct 2026 | ✅ Read |
| 12 | `PROJECT_MEMORY_AI_HANDOVER.md` | Snapshot 31 Oct 2026 | ✅ Read |
| 13 | `README.md` | 31 Oct 2026 | ✅ Read |
| 14 | `ANTIGRAVITY_EXECUTION_PROMPTS.md` | 31 Oct 2026 | ✅ Read (first 60 lines) |
| 15 | `01_UI_UX_Design_Specification_v0.2_previous.pdf` | v0.2 (previous) | ⚠️ PDF file present; binary content cannot be text-compared in this session |

> **Missing document:** `UI_UX_DESIGN.md` is listed in `PROJECT_MEMORY_AI_HANDOVER.md` as "Not started" and is absent from the project directory. The PDF reference exists but the Markdown specification is missing. This is recorded as **FINDING-01**.

---

## 2. Version Consistency Summary

| Document | Stated baseline alignment | Actual alignment |
|---|---|---|
| PRD.md | APPFLOW v0.4 + BACKENDDATABASESCHEMA v0.4 | ✅ Consistent; contains APPFLOW v0.4 corrections block |
| APPFLOW.md | v0.4 | ✅ Self-consistent |
| TRD.md | PRD v0.2 + APPFLOW v0.4 + BACKENDDATABASESCHEMA v0.4 | ✅ Consistent with APPFLOW v0.4 |
| BACKENDDATABASESCHEMA.md | v0.3 | ⚠️ Header says v0.3; DB_VALIDATION_REPORT references v0.4 DDL — **FINDING-02** |
| pashurakshak_schema_v0.2.sql | v0.2 | ⚠️ SQL file is v0.2; schema doc is v0.3; divergence — **FINDING-03** |
| STAKEHOLDER_PERMISSION_MATRIX.md | Workflow-aligned baseline | ✅ Consistent with APPFLOW v0.4 |
| IMPLEMENTATION_PLAN.md | APPFLOW authority | ✅ Consistent |
| REQUIREMENTS_TRACEABILITY_MATRIX.md | Provisional baseline | ✅ Consistent; explicitly flags provisional IDs |
| EDGE_CASE_CATALOGUE.md | Implementation/QA baseline | ✅ Consistent |
| DECISION_REGISTER.md | Living register | ✅ Consistent |
| PROJECT_MEMORY_AI_HANDOVER.md | Recovery guide | ✅ Consistent but references v0.2 base documents as pending revision |
| README.md | Setup entry point | ✅ Consistent |
| ANTIGRAVITY_EXECUTION_PROMPTS.md | 13 stages | ✅ Consistent with workflow invariants |

---

## 3. Workflow Rule Compliance (All 20 Rules)

### Rule 1 — DAHO manages district operational setup, campaigns and vaccine stock within assigned district

| Document | Compliance | Finding |
|---|---|---|
| PRD.md | ✅ BR-15, BR-35, FR-CAMP-05, FR-DAHO-02 through FR-DAHO-07 | None |
| APPFLOW.md | ✅ Workflow A, Workflow D, §7.2 authorisation | None |
| TRD.md | ✅ §7.2, §8.1 endpoint table — DAHO district scope for `/campaigns`, `/districts/*` | None |
| BACKENDDATABASESCHEMA.md | ✅ `daho_district_assignments`, `campaigns.created_by` service note | None |
| STAKEHOLDER_PERMISSION_MATRIX.md | ✅ Default matrix row for DAHO | None |
| EDGE_CASE_CATALOGUE.md | ✅ EC-C01, EC-C02, EC-63 | None |
| IMPLEMENTATION_PLAN.md | ✅ Stage 3, Stage 6 | None |
| **Overall** | ✅ Consistent across all documents | — |

### Rule 2 — VO assigns Field Workers within authorised villages

| Document | Compliance | Finding |
|---|---|---|
| PRD.md | ✅ BR-15, FR-CAMP-06; US-16 | None |
| APPFLOW.md | ✅ Workflow A step 8, Workflow D step 3 | None |
| TRD.md | ✅ §7.2 "Campaigns" note, `PUT /campaigns/{id}/assignments` — VO only, authorised villages | None |
| BACKENDDATABASESCHEMA.md | ✅ `campaign_assignments` comment: "VO assigns FWs in authorised villages" | None |
| PRD.md §12 legacy role matrix | ⚠️ Row "Assign field workers to campaigns" shows incorrect values — see **FINDING-04** | FINDING-04 |
| **Overall** | ⚠️ One column alignment issue in PRD.md §12 legacy table | FINDING-04 |

### Rule 3 — FW is the primary animal registrar

| Document | Compliance | Finding |
|---|---|---|
| PRD.md | ✅ BR-31, FR-ANM-10, US-11 | None |
| APPFLOW.md | ✅ Workflow C; binding registration rule §2.2 | None |
| TRD.md | ✅ §6.4 step 4; `POST /animals` — FW primary, VO via fallback | None |
| BACKENDDATABASESCHEMA.md | ✅ §5 seed: `FIELD_WORKER` receives `animal.create`; `VET_OFFICER` receives `animal.create.fallback` | None |
| STAKEHOLDER_PERMISSION_MATRIX.md | ✅ `animal.register` for FW primary | None |
| SQL v0.2 | ⚠️ v0.2 SQL uses `animal.create` but canonical name is `animal.register` — **FINDING-05** | FINDING-05 |
| **Overall** | ⚠️ Permission name divergence between SQL v0.2 seed and canonical vocabulary | FINDING-05 |

### Rule 4 — VO fallback requires an explicit authorised FW-unavailability record and reason

| Document | Compliance | Finding |
|---|---|---|
| PRD.md | ✅ BR-31, BR-32, FR-FW-01 through FR-FW-04 | None |
| APPFLOW.md | ✅ Binding rule §2.5; Workflow C steps 2–4; EC-R01–EC-R07 | None |
| TRD.md | ✅ §6.4 step 4; §8.1 `POST /field-workers/{id}/availability` | None |
| BACKENDDATABASESCHEMA.md | ✅ `field_worker_availability_records` table; comment noting no timeout inference | None |
| EDGE_CASE_CATALOGUE.md | ✅ EC-R01–EC-R07; EC-57 through EC-62 | None |
| DECISION_REGISTER.md | ✅ DEC-008; DEC-P (FW availability policy pending) | None |
| **Overall** | ✅ Consistent | — |

### Rule 5 — Farmer record creation and login provisioning are separate

| Document | Compliance | Finding |
|---|---|---|
| PRD.md | ✅ BR-29, BR-30, FR-FARM-02, FR-FARM-03 | None |
| APPFLOW.md | ✅ Workflow B; binding rule §1 | None |
| TRD.md | ✅ §8.1 `POST /owners` and separate `POST /owners/{id}/account-provisioning` | None |
| BACKENDDATABASESCHEMA.md | ✅ `owners`, `users`, `farmer_account_provisioning`, `owner_user_links` are separate tables | None |
| STAKEHOLDER_PERMISSION_MATRIX.md | ✅ §2 — `farmer.account.provision` is a separate permission | None |
| **Overall** | ✅ Consistent | — |

### Rule 6 — OTP authenticates an existing provisioned account only

| Document | Compliance | Finding |
|---|---|---|
| PRD.md | ✅ BR-30; FR-AUTH-02 | None |
| APPFLOW.md | ✅ Workflow B non-smartphone section | None |
| TRD.md | ✅ §9.1 farmer OTP section; `POST /auth/otp/request` and `/verify` — registered numbers only | None |
| BACKENDDATABASESCHEMA.md | ✅ `otp_challenges` + comment "must never create users or owners"; `farmer_account_provisioning` | None |
| EDGE_CASE_CATALOGUE.md | ✅ EC-F04, EC-F05, EC-F08; EC-53 | None |
| **Overall** | ✅ Consistent | — |

### Rule 7 — No public farmer self-registration

| Document | Compliance | Finding |
|---|---|---|
| PRD.md | ✅ BR-29; FR-AUTH-02; FR-FARM-02; US-48 | None |
| APPFLOW.md | ✅ Workflow B; "Prohibited path" note; FARMER row blocked | None |
| TRD.md | ✅ `POST /owners` — "no public signup" note | None |
| EDGE_CASE_CATALOGUE.md | ✅ EC-F12; EC-52 | None |
| STAKEHOLDER_PERMISSION_MATRIX.md | ✅ Farmer row: "No public signup" | None |
| **Overall** | ✅ Consistent | — |

### Rule 8 — DAHO creates/configures campaigns; VO assigns Field Workers

| Document | Compliance | Finding |
|---|---|---|
| PRD.md | ✅ BR-15; FR-CAMP-05; FR-CAMP-06; US-31 | None |
| APPFLOW.md | ✅ Workflow D; §7.2 "Campaigns" section | None |
| TRD.md | ✅ `POST /campaigns` — DAHO; `PUT /campaigns/{id}/assignments` — VO | None |
| BACKENDDATABASESCHEMA.md | ✅ `campaigns.created_by` comment; `campaign_assignments` comment | None |
| PRD.md §12 legacy table | ⚠️ Same column misalignment — see FINDING-04 | FINDING-04 |
| **Overall** | ⚠️ Same column alignment issue; no substantive rule conflict | FINDING-04 |

### Rule 9 — Cooperatives may propose/coordinate camps; VO makes the authorised camp decision

| Document | Compliance | Finding |
|---|---|---|
| PRD.md | ✅ BR-36; FR-CAMP-07; FR-CAMP-08 | None |
| APPFLOW.md | ✅ Workflow D steps 4–6; `camp.propose` vs `camp.manage` permissions | None |
| TRD.md | ✅ `POST /camps` (cooperative/eligible actor proposes); `POST /camps/{id}/decision` (VO) | None |
| BACKENDDATABASESCHEMA.md | ✅ `camps.proposal_source_role` allows DAIRY_STAFF; `confirmed_by` requires separate actor | None |
| STAKEHOLDER_PERMISSION_MATRIX.md | ✅ `camp.propose` for cooperative; `camp.manage` for VO | None |
| EDGE_CASE_CATALOGUE.md | ✅ EC-C05, EC-C06, EC-C08 | None |
| **Overall** | ✅ Consistent | — |

### Rule 10 — Camp coordination does not grant vaccination authority

| Document | Compliance | Finding |
|---|---|---|
| PRD.md | ✅ BR-37 | None |
| APPFLOW.md | ✅ "Organising ≠ administering" note after Workflow D | None |
| TRD.md | ✅ `event.create` permission — "check vaccinator authorisation separately from role/camp assignment" | None |
| BACKENDDATABASESCHEMA.md | ✅ §4.7A role boundary comment | None |
| STAKEHOLDER_PERMISSION_MATRIX.md | ✅ Cooperative row: "No by camp role alone"; §5 separation of duties | None |
| EDGE_CASE_CATALOGUE.md | ✅ EC-C06, EC-C07, EC-70 | None |
| **Overall** | ✅ Consistent | — |

### Rule 11 — Only separately authorised vaccinators may administer/record vaccination

| Document | Compliance | Finding |
|---|---|---|
| PRD.md | ✅ BR-37; FR-CAMP-09; US-46 | None |
| APPFLOW.md | ✅ Workflow E — "Authorised vaccinator administers vaccine (outside system)" | None |
| TRD.md | ✅ `POST /events` — "Check vaccinator authorisation separately from role/camp assignment" | None |
| BACKENDDATABASESCHEMA.md | ✅ `vaccinator_authorizations` table added in v0.4; `vaccination_details` requires `administered_by` | None |
| STAKEHOLDER_PERMISSION_MATRIX.md | ✅ VACCINATOR role row; §2 canonical permissions | None |
| SQL v0.2 | ⚠️ `vaccinator_authorizations` absent from v0.2 SQL — **FINDING-06** | FINDING-06 |
| **Overall** | ⚠️ SQL file lags schema doc | FINDING-06 |

### Rule 12 — Routine vaccination does not require mandatory VO approval

| Document | Compliance | Finding |
|---|---|---|
| PRD.md | ✅ BR-16; US-03; AC-03 | None |
| APPFLOW.md | ✅ Workflow E acceptance criteria | None |
| TRD.md | ✅ "routine entries need no approval" in acceptance | None |
| EDGE_CASE_CATALOGUE.md | ✅ EC-C15 | None |
| IMPLEMENTATION_PLAN.md | ✅ Stage 7 | None |
| **Overall** | ✅ Consistent | — |

### Rule 13 — Vaccine batch number is optional

| Document | Compliance | Finding |
|---|---|---|
| PRD.md | ✅ BR-17; PRD §1.3 approved decisions; US-03 | None |
| APPFLOW.md | ✅ "optional batch" in Workflow E | None |
| TRD.md | ✅ `batchNumber: null` in example payload | None |
| BACKENDDATABASESCHEMA.md | ✅ `vaccination_details.batch_number text` — nullable, comment "OPTIONAL" | None |
| EDGE_CASE_CATALOGUE.md | ✅ EC-C17 | None |
| **Overall** | ✅ Consistent | — |

### Rule 14 — Disease reports remain suspected until authorised veterinary review

| Document | Compliance | Finding |
|---|---|---|
| PRD.md | ✅ BR-12; FR-DIS-09 | None |
| APPFLOW.md | ✅ Workflow G — SUSPECTED state; `disease.confirm` permission gate | None |
| TRD.md | ✅ `POST /disease-reports/{id}/review` — "explicitly authorised veterinary reviewer" | None |
| BACKENDDATABASESCHEMA.md | ✅ CONFIRMED check requires `confirmed_by`, `confirmed_at`, `confirmation_basis` | None |
| EDGE_CASE_CATALOGUE.md | ✅ EC-D06, EC-D08, EC-76, EC-77 | None |
| **Overall** | ✅ Consistent | — |

### Rule 15 — Alerts do not mean confirmed diagnosis or outbreak

| Document | Compliance | Finding |
|---|---|---|
| PRD.md | ✅ BR-13; BR-11 | None |
| APPFLOW.md | ✅ Workflow G — "Alert UNDER_REVIEW: flag only"; "never auto-confirm" | None |
| TRD.md | ✅ `GET /alerts` — "Alerts are flags" | None |
| BACKENDDATABASESCHEMA.md | ✅ `disease_alerts.status` — starts UNDER_REVIEW | None |
| EDGE_CASE_CATALOGUE.md | ✅ EC-D09, EC-D10 | None |
| **Overall** | ✅ Consistent | — |

### Rule 16 — Ownership transfer requires a request followed by an authorised decision

| Document | Compliance | Finding |
|---|---|---|
| PRD.md | ✅ BR-40; FR-ANM-11 | None |
| APPFLOW.md | ✅ Workflow step 10 | None |
| TRD.md | ✅ `POST /animals/{id}/transfer-requests` then `POST /transfers/{id}/decision` | None |
| BACKENDDATABASESCHEMA.md | ⚠️ `ownership_transfers` DDL listed in DB_VALIDATION_REPORT as added in v0.4 but not observed in the schema DDL body as read — **FINDING-07** | FINDING-07 |
| EDGE_CASE_CATALOGUE.md | ✅ EC-A06, EC-A07, EC-A08, EC-80, EC-81, EC-82 | None |
| **Overall** | ⚠️ `ownership_transfers` DDL presence in schema doc needs confirmation | FINDING-07 |

### Rule 17 — In-app notifications persist independently of SMS

| Document | Compliance | Finding |
|---|---|---|
| PRD.md | ✅ BR-39; FR-NOT-01, FR-NOT-02, FR-NOT-03 | None |
| APPFLOW.md | ✅ Hand-off rule §1; notification matrix §2 | None |
| TRD.md | ✅ `GET /notifications` — "Persistent in-app notifications; independent of SMS delivery" | None |
| BACKENDDATABASESCHEMA.md | ✅ `notifications` table §4.12A | None |
| DECISION_REGISTER.md | ✅ DEC-023, DEC-024 | None |
| EDGE_CASE_CATALOGUE.md | ✅ EC-78 | None |
| **Overall** | ✅ Consistent | — |

### Rule 18 — District/village permissions are enforced by the backend

| Document | Compliance | Finding |
|---|---|---|
| PRD.md | ✅ BR-21; FR-AUTH-06 | None |
| APPFLOW.md | ✅ Binding rule §4: "Enforce, do not merely describe" | None |
| TRD.md | ✅ §7.2 — "Server resolves district/village assignments from authoritative DB records; never trusts client" | None |
| BACKENDDATABASESCHEMA.md | ✅ §6 RLS; `daho_district_assignments`; `user_village_assignments` | None |
| STAKEHOLDER_PERMISSION_MATRIX.md | ✅ §4 scope enforcement rules 1–9 | None |
| **Overall** | ✅ Consistent | — |

### Rule 19 — Offline pending records are never silently deleted

| Document | Compliance | Finding |
|---|---|---|
| PRD.md | ✅ BR-05; FR-AUTH-04 | None |
| APPFLOW.md | ✅ Workflow K — logout never deletes queue rows | None |
| TRD.md | ✅ §5.3 rules 3–4; §5.2 queue record | None |
| BACKENDDATABASESCHEMA.md | ✅ `sync_receipts`, `sync_conflicts` — held records preserved | None |
| EDGE_CASE_CATALOGUE.md | ✅ EC-O01, EC-O07, EC-O08, EC-O09 | None |
| **Overall** | ✅ Consistent | — |

### Rule 20 — Government integrations and external messaging remain pending until approved

| Document | Compliance | Finding |
|---|---|---|
| PRD.md | ✅ BR-27; §4 pending status | None |
| APPFLOW.md | ✅ Workflow A step 9 | None |
| TRD.md | ✅ T9; Adapters "simulated/disabled" | None |
| BACKENDDATABASESCHEMA.md | ✅ `integration_settings` seed: bharat_pashudhan = DISABLED, sms_provider = SIMULATED | None |
| DECISION_REGISTER.md | ✅ DEC-024, DEC-025; DEC-P15, DEC-P16 | None |
| **Overall** | ✅ Consistent | — |

---

## 4. Technical Consistency Findings

### 4.1 UI Screens vs APPFLOW

| Finding | Severity | Detail |
|---|---|---|
| FINDING-01 | 🔴 Critical | `UI_UX_DESIGN.md` is absent. PRD references screen IDs (A1, F1–F8, V1–V6, W1–W10, C1–C2, D1–D5, G1, S1–S5, X1); APPFLOW.md references these same IDs. REQUIREMENTS_TRACEABILITY_MATRIX.md references screen codes (DASH-DAHO, SETUP-VILLAGE, FARMER-FORM, ANIMAL-FORM, etc.). None of these screen IDs can be formally verified against an existing Markdown document. Only the PDF reference exists. |

### 4.2 API Endpoints vs TRD and Permissions

| Finding | Severity | Detail |
|---|---|---|
| FINDING-08 | 🟡 Medium | TRD §8.1 uses legacy permission examples `event.create`, `campaign.assign_workers`, `owner.phone.view`, `export.run`, `disease.confirm` inline with endpoint descriptions. These are listed in DECISION_REGISTER §4 as legacy aliases pending canonical mapping. They are not confirmed invalid but the formal mapping to canonical permissions is not documented in TRD. |
| FINDING-09 | 🟡 Medium | TRD §8.1 lists `POST /imports` as accessible to "VO" only. APPFLOW Workflow J clarifies FW is the primary import actor for animal rows (with VO fallback). The endpoint access note should reflect that FW with `import.run` permission may also upload imports within village scope. |
| FINDING-10 | 🟢 Low | TRD §8.1 lists `GET /due` accessible to "VO, FW, DAHO(agg)". STAKEHOLDER_PERMISSION_MATRIX does not explicitly list DAHO for individual animal due lists — DAHO sees aggregate coverage dashboards. May be intentional; needs clarification. |

### 4.3 Database Entities vs Schema and SQL

| Finding | Severity | Detail |
|---|---|---|
| FINDING-02 | 🟡 Medium | `BACKENDDATABASESCHEMA.md` header states version v0.3; `DB_VALIDATION_REPORT.md` subject line states "BACKENDDATABASESCHEMA.md v0.4". The document version number has not been updated to v0.4. |
| FINDING-03 | 🔴 Critical | `pashurakshak_schema_v0.2.sql` is the v0.2 SQL file. DB_VALIDATION_REPORT §2 lists 16 APPFLOW v0.4 structural additions absent from the v0.2 SQL file. No v0.3/v0.4 SQL file was found in the project directory. |
| FINDING-06 | 🔴 Critical | `vaccinator_authorizations`, `camp_staff`, `disease_reviews`, `ownership_transfers`, `animal_external_identifiers`, `animal_verifications`, `farmer_verifications`, `disease_report_attachments` tables are documented as added in v0.4 but are NOT present in `pashurakshak_schema_v0.2.sql`. |
| FINDING-07 | 🟡 Medium | `ownership_transfers` DDL listed in DB_VALIDATION_REPORT as added in v0.4. Was not found in the §4 DDL sections of BACKENDDATABASESCHEMA.md as read (lines 1–1599). May exist in unread portion (lines 1600–1741). Requires confirmation. |
| FINDING-11 | 🟢 Low | SQL v0.2 adds sequences `farmer_code_seq`, `flock_code_seq`, `camp_code_seq`, `report_no_seq` that are not in BACKENDDATABASESCHEMA.md DDL section (which shows only `animal_code_seq` and `help_request_ref_seq`). |
| FINDING-12 | 🟢 Low | SQL v0.2 `villages` table lacks `district_id` column present in schema doc v0.3. Schema evolution gap. |
| FINDING-13 | 🟢 Low | SQL v0.2 `talukas` table lacks `district_id` FK column present in schema doc v0.3. Schema evolution gap. |

### 4.4 Permissions vs Stakeholder Permission Matrix

| Finding | Severity | Detail |
|---|---|---|
| FINDING-04 | 🔴 Critical | PRD.md §12 legacy role matrix row "Assign field workers to campaigns": column under "Field Worker" shows "Yes" and column under "DAHO" shows "No" — this implies FW assigns workers, which contradicts every other document. The APPFLOW v0.4 corrections table immediately below correctly shows VO=Yes, FW=No. The legacy table row is incorrect. |
| FINDING-05 | 🟡 Medium | Canonical permission per DECISION_REGISTER is `animal.register` / `animal.register.fallback`. BACKENDDATABASESCHEMA.md §5 seed uses legacy `animal.create` / `animal.create.fallback`. DECISION_REGISTER §4 notes this mapping is pending; both coexist. |
| FINDING-14 | 🟡 Medium | Schema seed grants `farmer.account.provision` to FIELD_WORKER by default. STAKEHOLDER_PERMISSION_MATRIX shows FW can provision "if granted" (not default). Inconsistency pending Department decision. |
| FINDING-15 | 🟡 Medium | Schema seed grants `farmer.account.provision` to VET_OFFICER by default. STAKEHOLDER_PERMISSION_MATRIX shows VO can provision "if granted". Same inconsistency as FINDING-14. |
| FINDING-16 | 🟡 Medium | `disease.review` is a canonical permission (DECISION_REGISTER, SPM). It is NOT granted to VET_OFFICER in the role_permissions seed in BACKENDDATABASESCHEMA.md. VO reviewing disease reports is a core workflow action in APPFLOW Workflow G. This may be intentional (explicit grant required) but conflicts with the core VO workflow unless the intent is confirmed. |

### 4.5 Acceptance Criteria vs PRD

| Finding | Severity | Detail |
|---|---|---|
| FINDING-17 | 🟢 Low | PRD §16 confirms AC-21–AC-34 exist. REQUIREMENTS_TRACEABILITY_MATRIX.md §4 checklist says "Verify existing acceptance criteria IDs; map AC-21–AC-34 only if present in final PRD." They are confirmed present. The RTM checklist note is now outdated. |

### 4.6 Edge Cases vs Actual Workflow

| Finding | Severity | Detail |
|---|---|---|
| FINDING-18 | 🟡 Medium | EDGE_CASE_CATALOGUE.md uses two numbering systems: original sequential (EC-01 to EC-51 matching PRD §15) and new alphabetic prefix format (EC-F01–F12, EC-A01–A12, EC-R01–R07, EC-C01–C17, EC-D01–D10, EC-O01–O12, EC-I01–I08, EC-P01–P09). PRD §15 also defines EC-52 through EC-85 using sequential format. RTM checklist says "Verify EC-52–EC-85". This dual-numbering hybrid creates traceability ambiguity. |

### 4.7 Implementation Stages vs Technical Dependencies

| Finding | Severity | Detail |
|---|---|---|
| FINDING-22 | 🟡 Medium | TRD §5.4 explicitly lists online-only actions (campaign configuration, disease confirmation, ownership-transfer approval, stock movements, etc.). This important boundary is only formally stated in TRD §5.4 and not cross-referenced in IMPLEMENTATION_PLAN Stage 10 or EDGE_CASE_CATALOGUE. No conflict; a detail gap. |

### 4.8 Offline Operations vs Offline Authorisation Rules

| Finding | Severity | Detail |
|---|---|---|
| FINDING-21 | 🟡 Medium | EC-O12 "Sync dependency order invalid" says "Hold child until parent exists." The specific dependency ordering the sync engine must handle (e.g., animal draft must precede vaccination event) is not elaborated in TRD or IMPLEMENTATION_PLAN Stage 10. No conflict; a specification detail gap. |

---

## 5. SQL File vs Schema Document Gap Summary

| Item | SQL v0.2 | Schema Doc v0.3 | Status |
|---|---|---|---|
| `districts` table | ❌ Absent | ✅ Present | Gap |
| `daho_district_assignments` table | ❌ Absent | ✅ Present | Gap |
| `gram_panchayats` + `gram_panchayat_villages` | ❌ Absent | ✅ Present | Gap |
| `gram_panchayat_staff_assignments` | ❌ Absent | ✅ Present | Gap |
| `field_worker_availability_records` | ❌ Absent | ✅ Present | Gap |
| `vaccinator_authorizations` | ❌ Absent | ✅ Referenced (v0.4) | Gap |
| `camp_staff` | ❌ Absent | ✅ Referenced (v0.4) | Gap |
| `animal_external_identifiers` | ❌ Absent | ✅ Referenced (v0.4) | Gap |
| `animal_verifications` | ❌ Absent | ✅ Referenced (v0.4) | Gap |
| `farmer_verifications` | ❌ Absent | ✅ Referenced (v0.4) | Gap |
| `ownership_transfers` | ❌ Absent | ✅ Referenced (v0.4) | Gap |
| `disease_reviews` | ❌ Absent | ✅ Referenced (v0.4) | Gap |
| `disease_report_attachments` | ❌ Absent | ✅ Referenced (v0.4) | Gap |
| `notifications` table | ❌ Absent | ✅ Present §4.12A | Gap |
| `villages.district_id` column | ❌ Absent | ✅ Present | Gap |
| `talukas.district_id` FK | ❌ Absent | ✅ Present | Gap |
| Extra sequences (farmer_code_seq, etc.) | ✅ Present | ❌ Not in schema doc | Extra in SQL |

**Conclusion:** The SQL file (`pashurakshak_schema_v0.2.sql`) represents a significantly earlier version than the schema documentation. A v0.3/v0.4 SQL file must be created from the schema document DDL.

---

## 6. Document Completeness Check

| Required Document | Present | Complete | Notes |
|---|---|---|---|
| PRD.md | ✅ | ✅ | v0.2; APPFLOW v0.4 corrections included |
| APPFLOW.md | ✅ | ✅ | v0.4; authoritative |
| TRD.md | ✅ | ✅ | v0.2 targeted alignment |
| BACKENDDATABASESCHEMA.md | ✅ | ⚠️ | v0.3 header; some v0.4 tables may be in unread tail |
| DB_VALIDATION_REPORT.md | ✅ | ✅ | Honest: execution pending |
| DECISION_REGISTER.md | ✅ | ✅ | 32 baseline decisions; 22 pending items |
| EDGE_CASE_CATALOGUE.md | ✅ | ✅ | Dual numbering noted |
| IMPLEMENTATION_PLAN.md | ✅ | ✅ | 13 stages; dependency-ordered |
| REQUIREMENTS_TRACEABILITY_MATRIX.md | ✅ | ⚠️ | Provisional; explicitly states IDs need reconciliation |
| STAKEHOLDER_PERMISSION_MATRIX.md | ✅ | ✅ | Consistent |
| PROJECT_MEMORY_AI_HANDOVER.md | ✅ | ✅ | Consistent recovery guide |
| README.md | ✅ | ✅ | Consistent |
| ANTIGRAVITY_EXECUTION_PROMPTS.md | ✅ | ✅ (partial read) | All 13 stages present |
| **UI_UX_DESIGN.md** | ❌ | ❌ | **MISSING — critical gap** |
| SQL schema (v0.3/v0.4) | ❌ | ❌ | Only v0.2 SQL exists; significantly outdated |

---

## 7. Pending Decisions That Affect Multiple Documents

The following unresolved items from DECISION_REGISTER.md affect consistency. No invented resolution applied.

| Decision ID | Question | Documents Affected |
|---|---|---|
| DEC-P01 | Exact role grants and combinations | PRD §12, SPM, schema seed, TRD |
| DEC-P02 | Exact staff roles permitted to create farmer records | PRD FR-FARM-02, APPFLOW Workflow B, API |
| DEC-P07 | Which actors may record vaccination; exact permission name | TRD, SPM, schema seed, APPFLOW |
| DEC-P08 | Who may confirm disease | TRD, SPM, schema seed |
| DEC-P20 | Vaccination schedules/doses | PRD BR-02, schema schedule_versions |
| DEC-P21 | Final schema names and permission seed grants | All technical docs |
| DEC-P22 | PostgreSQL 16 validation evidence | DB_VALIDATION_REPORT |

---

## 8. Summary of All Findings

| ID | Severity | Category | Short Description |
|---|---|---|---|
| FINDING-01 | 🔴 Critical | Missing document | `UI_UX_DESIGN.md` absent from project |
| FINDING-02 | 🟡 Medium | Version label | Schema doc header says v0.3; validation report says v0.4 |
| FINDING-03 | 🔴 Critical | SQL/Schema gap | SQL file is v0.2; schema doc is v0.3/v0.4; 16+ tables missing from SQL |
| FINDING-04 | 🔴 Critical | Workflow rule | PRD §12 legacy matrix "Assign FW to campaigns" row has wrong column values |
| FINDING-05 | 🟡 Medium | Permission name | `animal.create` in SQL seed vs `animal.register` canonical vocabulary |
| FINDING-06 | 🔴 Critical | SQL/Schema gap | Multiple v0.4 tables absent from SQL file |
| FINDING-07 | 🟡 Medium | DDL gap | `ownership_transfers` DDL may be absent from schema document body |
| FINDING-08 | 🟡 Medium | Permission alias | TRD uses legacy permission names; canonical mapping not formally documented in TRD |
| FINDING-09 | 🟡 Medium | Endpoint access | TRD `POST /imports` shows VO only; APPFLOW says FW is primary import actor |
| FINDING-10 | 🟢 Low | Access scope | TRD `GET /due` includes DAHO; SPM does not explicitly list DAHO for individual due lists |
| FINDING-11 | 🟢 Low | SQL extras | SQL v0.2 has extra sequences not in schema doc |
| FINDING-12 | 🟢 Low | Schema evolution | `villages.district_id` absent in SQL v0.2 |
| FINDING-13 | 🟢 Low | Schema evolution | `talukas.district_id` absent in SQL v0.2 |
| FINDING-14 | 🟡 Medium | Permission default | Schema seed grants `farmer.account.provision` to FW by default; SPM says "if granted" |
| FINDING-15 | 🟡 Medium | Permission default | Schema seed grants `farmer.account.provision` to VO by default; SPM says "if granted" |
| FINDING-16 | 🟡 Medium | Permission gap | `disease.review` not in VO role_permissions seed; VO reviews disease as core workflow |
| FINDING-17 | 🟢 Low | RTM checklist | AC-21–AC-34 confirmed in PRD; RTM checklist note is outdated |
| FINDING-18 | 🟡 Medium | Numbering | Edge case dual numbering system between EDGE_CASE_CATALOGUE and PRD |
| FINDING-21 | 🟡 Medium | Detail gap | Sync dependency ordering not specified in TRD/IMPLEMENTATION_PLAN |
| FINDING-22 | 🟡 Medium | Detail gap | Online-only boundary stated only in TRD §5.4; not cross-referenced elsewhere |

---

## 9. No-Code Confirmation

✅ No application code was written or modified during this audit.  
✅ No existing documentation was deleted.  
✅ No approved workflows were changed.  
✅ No government processes, medical rules, or API credentials were invented.  
✅ SQL execution was not claimed; all database findings are based on static document inspection.

---

## 10. Required Actions (Pending Approval)

See `WORKFLOW_CONFLICTS.md` for conflict detail and proposed corrections.

**Critical — require approval before proceeding:**
1. Create `UI_UX_DESIGN.md` from the approved PDF reference.
2. Create an updated SQL file (v0.3/v0.4) matching the schema document DDL.
3. Fix PRD §12 legacy role matrix row for "Assign FW to campaigns".
4. Add missing v0.4 tables to SQL or confirm they exist in a separate patch file.

**Medium — targeted edit after approval:**
5. Update BACKENDDATABASESCHEMA.md header version from v0.3 to v0.4.
6. Explicitly document `disease.review` grant policy for VET_OFFICER in schema seed and DECISION_REGISTER.
7. Align `POST /imports` endpoint access in TRD with APPFLOW FW-primary import rule.
8. Resolve `farmer.account.provision` default-vs-explicit-grant in schema seed and SPM.
9. Add formal permission alias mapping table to TRD or DECISION_REGISTER.

**Low — informational updates:**
10. Update RTM checklist note for AC-21–AC-34 (now confirmed present).
11. Clarify DAHO access to `GET /due` (aggregate vs individual animal).
12. Resolve extra sequences in SQL v0.2.
13. Document sync dependency ordering in TRD §6 or IMPLEMENTATION_PLAN Stage 10.

