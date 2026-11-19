# PashuRakshak Botad — Decision Register Proposed Updates
**Project:** PS000195 · **Date:** 31 October 2026 · **Status:** Phase 1 Additions & Reconciliations  
**Purpose:** Reconcile baseline decisions with recent consistency audit findings and establish traceable open questions.

---

## 1. Existing Baseline Decisions to Preserve (Re-affirmed)

The following baseline decisions from `DECISION_REGISTER.md` were re-verified against source code and workflows:

| Decision ID | Description | Verification Status | Source Alignment |
|---|---|---|---|
| **DEC-005** | DAHO manages district operational setup within assigned district | Confirmed | Enforced in `BACKENDDATABASESCHEMA.md` §4.3 & §5 |
| **DEC-006** | VO assigns FWs within authorised villages | Confirmed | `APPFLOW.md` Workflow D; `campaign_assignments` |
| **DEC-007** | FW is primary animal registrar | Confirmed | `APPFLOW.md` Workflow C; VO blocked if FW available |
| **DEC-008** | VO fallback requires explicit authorised FW-unavailability record and reason | Confirmed | Backed by `field_worker_availability_records` |
| **DEC-009** | Farmer record creation and login provisioning are separate | Confirmed | `farmers` vs `farmer_account_provisioning` |
| **DEC-010** | OTP authenticates existing provisioned account only | Confirmed | `otp_challenges` cannot insert users or farmers |
| **DEC-011** | No public farmer self-registration | Confirmed | `APPFLOW.md` Workflow B; SQL setting corrected to false |
| **DEC-012** | DAHO creates/configures campaigns; VO assigns FWs | Confirmed | Role seed aligned; SYS_ADMIN operational rights removed |
| **DEC-013** | Cooperative may propose/coordinate camps; VO confirms/reschedules/rejects | Confirmed | `camps` lifecycle in §4.7A |
| **DEC-014** | Camp coordination does not authorise vaccination | Confirmed | Separate `camp_staff` vs `vaccinator_authorizations` |
| **DEC-015** | Only separately authorised vaccinators administer/record | Confirmed | Explicit `vaccinator_authorizations` |
| **DEC-016** | Routine vaccination requires no mandatory VO approval | Confirmed | Accepted directly into `animal_events` |
| **DEC-017** | VO may audit/correct vaccination with reason | Confirmed | `event_corrections` immutable fact pattern |
| **DEC-018** | Vaccine batch number optional | Confirmed | Nullable in `vaccination_details` |
| **DEC-020** | Disease report remains suspected until authorised veterinary review | Confirmed | `SUBMITTED` -> `UNDER_REVIEW` -> `SUSPECTED` |
| **DEC-022** | Ownership transfer is request then authorised decision | Confirmed | `ownership_transfers` table verified present in SQL v0.2 |
| **DEC-023** | In-app notifications persist independently of SMS | Confirmed | Independent `notifications` table |
| **DEC-027** | Seven-day offline authorisation default; admin configurable | Confirmed | Baseline setting `offline_period_days = 7` |
| **DEC-031** | Canonical permission vocabulary used for new implementation | Confirmed | Canonical dictionary defined in proposal |

---

## 2. Proposed Technical Decisions (Phase 1 Proposals)

| Proposed ID | Technical Scope | Proposed Decision | Justification |
|---|---|---|---|
| **DEC-T01** | Database Compatibility View | Create view `owners` over table `farmers` | `farmers` in SQL v0.2 contains rich consent and registration metadata. A view preserves schema v0.3 query compatibility without disruptive table drops. |
| **DEC-T02** | Disease Report State Machine | Adopt 7-state lifecycle from SQL v0.2 / APPFLOW v0.4 in schema design | The 4-state draft in schema v0.3 lacked `SUBMITTED` and `UNDER_REVIEW` required by Workflow G. |
| **DEC-T03** | Missing Administrative Tables | Introduce `pashurakshak_schema_v0.3_patch.sql` | Add missing districts, GP mappings, VO profiles, stock ledger, and FW availability tables via non-destructive patch. |
| **DEC-T04** | Farmer Registration Path Constraint | Remove `'SELF'` from `farmers.registration_path` CHECK | Prevents illegal row insertion under DEC-011. |

---

## 3. New Open / Departmental Approval Questions

The following questions must be submitted to departmental stakeholders for formal resolution:

| Question ID | Conflict Origin | Departmental Question | Safe Interim Baseline |
|---|---|---|---|
| **DEC-Q01** | CONFLICT-01 | Will farmers ever be permitted self-service onboarding in a future phase, or is public registration permanently out of scope? | Self-registration disabled (`farmer_self_registration_enabled = false`). Staff-assisted only. |
| **DEC-Q02** | CONFLICT-07 | Who is authorised to declare a Field Worker unavailable, and what is the maximum validity window before re-verification? | Explicit record required in `field_worker_availability_records` entered by VO with mandatory text reason. |
| **DEC-Q03** | CONFLICT-10 | Who is permitted to provision farmer login accounts (FW, VO, or Admin), and is in-person verification mandatory before credential generation? | Explicit grant `farmer.account.provision` required; not granted to default roles. |
| **DEC-Q04** | CONFLICT-17 | What is the formal Department circular/order number authorising the 7-day offline sync window for remote areas? | Maintain 7 days as operational baseline per DEC-027. |
| **DEC-Q05** | CONFLICT-18 | What are the confirmed departmental file size limits (`upload_max_mb`) and duplicate event window (`duplicate_event_window_days`)? | Default `upload_max_mb = 10`; `duplicate_event_window_days = NULL` (disabled until configured). |

