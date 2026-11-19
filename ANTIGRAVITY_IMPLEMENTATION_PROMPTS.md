# ANTIGRAVITY IMPLEMENTATION PROMPTS — PashuRakshak Botad
**Based on:** `PashuRakshak_Current_Status_and_Claude_Handover.md` (1 Nov 2026). **How to use:** paste ONE part into Antigravity, wait for its completion report, bring the report back, approve, then paste the next part. Each prompt is self-contained (hard rules, report format and UI contract are inside it).

## Order and mapping to the approved roadmap
This is implementation work inside the frozen eight-step roadmap — **no Step 9 is added**.
| Prompt | Content | Handover batch | Roadmap step |
|---|---|---|---|
| Part 0 (optional) | Read-only hygiene check (run once; skip if `git status` is already known clean) | — | — |
| Part 1 | Router, auth context, role layouts, shared components | 1 | UI completion for 1, 3, 4 |
| Part 2 | DAHO administration portal | 2 | 5 |
| Part 3 | VO portal | 3 | 6, 7 |
| Part 4 | FW portal | 4 | 6, 7, 8.1/8.2 |
| Part 5 | Farmer + Cooperative + SYS_ADMIN portals (combined to save tokens) | 5, 6, 7 | 3, 4, 6 |
| Part 6 | Reference-data sync, offline rules, full report→photo chain | 8 | 8.1, 8.2 |
| Part 7 | Notifications | 9 | 8.3 |
| Part 8 | Maps | 10 | 8.4 |
| Part 9 | Reports and exports | 11 | 8.5 |
| Part 10 | Consolidated gap closure + one end-to-end test pass | 12 | all |

## Decisions that affect the prompts (answer when convenient)
| # | Unresolved decision | What the prompts do meanwhile |
|---|---|---|
| 1 | Who assigns FWs to villages (DAHO or VO)? **This blocks the end-to-end chain.** Consistent with the earlier approved wording (“VO assigns FWs within authorised villages”), a reasonable *provisional* option is: DAHO assigns VOs to villages; VO assigns FWs within the VO’s own authorised villages — **needs your approval before it is built** | Part 2 builds the UI only for the role the backend already authorises, behind `VITE_ENABLE_VILLAGE_ASSIGNMENT` (default off) |
| 2 | Disease-confirmation roster beyond the existing explicit permission | Decision UI shown only with the backend permission |
| 3 | Cooperative multi-village camp proposals / approval rules | Single-scope behaviour only, flagged |
| 4 | Coverage/surveillance colour thresholds, outbreak criteria, vaccine schedules/doses | Neutral display; nothing invented |
| 5 | Real SMS/WhatsApp and government API access | Simulated provider only |
| 6 | Gram Panchayat portal: your handover lists **six** groups, so Gram Panchayat is treated as DAHO-managed master data with **no portal** | Say so if a portal is still wanted |

## Prompts
### PART 0 (optional, read-only, run once) — Quick repository hygiene check

```text
GOAL: Confirm the repository state before more work. READ-ONLY: do not create, modify, move or delete anything.
DO: run `git status` and `git log --oneline -10`; list files added/changed recently under docs/, database/ and backend/ (names like pashurakshak_schema_v0.3.1_patch*, verify_schema_v0.3.1.sql, README.md (two entries), STAKEHOLDER_PERMISSION_MATRIX.md, DECISION_REGISTER.md, EDGE_CASE_CATALOGUE.md, IMPLEMENTATION_PLAN.md, PROJECT_MEMORY_AI_HANDOVER.md); identify duplicates and which SQL files exist; confirm `.env` files are git-ignored and no secrets are tracked; confirm the test-DB guard exists (rejects missing TEST_DATABASE_URL, main DB name, same URL); confirm no unintended edits to backend/frontend source since the last known good state (frontend: App.tsx, components/, services/; backend: modules and tests).
REPORT: a short table (path, tracked?, duplicate?, authoritative?), list of any suspicious change, and a one-line verdict "safe to continue" or the exact problem. Do not run pytest. Do not apply fixes; propose them only.

HARD RULES (apply to this whole task)
1. Inspect existing code first. Reuse existing modules, endpoints, components and services. Do not duplicate. Do not touch unrelated modules.
2. Stack is frozen: React 19 + TypeScript + Vite PWA, Dexie/IndexedDB; FastAPI, SQLAlchemy 2.0 async, asyncpg, Pydantic v2; PostgreSQL 16 + PostGIS; MapLibre; Python `qrcode`; `@zxing/browser`; Pillow; S3-compatible storage abstraction (local driver now). No new stack, no paid service.
3. DATABASE IS FROZEN: no DDL, no migrations, no new tables/columns/constraints, no `Base.metadata.create_all()`, never re-run schema SQL files. ORM must map the exact existing schema. If a feature needs a missing table/column, STOP that feature and report the exact missing object.
4. Tests: only against `pashurakshak_test_db` through `TEST_DATABASE_URL` (existing guard must reject a missing URL, the main DB name or the same URL; both `get_db` and `get_db_session` overridden). Never run write tests against `pashurakshak_db`. If isolation is not confirmed, do not run pytest and say so.
5. Backend is the authority for RBAC and district/village scope. Never trust client-supplied district_id/village_id. Frontend role checks are presentation only. Do not weaken any permission.
6. UI is Gujarati-only (Western digits 0-9); code comments and docs in English. Use real API data; never show mock data as real.
7. Do NOT invent clinical rules, vaccine schedules/doses, disease thresholds, outbreak radii, credentials, government access, or departmental authority. Where a rule is unresolved, implement nothing for it and flag it.
8. Offline: pending records/attachments are never silently deleted. Warn before logout when unsynced data exists.
9. Report only checks you actually executed. Label every item: Implemented / Frontend-connected / Tested (with evidence) / Not verified. A file or endpoint existing is not proof it works.
10. Keep the report concise (no code dumps). When finished, STOP and wait for approval.

COMPLETION REPORT (concise, use exactly these headings)
- Files changed (paths only)
- Screens / workflows completed
- APIs reused / APIs added (method + path)
- Unresolved decisions or blockers flagged
- Checks actually run (command -> result)
- Not verified
- Remaining work for this part
```

### PART 1 — Shared app shell, routing and role navigation (frontend only)

