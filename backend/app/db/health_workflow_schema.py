"""Database schema initialization and idempotent table verification for:
1. Disease Reporting, TAHO Case Assignment, Treatment & Verification
2. Dairy Cooperative Recurring Vaccination Schedules, Enrolled Animals & 15-Day Cycles
"""
import logging
from sqlalchemy import text
from app.db.session import async_engine

logger = logging.getLogger(__name__)

INIT_SQL = """
-- 1. Ensure columns on disease_reports
ALTER TABLE disease_reports ADD COLUMN IF NOT EXISTS urgency VARCHAR(20) DEFAULT 'NORMAL';
ALTER TABLE disease_reports ADD COLUMN IF NOT EXISTS is_unknown_disease BOOLEAN DEFAULT FALSE;
ALTER TABLE disease_reports ADD COLUMN IF NOT EXISTS custom_disease_name TEXT NULL;
ALTER TABLE disease_reports ADD COLUMN IF NOT EXISTS treatment_status VARCHAR(50) DEFAULT 'SUBMITTED';
ALTER TABLE disease_reports ADD COLUMN IF NOT EXISTS assigned_vo_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE disease_reports ADD COLUMN IF NOT EXISTS assigned_fw_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE disease_reports ADD COLUMN IF NOT EXISTS assigned_to_role VARCHAR(20) NULL;
ALTER TABLE disease_reports ADD COLUMN IF NOT EXISTS assignment_instructions TEXT NULL;
ALTER TABLE disease_reports ADD COLUMN IF NOT EXISTS planned_visit_date DATE NULL;

-- Ensure disease_reports status constraint allows RESOLVED and CLOSED for treatment verification
ALTER TABLE disease_reports DROP CONSTRAINT IF EXISTS disease_reports_status_check;
ALTER TABLE disease_reports ADD CONSTRAINT disease_reports_status_check 
CHECK (status IN (
    'SUBMITTED', 
    'UNDER_REVIEW', 
    'SUSPECTED', 
    'NEEDS_MORE_INFORMATION', 
    'CONFIRMED', 
    'NOT_CONFIRMED', 
    'INSUFFICIENT_INFORMATION', 
    'RESOLVED', 
    'CLOSED'
));

-- 2. Health Case Assignments table
CREATE TABLE IF NOT EXISTS health_case_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES disease_reports(report_id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES users(id),
    assigned_vo_id UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_fw_id UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_to_role VARCHAR(20) NOT NULL DEFAULT 'BOTH',
    priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    instructions TEXT NULL,
    planned_visit_date DATE NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ASSIGNED',
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ NULL,
    visited_at TIMESTAMPTZ NULL,
    completed_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_hca_report ON health_case_assignments(report_id);
CREATE INDEX IF NOT EXISTS idx_hca_vo ON health_case_assignments(assigned_vo_id);
CREATE INDEX IF NOT EXISTS idx_hca_fw ON health_case_assignments(assigned_fw_id);

-- 3. Treatment Records table
CREATE TABLE IF NOT EXISTS treatment_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES disease_reports(report_id) ON DELETE CASCADE,
    assignment_id UUID REFERENCES health_case_assignments(id) ON DELETE SET NULL,
    animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
    treated_by UUID NOT NULL REFERENCES users(id),
    treated_by_role VARCHAR(20) NOT NULL DEFAULT 'VO',
    visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
    visit_time VARCHAR(20) NULL,
    observations TEXT NOT NULL,
    diagnosis TEXT NULL,
    treatment_text TEXT NOT NULL,
    medicine_administered TEXT NULL,
    dosage_details TEXT NULL,
    treatment_notes TEXT NULL,
    follow_up_instructions TEXT NULL,
    next_visit_date DATE NULL,
    latitude NUMERIC(9, 6) NULL,
    longitude NUMERIC(9, 6) NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'AWAITING_VERIFICATION',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tr_report ON treatment_records(report_id);
CREATE INDEX IF NOT EXISTS idx_tr_animal ON treatment_records(animal_id);
CREATE INDEX IF NOT EXISTS idx_tr_treated_by ON treatment_records(treated_by);

-- 4. Treatment Verifications table
CREATE TABLE IF NOT EXISTS treatment_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    treatment_id UUID REFERENCES treatment_records(id) ON DELETE CASCADE,
    report_id UUID NOT NULL REFERENCES disease_reports(report_id) ON DELETE CASCADE,
    verified_by UUID NOT NULL REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    verification_notes TEXT NULL,
    rejection_reason TEXT NULL,
    follow_up_instructions TEXT NULL,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tv_report ON treatment_verifications(report_id);

-- 5. Treatment Attachments (Before/After/Evidence Photos)
CREATE TABLE IF NOT EXISTS treatment_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    treatment_id UUID REFERENCES treatment_records(id) ON DELETE CASCADE,
    report_id UUID NOT NULL REFERENCES disease_reports(report_id) ON DELETE CASCADE,
    attachment_type VARCHAR(50) NOT NULL DEFAULT 'SYMPTOM_EVIDENCE',
    file_path TEXT NOT NULL,
    mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
    size_bytes INT NOT NULL DEFAULT 0,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ta_report ON treatment_attachments(report_id);
CREATE INDEX IF NOT EXISTS idx_ta_treatment ON treatment_attachments(treatment_id);

-- 6. Cooperative Recurring Vaccination Schedules table
CREATE TABLE IF NOT EXISTS cooperative_vaccination_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cooperative_id UUID NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
    schedule_name TEXT NOT NULL,
    programme_code TEXT NOT NULL,
    vaccine_name TEXT NOT NULL,
    disease_prevention_purpose TEXT NULL,
    target_species TEXT[] NOT NULL DEFAULT ARRAY['CATTLE', 'BUFFALO'],
    target_villages UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
    taluka_id UUID NOT NULL REFERENCES talukas(id),
    start_date DATE NOT NULL,
    recurrence_interval_value INT NOT NULL DEFAULT 6,
    recurrence_interval_unit VARCHAR(20) NOT NULL DEFAULT 'MONTHS',
    reminder_days_before INT NOT NULL DEFAULT 15,
    execution_instructions TEXT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    submitted_at TIMESTAMPTZ NULL,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ NULL,
    review_notes TEXT NULL,
    approved_execution_start DATE NULL,
    approved_execution_end DATE NULL,
    version INT NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_cvs_coop ON cooperative_vaccination_schedules(cooperative_id);
CREATE INDEX IF NOT EXISTS idx_cvs_taluka ON cooperative_vaccination_schedules(taluka_id);
CREATE INDEX IF NOT EXISTS idx_cvs_status ON cooperative_vaccination_schedules(status);

-- 7. Schedule Animal Enrollments table
CREATE TABLE IF NOT EXISTS schedule_animal_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES cooperative_vaccination_schedules(id) ON DELETE CASCADE,
    animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
    farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
    cooperative_id UUID NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'ENROLLED',
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_schedule_animal UNIQUE (schedule_id, animal_id)
);
CREATE INDEX IF NOT EXISTS idx_sae_schedule ON schedule_animal_enrollments(schedule_id);
CREATE INDEX IF NOT EXISTS idx_sae_animal ON schedule_animal_enrollments(animal_id);
CREATE INDEX IF NOT EXISTS idx_sae_farmer ON schedule_animal_enrollments(farmer_id);

-- 8. Animal Vaccination Cycles & 15-Day Reminders table
CREATE TABLE IF NOT EXISTS animal_vaccination_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
    schedule_id UUID NOT NULL REFERENCES cooperative_vaccination_schedules(id) ON DELETE CASCADE,
    programme_code TEXT NOT NULL,
    cycle_number INT NOT NULL DEFAULT 1,
    previous_vaccination_date DATE NULL,
    last_verified_vaccination_date DATE NULL,
    due_date DATE NOT NULL,
    reminder_date DATE NOT NULL,
    reminder_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    reminder_sent_at TIMESTAMPTZ NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED',
    assigned_staff_id UUID REFERENCES users(id) ON DELETE SET NULL,
    completed_event_id UUID NULL,
    completed_date DATE NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_avc_animal ON animal_vaccination_cycles(animal_id);
CREATE INDEX IF NOT EXISTS idx_avc_schedule ON animal_vaccination_cycles(schedule_id);
CREATE INDEX IF NOT EXISTS idx_avc_due ON animal_vaccination_cycles(due_date);
CREATE INDEX IF NOT EXISTS idx_avc_reminder ON animal_vaccination_cycles(reminder_date, reminder_status);
CREATE INDEX IF NOT EXISTS idx_avc_status ON animal_vaccination_cycles(status);

-- 9. Campaign Village Assignments, Evidence, Completion & Verification table
CREATE TABLE IF NOT EXISTS campaign_village_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    village_id UUID NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'ASSIGNED',
    assigned_vo_id UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_fw_id UUID REFERENCES users(id) ON DELETE SET NULL,
    animals_visited_count INT NOT NULL DEFAULT 0,
    vaccinations_completed_count INT NOT NULL DEFAULT 0,
    pending_animals_count INT NOT NULL DEFAULT 0,
    field_observations TEXT NULL,
    completion_notes TEXT NULL,
    evidence_photo_urls TEXT[] NULL,
    submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    submitted_at TIMESTAMPTZ NULL,
    verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ NULL,
    verification_notes TEXT NULL,
    rejection_reason TEXT NULL,
    reopened_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reopened_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_camp_vill_verif UNIQUE (campaign_id, village_id)
);
CREATE INDEX IF NOT EXISTS idx_cvv_campaign ON campaign_village_verifications(campaign_id);
CREATE INDEX IF NOT EXISTS idx_cvv_village ON campaign_village_verifications(village_id);
CREATE INDEX IF NOT EXISTS idx_cvv_status ON campaign_village_verifications(status);

-- 10. Animal, Disease and Vaccination Masters
ALTER TABLE species ADD COLUMN IF NOT EXISTS name_hi TEXT NULL;
ALTER TABLE species ADD COLUMN IF NOT EXISTS description TEXT NULL;
ALTER TABLE species ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;
ALTER TABLE species ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS disease_masters (
    code VARCHAR(50) PRIMARY KEY,
    name_en TEXT NOT NULL,
    name_gu TEXT NOT NULL,
    name_hi TEXT NULL,
    description TEXT NULL,
    applicable_species JSONB NOT NULL DEFAULT '[]'::jsonb,
    color VARCHAR(20) DEFAULT '#EF4444',
    severity VARCHAR(20) DEFAULT 'HIGH',
    active BOOLEAN DEFAULT TRUE,
    archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dm_active ON disease_masters(active);

CREATE TABLE IF NOT EXISTS vaccine_masters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name_en TEXT NOT NULL,
    name_gu TEXT NOT NULL,
    disease_code VARCHAR(50) NOT NULL,
    applicable_species JSONB NOT NULL DEFAULT '[]'::jsonb,
    administration_route VARCHAR(50) NULL,
    standard_dosage VARCHAR(50) NULL,
    schedule_interval VARCHAR(100) NULL,
    verification_status VARCHAR(50) NOT NULL DEFAULT 'VERIFIED',
    verified_source TEXT NULL,
    is_custom_manual BOOLEAN DEFAULT FALSE,
    description TEXT NULL,
    active BOOLEAN DEFAULT TRUE,
    archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vm_disease ON vaccine_masters(disease_code);
CREATE INDEX IF NOT EXISTS idx_vm_active ON vaccine_masters(active);
CREATE INDEX IF NOT EXISTS idx_vm_verification ON vaccine_masters(verification_status);

-- 11. Campaign Master Data linkage columns
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS disease_code TEXT NULL;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS vaccine_code TEXT NULL;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS vaccine_name TEXT NULL;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS custom_vaccine_name TEXT NULL;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS is_custom_vaccine BOOLEAN DEFAULT FALSE;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS species_codes TEXT[] NULL;
"""

