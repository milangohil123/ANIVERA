**# TRD — Technical Requirements Document**

**\*\*Project:\*\*** PS000195 — Digital Livestock Vaccination Tracking and Disease Early-Warning Platform (Botad)

**\*\*Working name:\*\*** PashuRakshak Botad *\*(provisional placeholder)\** · **\*\*Document:\*\*** 3 of 7 · **\*\*Version:\*\*** v0.2 targeted alignment · **\*\*Date:\*\*** 31 October 2026

**\*\*Baseline:\*\*** PRD v0.2 (APPFLOW v0.4 and BACKENDDATABASESCHEMA v0.4 aligned), APPFLOW v0.4, BACKENDDATABASESCHEMA v0.4 and UI/UX Design Specification v0.2.1.



\> **\*\*Status.\*\*** This is a design document. **\*\*Nothing is implemented.\*\*** Technology choices are **\*\*[PROPOSED]\*\*** and follow the stack you approved; items needing Department input are **\*\*[PENDING]\*\***; figures are **\*\*[ASSUMPTION]\*\***. No government API, credential, sandbox, vaccination schedule or disease threshold is invented here.



Labels: **\*\*[OFFICIAL]\*\*** required by PS000195/master prompt · **\*\*[PROPOSED]\*\*** proposed technical decision · **\*\*[ASSUMPTION]\*\*** pilot planning figure · **\*\*[PENDING]\*\*** needs approval/access · **\*\*[DEMO]\*\*** illustrative.



**---**

**## 1. Technical goals and constraints**

\| # | Goal / constraint | Source |

\|---|---|---|

\| T1 | Field-critical functions work with no internet after data download | OFFICIAL |

\| T2 | Safe synchronisation: stable event IDs, idempotency, per-record acks, conflicts, retries | OFFICIAL |

\| T3 | Pending records are **\*\*never\*\*** deleted by logout, expiry, offline-period lapse or upgrade | Decision (v0.2.1) |

\| T4 | Default offline authorisation 7 days (configurable); then online re-authentication before further offline work | Decision |

\| T5 | Backend-enforced RBAC with district, village, own-record and aggregate scopes as applicable; audit sensitive actions | OFFICIAL |

\| T6 | Free/open-source components; vendor-neutral hosting; minimal infrastructure | Decision |

\| T7 | Pilot scale ≈ 20,000 animals, ≈ 15 field users, 10 villages, 1 cycle | ASSUMPTION |

\| T8 | Gujarati-only UI; Western digits; fonts bundled for offline | Decision |

\| T9 | External integrations only behind adapters; Bharat Pashudhan is *\*Pending departmental approval and authorized API access\** | PENDING |

\| T10 | Mid-range Android + Chrome; desktop browsers for officers | ASSUMPTION |



**---**

**## 2. System architecture**

**### 2.1 Logical architecture \*\*[PROPOSED]\*\***

