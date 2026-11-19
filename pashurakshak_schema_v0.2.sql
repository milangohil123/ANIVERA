-- PashuRakshak Botad — schema v0.2 (PostgreSQL 16). Extracted from BACKENDDATABASESCHEMA.md §4–§5.
-- Run in pgAdmin 4 Query Tool connected to database pashurakshak_db as a superuser (extensions need it).
-- Order matters. Review before use. NOT an Alembic migration (see schema doc §12).

CREATE EXTENSION IF NOT EXISTS citext;       -- case-insensitive usernames
CREATE EXTENSION IF NOT EXISTS btree_gist;   -- exclusion constraint on schedule validity ranges
-- CREATE EXTENSION IF NOT EXISTS postgis;   -- ONLY if polygons/spatial queries are adopted (TRD §15)

CREATE SEQUENCE animal_code_seq START 1;
CREATE SEQUENCE farmer_code_seq START 1;
CREATE SEQUENCE flock_code_seq START 1;
CREATE SEQUENCE camp_code_seq START 1;
CREATE SEQUENCE report_no_seq START 1;
CREATE SEQUENCE help_request_ref_seq START 1;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;


CREATE TABLE talukas (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code      text NOT NULL UNIQUE,
  name_gu   text NOT NULL,
  name_en   text NOT NULL
);

CREATE TABLE villages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE,                 -- e.g. BTD-BV (internal code) [DEMO]
  taluka_id     uuid NOT NULL REFERENCES talukas(id),
  name_gu       text NOT NULL,
  name_en       text NOT NULL,
  census_code   text,                                 -- optional official code, if supplied
  latitude      numeric(9,6),
  longitude     numeric(9,6),
  coord_status  text NOT NULL DEFAULT 'UNAVAILABLE'
                CHECK (coord_status IN ('VERIFIED','UNVERIFIED','UNAVAILABLE')),
  coord_source_id uuid,                               -- FK added after geodata_imports
  is_pilot      boolean NOT NULL DEFAULT false,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK ((latitude IS NULL) = (longitude IS NULL)),
  CHECK (coord_status = 'UNAVAILABLE' OR latitude IS NOT NULL),   -- no invented coordinates
  CHECK (latitude  IS NULL OR latitude  BETWEEN -90  AND 90),
  CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);
CREATE TRIGGER trg_villages_updated BEFORE UPDATE ON villages FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE geodata_imports (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name      text NOT NULL,
  source_reference text NOT NULL,          -- URL/document/authorisation reference
  dataset_version  text,
  verified         boolean NOT NULL DEFAULT false,
  verified_by_name text,
  imported_by      uuid NOT NULL,          -- FK users added below
  imported_at      timestamptz NOT NULL DEFAULT now(),
  rows_applied     integer NOT NULL DEFAULT 0,
  notes            text,
  CHECK (NOT verified OR verified_by_name IS NOT NULL)
);
ALTER TABLE villages ADD CONSTRAINT fk_villages_coord_source
  FOREIGN KEY (coord_source_id) REFERENCES geodata_imports(id);

CREATE TABLE species (
  code    text PRIMARY KEY CHECK (code IN ('CATTLE','BUFFALO','GOAT','SHEEP')),
  name_gu text NOT NULL,
  name_en text NOT NULL
);

CREATE TABLE breeds (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  species_code text NOT NULL REFERENCES species(code),
  name_gu      text NOT NULL,
  name_en      text NOT NULL,
  UNIQUE (species_code, name_en)
);

CREATE TABLE programmes (            -- vaccination-programme categories; applicability is configuration
  code    text PRIMARY KEY CHECK (code IN ('FMD','HS','BQ','BRUCELLOSIS','PPR')),
  name_en text NOT NULL,
  name_gu text,                       -- Department terminology to be supplied
  active  boolean NOT NULL DEFAULT true
);


CREATE TABLE users (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role                 text NOT NULL CHECK (role IN
                       ('VET_OFFICER','FIELD_WORKER','FARMER','DAIRY_STAFF','DAHO','GRAM_PANCHAYAT','SYS_ADMIN')),
  full_name            text NOT NULL,
  username             citext UNIQUE,                    -- staff
  password_hash        text,                             -- Argon2id (staff)
  mobile_e164          text UNIQUE CHECK (mobile_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  designation          text,
  organisation         text,                             -- e.g. cooperative / panchayat name
  status               text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE','LOCKED')),
  must_change_password boolean NOT NULL DEFAULT true,
  failed_attempts      integer NOT NULL DEFAULT 0,
  locked_until         timestamptz,
  last_login_at        timestamptz,
  deactivated_at       timestamptz,
  deactivated_reason   text,
  created_by           uuid REFERENCES users(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CHECK ( (role = 'FARMER' AND mobile_e164 IS NOT NULL)
       OR (role <> 'FARMER' AND username IS NOT NULL AND password_hash IS NOT NULL) ),
  CHECK (status <> 'INACTIVE' OR deactivated_at IS NOT NULL)
);
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
ALTER TABLE geodata_imports ADD CONSTRAINT fk_geo_imported_by FOREIGN KEY (imported_by) REFERENCES users(id);

CREATE TABLE permissions (
  code        text PRIMARY KEY,
  description text NOT NULL
);
CREATE TABLE role_permissions (               -- default permission set per role (Department approves final matrix)
  role            text NOT NULL,
  permission_code text NOT NULL REFERENCES permissions(code),
  PRIMARY KEY (role, permission_code)
);
CREATE TABLE user_permission_grants (         -- explicit extra grants, e.g. 'disease.confirm'
  user_id         uuid NOT NULL REFERENCES users(id),
  permission_code text NOT NULL REFERENCES permissions(code),
  granted_by      uuid NOT NULL REFERENCES users(id),
  granted_at      timestamptz NOT NULL DEFAULT now(),
  revoked_at      timestamptz,
  PRIMARY KEY (user_id, permission_code, granted_at)
);

CREATE TABLE user_village_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id),
  village_id  uuid NOT NULL REFERENCES villages(id),
  assigned_by uuid NOT NULL REFERENCES users(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz
);
CREATE UNIQUE INDEX uq_user_village_active ON user_village_assignments(user_id, village_id) WHERE ended_at IS NULL;
CREATE INDEX ix_uva_user ON user_village_assignments(user_id) WHERE ended_at IS NULL;

CREATE TABLE devices (
  id                 uuid PRIMARY KEY,                     -- client-generated device ID
  user_id            uuid NOT NULL REFERENCES users(id),
  label              text,
  first_seen_at      timestamptz NOT NULL DEFAULT now(),
  last_seen_at       timestamptz,
  last_sync_at       timestamptz,
  pending_count_reported integer,                          -- from client; supports long-offline monitor
  status             text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','REVOKED')),
  revoked_at         timestamptz,
  revoked_reason     text
);
CREATE INDEX ix_devices_user ON devices(user_id);

CREATE TABLE refresh_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id),
  device_id    uuid REFERENCES devices(id),
  token_hash   text NOT NULL UNIQUE,                       -- hash only, never the token
  issued_at    timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  rotated_from uuid REFERENCES refresh_tokens(id),
  revoked_at   timestamptz
);
CREATE INDEX ix_refresh_user ON refresh_tokens(user_id) WHERE revoked_at IS NULL;

CREATE TABLE otp_challenges (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile_e164  text NOT NULL,
  code_hash    text NOT NULL,
  expires_at   timestamptz NOT NULL,
  attempts     integer NOT NULL DEFAULT 0,
  consumed_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  request_ip   inet
);
CREATE INDEX ix_otp_mobile_created ON otp_challenges(mobile_e164, created_at DESC);


