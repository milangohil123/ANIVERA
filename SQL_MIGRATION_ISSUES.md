# PashuRakshak Botad — SQL Migration Issues Register
**Project:** PS000195 · **Date:** 31 October 2026 · **Target Engine:** PostgreSQL 16.15  
**Scope:** Issues, Warnings, and Omissions Identified During Static SQL Review & Resolutions in v0.3.1 Patch

---

## 1. Summary of Issues & Resolution Status

| Issue ID | File & Section | Severity | Description | Execution Blocker? | Resolution Status |
|---|---|:---:|---|:---:|:---:|
| **ISSUE-SQL-01** | `pashurakshak_schema_v0.3_patch.sql` §5 | 🟡 **Medium** | Missing append-only trigger on `vaccine_stock_transactions` | **No** | ✅ **RESOLVED IN v0.3.1**<br>Added `trg_stock_txn_immutable` and `reject_stock_transaction_mutation()`. |
| **ISSUE-SQL-02** | `pashurakshak_schema_v0.2.sql` line 1276 | 🟡 **Medium** | `VET_OFFICER` role retains primary `animal.create` grant | **No** | ✅ **RESOLVED IN v0.3.1**<br>Revoked `animal.create` from `VET_OFFICER` in patch §8; VO retains `animal.create.fallback`. |
| **ISSUE-SQL-03** | `pashurakshak_schema_v0.3_patch.sql` §8 | 🟡 **Medium** | `DAHO` role seed is missing `cooperative.manage` grant | **No** | ✅ **RESOLVED IN v0.3.1**<br>Added `cooperative.manage` permission and granted it to `DAHO`. |
| **ISSUE-SQL-04** | `pashurakshak_schema_v0.2.sql` Lines 1–1318 | 🟢 **Low** | Base schema lacks outer `BEGIN; ... COMMIT;` transaction block | **No** | ℹ️ **DOCUMENTED IN RUNBOOK**<br>Explicit `BEGIN; ... COMMIT;` wrappers instructed for pgAdmin 4 execution. |
| **ISSUE-SQL-05** | `pashurakshak_schema_v0.3_patch.sql` §1 | 🟢 **Low** | Missing index on `district_id` in `talukas` and `villages` | **No** | ✅ **RESOLVED IN v0.3.1**<br>Added `ix_talukas_district_id` and `ix_villages_district_id`. |

---

## 2. Detailed Technical Breakdown & Resolutions

### ISSUE-SQL-01: Missing Append-Only Trigger on `vaccine_stock_transactions`
- **Exact File & Line:** `pashurakshak_schema_v0.3_patch.sql` after Line 241; resolved in `pashurakshak_schema_v0.3.1_patch.sql` lines 243–253.
- **Root Cause:** In `BACKENDDATABASESCHEMA.md` §4.7 (Lines 748–751), stock transaction rows are defined as strictly append-only:
  ```sql
  CREATE OR REPLACE FUNCTION reject_stock_transaction_mutation() RETURNS trigger AS $$
  BEGIN RAISE EXCEPTION 'stock transactions are append-only; use a compensating movement'; END; $$ LANGUAGE plpgsql;
  CREATE TRIGGER trg_stock_txn_immutable BEFORE UPDATE OR DELETE ON vaccine_stock_transactions
    FOR EACH ROW EXECUTE FUNCTION reject_stock_transaction_mutation();
  ```
- **Impact:** Without this trigger, application bugs or updates could alter historical stock transaction quantities or delete movements without audit trails.
- **Resolution Applied in v0.3.1:**
  ```sql
  CREATE OR REPLACE FUNCTION reject_stock_transaction_mutation() RETURNS trigger AS $$
  BEGIN
    RAISE EXCEPTION 'Stock transactions are append-only; use a compensating movement' USING ERRCODE = '23514';
  END; $$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS trg_stock_txn_immutable ON vaccine_stock_transactions;
  CREATE TRIGGER trg_stock_txn_immutable
  BEFORE UPDATE OR DELETE ON vaccine_stock_transactions
  FOR EACH ROW EXECUTE FUNCTION reject_stock_transaction_mutation();
  ```

