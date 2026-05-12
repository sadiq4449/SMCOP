-- Generated from Alembic (0001 + 0002). Run in Supabase → SQL → New query as a single script.
-- Prefer `alembic upgrade head` against your DATABASE_URL when possible.
--
-- Safe to re-run: uses IF NOT EXISTS / duplicate-safe enums so partial runs do not fail on "already exists".

BEGIN;

CREATE TABLE IF NOT EXISTS alembic_version (
    version_num VARCHAR(32) NOT NULL,
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- Running upgrade  -> 0001_initial_auth_tables

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('super_admin', 'government', 'deo', 'enumerator', 'principal', 'teacher');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('active', 'inactive');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
    id UUID NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(150) NOT NULL,
    password_hash TEXT NOT NULL,
    role user_role NOT NULL,
    partner_org_id UUID,
    assigned_schools JSONB DEFAULT '[]'::jsonb NOT NULL,
    status user_status NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (email)
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON users (email);

CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID NOT NULL,
    user_id UUID,
    action VARCHAR(200) NOT NULL,
    target VARCHAR(200) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS ix_activity_logs_user_id ON activity_logs (user_id);

INSERT INTO alembic_version (version_num)
SELECT '0001_initial_auth_tables'
WHERE NOT EXISTS (SELECT 1 FROM alembic_version LIMIT 1);

-- Running upgrade 0001_initial_auth_tables -> 0002_geo_partner_schools

DO $$ BEGIN
    CREATE TYPE school_level AS ENUM ('primary', 'middle', 'high', 'higher_secondary');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE school_gender AS ENUM ('boys', 'girls', 'mixed');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE school_status AS ENUM ('active', 'inactive');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE teacher_gender AS ENUM ('male', 'female');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE teacher_status AS ENUM ('active', 'inactive');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS districts (
    id UUID NOT NULL,
    name VARCHAR(120) NOT NULL,
    code VARCHAR(32),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS talukas (
    id UUID NOT NULL,
    district_id UUID NOT NULL,
    name VARCHAR(120) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(district_id) REFERENCES districts (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_talukas_district_id ON talukas (district_id);

CREATE TABLE IF NOT EXISTS union_councils (
    id UUID NOT NULL,
    taluka_id UUID NOT NULL,
    name VARCHAR(120) NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(taluka_id) REFERENCES talukas (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_union_councils_taluka_id ON union_councils (taluka_id);

CREATE TABLE IF NOT EXISTS partner_orgs (
    id UUID NOT NULL,
    name VARCHAR(150) NOT NULL,
    contact_person VARCHAR(120),
    email VARCHAR(150),
    phone VARCHAR(50),
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS schools (
    id UUID NOT NULL,
    emis_code VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    uc_id UUID NOT NULL,
    level school_level NOT NULL,
    gender school_gender NOT NULL,
    partner_org_id UUID,
    principal_name VARCHAR(120),
    principal_phone VARCHAR(50),
    gps_latitude FLOAT,
    gps_longitude FLOAT,
    status school_status NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(partner_org_id) REFERENCES partner_orgs (id) ON DELETE SET NULL,
    FOREIGN KEY(uc_id) REFERENCES union_councils (id) ON DELETE RESTRICT,
    UNIQUE (emis_code)
);

CREATE INDEX IF NOT EXISTS ix_schools_partner_org_id ON schools (partner_org_id);

CREATE INDEX IF NOT EXISTS ix_schools_uc_id ON schools (uc_id);

CREATE TABLE IF NOT EXISTS school_enrollment (
    id UUID NOT NULL,
    school_id UUID NOT NULL,
    quarter VARCHAR(20) NOT NULL,
    boys INTEGER NOT NULL,
    girls INTEGER NOT NULL,
    total INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(school_id) REFERENCES schools (id) ON DELETE CASCADE,
    CONSTRAINT uq_enrollment_school_quarter UNIQUE (school_id, quarter)
);

CREATE INDEX IF NOT EXISTS ix_school_enrollment_school_id ON school_enrollment (school_id);

CREATE TABLE IF NOT EXISTS teachers (
    id UUID NOT NULL,
    school_id UUID NOT NULL,
    name VARCHAR(150) NOT NULL,
    gender teacher_gender NOT NULL,
    subject VARCHAR(150),
    status teacher_status NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(school_id) REFERENCES schools (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_teachers_school_id ON teachers (school_id);

UPDATE alembic_version SET version_num='0002_geo_partner_schools' WHERE alembic_version.version_num = '0001_initial_auth_tables';

COMMIT;

-- Running upgrade 0002_geo_partner_schools -> 0003_user_district_scope_indexes
BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES districts (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_users_district_id ON users (district_id);

CREATE INDEX IF NOT EXISTS ix_users_role ON users (role);

CREATE INDEX IF NOT EXISTS ix_users_partner_org_id ON users (partner_org_id);

UPDATE alembic_version SET version_num='0003_user_district_scope_indexes' WHERE EXISTS (SELECT 1 FROM alembic_version LIMIT 1);

COMMIT;

-- Running upgrade 0003_user_district_scope_indexes -> 0004_monitoring_visits (Postgres)
BEGIN;

DO $$ BEGIN
    CREATE TYPE visit_form_status AS ENUM ('draft', 'finalized');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE infrastructure_item_status AS ENUM ('available', 'not_available', 'needs_repair');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS kpis (
    id UUID NOT NULL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    max_score INTEGER NOT NULL,
    category VARCHAR(120) NOT NULL,
    sort_order INTEGER NOT NULL
);

INSERT INTO kpis (id, name, description, max_score, category, sort_order) VALUES
  ('cb8a154b-82ad-508b-83c9-e8c5a6124117'::uuid, 'Enrollment & Attendance', 'Enrollment trends and attendance regularity.', 5, 'Quarterly Monitoring', 1),
  ('e5c38374-6645-5c5a-b3e9-02b03b1e1a58'::uuid, 'Classroom Instruction Quality', 'Quality of teaching and learning processes.', 5, 'Quarterly Monitoring', 2),
  ('c17c116e-c334-58ee-bdc5-ff37090511b8'::uuid, 'Teacher Availability', 'Staff presence and timetable coverage.', 5, 'Quarterly Monitoring', 3),
  ('847c1fb3-d34a-5e5a-b4a6-c0ac2b00b371'::uuid, 'School Infrastructure', 'Buildings, utilities, and facilities.', 5, 'Quarterly Monitoring', 4),
  ('e88d93f3-88e4-50fc-97f2-84b66d9ee755'::uuid, 'Student Learning Environment', 'Safety, hygiene, and learner experience.', 5, 'Quarterly Monitoring', 5),
  ('c4cc94c1-56f6-568f-ab53-6fc238ae93b4'::uuid, 'Management & Governance', 'Leadership, records, and SMC engagement.', 5, 'Quarterly Monitoring', 6),
  ('37daaf67-680c-5338-8a4c-07d8bf3acc9b'::uuid, 'Community Engagement', 'Parent and community participation.', 5, 'Quarterly Monitoring', 7)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS visits (
    id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
    quarter VARCHAR(20) NOT NULL,
    visit_date DATE,
    visited_by UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    status visit_form_status NOT NULL DEFAULT 'draft'::visit_form_status,
    remarks TEXT,
    aggregate_score NUMERIC(6, 2),
    gps_latitude DOUBLE PRECISION,
    gps_longitude DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    CONSTRAINT uq_visit_school_quarter UNIQUE (school_id, quarter)
);

CREATE INDEX IF NOT EXISTS ix_visits_school_id ON visits (school_id);
CREATE INDEX IF NOT EXISTS ix_visits_visited_by ON visits (visited_by);

CREATE TABLE IF NOT EXISTS kpi_scores (
    id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID NOT NULL REFERENCES visits (id) ON DELETE CASCADE,
    kpi_id UUID NOT NULL REFERENCES kpis (id) ON DELETE RESTRICT,
    score INTEGER NOT NULL,
    remarks TEXT,
    CONSTRAINT uq_kpi_score_visit_kpi UNIQUE (visit_id, kpi_id)
);

CREATE INDEX IF NOT EXISTS ix_kpi_scores_visit_id ON kpi_scores (visit_id);

CREATE TABLE IF NOT EXISTS infrastructure_checklist (
    id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID NOT NULL REFERENCES visits (id) ON DELETE CASCADE,
    item_name VARCHAR(150) NOT NULL,
    status infrastructure_item_status NOT NULL,
    remarks TEXT
);

CREATE INDEX IF NOT EXISTS ix_infrastructure_checklist_visit_id ON infrastructure_checklist (visit_id);

CREATE TABLE IF NOT EXISTS documents (
    id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
    visit_id UUID REFERENCES visits (id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_type VARCHAR(50),
    uploaded_by UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_documents_school_id ON documents (school_id);
CREATE INDEX IF NOT EXISTS ix_documents_visit_id ON documents (visit_id);

CREATE TABLE IF NOT EXISTS classroom_observations (
    id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID NOT NULL REFERENCES visits (id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES teachers (id) ON DELETE SET NULL,
    teacher_name VARCHAR(150),
    subject VARCHAR(120) NOT NULL,
    grade VARCHAR(50) NOT NULL,
    observation_date DATE,
    score_engagement INTEGER NOT NULL,
    score_pedagogy INTEGER NOT NULL,
    score_environment INTEGER NOT NULL,
    strengths TEXT,
    weaknesses TEXT,
    recommendations TEXT,
    remarks TEXT,
    reviewer_comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_classroom_observations_visit_id ON classroom_observations (visit_id);

ALTER TABLE documents ADD COLUMN IF NOT EXISTS classroom_observation_id UUID REFERENCES classroom_observations (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ix_documents_classroom_observation_id ON documents (classroom_observation_id);

DO $$
BEGIN
    CREATE TYPE teacher_attendance_approval_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS linked_teacher_id UUID REFERENCES teachers (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ix_users_linked_teacher_id ON users (linked_teacher_id);

CREATE TABLE IF NOT EXISTS teacher_attendance (
    id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    teacher_id UUID NOT NULL REFERENCES teachers (id) ON DELETE CASCADE,
    present BOOLEAN NOT NULL,
    remarks TEXT,
    verification_photo_url TEXT,
    approval_status teacher_attendance_approval_status NOT NULL DEFAULT 'pending',
    submitted_by_user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    approved_by_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    CONSTRAINT uq_teacher_attendance_day UNIQUE (school_id, attendance_date, teacher_id)
);

CREATE INDEX IF NOT EXISTS ix_teacher_attendance_school_id ON teacher_attendance (school_id);
CREATE INDEX IF NOT EXISTS ix_teacher_attendance_attendance_date ON teacher_attendance (attendance_date);

CREATE TABLE IF NOT EXISTS student_daily_attendance (
    id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    boys_present INTEGER NOT NULL,
    girls_present INTEGER NOT NULL,
    submitted_by_user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    CONSTRAINT uq_student_attendance_school_day UNIQUE (school_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS ix_student_daily_attendance_school_id ON student_daily_attendance (school_id);

UPDATE alembic_version SET version_num='0006_attendance' WHERE EXISTS (SELECT 1 FROM alembic_version LIMIT 1);

-- Running upgrade 0006_attendance -> 0007_reports

DO $$ BEGIN
    CREATE TYPE report_status AS ENUM ('draft', 'submitted', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS reports (
    id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
    quarter VARCHAR(20) NOT NULL,
    visit_id UUID REFERENCES visits (id) ON DELETE SET NULL,
    summary TEXT,
    recommendations TEXT,
    principal_infrastructure_notes TEXT,
    principal_daily_activity_notes TEXT,
    generated_snapshot JSONB,
    status report_status NOT NULL DEFAULT 'draft'::report_status,
    review_remarks TEXT,
    reviewed_by_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_by_user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    CONSTRAINT uq_report_school_quarter UNIQUE (school_id, quarter)
);

CREATE INDEX IF NOT EXISTS ix_reports_school_id ON reports (school_id);
CREATE INDEX IF NOT EXISTS ix_reports_quarter ON reports (quarter);
CREATE INDEX IF NOT EXISTS ix_reports_status ON reports (status);

CREATE TABLE IF NOT EXISTS report_comments (
    id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES reports (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    body TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_report_comments_report_id ON report_comments (report_id);

UPDATE alembic_version SET version_num='0007_reports' WHERE EXISTS (SELECT 1 FROM alembic_version LIMIT 1);

COMMIT;