DEFAULT_SPECIES = [
    ("CATTLE", "ગાય (Cow)", "Cattle / Cow", "गाय", "Bovine livestock including indigenous and crossbred cattle"),
    ("BUFFALO", "ભેંસ (Buffalo)", "Buffalo", "भैंस", "Bovine water buffaloes for dairy production"),
    ("GOAT", "બકરી (Goat)", "Goat", "बकरी", "Caprine small ruminants"),
    ("SHEEP", "ઘેટાં (Sheep)", "Sheep", "भेड़", "Ovine small ruminants for wool and mutton"),
]

DEFAULT_DISEASES = [
    {
        "code": "FMD",
        "name_en": "Foot and Mouth Disease (FMD)",
        "name_gu": "ખરવા-મોવાસા (FMD)",
        "name_hi": "खुरपका-मुंहपका (FMD)",
        "applicable_species": ["CATTLE", "BUFFALO", "GOAT", "SHEEP"],
        "color": "#DC2626",
        "severity": "HIGH",
        "description": "Highly contagious viral disease of cloven-hoofed animals causing vesicles and erosions in mouth and feet."
    },
    {
        "code": "LSD",
        "name_en": "Lumpy Skin Disease (LSD)",
        "name_gu": "લમ્પી તત્વચા રોગ (LSD)",
        "name_hi": "लंपी त्वचा रोग (LSD)",
        "applicable_species": ["CATTLE", "BUFFALO"],
        "color": "#EA580C",
        "severity": "HIGH",
        "description": "Viral pox disease characterized by skin nodules, fever, and enlarged lymph nodes."
    },
    {
        "code": "PPR",
        "name_en": "Peste des Petits Ruminants (PPR / Goat Plague)",
        "name_gu": "પીપીઆર - બકરી પ્લેગ (PPR)",
        "name_hi": "पीपीआर - बकरी प्लेग (PPR)",
        "applicable_species": ["GOAT", "SHEEP"],
        "color": "#D97706",
        "severity": "HIGH",
        "description": "Contagious viral disease of small ruminants characterized by fever, stomatitis, and diarrhoea."
    },
    {
        "code": "BRUCELLOSIS",
        "name_en": "Brucellosis",
        "name_gu": "બ્રુસેલોસિસ (Brucellosis)",
        "name_hi": "ब्रुसेलोसिस (Brucellosis)",
        "applicable_species": ["CATTLE", "BUFFALO"],
        "color": "#7C3AED",
        "severity": "HIGH",
        "description": "Zoonotic chronic bacterial infection causing abortion in late pregnancy and infertility."
    },
    {
        "code": "HS",
        "name_en": "Haemorrhagic Septicaemia (HS)",
        "name_gu": "ગળસૂંઠો (HS)",
        "name_hi": "गलघोंटू (HS)",
        "applicable_species": ["CATTLE", "BUFFALO"],
        "color": "#B91C1C",
        "severity": "HIGH",
        "description": "Acute bacterial septicaemic disease caused by Pasteurella multocida."
    },
    {
        "code": "BQ",
        "name_en": "Black Quarter (BQ)",
        "name_gu": "ગાંઠિયો તાવ (BQ)",
        "name_hi": "लंगड़ा बुखार (BQ)",
        "applicable_species": ["CATTLE", "BUFFALO"],
        "color": "#475569",
        "severity": "HIGH",
        "description": "Acute infectious disease of cattle caused by Clostridium chauvoei causing swollen emphysematous muscles."
    },
    {
        "code": "ET",
        "name_en": "Enterotoxaemia (ET / Pulpy Kidney)",
        "name_gu": "એન્ટેરોટોક્સીમિયા - ફડકી (ET)",
        "name_hi": "एंटरोटॉक्सिमिया - फड़की (ET)",
        "applicable_species": ["SHEEP", "GOAT"],
        "color": "#059669",
        "severity": "MEDIUM",
        "description": "Acute toxaemia caused by Clostridium perfringens type D affecting sheep and goats."
    },
    {
        "code": "ANTHRAX",
        "name_en": "Anthrax",
        "name_gu": "કાળીયો તાવ (Anthrax)",
        "name_hi": "एंथ्रेक्स / जहरी बुखार (Anthrax)",
        "applicable_species": ["CATTLE", "BUFFALO", "GOAT", "SHEEP"],
        "color": "#111827",
        "severity": "HIGH",
        "description": "Severe acute zoonotic bacterial infection caused by Bacillus anthracis."
    },
    {
        "code": "THEILERIOSIS",
        "name_en": "Theileriosis",
        "name_gu": "થાઈલેરીયોસિસ (Theileriosis)",
        "name_hi": "थाइलेरियासिस (Theileriosis)",
        "applicable_species": ["CATTLE"],
        "color": "#0284C7",
        "severity": "MEDIUM",
        "description": "Tick-borne protozoan disease caused by Theileria annulata causing high fever and swollen lymph nodes."
    },
    {
        "code": "RABIES",
        "name_en": "Rabies",
        "name_gu": "હડકવા (Rabies)",
        "name_hi": "रेबीज / अलर्क (Rabies)",
        "applicable_species": ["CATTLE", "BUFFALO", "GOAT", "SHEEP"],
        "color": "#DC2626",
        "severity": "HIGH",
        "description": "Fatal viral neurological infection transmitted through saliva of infected carnivores."
    },
    {
        "code": "MASTITIS",
        "name_en": "Mastitis",
        "name_gu": "આઉનો સોજો (Mastitis)",
        "name_hi": "थनेला रोग (Mastitis)",
        "applicable_species": ["CATTLE", "BUFFALO"],
        "color": "#2563EB",
        "severity": "MEDIUM",
        "description": "Inflammation of mammary gland parenchyma resulting in physical and chemical changes in milk."
    }
]