CREATE TABLE farmers (                         -- livestock owner (farmer) profile; a farmer may have NO login account and NO phone
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),     -- may be client-generated for offline staff-assisted registration
  farmer_code          text UNIQUE,                                    -- internal farmer ID 'FRM-BOT-000123'; assigned when the registration is first submitted
  full_name            text NOT NULL,
  name_norm            text NOT NULL,                                  -- normalised for search / duplicate checks
  mobile_e164          text CHECK (mobile_e164 IS NULL OR mobile_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  mobile_status        text NOT NULL DEFAULT 'NONE' CHECK (mobile_status IN ('NONE','UNVERIFIED','VERIFIED_OTP','VERIFIED_STAFF')),
  mobile_shared        boolean NOT NULL DEFAULT false,                 -- family/shared number allowed, flagged
  has_smartphone       text NOT NULL DEFAULT 'UNKNOWN' CHECK (has_smartphone IN ('UNKNOWN','YES','NO')),
  village_id           uuid NOT NULL REFERENCES villages(id),
  address_text         text,
  registration_status  text NOT NULL DEFAULT 'DRAFT' CHECK (registration_status IN
                       ('DRAFT','SUBMITTED','PENDING_VERIFICATION','VERIFIED','REJECTED','INACTIVE')),
  registration_path    text NOT NULL CHECK (registration_path IN ('SELF','STAFF_ASSISTED','IMPORT','COOPERATIVE_ASSISTED')),
  registered_by        uuid REFERENCES users(id),                      -- staff member for assisted paths
  data_consent_at      timestamptz,                                    -- consent to register/process (self: ticked; assisted: staff records it)
  outreach_consent     text NOT NULL DEFAULT 'UNKNOWN' CHECK (outreach_consent IN ('UNKNOWN','GRANTED','WITHDRAWN')),
  consent_basis        text,                                           -- consent / lawful basis reference
  consent_recorded_by  uuid REFERENCES users(id),
  consent_recorded_at  timestamptz,
  verified_by          uuid REFERENCES users(id),
  verified_at          timestamptz,
  rejection_reason     text,
  inactive_reason      text,
  active               boolean NOT NULL DEFAULT true,
  row_version          integer NOT NULL DEFAULT 1,
  created_by           uuid NOT NULL REFERENCES users(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CHECK (outreach_consent = 'UNKNOWN' OR (consent_recorded_by IS NOT NULL AND consent_recorded_at IS NOT NULL)),
  CHECK (mobile_status = 'NONE' OR mobile_e164 IS NOT NULL),
  CHECK (registration_status = 'DRAFT' OR farmer_code IS NOT NULL),
  CHECK (registration_status = 'DRAFT' OR data_consent_at IS NOT NULL),
  CHECK (registration_status <> 'VERIFIED' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL)),
  CHECK (registration_status <> 'REJECTED' OR length(btrim(coalesce(rejection_reason,''))) > 0),
  CHECK (registration_status <> 'INACTIVE' OR length(btrim(coalesce(inactive_reason,''))) > 0)
);
-- mobile_e164 is intentionally NOT unique: shared numbers exist. Duplicate farmers are detected by name + village + mobile (see 7.4).
CREATE INDEX ix_farmers_village ON farmers(village_id);
CREATE INDEX ix_farmers_name_norm ON farmers(village_id, name_norm);
CREATE INDEX ix_farmers_mobile ON farmers(mobile_e164) WHERE mobile_e164 IS NOT NULL;
CREATE INDEX ix_farmers_status ON farmers(registration_status) WHERE registration_status IN ('SUBMITTED','PENDING_VERIFICATION');
CREATE TRIGGER trg_farmers_updated BEFORE UPDATE ON farmers FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION trg_farmers_assign_code() RETURNS trigger AS $$
BEGIN
  IF NEW.farmer_code IS NULL AND NEW.registration_status <> 'DRAFT' THEN
    NEW.farmer_code := 'FRM-BOT-' || lpad(nextval('farmer_code_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_farmers_code BEFORE INSERT OR UPDATE ON farmers FOR EACH ROW EXECUTE FUNCTION trg_farmers_assign_code();

CREATE TABLE farmer_verifications (            -- each verification attempt (approved verification process is a Department decision)
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id   uuid NOT NULL REFERENCES farmers(id),
  method      text NOT NULL CHECK (method IN ('OTP','STAFF_IN_PERSON','DEPARTMENT_APPROVED_METHOD')),
  outcome     text NOT NULL CHECK (outcome IN ('VERIFIED','REJECTED','MORE_INFO')),
  verified_by uuid REFERENCES users(id),         -- NULL only for automatic OTP step
  notes       text,
  at          timestamptz NOT NULL DEFAULT now(),
  CHECK (method = 'OTP' OR verified_by IS NOT NULL)
);
CREATE INDEX ix_fv_farmer ON farmer_verifications(farmer_id, at DESC);
-- No Aadhaar/government-ID numbers are stored unless the Department explicitly authorises it.

CREATE TABLE farmer_user_links (                -- farmer login account -> farmer profile(s); one phone may serve several profiles
  user_id   uuid NOT NULL REFERENCES users(id),
  farmer_id uuid NOT NULL REFERENCES farmers(id),
  linked_by uuid REFERENCES users(id),           -- NULL for self-registration; staff for assisted onboarding
  linked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, farmer_id)
);

CREATE TABLE animals (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),   -- technical primary key (may be client-generated for offline registration)
  animal_code         text UNIQUE,                                  -- INTERNAL ANIMAL ID shown on screens/labels ('ANM-BOT-000123'); assigned when REGISTERED/VERIFIED
  species_code        text NOT NULL REFERENCES species(code),
  breed_id            uuid REFERENCES breeds(id),
  sex                 text NOT NULL DEFAULT 'UNKNOWN' CHECK (sex IN ('F','M','UNKNOWN')),
  birth_date          date,
  age_months_estimate integer CHECK (age_months_estimate IS NULL OR age_months_estimate BETWEEN 0 AND 600),
  age_estimated_on    date,
  farmer_id           uuid NOT NULL REFERENCES farmers(id),
  village_id          uuid NOT NULL REFERENCES villages(id),
  registration_status text NOT NULL DEFAULT 'DRAFT' CHECK (registration_status IN
                      ('DRAFT','SUBMITTED','PENDING_VERIFICATION','REGISTERED','VERIFIED','REJECTED','NEEDS_REVIEW')),
  status              text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DECEASED','SOLD','MOVED_OUT','INACTIVE','MERGED')),
  status_changed_on   date,
  status_reason       text,
  merged_into_animal_id uuid REFERENCES animals(id),
  submission_source   text NOT NULL CHECK (submission_source IN ('FARMER_APP','FIELD_WORKER','VET_OFFICER','IMPORT','DRAFT_SYNC','REGISTRY_API')),
  submitted_by        uuid REFERENCES users(id),
  verified_by         uuid REFERENCES users(id),
  verified_at         timestamptz,
  rejection_reason    text,
  import_job_id       uuid,                                         -- FK added after import_jobs
  row_version         integer NOT NULL DEFAULT 1,
  created_by          uuid NOT NULL REFERENCES users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (registration_status NOT IN ('REGISTERED','VERIFIED') OR animal_code IS NOT NULL),
  CHECK (registration_status <> 'VERIFIED' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL)),
  CHECK (registration_status <> 'REJECTED' OR length(btrim(coalesce(rejection_reason,''))) > 0),
  CHECK ((status = 'MERGED') = (merged_into_animal_id IS NOT NULL)),
  CHECK (merged_into_animal_id IS NULL OR merged_into_animal_id <> id),
  CHECK (status = 'ACTIVE' OR length(btrim(coalesce(status_reason,''))) > 0)
);
-- REGISTERED = accepted on the server (staff-registered or imported), physical verification still pending; printable label allowed by policy.
-- VERIFIED   = physically verified by an authorised field worker / veterinary officer.
CREATE INDEX ix_animals_village ON animals(village_id) WHERE status = 'ACTIVE';
CREATE INDEX ix_animals_farmer  ON animals(farmer_id);
CREATE INDEX ix_animals_species_village ON animals(village_id, species_code);
CREATE INDEX ix_animals_reg_status ON animals(registration_status) WHERE registration_status NOT IN ('VERIFIED');
CREATE TRIGGER trg_animals_updated BEFORE UPDATE ON animals FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION trg_animals_assign_code() RETURNS trigger AS $$
BEGIN
  IF NEW.animal_code IS NULL AND NEW.registration_status IN ('REGISTERED','VERIFIED') THEN
    NEW.animal_code := 'ANM-BOT-' || lpad(nextval('animal_code_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_animals_code BEFORE INSERT OR UPDATE ON animals FOR EACH ROW EXECUTE FUNCTION trg_animals_assign_code();

CREATE TABLE animal_external_identifiers (      -- Bharat Pashudhan 12-digit tag and other ear tags; NEVER the internal ID
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id     uuid NOT NULL REFERENCES animals(id),
  id_type       text NOT NULL CHECK (id_type IN ('BHARAT_PASHUDHAN_12','OTHER_EAR_TAG')),
  id_value      text NOT NULL,
  status        text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','REPLACED','INVALID')),
  recorded_by   uuid NOT NULL REFERENCES users(id),
  recorded_at   timestamptz NOT NULL DEFAULT now(),
  replaced_at   timestamptz,
  replace_reason text,
  CHECK (id_type <> 'BHARAT_PASHUDHAN_12' OR id_value ~ '^[0-9]{12}$'),
  CHECK (status = 'ACTIVE' OR (replaced_at IS NOT NULL AND replace_reason IS NOT NULL))
);
CREATE UNIQUE INDEX uq_ext_id_active ON animal_external_identifiers(id_type, id_value) WHERE status = 'ACTIVE';  -- duplicate tag prevention
CREATE INDEX ix_ext_id_animal ON animal_external_identifiers(animal_id);
-- Values are only ever entered by staff/farmers or imported; the system NEVER generates or fabricates government tag numbers.

CREATE TABLE animal_verifications (             -- each verification attempt (field / office / import review)
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id      uuid NOT NULL REFERENCES animals(id),
  method         text NOT NULL CHECK (method IN ('FIELD_PHYSICAL','OFFICE_REVIEW','IMPORT_REVIEW')),
  outcome        text NOT NULL CHECK (outcome IN ('VERIFIED','REJECTED','MORE_INFO')),
  tag_checked    boolean NOT NULL DEFAULT false,
  owner_confirmed boolean NOT NULL DEFAULT false,
  verified_by    uuid NOT NULL REFERENCES users(id),
  notes          text,
  at             timestamptz NOT NULL DEFAULT now(),
  CHECK (outcome <> 'VERIFIED' OR method <> 'FIELD_PHYSICAL' OR owner_confirmed)
);
CREATE INDEX ix_av_animal ON animal_verifications(animal_id, at DESC);

CREATE TABLE flocks (                           -- OPTIONAL: goat/sheep flock registration. DISABLED until the Department decides (setting flock_registration_enabled)
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flock_code    text NOT NULL UNIQUE DEFAULT ('FLK-BOT-' || lpad(nextval('flock_code_seq')::text, 6, '0')),
  farmer_id     uuid NOT NULL REFERENCES farmers(id),
  village_id    uuid NOT NULL REFERENCES villages(id),
  species_code  text NOT NULL REFERENCES species(code),
  head_count    integer NOT NULL CHECK (head_count > 0),
  count_as_of   date NOT NULL,
  registration_status text NOT NULL DEFAULT 'SUBMITTED' CHECK (registration_status IN
                ('DRAFT','SUBMITTED','PENDING_VERIFICATION','REGISTERED','VERIFIED','REJECTED','NEEDS_REVIEW')),
  status        text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  verified_by   uuid REFERENCES users(id),
  verified_at   timestamptz,
  notes         text,
  created_by    uuid NOT NULL REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (registration_status <> 'VERIFIED' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL))
);
CREATE INDEX ix_flocks_village ON flocks(village_id) WHERE status = 'ACTIVE';
CREATE INDEX ix_flocks_farmer ON flocks(farmer_id);

CREATE TABLE animal_qr_tokens (
  token          text PRIMARY KEY CHECK (token ~ '^[A-Z2-7]{26}$'),     -- Base32 of 16 random bytes
  animal_id      uuid NOT NULL REFERENCES animals(id),
  status         text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','REVOKED')),
  issued_by      uuid NOT NULL REFERENCES users(id),
  issued_at      timestamptz NOT NULL DEFAULT now(),
  revoked_at     timestamptz,
  revoked_reason text,
  CHECK (status = 'ACTIVE' OR (revoked_at IS NOT NULL AND revoked_reason IS NOT NULL))
);
CREATE UNIQUE INDEX uq_one_active_token_per_animal ON animal_qr_tokens(animal_id) WHERE status = 'ACTIVE';

CREATE TABLE animal_ownership_history (        -- history of owner/village changes (current values live on animals)
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id     uuid NOT NULL REFERENCES animals(id),
  farmer_id      uuid NOT NULL REFERENCES farmers(id),
  village_id    uuid NOT NULL REFERENCES villages(id),
  valid_from    date NOT NULL,
  valid_to      date,
  change_reason text NOT NULL,
  changed_by    uuid NOT NULL REFERENCES users(id),
  recorded_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_to IS NULL OR valid_to >= valid_from)
);
CREATE INDEX ix_aoh_animal ON animal_ownership_history(animal_id, valid_from DESC);

