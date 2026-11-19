# PashuRakshak Botad — Decision Register

**Status:** Living register. Baseline decisions are preserved; items without formal approval remain pending/open.  
**Rule:** Never invent an unresolved government or departmental process.

## 1. Status definitions

- **Baseline:** Explicit project decision; preserve.
- **Pending approval:** Requires department/project-owner or external authorisation.
- **Open:** Not sufficiently specified; do not guess.
- **Verified:** Supported by inspected source or executed test evidence. Use only with evidence.

## 2. Current baseline decisions

| ID | Decision | Status | Implementation consequence |
|---|---|---|---|
| DEC-001 | Gujarati app UI; English technical docs; Western digits | Baseline | Consistent language/digits |
| DEC-002 | React/Vite/TypeScript/Tailwind PWA | Baseline | Preserve frontend stack |
| DEC-003 | Python 3.12/FastAPI/SQLAlchemy 2.0/Pydantic/Alembic | Baseline | Preserve backend stack |
| DEC-004 | PostgreSQL 16; local `pashurakshak_db`; pgAdmin 4; Docker optional | Baseline | No assumed cloud DB |
| DEC-005 | DAHO manages district operational setup within assigned district | Baseline | Server-enforced scope |
| DEC-006 | VO assigns FWs within authorised villages | Baseline | Assignment endpoints/scope |
| DEC-007 | FW is primary animal registrar | Baseline | FW-first registration |
| DEC-008 | VO fallback requires explicit authorised FW-unavailability record and reason | Baseline | No timeout/attendance inference |
| DEC-009 | Farmer record creation and login provisioning are separate | Baseline | Separate API/UI/audit |
| DEC-010 | OTP authenticates existing provisioned account only | Baseline | OTP cannot create/link records |
| DEC-011 | No public farmer self-registration | Baseline | Public signup absent |
| DEC-012 | DAHO creates/configures campaigns; VO assigns FWs | Baseline | Campaign ownership separated |
| DEC-013 | Cooperative may propose/coordinate camps; VO confirms/reschedules/rejects | Baseline | Separate camp proposal/decision |
| DEC-014 | Camp coordination does not authorise vaccination | Baseline | Separate vaccinator authorisation |
| DEC-015 | Only separately authorised vaccinators administer/record | Baseline | Explicit vaccinator permission |
| DEC-016 | Routine vaccination requires no mandatory VO approval | Baseline | No mandatory approval gate |
| DEC-017 | VO may audit/correct vaccination with reason | Baseline | Preserve old value and audit |
| DEC-018 | Vaccine batch number optional | Baseline | Nullable/optional |
| DEC-019 | Bharat Pashudhan 12-digit tag optional external ID, separate from internal ID | Baseline | Separate optional identifier |
| DEC-020 | Disease report remains suspected until authorised veterinary review | Baseline | No automatic confirmation |
| DEC-021 | Alerts are not diagnosis/outbreak; no reports does not mean disease-free | Baseline | No unsupported inference |
| DEC-022 | Ownership transfer is request then authorised decision | Baseline | Request does not mutate owner |
| DEC-023 | In-app notifications persist independently of SMS | Baseline | Durable in-app channel |
| DEC-024 | SMS/WhatsApp simulated until approved credentials | Baseline | No live sending before approval |
| DEC-025 | Government integrations pending approval/API access | Baseline | No fabricated integrations |
| DEC-026 | Cooperative default access is village aggregate overdue counts, not owner details | Baseline | Aggregate-only default |
| DEC-027 | Seven-day offline authorisation default; admin configurable | Baseline | Configurable expiry |
| DEC-028 | Offline expiry requires online reauthentication | Baseline | Block protected new actions after expiry |
| DEC-029 | Pending offline records never silently deleted; warn before logout | Baseline | Durable queue/logout warning |
| DEC-030 | Server cannot review payload it has not received | Baseline | Client retains unsent payload |
| DEC-031 | Canonical permission vocabulary used for new implementation | Baseline | Legacy aliases need mapping |
| DEC-032 | Preserve approved green identity and supplied UI references | Baseline | No generic redesign |

## 3. Pending approvals and open decisions

