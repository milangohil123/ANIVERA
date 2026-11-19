-- ============================================================================
-- PashuRakshak Botad — Database Patch v0.3.1 (Additive & Alignment Patch)
-- Project: PS000195
-- Date: 31 October 2026
-- Target Database: pashurakshak_db (PostgreSQL 16.x)
-- Authoritative Design: BACKENDDATABASESCHEMA.md v0.4 & APPFLOW.md v0.4
--
-- STATUS: REVISED DDL SPECIFICATION.
-- Resolves:
--   - ISSUE-SQL-01: Stock transaction immutability trigger
--   - ISSUE-SQL-02: VO animal.create revocation (retaining animal.create.fallback)
--   - ISSUE-SQL-03: DAHO cooperative.manage permission seed
--   - ISSUE-SQL-05: Missing district_id indexes on talukas and villages
--
-- WARNING: Do not execute in production without a verified PostgreSQL 16 run.
-- This patch is additive and must be applied AFTER pashurakshak_schema_v0.2.sql.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. GEOGRAPHY & DISTRICT STRUCTURES
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS districts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,
  name_gu     text NOT NULL,
  name_en     text NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Seed default pilot district (Botad)
INSERT INTO districts (code, name_gu, name_en)
VALUES ('BOTAD', 'બોટાદ', 'Botad')
ON CONFLICT (code) DO NOTHING;

-- Add district_id to talukas and villages if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='talukas' AND column_name='district_id'
  ) THEN
    ALTER TABLE talukas ADD COLUMN district_id uuid REFERENCES districts(id);
    -- Link existing talukas to Botad district default
    UPDATE talukas SET district_id = (SELECT id FROM districts WHERE code = 'BOTAD') WHERE district_id IS NULL;
    ALTER TABLE talukas ALTER COLUMN district_id SET NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='villages' AND column_name='district_id'
  ) THEN
    ALTER TABLE villages ADD COLUMN district_id uuid REFERENCES districts(id);
    UPDATE villages SET district_id = (SELECT id FROM districts WHERE code = 'BOTAD') WHERE district_id IS NULL;
    ALTER TABLE villages ALTER COLUMN district_id SET NOT NULL;
  END IF;
END $$;

-- Indexes on foreign keys for district queries (ISSUE-SQL-05 Resolution)
CREATE INDEX IF NOT EXISTS ix_talukas_district_id ON talukas(district_id);
CREATE INDEX IF NOT EXISTS ix_villages_district_id ON villages(district_id);