CREATE TABLE ownership_transfers (            -- workflow for ownership / village change; history is kept in animal_ownership_history
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id        uuid NOT NULL REFERENCES animals(id),
  from_farmer_id   uuid NOT NULL REFERENCES farmers(id),
  to_farmer_id     uuid NOT NULL REFERENCES farmers(id),
  to_village_id    uuid NOT NULL REFERENCES villages(id),
  reason           text NOT NULL CHECK (reason IN ('SALE','GIFT','INHERITANCE','DATA_CORRECTION','MOVED_VILLAGE','OTHER')),
  reason_note      text,
  status           text NOT NULL DEFAULT 'REQUESTED' CHECK (status IN
                   ('REQUESTED','PENDING_VERIFICATION','APPROVED','COMPLETED','REJECTED','DISPUTED','CANCELLED')),
  requested_by     uuid NOT NULL REFERENCES users(id),
  requested_at     timestamptz NOT NULL DEFAULT now(),
  verified_by      uuid REFERENCES users(id),
  verified_at      timestamptz,
  decided_by       uuid REFERENCES users(id),
  decided_at       timestamptz,
  decision_note    text,
  effective_date   date,
  CHECK (status NOT IN ('APPROVED','COMPLETED') OR (decided_by IS NOT NULL AND decided_at IS NOT NULL AND effective_date IS NOT NULL)),
  CHECK (status NOT IN ('REJECTED','DISPUTED') OR length(btrim(coalesce(decision_note,''))) > 0)
);
CREATE UNIQUE INDEX uq_open_transfer ON ownership_transfers(animal_id)
  WHERE status IN ('REQUESTED','PENDING_VERIFICATION','APPROVED','DISPUTED');   -- one open transfer per animal

CREATE TABLE animal_merge_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_animal_id uuid NOT NULL REFERENCES animals(id),
  into_animal_id uuid NOT NULL REFERENCES animals(id),
  reason         text NOT NULL,
  merged_by      uuid NOT NULL REFERENCES users(id),
  merged_at      timestamptz NOT NULL DEFAULT now(),
  snapshot       jsonb NOT NULL                   -- pre-merge state of both animals
);


