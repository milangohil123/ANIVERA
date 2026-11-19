**# PRD — Product Requirements Document**

**\*\*Project:\*\*** PS000195 — Digital Livestock Vaccination Tracking and Disease Early-Warning Platform (District Development Office, Botad)

**\*\*Working name:\*\*** PashuRakshak Botad *\*(provisional placeholder — not an official government product name; no government logos or seals)\**

**\*\*Document:\*\*** 2 of 7 · **\*\*Version:\*\*** v0.2 (APPFLOW v0.4 and BACKENDDATABASESCHEMA v0.4 aligned draft) · **\*\*Date:\*\*** 31 October 2026

**\*\*Design baseline:\*\*** UI/UX Design Specification v0.2.1 (Gujarati UI, green design system, 29 mockups)

**\*\*Language:\*\*** English. The product UI is Gujarati-only; numbers use Western digits.



\> **\*\*Status transparency.\*\*** This PRD describes approved/proposed requirements; nothing described here is claimed to be implemented. The UI/UX mockups are illustrative designs. Pilot figures are planning assumptions. Vaccination schedules, eligibility rules, coverage targets, stock handling policies, Field Worker availability policy and outbreak thresholds are *\*To be configured and approved by the Department\** where applicable. Bharat Pashudhan / 1962 App integration is *\*Pending departmental approval and authorized API access\**. The detailed workflow baseline is APPFLOW v0.4; the database design baseline is BACKENDDATABASESCHEMA v0.4. Neither document implies implementation or live government integration.



**## Contents**

1 Document control · 2 Background and problem · 3 Goals, non-goals, success measures · 4 Existing systems and gaps · 5 Stakeholders and personas · 6 Scope and pilot assumptions · 7 Business workflow · 8 Business rules · 9 User stories · 10 Functional requirements · 11 Module summaries · 12 Role and permission requirements · 13 Non-functional requirements · 14 Data integrity · 15 Edge-case requirements · 16 Acceptance criteria · 17 Assumptions, dependencies, risks · 18 Pending approvals · 19 Glossary and traceability



**---**

**## 1. Document control**

**### 1.1 Labels used in all seven documents**

\| Label | Meaning |

\|---|---|

\| **\*\*[OFFICIAL]\*\*** | Stated in PS000195 or the original master prompt — mandatory |

\| **\*\*[PROPOSED]\*\*** | Proposed design decision satisfying an official requirement — changeable |

\| **\*\*[ASSUMPTION]\*\*** | Pilot planning assumption — not Department-confirmed |

\| **\*\*[PENDING]\*\*** | Needs Department decision, access or credentials |

\| **\*\*[DEMO]\*\*** | Illustrative/demonstration data |



**### 1.2 IDs and priority**