\`\`\`mermaid

flowchart LR

  subgraph Client["Browser / PWA (React + Vite)"]

    UI[Role-specific UI\<br/>Gujarati strings]

    SW[Service Worker\<br/>app shell cache]

    DX[(IndexedDB via Dexie\<br/>records, queue, meta)]

    SY[Sync controller]

    QS[QR scanner]

    MAP[MapLibre map]

    UI --> DX

    UI --> QS

    UI --> MAP

    SY <--> DX

  end

  subgraph Server["Server (single deployable unit, modular)"]

    PX[Reverse proxy / TLS]

    API[FastAPI REST API]

    WK[Worker: jobs + scheduler]

    ADP[Adapters: SMS · Bharat Pashudhan · Map tiles]

  end

  DB[(PostgreSQL\<br/>+ PostGIS if justified)]

  FS[(File storage:\<br/>import files, label PDFs, reports)]

  Client <-- HTTPS REST --> PX --> API

  API --> DB

  WK --> DB

  API --> FS

  WK --> FS

  WK --> ADP

  API --> ADP

\`\`\`



**### 2.2 Component responsibilities**

\| Component | Responsibility | Does **\*\*not\*\*** do |

\|---|---|---|

\| **\*\*React PWA\*\*** | Role UIs, forms, validation hints, QR scan, local search, queueing events, showing sync state, map display | Decide authorisation, mark SYNCED without ack, compute official due lists beyond cached rules |

\| **\*\*Service worker\*\*** | Cache app shell and static assets (incl. Gujarati fonts), serve offline | Carry business logic; it is *\*not\** the sync engine |

\| **\*\*Dexie / IndexedDB\*\*** | Persist downloaded records, reference data, pending events, drafts, sync metadata, auth metadata | Hold unneeded personal data |

\| **\*\*Sync controller\*\*** (in the page) | Find pending events, batch-upload, retry with backoff, apply per-record acks, manual sync, resume after restart | Rely solely on browser Background Sync |

\| **\*\*FastAPI API\*\*** | Authentication, authorisation, validation, domain services, REST endpoints, audit writes | Long-running work (delegated to worker) |

\| **\*\*Worker\*\*** | Import jobs, label PDF generation, reminder preparation/dispatch, alert-rule evaluation, report generation, data-quality scans | Serve interactive requests |

\| **\*\*PostgreSQL\*\*** | Source of truth for all records, constraints, transactions, job queue, audit | Store secrets in plain text |

\| **\*\*Adapters\*\*** | SMS provider, Bharat Pashudhan, map basemap — each behind an interface with a *\*simulated/disabled\** implementation | Be called directly by feature code |

\| **\*\*File storage\*\*** | Uploaded import files (quarantined), generated PDFs/reports with expiry | Serve files without authorisation |



**### 2.3 Architectural style \*\*[PROPOSED]\*\***

A **\*\*modular monolith\*\*** (one FastAPI codebase, one database, one worker process using the same code) rather than microservices: pilot scale, small team, fewer moving parts, simple deployment on one server. Modules have clear boundaries (see §7) so they can be split later.



**---**

**## 3. Technology stack and justification**

\| Layer | Choice | Why | Alternatives considered / rejected |

\|---|---|---|---|

\| Frontend | **\*\*React 18 + Vite + TypeScript\*\*** | Mature PWA tooling, small bundles, large talent pool | Next.js: SSR not needed for an offline-first app and adds server complexity |

\| PWA | **\*\*vite-plugin-pwa (Workbox)\*\*** | Precaching and runtime caching with little code | Hand-written SW: more bugs |

\| Local DB | **\*\*Dexie (IndexedDB)\*\*** | Typed schema, versioned migrations, indexes, transactions | Raw IndexedDB: verbose; SQLite-WASM: heavier, less proven on low-end devices |

\| Server state | **\*\*TanStack Query\*\*** | Caching, retries for online reads | Redux: heavier |

\| Forms/validation | **\*\*React Hook Form + Zod\*\*** | Shared validation rules, small footprint | — |

\| UI strings | **\*\*Plain TypeScript module \`strings.gu.ts\`\*\*** | Gujarati-only requirement; no translation framework | react-i18next: unnecessary (no language selector) |

\| QR scanning | **\*\*Browser \`BarcodeDetector\` where available, \`@zxing/browser\` fallback\*\*** | Works on varied Android devices | Native camera apps: no offline lookup |

\| Map | **\*\*MapLibre GL JS\*\*** | Open-source vector map renderer | Google Maps: paid/vendor lock-in |

\| Backend | **\*\*Python 3.12 + FastAPI\*\*** | Typed validation (Pydantic v2), OpenAPI generation, async IO, strong data/Excel ecosystem | NestJS: viable, but Python eases Excel import/PDF/geo work |

\| ORM / migrations | **\*\*SQLAlchemy 2.0 + Alembic\*\*** | Explicit SQL control, migrations | Raw SQL only: slower development |

\| Database | **\*\*PostgreSQL 16\*\*** | Transactions, constraints, partial/unique indexes, JSONB, \`SKIP LOCKED\` queue | MongoDB: weak relational integrity |

\| Geospatial | **\*\*PostGIS only if\*\*** village polygons / spatial clustering queries are needed; otherwise plain \`lat/lon\` columns | Avoid extension if justified later | — |

\| Job queue | **\*\*PostgreSQL-backed jobs\*\*** (\`jobs\` table, \`FOR UPDATE SKIP LOCKED\`) | No extra infrastructure; transactional enqueue with data | Redis+Celery/RQ: add only if sustained load, delayed-job volume or concurrency demands it |

\| Excel/CSV | **\*\*openpyxl, \`csv\`, \`python-magic\`/signature checks\*\*** | Safe parsing of xlsx/csv | pandas: heavier dependency |

\| QR generation | **\*\*\`segno\`\*\*** (or \`qrcode\`) | Pure-Python, small | — |

\| PDF labels | **\*\*ReportLab\*\*** | Programmatic multi-label A4 sheets, no browser needed | WeasyPrint: heavier system deps |

\| Password hashing | **\*\*argon2-cffi\*\*** | Modern hash | bcrypt acceptable fallback |

\| Tokens | **\*\*JWT (access) + rotating refresh tokens\*\*** | Stateless API; revocable refresh | Server sessions: need sticky storage |

\| Reverse proxy | **\*\*Caddy or nginx\*\*** | TLS termination, static files, gzip/brotli | — |

\| Containers | **\*\*Docker Compose\*\*** | Vendor-neutral, reproducible | Kubernetes: overkill for pilot |

\| Tests | **\*\*pytest, httpx, Testcontainers (PostgreSQL), Vitest, fake-indexeddb, Playwright\*\*** | Covers API, sync, offline, E2E | — |



**\*\*Dependency discipline [PROPOSED]:\*\*** each dependency needs a reason; avoid UI-kit bloat; target < 250 KB gzipped JS for field-worker routes **\*\*[ASSUMPTION]\*\***.



**---**

**## 4. Frontend architecture**

**### 4.1 Module layout \*\*[PROPOSED]\*\***

\`\`\`

frontend/src/

  app/            routing, providers, role shells (web sidebar / mobile bottom nav)

  features/

    auth/ farmers/ animals/ scan/ vaccination/ treatment/ disease/ due-lists/

    sync/ help-requests/ import/ labels/ campaigns/ camps/ inventory/ transfers/ notifications/ map/ admin/ audit/

  offline/        db.ts (Dexie), repositories, queue.ts, syncController.ts, authGrant.ts

  ui/             design-system components (buttons, chips, cards, tables)

  i18n/           strings.gu.ts

  lib/            api client, zod schemas, date utils, permissions helper

\`\`\`

**### 4.2 Routing and shells**

\- **\*\*Role shells:\*\*** Veterinary Officer (sidebar), Field Worker (bottom nav: Home · Scan · Pending · Sync · Profile), Farmer (Home · My animals · Reminders · Profile), Dairy, DAHO, Panchayat, Admin (sidebars per UI/UX §7.1).

\- Route guards use the permission list returned by \`/auth/me\` **\*\*for UX only\*\***; the backend is the authority.

\- Code splitting per role so field workers do not download admin/map code.



**### 4.3 State management**

\| State | Home |

\|---|---|

\| Server cache (online) | TanStack Query |

\| Offline records, queue, drafts | Dexie (single source on the device) |

\| UI-only state | React state/context |

Forms autosave drafts to Dexie so recoverable errors never lose input.



**### 4.4 Design system**

Implements UI/UX §5: tokens (\`--p:#135D43\`, \`--s:#208B63\`, \`--t:#0284C7\`, amber, red, grey), Plus Jakarta Sans/Inter/Noto Sans Gujarati **\*\*bundled as local WOFF2\*\*** (no external font service), Material Symbols icons bundled locally. Status chips for sync states and disease/coverage layers are shared components so labels cannot drift.



**### 4.5 QR scanning**

\`BarcodeDetector\` → ZXing fallback; scanning extracts a **\*\*QR token\*\*** (see §12) and looks it up in Dexie index \`qrToken\`. Not found locally + online → \`GET /animals/resolve?token=\`; not found anywhere → *\*unknown animal\** workflow (draft registration). Torch toggle and manual tag/owner search fallback. After two failed scans the UI hints to use manual search.



**### 4.6 Map**

MapLibre renders village nodes/markers from \`GET /map/coverage\` and \`GET /map/disease\` (aggregates only). Basemap: **\*\*[PENDING]\*\*** — options: (a) none (schematic village-node view as in the mockups), (b) self-hosted vector tiles (e.g., PMTiles of Botad extracted from OpenStreetMap data under its licence), (c) a public tile service subject to its usage policy (not for heavy use). Villages without verified coordinates appear in a “location unavailable” list, never on invented positions.



**---**

**## 5. Offline data layer \*\*[OFFICIAL]\*\***

**### 5.1 What is stored on the device**

\| Dexie table | Content | Notes |

\|---|---|---|

\| \`animals\` | Downloaded animals for assigned villages (id, animalCode, qrToken, tag12, species, breed, sex, ageOrDob, villageId, ownerId, identityStatus, rowVersion, lastEventSummary) | Indexed by \`qrToken\`, \`animalCode\`, \`tag12\`, \`villageId\`, \`ownerNameNorm\` |

\| \`owners\` | Minimal owner data (id, name, masked phone, consent flag) as authorised | Minimise personal data |

\| \`events\` | Recent history of downloaded animals (read-only cache of synced events) | Bounded per animal |

\| \`ref\` | Species, programmes (FMD/HS/BQ/Brucellosis/PPR), **\*\*approved schedule rules\*\*** (if approved), villages, vaccine list, permission list | With \`refVersion\` and \`fetchedAt\` |

\| \`queue\` | **\*\*Pending events\*\*** (see §5.2) | Never auto-deleted |

\| \`drafts\` | Unsaved form drafts, draft animal registrations | — |

\| \`syncMeta\` | Cursor tokens, last sync time, per-village package version/time | Shown in UI as “data last updated” |

\| \`authMeta\` | userId, role, assigned villages, \`offlineValidUntil\`, last server time seen | No passwords |



**### 5.2 Queue record (per event)**

\`\`\`ts

interface QueuedEvent {

  eventId: string;            // crypto.randomUUID(), stable; idempotency key

  ownerUserId: string;        // user who created it; used for recovery after logout

  deviceId: string;

  type: 'VACCINATION'|'TREATMENT'|'OBSERVATION'|'DISEASE_REPORT'|'ANIMAL_DRAFT'|'HELP_REQUEST'|'CORRECTION'|'FARMER_DRAFT';

  payload: Record\<string, unknown>;   // validated by zod

  clientCreatedAt: string;            // ISO, device time

  schemaVersion: number;

  state: 'PENDING_SYNC'|'SYNCING'|'SYNC_FAILED'|'NEEDS_REVIEW'|'SYNCED';

  attempts: number; lastAttemptAt?: string; nextRetryAt?: string;

  serverAck?: { status: string; serverTime: string; code?: string; message?: string };

}

\`\`\`

\`OFFLINE\` is a connectivity state shown in the UI; record states are the others. \`SYNCED\` rows are kept briefly for display, then pruned — **\*\*only after\*\*** the ack is stored.



**### 5.3 Rules**

1\. **\*\*Local first:\*\*** saving an event writes to Dexie inside one transaction and returns; network is irrelevant.

2\. **\*\*Persistent storage:\*\*** request \`navigator.storage.persist()\` and show a warning if denied (reduces risk of browser eviction).

3\. **\*\*Quota exceeded:\*\*** block *\*new\** saves with a clear message and offer sync; **\*\*never delete queue rows\*\***; only prune synced cache.

4\. **\*\*Logout (v0.2.1):\*\*** logout **\*\*never deletes\*\*** \`queue\` rows. The app locks the session and removes **\*\*only synced, read-only cached data\*\*** if configured; pending rows stay in Dexie, tagged \`ownerUserId\`, and resume syncing when that user logs in again. There is no “logout and erase” while unsynced rows exist.

5\. **\*\*Shared device:\*\*** if another user logs in, the previous user’s pending rows are not shown or uploaded under the new identity; they remain until their owner returns, or an administrator uses the held-for-review path (§6.6).

6\. **\*\*Browser data cleared / lost device:\*\*** unsynced records are unrecoverable from the device — mitigated by: persistent-storage request, prominent pending count, frequent sync prompts, admin monitor of long-offline users, and an **\*\*“export pending records” file\*\*** (**\*\*[PROPOSED]\*\***, Should) to recover/import later.

7\. **\*\*App upgrade:\*\*** Dexie versioned migrations run before UI mount; if a migration fails the app stays on the old version and shows an error (queue untouched).



**### 5.4 Offline authorisation (7 days) \*\*[PROPOSED]\*\***

\- At every online login/refresh the server returns a signed **\*\*offline grant\*\*** (\`offlineValidUntil = serverNow + offlinePeriod\`, default **\*\*7 days\*\***, administrator-configurable) plus the user’s role, assigned villages and permission list.

\- While \`now < offlineValidUntil\` the user may open the cached app, search, scan and record events.

\- After expiry the app shows a **\*\*“re-authenticate online”\*\*** lock screen: no further offline work; pending rows remain untouched; after online login they sync.

\- **\*\*Clock tampering:\*\*** store the last server time seen; if the device clock goes backwards relative to it, treat the grant as expired. Full enforcement offline is impossible; this limitation is documented.

\- **\*\*Offline action boundary:\*\*** offline grants permit only explicitly downloaded, role-authorised field workflows: scanning/searching cached records, creating permitted animal drafts (subject to FW-first/VO-fallback checks at server sync), vaccination/treatment/observation records, disease/help reports and drafts. Campaign creation/configuration, campaign assignment, camp approval/decision, stock receipt/issue/adjustment/transfer, ownership-transfer approval, user/role/district setup and disease confirmation are online-only. The server rechecks current permissions, scope and workflow conditions at sync; an offline grant is not a guarantee of acceptance.

\- **\*\*Local data protection [PENDING decision]:\*\*** IndexedDB is not encrypted by default. Option A: optional device PIN that derives a key (PBKDF2/Argon2-WASM) to encrypt personal fields with AES-GCM; Option B: minimal personal data + rely on OS screen lock. Default until decided: Option B with minimisation. Recorded as a Department/security decision.



**---**

**## 6. Synchronisation service \*\*[OFFICIAL]\*\***

**### 6.1 Principles**

Stable event IDs · idempotent server processing · per-record acknowledgements · bounded retry · partial success · server validation · conflict detection · recovery after restart · manual sync · **\*\*no reliance on browser Background Sync alone\*\*** · SYNCED only after server ack.



**### 6.2 Triggers (foreground controller)**

App open · connectivity regained (\`online\` event + health probe) · after saving an event (debounced) · every N minutes while open · user taps “Sync now”. Background Sync API may *\*additionally\** wake the app where supported but is never required.



**### 6.3 Push protocol**

\`POST /api/v1/sync/push\` — batch of up to **\*\*50 events\*\*** or ≈ 1 MB **\*\*[ASSUMPTION]\*\***, ordered by \`clientCreatedAt\`.

\`\`\`json

{

  "deviceId": "d6c1…",

  "clientTime": "2026-10-30T14:05:11Z",

  "events": [

    {

      "eventId": "3b8e5d52-6a1f-4c0e-9a77-0f8e3c1c9a10",

      "type": "VACCINATION",

      "clientCreatedAt": "2026-10-30T13:52:00Z",

      "schemaVersion": 1,

      "payload": {

        "animalId": "e2d0…", "programmeCode": "FMD", "administeredOn": "2026-10-30",

        "batchNumber": null, "remarks": null

      }

    }

  ]

}

\`\`\`

Response (**\*\*per-record acknowledgements\*\***, HTTP 200 even for partial failure):

\`\`\`json

{

  "serverTime": "2026-10-30T14:05:12Z",

  "results": [

    {"eventId": "3b8e…", "status": "ACCEPTED", "serverEventSeq": 18422},

    {"eventId": "9a21…", "status": "ALREADY_ACCEPTED", "serverEventSeq": 18390},

    {"eventId": "c4d7…", "status": "REJECTED", "code": "VALIDATION_FAILED",

     "errors": [{"field": "administeredOn", "code": "FUTURE_DATE"}]},

    {"eventId": "77f0…", "status": "NEEDS_REVIEW", "code": "POSSIBLE_DUPLICATE_EVENT", "conflictId": "…"}

  ]

}

\`\`\`

\| Status | Client action |

\|---|---|

\| \`ACCEPTED\` | Mark \`SYNCED\`, store ack |

\| \`ALREADY_ACCEPTED\` | Mark \`SYNCED\` (idempotent duplicate) |

\| \`REJECTED\` | Mark \`SYNC_FAILED\`, keep payload, show Gujarati reason and fix action (edit → new attempt keeps lineage) |

\| \`NEEDS_REVIEW\` | Mark \`NEEDS_REVIEW\`; officer resolves on server |

\| \`HELD_FOR_REVIEW\` | Mark \`NEEDS_REVIEW\`; created by a deactivated user (see §6.6) |

Network failure / 5xx / timeout → state returns to \`PENDING_SYNC\` with \`nextRetryAt\`; **\*\*never\*\*** \`SYNCED\`.



**### 6.4 Server-side processing (per event, one DB transaction)**

1\. Authenticate; check user active; check role/village scope for the event’s animal.

2\. \`INSERT … ON CONFLICT (event_id) DO NOTHING\`; if existing → \`ALREADY_ACCEPTED\`.

3\. Validate payload (schema, dates not in future/not before birth where DOB is verified, programme in an approved list for species, animal exists/visible, and schedule/campaign applicability where required).

4\. For animal registration, enforce the APPFLOW v0.4 gate: identify the assigned Field Worker for the village. FW is the primary registrar. VO fallback is permitted only with the current explicit authorised UNAVAILABLE record, its reference and a reason; block VO fallback if FW is AVAILABLE. If assignment or availability is unknown/ambiguous/expired, return a review/exception result; do not infer unavailability from a timeout. Apply the same service rule to online endpoints, sync, imports and retries.

5\. Conflict checks (§6.5).

6\. Write event + detail row + \`sync_receipts\` row + audit; return result.

A failure in one event does not roll back others (each is its own transaction/savepoint).



**### 6.5 Conflict rules \*\*[PROPOSED]\*\***

\| Situation | Handling |

\|---|---|

\| Same event ID again | Idempotent \`ALREADY_ACCEPTED\` |

\| Two workers record the same programme for the same animal within a configurable window | Both accepted as history, flagged \`POSSIBLE_DUPLICATE_EVENT\` → \`NEEDS_REVIEW\` for officer (no overwrite) |

\| Edit to mutable fields (owner, village, identity attributes) with stale \`baseRowVersion\` | \`NEEDS_REVIEW\` with both versions; verified identity never overwritten |

\| Draft animal duplicates an existing tag/animal | Animal stays \`UNVERIFIED\`; flagged for merge/verify |

\| Event for animal outside user’s villages | \`REJECTED\` (\`FORBIDDEN_SCOPE\`), audited |

\| Unknown animal ID | \`REJECTED\` (\`ANIMAL_NOT_FOUND\`) unless a preceding \`ANIMAL_DRAFT\` in the same batch creates it |

\| Event from deactivated user | \`HELD_FOR_REVIEW\` (payload retained) |



**### 6.6 Held-for-review path**

Deactivation revokes refresh tokens and blocks normal authenticated sync. Because the server cannot review a payload it has not received, the client must retain the pending rows locally. If a separately authorised recovery procedure is approved, the device/user may submit a recovery package through a dedicated restricted endpoint or assisted process; the server stores each received item in a quarantine/held-for-review state with original owner, device, event ID, timestamps and provenance. An authorised officer reviews it before any domain event is created. No administrator may silently reassign the original user identity, and no held item is treated as accepted vaccination/disease history before review. If no recovery procedure is configured, the client keeps the data and displays that online assisted recovery is required.



**### 6.7 Retry policy**

Backoff 5 s → 15 s → 45 s → 2 min → 5 min → capped at 15 min, ± jitter, while online; resets on success; manual “Sync now” bypasses the timer. Poison events (repeated REJECTED) stop retrying until the user edits them.



**### 6.8 Pull / refresh**

\- \`GET /api/v1/sync/villages/{villageId}/package?cursor=\` → paginated animals/owners/events summary + \`packageVersion\`, \`generatedAt\`.

\- \`GET /api/v1/sync/changes?village=&since=\<token>\` → incremental changes (new events, status changes, reference-data version).

\- After a successful push the client refreshes affected animals and \`ref\` data. The UI always shows “data last updated”.



**---**

**## 7. Backend architecture**

**### 7.1 Package layout \*\*[PROPOSED]\*\***

\`\`\`

backend/app/

  main.py                 app factory, middleware, routers

  core/                   config (pydantic-settings), security, db session, logging, errors

  modules/

    auth/      users, otp, sessions, offline grants

    rbac/      roles, permissions, village scope, policies

    animals/   animals, identifiers, qr tokens, merge, ownership history

    events/    vaccination/treatment/observation, corrections

    schedules/ programmes, schedule versions, due calculation

    sync/      push/pull, receipts, conflicts

    imports/   upload, mapping, validation, commit

    labels/    label batches, PDF generation

    reminders/ templates, scheduling, delivery attempts

    help/      help requests, attempts

    disease/   reports, alerts, rules, investigations

    campaigns/ campaigns, assignments, progress

    map/       aggregates, geodata

    admin/     settings, integrations, monitoring

    audit/     audit writer/reader

  adapters/    sms/, bharat_pashudhan/, tiles/

  jobs/        queue.py, handlers, scheduler.py

  tests/

\`\`\`

Layering: \`router → service → repository\`; business rules live in services (never in routers or SQL triggers except integrity constraints).



**### 7.2 Authorisation design \*\*[OFFICIAL]\*\***

Every protected route declares a **\*\*policy\*\***: \`require(permission, scope)\` where scope is evaluated from the DB. The server resolves district/village assignments from authoritative database records; it never trusts client-supplied district or village scope:

\- \`permission\` (e.g., \`event.create\`, \`disease.confirm\`, \`campaign.configure\`, \`campaign.assign_workers\`, \`owner.phone.view\`, \`export.run\`).

\- \`scope\`: village (must be in the user’s \`user_village_assignments\`), own-animal (farmer), aggregate-only (dairy/panchayat), district (DAHO).

\- **\*\*Veterinary verification\*\*** is a separate permission (\`disease.confirm\`) granted explicitly; field workers do not receive it by default.

\- **\*\*Campaigns:\*\*** DAHO with an active district assignment creates/configures/activates district campaigns. Veterinary Officer reviews operational readiness and assigns Field Workers only within authorised villages. Field Workers view assigned campaigns and record authorised work. System Administrator manages platform access/configuration and may view campaigns for support; this does not make the Administrator the operational campaign owner.

\- Denied requests return 403 with a generic message and write an audit event (\`ACCESS_DENIED\`).



**### 7.3 Error model**

RFC 7807-style problem JSON: \`{ "type", "title", "status", "code", "detail", "errors":[{field,code}], "requestId" }\`. Codes are stable strings used by the UI to select Gujarati messages (e.g., \`FUTURE_DATE\`, \`DUPLICATE_TAG\`, \`FORBIDDEN_SCOPE\`, \`SCHEDULE_NOT_APPROVED\`, \`FILE_TYPE_INVALID\`, \`RATE_LIMITED\`).



**---**

**## 8. REST API**

Base \`/api/v1\`; JSON; UTC timestamps; pagination \`?page=&pageSize=\` (max 100); all list endpoints bounded; OpenAPI served at \`/api/v1/openapi.json\` (disabled or protected in production **\*\*[PROPOSED]\*\***).



**### 8.1 Endpoint catalogue \*\*[PROPOSED]\*\***

\| Area | Method & path | Roles (backend-enforced) | Notes |

\|---|---|---|---|

\| Auth | \`POST /auth/login\` | Staff | Username/password; rate-limited |

\| | \`POST /auth/otp/request\` · \`POST /auth/otp/verify\` | Farmer | Registered numbers only; neutral responses |

\| | \`POST /auth/refresh\` · \`POST /auth/logout\` | All | Rotating refresh; logout never touches device queue |

\| | \`GET /auth/me\` | All | Role, villages, permissions, offline grant |

\| Animals | \`POST /animals\` · \`GET /animals\` · \`GET /animals/{id}\` | FW primary; VO only via fallback permission | Duplicate check; backend FW-availability gate; paginated list |

\| | \`PATCH /animals/{id}\` | VO (FW limited) | Uses \`rowVersion\`; ownership/village change needs reason |

\| | \`GET /animals/resolve?token=\` | VO, FW | QR token → animal |

\| | \`POST /animals/{id}/merge\` | VO | Aliases keep old IDs |

\| | \`POST /animals/{id}/verify\` | VO | Identity verification |

\| Owners / Farmer records | \`POST /owners\` · \`GET /owners\` · \`PATCH /owners/{id}\` · \`PUT /owners/{id}/consent\` | FW, VO, SYS_ADMIN (permission + scope) | Creates/maintains farmer record; no public signup |
\| Farmer login | \`POST /owners/{id}/account-provisioning\` | FW, VO, SYS_ADMIN (permission + scope) | Link/activate login only after owner record exists; OTP is login-only |

\| Events | \`POST /events\` (online direct) | Authorised vaccinator / permitted recorder | Check vaccinator authorisation separately from role/camp assignment; same validation as sync |

\| | \`GET /animals/{id}/events\` | VO, FW, Farmer(own) | History incl. sync/revision info |

\| | \`POST /events/{id}/corrections\` | VO | Amend/void with reason |

\| Sync | \`POST /sync/push\` · \`GET /sync/villages/{id}/package\` · \`GET /sync/changes\` · \`GET /sync/status\` | VO, FW | See §6 |

\| Due/Reminders | \`GET /due\` (filters village/programme/status) | VO, FW, DAHO(agg) | Only with approved schedule |

\| | \`GET /reminders\` · \`POST /reminders/{id}/cancel\` | VO, Admin | Delivery attempts visible |

\| Help | \`POST /help-requests\` · \`GET /help-requests\` · \`PATCH /help-requests/{id}\` · \`POST /help-requests/{id}/attempts\` | VO, FW, Farmer(create own) | Reference number issued by server |

\| Disease | \`POST /disease-reports\` · \`GET /disease-reports\` · \`GET /disease-reports/{id}\` | Farmer (own), FW, VO (within scope), DAHO (district scope) | Preserve reporter and staff-assisted submission provenance |

\| | \`POST /disease-reports/{id}/review\` | Explicitly authorised veterinary reviewer | Record review basis; confirm / disprove / keep suspected; role alone does not grant confirmation |

\| | \`GET /alerts\` · \`PATCH /alerts/{id}\` · \`POST /alerts/{id}/investigations\` | VO, DAHO | Alerts are flags |

\| Campaigns | \`POST /campaigns\` · \`PATCH /campaigns/{id}\` | DAHO (assigned district) | Create/configure/activate district campaigns using approved programme/schedule data |

\| | \`GET /campaigns\` · \`GET /campaigns/{id}/progress\` | VO, DAHO, Admin; FW(assigned); Dairy/GP (aggregate) | |

\| | \`PUT /campaigns/{id}/assignments\` | VO (authorised villages) | Assign Field Workers; System Administrator does not replace VO operational assignment |

\| District setup | \`/districts/{id}/villages\` · \`/gram-panchayats\` · \`/cooperatives\` · \`/veterinary-officers\` · assignment routes | DAHO (assigned district); SYS_ADMIN for platform access as separately authorised | Every DAHO operation is district-scoped and audited |
\| Field Worker availability | \`POST /field-workers/{id}/availability\` · \`GET /field-workers/{id}/availability\` | Explicit authorised roles | Record effective period, reason, actor and optional evidence; no inferred timeout rule |
\| Inventory | \`/vaccine-products\` · \`/stock-lots\` · \`/stock-transactions\` | DAHO (district scope) | Append-only stock movements; validate balance transactionally; policy details pending |
\| Camps | \`POST /camps\` · \`GET /camps\` · \`POST /camps/{id}/decision\` · \`POST /camps/{id}/close\` | Cooperative/eligible actor proposes; VO confirms/reschedules/rejects; authorised roles close | Camp coordination does not confer vaccination authority |
\| Ownership transfer | \`POST /animals/{id}/transfer-requests\` · \`POST /transfers/{id}/decision\` | Farmer/authorised staff request; authorised VO decides | Preserve history; approval/rejection reason and audit required |
\| Notifications | \`GET /notifications\` · \`PATCH /notifications/{id}/read\` | Authenticated recipient | Persistent in-app notifications; independent of SMS delivery |
\| Disease attachments | \`POST /disease-reports/{id}/attachments\` · \`GET /disease-reports/{id}/attachments\` | Report owner/authorised staff within scope | Authorised file access, type/size checks, provenance and audit |
\| Import | \`POST /imports\` (upload) · \`GET /imports/{id}\` · \`PUT /imports/{id}/mapping\` · \`POST /imports/{id}/validate\` · \`POST /imports/{id}/commit\` · \`GET /imports/{id}/errors.csv\` | VO (default), FW (explicit \`import.run\` grant; per-row FW priority check) | Background jobs; resumable; per-row FW-first registration priority enforced |

\| Labels | \`POST /labels/batches\` · \`GET /labels/batches/{id}/pdf\` | VO | Only verified/registered animals |

\| Map/Dash | \`GET /map/coverage\` · \`GET /map/disease\` · \`GET /dashboard/district\` · \`GET /dashboard/village/{id}\` | VO(scope), DAHO, Dairy/GP (aggregate) | Aggregates only |

\| Exports | \`POST /exports\` · \`GET /exports/{id}\` | DAHO, VO(limited), Admin(limited) | Logged, formula-safe |

\| Admin | \`/admin/users\` · \`/admin/roles\` · \`/admin/villages\` · \`/admin/geodata\` · \`/admin/schedules\` · \`/admin/alert-rules\` · \`/admin/reminder-settings\` · \`/admin/integrations\` · \`/admin/settings\` · \`/admin/monitor/\*\` | Admin | Versioned config; audited |

\| Audit | \`GET /audit\` | Admin; DAHO (summary); VO (own) | Read-only |

\| Health | \`GET /health/live\` · \`GET /health/ready\` | Internal | Used by monitoring |



**### 8.2 Example: create vaccination (online)**

\`POST /events\`

\`\`\`json

{ "eventId": "…uuid…", "type": "VACCINATION",

  "payload": { "animalId": "…", "programmeCode": "FMD", "administeredOn": "2026-10-30", "batchNumber": "B-24-771" } }

\`\`\`

\`201 Created\` → \`{ "eventId": "…", "status": "ACCEPTED", "recordedBy": "…", "recordedAt": "…" }\`.

\`422\` → problem JSON with \`code=VALIDATION_FAILED\` and field errors; the form keeps its data.



**### 8.3 Rate limiting**

Per-IP and per-account limits on \`/auth/\*\`, \`/auth/otp/\*\` (e.g., lockout window after repeated failures); per-user limits on import/export/label endpoints. Numeric limits are configuration **\*\*[PROPOSED]\*\***.



**---**

**## 9. Security and privacy**

**### 9.1 Authentication \*\*[PROPOSED]\*\***

\| Item | Design |

\|---|---|

\| Staff passwords | Argon2id hashes; complexity/length policy; admin-created accounts, forced change on first login |

\| Access token | JWT, short-lived (≈ 15 min **\*\*[ASSUMPTION]\*\***) |

\| Refresh token | Opaque, hashed in DB, rotated on use, bound to \`deviceId\`; revoked on deactivation/logout everywhere server-side |

\| Offline grant | Signed claim with \`offlineValidUntil\` (§5.4) |

\| Farmer OTP | 6-digit code, short expiry, hashed, attempt-limited; OTP request/verify identical response timing; numbers must be linked to an existing farmer record by authorised staff; OTP authenticates an already provisioned account only and never creates an owner, farmer record, user or account link; **\*\*in demo mode the code is not sent by SMS\*\*** and is shown only in a developer log (never in production) |

\| Lockout | Temporary after repeated failures; audit |



**### 9.2 Authorisation, privacy and audit**

\- Server-side RBAC + village scope on every endpoint (§7.2); object-level checks (farmer → own animals).

\- **\*\*Data minimisation:\*\*** QR holds only an opaque token; local store holds minimal owner data; exports exclude owner identity unless authorised; logs never contain phone numbers or OTPs.

\- **\*\*Audit log\*\*** (append-only; no update/delete grants for the app role): creates, corrections, merges, imports, label reprints, verification decisions, exports, owner-phone views, config changes, logins, denied access.

\- **\*\*Retention/consent:\*\*** consent flag per owner for outreach; retention periods **\*\*[PENDING Department policy]\*\***.



**### 9.3 File and input security**

\| Risk | Control |

\|---|---|

\| Wrong/hostile uploads | Allow-list \`.xlsx\`/\`.csv\`; verify magic bytes; size limit (config); reject macros (\`.xlsm\`), encrypted or zip-bombed workbooks (decompressed size/entry-count limits) |

\| Parser exploits | Parse in the worker process with timeouts and memory limits; no formula evaluation (read values only) |

\| Formula injection | On import and on every export, cells beginning with \`= + - @\` (and tab/CR variants) are prefixed/escaped |

\| Path traversal | Stored under generated IDs, never user-supplied names |

\| XSS/CSRF | React escaping; strict CSP; tokens in memory/\`Authorization\` header (no cookie-based auth for API) or SameSite+CSRF token if cookies are used |

\| Transport | HTTPS only, HSTS; secure headers; CORS allow-list |

\| SQL injection | Parameterised queries via SQLAlchemy |

\| Secrets | Environment/Docker secrets/SOPS; **\*\*no secrets in the repository\*\*** |

\| Dependency risk | Lock files, automated vulnerability scan in CI |



**### 9.4 Threat summary \*\*[PROPOSED]\*\***

\| Threat | Mitigation |

\|---|---|

\| Stolen/lost phone | Server-side deactivation; short access tokens; offline grant expiry (7 days); minimal PII locally; optional PIN encryption (pending) |

\| Account takeover | Argon2id, lockout, rotating refresh tokens, audit |

\| Insider over-reach | Village scope, consent, audited views/exports |

\| Forged events | Authenticated device+user; server validation; idempotency; immutable history |

\| Malicious spreadsheet | §9.3 controls |

\| Data loss | Local queue persistence; backups; export-pending file |



**---**

**## 10. Background jobs and scheduling**

**### 10.1 PostgreSQL-backed queue \*\*[PROPOSED]\*\***

\`\`\`

jobs(id, type, payload jsonb, status, run_at, attempts, max_attempts, locked_by, locked_at,

     heartbeat_at, last_error, created_by, created_at, finished_at)

\`\`\`

\- Workers claim with \`SELECT … WHERE status='queued' AND run_at<=now() ORDER BY run_at FOR UPDATE SKIP LOCKED LIMIT n\`.

\- Heartbeat; jobs with stale heartbeat are re-queued (**\*\*recoverable after interruption\*\***).

\- Retries with backoff up to \`max_attempts\`; failures visible to admins.

\- Handlers are **\*\*idempotent\*\*** (e.g., import commit keyed by \`import_job_id\` + row hash).

\- **\*\*Scheduler:\*\*** a periodic enqueuer in the worker (guarded by a PostgreSQL advisory lock so only one runs) creates jobs: reminder preparation (daily, configurable), alert-rule evaluation (frequent), data-quality scan, aggregate refresh, cleanup of expired files, offline-staleness monitor.

\- **\*\*When to adopt Redis [PROPOSED trigger]:\*\*** sustained queue latency, > several hundred jobs/minute, or need for delayed/priority fan-out beyond what PostgreSQL handles. Not needed for the pilot.



**---**

**## 11. Bulk import pipeline \*\*[OFFICIAL]\*\***

\`\`\`mermaid

flowchart TD

  U[Upload xlsx/csv] --> V1[Validate type/size/signature]

  V1 -->|fail| E1[Reject + reason]

  V1 --> Q[(Quarantined file)]

  Q --> P[Worker: parse + detect columns]

  P --> M[User confirms mapping]

  M --> R[Row validation + normalisation]

  R --> D[Duplicate check: in-file + database]

  D --> PV[Preview + summary + error list]

  PV -->|user commits| C[Commit valid rows in batches]

  C --> S[Summary: created/updated/skipped/rejected]

  S --> L[Label PDF for registered/verified only]

  C -->|interrupt| RS[Resume from last committed batch]

\`\`\`

\- **\*\*Row key:\*\*** normalised 12-digit tag when present; otherwise composite (owner + village + species + identifying attributes) → ambiguous matches go to review, never auto-merged.

\- **\*\*Idempotency:\*\*** every row gets \`row_hash\`; commits use \`INSERT … ON CONFLICT\` on tag/row-hash so retries create no duplicates; counts reported per outcome.

\- **\*\*Never overwrite verified identity:\*\*** conflicts → \`NEEDS_REVIEW\` row outcome.

\- **\*\*Large files:\*\*** chunked processing (e.g., 500 rows/transaction **\*\*[ASSUMPTION]\*\***); progress persisted in \`import_jobs\`; resumable.

\- **\*\*Outputs:\*\*** downloadable error/report CSV (formula-safe), label batch request only for success/verified rows.



**---**

**## 12. QR identification and label PDFs \*\*[OFFICIAL]\*\***

\- **\*\*Payload:\*\*** \`https\://\<app-host>/q/\<token>\` where \`\<token>\` = 16 random bytes, Base32 (26 chars), unique, stored in \`animal_qr_tokens\`. No owner data, no history, no animal code in clear.

\- **\*\*Resolution:\*\*** the app extracts the token; local Dexie lookup (offline) or \`GET /animals/resolve\`. Opening the URL in a generic scanner leads to the app login; the endpoint returns nothing without authorisation.

\- **\*\*Reprint:\*\*** reuses the same token (reason required, audited). Replacing a token is an explicit audited “identifier change”; the old token is kept as \`REVOKED\` alias and still resolves with a warning.

\- **\*\*Verification ≠ readability:\*\*** \`identity_status\` (\`UNVERIFIED\`, \`VERIFIED\`, \`NEEDS_REVIEW\`) is separate from the existence of a QR.

\- **\*\*PDF generation (ReportLab):\*\*** A4 sheet, configurable grid (UI example 3×8), each cell = QR + animal code + village code; crop/cut guides; header with batch ID and generation time. Only animals with server-side \`registered/verified\` status are included; others listed in an “excluded” section of the batch record, not printed.

\- **\*\*Delivery:\*\*** generated by a job; stored with an expiry; downloaded through an authorised endpoint; each reprint audited.

\- **\*\*No printer integration\*\*** (decision): user downloads the PDF and prints on an ordinary printer.



**---**

**## 13. Reminders and SMS adapter \*\*[OFFICIAL / PENDING]\*\***

\- **\*\*Due computation:\*\*** a query/service over the **\*\*approved schedule version\*\*** (§ schema \`schedule_rules\`); if no approved version exists for the species/programme, return \`SCHEDULE_NOT_APPROVED\` and create nothing.

\- **\*\*Reminder lifecycle:\*\*** \`SCHEDULED → QUEUED → SENT → DELIVERED | FAILED\`, plus \`SIMULATED\`, \`CANCELLED_OBSOLETE\`.

\- **\*\*De-duplication:\*\*** unique \`dedupe_key = owner_id|animal_id|programme|due_date|channel\`.

\- **\*\*Obsolete reminders:\*\*** when an event correction/new event changes the due date, pending reminders are cancelled and regenerated.

\- **\*\*Adapter interface:\*\***

\`\`\`python

class SmsProvider(Protocol):

    def send(self, to: str, text: str, template_id: str | None) -> ProviderResult: ...

    def parse_delivery_report(self, payload: dict) -> DeliveryUpdate: ...

\`\`\`

Implementations: \`SimulatedSmsProvider\` (default; marks \`SIMULATED\`, never \`DELIVERED\`) and a real one **\*\*[PENDING provider, credentials, sender ID, template approval, consent basis]\*\***. \`DELIVERED\` is only written from a provider delivery report.

\- **\*\*Templates:\*\*** Gujarati templates stored as data; placeholders (owner name, species, last four tag digits, programme, due date). **\*\*Example only [DEMO]\*\*** — final wording is reviewed by a native speaker and the provider.

\- **\*\*Invalid/missing phone:\*\*** reminder not sent; animal appears on the assisted follow-up list.

\- **\*\*Core due list never depends on SMS.\*\***



**---**

**## 14. Disease alerts \*\*[OFFICIAL / PENDING]\*\***

\- **\*\*Report → alert evaluation:\*\*** a worker evaluates **\*\*configurable rules\*\*** (\`disease_alert_rules\`: disease, area level, radius/village scope, time window, minimum distinct animals/reports) after each accepted report. **\*\*Rule parameters are Department-defined; none are invented here.\*\***

\- **\*\*De-duplication first:\*\*** reports flagged as duplicates are excluded from counts; “distinct animals” preferred over raw counts.

\- **\*\*Output:\*\*** an \`alert\` row with status \`UNDER_REVIEW\` and notification to authorised officers. The system never writes \`CONFIRMED\` automatically.

\- **\*\*Confirmation:\*\*** only users with \`disease.confirm\`; basis required; reversal requires reason; all changes in status history + audit.

\- **\*\*Surveillance state for the map (per village):\*\*** \`NO_ACTIVE_ALERT\` (green only when data sufficiency rule met), \`SUSPECTED_CLUSTER\`/\`UNDER_INVESTIGATION\` (yellow), \`CONFIRMED_OR_HIGH_PRIORITY\` (red), \`INSUFFICIENT_OR_STALE\` (grey). Sufficiency/staleness windows are configuration **\*\*[PENDING]\*\***.



**---**

**## 15. Map data and geospatial decisions**

\| Question | Decision |

\|---|---|

\| PostGIS? | Use **\*\*only if\*\*** needed for polygons/containment/clustering queries; start with \`lat/lon\` (+ optional \`geom\`) and add PostGIS when boundary data is actually obtained and used **\*\*[PROPOSED]\*\*** |

\| Source of coordinates | Verified public/authorised datasets **\*\*[PENDING verification]\*\***; administrators can import/correct (\`geodata_imports\` with source, version, verified flag) |

\| Missing data | \`coord_status = UNAVAILABLE\`; shown in “location unavailable” list; never invented |

\| Aggregation | \`village_coverage\` and \`village_surveillance\` computed by SQL/materialised views refreshed by the worker; UI receives village-level aggregates, not animal rows |

\| Layers | Strictly separate endpoints/legends; thresholds read from configuration |

\| Freshness | Each aggregate carries \`asOf\`; stale if older than configured window |

\| Fallback | If map tiles/service fail, show the village table |



**---**

**## 16. Government integration boundary \*\*[PENDING]\*\***

\`\`\`python

class AnimalRegistryAdapter(Protocol):

    def lookup_by_tag(self, tag12: str) -> RegistryAnimal | None: ...

    def push_event(self, event: ExportEvent) -> PushResult: ...   # only if authorised

\`\`\`

\- \`DisabledRegistryAdapter\` (default): returns “not configured”; UI shows **\*\*Pending departmental approval and authorized API access\*\***.

\- \`DemoRegistryAdapter\`: synthetic/authorised sample data in a **\*\*separate demo environment\*\***, clearly labelled.

\- A real adapter is built only after the Department confirms: official identifiers, available APIs/sandbox, read/write permissions, **\*\*source of truth\*\***, synchronisation rules, duplicate prevention, privacy/authorisation requirements.

\- **\*\*Prohibited:\*\*** scraping, unauthorised credentials, claiming a working integration.



**---**

**## 17. Deployment, configuration and operations**

**### 17.1 Environments \*\*[PROPOSED]\*\***

\| Env | Purpose | Data |

\|---|---|---|

\| dev | Developer machines (Docker Compose) | Synthetic |

\| demo | Low-cost public/internal demo | Synthetic or authorised sample data only |

\| staging | Pre-pilot testing | Synthetic/authorised |

\| prod | Pilot | Real data only after Department authorisation |



**### 17.2 Topology**

Single server (generic cloud VM or government/NIC-style VPS if provided — **\*\*not assumed available\*\***): \`caddy/nginx\` → \`api\` (uvicorn/gunicorn, 2–4 workers) + \`worker\` + \`postgres\` (+ backup job). Frontend is static files served by the proxy. No vendor-specific managed services required.

\`\`\`mermaid

flowchart LR

  Internet --> Proxy[Caddy/nginx TLS]

  Proxy --> Static[Static PWA files]

  Proxy --> API[API container]

  API --> PG[(PostgreSQL)]

  Worker[Worker container] --> PG

  Backup[Backup job] --> PG

  Backup --> Store[(Off-server backup storage)]

\`\`\`

**### 17.3 Configuration (environment-based) \*\*[PROPOSED]\*\***

\| Variable | Purpose |

\|---|---|

\| \`APP_ENV\` | dev/demo/staging/prod |

\| \`DATABASE_URL\` | PostgreSQL connection (secret) |

\| \`JWT_SECRET\` / key files | Token signing (secret) |

\| \`ACCESS_TOKEN_MINUTES\`, \`OFFLINE_PERIOD_DAYS\` (default 7) | Auth timing |

\| \`ALLOWED_ORIGINS\`, \`PUBLIC_BASE_URL\` | CORS, QR URL base |

\| \`SMS_PROVIDER\` (\`simulated\` default), \`SMS\_\*\` | Provider settings (secrets) |

\| \`REGISTRY_ADAPTER\` (\`disabled\` default) | Government adapter mode |

\| \`UPLOAD_MAX_MB\`, \`IMPORT_BATCH_SIZE\` | Import limits |

\| \`FILE_STORAGE_PATH\` | Upload/PDF storage |

\| \`LOG_LEVEL\`, \`SENTRY_DSN\` (optional) | Observability |

Secrets via environment files with restricted permissions, Docker secrets, or SOPS/age-encrypted files; rotated on a schedule; never committed.



**### 17.4 Backups and recovery \*\*[OFFICIAL / PROPOSED]\*\***

Nightly logical backups (\`pg_dump\`) plus periodic base backups; WAL archiving optional for point-in-time recovery; copies stored **\*\*off the server\*\***; encryption of backup files; restore drill before pilot and periodically; documented RPO/RTO **\*\*[PENDING Department targets]\*\***; retention per Department policy **\*\*[PENDING]\*\***.



**### 17.5 Monitoring and operations**

Liveness/readiness endpoints; structured JSON logs with request IDs; metrics (request latency, error rate, queue depth, job failures, sync rejection rate, DB size); alerts to administrators for failed backups, stuck jobs, high sync failure, low disk; admin monitor screens (UI/UX S1/S5). Optional: Prometheus + Grafana, Loki — added only if operations need them.



**### 17.6 CI/CD**

Git-based CI: lint, type-check, unit/integration tests (PostgreSQL via Testcontainers), frontend tests with fake-indexeddb, Playwright smoke test, dependency scan, container build; deploy via tagged releases and \`docker compose pull && up -d\`; database migrations with Alembic run as a separate step before app start; rollback = previous image + tested backup.



**### 17.7 Cost and sizing \*\*[ASSUMPTION — no prices stated]\*\***

Free/open-source software throughout. Paid or externally supplied items to identify early: server/VPS (a small 2–4 vCPU, 4–8 GB RAM class is a reasonable *\*starting estimate\** for the pilot, to be load-tested), domain and TLS (TLS certificates can be free), off-server backup storage, SMS provider charges and sender registration, optional basemap tile hosting, optional monitoring. Production hosting is **\*\*not\*\*** promised to be permanently free; the demo set-up should run on a single low-cost VM.



**---**

**## 18. Performance design \*\*[ASSUMPTION targets, to be measured]\*\***

\| Target | Technique |

\|---|---|

\| QR scan → profile < 1 s (offline) | Dexie index on \`qrToken\`; no network |

\| Local search < 300 ms over ≈ 3,000–5,000 cached animals | Normalised search fields indexed; debounce |

\| Offline save < 300 ms | Single Dexie transaction |

\| Dashboard first content < 3 s on slow 4G | Aggregates precomputed; small payloads; compression |

\| Map < 2 s for 10 villages | Aggregated endpoint; clustering only for markers; lazy map load |

\| Sync of ≈ 100 events | Batches of 50; per-record acks; progress shown |

\| DB | Indexes per schema; pagination; partial indexes for pending/overdue; \`EXPLAIN\` checks in tests |

Targets are validated with pilot-scale synthetic data (≈ 20,000 animals); no measured result is claimed.



**---**

**## 19. Testability requirements**

Controllable clock (for 7-day offline rule, reminders), injectable adapters (simulated SMS/registry), deterministic ID generation in tests, network-fault injection in the sync controller, seeded synthetic data generator. Test plan: IMPLEMENTATION_PLAN.md.



**---**

**## 20. Decision log (ADRs)**

\| ID | Decision | Status |

\|---|---|---|

\| ADR-01 | Modular monolith + worker on one DB | Proposed |

\| ADR-02 | React + Vite PWA; Dexie; no SSR | Approved stack |

\| ADR-03 | FastAPI + PostgreSQL; SQLAlchemy/Alembic | Approved stack |

\| ADR-04 | PostgreSQL-backed jobs first; Redis only on proven need | Approved approach |

\| ADR-05 | PostGIS only when polygons/spatial queries justify it | Approved approach |

\| ADR-06 | Foreground sync controller; Background Sync optional | Proposed (from master prompt) |

\| ADR-07 | Client-generated event IDs as idempotency keys | Proposed |

\| ADR-08 | Logout never deletes pending records; owner-tagged queue | **\*\*Approved (v0.2.1)\*\*** |

\| ADR-09 | 7-day offline grant, configurable; online re-auth required after | **\*\*Approved\*\*** |

\| ADR-10 | QR = opaque token URL | Proposed |

\| ADR-11 | Label PDF with ReportLab; no printer integration | Approved (PDF) |

\| ADR-12 | Campaign create/configure = Admin; assign/monitor = VO; perform = FW | **\*\*Approved (v0.2.1)\*\*** |

\| ADR-13 | Local encryption (PIN) vs minimisation | **\*\*Pending decision\*\*** |

\| ADR-14 | Basemap source | **\*\*Pending decision\*\*** |

\| ADR-15 | SMS provider | **\*\*Pending approval\*\*** |

\| ADR-16 | Bharat Pashudhan adapter | **\*\*Pending approval\*\*** |



**---**

**## 21. Known limitations and open technical questions**

1\. Offline security cannot be fully enforced on a device the user controls; limits are documented (clock tampering, IndexedDB at rest).

2\. Browser storage may be evicted or cleared; unsynced data could be lost — mitigations listed in §5.3.

3\. Scanning quality varies by device; manual search is mandatory.

4\. Basemap, SMS provider, schedules, thresholds, retention, hosting and integration remain **\*\*pending\*\***.

5\. Performance numbers are targets, not results.

---

## 22. Targeted alignment corrections — v0.2

This revision preserves the original TRD structure, architecture, stack choices, technical rationale and existing sections. It changes only the technical details required to align with PRD v0.2, APPFLOW v0.4 and BACKENDDATABASESCHEMA v0.4. The PRD remains the requirements baseline; APPFLOW governs workflow authority; the schema describes proposed data structures.

### 22.1 Authoritative workflow rules for implementation

1. **Farmer record and login are separate.** No public farmer signup/self-registration. An authorised Field Worker, Veterinary Officer or System Administrator may create a farmer record within applicable scope. Staff may separately provision/link/activate a login only after that record exists. OTP is login-only and cannot create a farmer, user or link.
2. **Animal registration is Field Worker-first.** The assigned Field Worker is the primary registrar. A Veterinary Officer may register only through the fallback permission when an explicit authorised unavailability record exists, with reason and record reference. If the Field Worker is available, block fallback. Unknown, missing or ambiguous availability goes to an exception/review path; do not invent a timeout or attendance rule. System Administrator, DAHO and farmer do not receive animal-registration permission by default.
3. **DAHO owns district operations.** DAHO may manage villages/geodata, Gram Panchayats, dairy cooperatives, Veterinary Officer profiles/authorised village assignments, vaccine stock and vaccination campaigns within the DAHO's assigned district. The server derives that district assignment from the database and audits cross-district denials. DAHO cannot create another DAHO or System Administrator unless separately approved.
4. **Campaign authority.** DAHO creates/configures/activates campaigns using Department-approved programme and schedule information. Veterinary Officers assign Field Workers within authorised villages. Field Workers view assignments and perform authorised work. System Administrator manages platform access and technical configuration, not operational campaign ownership.
5. **Camps are coordination, not vaccination authority.** A cooperative may propose/coordinate a camp. Veterinary Officer confirms, reschedules or rejects it. Only an independently authorised vaccinator may administer and record vaccination. Camp assignment alone is not vaccinator authorisation.
6. **Disease status.** Reports remain suspected until authorised veterinary review. The system may generate review flags/alerts but must never automatically confirm a disease or outbreak. Preserve reporter, submission actor, attachments, review basis and status history.
7. **Stock.** DAHO manages district stock records. Stock movements are append-only and balance changes are transactional. Exact issue/transfer/adjustment authority, units, expired-stock handling and camp stock sufficiency remain pending Department policy; do not invent clinical or cold-chain rules.
8. **Ownership transfer and notifications.** Transfers require a recorded request and authorised decision, preserving history. In-app notifications are persistent and must work independently of SMS provider availability.
9. **Offline boundaries.** Offline work is limited to downloaded, role-authorised field actions. Campaign configuration/assignment, camp decisions, stock movements, transfer decisions, account administration and disease confirmation are online-only. Server revalidates permissions and business rules at sync. Pending device records are never deleted because of logout, grant expiry or account deactivation.
10. **Integrations and clinical rules.** Bharat Pashudhan remains disabled pending Department approval and authorised API access. SMS remains simulated until approved credentials/provider are available. No schedules, doses, disease thresholds, official identifiers or permissions are inferred without an approved source.

### 22.2 Permission vocabulary and implementation consistency

The API, service layer, role-permission seed data, audit events and tests must use one canonical permission vocabulary from the approved schema/PRD baseline. Do not mix legacy aliases (for example `animal.create` / `animal.create.fallback`) with the APPFLOW names (`animal.register` / `animal.register.fallback`) in new code. The final permission grants remain subject to Department approval. In particular, `disease.confirm` or equivalent confirmation authority must be granted explicitly to qualified/authorised users; a role label alone is insufficient.

### 22.3 Required cross-layer tests

- Farmer cannot self-register; OTP cannot create a farmer record, user or account link.
- Staff cannot provision a farmer login before the farmer record exists; duplicate account links are rejected and audited.
- FW can register within assigned scope; VO fallback succeeds only with an explicit current unavailability record and fails when FW is available or status is unknown.
- Same FW/VO registration gate applies to online API, offline sync, imports and retries.
- DAHO can manage only the assigned district; changing a client-supplied district ID cannot expand scope.
- DAHO can create/configure campaigns; VO can assign workers only in authorised villages; SYS_ADMIN is not the operational campaign creator/assigner.
- Cooperative camp proposal does not grant permission to confirm a camp or vaccinate; VO decision and vaccinator authorisation are checked separately.
- Stock transactions cannot produce negative balance; transaction history is immutable and corrections use compensating movements.
- Disease alerts never auto-confirm; only explicitly authorised reviewer can confirm/disprove with basis and audit.
- Transfer decisions preserve prior ownership and require authorised actor/reason.
- In-app notifications remain available when SMS is disabled or fails.
- Deactivated-user pending records remain on device; held records are quarantined and reviewed before domain acceptance.

### 22.4 Change log

- Updated version/baseline metadata to v0.2 and PRD v0.2 / APPFLOW v0.4 / schema v0.4.
- Corrected campaign ownership and worker assignment authority.
- Clarified farmer record creation versus login provisioning and OTP-only login.
- Added FW-first animal registration and explicit VO fallback enforcement.
- Added DAHO district scope and missing operational API coverage.
- Added camp, stock, availability, ownership transfer, disease attachment/review and notification technical requirements.
- Defined online-only administrative/approval actions and safer held-for-review recovery.
- Preserved the original stack, architecture, sections and assumptions wherever they did not conflict with the PRD.

**Status:** TRD v0.2 is a targeted document-alignment update, not evidence of implementation, security certification, load testing, or PostgreSQL execution. Schema DDL and service behaviour still require implementation and testing.