CREATE TABLE animal_events (
  event_id          uuid PRIMARY KEY,                       -- client-generated; idempotency key
  server_seq        bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  animal_id         uuid REFERENCES animals(id),            -- exactly one of animal_id / flock_id
  flock_id          uuid REFERENCES flocks(id),             -- only when flock registration is enabled by the Department
  village_id        uuid NOT NULL REFERENCES villages(id),  -- village at time of event
  event_type        text NOT NULL CHECK (event_type IN ('VACCINATION','TREATMENT','OBSERVATION')),
  event_date        date NOT NULL,
  performed_by      uuid NOT NULL REFERENCES users(id),     -- WHO RECORDED it (BR-VACCINE-003)
  device_id         uuid REFERENCES devices(id),
  client_created_at timestamptz,
  received_at       timestamptz NOT NULL DEFAULT now(),     -- when recorded centrally
  source            text NOT NULL CHECK (source IN ('ONLINE','SYNC','IMPORT')),
  schema_version    integer NOT NULL DEFAULT 1,
  remarks           text,
  review_status     text NOT NULL DEFAULT 'NONE' CHECK (review_status IN ('NONE','REVIEWED','FLAGGED')),  -- optional officer review/audit
  review_note       text,
  reviewed_by       uuid REFERENCES users(id),
  reviewed_at       timestamptz,
  CHECK (num_nonnulls(animal_id, flock_id) = 1),
  CHECK (review_status = 'NONE' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE INDEX ix_events_animal_date ON animal_events(animal_id, event_date DESC) WHERE animal_id IS NOT NULL;
CREATE INDEX ix_events_flock_date ON animal_events(flock_id, event_date DESC) WHERE flock_id IS NOT NULL;
CREATE INDEX ix_events_village_type_date ON animal_events(village_id, event_type, event_date DESC);
CREATE INDEX ix_events_performer ON animal_events(performed_by, received_at DESC);
CREATE INDEX ix_events_flagged ON animal_events(review_status) WHERE review_status = 'FLAGGED';

CREATE TABLE vaccination_details (
  event_id       uuid PRIMARY KEY REFERENCES animal_events(event_id),
  programme_code text NOT NULL REFERENCES programmes(code),
  batch_number   text,                                   -- OPTIONAL (approved decision)
  dose_note      text,                                   -- free text as recorded; no dose logic in the system
  campaign_id    uuid,                                   -- FK added after campaigns
  camp_id        uuid,                                   -- FK added after camps
  administered_by_user_id uuid REFERENCES users(id),     -- person who actually vaccinated (may equal recorder)
  administered_by_name    text,                          -- vaccinator without an app account (recorded by an authorised user)
  vaccinator_authorization_id uuid,                      -- FK added after vaccinator_authorizations
  authorization_check text NOT NULL DEFAULT 'NOT_CHECKED' CHECK (authorization_check IN ('AUTHORIZED','NOT_CHECKED','UNAUTHORIZED_FLAGGED')),
  head_count_vaccinated integer CHECK (head_count_vaccinated IS NULL OR head_count_vaccinated > 0),   -- flock events only
  CHECK (administered_by_user_id IS NOT NULL OR administered_by_name IS NOT NULL)
);
CREATE INDEX ix_vacc_programme ON vaccination_details(programme_code);
CREATE INDEX ix_vacc_campaign ON vaccination_details(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX ix_vacc_camp ON vaccination_details(camp_id) WHERE camp_id IS NOT NULL;

CREATE TABLE treatment_details (
  event_id       uuid PRIMARY KEY REFERENCES animal_events(event_id),
  diagnosis_text text,
  treatment_text text NOT NULL,
  medicine_text  text,
  follow_up_date date
);

CREATE TABLE observation_details (
  event_id    uuid PRIMARY KEY REFERENCES animal_events(event_id),
  symptoms    text[] NOT NULL DEFAULT '{}',
  notes       text
);

CREATE TABLE event_corrections (                           -- corrections never overwrite originals
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_event_id    uuid NOT NULL UNIQUE REFERENCES animal_events(event_id),
  action               text NOT NULL CHECK (action IN ('AMEND','VOID')),
  replacement_event_id uuid UNIQUE REFERENCES animal_events(event_id),
  reason               text NOT NULL CHECK (length(btrim(reason)) > 0),
  corrected_by         uuid NOT NULL REFERENCES users(id),
  corrected_at         timestamptz NOT NULL DEFAULT now(),
  CHECK ((action = 'AMEND' AND replacement_event_id IS NOT NULL)
      OR (action = 'VOID'  AND replacement_event_id IS NULL))
);

-- Immutability of event facts (review columns may change)
CREATE OR REPLACE FUNCTION trg_events_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'animal_events rows cannot be deleted'; END IF;
  IF (NEW.event_id, NEW.animal_id, NEW.village_id, NEW.event_type, NEW.event_date, NEW.performed_by, NEW.received_at, NEW.remarks)
     IS DISTINCT FROM
     (OLD.event_id, OLD.animal_id, OLD.village_id, OLD.event_type, OLD.event_date, OLD.performed_by, OLD.received_at, OLD.remarks)
  THEN RAISE EXCEPTION 'animal_events facts are immutable; use event_corrections'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_animal_events_immutable BEFORE UPDATE OR DELETE ON animal_events
  FOR EACH ROW EXECUTE FUNCTION trg_events_immutable();
-- Same protection should be applied to vaccination_details, treatment_details, observation_details.

-- Defensive date guard (services enforce the strict rule; this is the database safety net)
CREATE OR REPLACE FUNCTION trg_event_date_guard() RETURNS trigger AS $$
DECLARE b date;
BEGIN
  IF NEW.event_date > CURRENT_DATE + 1 THEN        -- +1 day tolerance for time-zone edge
    RAISE EXCEPTION 'event_date in the future' USING ERRCODE = '23514';
  END IF;
  IF NEW.animal_id IS NOT NULL THEN
    SELECT birth_date INTO b FROM animals WHERE id = NEW.animal_id;
    IF b IS NOT NULL AND NEW.event_date < b THEN
      RAISE EXCEPTION 'event_date before birth_date' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_animal_events_date BEFORE INSERT ON animal_events FOR EACH ROW EXECUTE FUNCTION trg_event_date_guard();

-- Current (effective) events = not corrected-away
CREATE VIEW v_current_events AS
SELECT e.*
FROM animal_events e
WHERE NOT EXISTS (SELECT 1 FROM event_corrections c WHERE c.original_event_id = e.event_id);


CREATE TABLE schedule_versions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL,
  status             text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','APPROVED','RETIRED')),
  approved_by_name   text,                        -- Department authority (name/designation)
  approval_reference text,                        -- order/letter reference supplied by Department
  approved_at        timestamptz,
  effective_from     date,
  effective_to       date,
  created_by         uuid NOT NULL REFERENCES users(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'APPROVED' OR (approved_by_name IS NOT NULL AND approval_reference IS NOT NULL
                                  AND approved_at IS NOT NULL AND effective_from IS NOT NULL)),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
ALTER TABLE schedule_versions ADD CONSTRAINT excl_approved_overlap
  EXCLUDE USING gist (daterange(effective_from, COALESCE(effective_to,'infinity'::date), '[]') WITH &&)
  WHERE (status = 'APPROVED');

CREATE TABLE schedule_rules (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_version_id uuid NOT NULL REFERENCES schedule_versions(id),
  species_code        text NOT NULL REFERENCES species(code),
  programme_code      text NOT NULL REFERENCES programmes(code),
  applicability       text NOT NULL DEFAULT 'UNCONFIGURED' CHECK (applicability IN ('UNCONFIGURED','APPLICABLE','NOT_APPLICABLE')),
  sex_filter          text CHECK (sex_filter IS NULL OR sex_filter IN ('F','M')),
  min_age_days        integer CHECK (min_age_days IS NULL OR min_age_days >= 0),   -- ALL parameters are NULL until approved
  first_due_age_days  integer CHECK (first_due_age_days IS NULL OR first_due_age_days >= 0),
  repeat_interval_days integer CHECK (repeat_interval_days IS NULL OR repeat_interval_days > 0),
  grace_days          integer CHECK (grace_days IS NULL OR grace_days >= 0),
  notes               text,
  UNIQUE (schedule_version_id, species_code, programme_code, sex_filter)
);
CREATE INDEX ix_rules_version ON schedule_rules(schedule_version_id, species_code, programme_code);


CREATE TABLE cooperatives (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code       text NOT NULL UNIQUE,
  name_gu    text NOT NULL,
  name_en    text NOT NULL,
  org_type   text NOT NULL DEFAULT 'DAIRY_COOPERATIVE' CHECK (org_type IN ('DAIRY_COOPERATIVE','MILK_UNION','OTHER')),
  status     text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cooperative_villages (             -- villages a cooperative serves; scopes its aggregate view
  cooperative_id uuid NOT NULL REFERENCES cooperatives(id),
  village_id     uuid NOT NULL REFERENCES villages(id),
  PRIMARY KEY (cooperative_id, village_id)
);
CREATE TABLE cooperative_staff_assignments (    -- cooperative authority is ASSIGNED, never implied by role DAIRY_STAFF
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id uuid NOT NULL REFERENCES cooperatives(id),
  user_id        uuid NOT NULL REFERENCES users(id),
  coop_role      text NOT NULL CHECK (coop_role IN ('COORDINATOR','ADMIN','VACCINATOR')),   -- VACCINATOR only if confirmed + authorised below
  assigned_by    uuid NOT NULL REFERENCES users(id),
  assigned_at    timestamptz NOT NULL DEFAULT now(),
  ended_at       timestamptz
);
CREATE UNIQUE INDEX uq_coop_staff_active ON cooperative_staff_assignments(cooperative_id, user_id, coop_role) WHERE ended_at IS NULL;
CREATE TABLE cooperative_memberships (          -- OPTIONAL; feature flag coop_membership_enabled (default off). Does NOT grant cooperative access to individual data.
  cooperative_id uuid NOT NULL REFERENCES cooperatives(id),
  farmer_id      uuid NOT NULL REFERENCES farmers(id),
  member_no      text,
  joined_on      date,
  ended_on       date,
  recorded_by    uuid NOT NULL REFERENCES users(id),
  PRIMARY KEY (cooperative_id, farmer_id)
);
CREATE TABLE vaccinator_authorizations (        -- who may ADMINISTER/CERTIFY vaccination; reference supplied by the Department
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES users(id),
  authority_type     text NOT NULL CHECK (authority_type IN ('VETERINARY_OFFICER','GOVERNMENT_FIELD_WORKER','COOPERATIVE_VACCINATOR','OTHER_APPROVED')),
  status             text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','SUSPENDED','EXPIRED','REVOKED')),
  authorization_reference text,
  authorized_by_name text,
  species_scope      text[],                      -- NULL = as per the referenced authorisation
  programme_scope    text[],
  valid_from         date,
  valid_to           date,
  requested_by       uuid NOT NULL REFERENCES users(id),
  approved_by        uuid REFERENCES users(id),
  approved_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from),
  CHECK (status <> 'APPROVED' OR (authorization_reference IS NOT NULL AND approved_by IS NOT NULL AND approved_at IS NOT NULL AND valid_from IS NOT NULL))
);
CREATE INDEX ix_vauth_user ON vaccinator_authorizations(user_id, status);


CREATE TABLE campaigns (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                text NOT NULL UNIQUE,
  name                text NOT NULL,
  status              text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','CLOSED','CANCELLED')),
  schedule_version_id uuid REFERENCES schedule_versions(id),
  start_date          date,
  end_date            date,
  created_by          uuid NOT NULL REFERENCES users(id),     -- System Administrator only (service-enforced)
  created_at          timestamptz NOT NULL DEFAULT now(),
  activated_by        uuid REFERENCES users(id),
  activated_at        timestamptz,
  CHECK (status <> 'ACTIVE' OR (schedule_version_id IS NOT NULL AND start_date IS NOT NULL AND activated_by IS NOT NULL)),
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE TABLE campaign_programmes (
  campaign_id    uuid NOT NULL REFERENCES campaigns(id),
  species_code   text NOT NULL REFERENCES species(code),
  programme_code text NOT NULL REFERENCES programmes(code),
  PRIMARY KEY (campaign_id, species_code, programme_code)
);
CREATE TABLE campaign_villages (
  campaign_id uuid NOT NULL REFERENCES campaigns(id),
  village_id  uuid NOT NULL REFERENCES villages(id),
  PRIMARY KEY (campaign_id, village_id)
);
CREATE TABLE campaign_assignments (            -- Vet Officer assigns field workers in authorised villages; Admin may also assign
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id    uuid NOT NULL,
  village_id     uuid NOT NULL,
  worker_user_id uuid NOT NULL REFERENCES users(id),
  assigned_by    uuid NOT NULL REFERENCES users(id),
  assigned_at    timestamptz NOT NULL DEFAULT now(),
  ended_at       timestamptz,
  FOREIGN KEY (campaign_id, village_id) REFERENCES campaign_villages(campaign_id, village_id)
);
CREATE UNIQUE INDEX uq_campaign_assignment_active
  ON campaign_assignments(campaign_id, village_id, worker_user_id) WHERE ended_at IS NULL;

-- Eligibility snapshot at campaign start: a justified, controlled exception to "no derived storage"
-- (eligibility changes over time; coverage denominators must be reproducible for the campaign).
CREATE TABLE campaign_animal_targets (
  campaign_id    uuid NOT NULL REFERENCES campaigns(id),
  animal_id      uuid NOT NULL REFERENCES animals(id),
  programme_code text NOT NULL REFERENCES programmes(code),
  snapshot_at    timestamptz NOT NULL DEFAULT now(),
  excluded       boolean NOT NULL DEFAULT false,
  exclusion_reason text,
  PRIMARY KEY (campaign_id, animal_id, programme_code),
  CHECK (NOT excluded OR exclusion_reason IS NOT NULL)
);
CREATE INDEX ix_cat_animal ON campaign_animal_targets(animal_id);

CREATE TABLE camps (                            -- a vaccination camp / doorstep round inside a campaign
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_code         text NOT NULL UNIQUE DEFAULT ('CMP-BOT-' || lpad(nextval('camp_code_seq')::text, 5, '0')),
  campaign_id       uuid NOT NULL REFERENCES campaigns(id),
  village_id        uuid NOT NULL REFERENCES villages(id),
  organizer_type    text NOT NULL CHECK (organizer_type IN ('GOVERNMENT','COOPERATIVE','JOINT','DOORSTEP')),
  cooperative_id    uuid REFERENCES cooperatives(id),
  planned_start     timestamptz NOT NULL,
  planned_end       timestamptz NOT NULL,
  location_text     text,
  status            text NOT NULL DEFAULT 'PROPOSED' CHECK (status IN ('PROPOSED','CONFIRMED','RESCHEDULED','CANCELLED','COMPLETED')),
  vaccine_availability text NOT NULL DEFAULT 'UNKNOWN' CHECK (vaccine_availability IN ('UNKNOWN','AVAILABLE','UNAVAILABLE')),
  vaccine_note      text,
  expected_farmers  integer CHECK (expected_farmers IS NULL OR expected_farmers >= 0),
  proposed_by       uuid NOT NULL REFERENCES users(id),
  confirmed_by      uuid REFERENCES users(id),     -- Veterinary Officer (authorised village)
  confirmed_at      timestamptz,
  cancelled_reason  text,
  rescheduled_from  uuid REFERENCES camps(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (campaign_id, village_id) REFERENCES campaign_villages(campaign_id, village_id),
  CHECK (planned_end > planned_start),
  CHECK (organizer_type NOT IN ('COOPERATIVE','JOINT') OR cooperative_id IS NOT NULL),
  CHECK (status <> 'CONFIRMED' OR (confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL)),
  CHECK (status <> 'CANCELLED' OR length(btrim(coalesce(cancelled_reason,''))) > 0)
);
CREATE INDEX ix_camps_village_time ON camps(village_id, planned_start);
CREATE INDEX ix_camps_coop ON camps(cooperative_id, status) WHERE cooperative_id IS NOT NULL;
-- No two CONFIRMED camps may overlap in one village (needs btree_gist; included with standard PostgreSQL 16 installers):
ALTER TABLE camps ADD CONSTRAINT excl_camp_overlap
  EXCLUDE USING gist (village_id WITH =, tstzrange(planned_start, planned_end) WITH &&) WHERE (status = 'CONFIRMED');

CREATE TABLE camp_staff (                       -- who is expected at the camp (assignment is NOT authorisation to vaccinate)
  camp_id     uuid NOT NULL REFERENCES camps(id),
  user_id     uuid NOT NULL REFERENCES users(id),
  camp_role   text NOT NULL CHECK (camp_role IN ('VETERINARY_OFFICER','FIELD_WORKER','VACCINATOR','COOPERATIVE_COORDINATOR')),
  assigned_by uuid NOT NULL REFERENCES users(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz,
  PRIMARY KEY (camp_id, user_id, camp_role)
);

ALTER TABLE vaccination_details ADD CONSTRAINT fk_vd_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id);
ALTER TABLE vaccination_details ADD CONSTRAINT fk_vd_camp FOREIGN KEY (camp_id) REFERENCES camps(id);
ALTER TABLE vaccination_details ADD CONSTRAINT fk_vd_vauth FOREIGN KEY (vaccinator_authorization_id) REFERENCES vaccinator_authorizations(id);


CREATE TABLE reminder_templates (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code      text NOT NULL,
  channel   text NOT NULL CHECK (channel IN ('SMS','IN_APP')),
  language  text NOT NULL DEFAULT 'gu' CHECK (language IN ('gu','en')),
  body      text NOT NULL,                       -- placeholders: {owner_name} {species} {tag_last4} {programme} {due_date}
  status    text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','APPROVED','RETIRED')),
  version   integer NOT NULL DEFAULT 1,
  UNIQUE (code, channel, language, version)
);

CREATE TABLE reminders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id           uuid NOT NULL REFERENCES animals(id),
  farmer_id            uuid NOT NULL REFERENCES farmers(id),
  programme_code      text NOT NULL REFERENCES programmes(code),
  due_date            date NOT NULL,
  schedule_version_id uuid NOT NULL REFERENCES schedule_versions(id),
  channel             text NOT NULL CHECK (channel IN ('SMS','IN_APP')),
  dedupe_key          text NOT NULL UNIQUE,      -- owner|animal|programme|due_date|channel
  status              text NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN
                      ('SCHEDULED','QUEUED','SENT','DELIVERED','FAILED','SIMULATED','CANCELLED_OBSOLETE','SKIPPED_NO_CONSENT','SKIPPED_NO_PHONE')),
  scheduled_for       timestamptz NOT NULL,
  cancelled_reason    text,
  template_id         uuid REFERENCES reminder_templates(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_reminders_status_sched ON reminders(status, scheduled_for);
CREATE INDEX ix_reminders_animal ON reminders(animal_id);

CREATE TABLE reminder_delivery_attempts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id         uuid NOT NULL REFERENCES reminders(id),
  attempt_no          integer NOT NULL,
  provider            text NOT NULL,             -- 'simulated' until an approved provider exists
  provider_message_id text,
  status              text NOT NULL CHECK (status IN ('QUEUED','SENT','DELIVERED','FAILED','SIMULATED')),
  provider_status_raw text,
  error_code          text,
  attempted_at        timestamptz NOT NULL DEFAULT now(),
  delivered_at        timestamptz,
  evidence            jsonb,                      -- provider delivery report; required for DELIVERED
  UNIQUE (reminder_id, attempt_no),
  CHECK (status <> 'DELIVERED' OR (delivered_at IS NOT NULL AND evidence IS NOT NULL AND provider <> 'simulated'))
);

CREATE TABLE follow_up_tasks (                    -- assisted follow-up lists (calls/visits by staff)
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind         text NOT NULL CHECK (kind IN ('CALL','VILLAGE_VISIT')),
  reason       text NOT NULL CHECK (reason IN ('OVERDUE','DUE','NO_PHONE','SMS_FAILED','HELP_REQUEST','OTHER')),
  animal_id    uuid REFERENCES animals(id),
  farmer_id     uuid REFERENCES farmers(id),
  village_id   uuid NOT NULL REFERENCES villages(id),
  assigned_to  uuid REFERENCES users(id),
  due_by       date,
  status       text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','DONE','CANCELLED')),
  outcome_note text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  closed_at    timestamptz
);
CREATE INDEX ix_followup_assignee ON follow_up_tasks(assigned_to, status);


CREATE TABLE help_requests (
  id                 uuid PRIMARY KEY,                       -- client event id when created offline
  reference_no       text NOT NULL UNIQUE
                     DEFAULT ('HR-BOT-' || to_char(now(),'YYYY') || '-' || lpad(nextval('help_request_ref_seq')::text,6,'0')),
  requester_name     text NOT NULL,
  contact_number     text,                                    -- may be missing / unverified
  contact_verified   boolean NOT NULL DEFAULT false,
  village_id         uuid NOT NULL REFERENCES villages(id),
  farmer_id           uuid REFERENCES farmers(id),
  animal_id          uuid REFERENCES animals(id),
  animal_description text,
  problem_text       text NOT NULL,
  source             text NOT NULL CHECK (source IN ('STAFF_ASSISTED','FARMER_APP')),
  registered_by      uuid REFERENCES users(id),               -- staff member (assisted) or farmer account
  status             text NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN
                     ('SUBMITTED','ASSIGNED','CONTACT_ATTEMPTED','VISIT_PLANNED','RESOLVED')),
  assigned_to        uuid REFERENCES users(id),
  visit_planned_for  date,
  outcome_text       text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  resolved_at        timestamptz,
  CHECK (status <> 'ASSIGNED' OR assigned_to IS NOT NULL),
  CHECK (status <> 'VISIT_PLANNED' OR visit_planned_for IS NOT NULL),
  CHECK (status <> 'RESOLVED' OR (outcome_text IS NOT NULL AND resolved_at IS NOT NULL))
);
CREATE INDEX ix_help_status_village ON help_requests(village_id, status);
CREATE INDEX ix_help_assignee ON help_requests(assigned_to, status);

CREATE TABLE help_request_attempts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    uuid NOT NULL REFERENCES help_requests(id),
  attempt_type  text NOT NULL CHECK (attempt_type IN ('CALL','VILLAGE_VISIT','OTHER')),   -- made by staff; no IVR/auto-dialling
  outcome       text NOT NULL,
  notes         text,
  attempted_by  uuid NOT NULL REFERENCES users(id),
  attempted_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_hra_request ON help_request_attempts(request_id, attempted_at);


CREATE TABLE disease_reports (
  report_id          uuid PRIMARY KEY,                       -- client event_id (idempotent) or server-generated for farmer app
  report_no          text UNIQUE DEFAULT ('DR-' || to_char(now(),'YYYY') || '-' || lpad(nextval('report_no_seq')::text, 6, '0')),
  animal_id          uuid REFERENCES animals(id),            -- optional: report may be filed without an animal ID
  flock_id           uuid REFERENCES flocks(id),
  farmer_id          uuid REFERENCES farmers(id),
  village_id         uuid NOT NULL REFERENCES villages(id),
  disease_code       text NOT NULL,                          -- suspected disease label code (programme code or OTHER/UNKNOWN); not a diagnosis
  report_source      text NOT NULL CHECK (report_source IN ('FIELD_WORKER','VET_OFFICER','FARMER_APP','FARMER_ASSISTED')),
  report_date        date NOT NULL,
  symptoms           text[] NOT NULL DEFAULT '{}',
  observation_text   text,
  latitude           numeric(9,6),
  longitude          numeric(9,6),
  location_accuracy_m integer,
  reported_by        uuid NOT NULL REFERENCES users(id),
  device_id          uuid REFERENCES devices(id),
  received_at        timestamptz NOT NULL DEFAULT now(),
  status             text NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN
                     ('SUBMITTED','UNDER_REVIEW','SUSPECTED','NEEDS_MORE_INFORMATION','CONFIRMED','NOT_CONFIRMED','INSUFFICIENT_INFORMATION')),
  duplicate_of       uuid REFERENCES disease_reports(report_id),
  conflict_flag      boolean NOT NULL DEFAULT false,         -- conflicting authorised veterinary assessments
  confirmed_by       uuid REFERENCES users(id),
  confirmed_at       timestamptz,
  confirmation_basis text,
  not_confirmed_reason text,
  row_version        integer NOT NULL DEFAULT 1,
  CHECK ((latitude IS NULL) = (longitude IS NULL)),
  CHECK (status <> 'CONFIRMED' OR (confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL
                                   AND length(btrim(coalesce(confirmation_basis,''))) > 0)),
  CHECK (status <> 'NOT_CONFIRMED' OR length(btrim(coalesce(not_confirmed_reason,''))) > 0),
  CHECK (duplicate_of IS NULL OR duplicate_of <> report_id),
  CHECK (animal_id IS NULL OR flock_id IS NULL)
);
CREATE INDEX ix_dr_village_date ON disease_reports(village_id, report_date DESC) WHERE duplicate_of IS NULL;
CREATE INDEX ix_dr_status ON disease_reports(status, report_date DESC);
CREATE INDEX ix_dr_animal ON disease_reports(animal_id) WHERE animal_id IS NOT NULL;
CREATE INDEX ix_dr_farmer ON disease_reports(farmer_id) WHERE farmer_id IS NOT NULL;

CREATE TABLE disease_report_attachments (       -- optional photo(s); report is valid without a photo
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   uuid NOT NULL REFERENCES disease_reports(report_id),
  file_path   text NOT NULL,
  sha256      text NOT NULL,
  mime_type   text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp')),
  size_bytes  integer NOT NULL CHECK (size_bytes > 0),
  uploaded_by uuid NOT NULL REFERENCES users(id),
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE disease_reviews (                  -- each review / investigation / examination step; several assessments can coexist
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id             uuid NOT NULL REFERENCES disease_reports(report_id),
  reviewer_id           uuid NOT NULL REFERENCES users(id),
  reviewer_role         text NOT NULL,
  review_type           text NOT NULL CHECK (review_type IN ('INITIAL_REVIEW','FIELD_INVESTIGATION','VETERINARY_EXAMINATION','SECOND_OPINION')),
  assessment            text NOT NULL CHECK (assessment IN ('SUSPECTED','NEEDS_MORE_INFORMATION','CONFIRMED','NOT_CONFIRMED','INSUFFICIENT_INFORMATION','NO_OPINION')),
  basis                 text,
  authorised_to_confirm boolean NOT NULL DEFAULT false,   -- true only if reviewer held disease.confirm at that time
  at                    timestamptz NOT NULL DEFAULT now(),
  CHECK (assessment NOT IN ('CONFIRMED','NOT_CONFIRMED') OR authorised_to_confirm)   -- only authorised reviewers can give a final assessment
);
CREATE INDEX ix_dreview_report ON disease_reviews(report_id, at);

CREATE TABLE disease_report_status_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   uuid NOT NULL REFERENCES disease_reports(report_id),
  from_status text,
  to_status   text NOT NULL,
  reason      text,
  changed_by  uuid NOT NULL REFERENCES users(id),
  changed_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE disease_alert_rules (           -- parameters entered by Department-authorised admins; none invented here
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL,
  disease_code       text NOT NULL,
  scope_level        text NOT NULL CHECK (scope_level IN ('VILLAGE','TALUKA','RADIUS')),
  radius_km          numeric(6,2),
  window_days        integer,
  min_distinct_animals integer,
  min_reports        integer,
  status             text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','APPROVED','RETIRED')),
  version            integer NOT NULL DEFAULT 1,
  approved_by_name   text,
  approval_reference text,
  created_by         uuid NOT NULL REFERENCES users(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'APPROVED' OR (window_days IS NOT NULL AND min_reports IS NOT NULL
                                  AND approved_by_name IS NOT NULL AND approval_reference IS NOT NULL)),
  CHECK (scope_level <> 'RADIUS' OR radius_km IS NOT NULL OR status = 'DRAFT')
);

CREATE TABLE disease_alerts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id            uuid NOT NULL REFERENCES disease_alert_rules(id),
  rule_version       integer NOT NULL,
  village_id         uuid NOT NULL REFERENCES villages(id),
  disease_code       text NOT NULL,
  status             text NOT NULL DEFAULT 'UNDER_REVIEW' CHECK (status IN
                     ('UNDER_REVIEW','UNDER_INVESTIGATION','CLOSED_FALSE_ALARM','CLOSED_RESOLVED','CONFIRMED_HIGH_PRIORITY')),
  raised_at          timestamptz NOT NULL DEFAULT now(),
  evaluation_snapshot jsonb NOT NULL,           -- counts AFTER duplicate exclusion, window, inputs
  assigned_to        uuid REFERENCES users(id),
  confirmed_by       uuid REFERENCES users(id), -- only users with disease.confirm
  confirmed_at       timestamptz,
  closed_at          timestamptz,
  closed_reason      text,
  CHECK (status <> 'CONFIRMED_HIGH_PRIORITY' OR (confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL)),
  CHECK (status NOT LIKE 'CLOSED%' OR (closed_at IS NOT NULL AND closed_reason IS NOT NULL))
);
-- never two open alerts for the same rule+village+disease
CREATE UNIQUE INDEX uq_open_alert ON disease_alerts(rule_id, village_id, disease_code)
  WHERE status IN ('UNDER_REVIEW','UNDER_INVESTIGATION');

CREATE TABLE alert_reports (
  alert_id  uuid NOT NULL REFERENCES disease_alerts(id),
  report_id uuid NOT NULL REFERENCES disease_reports(report_id),
  PRIMARY KEY (alert_id, report_id)
);

CREATE TABLE investigations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id    uuid NOT NULL REFERENCES disease_alerts(id),
  assigned_to uuid NOT NULL REFERENCES users(id),
  assigned_by uuid NOT NULL REFERENCES users(id),
  status      text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_PROGRESS','CLOSED')),
  opened_at   timestamptz NOT NULL DEFAULT now(),
  closed_at   timestamptz,
  summary     text
);
CREATE TABLE investigation_actions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id uuid NOT NULL REFERENCES investigations(id),
  action_type      text NOT NULL CHECK (action_type IN ('VERIFICATION','SAMPLE_COLLECTED','FOLLOW_UP','NOTE','CLOSURE')),
  notes            text,
  due_date         date,
  done_at          timestamptz,
  by_user          uuid NOT NULL REFERENCES users(id),
  at               timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE map_threshold_sets (              -- coverage targets + data-sufficiency/staleness windows: Department-approved
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL,
  status                text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','APPROVED','RETIRED')),
  coverage_green_min_pct numeric(5,2),
  coverage_yellow_min_pct numeric(5,2),
  coverage_stale_after_days integer,
  surveillance_stale_after_days integer,
  surveillance_min_reporting_villages_pct numeric(5,2),
  approved_by_name      text,
  approval_reference    text,
  effective_from        date,
  created_by            uuid NOT NULL REFERENCES users(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'APPROVED' OR (coverage_green_min_pct IS NOT NULL AND coverage_yellow_min_pct IS NOT NULL
         AND coverage_yellow_min_pct <= coverage_green_min_pct
         AND approved_by_name IS NOT NULL AND approval_reference IS NOT NULL))
);


CREATE TABLE import_jobs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name      text NOT NULL,                          -- original name kept for display only
  file_sha256    text NOT NULL,
  file_path      text NOT NULL,                          -- generated storage name
  size_bytes     bigint NOT NULL CHECK (size_bytes > 0),
  uploaded_by    uuid NOT NULL REFERENCES users(id),
  status         text NOT NULL DEFAULT 'UPLOADED' CHECK (status IN
                 ('UPLOADED','PARSING','AWAITING_MAPPING','VALIDATING','AWAITING_REVIEW','COMMITTING',
                  'COMPLETED','COMPLETED_WITH_ERRORS','FAILED','CANCELLED')),
  mapping        jsonb,
  total_rows     integer, created_count integer NOT NULL DEFAULT 0, updated_count integer NOT NULL DEFAULT 0,
  skipped_count  integer NOT NULL DEFAULT 0, rejected_count integer NOT NULL DEFAULT 0, review_count integer NOT NULL DEFAULT 0,
  last_committed_row integer NOT NULL DEFAULT 0,         -- resume point
  error_summary  text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  started_at     timestamptz,
  finished_at    timestamptz
);
CREATE INDEX ix_import_user ON import_jobs(uploaded_by, created_at DESC);
ALTER TABLE animals ADD CONSTRAINT fk_animals_import FOREIGN KEY (import_job_id) REFERENCES import_jobs(id);