```text
GOAL: Turn the single-view prototype into a routed, role-aware app shell for all six roles without breaking the existing login, logout dialog, disease form, attachment viewer, camera capture and sync services.
INSPECT FIRST: frontend/src/main.tsx, App.tsx, router.tsx (it exists but is reportedly not mounted), api.ts, components/*, services/authService.ts, services/syncController.ts, networkSyncManager.ts. Read the backend schemas via /openapi.json (running app or source) for /auth/me and /rbac/scope; use those real role codes and permission codes - do not guess names.
SCOPE
1. Mount React Router. Routes: /login (staff), /farmer/login (OTP page scaffold only; full OTP UI comes in Part 5), and protected trees /daho/*, /vo/*, /fw/*, /farmer/*, /coop/*, /admin/* (SYS_ADMIN). Unknown role or no role -> access-denied page.
2. AuthContext: load current user + effective permissions + scope from /auth/me and /rbac/scope; token storage/refresh/expiry through the existing authService; on 401 try refresh once, else go to login WITHOUT deleting pending offline data; 403 -> access-denied state. Route guards are presentation only.
3. Layouts: web sidebar layout (DAHO, VO, Coop, SYS_ADMIN) and mobile-first bottom-nav layout (FW, Farmer); both responsive on all roles. Header shows user name, role, online/offline chip and pending-sync count (from existing sync services).
4. Role navigation (Gujarati; pages for modules not built yet render the honest not-yet-available state, never fake data):
 - DAHO: જિલ્લા ઝાંખી, માસ્ટર ડેટા (તાલુકા, ગામ, ગ્રામ પંચાયત, સહકારી મંડળી), સ્ટાફ (વેટરનરી અધિકારી, ક્ષેત્રીય કાર્યકર), ઝુંબેશ, કેમ્પ, રસી સ્ટોક, રોગ દેખરેખ, નકશો, અહેવાલ, સૂચનાઓ, પ્રોફાઇલ
 - VO: ઝાંખી, રોગ અહેવાલ સમીક્ષા, પશુ યાદી, રસીકરણ અને સારવાર, ઝુંબેશ, કેમ્પ, રસી સ્ટોક, સિંક, સૂચનાઓ, પ્રોફાઇલ
 - FW (bottom nav): હોમ, સ્કેન, બાકી, સિંક, પ્રોફાઇલ (farmers, animals, disease reports reachable from હોમ)
 - Farmer (bottom nav): હોમ, મારા પશુ, સૂચનાઓ, પ્રોફાઇલ
 - Coop: ઝાંખી, ગામ પ્રગતિ, કેમ્પ સંકલન, અહેવાલ, સૂચનાઓ, પ્રોફાઇલ
 - SYS_ADMIN: સિસ્ટમ ઝાંખી, વપરાશકર્તાઓ, ઉપકરણો, ઓડિટ લોગ, સિસ્ટમ સ્થિતિ, પ્રોફાઇલ (technical only)
5. Shared components: Button, Card, StatusChip, DataTable (paginated), FormField with inline Gujarati errors, Modal/ConfirmDialog, Loading/Empty/Error/AccessDenied/NotAvailable states, SyncStatusChip. Central Gujarati strings module (no new i18n library).
6. Role landing page per role = dashboard SHELL only (title, nav, empty cards). Do not invent statistics.
7. Keep LogoutDialog: warn with pending count; logout must never delete pending events/media.
8. Fix the unused `AlertTriangle` import; remove any remaining hardcoded/fake token. Configure API base URL via env (VITE_API_BASE_URL) and a dev proxy.
9. Add minimal frontend test tooling (Vitest + React Testing Library) and a few tests: route guard redirects, role->nav mapping, 401 handling keeps pending data.
EXCLUSIONS: no backend changes, no feature screens (Parts 2-5), no DB access, no new roles (Gram Panchayat has no portal; it is master data managed by DAHO).
ACCEPTANCE: each role logs in and lands in its own shell; other role routes are blocked; refresh keeps the session; logout dialog works; disease form and sync still open from FW.
CHECKS TO RUN: `npx tsc -p tsconfig.json --noEmit`, `npx vite build`, `npx vitest run`. No pytest needed.

UI CONTRACT (approved green identity; follow existing styling system if one exists, otherwise CSS variables)
- Colours: primary #135D43, dark #0F4C37, secondary #208B63, mint #D5F0E4, info #0284C7, canvas #F8FAFB, border #E2E8F0, ink #1E293B, muted #64748B, sidebar #F0F3FF. Status chips (always colour + text + icon, never colour only): success bg #ECFDF5 / border #A7F3D0 / text #065F46; warning #FFFBEB / #FDE68A / #92400E; error #FEF2F2 / #FECACA / #991B1B; neutral #F1F5F9 / #CBD5E1 / #334155; info #EFF8FF / #BAE0FD / #075985.
- Fonts (bundle locally, no CDN): headings Plus Jakarta Sans + Noto Sans Gujarati; body Inter + Noto Sans Gujarati. Icons: Material Symbols Outlined (bundled). Sizes: page title 27-30px/700, section 16-19px/700, body 14px (web) / 15-16px (field mobile), labels 11-12.5px/600; Gujarati line-height 1.55-1.7. Dates DD/MM/YYYY.
- Layout: web = 252px sidebar + 60px top bar, content padding 24-26px, cards radius 14px with 1px border, buttons 40px high radius 8px; mobile = app bar + bottom nav (66px, max 5 items), primary field buttons 52px, touch targets >= 44px. One responsive PWA; desktop and mobile feature parity.
- Sync chips: ઓફલાઇન, સિંક બાકી, સિંક થઈ રહ્યું છે, સિંક થયું, સિંક નિષ્ફળ, સમીક્ષા જરૂરી. Every screen needs loading (લોડ થઈ રહ્યું છે…), empty (કોઈ માહિતી નથી), error (કંઈક ખોટું થયું. ફરી પ્રયાસ કરો.), access-denied (પ્રવેશ નકારાયો — આ માહિતી જોવાની પરવાનગી નથી.) and not-yet-available (આ મોડ્યુલ હજુ ઉપલબ્ધ નથી) states.
- Reference: approved UI/UX PDF v0.2.1 and mockups if present in the repo (search docs/); otherwise use this contract and say so in the report.

HARD RULES (apply to this whole task)
1. Inspect existing code first. Reuse existing modules, endpoints, components and services. Do not duplicate. Do not touch unrelated modules.
2. Stack is frozen: React 19 + TypeScript + Vite PWA, Dexie/IndexedDB; FastAPI, SQLAlchemy 2.0 async, asyncpg, Pydantic v2; PostgreSQL 16 + PostGIS; MapLibre; Python `qrcode`; `@zxing/browser`; Pillow; S3-compatible storage abstraction (local driver now). No new stack, no paid service.
3. DATABASE IS FROZEN: no DDL, no migrations, no new tables/columns/constraints, no `Base.metadata.create_all()`, never re-run schema SQL files. ORM must map the exact existing schema. If a feature needs a missing table/column, STOP that feature and report the exact missing object.
4. Tests: only against `pashurakshak_test_db` through `TEST_DATABASE_URL` (existing guard must reject a missing URL, the main DB name or the same URL; both `get_db` and `get_db_session` overridden). Never run write tests against `pashurakshak_db`. If isolation is not confirmed, do not run pytest and say so.
5. Backend is the authority for RBAC and district/village scope. Never trust client-supplied district_id/village_id. Frontend role checks are presentation only. Do not weaken any permission.
6. UI is Gujarati-only (Western digits 0-9); code comments and docs in English. Use real API data; never show mock data as real.
7. Do NOT invent clinical rules, vaccine schedules/doses, disease thresholds, outbreak radii, credentials, government access, or departmental authority. Where a rule is unresolved, implement nothing for it and flag it.
8. Offline: pending records/attachments are never silently deleted. Warn before logout when unsynced data exists.
9. Report only checks you actually executed. Label every item: Implemented / Frontend-connected / Tested (with evidence) / Not verified. A file or endpoint existing is not proof it works.
10. Keep the report concise (no code dumps). When finished, STOP and wait for approval.

COMPLETION REPORT (concise, use exactly these headings)
- Files changed (paths only)
- Screens / workflows completed
- APIs reused / APIs added (method + path)
- Unresolved decisions or blockers flagged
- Checks actually run (command -> result)
- Not verified
- Remaining work for this part
```

### PART 2 — DAHO administration portal (connect existing APIs)

