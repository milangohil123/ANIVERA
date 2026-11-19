# DB_VALIDATION_REPORT — PostgreSQL schema validation

**Date:** 31 October 2026 · **Subject:** `BACKENDDATABASESCHEMA.md` v0.4 (DDL §4, seed §5, SQL examples §7) · **Reference workflow:** `APPFLOW_v0.4_DAHO_farmer_login_updated.md`

## 1. Validation scope and result

This report covers the corrected v0.4 schema draft. It separates checks performed on the current document from the earlier v0.2 execution results. **The v0.4 DDL has not been executed against PostgreSQL in this work environment.** No claim of 77/77 live checks is made for v0.4.

**Current result:** APPFLOW alignment and static document checks completed; PostgreSQL 16 execution and behavioural tests remain pending.

## 2. APPFLOW v0.4 mismatches corrected

| APPFLOW requirement / vocabulary | v0.4 schema correction | Status |
|---|---|---|
| `farmers` | Added compatibility view over the existing `owners` master table; no destructive rename | Added |
| `farmer_verifications` | Added verification lifecycle table with verifier, time, method and decision reason | Added |
| `farmer_user_links` | Added compatibility view over `owner_user_links` | Added |
| `animal_external_identifiers` | Added external identifier table; Bharat Pashudhan identifier is optional and validated as 12 digits | Added |
| `animal_verifications` | Added verification lifecycle table | Added |
| `camp_staff` | Added camp-to-staff assignment table; assignment does not grant vaccinator authority | Added |
| Vaccinator authorization | Added `vaccinator_authorizations`; vaccination details now require administered-by user and record authorization reference, STRICT/FLAG result and optional camp link | Added |
| `disease_report_attachments` | Added attachment metadata, storage key, checksum and scan status | Added |
| `disease_reviews` | Added separate disease review decision history and required decision basis/reason | Added |
| `ownership_transfers` | Added request/decision/completion lifecycle and one-open-transfer-per-animal constraint | Added |
| `cooperative_staff_assignments` | Added compatibility view over `dairy_cooperative_staff` | Added |
| `veterinary_officers` | Added compatibility view over `veterinary_officer_profiles` | Added |
| `vaccine_stock` | Added compatibility view over vaccine stock lots | Added |
| Animal permissions | Added exact APPFLOW codes `animal.register` and `animal.register.fallback`; FW receives primary, VO receives fallback; legacy aliases retained | Added |
| Camp permissions | Added `camp.propose` and `camp.manage`; cooperative staff propose, VO manages operational decision | Added |
| Disease permissions | Added `disease.review`; `disease.confirm` remains non-default and requires explicit grant to an authorised veterinary user | Added |
| Transfer permissions | Added `animal.transfer.request` and `animal.transfer.decide` | Added |

## 3. Technical corrections included

1. **Coverage row multiplication:** `v_village_coverage` now joins a per-animal aggregate of event receipt timestamps rather than joining every event row directly. Multiple events for one animal therefore do not multiply campaign target counts.
2. **Surveillance duplicate handling:** suspected, confirmed and incomplete counts exclude reports marked as duplicates.
3. **Animal DDL syntax:** removed the trailing comma before the closing parenthesis in the `animals` table definition.
4. **Farmer identity model:** kept `owners` as the physical master table to preserve the existing schema architecture; exposed APPFLOW's `farmers` terminology through a compatibility view and added separate verification records.
5. **External animal identifiers:** separated external registry identifiers from internal animal UUID/code and QR token. The external identifier table is canonical for new service code; the legacy `animals.tag12` column remains non-unique for backward compatibility and should not be independently dual-written. Active uniqueness is enforced by a partial unique index, allowing reuse after an identifier is replaced.
6. **Camp staffing:** staff assignment is represented separately from camp proposal/decision and does not confer authority to administer vaccination.
7. **Disease workflow:** report attachments and veterinary review decisions are represented separately from investigation actions and report status history.
8. **Vaccinator authorization:** added `vaccinator_authorizations`; vaccination details now require `administered_by` and record authorization reference, STRICT/FLAG mode/result and optional `camp_id`.
9. **Ownership transfer:** transfer request/decision records are separated from ownership history; the service must complete the transfer and append history atomically.

## 4. Static checks performed on v0.4

| Check | Result |
|---|---|
| All newly required APPFLOW table declarations present | PASS |
| APPFLOW compatibility views present | PASS |
| Exact APPFLOW permission codes present | PASS |
| FW primary and VO fallback grants separated | PASS (static seed review) |
| `disease.confirm` not granted by default | PASS (static seed review) |
| DAHO district assignment structure present | PASS |
| Camp lifecycle and camp staff assignment structures present | PASS |
| `excl_camp_overlap` exclusion constraint declared (runtime not tested) | PASS (static declaration check) |
| Vaccinator authorization and vaccination `administered_by` / `camp_id` fields present | PASS (static declaration check) |
| Disease attachment and review structures present | PASS |
| Ownership transfer structure present | PASS |
| Coverage freshness aggregation is one row per animal | PASS (static SQL review) |
| Duplicate disease reports excluded from all surveillance status counts | PASS (static SQL review) |
| Duplicate table declarations | None detected |
| Markdown code fences balanced | PASS |
| Newly added FK targets declared earlier in DDL | PASS (static order review) |