CREATE TABLE import_rows (
  import_job_id uuid NOT NULL REFERENCES import_jobs(id),
  row_number    integer NOT NULL,
  row_hash      text NOT NULL,                           -- hash of normalised row; retry safety
  raw           jsonb NOT NULL,                          -- original values (formula-neutralised)
  normalised    jsonb,
  outcome       text NOT NULL CHECK (outcome IN ('VALID','WARNING','REVIEW','INVALID','SKIPPED_DUPLICATE','CREATED','UPDATED')),
  animal_id     uuid REFERENCES animals(id),
  errors        jsonb NOT NULL DEFAULT '[]',             -- [{field, code, message}]
  PRIMARY KEY (import_job_id, row_number)
);
CREATE INDEX ix_import_rows_hash ON import_rows(import_job_id, row_hash);
CREATE INDEX ix_import_rows_outcome ON import_rows(import_job_id, outcome);

CREATE TABLE label_batches (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by         uuid NOT NULL REFERENCES users(id),
  source_import_job_id uuid REFERENCES import_jobs(id),
  status               text NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','GENERATING','READY','FAILED','EXPIRED')),
  layout               jsonb NOT NULL,                   -- e.g. {"page":"A4","cols":3,"rows":8} (example)
  pdf_path             text,
  requested_count      integer NOT NULL,
  included_count       integer NOT NULL DEFAULT 0,
  excluded_count       integer NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now(),
  generated_at         timestamptz,
  expires_at           timestamptz
);
CREATE TABLE label_batch_items (
  batch_id        uuid NOT NULL REFERENCES label_batches(id),
  animal_id       uuid NOT NULL REFERENCES animals(id),
  qr_token        text NOT NULL REFERENCES animal_qr_tokens(token),
  included        boolean NOT NULL,
  excluded_reason text,
  is_reprint      boolean NOT NULL DEFAULT false,
  reprint_reason  text,
  PRIMARY KEY (batch_id, animal_id),
  CHECK (included OR excluded_reason IS NOT NULL),
  CHECK (NOT is_reprint OR reprint_reason IS NOT NULL)
);
-- Application rule (also checkable by trigger): only animals whose record exists on the server and
-- are registered/verified may have included = true; UNVERIFIED/pending animals are excluded with a reason.