```text
GOAL: Build the DAHO district administration screens on the existing /api/v1/administration/* APIs. This unblocks the critical chain (DAHO creates villages -> staff assigned -> FW sees only assigned villages).
INSPECT FIRST: backend administration router/service/schemas (districts, talukas, villages, gram-panchayats, cooperatives, veterinary-officers, field-workers), how DAHO district scope is enforced (active DAHO-district assignment, not client IDs), how villages/geodata fields work (verified vs unverified coordinates), and which route/permission currently authorises village-to-staff assignment. Use real schemas from /openapi.json.
SCOPE (frontend, thin backend fixes only if a genuine gap blocks a listed screen and needs no schema change)
1. District dashboard: real counts from existing list endpoints (villages, GPs, cooperatives, VOs, FWs). No invented KPIs.
2. Master data screens: taluka, village, Gram Panchayat, cooperative - list (paginated, search), create, edit where the API supports it. Village create: coordinates optional; never invent coordinates; show coordinate status (verified/unverified/unavailable) exactly as the backend reports it.
3. Staff screens: VO list/create; FW list/create (as the APIs allow).
4. District is implied by the logged-in DAHO's active assignment - do NOT show a free district picker and do NOT send an arbitrary district_id.
5. VILLAGE-TO-STAFF ASSIGNMENT: creating a village must NOT expose it to anyone. The authority (DAHO vs VO) is an UNRESOLVED departmental decision. Build the assignment UI only for the role(s) the backend ALREADY authorises, behind an env flag VITE_ENABLE_VILLAGE_ASSIGNMENT (default false). When off, show an info notice "ગામ સોંપણીની સત્તા વિભાગ દ્વારા નક્કી થવાની બાકી છે". Do not change backend authority. Do not solve empty dropdowns by listing all district villages. Report which role the backend currently authorises.
6. Every form: Zod validation, inline Gujarati errors, loading/empty/error/403 states, success toasts, preserved input on failure.
EXCLUSIONS: campaigns/camps/stock/surveillance screens (later), VO/FW portals, any DDL, any change to RBAC rules.
ACCEPTANCE: DAHO can create a taluka, a village, a GP and a cooperative within the own district and see them listed; a non-DAHO route is blocked; cross-district data is never shown.
CHECKS TO RUN: tsc, vite build, vitest. Backend tests only if backend was touched AND the test DB guard is confirmed.

UI CONTRACT (approved green identity; follow existing styling system if one exists, otherwise CSS variables)
- Colours: primary #135D43, dark #0F4C37, secondary #208B63, mint #D5F0E4, info #0284C7, canvas #F8FAFB, border #E2E8F0, ink #1E293B, muted #64748B, sidebar #F0F3FF. Status chips (always colour + text + icon, never colour only): success bg #ECFDF5 / border #A7F3D0 / text #065F46; warning #FFFBEB / #FDE68A / #92400E; error #FEF2F2 / #FECACA / #991B1B; neutral #F1F5F9 / #CBD5E1 / #334155; info #EFF8FF / #BAE0FD / #075985.
- Fonts (bundle locally, no CDN): headings Plus Jakarta Sans + Noto Sans Gujarati; body Inter + Noto Sans Gujarati. Icons: Material Symbols Outlined (bundled). Sizes: page title 27-30px/700, section 16-19px/700, body 14px (web) / 15-16px (field mobile), labels 11-12.5px/600; Gujarati line-height 1.55-1.7. Dates DD/MM/YYYY.
- Layout: web = 252px sidebar + 60px top bar, content padding 24-26px, cards radius 14px with 1px border, buttons 40px high radius 8px; mobile = app bar + bottom nav (66px, max 5 items), primary field buttons 52px, touch targets >= 44px. One responsive PWA; desktop and mobile feature parity.
- Sync chips: ઓફલાઇન, સિંક બાકી, સિંક થઈ રહ્યું છે, સિંક થયું, સિંક નિષ્ફળ, સમીક્ષા જરૂરી. Every screen needs loading (લોડ થઈ રહ્યું છે…), empty (કોઈ માહિતી નથી), error (કંઈક ખોટું થયું. ફરી પ્રયાસ કરો.), access-denied (પ્રવેશ નકારાયો — આ માહિતી જોવાની પરવાનગી નથી.) and not-yet-available (આ મોડ્યુલ હજુ ઉપલબ્ધ નથી) states.
- Reference: approved UI/UX PDF v0.2.1 and mockups if present in the repo (search docs/); otherwise use this contract and say so in the report.

HARD RULES (apply to this whole task)
1. Inspect existing code first. Reuse existing modules, endpoints, components and services. Do not duplicate. Do not touch unrelated modules.
2. Stack is frozen: React 19 + TypeScript + Vite PWA, Dexie/IndexedDB; FastAPI, SQLAlchemy 2.0 async, asyncpg, Pydantic v2; PostgreSQL 16 + PostGIS; MapLibre; Python `qrcode`; `@zxing/browser`; Pillow; S3-compatible storage abstraction (local driver now). No new stack, no paid service.
3. DATABASE IS FROZEN: no DDL, no migrations, no new tables/columns/constraints, no `Base.metadata.create_all()`, never re-run schema SQL files. ORM must map the exact existing schema. If a feature needs a missing table/column, STOP that feature and report the exact missing object.
4. Tests: only against `pashurakshak_test_db` through `TEST_DATABASE_URL` (existing guard must reject a missing URL, the main DB name or the same URL; both `get_db` and `get_db_session` overridden). Never run write tests against `pashurakshak_db`. If isolation is not confirmed, do not run pytest and say so.
5. Backend is the authority for RBAC and district/village scope. Never trust client-supplied district_id/village_id. Frontend role checks are presentation only. Do not weaken any permission.
6. UI is Gujarati-only (Western digits 0-9); code comments and docs in English. Use real API data; never show mock data as real.
7. Do NOT invent clinical rules, vaccine schedules/doses, disease thresholds, outbreak radii, credentials, government access, or departmental authority. Where a rule is unresolved, implement nothing for it and flag it.
8. Offline: pending records/attachments are never silently deleted. Warn before logout when unsynced data exists.
9. Report only checks you actually executed. Label every item: Implemented / Frontend-connected / Tested (with evidence) / Not verified. A file or endpoint existing is not proof it works.
10. Keep the report concise (no code dumps). When finished, STOP and wait for approval.

COMPLETION REPORT (concise, use exactly these headings)
- Files changed (paths only)
- Screens / workflows completed
- APIs reused / APIs added (method + path)
- Unresolved decisions or blockers flagged
- Checks actually run (command -> result)
- Not verified
- Remaining work for this part
```

### PART 3 — Veterinary Officer portal

```text
GOAL: Give the VO a working portal on existing APIs: disease review inbox and decisions, camps, treatment/events, authorised views of vaccination and inventory.
INSPECT FIRST: disease-reports router (list/detail/reviews/decide/attachments, statuses and transition rules actually implemented), veterinary-camps, vaccinations (treatments, review, correct), vaccine-inventory (read), campaigns assignments, and the permission codes that gate each (do not assume every VO may confirm disease). Reuse AttachmentViewer.
SCOPE
1. VO dashboard (assigned villages only): counts from real endpoints - reports awaiting review, camps, pending items. No invented numbers.
2. Disease report inbox: filters (village, status, date), pagination, status chips (suspected stays suspected until authorised review; alerts are not diagnoses). Detail: farmer/animal/village, symptoms, observations, GPS, photos via AttachmentViewer, review history.
3. Review/decision workflow: add review notes; the decision form appears only if the user holds the backend permission for confirmation; reason is mandatory; history preserved; show backend rejection messages in Gujarati. Do not invent decision rules or thresholds.
4. Camps: list, detail, propose/create, confirm, reschedule (reason), cancel (reason), complete, staff assignment - exactly as the API allows. Camp assignment does not authorise vaccination.
5. Treatment and animal events: forms for what /vaccinations/treatments and event endpoints support; VO correction of a vaccination event with mandatory reason (history preserved). Vaccination recording only if the VO is a separately authorised vaccinator (check how the backend decides; hide otherwise and explain).
6. Inventory and campaign views: read-only unless the VO holds the matching permission.
7. FW coordination: campaign assignments of FWs within the VO's authorised villages (existing /campaigns/{id}/assignments). This is NOT the village-to-staff assignment (authority unresolved - do not build that here).
EXCLUSIONS: DAHO screens, FW screens, notifications/maps/reports (later parts), schema changes.
ACCEPTANCE: a seeded test report submitted by an FW appears in the VO's inbox only if its village is assigned to that VO; a VO without the confirm permission cannot confirm; attachments open; decision stores reason and history.
CHECKS TO RUN: tsc, vite build, vitest; backend pytest only if backend touched and test DB isolation confirmed.

UI CONTRACT (approved green identity; follow existing styling system if one exists, otherwise CSS variables)
- Colours: primary #135D43, dark #0F4C37, secondary #208B63, mint #D5F0E4, info #0284C7, canvas #F8FAFB, border #E2E8F0, ink #1E293B, muted #64748B, sidebar #F0F3FF. Status chips (always colour + text + icon, never colour only): success bg #ECFDF5 / border #A7F3D0 / text #065F46; warning #FFFBEB / #FDE68A / #92400E; error #FEF2F2 / #FECACA / #991B1B; neutral #F1F5F9 / #CBD5E1 / #334155; info #EFF8FF / #BAE0FD / #075985.
- Fonts (bundle locally, no CDN): headings Plus Jakarta Sans + Noto Sans Gujarati; body Inter + Noto Sans Gujarati. Icons: Material Symbols Outlined (bundled). Sizes: page title 27-30px/700, section 16-19px/700, body 14px (web) / 15-16px (field mobile), labels 11-12.5px/600; Gujarati line-height 1.55-1.7. Dates DD/MM/YYYY.
- Layout: web = 252px sidebar + 60px top bar, content padding 24-26px, cards radius 14px with 1px border, buttons 40px high radius 8px; mobile = app bar + bottom nav (66px, max 5 items), primary field buttons 52px, touch targets >= 44px. One responsive PWA; desktop and mobile feature parity.
- Sync chips: ઓફલાઇન, સિંક બાકી, સિંક થઈ રહ્યું છે, સિંક થયું, સિંક નિષ્ફળ, સમીક્ષા જરૂરી. Every screen needs loading (લોડ થઈ રહ્યું છે…), empty (કોઈ માહિતી નથી), error (કંઈક ખોટું થયું. ફરી પ્રયાસ કરો.), access-denied (પ્રવેશ નકારાયો — આ માહિતી જોવાની પરવાનગી નથી.) and not-yet-available (આ મોડ્યુલ હજુ ઉપલબ્ધ નથી) states.
- Reference: approved UI/UX PDF v0.2.1 and mockups if present in the repo (search docs/); otherwise use this contract and say so in the report.

HARD RULES (apply to this whole task)
1. Inspect existing code first. Reuse existing modules, endpoints, components and services. Do not duplicate. Do not touch unrelated modules.
2. Stack is frozen: React 19 + TypeScript + Vite PWA, Dexie/IndexedDB; FastAPI, SQLAlchemy 2.0 async, asyncpg, Pydantic v2; PostgreSQL 16 + PostGIS; MapLibre; Python `qrcode`; `@zxing/browser`; Pillow; S3-compatible storage abstraction (local driver now). No new stack, no paid service.
3. DATABASE IS FROZEN: no DDL, no migrations, no new tables/columns/constraints, no `Base.metadata.create_all()`, never re-run schema SQL files. ORM must map the exact existing schema. If a feature needs a missing table/column, STOP that feature and report the exact missing object.
4. Tests: only against `pashurakshak_test_db` through `TEST_DATABASE_URL` (existing guard must reject a missing URL, the main DB name or the same URL; both `get_db` and `get_db_session` overridden). Never run write tests against `pashurakshak_db`. If isolation is not confirmed, do not run pytest and say so.
5. Backend is the authority for RBAC and district/village scope. Never trust client-supplied district_id/village_id. Frontend role checks are presentation only. Do not weaken any permission.
6. UI is Gujarati-only (Western digits 0-9); code comments and docs in English. Use real API data; never show mock data as real.
7. Do NOT invent clinical rules, vaccine schedules/doses, disease thresholds, outbreak radii, credentials, government access, or departmental authority. Where a rule is unresolved, implement nothing for it and flag it.
8. Offline: pending records/attachments are never silently deleted. Warn before logout when unsynced data exists.
9. Report only checks you actually executed. Label every item: Implemented / Frontend-connected / Tested (with evidence) / Not verified. A file or endpoint existing is not proof it works.
10. Keep the report concise (no code dumps). When finished, STOP and wait for approval.

COMPLETION REPORT (concise, use exactly these headings)
- Files changed (paths only)
- Screens / workflows completed
- APIs reused / APIs added (method + path)
- Unresolved decisions or blockers flagged
- Checks actually run (command -> result)
- Not verified
- Remaining work for this part
```

