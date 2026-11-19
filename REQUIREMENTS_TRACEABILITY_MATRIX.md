# PashuRakshak Botad — Requirements Traceability Matrix

**Status:** Baseline map; exact PRD IDs, API paths and SQL table names must be reconciled against final source files before sign-off.  
**Purpose:** Prevent workflow drift between requirements, screens, APIs, permissions, database and tests.  
**Audit note (2026-10-31):** Documentation consistency audit completed. Two prior FINDING-07 (ownership_transfers) and FINDING-16 (disease.review for VET_OFFICER) resolved as false positives. Nine open conflicts remain (see WORKFLOW_CONFLICTS.md). No RTM rows changed — all RT-01 through RT-27 remain consistent with APPFLOW v0.4.

## 1. Authority and mapping rules

- APPFLOW: stakeholder workflow authority.
- PRD: functional requirements and acceptance criteria.
- TRD: technical architecture/API/sync design.
- BACKENDDATABASESCHEMA.md and final SQL: persistence structure.
- UI_UX_DESIGN.md: screens and interactions.
- STAKEHOLDER_PERMISSION_MATRIX.md: default permissions/scope.
- EDGE_CASE_CATALOGUE.md: negative and recovery tests.
- DECISION_REGISTER.md: unresolved/approved decisions.

Do not invent PRD/AC/EC IDs or table/route names. IDs below are trace IDs. Replace provisional mappings with exact identifiers after inspecting final source files; preserve existing numbering.

## 2. End-to-end traceability

| Trace ID | Requirement/outcome | Workflow | Screen IDs | API capability (exact route from TRD to be inserted) | Data domain (exact schema names to be inserted) | Permission/scope | Verification |
|---|---|---|---|---|---|---|---|
| RT-01 | DAHO manages district setup | DAHO maintains assigned district | DASH-DAHO, SETUP-VILLAGE/GP/COOP/VO | District/village/GP/cooperative/VO setup | District, village, GP, cooperative, VO, DAHO assignment | `district.setup.manage` + specific setup permissions; assigned district | Assigned/unassigned district tests |
| RT-02 | VO assigns FWs | VO assigns within authorised villages | DASH-VO, FW-ASSIGN | FW assignment | VO/FW/village assignments | VO scope | Valid/out-of-scope tests |
| RT-03 | FW unavailability evidence | Authorised actor records reason | FW-AVAILABILITY | Availability create/read/revoke | FW availability | Explicit grant and assignment | Missing/expired/revoked evidence |
| RT-04 | FW primary registration | FW registers in assigned village | ANIMAL-FORM | Animal registration | Animal, identifier, FW assignment | `animal.register` | FW allowed/out-of-scope |
| RT-05 | VO fallback registration | VO registers only with valid evidence | ANIMAL-FORM | Same registration endpoint with server fallback gate | Animal, availability, audit | `animal.register.fallback` | No/invalid/valid evidence |
| RT-06 | Farmer and login separate | Staff creates farmer; separate provisioning | FARMER-FORM, FARMER-ACCOUNT | Farmer endpoint; separate provisioning endpoint | Farmer/owner, user/account, provisioning audit | Approved staff create grant; `farmer.account.provision` | No public signup; no auto account |
| RT-07 | OTP login-only | Provisioned user authenticates | AUTH-01/02 | OTP request/verify | User/auth/session; no farmer creation | Existing provisioned account | OTP cannot create user/farmer |
| RT-08 | Internal ID distinct from optional tag | FW registers animal | ANIMAL-FORM/DETAIL | Animal/identifier | Animal, external identifier, QR | Registration permission | Null tag and duplicate tests |
| RT-09 | DAHO campaign ownership | DAHO configures campaign | CAMPAIGN-LIST/FORM | Campaign CRUD/status | Campaign, district, audit | `campaign.manage`; assigned district | DAHO allowed; others denied by default |
| RT-10 | VO assigns FWs to campaign | VO assigns within authorised village | CAMPAIGN-LIST, FW-ASSIGN | Campaign worker assignment | Campaign assignment, FW/village | VO assignment scope | Invalid village/worker |
| RT-11 | Cooperative camp proposal | Cooperative proposes; VO decides | CAMP-LIST/FORM | Camp proposal/decision | Camp, cooperative, VO, status history | `camp.propose`; VO `camp.manage` | Cooperative cannot self-confirm without grant |
| RT-12 | Camp not vaccinator authority | Separately authorised actor records vaccination | VACCINATION-FORM | Vaccination event | Vaccination event, animal, vaccinator | Explicit vaccinator permission | Camp-only actor denied |
| RT-13 | Batch optional | Vaccinator records without batch | VACCINATION-FORM | Vaccination event | Nullable batch field | Vaccinator permission | Null batch test |
| RT-14 | No mandatory VO approval | Authorised vaccinator records routine event | VACCINATION-FORM/ANIMAL-DETAIL | Vaccination event | Vaccination event/history | Vaccinator permission; no VO gate | Accepted without VO approval |
| RT-15 | VO audit/correction with reason | VO reviews/corrects | ANIMAL-DETAIL | Audit/correction endpoint | Event history/audit | Explicit correction permission | Reason required; history preserved |
| RT-16 | Vaccine stock ledger | Authorised staff receives/issues stock | STOCK-DASH/ENTRY | Stock transaction | Stock item/location/ledger | `vaccine_stock.manage` | Insufficient/concurrent/duplicate tests |
| RT-17 | Disease report remains suspected | Permitted reporter submits | DISEASE-REPORT/DETAIL | Report/attachment | Report, attachment, status history | Reporter grant/scope | No auto-confirm |
| RT-18 | Authorised veterinary review | Reviewer handles queue | DISEASE-QUEUE/DETAIL | Review/decision | Review, reviewer, decision, audit | `disease.review`; explicit confirmation grant if required | Unauthorised confirmation denied |
| RT-19 | Alert not diagnosis/outbreak | System displays report/alert correctly | Dashboard/DISEASE-DETAIL | Aggregate/alert read | Report/alert provenance | Scoped aggregate | No outbreak inference |
| RT-20 | Transfer request then decision | Requester submits; authorised role decides | TRANSFER-REQUEST/REVIEW | Transfer request/decision | Request, decision, owner history | `animal.transfer.request` / `.decide` | Owner unchanged before approval |
| RT-21 | Persistent in-app notifications | User receives/reads notice | NOTIFY-LIST | Notification create/list/read | Notification/delivery attempt | Recipient/scope | SMS failure does not remove notice |
| RT-22 | Server-side district scope | User accesses protected resource | All protected screens | All protected APIs | Assignment/resource relationships | Server-derived scope | Tampered district ID denied |
| RT-23 | Cooperative aggregate-only default | Cooperative views linked village aggregate | Dashboard/reports | Aggregate report | Due/overdue data and village grouping | Cooperative scope | Owner data not returned |
| RT-24 | Seven-day offline authorisation | Field user works offline within grant | DASH-FW/SYNC-QUEUE | Auth refresh/sync | Offline grant/device/sync metadata | Configurable grant | Expiry/re-auth tests |
| RT-25 | Pending records preserved | Logout/sync failure | SYNC-QUEUE/LOGOUT | Sync/ack endpoints | Local queue and idempotency metadata | Authenticated device/user | Pending logout/lost ACK/partial sync |
| RT-26 | Government integration pending | No live integration before approval | Admin status only if implemented | No live government route until approved | Approved config/feature flag only | Approval/credential gate | No fabricated API calls |
| RT-27 | SMS/WhatsApp simulated | In-app channel remains available | NOTIFY-LIST | Notification channel adapter | Notification/delivery status | Approved channel config only | In-app persists when provider unavailable |

