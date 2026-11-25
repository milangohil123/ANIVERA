-- ==============================================================================
-- PASHURAKSHAK / ANIVERA — 34 Verified Gujarat Districts Master Data Clean-up
-- Ensures all 34 official districts of Gujarat exist, have valid codes,
-- and deactivates any corrupt, duplicate, or invalid test entries.
-- ==============================================================================

BEGIN;

-- 1. Insert or update the 34 Canonical Gujarat Districts
INSERT INTO districts (id, code, name_en, name_gu, active, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'AHMEDABAD', 'Ahmedabad', 'અમદાવાદ', true, NOW(), NOW()),
  (gen_random_uuid(), 'AMRELI', 'Amreli', 'અમરેલી', true, NOW(), NOW()),
  (gen_random_uuid(), 'ANAND', 'Anand', 'આણંદ', true, NOW(), NOW()),
  (gen_random_uuid(), 'ARAVALLI', 'Aravalli', 'અરવલ્લી', true, NOW(), NOW()),
  (gen_random_uuid(), 'BANASKANTHA', 'Banaskantha', 'બનાસકાંઠા', true, NOW(), NOW()),
  (gen_random_uuid(), 'BHARUCH', 'Bharuch', 'ભરૂચ', true, NOW(), NOW()),
  (gen_random_uuid(), 'BHAVNAGAR', 'Bhavnagar', 'ભાવનગર', true, NOW(), NOW()),
  (gen_random_uuid(), 'BOTAD', 'Botad', 'બોટાદ', true, NOW(), NOW()),
  (gen_random_uuid(), 'CHHOTA_UDAIPUR', 'Chhota Udaipur', 'છોટા ઉદેપુર', true, NOW(), NOW()),
  (gen_random_uuid(), 'DAHOD', 'Dahod', 'દાહોદ', true, NOW(), NOW()),
  (gen_random_uuid(), 'DANG', 'Dang', 'ડાંગ', true, NOW(), NOW()),
  (gen_random_uuid(), 'DEVBHUMI_DWARKA', 'Devbhumi Dwarka', 'દેવભૂમિ દ્વારકા', true, NOW(), NOW()),
  (gen_random_uuid(), 'GANDHINAGAR', 'Gandhinagar', 'ગાંધીનગર', true, NOW(), NOW()),
  (gen_random_uuid(), 'GIR_SOMNATH', 'Gir Somnath', 'ગીર સોમનાથ', true, NOW(), NOW()),
  (gen_random_uuid(), 'JAMNAGAR', 'Jamnagar', 'જામનગર', true, NOW(), NOW()),
  (gen_random_uuid(), 'JUNAGADH', 'Junagadh', 'જૂનાગઢ', true, NOW(), NOW()),
  (gen_random_uuid(), 'KHEDA', 'Kheda', 'ખેડા', true, NOW(), NOW()),
  (gen_random_uuid(), 'KUTCH', 'Kutch', 'કચ્છ', true, NOW(), NOW()),
  (gen_random_uuid(), 'MAHISAGAR', 'Mahisagar', 'મહીસાગર', true, NOW(), NOW()),
  (gen_random_uuid(), 'MEHSANA', 'Mehsana', 'મહેસાણા', true, NOW(), NOW()),
  (gen_random_uuid(), 'MORBI', 'Morbi', 'મોરબી', true, NOW(), NOW()),
  (gen_random_uuid(), 'NARMADA', 'Narmada', 'નર્મદા', true, NOW(), NOW()),
  (gen_random_uuid(), 'NAVSARI', 'Navsari', 'નવસારી', true, NOW(), NOW()),
  (gen_random_uuid(), 'PANCHMAHAL', 'Panchmahal', 'પંચમહાલ', true, NOW(), NOW()),
  (gen_random_uuid(), 'PATAN', 'Patan', 'પાટણ', true, NOW(), NOW()),
  (gen_random_uuid(), 'PORBANDAR', 'Porbandar', 'પોરબંદર', true, NOW(), NOW()),
  (gen_random_uuid(), 'RAJKOT', 'Rajkot', 'રાજકોટ', true, NOW(), NOW()),
  (gen_random_uuid(), 'SABARKANTHA', 'Sabarkantha', 'સાબરકાંઠા', true, NOW(), NOW()),
  (gen_random_uuid(), 'SURAT', 'Surat', 'સુરત', true, NOW(), NOW()),
  (gen_random_uuid(), 'SURENDRANAGAR', 'Surendranagar', 'સુરેન્દ્રનગર', true, NOW(), NOW()),
  (gen_random_uuid(), 'TAPI', 'Tapi', 'તાપી', true, NOW(), NOW()),
  (gen_random_uuid(), 'VADODARA', 'Vadodara', 'વડોદરા', true, NOW(), NOW()),
  (gen_random_uuid(), 'VALSAD', 'Valsad', 'વલસાડ', true, NOW(), NOW()),
  (gen_random_uuid(), 'VAV_THARAD', 'Vav-Tharad', 'વાવ-થરાદ', true, NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
  name_en = EXCLUDED.name_en,
  name_gu = EXCLUDED.name_gu,
  active = true,
  updated_at = NOW();

-- 2. Deactivate invalid / corrupt test entries (e.g. repeated dummy names like 'જી જી જી' or dummy test codes)
UPDATE districts
SET active = false, updated_at = NOW()
WHERE code NOT IN (
  'AHMEDABAD', 'AMRELI', 'ANAND', 'ARAVALLI', 'BANASKANTHA', 'BHARUCH', 'BHAVNAGAR',
  'BOTAD', 'CHHOTA_UDAIPUR', 'DAHOD', 'DANG', 'DEVBHUMI_DWARKA', 'GANDHINAGAR',
  'GIR_SOMNATH', 'JAMNAGAR', 'JUNAGADH', 'KHEDA', 'KUTCH', 'MAHISAGAR', 'MEHSANA',
  'MORBI', 'NARMADA', 'NAVSARI', 'PANCHMAHAL', 'PATAN', 'PORBANDAR', 'RAJKOT',
  'SABARKANTHA', 'SURAT', 'SURENDRANAGAR', 'TAPI', 'VADODARA', 'VALSAD', 'VAV_THARAD'
);

COMMIT;