CREATE TABLE sync_batches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id     uuid NOT NULL REFERENCES devices(id),
  user_id       uuid NOT NULL REFERENCES users(id),
  received_at   timestamptz NOT NULL DEFAULT now(),
  client_time   timestamptz,
  event_count   integer NOT NULL,
  accepted      integer NOT NULL DEFAULT 0,
  already_accepted integer NOT NULL DEFAULT 0,
  rejected      integer NOT NULL DEFAULT 0,
  needs_review  integer NOT NULL DEFAULT 0
);

CREATE TABLE sync_receipts (                    -- one row per event_id; latest outcome (per-record acknowledgement)
  event_id          uuid PRIMARY KEY,
  device_id         uuid NOT NULL REFERENCES devices(id),
  user_id           uuid NOT NULL REFERENCES users(id),
  last_batch_id     uuid REFERENCES sync_batches(id),
  event_type        text NOT NULL,
  status            text NOT NULL CHECK (status IN ('ACCEPTED','ALREADY_ACCEPTED','REJECTED','NEEDS_REVIEW','HELD_FOR_REVIEW')),
  code              text,
  errors            jsonb,
  payload           jsonb,                          -- kept for REJECTED / HELD / NEEDS_REVIEW; may be trimmed after success
  attempt_count     integer NOT NULL DEFAULT 1,
  first_received_at timestamptz NOT NULL DEFAULT now(),
  last_received_at  timestamptz NOT NULL DEFAULT now(),
  processed_at      timestamptz
);
CREATE INDEX ix_receipts_status ON sync_receipts(status) WHERE status IN ('REJECTED','NEEDS_REVIEW','HELD_FOR_REVIEW');
CREATE INDEX ix_receipts_device ON sync_receipts(device_id, last_received_at DESC);