-- ----------------------------------------------------------------------------
-- 2. DISTRICT OPERATIONAL ADMINISTRATION & ASSIGNMENTS
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS daho_district_assignments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daho_user_id   uuid NOT NULL REFERENCES users(id),
  district_id    uuid NOT NULL REFERENCES districts(id),
  assigned_by    uuid NOT NULL REFERENCES users(id),
  assigned_at    timestamptz NOT NULL DEFAULT now(),
  ended_at       timestamptz,
  CHECK (daho_user_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_daho_district_active
  ON daho_district_assignments(daho_user_id, district_id) WHERE ended_at IS NULL;

CREATE TABLE IF NOT EXISTS veterinary_officer_profiles (
  user_id          uuid PRIMARY KEY REFERENCES users(id),
  employee_ref     text UNIQUE,
  designation      text,
  office_name      text,
  contact_mobile   text CHECK (contact_mobile IS NULL OR contact_mobile ~ '^\+[1-9][0-9]{7,14}$'),
  created_by       uuid NOT NULL REFERENCES users(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gram_panchayats (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text NOT NULL UNIQUE,
  name_gu      text NOT NULL,
  name_en      text NOT NULL,
  taluka_id    uuid NOT NULL REFERENCES talukas(id),
  active       boolean NOT NULL DEFAULT true,
  created_by   uuid NOT NULL REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gram_panchayat_villages (
  gram_panchayat_id uuid NOT NULL REFERENCES gram_panchayats(id),
  village_id        uuid NOT NULL REFERENCES villages(id),
  mapped_by         uuid NOT NULL REFERENCES users(id),
  mapped_at         timestamptz NOT NULL DEFAULT now(),
  ended_at          timestamptz,
  PRIMARY KEY (gram_panchayat_id, village_id, mapped_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_gp_village_active
  ON gram_panchayat_villages(village_id) WHERE ended_at IS NULL;

CREATE TABLE IF NOT EXISTS gram_panchayat_staff_assignments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gram_panchayat_id uuid NOT NULL REFERENCES gram_panchayats(id),
  user_id           uuid NOT NULL REFERENCES users(id),
  assigned_by       uuid NOT NULL REFERENCES users(id),
  assigned_at       timestamptz NOT NULL DEFAULT now(),
  ended_at          timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_gp_staff_active 
  ON gram_panchayat_staff_assignments(gram_panchayat_id, user_id) WHERE ended_at IS NULL;

-- ----------------------------------------------------------------------------
-- 3. FIELD WORKER AVAILABILITY & FALLBACK AUDIT
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS field_worker_availability_records (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_worker_user_id  uuid NOT NULL REFERENCES users(id),
  village_id            uuid NOT NULL REFERENCES villages(id),
  availability_status   text NOT NULL CHECK (availability_status IN ('AVAILABLE','UNAVAILABLE')),
  reason                text NOT NULL CHECK (length(btrim(reason)) > 0),
  valid_from            timestamptz NOT NULL DEFAULT now(),
  valid_until           timestamptz,
  recorded_by           uuid NOT NULL REFERENCES users(id),
  recorded_at           timestamptz NOT NULL DEFAULT now(),
  revoked_at            timestamptz,
  CHECK (valid_until IS NULL OR valid_until > valid_from)
);
CREATE INDEX IF NOT EXISTS ix_fw_availability_current 
  ON field_worker_availability_records(field_worker_user_id, village_id, valid_from DESC) WHERE revoked_at IS NULL;

-- ----------------------------------------------------------------------------
-- 4. FARMER ACCOUNT PROVISIONING SEPARATION (DEC-009 / DEC-010)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS farmer_account_provisioning (
  user_id           uuid PRIMARY KEY REFERENCES users(id),
  farmer_id         uuid NOT NULL REFERENCES farmers(id),
  provisioned_by    uuid NOT NULL REFERENCES users(id),
  provisioned_at    timestamptz NOT NULL DEFAULT now(),
  activation_status text NOT NULL DEFAULT 'PENDING' CHECK (activation_status IN ('PENDING','ACTIVE','REVOKED')),
  activated_at      timestamptz,
  revoked_at        timestamptz,
  CHECK (activation_status <> 'ACTIVE' OR activated_at IS NOT NULL)
);

-- Update farmers table constraint to eliminate 'SELF' path
ALTER TABLE farmers DROP CONSTRAINT IF EXISTS farmers_registration_path_check;
ALTER TABLE farmers ADD CONSTRAINT farmers_registration_path_check
  CHECK (registration_path IN ('STAFF_ASSISTED','IMPORT','COOPERATIVE_ASSISTED'));

-- ----------------------------------------------------------------------------
-- 5. VACCINE STOCK INVENTORY & TRANSACTION LEDGER
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS vaccine_products (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code           text NOT NULL UNIQUE,
  name           text NOT NULL,
  programme_code text REFERENCES programmes(code),
  unit_name      text NOT NULL DEFAULT 'DOSE',
  active         boolean NOT NULL DEFAULT true,
  created_by     uuid NOT NULL REFERENCES users(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vaccine_stock_lots (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        uuid NOT NULL REFERENCES vaccine_products(id),
  district_id       uuid NOT NULL REFERENCES districts(id),
  batch_number      text,
  expiry_date       date,
  received_date     date,
  storage_location  text,
  quantity_received numeric(14,3) NOT NULL CHECK (quantity_received >= 0),
  quantity_on_hand  numeric(14,3) NOT NULL CHECK (quantity_on_hand >= 0),
  status            text NOT NULL DEFAULT 'AVAILABLE'
                    CHECK (status IN ('AVAILABLE','QUARANTINED','EXPIRED','DEPLETED','CLOSED')),
  source_reference  text,
  notes             text,
  created_by        uuid NOT NULL REFERENCES users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (expiry_date IS NULL OR received_date IS NULL OR expiry_date >= received_date)
);
CREATE INDEX IF NOT EXISTS ix_vaccine_stock_district_product
  ON vaccine_stock_lots(district_id, product_id, status);

CREATE TABLE IF NOT EXISTS vaccine_stock_transactions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_lot_id     uuid NOT NULL REFERENCES vaccine_stock_lots(id),
  transaction_type text NOT NULL CHECK (transaction_type IN
                    ('RECEIPT','ISSUE','ADJUSTMENT_IN','ADJUSTMENT_OUT','RETURN','WASTAGE','TRANSFER_OUT','TRANSFER_IN')),
  quantity         numeric(14,3) NOT NULL CHECK (quantity > 0),
  from_location    text,
  to_location      text,
  reference_type   text,
  reference_id     uuid,
  reason           text,
  recorded_by      uuid NOT NULL REFERENCES users(id),
  recorded_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (transaction_type NOT IN ('ADJUSTMENT_OUT','WASTAGE','TRANSFER_OUT') OR length(btrim(coalesce(reason,''))) > 0)
);
CREATE INDEX IF NOT EXISTS ix_vaccine_stock_txn_lot_time
  ON vaccine_stock_transactions(stock_lot_id, recorded_at DESC);

-- Stock balance automation trigger
CREATE OR REPLACE FUNCTION apply_vaccine_stock_movement() RETURNS trigger AS $$
DECLARE 
  current_qty numeric(14,3); 
  delta numeric(14,3);
BEGIN
  SELECT quantity_on_hand INTO current_qty FROM vaccine_stock_lots WHERE id = NEW.stock_lot_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Stock lot not found'; END IF;
  
  delta := CASE 
    WHEN NEW.transaction_type IN ('RECEIPT','ADJUSTMENT_IN','RETURN','TRANSFER_IN') THEN NEW.quantity
    WHEN NEW.transaction_type IN ('ISSUE','ADJUSTMENT_OUT','WASTAGE','TRANSFER_OUT') THEN -NEW.quantity 
  END;

  IF current_qty + delta < 0 THEN 
    RAISE EXCEPTION 'Insufficient vaccine stock for this transaction' USING ERRCODE = '23514'; 
  END IF;

  UPDATE vaccine_stock_lots 
  SET quantity_on_hand = current_qty + delta, 
      updated_at = now(),
      status = CASE WHEN current_qty + delta = 0 THEN 'DEPLETED' ELSE status END 
  WHERE id = NEW.stock_lot_id;

  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_apply_vaccine_stock_movement ON vaccine_stock_transactions;
CREATE TRIGGER trg_apply_vaccine_stock_movement 
BEFORE INSERT ON vaccine_stock_transactions
FOR EACH ROW EXECUTE FUNCTION apply_vaccine_stock_movement();

-- Stock transaction immutability trigger (ISSUE-SQL-01 Resolution)
CREATE OR REPLACE FUNCTION reject_stock_transaction_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Stock transactions are append-only; use a compensating movement' USING ERRCODE = '23514';
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stock_txn_immutable ON vaccine_stock_transactions;
CREATE TRIGGER trg_stock_txn_immutable
BEFORE UPDATE OR DELETE ON vaccine_stock_transactions
FOR EACH ROW EXECUTE FUNCTION reject_stock_transaction_mutation();

-- ----------------------------------------------------------------------------
-- 6. CAMP STATUS HISTORY
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS camp_status_history (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_id    uuid NOT NULL REFERENCES camps(id),
  old_status text,
  new_status text NOT NULL,
  changed_by uuid NOT NULL REFERENCES users(id),
  reason     text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 7. COMPATIBILITY VIEWS (SCHEMA V0.3 / V0.4 QUERY ALIGNMENT)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW owners AS
SELECT 
  id, 
  full_name, 
  name_norm, 
  mobile_e164, 
  (mobile_status IN ('VERIFIED_OTP','VERIFIED_STAFF')) AS mobile_verified, 
  village_id, 
  address_text, 
  outreach_consent, 
  consent_basis, 
  consent_recorded_by, 
  consent_recorded_at, 
  active, 
  row_version, 
  created_by, 
  created_at, 
  updated_at 
FROM farmers;

CREATE OR REPLACE VIEW owner_user_links AS
SELECT 
  user_id, 
  farmer_id AS owner_id, 
  linked_by, 
  linked_at 
FROM farmer_user_links;

CREATE OR REPLACE VIEW dairy_cooperatives AS
SELECT 
  id, 
  code, 
  name_gu, 
  name_en, 
  NULL::text AS registration_ref, 
  NULL::text AS contact_name, 
  NULL::text AS contact_mobile, 
  NULL::text AS address_text, 
  NULL::uuid AS taluka_id, 
  (status = 'ACTIVE') AS active, 
  created_by, 
  created_at, 
  created_at AS updated_at 
FROM cooperatives;

-- ----------------------------------------------------------------------------
-- 8. PERMISSIONS & ROLE SEED ALIGNMENT
-- ----------------------------------------------------------------------------

-- Add missing canonical permissions (including cooperative.manage for ISSUE-SQL-03)
INSERT INTO permissions(code, description) VALUES
  ('district.setup.manage', 'District operational setup and master data coordination'),
  ('village.manage', 'Create/update district villages and geodata'),
  ('gram_panchayat.manage', 'Maintain GP directory and village mappings'),
  ('cooperative.manage', 'Create and maintain dairy cooperative directory and village mappings'),
  ('veterinary_officer.manage', 'Manage VO profiles and village assignments'),
  ('vaccine_stock.manage', 'District vaccine stock ledger and movements'),
  ('campaign.manage', 'District campaign operational management'),
  ('farmer.account.provision', 'Provision/link/activate login account for an existing farmer profile'),
  ('field_worker.availability.record', 'Record formal FW availability / unavailability declaration'),
  ('animal.create.fallback', 'Register animal as VO fallback when assigned FW is formally unavailable')
ON CONFLICT (code) DO NOTHING;

-- Grant operational authorities to DAHO (including cooperative.manage)
INSERT INTO role_permissions(role, permission_code) VALUES
  ('DAHO', 'campaign.configure'),
  ('DAHO', 'campaign.manage'),
  ('DAHO', 'district.setup.manage'),
  ('DAHO', 'village.manage'),
  ('DAHO', 'gram_panchayat.manage'),
  ('DAHO', 'cooperative.manage'),
  ('DAHO', 'veterinary_officer.manage'),
  ('DAHO', 'vaccine_stock.manage'),
  ('VET_OFFICER', 'animal.create.fallback'),
  ('VET_OFFICER', 'field_worker.availability.record')
ON CONFLICT DO NOTHING;

-- ISSUE-SQL-02: Revoke primary animal.create from VET_OFFICER (VO animal registration is fallback-only)
-- Field Worker retains primary animal.create.
DELETE FROM role_permissions 
WHERE role = 'VET_OFFICER' AND permission_code = 'animal.create';

-- Revoke operational campaign creation and worker assignment from SYS_ADMIN default seed
DELETE FROM role_permissions 
WHERE role = 'SYS_ADMIN' AND permission_code IN ('campaign.configure', 'campaign.assign_workers');

-- Revoke campaign assignment from FW if erroneously seeded
DELETE FROM role_permissions 
WHERE role = 'FIELD_WORKER' AND permission_code = 'campaign.assign_workers';

-- ----------------------------------------------------------------------------
-- 9. SYSTEM SETTINGS BASELINE CORRECTIONS (DEC-011)
-- ----------------------------------------------------------------------------

UPDATE system_settings 
SET value = 'false' 
WHERE key = 'farmer_self_registration_enabled';

COMMIT;