---

### ISSUE-SQL-02: `VET_OFFICER` Role Retains Primary `animal.create` in Seed
- **Exact File & Line:** `pashurakshak_schema_v0.2.sql` line 1276; resolved in `pashurakshak_schema_v0.3.1_patch.sql` lines 342–344.
- **Root Cause:** In base schema line 1276:
  ```sql
  ('VET_OFFICER','animal.read'),('VET_OFFICER','animal.create'),('VET_OFFICER','animal.verify')...
  ```
  The v0.3 patch added `('VET_OFFICER', 'animal.create.fallback')`, but did not revoke `animal.create` from `VET_OFFICER`.
- **Authoritative Invariant:** Under `APPFLOW.md` Rule 3 & 4 and `DECISION_REGISTER.md` DEC-007 / DEC-008, Field Worker is the primary animal registrar, and VO is fallback-only. If VO possesses both `animal.create` and `animal.create.fallback`, backend route authorization checking `require('animal.create')` would allow a VO to bypass the Field Worker availability gate.
- **Resolution Applied in v0.3.1:**
  ```sql
  -- ISSUE-SQL-02: Revoke primary animal.create from VET_OFFICER (VO animal registration is fallback-only)
  -- Field Worker retains primary animal.create.
  DELETE FROM role_permissions 
  WHERE role = 'VET_OFFICER' AND permission_code = 'animal.create';
  ```

---

### ISSUE-SQL-03: `DAHO` Missing `cooperative.manage` Grant in Patch
- **Exact File & Line:** `pashurakshak_schema_v0.3_patch.sql` lines 308–334; resolved in `pashurakshak_schema_v0.3.1_patch.sql` lines 320 and 335.
- **Root Cause:** The v0.3 patch omitted `cooperative.manage` from the canonical permissions list and from DAHO's role seeds.
- **Authoritative Requirement:** `STAKEHOLDER_PERMISSION_MATRIX.md` line 25 & 48, `APPFLOW.md` Workflow A step 4, and `DECISION_REGISTER.md` DEC-005 explicitly authorise DAHO to manage dairy cooperatives and village mappings in the assigned district.
- **Resolution Applied in v0.3.1:**
  1. Added `('cooperative.manage', 'Create and maintain dairy cooperative directory and village mappings')` to `permissions` table insert.
  2. Added `('DAHO', 'cooperative.manage')` to `role_permissions` table insert.

---

### ISSUE-SQL-04: Base Schema Lacks Transaction Block
- **Exact File & Line:** `pashurakshak_schema_v0.2.sql` line 1 and line 1318.
- **Root Cause:** The base schema does not wrap execution in `BEGIN; ... COMMIT;`.
- **Status & Guidance:** The base schema file is maintained without modification to protect baseline integrity. In `SQL_EXECUTION_ORDER.md`, step-by-step instructions direct the DBA to prepend `BEGIN;` and append `COMMIT;` when executing in pgAdmin 4 Query Tool.

---

### ISSUE-SQL-05: Unindexed Foreign Key on `talukas.district_id` and `villages.district_id`
- **Exact File & Line:** `pashurakshak_schema_v0.3_patch.sql` lines 34–54; resolved in `pashurakshak_schema_v0.3.1_patch.sql` lines 56–58.
- **Root Cause:** Foreign key columns added via `ALTER TABLE` do not create indexes automatically in PostgreSQL.
- **Resolution Applied in v0.3.1:**
  ```sql
  CREATE INDEX IF NOT EXISTS ix_talukas_district_id ON talukas(district_id);
  CREATE INDEX IF NOT EXISTS ix_villages_district_id ON villages(district_id);
  ```