CREATE TABLE sync_conflicts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid REFERENCES sync_receipts(event_id),
  entity_type   text NOT NULL,                      -- 'EVENT','ANIMAL','OWNER'
  entity_id     uuid,
  conflict_type text NOT NULL CHECK (conflict_type IN
                ('POSSIBLE_DUPLICATE_EVENT','STALE_ROW_VERSION','IDENTITY_MISMATCH','DUPLICATE_ANIMAL','DEACTIVATED_USER')),
  details       jsonb NOT NULL,
  status        text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','RESOLVED')),
  resolved_by   uuid REFERENCES users(id),
  resolution    text,
  resolved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (status = 'OPEN' OR (resolved_by IS NOT NULL AND resolved_at IS NOT NULL))
);
CREATE INDEX ix_conflicts_open ON sync_conflicts(created_at) WHERE status = 'OPEN';


CREATE TABLE audit_events (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid,                                 -- null for system/anonymous (e.g. failed login)
  actor_role    text,
  action        text NOT NULL,                        -- e.g. EVENT_CREATE, EVENT_CORRECT, LABEL_REPRINT, EXPORT, ACCESS_DENIED
  object_type   text,
  object_id     text,
  village_id    uuid,
  result        text NOT NULL CHECK (result IN ('SUCCESS','DENIED','FAILED')),
  reason        text,
  before_state  jsonb,
  after_state   jsonb,
  ip            inet,
  device_id     uuid,
  request_id    text
);
CREATE INDEX ix_audit_time ON audit_events(occurred_at DESC);
CREATE INDEX ix_audit_actor ON audit_events(actor_user_id, occurred_at DESC);
CREATE INDEX ix_audit_object ON audit_events(object_type, object_id);
CREATE INDEX ix_audit_denied ON audit_events(occurred_at DESC) WHERE result = 'DENIED';

CREATE OR REPLACE FUNCTION trg_audit_append_only() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'audit_events is append-only'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_audit_no_update BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION trg_audit_append_only();
-- Also: REVOKE UPDATE, DELETE, TRUNCATE ON audit_events FROM app_role;
-- Optional at scale: partition by month (RANGE on occurred_at).

CREATE TABLE export_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id),
  export_type  text NOT NULL,
  filters      jsonb,
  purpose      text NOT NULL,
  row_count    integer,
  file_path    text,
  formula_safe boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz
);