### PART 4 — Field Worker portal (online-first; offline master-data cache comes in Part 6)

```text
GOAL: Complete the FW workflow on mobile-first screens: village selection, farmers, animals, QR, disease reporting, and authorised vaccination/treatment.
INSPECT FIRST: /rbac/scope and any endpoint that returns the FW's assigned villages; farmers + animals routers (create/verify/lookup/qr-token/external-ids/transfers); vaccinations (how vaccinator authorisation is determined); sync event types actually supported by /sync/push; existing DiseaseReportForm, CameraCapture, offlineDb, syncController.
SCOPE
1. Village selector built ONLY from the villages the backend says are assigned to this FW. If none are assigned, show an honest empty state explaining that a village must be assigned (no all-district list, no typed IDs).
2. Farmers (selected village only): list/search, create (staff-created; consent captured), detail, verify. Farmer login provisioning is a separate backend operation and is not an FW screen unless the API/permissions allow it.
3. Animals: list/search, register (FW is the primary registrar; optional Bharat Pashudhan 12-digit tag validated as 12 digits and kept separate from the internal animal ID), detail with history, verify, request ownership transfer (request only; ownership does not change until approval), QR generate/re-tag (re-tagging revokes the old token).
4. QR scanning with @zxing/browser (camera, torch/manual entry fallback) -> /animals/lookup/qr/{token}; tag lookup by number.
5. Disease report: integrate the existing form with real village -> farmer -> animal selection, symptoms, observations, GPS, photos; it still queues offline through the existing sync and media services.
6. Vaccination: show the form only for a separately authorised vaccinator; batch number optional; others see an explanation. Treatment/events only where permitted. Never assume every FW is a vaccinator.
7. Offline: use the existing queue for the event types /sync/push already supports; for operations the backend sync does not support yet, work online-only and show "ઓફલાઇન ઉપલબ્ધ નથી" - do not invent new sync schemas (Part 6 covers reference data). Show pending queue (બાકી) and sync (સિંક) pages with accurate states.
EXCLUSIONS: DAHO/VO screens, assignment UI, notifications/maps/reports, any DDL.
ACCEPTANCE: an FW with an assigned village registers a farmer and an animal, generates and scans a QR, files a disease report with photos (offline then sync), and never sees unassigned villages.
CHECKS TO RUN: tsc, vite build, vitest; manual browser checklist listed in the report (what you could and could not execute).

UI CONTRACT (approved green identity; follow existing styling system if one exists, otherwise CSS variables)
- Colours: primary #135D43, dark #0F4C37, secondary #208B63, mint #D5F0E4, info #0284C7, canvas #F8FAFB, border #E2E8F0, ink #1E293B, muted #64748B, sidebar #F0F3FF. Status chips (always colour + text + icon, never colour only): success bg #ECFDF5 / border #A7F3D0 / text #065F46; warning #FFFBEB / #FDE68A / #92400E; error #FEF2F2 / #FECACA / #991B1B; neutral #F1F5F9 / #CBD5E1 / #334155; info #EFF8FF / #BAE0FD / #075985.
- Fonts (bundle locally, no CDN): headings Plus Jakarta Sans + Noto Sans Gujarati; body Inter + Noto Sans Gujarati. Icons: Material Symbols Outlined (bundled). Sizes: page title 27-30px/700, section 16-19px/700, body 14px (web) / 15-16px (field mobile), labels 11-12.5px/600; Gujarati line-height 1.55-1.7. Dates DD/MM/YYYY.
- Layout: web = 252px sidebar + 60px top bar, content padding 24-26px, cards radius 14px with 1px border, buttons 40px high radius 8px; mobile = app bar + bottom nav (66px, max 5 items), primary field buttons 52px, touch targets >= 44px. One responsive PWA; desktop and mobile feature parity.
- Sync chips: ઓફલાઇન, સિંક બાકી, સિંક થઈ રહ્યું છે, સિંક થયું, સિંક નિષ્ફળ, સમીક્ષા જરૂરી. Every screen needs loading (લોડ થઈ રહ્યું છે…), empty (કોઈ માહિતી નથી), error (કંઈક ખોટું થયું. ફરી પ્રયાસ કરો.), access-denied (પ્રવેશ નકારાયો — આ માહિતી જોવાની પરવાનગી નથી.) and not-yet-available (આ મોડ્યુલ હજુ ઉપલબ્ધ નથી) states.
- Reference: approved UI/UX PDF v0.2.1 and mockups if present in the repo (search docs/); otherwise use this contract and say so in the report.

HARD RULES (apply to this whole task)
1. Inspect existing code first. Reuse existing modules, endpoints, components and services. Do not duplicate. Do not touch unrelated modules.
2. Stack is frozen: React 19 + TypeScript + Vite PWA, Dexie/IndexedDB; FastAPI, SQLAlchemy 2.0 async, asyncpg, Pydantic v2; PostgreSQL 16 + PostGIS; MapLibre; Python `qrcode`; `@zxing/browser`; Pillow; S3-compatible storage abstraction (local driver now). No new stack, no paid service.
3. DATABASE IS FROZEN: no DDL, no migrations, no new tables/columns/constraints, no `Base.metadata.create_all()`, never re-run schema SQL files. ORM must map the exact existing schema. If a feature needs a missing table/column, STOP that feature and report the exact missing object.
4. Tests: only against `pashurakshak_test_db` through `TEST_DATABASE_URL` (existing guard must reject a missing URL, the main DB name or the same URL; both `get_db` and `get_db_session` overridden). Never run write tests against `pashurakshak_db`. If isolation is not confirmed, do not run pytest and say so.
5. Backend is the authority for RBAC and district/village scope. Never trust client-supplied district_id/village_id. Frontend role checks are presentation only. Do not weaken any permission.
6. UI is Gujarati-only (Western digits 0-9); code comments and docs in English. Use real API data; never show mock data as real.
7. Do NOT invent clinical rules, vaccine schedules/doses, disease thresholds, outbreak radii, credentials, government access, or departmental authority. Where a rule is unresolved, implement nothing for it and flag it.
8. Offline: pending records/attachments are never silently deleted. Warn before logout when unsynced data exists.
9. Report only checks you actually executed. Label every item: Implemented / Frontend-connected / Tested (with evidence) / Not verified. A file or endpoint existing is not proof it works.
10. Keep the report concise (no code dumps). When finished, STOP and wait for approval.

COMPLETION REPORT (concise, use exactly these headings)
- Files changed (paths only)
- Screens / workflows completed
- APIs reused / APIs added (method + path)
- Unresolved decisions or blockers flagged
- Checks actually run (command -> result)
- Not verified
- Remaining work for this part
```