DEFAULT_VACCINES = [
    {
        "code": "VAC-FMD-01",
        "name_en": "Inactivated Trivalent FMD Oil Adjuvant Vaccine",
        "name_gu": "FMD ત્રિ-સંયોજક તેલ આધારિત નિષ્ક્રિય રસી",
        "disease_code": "FMD",
        "applicable_species": ["CATTLE", "BUFFALO", "GOAT", "SHEEP"],
        "administration_route": "S/C (Deep Subcutaneous)",
        "standard_dosage": "Cattle/Buffalo: 2 ml, Sheep/Goat: 1 ml",
        "schedule_interval": "Bi-annual (Every 6 Months)",
        "verification_status": "VERIFIED",
        "verified_source": "ICAR-IVRI / DAHD National Animal Disease Control Programme",
        "description": "Trivalent inactivated vaccine containing O, A, and Asia-1 serotypes."
    },
    {
        "code": "VAC-LSD-01",
        "name_en": "Homologous Lumpi-ProVacInd / Live Attenuated Goat Pox Vaccine",
        "name_gu": "લમ્પી-પ્રોવેકઇન્ડ / લાઈવ એટેન્યુએટેડ રસી",
        "disease_code": "LSD",
        "applicable_species": ["CATTLE", "BUFFALO"],
        "administration_route": "S/C",
        "standard_dosage": "3 ml",
        "schedule_interval": "Annual (Once a year)",
        "verification_status": "VERIFIED",
        "verified_source": "ICAR-NRCE & IVRI / Gujarat State Veterinary Formulary",
        "description": "Homologous vaccine providing robust cellular and humoral immunity against LSD."
    },
    {
        "code": "VAC-PPR-01",
        "name_en": "PPR Live Attenuated Homologous Tissue Culture Vaccine",
        "name_gu": "PPR લાઈવ એટેન્યુએટેડ ટીશ્યુ કલ્ચર રસી",
        "disease_code": "PPR",
        "applicable_species": ["GOAT", "SHEEP"],
        "administration_route": "S/C",
        "standard_dosage": "1 ml",
        "schedule_interval": "Every 3 Years (Once in 36 Months)",
        "verification_status": "VERIFIED",
        "verified_source": "ICAR-IVRI / National PPR Eradication Programme (DAHD)",
        "description": "Live attenuated vaccine conferring long-lasting protective immunity for small ruminants."
    },
    {
        "code": "VAC-BRU-01",
        "name_en": "Brucella abortus Strain 19 (S19) Live Calves Vaccine",
        "name_gu": "બ્રુસેલા એબોર્ટસ સ્ટ્રેઇન ૧૯ જીવંત વાછરડી રસી",
        "disease_code": "BRUCELLOSIS",
        "applicable_species": ["CATTLE", "BUFFALO"],
        "administration_route": "S/C",
        "standard_dosage": "2 ml (Female calves 4-8 months only)",
        "schedule_interval": "Once in Lifetime",
        "verification_status": "VERIFIED",
        "verified_source": "DAHD NADCP Brucellosis Control Programme",
        "description": "Administered exclusively to female calves between 4-8 months of age."
    },
    {
        "code": "VAC-HS-01",
        "name_en": "HS Alum Precipitated / Oil Adjuvant Inactivated Vaccine",
        "name_gu": "ગળસૂંઠો (HS) એલમ અવક્ષેપિત રસી",
        "disease_code": "HS",
        "applicable_species": ["CATTLE", "BUFFALO"],
        "administration_route": "S/C",
        "standard_dosage": "3 ml",
        "schedule_interval": "Annual Pre-Monsoon (May - June)",
        "verification_status": "VERIFIED",
        "verified_source": "Government Veterinary Formulary / DAHD Guidelines",
        "description": "Formalin-killed Pasteurella multocida vaccine administered before monsoon."
    },
    {
        "code": "VAC-BQ-01",
        "name_en": "Black Quarter (BQ) Inactivated Formalin-Killed Vaccine",
        "name_gu": "ગાંઠિયો તાવ (BQ) ફોર્મલિન કિલ્ડ રસી",
        "disease_code": "BQ",
        "applicable_species": ["CATTLE", "BUFFALO"],
        "administration_route": "S/C",
        "standard_dosage": "2 ml",
        "schedule_interval": "Annual Pre-Monsoon (May - June)",
        "verification_status": "VERIFIED",
        "verified_source": "State Veterinary Biological Products Institute / DAHD",
        "description": "Formalin inactivated Clostridium chauvoei whole culture anaculture."
    },
    {
        "code": "VAC-ET-01",
        "name_en": "Enterotoxaemia (ET) Multi-Component Alum Adsorbed Vaccine",
        "name_gu": "ફડકી (ET) એલમ એડસોર્બડ રસી",
        "disease_code": "ET",
        "applicable_species": ["SHEEP", "GOAT"],
        "administration_route": "S/C",
        "standard_dosage": "2 ml",
        "schedule_interval": "Annual Pre-Monsoon (May - June)",
        "verification_status": "VERIFIED",
        "verified_source": "State Biological Products Institute / DAHD Guidelines",
        "description": "Clostridium perfringens type D toxoid adsorbed on aluminium hydroxide gel."
    },
    {
        "code": "VAC-ANT-01",
        "name_en": "Anthrax Spore Vaccine (Living Sterne Strain 34F2)",
        "name_gu": "કાળીયો તાવ (Anthrax) સ્ટર્ન સ્ટ્રેઇન જીવંત સ્પોર રસી",
        "disease_code": "ANTHRAX",
        "applicable_species": ["CATTLE", "BUFFALO", "GOAT", "SHEEP"],
        "administration_route": "S/C",
        "standard_dosage": "1 ml",
        "schedule_interval": "Annual in Endemic Pockets",
        "verification_status": "VERIFIED",
        "verified_source": "DAHD Guidelines / WHO Animal Health Formulary",
        "description": "Avirulent, non-capsulated Sterne strain 34F2 live spore vaccine."
    },
    {
        "code": "VAC-RAB-01",
        "name_en": "Rabies Inactivated Cell Culture Veterinary Vaccine",
        "name_gu": "હડકવા (Rabies) સેલ કલ્ચર નિષ્ક્રિય પશુ રસી",
        "disease_code": "RABIES",
        "applicable_species": ["CATTLE", "BUFFALO", "GOAT", "SHEEP"],
        "administration_route": "I/M or S/C",
        "standard_dosage": "1 ml",
        "schedule_interval": "Post-exposure (Days 0, 3, 7, 14, 28) or Annual Pre-exposure",
        "verification_status": "VERIFIED",
        "verified_source": "WHO / Indian Pharmacopoeia Veterinary (IPV) / DAHD",
        "description": "Purified inactivated rabies virus propagated on verified cell culture line."
    }
]