CREATE TABLE notifications (                    -- in-app notification records (work independently of SMS)
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL REFERENCES users(id),
  kind              text NOT NULL,                  -- CAMP_CONFIRMED, CAMP_CANCELLED, REPORT_ASSIGNED, ALERT_RAISED, REMINDER_DUE, HELP_REQUEST_UPDATE, VERIFICATION_RESULT ...
  message_key       text NOT NULL,                  -- key into the Gujarati strings module
  params            jsonb NOT NULL DEFAULT '{}',
  related_type      text,
  related_id        text,
  status            text NOT NULL DEFAULT 'UNREAD' CHECK (status IN ('UNREAD','READ','DISMISSED')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  read_at           timestamptz
);
CREATE INDEX ix_notif_recipient ON notifications(recipient_user_id, status, created_at DESC);

CREATE TABLE system_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_by uuid REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE integration_settings (
  key        text PRIMARY KEY,                       -- 'bharat_pashudhan','sms_provider','map_tiles'
  mode       text NOT NULL CHECK (mode IN ('DISABLED','SIMULATED','DEMO','ENABLED')),
  status_text text NOT NULL,                         -- e.g. 'Pending departmental approval and authorized API access'
  config_ref text,                                   -- reference to secret store; NEVER the secret itself
  updated_by uuid REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (key <> 'bharat_pashudhan' OR mode IN ('DISABLED','DEMO') OR config_ref IS NOT NULL)
);

CREATE TABLE jobs (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type          text NOT NULL,
  payload       jsonb NOT NULL DEFAULT '{}',
  status        text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
  run_at        timestamptz NOT NULL DEFAULT now(),
  attempts      integer NOT NULL DEFAULT 0,
  max_attempts  integer NOT NULL DEFAULT 5,
  locked_by     text,
  locked_at     timestamptz,
  heartbeat_at  timestamptz,
  last_error    text,
  dedupe_key    text,
  created_by    uuid REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz
);
CREATE INDEX ix_jobs_ready ON jobs(run_at) WHERE status = 'queued';
CREATE INDEX ix_jobs_running ON jobs(heartbeat_at) WHERE status = 'running';
CREATE UNIQUE INDEX uq_jobs_dedupe ON jobs(dedupe_key) WHERE dedupe_key IS NOT NULL AND status IN ('queued','running');


-- Last effective vaccination per animal & programme (derived; no duplicate storage of history)
CREATE VIEW v_animal_last_vaccination AS
SELECT e.animal_id, d.programme_code, max(e.event_date) AS last_date
FROM v_current_events e JOIN vaccination_details d USING (event_id)
WHERE e.event_type = 'VACCINATION' AND e.animal_id IS NOT NULL
GROUP BY e.animal_id, d.programme_code;

-- Freshness evidence per village (latest accepted event) — separate subquery so joins never multiply rows
CREATE VIEW v_village_data_asof AS
SELECT village_id, max(received_at) AS data_as_of FROM animal_events GROUP BY village_id;

-- Village coverage for a campaign (materialised; refreshed by worker). "Valid" = effective event on/after campaign start.
CREATE MATERIALIZED VIEW v_village_coverage AS
SELECT t.campaign_id, a.village_id, t.programme_code,
       count(*) FILTER (WHERE NOT t.excluded)                                                   AS eligible,
       count(*) FILTER (WHERE NOT t.excluded AND a.registration_status = 'VERIFIED'
                          AND v.last_date IS NOT NULL AND v.last_date >= c.start_date)           AS covered,
       max(f.data_as_of)                                                                         AS data_as_of
FROM campaign_animal_targets t
JOIN campaigns c ON c.id = t.campaign_id
JOIN animals a   ON a.id = t.animal_id
LEFT JOIN v_animal_last_vaccination v ON v.animal_id = t.animal_id AND v.programme_code = t.programme_code
LEFT JOIN v_village_data_asof f ON f.village_id = a.village_id
GROUP BY t.campaign_id, a.village_id, t.programme_code;
CREATE UNIQUE INDEX ON v_village_coverage(campaign_id, village_id, programme_code);
-- Coverage % and colour band are computed in the API from map_threshold_sets (APPROVED). No approved set, no data, or data_as_of older than
-- the configured window  =>  GREY (insufficient/stale). No band is hardcoded here. "covered" counts only VERIFIED animals (policy; configurable in service).

-- Surveillance per village (de-duplicated). Absence of rows is NOT "safe".
CREATE MATERIALIZED VIEW v_village_surveillance AS
SELECT village_id, disease_code,
       count(*) FILTER (WHERE status IN ('SUBMITTED','UNDER_REVIEW','SUSPECTED','NEEDS_MORE_INFORMATION') AND duplicate_of IS NULL) AS suspected_or_pending,
       count(*) FILTER (WHERE status = 'CONFIRMED')                    AS confirmed,
       count(*) FILTER (WHERE status = 'INSUFFICIENT_INFORMATION')     AS insufficient,
       count(*) FILTER (WHERE status = 'NOT_CONFIRMED')                AS not_confirmed,
       max(received_at)                                                AS last_report_at
FROM disease_reports
GROUP BY village_id, disease_code;
CREATE UNIQUE INDEX ON v_village_surveillance(village_id, disease_code);
-- "Green" additionally requires: no open alert AND data-sufficiency rule satisfied (from map_threshold_sets).


INSERT INTO species(code,name_en,name_gu) VALUES
 ('CATTLE','Cattle','ગાય'),('BUFFALO','Buffalo','ભેંસ'),('GOAT','Goat','બકરી'),('SHEEP','Sheep','ઘેટું');

INSERT INTO programmes(code,name_en) VALUES
 ('FMD','FMD'),('HS','HS'),('BQ','BQ'),('BRUCELLOSIS','Brucellosis'),('PPR','PPR');
-- Applicability by species/programme and every interval/age/eligibility value are NOT seeded:
-- To be configured and approved by the Department.

INSERT INTO permissions(code,description) VALUES
 ('animal.read','View animals in scope'),('animal.create','Register animals (staff)'),('animal.submit','Submit animal registration request (farmer)'),
 ('animal.verify','Verify animal in the field/office'),('animal.merge','Merge duplicate animals'),
 ('animal.transfer.request','Request ownership/village transfer'),('animal.transfer.decide','Approve/reject ownership transfer'),
 ('farmer.read','View farmer profiles in scope'),('farmer.register','Register farmer (staff-assisted)'),('farmer.verify','Verify farmer'),
 ('farmer.phone.view','View farmer phone number (audited)'),('farmer.outreach','Use consented farmer contacts for outreach'),
 ('event.create','Record vaccination/observation events'),('event.treatment.create','Record treatment events'),
 ('event.correct','Correct or void an event with reason'),('event.review','Mark event reviewed/flagged'),
 ('disease.report','Create disease report'),('disease.review','Open/assign/review disease reports'),
 ('disease.confirm','Confirm / not-confirm / insufficient-information (authorised veterinary review)'),
 ('import.run','Bulk import'),('label.generate','Generate QR label PDF'),
 ('campaign.view','View campaigns and progress'),('campaign.view_assigned','View own campaign assignments'),
 ('campaign.configure','Create/configure campaigns and schedules'),('campaign.assign_workers','Assign field workers (authorised villages)'),
 ('camp.propose','Propose a camp (cooperative coordinator/admin assignment required)'),('camp.manage','Create/confirm/reschedule/cancel camps in authorised villages'),
 ('camp.view_coop','View own cooperative camps'),('camp.view_public','View confirmed camp dates (village level)'),
 ('coop.manage','Manage cooperative staff assignments (cooperative ADMIN)'),
 ('vaccinator.manage','Record vaccinator authorization requests'),('vaccinator.approve','Approve vaccinator authorizations (Department reference required)'),
 ('aggregate.view','View aggregates in scope'),('map.view','View map layers in scope'),
 ('export.run','Run authorised export'),('audit.read','Read full audit log'),('audit.read_summary','Read audit summary'),('audit.read_own','Read own audit entries'),
 ('user.manage','Manage users, roles, villages'),('config.manage','Manage settings, thresholds, rules'),
 ('help.manage','Manage help requests'),('help.create','Create help request'),('own.read','Read own animals/records (farmer)');

-- Default role matrix (the Department approves the final version) — mirrors STAKEHOLDER_PERMISSION_MATRIX.md
INSERT INTO role_permissions(role,permission_code) VALUES
 ('VET_OFFICER','animal.read'),('VET_OFFICER','animal.create'),('VET_OFFICER','animal.verify'),('VET_OFFICER','animal.merge'),
 ('VET_OFFICER','animal.transfer.request'),('VET_OFFICER','animal.transfer.decide'),
 ('VET_OFFICER','farmer.read'),('VET_OFFICER','farmer.register'),('VET_OFFICER','farmer.verify'),('VET_OFFICER','farmer.phone.view'),
 ('VET_OFFICER','event.create'),('VET_OFFICER','event.treatment.create'),('VET_OFFICER','event.correct'),('VET_OFFICER','event.review'),
 ('VET_OFFICER','disease.report'),('VET_OFFICER','disease.review'),('VET_OFFICER','import.run'),('VET_OFFICER','label.generate'),
 ('VET_OFFICER','campaign.view'),('VET_OFFICER','campaign.assign_workers'),('VET_OFFICER','camp.manage'),('VET_OFFICER','vaccinator.approve'),
 ('VET_OFFICER','aggregate.view'),('VET_OFFICER','map.view'),('VET_OFFICER','export.run'),('VET_OFFICER','audit.read_own'),
 ('VET_OFFICER','help.manage'),('VET_OFFICER','help.create'),
 ('FIELD_WORKER','animal.read'),('FIELD_WORKER','animal.create'),('FIELD_WORKER','animal.verify'),('FIELD_WORKER','animal.transfer.request'),
 ('FIELD_WORKER','farmer.read'),('FIELD_WORKER','farmer.register'),('FIELD_WORKER','farmer.verify'),
 ('FIELD_WORKER','event.create'),('FIELD_WORKER','event.treatment.create'),('FIELD_WORKER','disease.report'),
 ('FIELD_WORKER','campaign.view_assigned'),('FIELD_WORKER','aggregate.view'),('FIELD_WORKER','help.create'),
 ('FARMER','own.read'),('FARMER','animal.submit'),('FARMER','animal.transfer.request'),('FARMER','disease.report'),('FARMER','help.create'),
 ('DAIRY_STAFF','aggregate.view'),('DAIRY_STAFF','campaign.view'),('DAIRY_STAFF','camp.view_coop'),('DAIRY_STAFF','camp.propose'),('DAIRY_STAFF','coop.manage'),
 ('DAHO','aggregate.view'),('DAHO','map.view'),('DAHO','campaign.view'),('DAHO','disease.review'),('DAHO','vaccinator.approve'),
 ('DAHO','export.run'),('DAHO','audit.read_summary'),
 ('GRAM_PANCHAYAT','aggregate.view'),('GRAM_PANCHAYAT','campaign.view'),('GRAM_PANCHAYAT','camp.view_public'),
 ('SYS_ADMIN','user.manage'),('SYS_ADMIN','config.manage'),('SYS_ADMIN','campaign.configure'),('SYS_ADMIN','campaign.view'),
 ('SYS_ADMIN','campaign.assign_workers'),('SYS_ADMIN','vaccinator.manage'),('SYS_ADMIN','coop.manage'),
 ('SYS_ADMIN','aggregate.view'),('SYS_ADMIN','audit.read'),('SYS_ADMIN','export.run');
-- NOT granted by default (explicit user_permission_grants, audited):
--   disease.confirm  → only qualified Veterinary Officers / DAHO designated by the Department
--   farmer.outreach  → only specifically authorised cooperative/panchayat users with consented farmers
--   import.run / label.generate for FIELD_WORKER → optional grants
--   Cooperative effective rights additionally require cooperative_staff_assignments (COORDINATOR/ADMIN); vaccination rights require an APPROVED vaccinator_authorization.

INSERT INTO system_settings(key,value) VALUES
 ('offline_period_days','7'),                                  -- approved default; administrator-configurable
 ('sync_batch_max_events','50'),
 ('upload_max_mb','10'),                                       -- [ASSUMPTION] example limit
 ('access_token_minutes','15'),
 ('farmer_self_registration_enabled','true'),                  -- proposed PashuRakshak feature
 ('vaccination_authorization_mode','"FLAG"'),                  -- STRICT = reject unauthorised vaccinator; FLAG = accept + NEEDS_REVIEW [PENDING Department]
 ('label_policy','"REGISTERED_OR_VERIFIED"'),
 ('flock_registration_enabled','false'),                       -- [PENDING Department decision for goats/sheep]
 ('species_registration_mode','{"CATTLE":"INDIVIDUAL","BUFFALO":"INDIVIDUAL","GOAT":"INDIVIDUAL","SHEEP":"INDIVIDUAL","_status":"PENDING_DEPARTMENT_APPROVAL"}'),
 ('coop_membership_enabled','false'),                          -- [PENDING approval]
 ('duplicate_event_window_days','null');                       -- no default invented; null = duplicate-window check disabled until configured

INSERT INTO integration_settings(key,mode,status_text) VALUES
 ('bharat_pashudhan','DISABLED','Pending departmental approval and authorized API access'),
 ('sms_provider','SIMULATED','Simulated until provider credentials, permissions and approvals exist'),
 ('map_tiles','DISABLED','Basemap source pending decision');