### PART 5 — Farmer, Cooperative and SYS_ADMIN portals

```text
GOAL: Finish the three smaller portals using only APIs that exist.
INSPECT FIRST: auth farmer OTP endpoints and their exact flow; farmers/animals own-record scope; cooperative-related endpoints and scope; admin/technical APIs (users, devices, audit, health) that actually exist.
SCOPE
A. FARMER (mobile-first): OTP login UI for already-provisioned accounts only (request-otp -> verify-otp; neutral messages that do not reveal whether a number exists; resend timer; attempt/lock messages from the backend; no registration option). Home, own profile, own animals, animal detail with vaccination/treatment history, ownership-transfer requests status (own), farmer-side disease/service request ONLY if a backend endpoint exists (otherwise flag it as missing; do not invent). Farmer sees only own records.
B. COOPERATIVE: scoped dashboard (counts from real endpoints), village progress as aggregate counts only (no individual owner details unless the backend explicitly returns them to this role), camp coordination screens for what the camp API allows within the approved scope. Cross-village proposals are UNRESOLVED: implement only the single-scope behaviour the backend permits and flag it.
C. SYS_ADMIN (technical only): system overview (health endpoint), user list/status, devices, audit log view, system status. If an audit/user/device read endpoint is missing, add only a thin read-only endpoint over EXISTING tables with an explicit permission check; otherwise report the gap. SYS_ADMIN gets NO operational district/village data by default and no technical grant silently grants geographic access.
EXCLUSIONS: DAHO/VO/FW screens, notifications/maps/reports, DDL, self-registration (disabled by decision).
ACCEPTANCE: a provisioned farmer logs in with OTP and sees only own data; a non-provisioned number gets a neutral failure and no account is created; coop and admin portals show only scoped/technical data and block everything else.
CHECKS TO RUN: tsc, vite build, vitest; pytest only if backend touched and isolation confirmed.

UI CONTRACT (approved green identity; follow existing styling system if one exists, otherwise CSS variables)
- Colours: primary #135D43, dark #0F4C37, secondary #208B63, mint #D5F0E4, info #0284C7, canvas #F8FAFB, border #E2E8F0, ink #1E293B, muted #64748B, sidebar #F0F3FF. Status chips (always colour + text + icon, never colour only): success bg #ECFDF5 / border #A7F3D0 / text #065F46; warning #FFFBEB / #FDE68A / #92400E; error #FEF2F2 / #FECACA / #991B1B; neutral #F1F5F9 / #CBD5E1 / #334155; info #EFF8FF / #BAE0FD / #075985.
- Fonts (bundle locally, no CDN): headings Plus Jakarta Sans + Noto Sans Gujarati; body Inter + Noto Sans Gujarati. Icons: Material Symbols Outlined (bundled). Sizes: page title 27-30px/700, section 16-19px/700, body 14px (web) / 15-16px (field mobile), labels 11-12.5px/600; Gujarati line-height 1.55-1.7. Dates DD/MM/YYYY.
- Layout: web = 252px sidebar + 60px top bar, content padding 24-26px, cards radius 14px with 1px border, buttons 40px high radius 8px; mobile = app bar + bottom nav (66px, max 5 items), primary field buttons 52px, touch targets >= 44px. One responsive PWA; desktop and mobile feature parity.
- Sync chips: ઓફલાઇન, સિંક બાકી, સિંક થઈ રહ્યું છે, સિંક થયું, સિંક નિષ્ફળ, સમીક્ષા જરૂરી. Every screen needs loading (લોડ થઈ રહ્યું છે…), empty (કોઈ માહિતી નથી), error (કંઈક ખોટું થયું. ફરી પ્રયાસ કરો.), access-denied (પ્રવેશ નકારાયો — આ માહિતી જોવાની પરવાનગી નથી.) and not-yet-available (આ મોડ્યુલ હજુ ઉપલબ્ધ નથી) states.
- Reference: approved UI/UX PDF v0.2.1 and mockups if present in the repo (search docs/); otherwise use this contract and say so in the report.

HARD RULES (apply to this whole task)
1. Inspect existing code first. Reuse existing modules, endpoints, components and services. Do not duplicate. Do not touch unrelated modules.
2. Stack is frozen: React 19 + TypeScript + Vite PWA, Dexie/IndexedDB; FastAPI, SQLAlchemy 2.0 async, asyncpg, Pydantic v2; PostgreSQL 16 + PostGIS; MapLibre; Python `qrcode`; `@zxing/browser`; Pillow; S3-compatible storage abstraction (local driver now). No new stack, no paid service.
3. DATABASE IS FROZEN: no DDL, no migrations, no new tables/columns/constraints, no `Base.metadata.create_all()`, never re-run schema SQL files. ORM must map the exact existing schema. If a feature needs a missing table/column, STOP that feature and report the exact missing object.
4. Tests: only against `pashurakshak_test_db` through `TEST_DATABASE_URL` (existing guard must reject a missing URL, the main DB name or the same URL; both `get_db` and `get_db_session` overridden). Never run write tests against `pashurakshak_db`. If isolation is not confirmed, do not run pytest and say so.
5. Backend is the authority for RBAC and district/village scope. Never trust client-supplied district_id/village_id. Frontend role checks are presentation only. Do not weaken any permission.
6. UI is Gujarati-only (Western digits 0-9); code comments and docs in English. Use real API data; never show mock data as real.
7. Do NOT invent clinical rules, vaccine schedules/doses, disease thresholds, outbreak radii, credentials, government access, or departmental authority. Where a rule is unresolved, implement nothing for it and flag it.
8. Offline: pending records/attachments are never silently deleted. Warn before logout when unsynced data exists.
9. Report only checks you actually executed. Label every item: Implemented / Frontend-connected / Tested (with evidence) / Not verified. A file or endpoint existing is not proof it works.
10. Keep the report concise (no code dumps). When finished, STOP and wait for approval.

COMPLETION REPORT (concise, use exactly these headings)
- Files changed (paths only)
- Screens / workflows completed
- APIs reused / APIs added (method + path)
- Unresolved decisions or blockers flagged
- Checks actually run (command -> result)
- Not verified
- Remaining work for this part
```

### PART 6 — Step 8.1/8.2 completion: authorised reference-data sync and the full report -> photo flow