**Important:** static checks are document/code inspection. They do not prove that PostgreSQL accepts every statement or that triggers and constraints behave correctly at runtime.

## 5. Earlier v0.2 execution result — retained with scope limitation

The earlier report recorded **77/77 behavioural checks passed** on an embedded scratch PostgreSQL server for `BACKENDDATABASESCHEMA.md` v0.2. Its stated limitations included:

- PostgreSQL version was not established as 16.x.
- `citext` was substituted with `text` for that test.
- The `btree_gist` camp overlap exclusion constraint was skipped.
- RLS, generic transition guard, performance, backup/restore, API, application services and concurrency were not tested.

That 77/77 result belongs to v0.2 only. It must not be represented as a test result for v0.4 because the DDL, permissions and workflow structures have changed.

## 6. PostgreSQL 16 execution procedure still required

1. Install PostgreSQL 16 and pgAdmin 4; create database `pashurakshak_db`.
2. In the target database, install required extensions as an appropriately privileged database administrator:
   ```sql
   CREATE EXTENSION IF NOT EXISTS citext;
   CREATE EXTENSION IF NOT EXISTS btree_gist;
   ```
3. Execute the complete DDL section §4 in order, including the new §4.14A additions, then execute seed section §5.
4. Confirm all expected objects exist:
   ```sql
   SELECT count(*) FROM information_schema.tables
   WHERE table_schema='public' AND table_type='BASE TABLE';

   SELECT table_name FROM information_schema.views
   WHERE table_schema='public' ORDER BY table_name;

   SELECT code FROM permissions ORDER BY code;
   SELECT role, permission_code FROM role_permissions ORDER BY role, permission_code;
   ```
   Counts from v0.2 (73 tables, 2 materialized views, 43 permissions, 71 role mappings) are **not expected to remain the same** after v0.4 additions. Do not use those old counts as v0.4 pass criteria.
5. Run all prior v0.2 behavioural checks against v0.4 after adapting expected object names and permissions. Add tests that a vaccination row requires `administered_by`, and that STRICT rejects a non-approved/out-of-date vaccinator while FLAG records a flagged result.
6. Add new tests for farmer verification, farmer login provisioning, animal verification, external identifier replacement/reuse, camp staffing, disease attachments/review decisions, ownership transfer lifecycle, and compatibility views.
7. Test role permissions and district/village isolation for every DAHO write operation. Test FW-first registration and VO fallback both when the FW is available and when an explicit authorized UNAVAILABLE record exists.
8. Test `excl_camp_overlap` after installing `btree_gist`: same-village overlapping confirmed/rescheduled intervals must fail; different-village intervals and adjacent half-open intervals must succeed. Verify the constraint exists in the target database.
9. Test stock movements under concurrent transactions, including insufficient stock, transfer pairing and rollback behaviour.
10. Run Alembic upgrade/downgrade and API/service integration tests after the backend is implemented.

## 7. Remaining limitations / decisions

- **Live PostgreSQL 16 execution:** pending; no PostgreSQL server, `psql`, `pgserver` package or PostgreSQL driver was available in this work environment.
- **Camp overlap enforcement:** `excl_camp_overlap` is declared in §4.7A and requires `btree_gist`; its runtime behaviour remains untested until PostgreSQL 16 execution.
- **Application authorization:** service-level enforcement is still required for farmer provisioning, FW availability declarations, VO fallback, DAHO district scope, camp management, disease review/confirmation and ownership transfer.
- **RLS:** proposed defence-in-depth; must be tested with the actual application database role and session context. Table-level RLS alone is not a substitute for API authorization.
- **External identifier compatibility:** legacy `animals.tag12` remains in the schema for compatibility. New service code should use `animal_external_identifiers` as the canonical source and avoid inconsistent dual writes; a later migration may retire `tag12` after compatibility is no longer needed.
- **Compatibility views:** read and write behaviour must be tested with SQLAlchemy; service/repository code may write to the base tables directly.
- **Department decisions:** FW unavailability declaration authority/duration, GP-village cardinality, stock location and paired transfer policy, and retention/backup policy remain pending. No values have been invented.
- **Performance, backup/restore, production hosting and government API integration:** not tested or approved.

## 8. Final assessment

**APPFLOW alignment:** materially improved; the named missing structures and permission vocabulary from the prior review have been added while retaining the existing schema architecture.

**Static review:** completed for the checks listed in §4.

**PostgreSQL 16 validation:** pending. The schema must not be described as fully database-tested or production-approved until the execution procedure and new behavioural tests pass on the target PostgreSQL 16 environment.