## 3. Test ID convention

- `T-AUTH-*`: authentication/provisioning.
- `T-SCOPE-*`: district/village scope.
- `T-REG-*`: FW-first/VO fallback.
- `T-CAMP-*`: campaign/camp authority.
- `T-VAX-*`: vaccination/audit.
- `T-STOCK-*`: stock ledger.
- `T-DIS-*`: disease reporting/review.
- `T-TRANS-*`: ownership transfer.
- `T-NOT-*`: notifications.
- `T-OFF-*`: offline/sync.
- `T-IMP-*`: imports/QR.
- `T-SEC-*`: security/privacy.

Each trace should have a positive test and a relevant negative/edge test.

## 4. Final reconciliation checklist

- [ ] Map RT rows to actual PRD requirement IDs.
- [x] ~~Verify existing acceptance criteria IDs; map AC-21–AC-34 only if present in final PRD.~~ **RESOLVED (2026-10-31 audit):** AC-21–AC-34 are confirmed present in PRD v0.2 §15. No conditional mapping needed.
- [ ] Verify EC-52–EC-85 before using those numbers; map to actual catalogue IDs.
- [ ] Insert exact HTTP method/path from final TRD.
- [ ] Insert exact table/column names from final schema and SQL.
- [ ] Confirm permissions against schema/seed data — note CONFLICT-02, CONFLICT-06, CONFLICT-11 in WORKFLOW_CONFLICTS.md affect permission names and role seeds.
- [ ] Confirm screen IDs in UI_UX_DESIGN — BLOCKED: UI_UX_DESIGN.md is absent; only legacy PDF exists (see DOCUMENTATION_AUDIT_REPORT.md FINDING-01).
- [ ] Confirm test IDs in test plan/code.
- [ ] Record unresolved mappings in DECISION_REGISTER.

Do not claim full traceability while mappings remain provisional.