```text
GOAL: Make offline work usable for FW/VO and prove the disease-report + attachment chain end to end.
INSPECT FIRST: /sync/grant, /sync/push, /sync/status, /sync/conflicts, the sync receipt/idempotency logic, media upload rules, offlineDb tables, syncController, mediaSyncController, networkSyncManager, and TRD/APPFLOW notes on reference data (the audit says /sync/pull is absent). Read the real DB schema through the ORM models - do not assume tables.
SCOPE
1. Short design note (in your report, not a new doc): which reference data an FW/VO needs offline (assigned villages, farmers, animals, QR tokens, species/programme lists, permissions), how the server enforces scope from the user's assignments (never from client IDs), and the endpoint shape. Implement a scoped read-only reference-data endpoint (and an incremental cursor only if the existing schema supports it) using EXISTING tables only. If the schema cannot support something, stop on that item and report.
2. Dexie caching of that data with `last updated` display and a stale warning; refresh on login/online/manual; never expose another user's cached data (tag by user; clear only synced read-only cache, never the pending queue).
3. Pending queue states mapped honestly: PENDING_SYNC, SYNCING, SYNCED (only after server ack), SYNC_FAILED, NEEDS_REVIEW; per-record error reasons; manual retry; bounded backoff; duplicate protection by stable event ID; lost acknowledgement -> retry returns already-accepted.
4. Offline authorisation: 7 days by default, configurable by the administrator setting (read it from the backend/grant); after expiry require online re-authentication before further offline work; expiry never deletes pending data; logout warns about unsynced items and keeps them recoverable. The server cannot review data it has not received - unsent payloads stay on the device. Add an "export pending records" file action if it is small.
5. Complete the disease-report chain: form -> local queue -> sync -> parent report accepted -> attachments uploaded -> server verifies -> VO inbox shows report with photos. Show accurate accepted/rejected/review counts in the UI.
EXCLUSIONS: new tables/migrations, new event types unless the backend already supports them, notifications/maps/reports.
ACCEPTANCE: after login and a village refresh, an FW with no signal can open cached farmers/animals, record a report with photos, close and reopen the app, reconnect, and the report plus photos appear for the VO exactly once.
CHECKS TO RUN: backend tests for the new endpoint's scope (test DB only, isolation confirmed first); existing sync/attachment/disease-sync tests; frontend tsc, vite build, vitest (queue + reference cache units). Describe any browser steps you could not execute.

HARD RULES (apply to this whole task)
1. Inspect existing code first. Reuse existing modules, endpoints, components and services. Do not duplicate. Do not touch unrelated modules.
2. Stack is frozen: React 19 + TypeScript + Vite PWA, Dexie/IndexedDB; FastAPI, SQLAlchemy 2.0 async, asyncpg, Pydantic v2; PostgreSQL 16 + PostGIS; MapLibre; Python `qrcode`; `@zxing/browser`; Pillow; S3-compatible storage abstraction (local driver now). No new stack, no paid service.
3. DATABASE IS FROZEN: no DDL, no migrations, no new tables/columns/constraints, no `Base.metadata.create_all()`, never re-run schema SQL files. ORM must map the exact existing schema. If a feature needs a missing table/column, STOP that feature and report the exact missing object.
4. Tests: only against `pashurakshak_test_db` through `TEST_DATABASE_URL` (existing guard must reject a missing URL, the main DB name or the same URL; both `get_db` and `get_db_session` overridden). Never run write tests against `pashurakshak_db`. If isolation is not confirmed, do not run pytest and say so.
5. Backend is the authority for RBAC and district/village scope. Never trust client-supplied district_id/village_id. Frontend role checks are presentation only. Do not weaken any permission.
6. UI is Gujarati-only (Western digits 0-9); code comments and docs in English. Use real API data; never show mock data as real.
7. Do NOT invent clinical rules, vaccine schedules/doses, disease thresholds, outbreak radii, credentials, government access, or departmental authority. Where a rule is unresolved, implement nothing for it and flag it.
8. Offline: pending records/attachments are never silently deleted. Warn before logout when unsynced data exists.
9. Report only checks you actually executed. Label every item: Implemented / Frontend-connected / Tested (with evidence) / Not verified. A file or endpoint existing is not proof it works.
10. Keep the report concise (no code dumps). When finished, STOP and wait for approval.

COMPLETION REPORT (concise, use exactly these headings)
- Files changed (paths only)
- Screens / workflows completed
- APIs reused / APIs added (method + path)
- Unresolved decisions or blockers flagged
- Checks actually run (command -> result)
- Not verified
- Remaining work for this part
```

### PART 7 — Step 8.3 Notifications (backend + frontend)

```text
GOAL: Persistent in-app notifications with scope-checked delivery, independent of SMS/WhatsApp.
INSPECT FIRST: the ORM models/existing tables for notifications and any delivery-attempt table (map the exact schema; if required columns/tables do not exist, STOP and report - no DDL), existing service layers where events occur.
SCOPE
1. Backend module (service + router): list own notifications (paginated), unread count, mark read, mark all read. A recipient only ever sees own notifications. Internal `notify()` helper that validates recipient + role + geographic scope before creating a notification.
2. Hook `notify()` into existing workflows minimally and safely: disease report submitted -> reviewing VO(s) of that village; review/decision recorded -> reporter; camp confirmed/cancelled/rescheduled -> assigned staff and proposing cooperative; ownership transfer decided -> requester/farmer; account provisioned/verification result -> farmer. Do not change business logic of those modules beyond adding the call.
3. External delivery: an adapter interface with a SIMULATED provider only (status recorded honestly as simulated; never 'delivered' without provider evidence). No credentials, no real SMS/WhatsApp. In-app persistence must succeed even if external delivery fails.
4. No disease-alert thresholds or automatic outbreak/diagnosis notifications.
5. Frontend: bell with unread badge in the shell (poll on an interval; no websockets), notifications page (Gujarati, read/unread, link to the related item), empty/error states.
EXCLUSIONS: maps, reports, new tables, real provider integration.
ACCEPTANCE: a submitted disease report creates one notification for the right VO and none for others; mark-read works; a user cannot read another user's notifications; simulated external delivery failing does not remove the in-app notification.
CHECKS TO RUN: new backend tests (test DB only, isolation confirmed); tsc, vite build, vitest.

UI CONTRACT (approved green identity; follow existing styling system if one exists, otherwise CSS variables)
- Colours: primary #135D43, dark #0F4C37, secondary #208B63, mint #D5F0E4, info #0284C7, canvas #F8FAFB, border #E2E8F0, ink #1E293B, muted #64748B, sidebar #F0F3FF. Status chips (always colour + text + icon, never colour only): success bg #ECFDF5 / border #A7F3D0 / text #065F46; warning #FFFBEB / #FDE68A / #92400E; error #FEF2F2 / #FECACA / #991B1B; neutral #F1F5F9 / #CBD5E1 / #334155; info #EFF8FF / #BAE0FD / #075985.
- Fonts (bundle locally, no CDN): headings Plus Jakarta Sans + Noto Sans Gujarati; body Inter + Noto Sans Gujarati. Icons: Material Symbols Outlined (bundled). Sizes: page title 27-30px/700, section 16-19px/700, body 14px (web) / 15-16px (field mobile), labels 11-12.5px/600; Gujarati line-height 1.55-1.7. Dates DD/MM/YYYY.
- Layout: web = 252px sidebar + 60px top bar, content padding 24-26px, cards radius 14px with 1px border, buttons 40px high radius 8px; mobile = app bar + bottom nav (66px, max 5 items), primary field buttons 52px, touch targets >= 44px. One responsive PWA; desktop and mobile feature parity.
- Sync chips: ઓફલાઇન, સિંક બાકી, સિંક થઈ રહ્યું છે, સિંક થયું, સિંક નિષ્ફળ, સમીક્ષા જરૂરી. Every screen needs loading (લોડ થઈ રહ્યું છે…), empty (કોઈ માહિતી નથી), error (કંઈક ખોટું થયું. ફરી પ્રયાસ કરો.), access-denied (પ્રવેશ નકારાયો — આ માહિતી જોવાની પરવાનગી નથી.) and not-yet-available (આ મોડ્યુલ હજુ ઉપલબ્ધ નથી) states.
- Reference: approved UI/UX PDF v0.2.1 and mockups if present in the repo (search docs/); otherwise use this contract and say so in the report.

HARD RULES (apply to this whole task)
1. Inspect existing code first. Reuse existing modules, endpoints, components and services. Do not duplicate. Do not touch unrelated modules.
2. Stack is frozen: React 19 + TypeScript + Vite PWA, Dexie/IndexedDB; FastAPI, SQLAlchemy 2.0 async, asyncpg, Pydantic v2; PostgreSQL 16 + PostGIS; MapLibre; Python `qrcode`; `@zxing/browser`; Pillow; S3-compatible storage abstraction (local driver now). No new stack, no paid service.
3. DATABASE IS FROZEN: no DDL, no migrations, no new tables/columns/constraints, no `Base.metadata.create_all()`, never re-run schema SQL files. ORM must map the exact existing schema. If a feature needs a missing table/column, STOP that feature and report the exact missing object.
4. Tests: only against `pashurakshak_test_db` through `TEST_DATABASE_URL` (existing guard must reject a missing URL, the main DB name or the same URL; both `get_db` and `get_db_session` overridden). Never run write tests against `pashurakshak_db`. If isolation is not confirmed, do not run pytest and say so.
5. Backend is the authority for RBAC and district/village scope. Never trust client-supplied district_id/village_id. Frontend role checks are presentation only. Do not weaken any permission.
6. UI is Gujarati-only (Western digits 0-9); code comments and docs in English. Use real API data; never show mock data as real.
7. Do NOT invent clinical rules, vaccine schedules/doses, disease thresholds, outbreak radii, credentials, government access, or departmental authority. Where a rule is unresolved, implement nothing for it and flag it.
8. Offline: pending records/attachments are never silently deleted. Warn before logout when unsynced data exists.
9. Report only checks you actually executed. Label every item: Implemented / Frontend-connected / Tested (with evidence) / Not verified. A file or endpoint existing is not proof it works.
10. Keep the report concise (no code dumps). When finished, STOP and wait for approval.

COMPLETION REPORT (concise, use exactly these headings)
- Files changed (paths only)
- Screens / workflows completed
- APIs reused / APIs added (method + path)
- Unresolved decisions or blockers flagged
- Checks actually run (command -> result)
- Not verified
- Remaining work for this part
```

