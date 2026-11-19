-- ==============================================================================
-- PashuRakshak Botad — Smart Live Location Tracking & Intelligent Assignment Schema
-- Compatible with PostgreSQL 16
-- ==============================================================================

-- 1. Help Requests / Complaints Table (if not already created)
CREATE SEQUENCE IF NOT EXISTS help_request_ref_seq START 1;

CREATE TABLE IF NOT EXISTS help_requests (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_no       text NOT NULL UNIQUE
                     DEFAULT ('HR-BOT-' || to_char(now(),'YYYY') || '-' || lpad(nextval('help_request_ref_seq')::text,6,'0')),
  requester_name     text NOT NULL,
  contact_number     text,
  contact_verified   boolean NOT NULL DEFAULT false,
  village_id         uuid NOT NULL REFERENCES villages(id),
  farmer_id          uuid REFERENCES farmers(id),
  animal_id          uuid REFERENCES animals(id),
  animal_description text,
  problem_text       text NOT NULL,
  source             text NOT NULL DEFAULT 'STAFF_ASSISTED' CHECK (source IN ('STAFF_ASSISTED','FARMER_APP')),
  registered_by      uuid REFERENCES users(id),
  status             text NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN
                     ('SUBMITTED','ASSIGNED','CONTACT_ATTEMPTED','VISIT_PLANNED','RESOLVED','CANCELLED')),
  assigned_to        uuid REFERENCES users(id),
  visit_planned_for  date,
  outcome_text       text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  resolved_at        timestamptz
);

CREATE INDEX IF NOT EXISTS ix_help_status_village ON help_requests(village_id, status);
CREATE INDEX IF NOT EXISTS ix_help_assignee ON help_requests(assigned_to, status);

-- 2. Field Worker Duty Sessions Table
CREATE TABLE IF NOT EXISTS fw_duty_sessions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fw_user_id           uuid NOT NULL REFERENCES users(id),
  start_time           timestamptz NOT NULL DEFAULT now(),
  end_time             timestamptz,
  status               text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE','EXPIRED')),
  last_known_latitude  numeric(9, 6),
  last_known_longitude numeric(9, 6),
  last_location_update timestamptz,
  location_accuracy    numeric(8, 2),
  device_status        text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_fw_duty_user_status ON fw_duty_sessions(fw_user_id, status);
CREATE INDEX IF NOT EXISTS ix_fw_duty_active ON fw_duty_sessions(status, last_location_update DESC);

-- 3. Field Worker Location Breadcrumbs / Updates History Table
CREATE TABLE IF NOT EXISTS fw_locations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  duty_session_id uuid NOT NULL REFERENCES fw_duty_sessions(id) ON DELETE CASCADE,
  fw_user_id      uuid NOT NULL REFERENCES users(id),
  latitude        numeric(9, 6) NOT NULL,
  longitude       numeric(9, 6) NOT NULL,
  accuracy        numeric(8, 2),
  source          text DEFAULT 'GPS',
  recorded_at     timestamptz NOT NULL DEFAULT now(),
  received_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_fw_loc_session ON fw_locations(duty_session_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS ix_fw_loc_user ON fw_locations(fw_user_id, recorded_at DESC);

-- 4. Complaint Assignment Groups Table
CREATE TABLE IF NOT EXISTS complaint_assignment_groups (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_code         text NOT NULL UNIQUE,
  district_id        uuid NOT NULL REFERENCES districts(id),
  taluka_id          uuid REFERENCES talukas(id),
  status             text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','RECOMMENDATION_READY','ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED')),
  priority           text NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('URGENT','HIGH','NORMAL')),
  assigned_fw_id     uuid REFERENCES users(id),
  assigned_by        uuid REFERENCES users(id),
  assigned_at        timestamptz,
  accepted_at        timestamptz,
  completed_at       timestamptz,
  assignment_reason  text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_cag_dist_status ON complaint_assignment_groups(district_id, status);
CREATE INDEX IF NOT EXISTS ix_cag_fw ON complaint_assignment_groups(assigned_fw_id, status);

-- 5. Complaint Group Items (Linking Complaints/Reports to Group)
CREATE TABLE IF NOT EXISTS complaint_group_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id       uuid NOT NULL REFERENCES complaint_assignment_groups(id) ON DELETE CASCADE,
  complaint_id   uuid NOT NULL,
  complaint_type text NOT NULL DEFAULT 'HELP_REQUEST' CHECK (complaint_type IN ('HELP_REQUEST','DISEASE_REPORT')),
  village_id     uuid NOT NULL REFERENCES villages(id),
  status         text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','VISITING','RESOLVED','CANCELLED')),
  outcome_note   text,
  visited_at     timestamptz
);

CREATE INDEX IF NOT EXISTS ix_cgi_group ON complaint_group_items(group_id);
CREATE INDEX IF NOT EXISTS ix_cgi_complaint ON complaint_group_items(complaint_id);

-- 6. Assignment History & Audit Trail Table
CREATE TABLE IF NOT EXISTS fw_assignment_history (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id       uuid NOT NULL REFERENCES complaint_assignment_groups(id) ON DELETE CASCADE,
  previous_fw_id uuid REFERENCES users(id),
  new_fw_id      uuid REFERENCES users(id),
  changed_by     uuid NOT NULL REFERENCES users(id),
  action         text NOT NULL CHECK (action IN ('ASSIGNED','REASSIGNED','ACCEPTED','REJECTED','STATUS_CHANGE','CANCELLED')),
  reason         text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_fah_group ON fw_assignment_history(group_id, created_at DESC);