\`FR-\<MODULE>-\<NN>\` functional · \`NFR-\<AREA>-\<NN>\` non-functional · \`BR-NN\` business rules · \`US-NN\` user stories · \`EC-NN\` edge cases · \`AC-NN\` acceptance. Priority: **\*\*M\*\*** must, **\*\*S\*\*** should, **\*\*C\*\*** could. Basis: **\*\*PS\*\*** problem statement · **\*\*MP\*\*** master prompt · **\*\*DEC\*\*** recorded decision · **\*\*DES\*\*** proposed design.



**### 1.3 Approved decisions (frozen)**

\| Decision | Value |

\|---|---|

\| Interface language | Gujarati-only application UI and UI/UX mockups; the six other documents are English |

\| Digits | Western (0–9) |

\| Vaccine batch number | Optional (record when available) |

\| Offline authorisation | Default 7 days, administrator-configurable; then online re-authentication before further offline work; pending records never lost |

\| Logout | Never deletes pending records |

\| QR labels | Printable multi-label PDF for ordinary printers (no direct label-printer support) |

\| Cooperative access | Village-level aggregate overdue counts; owner details only for specifically authorised, consented outreach |

\| Verification | No mandatory approval of routine vaccination entries; officer may correct/audit; disease confirmation requires authorised veterinary review |

\| Campaigns | DAHO creates/configures district campaigns using Department-approved programme/schedule information; Veterinary Officer reviews campaigns, assigns Field Workers within authorised villages and monitors; Field Worker performs assigned activities |

\| Pilot | 10 villages · 15 officers/workers · ≈20,000 animals · one vaccination cycle **\*\*[ASSUMPTION]\*\*** |

\| Species | Cattle, buffalo, goats, sheep |

\| Programme categories | FMD, HS, BQ, Brucellosis, PPR — applicability and schedule **\*\*[PENDING]\*\*** |

\| IDs | Internal animal ID is the primary key; Bharat Pashudhan 12-digit tag is a separate optional unique field |

\| Farmer records and login | No public signup or farmer self-registration. Field Worker, Veterinary Officer or System Administrator creates the farmer record; an authorised staff member may provision/link/activate the farmer login. OTP, if enabled, is login-only and never creates a farmer record/account |
\| Animal registration priority | Assigned Field Worker is the primary animal registrar; Veterinary Officer registration is fallback-only when the assigned Field Worker is explicitly recorded as unavailable, with reason and audit. System Administrator and farmer have no animal-registration permission |
\| DAHO operations | DAHO manages district setup, villages/geodata, Gram Panchayats, dairy cooperatives, Veterinary Officer records/assignments, vaccine stock and campaigns within assigned district scope |
\| Camp coordination | Cooperative coordinator may propose a camp where assigned; Veterinary Officer reviews and confirms/reschedules/rejects; government-organised camps may be proposed/confirmed by VO; only authorised vaccinators administer and record vaccination |
\| Notifications | In-app notifications are the baseline and must work without SMS; SMS is simulated until provider credentials, permissions and approvals exist |
\| Farmer account provisioning | Farmer record creation and farmer login account provisioning are separate actions; a farmer account can only be linked to an existing staff-created farmer record |

\| Reminders | In-app lists, SMS via pluggable provider (simulated until approved), assisted follow-up lists |

\| Stack | React + Vite PWA, Dexie/IndexedDB, FastAPI, PostgreSQL (+PostGIS if justified), MapLibre, PostgreSQL-backed jobs (Redis only if justified), REST |



**---**

**## 2. Background and problem  \*\*[OFFICIAL]\*\***

\- **\*\*Problem ID:\*\*** PS000195 · **\*\*Organisation:\*\*** District Development Office, Botad · **\*\*Sector:\*\*** Agritech.

\- **\*\*Problem:\*\*** digital tracking of livestock vaccination and early warning of disease outbreaks using ear-tag QR codes.



**\*\*Current situation:\*\*** vaccination/treatment records are mostly on paper; animal-wise histories are hard to access; some animals are missed in campaigns; disease reports reach veterinary officers late; staff cover many animals and villages with limited resources; internet is weak so online-only apps fail; owners need simple Gujarati reminders.



**\*\*Expected outcomes:\*\*** QR-based identification and registration; digital vaccination/treatment histories; offline recording with reliable synchronisation; automatic reminders and due lists; map-based district disease surveillance; bulk import of existing records; improved coverage and faster investigation.



**### 2.1 Problem → solution mapping \*\*[PROPOSED]\*\***

\| Problem | Solution element | Requirements |

\|---|---|---|

\| Paper records | Digital animal profile with append-only events | FR-ANM, FR-VAC |

\| History hard to access | QR scan/search → profile from local store | FR-QR, FR-OFF |

\| Animals missed | Campaign lists, due/overdue lists, village coverage | FR-CAMP, FR-SCH, FR-REM, FR-MAP |

\| Late disease reports | Structured reporting (offline), alert rules, investigation | FR-DIS, FR-SYNC |

\| Limited staff | Assigned-village dashboards, bulk import, district map | FR-IMP, FR-MAP, FR-DAHO |

\| Weak internet | Offline-first PWA, persistent queue, safe sync | FR-OFF, FR-SYNC |

\| Gujarati reminders | Templates, in-app lists, assisted follow-up, SMS adapter | FR-REM, FR-FARM, FR-HELP |



**---**

**## 3. Goals, non-goals and success measures**

**### 3.1 Goals \*\*[OFFICIAL]\*\***

1\. Identify every animal with a unique reliable identifier linked to its QR tag.

2\. Maintain complete, traceable vaccination and treatment histories.

3\. Enable offline field work and safe synchronisation.

4\. Identify due/overdue animals and prepare simple Gujarati reminders.

5\. Import existing records in bulk and generate QR label PDFs for valid animals.

6\. Show vaccination coverage and disease reports on separate map layers and flag possible clusters for authorised investigation.

7\. Protect owner data (authentication, authorisation, audit); work well on phones and desktop.

8\. Provide DAHO district-level operational setup and management for villages/geodata, Gram Panchayats, dairy cooperatives, Veterinary Officers, vaccine inventory and vaccination campaigns.

9\. Support coordinated camps, explicit Field Worker availability, staff-controlled farmer provisioning, animal verification and ownership-transfer workflows.



**### 3.2 Non-goals \*\*[PROPOSED]\*\***

\| Not in this version | Reason |

\|---|---|

\| Automated diagnosis, outbreak declaration or prediction | Medical validation belongs to the Department |

\| System-supplied vaccine intervals, doses, eligibility, treatment advice | Must come from the approved programme |

\| Voice calling, IVR, auto-dialling | Excluded; staff call with their own phones |

\| Real SMS delivery without provider approval | Simulated until approved |

\| Rebuilding Bharat Pashudhan / 1962 App functions | Avoid duplication |

\| Hindi/English UI, language selector | Gujarati-only UI |

\| Direct label-printer integration | PDF labels only |

\| Payments, marketplace, breeding, milk-yield | Outside PS000195 |

\| Native iOS/Android apps | One installable PWA |

\| Scraping or unauthorised access to government systems | Prohibited |



**### 3.3 Success measures \*\*[ASSUMPTION]\*\* — baselines and targets to be agreed with the Department**

\| Measure | How measured |

\|---|---|

\| Vaccination coverage of eligible animals per approved campaign | Verified events ÷ eligible animals |

\| Animals missed at campaign close | Eligible animals without a valid event |

\| Share of pilot animals with verified QR tag/profile | Verified ÷ registered |

\| Time from suspected report to officer review | created_at vs reviewed_at |

\| Offline events synced without loss | Synced ÷ created offline; zero silent losses |

\| Import quality | Imported vs rejected rows; duplicates prevented |

\| Reminder reach | Reminders generated and provider-evidenced deliveries (when SMS enabled) |



**---**

**## 4. Existing government systems and gaps  \*\*[PENDING]\*\***

Bharat Pashudhan and the 1962 Livestock Owner App provide related services. This product does **\*\*not\*\*** assume access to either and invents no API, credential or sandbox.



\| Topic | Known from provided information | To verify with the Department |

\|---|---|---|

\| Official animal identifier | 12-digit Bharat Pashudhan tag (preserved as a separate field) | Format rules, issuance, who may register |

\| Farmer onboarding | Farmer record is created by authorised staff (FW, VO or System Administrator); farmer login is separately provisioned/linked by authorised staff; OTP, if enabled, is login-only; no public signup/self-registration | Confirm official departmental onboarding and identity-verification method |

\| APIs / sandbox | None assumed | Authorised interface, permissions, rate limits |

\| Source of truth | Not decided | Ownership of animal identity and vaccination history; sync direction |

\| Privacy | Owner data is personal data | Lawful basis, data-sharing agreement |

\| 1962 Livestock Owner App | Owner-facing services exist | Overlap with reminders/help requests |



**\*\*Gaps this product targets (to be confirmed):\*\*** offline-first field recording with safe sync; QR label PDFs from bulk imports; village campaign lists with Gujarati reminder due lists; two-layer coverage/disease map with stale/insufficient states; district early-warning workflow.

**\*\*Integration stance:\*\*** a Bharat Pashudhan **\*\*adapter boundary\*\*** only, status *\*Pending departmental approval and authorized API access\**. A separate demonstration environment uses synthetic or authorised sample data. No scraping.



**---**

**## 5. Stakeholders and personas  \*\*[OFFICIAL]\*\***

\| Role | Who | Needs / responsibilities | Key restrictions |
\|---|---|---|---|
\| Veterinary Officer (VO) / Livestock Inspector | Qualified veterinary staff | Review farmer/animal verification; register animals only as fallback when assigned Field Worker is explicitly unavailable; record veterinary activities; review disease reports; perform final disease decisions only with explicit grant; import/labels where granted; assign Field Workers within authorised villages; review/confirm/reschedule/reject camps; audit/correct routine records with reason; decide ownership transfers | Assigned district/villages only; cannot create/configure district campaigns; animal registration is fallback-only; disease confirmation requires explicit `disease.confirm` grant; vaccine administration requires valid vaccinator authorisation |
\| Field Worker (FW) / Livestock Assistant | Field staff; not assumed to be veterinarians | Primary animal registrar in assigned villages; create farmer records and provision farmer access where granted; record animal verification evidence; offline scan/search; record vaccination/treatment/observation; submit suspected disease reports; investigate assigned reports; perform assigned campaign/camp activities; support callbacks and ownership-transfer verification | Assigned villages only; cannot confirm disease; cannot configure campaigns; cannot use VO fallback permission; vaccine administration is subject to vaccinator authorisation |
\| Livestock Owner / Farmer | Animal owners | Log in only after an authorised staff member creates the farmer record and provisions/links an account; view own animals/history/reminders; submit sick-animal report/help request; receive in-app status updates | No public signup/self-registration; OTP, if enabled, is login-only; own records only; cannot register animals or edit verified records |
\| Dairy Cooperative Staff | Cooperative coordinators | View village-level aggregate overdue counts; propose/coordinate camps in assigned villages; inform members; use owner contact lists only when specifically authorised and consent/lawful basis is recorded | No vaccination authority by cooperative role alone; no individual medical histories; no owner-level details by default |
\| District Animal Husbandry Officer (DAHO) | District operational decision-maker | Manage district operational setup: villages and verified geodata, Gram Panchayats and village mappings, dairy cooperatives and served-village mappings, Veterinary Officer records/authorised village assignments, vaccine products/stock lots/stock movements, district campaigns; monitor coverage, disease surveillance, investigations, camps, stock and reports; authorised district exports and audit summaries | Assigned district scope only; no animal registration; no direct editing of immutable field-event facts; cannot create System Administrator or another DAHO unless separately approved; disease confirmation only with explicit permission |
\| Gram Panchayat Staff | Village coordinators | View approved village-level aggregate progress and confirmed camp dates; coordinate awareness and outreach | Aggregate-only; no owner-level or animal medical records; no vaccination authority |
\| System Administrator | Platform/technical administration staff | Create/activate DAHO and staff platform accounts; manage platform access, roles, technical configuration, system settings, integration status, security, job/sync monitoring and platform audit; create farmer records/provision farmer accounts where explicitly granted | Not district operational owner; does not manage district campaigns, vaccine stock or operational village/cooperative/VO setup under DAHO workflow; no animal registration; no veterinary activity; no default access to medical histories |



**\*\*Personas [PROPOSED]:\*\*** (1) Field worker on patchy 3G recording \~80 vaccinations offline and syncing in the evening — fears lost/duplicate records. (2) Officer importing a legacy spreadsheet and reviewing suspected FMD reports — fears duplicates and overwritten identities. (3) Farmer without a smartphone calling the village worker — fears a lost request. (4) District officer watching coverage and clusters — fears false safety and inflated clusters.



**---**

**## 6. Scope and pilot assumptions**

**\*\*In scope [OFFICIAL]:\*\*** QR identification/registration and label PDFs; staff-controlled farmer record creation and optional farmer login provisioning; Field Worker-first animal registration with Veterinary Officer fallback only on explicit recorded unavailability; animal/farmer verification; vaccination/treatment/observation events; offline-first PWA and sync; configurable approved schedules, due lists and Gujarati reminder messages; bulk Excel/CSV import; disease reporting, attachments, veterinary reviews, alert rules and investigations; two-layer map; DAHO district operations (villages/geodata, Gram Panchayats, dairy cooperatives, Veterinary Officers/assignments, vaccine stock and campaigns); camp proposal/review/confirmation/staffing/closure; Field Worker availability records; ownership transfers and duplicate handling; persistent in-app notifications; portals for all seven stakeholder groups; audit logging; vet-assisted callback workflow.



\| Pilot assumption **\*\*[ASSUMPTION]\*\*** | Value |

\|---|---|

\| Villages | 10 (names/coordinates to be verified) |

\| Veterinary officers / field workers | 15 |

\| Animals | ≈ 20,000 (cattle, buffalo, goats, sheep) |

\| Vaccination cycles | 1 |

\| Devices | Mid-range Android + Chrome; desktop for officers |



**\*\*Release approach [PROPOSED]:\*\*** one pilot release delivered in phases (see IMPLEMENTATION_PLAN.md). A feature is complete only when its workflow is implemented **\*\*and tested\*\***.



**---**

**## 7. Business workflow  \*\*[OFFICIAL]\*\***

1\. **\*\*Platform and district preparation\*\*** — System Administrator creates/activates platform accounts and technical settings. DAHO configures district villages and verified geodata, Gram Panchayats, dairy cooperatives, Veterinary Officer records/authorised village assignments, vaccine stock and campaigns within the assigned district.

2\. **\*\*Farmer record creation and login provisioning\*\*** — Field Worker, Veterinary Officer or System Administrator creates the farmer record. A farmer login is a separate, optional staff-provisioned link to an existing farmer record. No public signup/self-registration; OTP, if enabled, is login-only.

3\. **\*\*Animal registration\*\*** — assigned Field Worker is primary registrar. Veterinary Officer is fallback-only when explicit authorised unavailability is recorded with reason. Validate farmer, village, external tag and duplicate candidates; do not invent an animal or Bharat Pashudhan tag.

4\. **\*\*Verification and QR identification\*\*** — record farmer/animal verification separately; generate internal animal ID and QR token according to the approved lifecycle; printable PDF labels only for eligible server-side records.

5\. **\*\*Campaign and camp preparation\*\*** — DAHO creates/configures campaigns using Department-approved schedules/programmes. Veterinary Officer reviews campaigns and assigns Field Workers within authorised villages. Cooperative may propose a camp; VO reviews and confirms, reschedules or rejects it. Government-organised camp variants follow APPFLOW v0.4.

6\. **\*\*Veterinary activity\*\*** — authorised vaccinator administers vaccine; authorised staff record the event with recorder and administrator identities, optional batch, campaign/camp linkage where applicable. Routine vaccination entries do not require mandatory officer approval.

7\. **\*\*Offline save and synchronisation\*\*** — save locally with stable event ID and persistent queue; validate/idempotently sync; preserve pending data and mark SYNCED only after server acknowledgement.

8\. **\*\*Reminders and follow-up\*\*** — due dates only from approved schedule versions; in-app reminders/lists always work; SMS remains simulated until approved provider setup.

9\. **\*\*Disease reporting and review\*\*** — farmer/staff can submit suspected report; animal ID/photo may be optional where APPFLOW allows; VO reviews and assigns investigation; only a user with explicit veterinary confirmation permission can record final confirmed/not-confirmed outcome with basis/reason.

10\. **\*\*Ownership transfer and correction\*\*** — request, field verification, VO decision and atomic completion; preserve animal history/events and audit all transitions.

11\. **\*\*District monitoring\*\*** — DAHO dashboard/map distinguishes confirmed, suspected, incomplete, stale and pending-offline data; absence of reports is never shown as disease-free.



See APPFLOW\.md for detailed flows and error branches.



**---**

**## 8. Business rules**

\| ID | Rule |

\|---|---|

\| BR-01 | Vaccination, treatment and observation events are immutable. A correction is a linked amendment/void with reason, never an overwrite or delete. |

\| BR-02 | Due and overdue dates are computed only from an approved vaccination-schedule version. Without one the system shows ‘schedule not approved’ and creates no due dates. No intervals, doses or eligibility rules are hardcoded. |

\| BR-03 | Event IDs are generated on the device at creation and are the idempotency key; the server never creates a second event for the same ID. |

\| BR-04 | A record becomes SYNCED only after the server acknowledges acceptance. |

\| BR-05 | Pending (PENDING_SYNC, SYNC_FAILED, NEEDS_REVIEW) records are never deleted by logout, session expiry, offline-period lapse or app upgrade. |

\| BR-06 | After 7 days (default, configurable) without online authentication, further offline work requires online re-authentication; pending records remain stored and sync afterwards. |

\| BR-07 | An unknown animal is never given an invented profile or history; it follows registration/verification. |

\| BR-08 | Labels are generated only for animals registered or verified on the server; a QR encodes only an opaque identifier. |

\| BR-09 | A readable QR does not prove physical identity; identity status is tracked separately. |

\| BR-10 | Vaccination coverage and disease surveillance are separate layers; thresholds are configurable and Department-approved. |

\| BR-11 | Absence of reports is never shown as disease-free; stale or insufficient data is grey. |

\| BR-12 | Only users with authorised veterinary review permission can confirm or disprove a disease case; confirmations can be reversed only with reason and audit. |

\| BR-13 | Alerts flag areas for review; the system does not diagnose or declare outbreaks. |

\| BR-14 | Duplicate disease reports do not inflate clusters; counts are after de-duplication. |

\| BR-15 | DAHO creates/configures/activates district campaigns within assigned district scope using Department-approved programme/schedule information. Veterinary Officers review campaigns, assign Field Workers only within authorised villages and monitor progress. Field Workers perform assigned activities; cooperative staff cannot create campaigns or vaccinate by virtue of cooperative role. |

\| BR-16 | Routine vaccination entries need no mandatory officer approval; each keeps who recorded it and when; officers may correct or audit. |

\| BR-17 | Batch number is optional on vaccination entry. |

\| BR-18 | Dairy cooperative staff see village-level aggregate overdue counts; owner details only for specifically authorised, consented outreach; never medical histories. |

\| BR-19 | Gram Panchayat staff see aggregate village information only. |

\| BR-20 | Farmers see only their own records. |

\| BR-21 | Every protected operation is authorised on the backend by role, village scope and purpose; denied attempts are audited. |

\| BR-22 | Imports never overwrite a verified identity with conflicting data and are safe to retry. |

\| BR-23 | Reminder status must reflect evidence: ‘delivered’ only with provider confirmation; otherwise scheduled/queued/sent/failed/simulated. |

\| BR-24 | Owner contact for outreach requires consent or lawful basis; owner-data views and exports are audited. |

\| BR-25 | Help requests get a reference number and five statuses; callbacks are made by staff; no IVR/auto-dialling; the farmer’s phone may be missing or unverified. |

\| BR-26 | Dates cannot be in the future and not before the animal’s birth. |

\| BR-27 | Bharat Pashudhan integration remains behind an adapter marked ‘Pending departmental approval and authorized API access’. |

\| BR-28 | All names, counts and thresholds in demos are labelled illustrative; Gujarati UI, Western digits. |
\| BR-29 | Farmer record creation is staff-controlled. Only Field Worker, Veterinary Officer or System Administrator may create a farmer record under the applicable permission and scope. Farmer public signup/self-registration is prohibited. |
\| BR-30 | Farmer account provisioning is separate from farmer record creation. An account may be linked/activated only after an existing farmer record exists; OTP, if enabled, authenticates an existing provisioned account and never creates a farmer/account/link. |
\| BR-31 | Field Worker is the primary animal registrar for assigned villages. Veterinary Officer registration is fallback-only when the assigned Field Worker is explicitly recorded as unavailable; fallback requires a reason/evidence reference and audit. If the Field Worker is available, fallback is blocked. |
\| BR-32 | The exact authority, effective period and evidence for Field Worker availability/unavailability remain pending Department decision. No automatic attendance timeout or presumed unavailability is invented. |
\| BR-33 | System Administrator and Farmer have no animal-registration permission under the current approved workflow. DAHO also has no animal-registration permission. |
\| BR-34 | DAHO operational writes are restricted to the district(s) explicitly assigned to that DAHO; target district must be derived/verified server-side, not trusted from client input. |
\| BR-35 | DAHO manages district villages/geodata, Gram Panchayats, dairy cooperatives, Veterinary Officer records/authorised assignments, vaccine stock and district campaigns. System Administrator retains platform-level access and technical configuration. |
\| BR-36 | A camp is distinct from a campaign. A cooperative coordinator may propose a camp within assigned scope; Veterinary Officer reviews and confirms/reschedules/rejects. Government-organised camps may be initiated by VO. Confirmation requires operational checks including overlap, staffing and vaccine availability information; no authorised vaccinator means the camp cannot be confirmed. |
\| BR-37 | Camp assignment does not grant vaccinator authority. Only a person with valid approved vaccinator authorisation may administer/record vaccination as administrator; event recorder and vaccine administrator are stored separately. |
\| BR-38 | Vaccine stock movements must be recorded as a ledger and update on-hand balances transactionally. Batch/expiry/location are recorded when available; the system must not invent dosage, medical suitability or departmental stock policy. |
\| BR-39 | In-app notifications and work-list hand-offs are the baseline and must not depend on SMS. SMS remains simulated until provider credentials, permissions and approvals exist. |
\| BR-40 | Ownership transfer is a controlled workflow: request, Field Worker verification where assigned, Veterinary Officer decision, dispute/rejection handling and atomic completion. Rejection/dispute leaves current ownership unchanged; event history is never moved or deleted. |
\| BR-41 | Disease report submission source and any staff submission on behalf of a farmer must be recorded. Disease review history is separate from the current report status and investigation actions. |
\| BR-42 | Cooperative and Gram Panchayat users receive aggregate-only information by default. Individual owner contact is available only for specifically authorised, consented/lawful-basis outreach; medical histories are not exposed. |



**## 9. User stories**



Format: *\*As a role I want … so that …\** with acceptance criteria. Stories trace to requirements in §10.



\| ID | Role | I want to… | So that… | Acceptance | FR |

\|---|---|---|---|---|---|

\| US-01 | Field Worker | scan an ear-tag QR with no internet and open the animal’s profile | I can check history in the field | Given the animal was downloaded, when I scan, then the profile opens from the local store in under 1 s | FR-QR-04, FR-OFF-03 |

\| US-02 | Field Worker | search by tag number or owner name when the QR is damaged | work is not blocked | Given a damaged QR, when I search, then matching cached animals are listed; reprint can be requested | FR-QR-05, FR-ANM-07 |

\| US-03 | Field Worker | record a vaccination offline, with optional batch number | the history is complete even without signal | Event saved with event ID, performer, time; shown as PENDING_SYNC; batch not required | FR-VAC-01, FR-OFF-04 |

\| US-04 | Field Worker | see which of my records are saved only on my phone | I know what is not yet confirmed | Every record shows its sync state; SYNCED only after server ack | FR-OFF-05, FR-SYNC-06 |

\| US-05 | Field Worker | sync pending records and see per-record results | I can fix only what failed | Accepted → SYNCED; rejected → SYNC_FAILED with reason; duplicates not created | FR-SYNC-01..04 |

\| US-06 | Field Worker | log out without fear of losing unsynced work | shared or low-battery phones are safe | Logout keeps pending records protected; they sync after next login | FR-OFF-09, FR-AUTH-04 |

\| US-07 | Field Worker | report a suspected disease case offline | officers get early information | Report created as suspected; queued; cannot be confirmed by me | FR-DIS-01, FR-DIS-02 |

\| US-08 | Field Worker | register a draft for an unknown animal | unknown animals are not ignored | Draft stored; marked unverified; verified and de-duplicated online | FR-OFF-08, FR-ANM-03 |

\| US-09 | Field Worker | see my assigned campaign activities and due animals | I know whom to visit | Lists come from approved schedule; ‘schedule not approved’ banner if absent | FR-SCH-02, FR-CAMP-04 |

\| US-10 | Field Worker | register a callback request for a farmer without a phone | the farmer is not left out | Reference number, status Submitted, appears in follow-up list | FR-HELP-01..03 |

\| US-11 | Field Worker (primary) / Veterinary Officer (fallback only) | register animals individually or process import rows under the FW-first rule | one animal has one identity without bypassing registrar priority | FW registers when assigned and available; VO row is accepted only with explicit unavailability evidence/reason; duplicates flagged | FR-ANM-03, FR-ANM-10, FR-FW-02/03, FR-IMP-03 |

\| US-12 | Veterinary Officer | upload an Excel/CSV, map columns and preview errors before import | bad rows do not corrupt data | Row-level errors shown; downloadable report; valid rows imported; retry safe | FR-IMP-01..09 |

\| US-13 | Veterinary Officer | download a PDF of QR labels for valid animals | I can print them on an ordinary printer | PDF contains only registered/verified animals; reprint requires reason | FR-QR-02, FR-QR-03 |

\| US-14 | Veterinary Officer | correct a wrongly entered vaccination with a reason | history stays trustworthy | A linked amendment is created; original preserved; audit entry | FR-VAC-02, FR-VAC-04 |

\| US-15 | Veterinary Officer | review and confirm or disprove suspected disease reports | only verified cases are confirmed | Confirm needs basis; disprove needs reason; duplicates merged | FR-DIS-02, FR-DIS-03 |

\| US-16 | Veterinary Officer | view campaigns, assign field workers in my villages and monitor progress | coverage improves | Assignment limited to authorised villages; cannot create campaigns | FR-CAMP-02 |

\| US-17 | Veterinary Officer | see due/overdue lists and follow-up tasks | no animal is missed | List by village with export (formula-safe) | FR-REM-01, FR-REM-06 |

\| US-18 | Veterinary Officer | merge duplicate animal records | history is consolidated | Merge preserves events; old ID/QR resolve to survivor | FR-ANM-06 |

\| US-19 | Farmer | log in with mobile number and OTP and see my animals | I know their vaccination status | Only my animals; neutral errors for unknown numbers | FR-AUTH-02, FR-FARM-01 |

\| US-20 | Farmer | receive a simple Gujarati reminder | I remember due vaccinations | Reminder generated; status honest (simulated until provider approved) | FR-REM-02, FR-REM-04 |

\| US-21 | Farmer | report a sick animal | help arrives sooner | Request with reference number routed to village staff | FR-HELP-04 |

\| US-22 | Farmer without smartphone | have staff register my request and call me back | I get help without an app | Request statuses visible to staff; attempts logged | FR-HELP-01..03 |

\| US-23 | Dairy Cooperative Staff | see village-level progress and overdue counts | I can support campaigns | Aggregate only; no individual medical history | FR-DAIRY-01 |

\| US-24 | Dairy Cooperative Staff | get an outreach list of consenting owners where I am authorised | I can inform members | Only authorised, consented owners; views audited | FR-DAIRY-01, FR-PERM-04 |

\| US-25 | District Officer | see coverage and overdue counts by village | I can prioritise villages | Grey for stale/insufficient data | FR-DAHO-01, FR-MAP-04 |

\| US-26 | District Officer | switch between vaccination and disease map layers | I do not mix coverage with risk | Layers separate with own legends | FR-MAP-01 |

\| US-27 | District Officer | be alerted when a configurable rule is met and assign an investigation | early action | Alert is a flag; officer assigned; audit trail | FR-DIS-04, FR-DIS-05 |

\| US-28 | District Officer | see data-quality problems and export authorised data | I can trust reports | Exports logged, formula-safe, minimal owner data | FR-DAHO-01, FR-IMP-09 |

\| US-29 | Gram Panchayat Staff | see village progress and coordinate awareness | villagers attend camps | Aggregate only; individual records denied | FR-GP-01 |

\| US-30 | System Administrator | create users, assign roles and villages | access is least-privilege | Roles and villages enforced by backend | FR-ADM-01 |

\| US-31 | DAHO | create/configure/activate district campaigns using Department-approved programme/schedule references | district work follows approved programme information | Campaign is district-scoped; no activation without approved schedule reference; VO assigns workers only within authorised villages | FR-CAMP-01, FR-CAMP-05/06, FR-SCH-01 |

\| US-32 | System Administrator | configure alert rules and thresholds | Department parameters can change without code | Versioned configuration, audited | FR-DIS-04, FR-ADM-02 |

\| US-33 | System Administrator | monitor imports and sync, deactivate lost devices/users | operations stay healthy | Deactivation blocks new syncs; late events held for review | FR-ADM-02, FR-AUTH-05 |

\| US-34 | DAHO | import/correct verified village geodata in my assigned district | the map is accurate | Cross-district writes denied; missing/unverified coordinates shown as ‘location unavailable’ | FR-MAP-06, FR-DAHO-02 |

\| US-35 | Any staff user | be asked to re-authenticate online after 7 days offline without losing pending records | security and data safety both hold | Prompt appears; after login pending records sync | FR-AUTH-04 |



**\*\*Additional user stories for APPFLOW v0.4 alignment [PROPOSED / MUST]\*\***

| ID | Role | I want to… | So that… | Acceptance | FR |
|---|---|---|---|---|---|
| US-36 | DAHO | create/update villages and import verified geodata in my assigned district | district master data is correct | Cross-district write denied; invalid/unverified coordinates are not published | FR-DAHO-02 |
| US-37 | DAHO | create Gram Panchayats and map villages | village governance mapping is maintained | Duplicate/invalid mappings rejected; changes audited | FR-DAHO-03 |
| US-38 | DAHO | register dairy cooperatives and map served villages | coordination scope is explicit | Staff see only assigned cooperative/villages | FR-DAHO-04 |
| US-39 | DAHO | create/manage Veterinary Officer records and authorised village assignments | officer access matches operational responsibility | District scope and active status validated; every assignment audited | FR-DAHO-05 |
| US-40 | DAHO | record vaccine products, stock lots and stock movements | district stock is traceable | Ledger and on-hand balance update atomically; invalid negative balance rejected | FR-INV-01 |
| US-41 | DAHO | create/configure/activate district vaccination campaigns | district work follows approved programme information | No campaign activation without approved schedule reference and required campaign data | FR-CAMP-05 |
| US-42 | Veterinary Officer | record an explicit Field Worker unavailability status/reason where authorised | fallback registration is controlled | No fallback when assigned FW is available; actor/reason/time retained | FR-FW-01 |
| US-43 | Veterinary Officer | register an animal only as fallback when assigned FW is unavailable | animals can still be registered without bypassing priority | Fallback blocked without current explicit unavailability evidence | FR-ANM-10 |
| US-44 | Cooperative Coordinator | propose a camp for a served village | farmers can be coordinated | Only assigned cooperative staff/villages may propose; proposal does not mean confirmed | FR-CAMP-06 |
| US-45 | Veterinary Officer | review, confirm, reschedule or reject a camp | only operationally feasible camps proceed | Overlap/staff/stock checks; rejection/reschedule reason; authorised staff assigned | FR-CAMP-07 |
| US-46 | Authorized vaccinator | record vaccination at a confirmed camp | camp activity is traceable | Vaccinator authorisation checked; event linked to camp; recorder and administrator distinguished | FR-CAMP-08 |
| US-47 | Staff member | create a farmer record and separately provision login if requested | farmer data and account access are controlled | No public signup; account cannot exist without staff-created farmer record | FR-FARM-02 |
| US-48 | Farmer | log in after staff provisions my account | I can view only my own linked records | OTP only authenticates existing account; unknown/unprovisioned number cannot create account | FR-FARM-03 |
| US-49 | Veterinary Officer | review disease report and record review history | status changes remain traceable | Confirmed requires explicit `disease.confirm` grant and clinical basis; not-confirmed requires reason | FR-DIS-07 |
| US-50 | Requester / VO | request and decide an animal ownership transfer | owner and village history remains correct | Dispute/rejection leaves current owner unchanged; completion is atomic and audited | FR-ANM-11 |
| US-51 | All authorised roles | receive in-app notifications for hand-offs | work does not depend on SMS | Notification persisted and visible to recipient; SMS status is separate/simulated until approved | FR-NOT-01 |

**## 10. Functional requirements**

Priority M/S/C · Basis PS/MP/DEC/DES.



**### AUTH · Authentication and authorisation**

\| ID | Requirement | Pri | Basis |

\|---|---|---|---|

\| FR-AUTH-01 | Staff sign in with username and password; accounts and roles are created by the administrator (no self-signup). | M | DES/MP |

\| FR-AUTH-02 | Farmers may sign in only after an authorised Field Worker, Veterinary Officer or System Administrator has created the farmer record and provisioned/linked an active farmer login. No public signup/self-registration. OTP, if enabled, authenticates an existing provisioned account only and never creates a farmer/user/link. Use neutral responses for unknown or unprovisioned numbers. | M | APPFLOW v0.4 |

\| FR-AUTH-03 | Sessions expire; after expiry the user re-authenticates and local pending records stay protected and syncable. | M | MP |

\| FR-AUTH-04 | Offline authorisation lasts a default of 7 days (administrator-configurable). After that the app requires online re-authentication before further offline work. Pending records are never lost; they stay stored and sync after re-authentication. | M | DEC |

\| FR-AUTH-05 | Deactivating a user revokes sessions; later syncs from that user are rejected and held for officer review (not silently accepted or dropped). | M | MP |

\| FR-AUTH-06 | Every protected API operation enforces role, assigned village scope and purpose on the backend. UI hiding is never the control. | M | MP |

\| FR-AUTH-07 | Rate limiting and temporary lockout for repeated failed logins and OTP requests. | M | MP |



**### ANM · Animals and owners**

\| ID | Requirement | Pri | Basis |

\|---|---|---|---|

\| FR-ANM-01 | Register an animal with species (cattle, buffalo, goat, sheep), breed, sex, age/date of birth, owner, village and optional 12-digit Bharat Pashudhan tag. Registration actor must satisfy the FW-primary / VO-fallback rule in FR-ANM-10 and FR-FW-01..04. | M | PS/APPFLOW v0.4 |

\| FR-ANM-02 | Each animal has a unique internal animal ID (primary key). The 12-digit tag is a separate field, validated (12 digits) and unique when present. | M | DEC |

\| FR-ANM-03 | Detect likely duplicates before creating an animal (tag, QR/internal ID, and owner + species + village + attributes). Never create silently. | M | MP |

\| FR-ANM-04 | Track identity verification status. A readable QR is not proof that the physical animal is verified. | M | MP |

\| FR-ANM-05 | Change of owner or village requires a reason, keeps history, and is audited. | M | MP |

\| FR-ANM-06 | Veterinary officers can merge duplicate animals; both IDs remain as aliases and all events are preserved. | S | MP |

\| FR-ANM-07 | Manual search by animal ID, tag, owner name, phone and village within the user’s authorisation (also offline against cached data). | M | MP |

\| FR-ANM-08 | Register owners; link farmer accounts; store consent/lawful-basis flag for outreach. | M | DEC |

\| FR-ANM-09 | Show animal profile with identity, owner (as authorised), history, upcoming/overdue vaccines and sync state. | M | PS |



**### QR · Identification and labels**

\| ID | Requirement | Pri | Basis |

\|---|---|---|---|

\| FR-QR-01 | The QR code encodes only an opaque identifier mapped to the animal; no owner information or medical history. | M | MP |

\| FR-QR-02 | Generate labels individually and in bulk, only for registered or verified animals, as a multi-label PDF for ordinary printers. | M | DEC |

\| FR-QR-03 | Reprints require a reason and are audited; identifier changes keep an audit history. | M | MP |

\| FR-QR-04 | Scan offline for cached animals; query the server online when not cached; unknown animal leads to registration/verification workflow. | M | MP |

\| FR-QR-05 | Manual search fallback when scanning fails; detect duplicate tags. | M | MP |



**### VAC · Vaccination, treatment and schedules**

\| ID | Requirement | Pri | Basis |

\|---|---|---|---|

\| FR-VAC-01 | Record a vaccination event: animal, vaccine/programme (from the approved configured list for the species), date, performer, optional batch number, remarks. | M | PS |

\| FR-VAC-02 | Events are append-only. A correction creates a linked revision with reason; previous events are never overwritten or deleted. | M | MP |

\| FR-VAC-03 | Record treatment events and observations with date, performer and details. | M | PS |

\| FR-VAC-04 | Each record keeps who recorded it and when. Officers may correct or audit; routine entries require no mandatory approval. | M | DEC |

\| FR-VAC-05 | Validate dates (not in the future; not before the animal’s birth); preserve typed data on errors. | M | MP |

\| FR-VAC-06 | Support programme categories FMD, HS, BQ, Brucellosis, PPR; applicability by species is configuration, not hardcoded. | M | DEC |

\| FR-SCH-01 | Store versioned species × programme schedules and approval status supplied/approved by the Department. DAHO selects the approved schedule reference when configuring campaigns. Schedule approval authority and any technical configuration role must follow the Department-approved permission policy; the system supplies no intervals, doses or eligibility rules itself. | M | DEC/APPFLOW v0.4 |

\| FR-SCH-02 | Compute due and overdue animals only from an approved schedule version. If none exists show “schedule not approved” and create no due dates. | M | MP |



**### OFF · Offline data layer**

\| ID | Requirement | Pri | Basis |

\|---|---|---|---|

\| FR-OFF-01 | Before a visit, an authenticated worker downloads authorised animal records and reference data for assigned villages; show last-updated time. | M | MP |

\| FR-OFF-02 | Cache application files so all screens reopen offline. | M | MP |

\| FR-OFF-03 | Offline: open cached app, scan/search locally, open downloaded profiles, record vaccination/treatment/disease events. | M | PS |

\| FR-OFF-04 | Every event gets a stable unique event ID at creation and is stored in a persistent local queue. | M | MP |

\| FR-OFF-05 | Use explicit states: OFFLINE, PENDING_SYNC, SYNCING, SYNCED, SYNC_FAILED, NEEDS_REVIEW; clearly distinguish local from synchronised records. | M | MP |

\| FR-OFF-06 | Pending data survives app restart, device restart and OS app kill. | M | MP |

\| FR-OFF-07 | Handle storage quota exceeded: block new saves with a clear message, never delete unsynced data. | M | MP |

\| FR-OFF-08 | Warn that cached data may be stale; unknown animals cannot be verified offline and become draft registrations. | M | MP |

\| FR-OFF-09 | Protect local data (minimise stored personal data; protect at rest where the platform allows). Logout, session expiry and the end of the offline period must never delete pending (unsynchronised) records; they stay stored, protected, tagged to the creating user and recoverable. No ‘logout and erase’ while unsynced records exist. | M | MP |

\| FR-OFF-10 | Provide an ‘export pending records’ file (S) so unsynced events can be recovered if sync is impossible for a long time. | S | DES |



**### SYNC · Synchronisation**

\| ID | Requirement | Pri | Basis |

\|---|---|---|---|

\| FR-SYNC-01 | Upload pending events and receive a per-record acknowledgement (accepted, duplicate-already-accepted, rejected with reason, needs-review). | M | MP |

\| FR-SYNC-02 | Server processing is idempotent by event ID; repeated uploads never create duplicate events. | M | MP |

\| FR-SYNC-03 | Retry with bounded backoff; recover after restart; manual “sync now”; do not depend only on browser background sync. | M | MP |

\| FR-SYNC-04 | Handle partial success: accepted events become SYNCED, rejected events stay with actionable errors. | M | MP |

\| FR-SYNC-05 | Validate on the server; detect conflicts (e.g., two workers, mutable-field changes, identity mismatch) and mark NEEDS_REVIEW; vaccination events are never overwritten. | M | MP |

\| FR-SYNC-06 | Never mark a record synchronised before the backend confirms acceptance. | M | MP |

\| FR-SYNC-07 | Refresh relevant data after sync; preserve pending queue across app upgrades. | M | MP |



**### IMP · Bulk import**

\| ID | Requirement | Pri | Basis |

\|---|---|---|---|

\| FR-IMP-01 | Upload Excel/CSV; validate file type, size and structure; reject corrupted/oversized/malicious files. | M | PS |

\| FR-IMP-02 | Auto-detect columns; allow manual field mapping; block when required columns are unmapped. | M | MP |

\| FR-IMP-03 | Validate every row; check duplicates within the file and against existing animals; ambiguous matches go to review. | M | MP |

\| FR-IMP-04 | Show a preview and validation summary; let the user review errors before committing. | M | MP |

\| FR-IMP-05 | Import valid rows safely; report created, updated, skipped and rejected counts; never silently discard rows. | M | MP |

\| FR-IMP-06 | Never overwrite verified identity with conflicting data; repeated imports must not create duplicates (safe retry). | M | MP |

\| FR-IMP-07 | Process in a recoverable background job; resumable after interruption. | M | MP |

\| FR-IMP-08 | Provide a downloadable import/error report and QR label PDF only for successfully registered or verified animals. | M | MP |

\| FR-IMP-09 | Neutralise spreadsheet formula-injection risks on import and export; audit imports. | M | MP |



**### REM · Reminders and follow-up**

\| ID | Requirement | Pri | Basis |

\|---|---|---|---|

\| FR-REM-01 | Provide in-app due, overdue and upcoming lists that work even when external messaging is unavailable. | M | MP |

\| FR-REM-02 | Generate simple Gujarati reminder messages from templates (English where required); timing is configurable. | M | PS |

\| FR-REM-03 | Prevent duplicate reminders; cancel/regenerate obsolete reminders when a vaccination date is corrected. | M | MP |

\| FR-REM-04 | Track scheduled, queued, sent, delivered and failed states where supported; plus simulated state. Never show delivered without provider evidence. | M | MP |

\| FR-REM-05 | SMS through a pluggable provider interface, simulated until credentials, permissions and approvals exist. | M | DEC |

\| FR-REM-06 | Respect consent and privacy; handle invalid/missing phone numbers via assisted follow-up lists for veterinary calls or village visits. | M | DEC |

\| FR-REM-07 | Prepare reminders with a scheduled backend process. | M | MP |



**### HELP · Help requests and farmer reporting**

\| ID | Requirement | Pri | Basis |

\|---|---|---|---|

\| FR-HELP-01 | Staff can register a Request Veterinary Help / Callback on behalf of a farmer: name, contact (may be missing/unverified), village, animal if known, problem description. | M | DEC |

\| FR-HELP-02 | Generate a reference number; statuses: Submitted, Assigned, Contact Attempted, Visit Planned, Resolved. | M | DEC |

\| FR-HELP-03 | Add the request to an authorised staff member’s follow-up list; record callback attempts and visit outcomes. No voice calling/IVR/auto-dialling. | M | DEC |

\| FR-HELP-04 | Farmers using the app can report a sick animal; it creates a request routed to village staff. | M | PS |



**### DIS · Disease surveillance**

\| ID | Requirement | Pri | Basis |

\|---|---|---|---|

\| FR-DIS-01 | Structured disease report: animal and village (verified where available), date, location, observations, reporter; may be created offline. | M | PS |

\| FR-DIS-02 | Statuses: suspected, confirmed, disproved, incomplete; transitions require authorisation and are audited. Only authorised veterinary reviewers can confirm. | M | MP |

\| FR-DIS-03 | Check duplicate reports; duplicates do not inflate clusters. | M | MP |

\| FR-DIS-04 | Evaluate configurable alert rules (area and time window); when triggered, flag the area for review and notify the authorised officer. No automatic diagnosis or outbreak declaration. | M | MP |

\| FR-DIS-05 | Investigation workflow: assignment, veterinary verification, follow-up, closure, with audit trail. | M | MP |

\| FR-DIS-06 | Distinguish no reports, incomplete data, suspected, confirmed, and alerts under investigation. | M | MP |



**### MAP · Map dashboard**

\| ID | Requirement | Pri | Basis |

\|---|---|---|---|

\| FR-MAP-01 | Interactive district map with two separate layers: vaccination coverage and disease surveillance. | M | PS |

\| FR-MAP-02 | Filters: village, campaign, disease, date range, suspected/confirmed, coverage status, data freshness. | M | MP |

\| FR-MAP-03 | Click village/marker for authorised details, counts, dates and follow-up (no private owner data). | M | MP |

\| FR-MAP-04 | Colour rules: coverage green/yellow/red/grey and surveillance green/yellow/red/grey exactly as defined in Document 1 §5.5; thresholds are configurable and Department-approved. | M | MP |

\| FR-MAP-05 | Show stale and insufficient data as grey; absence of reports is not shown as disease-free. | M | MP |

\| FR-MAP-06 | Use verified coordinates/boundaries only; show “location unavailable” otherwise; admins can import/correct verified geodata. | M | DEC |

\| FR-MAP-07 | Performance via aggregation, pagination, zoom-level logic and clustering; fall back to a table if the map is unavailable. | M | MP |



**### CAMP · Campaigns**

\| ID | Requirement | Pri | Basis |

\|---|---|---|---|

\| FR-CAMP-01 | DAHO creates/configures/activates campaigns within assigned district scope using Department-approved programme/schedule references and target villages. Veterinary Officers review campaigns and assign Field Workers within authorised villages; Field Workers perform assigned activities. | M | APPFLOW v0.4 |

\| FR-CAMP-02 | Veterinary Officers view campaigns, assign field workers within their authorised villages and monitor campaign progress; they cannot create or configure campaigns. | M | DES |

\| FR-CAMP-03 | Campaign progress by village and species; overdue counts; export for authorised users. | M | MP |

\| FR-CAMP-04 | Field Workers perform their assigned campaign activities and record vaccination events; they cannot create, configure or reassign campaigns. | M | DEC |



**### PORT · Stakeholder portals**

\| ID | Requirement | Pri | Basis |

\|---|---|---|---|

\| FR-FARM-01 | Gujarati farmer view: own animals, history, upcoming/overdue vaccines, reminders and delivery status, sick-animal report, profile. | M | PS |

\| FR-DAIRY-01 | Dairy: authorised campaign information, aggregate village progress, coordination; owner contact lists only for specifically authorised, consented outreach; no medical histories. | M | DEC |

\| FR-GP-01 | Gram Panchayat: approved village-level progress, awareness/outreach coordination; no individual records. | M | DEC |

\| FR-DAHO-01 | District: coverage, overdue counts, campaign progress, disease map, alerts, investigations, data-quality reports and authorised exports. | M | PS |



**### ADM · Administration, audit and integration**

\| ID | Requirement | Pri | Basis |

\|---|---|---|---|

\| FR-ADM-01 | Manage users, roles, permissions, village assignments, deactivation. | M | MP |

\| FR-ADM-02 | Configure schedules, alert rules, reminder timing, thresholds, integration and system settings; monitor imports and synchronisation. | M | MP |

\| FR-AUD-01 | Audit all creates, corrections, imports, label reprints, verification decisions, exports, sensitive-data views and denied access attempts; audit entries are not editable. | M | MP |

\| FR-INT-01 | Bharat Pashudhan integration only through an adapter boundary; status “pending approval”; demonstration environment uses synthetic/authorised data; no scraping. | M | DEC |



**### DAHO · District operational administration**

| ID | Requirement | Pri | Basis |
|---|---|---|---|
| FR-DAHO-02 | DAHO can create/update district villages and import/correct verified geodata only within assigned district scope. Missing/unverified coordinates remain “location unavailable”; no coordinates are fabricated. | M | DEC/APPFLOW v0.4 |
| FR-DAHO-03 | DAHO can create/update Gram Panchayat records and map villages. The system validates district ownership, duplicate codes and active mapping rules; any unresolved many-to-many/administrative mapping policy remains configurable/pending. | M | APPFLOW v0.4 |
| FR-DAHO-04 | DAHO can create/update dairy cooperative records, map served villages and maintain cooperative staff assignments as permitted. Cooperative users see only their assigned scope and aggregate information by default. | M | APPFLOW v0.4 |
| FR-DAHO-05 | DAHO can create/update Veterinary Officer profiles/accounts and assign authorised villages within the assigned district. System Administrator provisions platform access; DAHO manages district operational records. DAHO cannot create another DAHO or System Administrator unless separately approved. | M | APPFLOW v0.4 |
| FR-DAHO-06 | DAHO can view district coverage, campaigns, overdue aggregates, disease surveillance, investigations, camps, stock and data-quality reports; exports are permission-controlled and audited. | M | APPFLOW v0.4 |
| FR-DAHO-07 | Every DAHO create/update/export action is checked against an active DAHO-to-district assignment on the server. Client-supplied district IDs are not trusted. Cross-district reads/writes are denied and audited. | M | APPFLOW v0.4 |

**### FARM · Staff-controlled farmer records and account provisioning**

| ID | Requirement | Pri | Basis |
|---|---|---|---|
| FR-FARM-02 | Only Field Worker, Veterinary Officer or System Administrator with `farmer.register` and applicable scope may create a farmer record. Public signup/self-registration routes and farmer-created records are prohibited. | M | APPFLOW v0.4 |
| FR-FARM-03 | Farmer login provisioning is separate from farmer record creation. Authorised staff may link/activate a farmer login only after the farmer record exists. OTP, if enabled, is login-only and cannot create an owner/farmer, user account or link. | M | APPFLOW v0.4 |
| FR-FARM-04 | Farmer account linking must be unique and auditable; mobile number verification proves control of a number, not identity. Shared, missing or changed mobile numbers follow staff-assisted correction/verification and neutral authentication responses. | M | APPFLOW v0.4 |

**### FW-AVAIL · Field Worker availability and fallback gate**

| ID | Requirement | Pri | Basis |
|---|---|---|---|
| FR-FW-01 | Maintain explicit Field Worker availability/unavailability records linked to user, village, effective time, recording actor, reason and optional evidence reference. Only authorised roles may create/change/revoke these records. | M | APPFLOW v0.4 |
| FR-FW-02 | Before animal registration, backend checks the assigned Field Worker and current availability record. If available, Field Worker is the primary registrar and VO fallback is blocked. | M | APPFLOW v0.4 |
| FR-FW-03 | VO may use `animal.register.fallback` only when the assigned Field Worker is explicitly unavailable; reason and availability-record reference are mandatory and audited. No automatic timeout or attendance rule is inferred. | M | APPFLOW v0.4 |
| FR-FW-04 | If no assigned Field Worker exists, multiple assignments conflict, or availability is unknown/expired, the system must not silently infer unavailability. It places the request in an exception/review path until an authorised decision is recorded. | M | APPFLOW v0.4 / PENDING policy |

**### ANM · Animal registration priority, verification and ownership transfer**

| ID | Requirement | Pri | Basis |
|---|---|---|---|
| FR-ANM-10 | Field Worker is the primary animal registrar in assigned villages. Veterinary Officer is fallback-only under FR-FW-02/03. Farmer, DAHO and System Administrator cannot register animals under the current workflow. The same rule applies to API, import, offline sync and retry paths. | M | APPFLOW v0.4 |
| FR-ANM-11 | Support ownership transfer lifecycle: request, duplicate/open-transfer check, Field Worker verification where assigned, Veterinary Officer approve/reject/dispute, atomic completion, history retention, reminder regeneration and notifications. Rejection/dispute leaves current owner unchanged. | M | APPFLOW v0.4 |
| FR-ANM-12 | Farmer and animal verification decisions retain verifier, timestamp, method and reason/evidence reference. A QR scan or readable tag alone is not proof of physical identity. | M | APPFLOW v0.4 |

**### CAMP · Campaigns, camps and vaccination authority**

| ID | Requirement | Pri | Basis |
|---|---|---|---|
| FR-CAMP-05 | DAHO creates/configures/activates district campaigns within assigned district scope using Department-approved programme and schedule references. System Administrator manages platform configuration but is not the campaign operational owner. | M | APPFLOW v0.4 |
| FR-CAMP-06 | Veterinary Officers view campaigns, assign Field Workers only within their authorised villages and monitor progress. Field Workers see and perform assigned activities only. | M | APPFLOW v0.4 |
| FR-CAMP-07 | Support distinct camp lifecycle records. Cooperative coordinator may propose a camp only for an assigned cooperative/served village; VO reviews and confirms, reschedules or rejects with reason. Government-organised camps may be initiated/confirmed by VO. | M | APPFLOW v0.4 |
| FR-CAMP-08 | Before confirmation, check date/time overlap, staffing and vaccine availability information. A camp without an authorised vaccinator cannot be confirmed. Confirmation assigns staff and creates in-app notifications to relevant cooperative, Panchayat and Field Worker recipients. | M | APPFLOW v0.4 |
| FR-CAMP-09 | Support government, cooperative, joint and doorstep variants. Camp organiser/coordinator status does not confer vaccination authority. Vaccination event records distinguish event recorder from administering vaccinator and link to camp when applicable. | M | APPFLOW v0.4 |
| FR-CAMP-10 | Camp cancellation/rescheduling requires reason, preserves history and notifications, and does not mark animals vaccinated or remove their due status. Camp completion is recorded by authorised operational role. | M | APPFLOW v0.4 |

**### INV · District vaccine inventory**

| ID | Requirement | Pri | Basis |
|---|---|---|---|
| FR-INV-01 | DAHO manages vaccine product references and district stock lots/transactions within district scope. Capture product identity, quantity, batch, expiry, storage/location, receipt/source and notes when available; batch/expiry are not invented or made mandatory where not available. | M | APPFLOW v0.4 |
| FR-INV-02 | Stock receipt, issue, transfer, adjustment and consumption (where authorised/configured) must be ledgered with actor, time, quantity, reason/reference and source/destination. On-hand balance changes atomically with the ledger transaction. | M | APPFLOW v0.4 |
| FR-INV-03 | Reject negative quantities, invalid units, expired/blocked stock according to configured policy, and movements exceeding available balance. Do not invent dosage, clinical suitability, cold-chain thresholds or official stock procedures. | M | APPFLOW v0.4 / PENDING policy |
| FR-INV-04 | Stock availability shown during camp planning is informational and based on current recorded stock; it does not itself authorise a vaccination or establish clinical suitability. | M | APPFLOW v0.4 |

**### DIS · Disease review and reporting provenance**

| ID | Requirement | Pri | Basis |
|---|---|---|---|
| FR-DIS-07 | Record reporter/source and whether a staff member submitted on behalf of a farmer. Store review history separately from current report status and investigation actions. | M | APPFLOW v0.4 |
| FR-DIS-08 | Animal ID and photo are optional where APPFLOW permits; retain symptom/observation, available village/location, reporter and submission time. Missing optional data must not silently discard a report. | M | APPFLOW v0.4 |
| FR-DIS-09 | Initial VO review, Field Worker investigation and authorised veterinary final outcome are distinct steps. Only an explicitly authorised user with `disease.confirm` may set CONFIRMED/NOT_CONFIRMED; confirmation requires basis and not-confirmed requires reason. | M | APPFLOW v0.4 |

**### CAMP / NOT · Notifications and hand-offs**

| ID | Requirement | Pri | Basis |
|---|---|---|---|
| FR-NOT-01 | Persist in-app notifications for farmer registration/verification, animal verification/QR, campaign activation/cancellation, camp proposal/decision, disease report/review, alerts, help requests, reminders and sync conflicts. | M | APPFLOW v0.4 |
| FR-NOT-02 | Every workflow hand-off must create an in-app notification, work-list item or dashboard change for the next responsible stakeholder. Core workflow must not depend on SMS. | M | APPFLOW v0.4 |
| FR-NOT-03 | SMS remains behind a pluggable provider and simulated until approved credentials, sender permissions, templates and lawful basis are configured. Delivery state must distinguish in-app read state from external SMS delivery evidence. | M | DEC |

**## 11. Module summaries**

Stakeholder, problem, data, backend operations, offline, sync/errors, security per module (as required by the master prompt).



\| Module | Stakeholders | Problem solved | Data read/written | Backend operations | Offline | Sync / error | Security |

\|---|---|---|---|---|---|---|---|

\| Authentication | All | Secure access and role control | Users, roles, sessions, OTPs | login, refresh, otp, logout | Cached session within 7-day offline period | Re-login; queue kept | Backend RBAC, rate limits |

\| Animal registry | Officer, Worker | One identity per animal | Animals, owners, identifiers, aliases | create, search, update, merge | Local search/read; draft registration | Draft synced then verified | Village scope; audit |

\| QR and labels | Officer | Link tag to correct record | Identifier map, label batches | resolve, generate PDF | Scan resolves from cache | Labels need server-verified records | Opaque ID; audited reprints |

\| Vaccination and treatment | Officer, Worker | Traceable history | Events, revisions | create event, correct, list | Local first with event ID | Idempotent upload | Role+village; append-only |

\| Offline data layer | Worker | Work without internet | IndexedDB records, queue | download village | Core of module | — | Protected local data |

\| Synchronisation | Worker, Officer | Safe upload | Sync metadata, acks | POST sync batch | Queue persists | Per-record acks, retries | Auth per batch; validation |

\| Bulk import | Officer | Import existing records | Import jobs, row errors | upload, map, validate, commit | Online only | Resumable job | File safety; no overwrite |

\| Schedules and reminders | Admin, Officer, Farmer | Due lists, Gujarati messages | Schedules, reminders, attempts | compute due, queue, status | In-app lists from cache | Provider status | Consent; no false delivered |

\| Help requests | Worker, Officer, Farmer | Support farmers without apps | Requests, attempts, outcomes | create, assign, log | Draft offline; sync later | Reference no. assigned by server | Own scope |

\| Disease surveillance | Worker, Officer, DAHO | Early warning | Reports, alerts, investigations | report, review, confirm | Create report offline | Duplicate/conflict review | Verification permission |

\| Map dashboard | DAHO, Officer, others (scoped) | District monitoring | Aggregates, geodata | aggregate, tiles | Last cached view only | — | Aggregate-only for non-vets |

\| Campaigns | DAHO, VO, FW, cooperative (proposal only) | Coordinate district vaccination | Campaigns, villages, assignments, camps | DAHO creates/configures; VO assigns FW and manages camp decisions; FW performs assigned activities; cooperative may propose camp | Assigned work/cached confirmed camp data | District/village scope; camp and vaccinator authority checked |

\| Administration and audit | Admin | Control and traceability | Users, rules, audit | CRUD, query | Online only | — | Admin role; immutable audit |



**\*\*Additional module summaries [APPFLOW v0.4]\*\***

| Module | Stakeholders | Data read/written | Backend operations | Offline | Security / audit |
|---|---|---|---|---|---|
| DAHO district operations | DAHO, System Administrator (platform provisioning only) | Districts, villages, geodata, Gram Panchayats, cooperatives, Veterinary Officer profiles/assignments | District setup, mapping, operational master-data management, reports/exports | Read cached dashboard only; writes require online validation unless explicitly designed | DAHO district assignment enforced; all changes audited |
| Field Worker availability | Authorised FW/VO roles per approved policy | Availability records, village assignments, reason/evidence | Declare/update/revoke availability; validate fallback gate | Offline status may be queued only if policy allows; fallback registration must revalidate online/current state | Actor, effective time, reason and scope audited |
| Vaccine inventory | DAHO | Products, lots, transactions, balances, storage/location | Receive, issue, transfer, adjust, reconcile | No unvalidated offline stock balance mutation | Transactional ledger; district scope; audit |
| Camp coordination | Cooperative staff, VO, FW, authorised vaccinator, Panchayat | Camps, staff, assignments, campaign/village link, notifications, vaccination camp link | Propose, review, confirm, reschedule, reject, staff, close | View cached confirmed camp; proposal may be queued only if workflow supports safe server validation | Proposal/decision/assignment/authorisation audited |
| Farmer account provisioning | FW, VO, System Administrator; Farmer login | Farmer record, user, link, provisioning record, OTP challenge | Create farmer, provision/link/activate login, authenticate existing account | Staff draft may queue; account activation requires server validation | No self-signup; OTP login-only; unique link and audit |
| Ownership transfer | Farmer, FW, VO | Transfer request, verification, decision, ownership history | Request, verify, decide, complete, dispute, cancel | Request draft may queue; completion requires online atomic transaction | One open transfer; immutable event history |
| Disease review | Farmer, FW, VO, authorised veterinarian, DAHO | Reports, attachments, reviews, investigations, status history | Submit, review, assign, investigate, decide outcome | Report creation offline; final confirmation requires online authorised review | Provenance, attachment scanning, explicit disease.confirm grant |
| Notifications | All authenticated roles | Persistent notification, recipient, status/read timestamp | Create, deliver in-app, mark read, retry external provider | Queue in-app notices for later delivery if offline | Recipient scope; no SMS dependency |

**## 12. Role and permission requirements  \*\*[PENDING final approval]\*\***

Proposed starting matrix; enforced by the backend on every request. *\*Limited\** = scoped to assigned villages, purpose-bound, consented where personal data, audited.



\| Capability | Vet Officer | Field Worker | Farmer | Dairy | DAHO | Panchayat | Admin |

\|---|---|---|---|---|---|---|---|

\| Register animal | Yes | Yes | No | No | No | No | No |

\| Record vaccination / treatment | Yes | Yes | No | No | No | No | No |

\| Create disease report | Yes | Yes | Limited (sick-animal request) | No | No | No | No |

\| Verify / confirm / disprove disease case | Limited (permission granted) | No | No | No | Limited (permission granted) | No | No |

\| Bulk import & QR label PDF | Yes | Limited (permission) | No | No | No | No | No |

\| View owner phone | Yes | Limited | Limited (own) | Limited (consent, authorised) | Limited (audited) | No | No |

\| View individual medical history | Yes (assigned villages) | Limited (assigned villages) | Limited (own animals) | No | Limited (investigation-linked, audited) | No | No |

\| Village aggregates | Yes | Yes (own villages) | No | Yes (member villages; overdue counts per village) | Yes (district) | Yes (own village) | Yes (monitoring) |

\| Create / configure district campaign | No | No | No | No | Yes (assigned district) | No | No |

\| View campaigns and monitor progress | Yes (assigned villages) | Limited (own assignments) | No | Limited (aggregate) | Yes (district) | Limited (village aggregate) | Yes (monitoring) |

\| Assign field workers to campaigns | Yes (authorised villages) | No | No | No | No | No | No |

\| Perform assigned campaign activities | Yes | Yes (assigned) | No | No | No | No | No |

\| Manage users, roles, villages | No | No | No | No | No | No | Yes |

\| Authorised export | Limited | No | No | No | Yes (logged) | No | Limited |

\| Audit log | Limited (own) | No | No | No | Limited (summary) | No | Yes |



**\*\*APPFLOW v0.4 role-permission corrections [MUST]\*\***

| Capability | System Administrator | DAHO | Veterinary Officer | Field Worker | Farmer | Dairy staff | Gram Panchayat |
|---|---|---|---|---|---|---|---|
| Platform accounts/technical settings | Manage | No | No | No | No | No | No |
| District operational setup | No (unless separately granted) | Manage assigned district | No | No | No | No | No |
| Create farmer record | Yes, if granted | No by default | Yes, if granted | Yes, if granted | No | No | No |
| Provision farmer login | Yes, if granted | No by default | Yes, if granted | Yes, if granted | No | No | No |
| Register animal | No | No | Fallback only | Primary in assigned villages | No | No | No |
| Record vaccination/treatment | No | No | Yes, if authorised | Yes, if authorised | No | No | No |
| Administer vaccine | No by admin role | No by DAHO role alone | Only with valid vaccinator authorization | Only with valid vaccinator authorization | No | No | No |
| Create/configure district campaign | No | Yes, assigned district | No | No | No | No | No |
| Assign Field Workers to campaign | No | No by default | Yes, authorised villages | No | No | No | No |
| Propose cooperative camp | No | No by default | May initiate government camp | No by default | No | Yes, assigned scope | No |
| Confirm/manage camp | No | No by default | Yes, within authority | No | No | No | No |
| Manage vaccine stock | No | Yes, assigned district | No by default; may view as authorised | No | No | No | No |
| Final disease confirmation | No by admin role | Only explicit `disease.confirm` grant | Only explicit `disease.confirm` grant | No by default | No | No | No |
| View owner medical history | No by default | Investigation-linked, audited and permitted | Assigned scope | Limited assigned-scope need | Own animals only | No | No |
| Village aggregate view | Platform monitoring only | Assigned district | Assigned villages | Assigned villages | No | Assigned cooperative villages | Assigned village |

**Enforcement notes:** The matrix is a product requirement, not a substitute for the final Department-approved permission grant. Backend checks must combine role permission, explicit user grants where required, district/village/cooperative assignment, record ownership and purpose. The database's legacy permission aliases must not be interpreted as broader authority. In particular, `animal.create` is not a substitute for the APPFLOW-specific `animal.register` / `animal.register.fallback` checks; service logic must enforce FW-first priority.

**\*\*Permission requirements\*\***

\- **\*\*FR-PERM-01\*\*** Veterinary Officers and Field Workers have distinct dashboards and permission sets; veterinary review/verification permission is assigned by the Department/administrator and never granted automatically to field workers.

\- **\*\*FR-PERM-02\*\*** Field workers access assigned villages only; others return access-denied and are audited.

\- **\*\*FR-PERM-03\*\*** Administrators assign roles and village responsibilities and cannot perform veterinary activities.

\- **\*\*FR-PERM-04\*\*** Dairy and Panchayat roles receive aggregates; owner names/phones for outreach only for specifically authorised users with consent/lawful basis.

\- **\*\*FR-PERM-05\*\*** Farmers see only their own authorised records.

\- **\*\*FR-PERM-06\*\*** Owner-phone views and exports are audited.

\- **\*\*FR-PERM-07\*\*** Campaign creation/configuration is managed by DAHO within assigned district scope (using Department-approved schedules); Veterinary Officers view, assign workers (authorised villages) and monitor; Field Workers perform assigned activities; System Administrator provides platform technical administration without operational campaign authority.



**## 13. Non-functional requirements**

\| ID | Area | Requirement | Basis |

\|---|---|---|---|

\| NFR-OFF-01 | Offline | All field-critical functions work with no connection after data download | OFFICIAL |

\| NFR-SEC-01 | Security | Secure authentication; backend RBAC; TLS; no hardcoded secrets | OFFICIAL |

\| NFR-SEC-02 | Security | Server-side validation, safe file handling, rate limiting | OFFICIAL |

\| NFR-SEC-03 | Security | Append-only audit logs for sensitive actions and denied access | OFFICIAL |

\| NFR-SEC-04 | Security | Lost devices, revoked accounts, expired sessions handled without losing pending records | OFFICIAL |

\| NFR-PRV-01 | Privacy | Minimise personal data in local storage, QR, exports, logs; retention policy pending | OFFICIAL/PENDING |

\| NFR-PRV-02 | Privacy | Consent/lawful basis recorded before outreach | DEC |

\| NFR-PERF-01 | Performance | Targets (to be measured on pilot hardware): offline QR scan→profile < 1 s; local search < 300 ms; offline save < 300 ms; dashboard first content < 3 s on slow 4G; map with 10 villages < 2 s; 25 rows/page | ASSUMPTION |

\| NFR-PERF-02 | Performance | Pagination, bounded requests, indexes, cached reference data, aggregation, optimised map | OFFICIAL |

\| NFR-SCAL-01 | Scalability | Pilot ≈20,000 animals/15 field users; must not preclude district growth | ASSUMPTION |

\| NFR-AVL-01 | Availability | Field work independent of server availability; production target to be agreed | PENDING |

\| NFR-BKP-01 | Backup | Regular backups, tested restore, documented recovery | OFFICIAL |

\| NFR-USE-01 | Usability | Mobile-first; ≥44 px targets; high contrast; visible sync status; useful empty/loading/error states; status not by colour alone | OFFICIAL |

\| NFR-USE-02 | Usability | Preserve form data after recoverable errors; autosave drafts | OFFICIAL |

\| NFR-COMP-01 | Compatibility | Recent Chrome/Edge on Android and desktop; installable PWA | PROPOSED |

\| NFR-MNT-01 | Maintainability | Modular; schedules/rules/thresholds are configuration; external services behind adapters; automated tests | OFFICIAL |

\| NFR-COST-01 | Cost/hosting | Free/open-source preferred; vendor-neutral; low-cost demo; paid infrastructure identified; no promise of permanent free hosting | DEC |

\| NFR-OBS-01 | Observability | Monitoring of jobs, sync errors, queue health, backups | OFFICIAL |

\| NFR-I18N-01 | Language | Gujarati strings in one resource module; Western digits; no language selector | DEC |

\| NFR-A11Y-01 | Accessibility | WCAG AA contrast, keyboard operability, screen-reader labels for status changes | PROPOSED |



**## 14. Data integrity requirements  \*\*[OFFICIAL]\*\***

\| ID | Requirement |

\|---|---|

\| DI-01 | One reliable identity per animal; internal ID is the primary identity; 12-digit tag unique when present |

\| DI-02 | Events are separate historical records with unique event IDs; never overwritten |

\| DI-03 | Consistent owner/village relationships; changes keep history |

\| DI-04 | Database-enforced constraints, indexes, transactions |

\| DI-05 | Corrections are audited linked revisions with reasons |

\| DI-06 | Imports and syncs are idempotent |

\| DI-07 | No duplicate sources of truth for vaccination history; derived data computed or marked derived |

\| DI-08 | Defined source of truth for external integrations (pending Department decision) |

\| DI-09 | Labels only for server-verified/registered records |



**## 15. Edge-case requirements  \*\*[OFFICIAL]\*\***

Common rules: never silently discard records; never silently overwrite conflicting history; every resolution audited. UI messages: UI/UX §11. Flows: APPFLOW\.md. Tests: IMPLEMENTATION_PLAN.md.



**### Animal and QR**

\| ID | Case | Required behaviour |

\|---|---|---|

\| EC-01 | Duplicate animal identifiers | Block creation, show existing record, send to review |

\| EC-02 | Duplicate official tags | Reject duplicate 12-digit tag; offer review |

\| EC-03 | Damaged/unreadable QR | Manual search; reprint with reason |

\| EC-04 | Unknown animal | Registration/verification workflow; no invented history |

\| EC-05 | Animal absent from local cache | Online lookup when connected; offline draft otherwise |

\| EC-06 | Conflicting identity information | NEEDS_REVIEW; never overwrite verified identity |

\| EC-07 | Owner or village change | Reason required; history retained; audited |

\| EC-08 | Duplicate animal merging | Officer-only; aliases keep old IDs/QR working |



**### Offline and synchronisation**

\| ID | Case | Required behaviour |

\|---|---|---|

\| EC-09 | Disconnect during entry | Draft saved; continue offline |

\| EC-10 | Disconnect during upload | Stay PENDING_SYNC; retry same event ID |

\| EC-11 | App closes after local save | Queue reloaded on restart |

\| EC-12 | Duplicate uploads | Idempotent by event ID |

\| EC-13 | Partial batch success | Per-record states and reasons |

\| EC-14 | Server unavailable | Bounded backoff; manual retry; no local loss |

\| EC-15 | Expired authentication | Re-login; records protected; offline period 7 days |

\| EC-16 | Storage quota exceeded | Block new saves; offer sync; never delete unsynced |

\| EC-17 | Browser data cleared | Detect missing store; warn; unsynced data unrecoverable — mitigated by persistent-storage request, early warnings, frequent sync prompts |

\| EC-18 | Lost or replaced device | Admin deactivates; new device re-downloads; late arrivals held for review |

\| EC-19 | Conflicting offline updates | Keep both events; mutable-field conflicts to NEEDS_REVIEW |

\| EC-20 | Server validation failures | SYNC_FAILED with actionable reason; correct and resubmit |

\| EC-21 | App upgrade with pending events | Migrate queue; block upgrade if migration fails |



**### Bulk import**

\| ID | Case | Required behaviour |

\|---|---|---|

\| EC-22 | Invalid file type | Reject at upload |

\| EC-23 | Corrupted workbook | Reject with reason |

\| EC-24 | Missing columns | Mapping required before continue |

\| EC-25 | Invalid dates | Row error; in report |

\| EC-26 | Duplicate rows | Skip later duplicates; report |

\| EC-27 | Existing animals | Update only non-conflicting fields; audit |

\| EC-28 | Ambiguous matches | Review; no auto-merge |

\| EC-29 | Oversized or malicious files | Reject; security log |

\| EC-30 | Partial import failure | Valid rows proceed; failures listed |

\| EC-31 | Import retry | Duplicate-safe |

\| EC-32 | QR generation failure | Retry labels; none for unverified rows |

\| EC-33 | Application closure during import | Job continues/resumes |

\| EC-34 | Formula injection | Neutralise cells on import/export |



**### Reminders**

\| ID | Case | Required behaviour |

\|---|---|---|

\| EC-35 | Missing approved schedule | No due dates; show “schedule not approved” |

\| EC-36 | Invalid vaccination date | Block save |

\| EC-37 | Incorrect phone number | Mark undeliverable; assisted follow-up |

\| EC-38 | Duplicate reminder | Suppress |

\| EC-39 | Failed delivery | Show failure; never delivered |

\| EC-40 | Obsolete reminder | Cancel/regenerate after correction |

\| EC-41 | Offline communication channel | In-app and assisted lists continue; simulated status |



**### Disease and map**

\| ID | Case | Required behaviour |

\|---|---|---|

\| EC-42 | Duplicate disease reports | Duplicate check; merge or keep with reason |

\| EC-43 | Suspected report later disproved | Status disproved with reason; history kept |

\| EC-44 | Incorrectly confirmed report | Authorised reversal with reason |

\| EC-45 | Missing village coordinates | Location unavailable list; admin imports verified data |

\| EC-46 | Incomplete surveillance | Grey; not green |

\| EC-47 | Stale data | Grey; show age |

\| EC-48 | False cluster from duplicates | Count after de-duplication |

\| EC-49 | Multiple simultaneous alerts | Each tracked separately with owner |

\| EC-50 | Map service unavailable | Table fallback |

\| EC-51 | Unauthorised report access | 403, no content leaked, audited |



**### Additional operational edge cases — APPFLOW v0.4 alignment**

| ID | Case | Required system behaviour / resolution | Audit / recovery |
|---|---|---|---|
| EC-52 | Farmer attempts public signup | No public farmer registration route/API exists; show a Gujarati message directing the person to authorised staff onboarding. Do not create a partial owner/user record. | Denied attempt may be security-logged; staff can create record |
| EC-53 | OTP submitted for unknown/unprovisioned number | Return neutral authentication response; do not create farmer, user or account link. | Rate-limit and record OTP security event |
| EC-54 | Staff provisions account before farmer record exists | Reject provisioning; require existing staff-created farmer record first. | No orphan account; retry after record creation |
| EC-55 | Duplicate farmer candidate found | Hold for authorised duplicate decision; do not silently merge/create another farmer. | Save decision actor, reason and linked record |
| EC-56 | Farmer has no phone/smartphone or uses shared phone | Staff-assisted record remains possible; phone is not identity proof; account provisioning is optional; shared number is flagged for approved handling. | Preserve staff actor and consent evidence |
| EC-57 | Field Worker available but VO attempts animal registration | Block VO fallback; show that assigned Field Worker is primary registrar. Do not create animal. | ACCESS_DENIED / fallback-block audit |
| EC-58 | Assigned Field Worker explicitly unavailable | Allow VO fallback only with current authorised unavailability record and reason; retain record reference and actor. | ANIMAL_REGISTER_FALLBACK audit |
| EC-59 | No assigned Field Worker / availability unknown / stale record | Do not infer unavailable. Route to authorised exception handling or wait for assignment/status clarification; do not grant VO fallback automatically. | Exception work item and reason |
| EC-60 | Field Worker availability overlaps/conflicts | Do not choose an arbitrary status; require authorised correction/resolution. | Keep prior history; audit correction |
| EC-61 | Bulk import contains animals for multiple villages | Apply FW-first rule per row/village. Rows without an eligible primary registrar or approved VO fallback are held/rejected with row-level reason. | Import report; retry-safe |
| EC-62 | Offline animal draft created while FW assignment changes | Preserve draft; on sync re-check current scope and registrar authority. If no longer authorised, mark NEEDS_REVIEW; never silently accept or delete. | Keep original creator/time; VO/Admin review as permitted |
| EC-63 | DAHO accesses another district | Deny read/write/export if no active district assignment; do not trust client-supplied district ID. | ACCESS_DENIED audit |
| EC-64 | DAHO tries to create another DAHO or System Administrator | Block under current rule unless a separately approved permission/policy exists. | Security audit; System Administrator handles platform access |
| EC-65 | DAHO edits immutable vaccination facts | Deny direct edit. Corrections follow linked amendment process by authorised actor with reason. | Original event preserved; correction audit |
| EC-66 | Camp proposal overlaps an existing confirmed camp | Do not confirm overlapping camp under the configured overlap rule; present conflicting camp/time and request reschedule. | Camp remains PROPOSED or RESCHEDULED; reason retained |
| EC-67 | Camp has no authorised vaccinator | Prevent confirmation; assigning a camp coordinator or cooperative staff member does not satisfy vaccinator authorisation. | Camp remains unconfirmed; notify proposer |
| EC-68 | Vaccine stock insufficient/unknown/expired | Flag as operational blocker and prevent confirmation/issue according to approved stock policy; do not invent an alternate dose or clinical substitution. If policy is not configured, require authorised review. | Stock/camp note and decision audit |
| EC-69 | Camp cancelled/rescheduled after farmers notified | Preserve previous schedule/status; send in-app update to affected roles; animals remain due unless a valid vaccination event exists. | CAMP_CANCEL/RESCHEDULE audit |
| EC-70 | Camp activity recorded by cooperative staff without vaccinator authority | Reject vaccination event; cooperative role and camp assignment do not confer administration permission. | ACCESS_DENIED; authorised vaccinator records event |
| EC-71 | Vaccination recorded at camp but recorder differs from vaccinator | Store both identities and authorisation reference; do not assume the recorder administered the vaccine. | Immutable event and authorization evidence |
| EC-72 | Stock receipt/issue/transfer attempted concurrently | Lock/serialize or use transaction-safe balance update; second operation revalidates available quantity; no negative or double-spent balance. | Ledger rows and transaction result retained |
| EC-73 | Stock lot lacks batch/expiry details | Allow only where APPFLOW policy marks those fields optional/unknown; display missing metadata clearly; do not fabricate values. | Source and entered-by metadata retained |
| EC-74 | Disease report has no animal ID/photo | Accept if required minimum report data exists; attach reporter/source and available village/location; queue for VO review. | Report reference; follow-up task |
| EC-75 | Staff submits disease report on behalf of farmer | Record staff actor and farmer/reporting-source attribution separately; do not impersonate farmer account. | Submission-source audit |
| EC-76 | Unauthorised reviewer attempts disease confirmation | Deny final outcome; allow only permitted initial review/investigation actions. | ACCESS_DENIED audit; route to authorised reviewer |
| EC-77 | Disease confirmation lacks clinical basis / not-confirmed lacks reason | Reject transition and preserve current state; prompt for required basis/reason. | Failed transition logged |
| EC-78 | Notification provider/SMS unavailable | Persist in-app notification and work-list hand-off; external SMS remains queued/failed/simulated, never falsely marked delivered. | Retry external channel separately |
| EC-79 | Notification recipient account absent | Create responsible staff work-list/dashboard item where possible; do not require SMS or fabricate a farmer account. | Pending recipient state; reconcile on provisioning |
| EC-80 | Ownership transfer rejected/disputed | Keep current owner/village unchanged; show reason/status to permitted parties; permit resubmission after resolution. | Transfer history and decision audit |
| EC-81 | Two open transfers for same animal | Block second request or route to existing open transfer; do not apply competing ownership updates. | Link duplicate request to existing case |
| EC-82 | Ownership transfer completes while offline event is pending | Preserve event against the animal identity; reconcile owner/village scope at sync and hold conflicts for review; do not rewrite event history. | Sync conflict record and audit |
| EC-83 | Camp completed but some animals were absent/not vaccinated | Only actual vaccination events count; absent animals remain due/overdue according to approved schedule. | Camp attendance/outcome notes; no fabricated events |
| EC-84 | Village-to-Panchayat or cooperative mapping is ambiguous | Do not guess or auto-map; hold for DAHO correction using verified administrative data. | Mapping source and correction audit |
| EC-85 | DAHO district stock/campaign import contains cross-district rows | Reject or hold offending rows individually; valid in-scope rows may proceed only under import transaction rules. | Row-level import report and audit |

**## 16. Acceptance criteria**

\| ID | Scenario | Pass criteria |

\|---|---|---|

\| AC-01 | Register an animal and generate its QR label | Animal created with internal ID; label PDF contains QR resolving to that animal; unverified records excluded |

\| AC-02 | Scan label and open correct profile | QR resolves to the same animal online and offline (cached) |

\| AC-03 | Save vaccination online | Event stored centrally with performer, time, optional batch |

\| AC-04 | Save vaccination offline; survive restart | Event in local queue as PENDING_SYNC after app/device restart |

\| AC-05 | Synchronise pending records | Server acks; status becomes SYNCED only after ack |

\| AC-06 | Retry sync without duplicates | Same event IDs produce no new events |

\| AC-07 | Partial batch failure | Accepted events synced; rejected retained with reasons |

\| AC-08 | Unknown animal | No fabricated history; registration/verification flow offered |

\| AC-09 | Import Excel with errors | Row errors reported; no duplicate animals; re-import safe |

\| AC-10 | Labels for valid records only | Unverified/pending animals blocked |

\| AC-11 | Due lists from approved schedule | Due/overdue match configured rules; none created without approved schedule |

\| AC-12 | Gujarati reminders with accurate status | Messages in Gujarati; states reflect provider evidence only |

\| AC-13 | Disease reports on correct layer | Synced reports appear on surveillance layer, not coverage layer |

\| AC-14 | Suspected vs confirmed | Distinct statuses, colours and counts; confirmation needs authorised reviewer |

\| AC-15 | Insufficient data | Village without sufficient data shown grey, not safe |

\| AC-16 | Unauthorised requests rejected | 403 for wrong role/village/purpose; audited |

\| AC-17 | Mobile usability | Core flows usable on small Android screens |

\| AC-18 | Server errors | Committed local data intact after server failure |

\| AC-19 | Resume interrupted jobs | Import and sync resume safely |

\| AC-20 | Performance with pilot data | Targets of NFR-PERF-01 met on pilot-scale data (about 20,000 animals) |



**### Additional module-level acceptance**

\| Area | Must demonstrate |

\|---|---|

\| Authorisation | Worker cannot read unassigned village; dairy cannot read medical history; farmer cannot read another farmer's animal; field worker cannot create campaigns |

\| Campaign permissions | DAHO creates/configures; VO views/assigns/monitors within authorised villages; FW performs assigned activities; cooperative may propose a camp but cannot administer vaccine |

\| Logout / offline | Logout with pending records keeps them; after 7 days offline re-authentication is required and nothing is lost |

\| Callback flow | Reference number, five statuses, attempt log, outcome, follow-up entry; works without verified phone |

\| Audit | Denied access, corrections, reprints, exports appear with user, role and time |

\| Integration | Adapter shows *\*pending approval\**; no claim of live integration |



**### Additional acceptance criteria — APPFLOW v0.4 alignment**

| ID | Scenario | Pass criteria |
|---|---|---|
| AC-21 | Staff-controlled farmer creation | FW, VO and System Administrator can create farmer records only with permission/scope; farmer cannot access public signup or farmer-create API |
| AC-22 | Farmer login provisioning | Account can be linked only to an existing farmer record by authorised staff; OTP login does not create any record/account |
| AC-23 | FW-first animal registration | Assigned available FW can register; VO fallback is blocked while FW available; Admin, DAHO and Farmer cannot register animals |
| AC-24 | VO fallback registration | VO can register only with explicit current FW-unavailable record and reason; audit records VO, FW, village and unavailability reference |
| AC-25 | DAHO district isolation | DAHO can manage only assigned district records; cross-district requests and forged district IDs are denied |
| AC-26 | DAHO district setup | DAHO can manage villages/geodata, Gram Panchayats, cooperatives, Veterinary Officer profiles/assignments, vaccine stock and campaigns in scope |
| AC-27 | Campaign authority | DAHO creates/configures campaigns; VO assigns FW only within authorised villages; FW cannot create/configure/reassign campaigns |
| AC-28 | Camp lifecycle | Cooperative proposal, VO review/confirmation/reschedule/rejection, staff assignment, notifications and completion are traceable; government camp path supported |
| AC-29 | Camp vaccinator enforcement | Camp cannot be confirmed without an authorised vaccinator; cooperative role/camp assignment alone does not grant vaccination authority |
| AC-30 | Vaccine stock ledger | Receipt/issue/transfer/adjustment updates ledger and balance atomically; concurrent operations cannot create negative stock |
| AC-31 | Disease review provenance | Staff-on-behalf-of-farmer source is stored; review history is separate; final disease outcome requires explicit permission and basis/reason |
| AC-32 | In-app notification hand-off | Each key workflow hand-off creates a persistent in-app notification/work-list/dashboard change; workflow remains usable with SMS disabled |
| AC-33 | Ownership transfer | Request, verification, decision, dispute/rejection and completion preserve owner history and immutable events; only one open transfer per animal |
| AC-34 | Edge-case enforcement | EC-52 through EC-85 are implemented as automated tests or documented manual acceptance tests before release |

**## 17. Assumptions, dependencies and risks**

**\*\*Assumptions [ASSUMPTION]:\*\*** Department supplies approved schedules, roles, village list and sample records; workers have Android phones capable of PWAs; owner phones exist for many but not all; consent basis defined by Department; a native Gujarati reviewer is available.



\| Dependency | Needed for | Status |

\|---|---|---|

\| Approved vaccination programme | Due lists, reminders, coverage | To be configured and approved by the Department |

\| Bharat Pashudhan / 1962 App access | Optional integration | Pending departmental approval and authorized API access |

\| SMS provider, sender ID, templates | Real reminders | Not configured; simulated |

\| Verified village coordinates/boundaries | Map | To be verified; “location unavailable” state exists |

\| Hosting | Deployment | Not approved or assumed |

\| Retention and consent policy | Privacy | To be defined |



\| Risk | Impact | Mitigation |

\|---|---|---|

\| Browser storage cleared or phone lost before sync | Unsynced records lost | Persistent-storage request, prominent pending count, frequent sync prompts, export-pending file, admin monitor of long-offline users |

\| Schedules/thresholds not approved in time | No due lists/bands | Configuration-driven; “not approved” state; labelled demo values |

\| Integration not authorised | Duplicate data entry | Adapter boundary; import/export; standalone operation |

\| Gujarati text quality | Confusing messages | Native review; glossary; staff testing |

\| Poor legacy data | Many rejected rows | Preview, mapping, error reports, review workflow |

\| False clusters / false safety | Wrong decisions | De-duplication, stale/insufficient states, authorised confirmation |

\| Low-end devices | Slow UI | Lean bundle, local indexes, performance tests |

\| Scope creep | Delay | Traceability to PS000195; new items need explicit approval |



**## 18. Pending approvals and open items  \*\*[PENDING]\*\***

\| # | Item | Owner |

\|---|---|---|

\| 1 | Approved schedules, eligibility, applicability by species (FMD, HS, BQ, Brucellosis, PPR) | Department of Animal Husbandry |

\| 2 | Coverage targets and alert thresholds | Department / veterinary authorities |

\| 3 | Bharat Pashudhan access, API, sandbox, source-of-truth rules | Department / NIC |

\| 4 | SMS provider, credentials, templates, consent basis | Department / Procurement |

\| 5 | Village list with verified coordinates/boundaries | Department / GIS source |

\| 6 | Final permission matrix and per-user veterinary review permission | Department |

\| 7 | Retention policy, backup targets, hosting decision | Department |

\| 8 | Application name and branding | Department |



**\*\*Document alignment baseline (v0.2)\*\***

| Reference | Governing responsibility in this PRD |
|---|---|
| APPFLOW v0.4 | Authoritative stakeholder workflow for staff-controlled farmer records, FW-first animal registration, DAHO district operations, campaign/camp flow, disease review, notifications and ownership transfer |
| BACKENDDATABASESCHEMA v0.4 | Proposed relational structures and permission seed vocabulary; table/view naming is implementation detail and does not change business authority |
| UI/UX Design Specification v0.2.1 | Gujarati-only UI, Western digits, approved visual system and screen baseline; new workflow screens must use approved components/tokens and receive UI approval where required |
| TRD.md | Technical architecture and implementation constraints; no claim of implementation follows from this PRD |

**Traceability rule:** where a PRD requirement refers to an APPFLOW action, it must map to a backend permission/service check and a database record/audit field. A table or permission existing in the schema does not by itself prove the workflow is implemented. If a requirement is not supported by an approved policy (for example Field Worker unavailability duration, vaccine issue rules or disease thresholds), mark it `[PENDING]` and do not invent a value.

**### Additional pending decisions introduced by APPFLOW v0.4**

| # | Item | Why it remains pending | Owner |
|---|---|---|---|
| 9 | Field Worker unavailability authority, evidence and effective duration | The system must require an explicit record but must not invent attendance/time-out rules | Department |
| 10 | Vaccine stock issue, transfer, adjustment and reconciliation policy | Database can record ledger movements; operational authority and procedure need approval | Department / DAHO |
| 11 | Stock units, expired/blocked stock handling and vaccine availability rule for camps | Do not invent medical suitability, dosage, cold-chain or stock policy | Department |
| 12 | Final vaccinator authorisation categories and approval evidence | Camp assignment does not establish vaccination authority | Department |
| 13 | Final `disease.confirm` user grants and qualifications | Explicit user-level grant is required; role alone must not imply confirmation authority | Department |
| 14 | Camp overlap window and official camp prerequisites | System can detect configured overlaps; exact business window and local policy need approval | Department / Veterinary authorities |
| 15 | Gram Panchayat-to-village mapping cardinality and authoritative geodata | Prevents guessing administrative relationships | Department / GIS source |
| 16 | Final schedule configuration/approval authority | DAHO selects Department-approved schedules for campaigns; who publishes/approves schedule versions must be confirmed | Department |
| 17 | Farmer identity verification method and shared/mobile-number policy | OTP proves control of a number, not legal identity | Department |

**## 19. Glossary and traceability**

\| Term | Meaning |

\|---|---|

\| Internal animal ID | \`animals.id\` (UUID primary key); the human-readable **\*\*animal code\*\*** (e.g. ANM-BOT-000123) is its unique display form shown on screens and labels |

\| Bharat Pashudhan tag | Optional 12-digit official tag, stored separately, unique when present |

\| Event | One vaccination, treatment, observation or disease report with a unique client-generated event ID |

\| PENDING_SYNC / SYNCED / … | Offline record states (UI/UX §5.5) |

\| Suspected / Confirmed | Disease statuses; confirmed requires authorised veterinary review |

\| Alert | Review flag from a configurable rule; not a diagnosis |

\| DAHO | District Animal Husbandry Officer |

\| PWA | Installable web app that works offline |



\| PS000195 outcome | Requirements |

\|---|---|

\| QR identification and registration | FR-ANM-01..09, FR-QR-01..05 |

\| Digital histories | FR-VAC-01..06, FR-SCH-01..02 |

\| Offline and sync | FR-OFF-01..10, FR-SYNC-01..07 |

\| Reminders and due lists | FR-REM-01..07, FR-HELP-01..04 |

\| Map surveillance | FR-DIS-01..06, FR-MAP-01..07, FR-DAHO-01 |

\| Bulk import | FR-IMP-01..09 |

\| Improved coverage / faster investigation | FR-CAMP-01..04, FR-DIS-04..05, §3.3 |

\| Owner data protection | FR-AUTH-01..07, FR-PERM-01..07, FR-AUD-01, NFR-SEC/PRV |


---

## v0.2 change log — targeted alignment only

This revision preserves the original 19-section PRD structure, problem statement, goals, pilot assumptions, non-goals, offline requirements, Gujarati UI decision, integration restrictions and existing requirement IDs wherever possible. It corrects only the workflow mismatches identified against APPFLOW v0.4 and BACKENDDATABASESCHEMA v0.4, and adds detailed requirements, user stories, permission clarifications, edge cases and acceptance criteria for the missing operational workflows.

### Main corrections
1. Replaced the obsolete System Administrator campaign ownership with DAHO district campaign ownership.
2. Made farmer record creation staff-controlled and farmer login provisioning a separate staff action; explicitly prohibited public signup/self-registration and OTP-based account creation.
3. Made Field Worker the primary animal registrar and Veterinary Officer fallback-only with explicit unavailability evidence, reason and audit.
4. Expanded DAHO from monitoring-only to district operational management within assigned district scope.
5. Added camp proposal/review/confirmation/rescheduling/rejection/staffing and vaccination-authority boundaries.
6. Added vaccine inventory and transaction-safe stock requirements without inventing clinical or departmental stock policy.
7. Added Field Worker availability, farmer/animal verification, disease-report provenance/review, persistent in-app notification and ownership-transfer requirements.
8. Added operational edge cases EC-52 through EC-85 and acceptance criteria AC-21 through AC-34.
9. Retained unresolved departmental policy decisions as pending rather than filling gaps with invented rules.

### Items still requiring Department decision
- Who may declare/revoke Field Worker unavailability, what evidence is acceptable and the effective duration.
- Exact stock issue/transfer/adjustment authority, units, reconciliation and expired-stock policy.
- District-specific campaign approval and schedule authority details, where APPFLOW does not define more.
- Final user-level `disease.confirm` grants and any other veterinary qualifications/authorisations.
- Gram Panchayat/village mapping cardinality and authoritative geodata source.
- Camp overlap window, stock sufficiency policy, and any official operational prerequisites not already configured.
- Data retention, consent/lawful basis, hosting and external integration approvals.

**Status:** PRD v0.2 is a requirements-document update aligned to APPFLOW v0.4 and the proposed BACKENDDATABASESCHEMA v0.4. It is not an implementation or PostgreSQL validation certificate. Final permission matrix and pending departmental policies remain subject to approval.