async def ensure_health_workflow_schema():
    """Ensure all required tables, columns and indexes exist in PostgreSQL and seed baseline master records."""
    import json
    try:
        async with async_engine.begin() as conn:
            for statement in INIT_SQL.strip().split(";"):
                stmt = statement.strip()
                if stmt:
                    await conn.execute(text(stmt))

            # 1. Seed / Update Species
            for code, name_gu, name_en, name_hi, desc in DEFAULT_SPECIES:
                await conn.execute(
                    text("""
                        INSERT INTO species (code, name_gu, name_en, name_hi, description, active, archived)
                        VALUES (:code, :name_gu, :name_en, :name_hi, :desc, TRUE, FALSE)
                        ON CONFLICT (code) DO UPDATE SET
                            name_hi = COALESCE(species.name_hi, EXCLUDED.name_hi),
                            description = COALESCE(species.description, EXCLUDED.description),
                            active = TRUE;
                    """),
                    {"code": code, "name_gu": name_gu, "name_en": name_en, "name_hi": name_hi, "desc": desc}
                )

            # 2. Seed Disease Masters
            for d in DEFAULT_DISEASES:
                await conn.execute(
                    text("""
                        INSERT INTO disease_masters (code, name_en, name_gu, name_hi, applicable_species, color, severity, description, active, archived)
                        VALUES (:code, :name_en, :name_gu, :name_hi, :applicable_species::jsonb, :color, :severity, :description, TRUE, FALSE)
                        ON CONFLICT (code) DO UPDATE SET
                            name_en = EXCLUDED.name_en,
                            name_gu = EXCLUDED.name_gu,
                            name_hi = EXCLUDED.name_hi,
                            applicable_species = EXCLUDED.applicable_species,
                            color = EXCLUDED.color,
                            severity = EXCLUDED.severity,
                            description = EXCLUDED.description;
                    """),
                    {
                        "code": d["code"],
                        "name_en": d["name_en"],
                        "name_gu": d["name_gu"],
                        "name_hi": d["name_hi"],
                        "applicable_species": json.dumps(d["applicable_species"]),
                        "color": d["color"],
                        "severity": d["severity"],
                        "description": d["description"]
                    }
                )

            # 3. Seed Vaccine Masters
            for v in DEFAULT_VACCINES:
                await conn.execute(
                    text("""
                        INSERT INTO vaccine_masters (code, name_en, name_gu, disease_code, applicable_species, administration_route, standard_dosage, schedule_interval, verification_status, verified_source, is_custom_manual, description, active, archived)
                        VALUES (:code, :name_en, :name_gu, :disease_code, :applicable_species::jsonb, :administration_route, :standard_dosage, :schedule_interval, :verification_status, :verified_source, FALSE, :description, TRUE, FALSE)
                        ON CONFLICT (code) DO UPDATE SET
                            name_en = EXCLUDED.name_en,
                            name_gu = EXCLUDED.name_gu,
                            disease_code = EXCLUDED.disease_code,
                            applicable_species = EXCLUDED.applicable_species,
                            administration_route = EXCLUDED.administration_route,
                            standard_dosage = EXCLUDED.standard_dosage,
                            schedule_interval = EXCLUDED.schedule_interval,
                            verification_status = EXCLUDED.verification_status,
                            verified_source = EXCLUDED.verified_source,
                            description = EXCLUDED.description;
                    """),
                    {
                        "code": v["code"],
                        "name_en": v["name_en"],
                        "name_gu": v["name_gu"],
                        "disease_code": v["disease_code"],
                        "applicable_species": json.dumps(v["applicable_species"]),
                        "administration_route": v["administration_route"],
                        "standard_dosage": v["standard_dosage"],
                        "schedule_interval": v["schedule_interval"],
                        "verification_status": v["verification_status"],
                        "verified_source": v["verified_source"],
                        "description": v["description"]
                    }
                )

        logger.info("Health workflow, cooperative vaccination, and animal & disease master schema verified and seeded successfully.")
    except Exception as e:
        logger.warning("Health workflow schema verification notice: %s", e)