| ID | Question | Safe interim behaviour | Affected areas |
|---|---|---|---|
| DEC-P01 | Exact role grants and role combinations? | Deny ungranted actions | Permission matrix/schema/auth |
| DEC-P02 | Exact staff roles permitted to create farmer records? | Use only documented grants | PRD/APPFLOW/API |
| DEC-P03 | Duplicate/shared-mobile matching and resolution policy? | Flag for review; no auto-merge | Farmer onboarding |
| DEC-P04 | Required consent/identity evidence? | Do not invent; hold only if source requires | Farmer onboarding |
| DEC-P05 | Who provisions farmer login and what verification applies? | Explicit grant/audit | Provisioning |
| DEC-P06 | OTP provider, resend interval, rate limits and retention? | Dev stub clearly labelled; no production claim | Authentication |
| DEC-P07 | Which actors may record vaccination and exact permission name? | Require separate explicit authorisation | Vaccination |
| DEC-P08 | Who may confirm disease, distinct from reviewing? | Deny absent explicit confirmation grant | Disease workflow |
| DEC-P09 | Transfer decision authority and evidence? | Keep request pending; owner unchanged | Ownership transfer |
| DEC-P10 | Stock transaction types, adjustment authority and location model? | Implement only approved types | Inventory/schema |
| DEC-P11 | Camp overlap/cancellation/reschedule/no-show rules? | Manual authorised review; no invented priority | Camps |
| DEC-P12 | Exact offline-supported actions/conflict policy? | Allow only approved actions; preserve conflicts | PWA/sync |
| DEC-P13 | Offline grant issuance, device binding and revocation? | Apply stated seven-day default; seek security approval | Offline auth |
| DEC-P14 | Retention/deletion/archive/device-loss recovery? | Never silently delete pending data | Privacy/offline |
| DEC-P15 | Government API owner/docs/credentials/approval? | Integration disabled/pending | Integrations |
| DEC-P16 | SMS/WhatsApp provider, sender/template approval and credentials? | Simulated; in-app active | Notifications |
| DEC-P17 | Export permissions and allowed fields per role? | Deny without explicit grant | Reports |
| DEC-P18 | Exact measured palette/font/spacing from approved references? | Preserve reference; mark tokens pending measurement | UI/UX |
| DEC-P19 | Disease thresholds/epidemiological rules, if any? | No thresholds/automatic outbreak inference | Disease analytics |
| DEC-P20 | Vaccination schedules/doses/clinical protocols? | Do not implement invented clinical rules | Vaccination |
| DEC-P21 | Final schema names and permission seed grants? | Follow inspected final SQL; reconcile docs | Schema |
| DEC-P22 | Exact PostgreSQL 16 validation evidence? | Mark pending until executed | Validation |
| DEC-Q01 | Is public self-registration permanently decommissioned or deferred? | Self-registration disabled (farmer_self_registration_enabled = false). Staff-assisted only | Farmer Onboarding |
| DEC-Q02 | Authorised recorder and maximum validity window for FW unavailability? | Explicit record in field_worker_availability_records by VO with reason | Workflow C Fallback |
| DEC-Q03 | Delegation of farmer login provisioning (FW, VO, or Admin)? | Explicit grant farmer.account.provision required; not in default role seed | Authentication |
| DEC-Q04 | Formal Department order reference authorising 7-day offline sync period? | Maintain 7 days as operational baseline per DEC-027 | Offline Architecture |
| DEC-Q05 | Confirmed limits for upload_max_mb and duplicate_event_window_days? | Default upload_max_mb = 10; duplicate_event_window_days = null | System Settings |

## 3A. Approved Technical Decisions (Phase 2 Freeze)

| ID | Decision | Status | Implementation Consequence |
|---|---|---|---|
| DEC-T01 | Database compatibility views (owners, owner_user_links, dairy_cooperatives) | Approved Baseline | Preserves base tables (farmers, cooperatives) while aligning schema doc query layer |
| DEC-T02 | Adopt 7-state disease report lifecycle in schema design matching Workflow G | Approved Baseline | SUBMITTED -> UNDER_REVIEW -> SUSPECTED / NEEDS_MORE_INFORMATION -> CONFIRMED / NOT_CONFIRMED / INSUFFICIENT_INFORMATION |
| DEC-T03 | Apply missing architectural tables via additive patch pashurakshak_schema_v0.3_patch.sql | Approved Baseline | Non-destructive evolution; retains v0.2 SQL baseline |
| DEC-T04 | Enforce farmer self-registration disablement via DB CHECK constraint | Approved Baseline | Remove 'SELF' from farmers.registration_path CHECK constraint |

## 4. Canonical permission vocabulary & legacy mapping

The canonical permission vocabulary is established for all new implementations (DEC-031). The database seed uses these codes or explicit legacy mappings:

| Canonical Permission | Database Seed Code | Status / Scope | Description |
|---|---|---|---|
| `platform.admin` | `platform.admin` | Default (SYS_ADMIN) | Platform technical administration |
| `user.manage` | `user.manage` | Default (SYS_ADMIN) | User account administration |
| `config.manage` | `config.manage` | Default (SYS_ADMIN) | Technical parameters and settings |
| `district.setup.manage` | `district.setup.manage` | Default (DAHO) | District operational setup |
| `village.manage` | `village.manage` | Default (DAHO) | District villages and geodata |
| `gram_panchayat.manage` | `gram_panchayat.manage` | Default (DAHO) | GP directory and village mappings |
| `cooperative.manage` | `cooperative.manage` / `coop.manage` | Default (DAHO) | Cooperative directory and assignments |
| `veterinary_officer.manage` | `veterinary_officer.manage` | Default (DAHO) | VO profiles and village assignments |
| `vaccine_stock.manage` | `vaccine_stock.manage` | Default (DAHO) | District vaccine inventory ledger |
| `campaign.configure` | `campaign.configure` | Default (DAHO) | Create and configure district campaigns |
| `campaign.manage` | `campaign.manage` | Default (DAHO) | Activate and manage district campaigns |
| `campaign.assign_workers` | `campaign.assign_workers` | Default (VO) | Assign Field Workers within authorised villages |
| `campaign.view` | `campaign.view` | Default (All staff) | View campaigns and targets |
| `campaign.view_assigned` | `campaign.view_assigned` | Default (FW) | View own village campaign assignments |
| `camp.propose` | `camp.propose` / `camp.coordinate` | Default (Cooperative) | Propose camp / doorstep round |
| `camp.manage` | `camp.manage` / `camp.review` | Default (VO) | Confirm, reschedule, or cancel camps |
| `camp.view_coop` | `camp.view_coop` | Default (Cooperative) | View own cooperative camps |
| `camp.view_public` | `camp.view_public` | Default (Panchayat) | View confirmed village camp dates |
| `farmer.register` | `farmer.register` | Default (FW, VO, SYS_ADMIN) | Create farmer record (staff-assisted only) |
| `farmer.verify` | `farmer.verify` | Default (FW, VO) | Verify farmer record |
| `farmer.account.provision` | `farmer.account.provision` | Explicit Grant | Provision/link login for existing farmer |
| `animal.register` | `animal.create` | Default (FW) | Primary animal registration in assigned village |
| `animal.register.fallback` | `animal.create.fallback` | Default (VO) | VO fallback with explicit FW unavailability record |
| `animal.verify` | `animal.verify` | Default (FW, VO) | Physical animal identity verification |
| `animal.merge` | `animal.merge` | Default (VO) | Merge duplicate animals with audit snapshot |
| `animal.transfer.request` | `animal.transfer.request` | Default (Farmer, Staff) | Submit ownership transfer request |
| `animal.transfer.decide` | `animal.transfer.decide` | Default (VO) | Decide ownership transfer |
| `event.create` | `event.create` | Default (FW, VO, Vaccinator) | Record routine vaccination / observation |
| `event.correct` | `event.correct` | Default (VO) | Amend/void event with mandatory reason |
| `disease.report` | `disease.report` | Default (Farmer, FW, VO) | Submit suspected disease report |
| `disease.review` | `disease.review` | Default (VO, DAHO) | Open, triage and review suspected reports |
| `disease.confirm` | `disease.confirm` | Explicit Grant Only | Confirm/disprove disease (authorised vet) |
| `field_worker.availability.record` | `field_worker.availability.record` | Default (VO) | Record formal FW availability/unavailability |
| `import.run` | `import.run` | Default (VO); Explicit (FW) | Bulk import animal and farmer records |
| `label.generate` | `label.generate` | Default (VO); Explicit (FW) | Generate QR label batch PDF |
| `aggregate.view` | `aggregate.view` | Default (All Staff, Coop, GP) | View anonymised village aggregates |
| `map.view` | `map.view` | Default (DAHO, VO) | View coverage and surveillance maps |
| `export.run` | `export.run` | Default (DAHO, VO, Admin) | Authorised data export |
| `notification.read` | `notification.read` | Default (All Users) | Read in-app notifications |
| `own.read` | `own.read` | Default (Farmer) | Read own animal profiles and due dates |

## 5. Change log

| Date | Change | Evidence | Status |
|---|---|---|---|
| 2026-10-31 | Consolidated workflow invariants, permission vocabulary, validation distinction and unresolved approvals | Project decisions recorded in handover | Documentation baseline; cross-check against workspace source files |
| 2026-10-31 | Phase 2 Documentation Finalisation: added DEC-T01..T04, DEC-Q01..Q05, canonical permission vocabulary table, and reconciled legacy aliases | Phase 1 Final Verification Report | Approved Baseline |

For every future change record date, decision, source/version, reason, impacted files, approver/evidence and tests.

