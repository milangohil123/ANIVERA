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
"""

async def ensure_health_workflow_schema():
    """Ensure all required tables, columns and indexes exist in PostgreSQL."""
    try:
        async with async_engine.begin() as conn:
            for statement in INIT_SQL.strip().split(";"):
                stmt = statement.strip()
                if stmt:
                    await conn.execute(text(stmt))
        logger.info("Health workflow and cooperative vaccination schema verified successfully.")
    except Exception as e:
        logger.warning("Health workflow schema verification notice: %s", e)
