-- ============================================================================
-- PashuRakshak Botad — Post-Migration Verification Queries
-- Target Engine: PostgreSQL 16.x
-- Database: pashurakshak_db
-- ============================================================================

-- 1. Total Base Tables, Views, Materialized Views
SELECT 
  (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE') as total_base_tables,
  (SELECT count(*) FROM information_schema.views WHERE table_schema='public') as total_views,
  (SELECT count(*) FROM pg_matviews WHERE schemaname='public') as total_mat_views;
-- Expected: total_base_tables = 55, total_views = 6, total_mat_views = 2

-- 2. Verify District and Village Migration
SELECT count(*) FROM districts WHERE code = 'BOTAD';
-- Expected: 1

SELECT count(*) FROM information_schema.columns 
WHERE table_name IN ('talukas', 'villages') AND column_name = 'district_id';
-- Expected: 2 (both tables have district_id)

SELECT count(*) FROM pg_indexes 
WHERE indexname IN ('ix_talukas_district_id', 'ix_villages_district_id');
-- Expected: 2

-- 3. Verify Compatibility Views
SELECT count(*) FROM owners;
SELECT count(*) FROM owner_user_links;
SELECT count(*) FROM dairy_cooperatives;
-- Expected: All three execute cleanly

-- 4. Verify System Setting (Farmer Self-Registration Disabled)
SELECT value FROM system_settings WHERE key = 'farmer_self_registration_enabled';
-- Expected: 'false'

-- 5. Verify DAHO Campaign & Cooperative Permissions
SELECT permission_code FROM role_permissions WHERE role = 'DAHO' ORDER BY permission_code;
-- Expected includes: campaign.configure, campaign.manage, campaign.view, cooperative.manage, 
--                    district.setup.manage, gram_panchayat.manage, vaccine_stock.manage, 
--                    veterinary_officer.manage, village.manage

-- 6. Verify SYS_ADMIN Separation
SELECT permission_code FROM role_permissions WHERE role = 'SYS_ADMIN' AND permission_code LIKE 'campaign.%';
-- Expected: campaign.view only

-- 7. Verify VO Fallback-Only Animal Registration
SELECT role, permission_code FROM role_permissions 
WHERE role IN ('VET_OFFICER', 'FIELD_WORKER') AND permission_code LIKE 'animal.create%';
-- Expected:
--   FIELD_WORKER | animal.create
--   VET_OFFICER  | animal.create.fallback

-- 8. Verify Stock Transactions Append-Only Trigger
SELECT trigger_name, event_manipulation, action_statement 
FROM information_schema.triggers 
WHERE event_object_table = 'vaccine_stock_transactions' 
ORDER BY trigger_name;
-- Expected triggers:
--   trg_apply_vaccine_stock_movement (BEFORE INSERT)
--   trg_stock_txn_immutable         (BEFORE UPDATE OR DELETE)