### PART 8 — Step 8.4 Maps and geospatial services

```text
GOAL: Scope-enforced geographic views with MapLibre, with no invented epidemiological rules.
INSPECT FIRST: how villages store coordinates/geometry in the ACTUAL database (lat/lon and/or PostGIS columns), coordinate verification status, the surveillance-summary endpoint, disease report GPS fields.
SCOPE
1. Backend maps service/router (read-only): villages with coordinates (scope-filtered by the user's district/village assignments; include coordinate status), and a surveillance layer aggregated per village from existing disease data: suspected vs confirmed counts SEPARATELY, latest report date, data freshness. Use PostGIS functions only where the existing columns support them. Never return villages outside scope. Never return individual farmer details.
2. Two SEPARATE layers: (a) disease surveillance, (b) vaccination coverage as counts only. Colour bands for coverage or surveillance risk require Department-approved thresholds - if none are configured, show neutral styling and the text that thresholds are not configured. NEVER show a village as 'safe/disease-free' because it has no reports: use a neutral 'ડેટા અપૂરતો / કોઈ રિપોર્ટ નથી' state. No outbreak radii, no clustering rules, no predictions.
3. Villages without verified coordinates appear in a 'સ્થાન ઉપલબ્ધ નથી' list, not on the map. Do not invent coordinates.
4. Frontend: MapLibre page for DAHO (district) and VO (assigned villages), layer switch, legend, village detail panel (aggregate counts only), table fallback when the map or tiles fail. Basemap: none by default (village markers on a plain background) or a self-hosted/free tile URL from env config; no API keys, no paid service.
EXCLUSIONS: reports/exports, new tables, alert thresholds, schema changes.
ACCEPTANCE: DAHO sees only own-district villages; VO only assigned villages; a village with no data is neutral, not green; suspected and confirmed counts never merge.
CHECKS TO RUN: backend tests for scope and aggregation (test DB only, isolation confirmed); tsc, vite build, vitest.

UI CONTRACT (approved green identity; follow existing styling system if one exists, otherwise CSS variables)
- Colours: primary #135D43, dark #0F4C37, secondary #208B63, mint #D5F0E4, info #0284C7, canvas #F8FAFB, border #E2E8F0, ink #1E293B, muted #64748B, sidebar #F0F3FF. Status chips (always colour + text + icon, never colour only): success bg #ECFDF5 / border #A7F3D0 / text #065F46; warning #FFFBEB / #FDE68A / #92400E; error #FEF2F2 / #FECACA / #991B1B; neutral #F1F5F9 / #CBD5E1 / #334155; info #EFF8FF / #BAE0FD / #075985.
- Fonts (bundle locally, no CDN): headings Plus Jakarta Sans + Noto Sans Gujarati; body Inter + Noto Sans Gujarati. Icons: Material Symbols Outlined (bundled). Sizes: page title 27-30px/700, section 16-19px/700, body 14px (web) / 15-16px (field mobile), labels 11-12.5px/600; Gujarati line-height 1.55-1.7. Dates DD/MM/YYYY.
- Layout: web = 252px sidebar + 60px top bar, content padding 24-26px, cards radius 14px with 1px border, buttons 40px high radius 8px; mobile = app bar + bottom nav (66px, max 5 items), primary field buttons 52px, touch targets >= 44px. One responsive PWA; desktop and mobile feature parity.
- Sync chips: ઓફલાઇન, સિંક બાકી, સિંક થઈ રહ્યું છે, સિંક થયું, સિંક નિષ્ફળ, સમીક્ષા જરૂરી. Every screen needs loading (લોડ થઈ રહ્યું છે…), empty (કોઈ માહિતી નથી), error (કંઈક ખોટું થયું. ફરી પ્રયાસ કરો.), access-denied (પ્રવેશ નકારાયો — આ માહિતી જોવાની પરવાનગી નથી.) and not-yet-available (આ મોડ્યુલ હજુ ઉપલબ્ધ નથી) states.
- Reference: approved UI/UX PDF v0.2.1 and mockups if present in the repo (search docs/); otherwise use this contract and say so in the report.

HARD RULES (apply to this whole task)
1. Inspect existing code first. Reuse existing modules, endpoints, components and services. Do not duplicate. Do not touch unrelated modules.
2. Stack is frozen: React 19 + TypeScript + Vite PWA, Dexie/IndexedDB; FastAPI, SQLAlchemy 2.0 async, asyncpg, Pydantic v2; PostgreSQL 16 + PostGIS; MapLibre; Python `qrcode`; `@zxing/browser`; Pillow; S3-compatible storage abstraction (local driver now). No new stack, no paid service.
3. DATABASE IS FROZEN: no DDL, no migrations, no new tables/columns/constraints, no `Base.metadata.create_all()`, never re-run schema SQL files. ORM must map the exact existing schema. If a feature needs a missing table/column, STOP that feature and report the exact missing object.
4. Tests: only against `pashurakshak_test_db` through `TEST_DATABASE_URL` (existing guard must reject a missing URL, the main DB name or the same URL; both `get_db` and `get_db_session` overridden). Never run write tests against `pashurakshak_db`. If isolation is not confirmed, do not run pytest and say so.
5. Backend is the authority for RBAC and district/village scope. Never trust client-supplied district_id/village_id. Frontend role checks are presentation only. Do not weaken any permission.
6. UI is Gujarati-only (Western digits 0-9); code comments and docs in English. Use real API data; never show mock data as real.
7. Do NOT invent clinical rules, vaccine schedules/doses, disease thresholds, outbreak radii, credentials, government access, or departmental authority. Where a rule is unresolved, implement nothing for it and flag it.
8. Offline: pending records/attachments are never silently deleted. Warn before logout when unsynced data exists.
9. Report only checks you actually executed. Label every item: Implemented / Frontend-connected / Tested (with evidence) / Not verified. A file or endpoint existing is not proof it works.
10. Keep the report concise (no code dumps). When finished, STOP and wait for approval.

COMPLETION REPORT (concise, use exactly these headings)
- Files changed (paths only)
- Screens / workflows completed
- APIs reused / APIs added (method + path)
- Unresolved decisions or blockers flagged
- Checks actually run (command -> result)
- Not verified
- Remaining work for this part
```

### PART 9 — Step 8.5 Reports and exports

```text
GOAL: Scoped reports and safe exports for DAHO, VO and (aggregate-only) Cooperative.
INSPECT FIRST: existing tables/ORM for campaigns, vaccination events, vaccine ledger, disease reports, farmers/animals, and any export log table (map the exact schema; no DDL).
SCOPE
1. Backend report service/router with query-level scope (never filter only in Python after fetching): campaign vaccination counts and coverage COUNTS (no target percentages or bands unless the Department-approved target exists in configuration), inventory and stock-movement report, disease surveillance summary (suspected vs confirmed separate), registry counts (farmers/animals by village), FW/VO activity counts. Cooperative gets aggregate overdue/progress counts only, never individual owner details.
2. Exports: CSV for all reports with formula-injection protection (cells starting with = + - @ tab or CR are neutralised); PDF only for the DAHO district summary if a Gujarati-capable font (Noto Sans Gujarati) can be embedded - otherwise CSV only and say so. Record each export (who, report, filters, time) in the existing export-log table if present, else in existing audit mechanism; no new tables.
3. Frontend: report pages per role with filters (date range, village within scope, campaign), table + CSV/PDF download buttons, empty/error/403 states, Gujarati labels, DD/MM/YYYY dates.
4. No invented KPIs, thresholds or official statistics.
EXCLUSIONS: maps, notifications, schema changes.
ACCEPTANCE: an FW/VO/DAHO/Coop gets only in-scope rows; exported files contain only in-scope data and are formula-safe; counts match direct DB queries in tests.
CHECKS TO RUN: backend tests including a scope-leak test and a CSV-injection test (test DB only, isolation confirmed); tsc, vite build, vitest.

UI CONTRACT (approved green identity; follow existing styling system if one exists, otherwise CSS variables)
- Colours: primary #135D43, dark #0F4C37, secondary #208B63, mint #D5F0E4, info #0284C7, canvas #F8FAFB, border #E2E8F0, ink #1E293B, muted #64748B, sidebar #F0F3FF. Status chips (always colour + text + icon, never colour only): success bg #ECFDF5 / border #A7F3D0 / text #065F46; warning #FFFBEB / #FDE68A / #92400E; error #FEF2F2 / #FECACA / #991B1B; neutral #F1F5F9 / #CBD5E1 / #334155; info #EFF8FF / #BAE0FD / #075985.
- Fonts (bundle locally, no CDN): headings Plus Jakarta Sans + Noto Sans Gujarati; body Inter + Noto Sans Gujarati. Icons: Material Symbols Outlined (bundled). Sizes: page title 27-30px/700, section 16-19px/700, body 14px (web) / 15-16px (field mobile), labels 11-12.5px/600; Gujarati line-height 1.55-1.7. Dates DD/MM/YYYY.
- Layout: web = 252px sidebar + 60px top bar, content padding 24-26px, cards radius 14px with 1px border, buttons 40px high radius 8px; mobile = app bar + bottom nav (66px, max 5 items), primary field buttons 52px, touch targets >= 44px. One responsive PWA; desktop and mobile feature parity.
- Sync chips: ઓફલાઇન, સિંક બાકી, સિંક થઈ રહ્યું છે, સિંક થયું, સિંક નિષ્ફળ, સમીક્ષા જરૂરી. Every screen needs loading (લોડ થઈ રહ્યું છે…), empty (કોઈ માહિતી નથી), error (કંઈક ખોટું થયું. ફરી પ્રયાસ કરો.), access-denied (પ્રવેશ નકારાયો — આ માહિતી જોવાની પરવાનગી નથી.) and not-yet-available (આ મોડ્યુલ હજુ ઉપલબ્ધ નથી) states.
- Reference: approved UI/UX PDF v0.2.1 and mockups if present in the repo (search docs/); otherwise use this contract and say so in the report.

HARD RULES (apply to this whole task)
1. Inspect existing code first. Reuse existing modules, endpoints, components and services. Do not duplicate. Do not touch unrelated modules.
2. Stack is frozen: React 19 + TypeScript + Vite PWA, Dexie/IndexedDB; FastAPI, SQLAlchemy 2.0 async, asyncpg, Pydantic v2; PostgreSQL 16 + PostGIS; MapLibre; Python `qrcode`; `@zxing/browser`; Pillow; S3-compatible storage abstraction (local driver now). No new stack, no paid service.
3. DATABASE IS FROZEN: no DDL, no migrations, no new tables/columns/constraints, no `Base.metadata.create_all()`, never re-run schema SQL files. ORM must map the exact existing schema. If a feature needs a missing table/column, STOP that feature and report the exact missing object.
4. Tests: only against `pashurakshak_test_db` through `TEST_DATABASE_URL` (existing guard must reject a missing URL, the main DB name or the same URL; both `get_db` and `get_db_session` overridden). Never run write tests against `pashurakshak_db`. If isolation is not confirmed, do not run pytest and say so.
5. Backend is the authority for RBAC and district/village scope. Never trust client-supplied district_id/village_id. Frontend role checks are presentation only. Do not weaken any permission.
6. UI is Gujarati-only (Western digits 0-9); code comments and docs in English. Use real API data; never show mock data as real.
7. Do NOT invent clinical rules, vaccine schedules/doses, disease thresholds, outbreak radii, credentials, government access, or departmental authority. Where a rule is unresolved, implement nothing for it and flag it.
8. Offline: pending records/attachments are never silently deleted. Warn before logout when unsynced data exists.
9. Report only checks you actually executed. Label every item: Implemented / Frontend-connected / Tested (with evidence) / Not verified. A file or endpoint existing is not proof it works.
10. Keep the report concise (no code dumps). When finished, STOP and wait for approval.

COMPLETION REPORT (concise, use exactly these headings)
- Files changed (paths only)
- Screens / workflows completed
- APIs reused / APIs added (method + path)
- Unresolved decisions or blockers flagged
- Checks actually run (command -> result)
- Not verified
- Remaining work for this part
```

### PART 10 — Consolidated completion and end-to-end test pass

```text
GOAL: Close integration gaps across the six roles, then run ONE planned test pass with real evidence.
STEP A - gap review (no new audit documents): walk these chains in code and list what is missing or broken, then fix the genuine gaps within existing architecture:
 1. DAHO login -> create taluka/village -> (assignment per the resolved authority flag) -> FW login sees only assigned villages -> FW registers farmer/animal -> QR -> disease report with photos offline -> sync -> VO inbox -> authorised decision -> DAHO surveillance/map/report within scope.
 2. Farmer OTP login (provisioned) -> own animals/history -> transfer request -> decision -> notification.
 3. Campaign (DAHO) -> VO assigns FWs -> camp confirm -> authorised vaccinator records vaccination -> stock/inventory -> report.
 4. Cooperative scoped dashboard/camp coordination; SYS_ADMIN technical views with no operational scope.
STEP B - test pass (only after confirming test-DB isolation):
 - Backend: full pytest on `pashurakshak_test_db`; add a generated authorisation matrix test that calls every route in /openapi.json with each role and asserts scope/permission outcomes (cross-district, cross-village, farmer-vs-farmer, coop-vs-owner-details, FW-vs-confirm, SYS_ADMIN-vs-operational data).
 - Frontend: tsc --noEmit, vitest, vite build; a small Playwright smoke (or equivalent) for the critical chain against a test stack with synthetic data inserted ONLY into the test DB.
 - Offline/sync: duplicate event, lost ack retry, expired 7-day grant, logout with pending data, storage failure message.
 - Security hygiene: pip-audit and npm audit summaries (report only), secrets not committed, CORS and rate limits present.
STEP C - honest status table per module and role: Implemented / Frontend-connected / Tested (evidence) / Not verified, plus a list of unresolved departmental decisions that still block behaviour.
EXCLUSIONS: deployment, new features, schema changes, anything not required by the chains above.
ACCEPTANCE: every command and its real output summary is reported; failures are listed, not hidden; nothing is claimed passing that was not run.

HARD RULES (apply to this whole task)
1. Inspect existing code first. Reuse existing modules, endpoints, components and services. Do not duplicate. Do not touch unrelated modules.
2. Stack is frozen: React 19 + TypeScript + Vite PWA, Dexie/IndexedDB; FastAPI, SQLAlchemy 2.0 async, asyncpg, Pydantic v2; PostgreSQL 16 + PostGIS; MapLibre; Python `qrcode`; `@zxing/browser`; Pillow; S3-compatible storage abstraction (local driver now). No new stack, no paid service.
3. DATABASE IS FROZEN: no DDL, no migrations, no new tables/columns/constraints, no `Base.metadata.create_all()`, never re-run schema SQL files. ORM must map the exact existing schema. If a feature needs a missing table/column, STOP that feature and report the exact missing object.
4. Tests: only against `pashurakshak_test_db` through `TEST_DATABASE_URL` (existing guard must reject a missing URL, the main DB name or the same URL; both `get_db` and `get_db_session` overridden). Never run write tests against `pashurakshak_db`. If isolation is not confirmed, do not run pytest and say so.
5. Backend is the authority for RBAC and district/village scope. Never trust client-supplied district_id/village_id. Frontend role checks are presentation only. Do not weaken any permission.
6. UI is Gujarati-only (Western digits 0-9); code comments and docs in English. Use real API data; never show mock data as real.
7. Do NOT invent clinical rules, vaccine schedules/doses, disease thresholds, outbreak radii, credentials, government access, or departmental authority. Where a rule is unresolved, implement nothing for it and flag it.
8. Offline: pending records/attachments are never silently deleted. Warn before logout when unsynced data exists.
9. Report only checks you actually executed. Label every item: Implemented / Frontend-connected / Tested (with evidence) / Not verified. A file or endpoint existing is not proof it works.
10. Keep the report concise (no code dumps). When finished, STOP and wait for approval.

COMPLETION REPORT (concise, use exactly these headings)
- Files changed (paths only)
- Screens / workflows completed
- APIs reused / APIs added (method + path)
- Unresolved decisions or blockers flagged
- Checks actually run (command -> result)
- Not verified
- Remaining work for this part
```

## Notes for you (not for Antigravity)
- Part 6 needs a scoped reference-data endpoint because `/sync/pull` is reportedly absent; the prompt makes Antigravity design it within the existing schema and stop if the schema cannot support it.
- Parts 7–9 may find that a required table does not exist; they are told to stop and report rather than create it. Bring such a report back and decide.
- Do not paste Part 10 until the earlier parts are approved; it is the one planned test pass.
