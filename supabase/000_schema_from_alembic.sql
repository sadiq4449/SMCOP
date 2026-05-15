BEGIN;

CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL, 
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- Running upgrade  -> 0001_initial_auth_tables

CREATE TYPE user_role AS ENUM ('super_admin', 'government', 'deo', 'enumerator', 'principal', 'teacher');

CREATE TYPE user_status AS ENUM ('active', 'inactive');

CREATE TABLE users (
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

CREATE UNIQUE INDEX ix_users_email ON users (email);

CREATE TABLE activity_logs (
    id UUID NOT NULL, 
    user_id UUID, 
    action VARCHAR(200) NOT NULL, 
    target VARCHAR(200) NOT NULL, 
    metadata JSONB, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id)
);

CREATE INDEX ix_activity_logs_user_id ON activity_logs (user_id);

INSERT INTO alembic_version (version_num) VALUES ('0001_initial_auth_tables') RETURNING alembic_version.version_num;

-- Running upgrade 0001_initial_auth_tables -> 0002_geo_partner_schools

CREATE TYPE school_level AS ENUM ('primary', 'middle', 'high', 'higher_secondary');

CREATE TYPE school_gender AS ENUM ('boys', 'girls', 'mixed');

CREATE TYPE school_status AS ENUM ('active', 'inactive');

CREATE TYPE teacher_gender AS ENUM ('male', 'female');

CREATE TYPE teacher_status AS ENUM ('active', 'inactive');

CREATE TABLE districts (
    id UUID NOT NULL, 
    name VARCHAR(120) NOT NULL, 
    code VARCHAR(32), 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    UNIQUE (code)
);

CREATE TABLE talukas (
    id UUID NOT NULL, 
    district_id UUID NOT NULL, 
    name VARCHAR(120) NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(district_id) REFERENCES districts (id) ON DELETE CASCADE
);

CREATE INDEX ix_talukas_district_id ON talukas (district_id);

CREATE TABLE union_councils (
    id UUID NOT NULL, 
    taluka_id UUID NOT NULL, 
    name VARCHAR(120) NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(taluka_id) REFERENCES talukas (id) ON DELETE CASCADE
);

CREATE INDEX ix_union_councils_taluka_id ON union_councils (taluka_id);

CREATE TABLE partner_orgs (
    id UUID NOT NULL, 
    name VARCHAR(150) NOT NULL, 
    contact_person VARCHAR(120), 
    email VARCHAR(150), 
    phone VARCHAR(50), 
    address TEXT, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id)
);

CREATE TABLE schools (
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

CREATE INDEX ix_schools_partner_org_id ON schools (partner_org_id);

CREATE INDEX ix_schools_uc_id ON schools (uc_id);

CREATE TABLE school_enrollment (
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

CREATE INDEX ix_school_enrollment_school_id ON school_enrollment (school_id);

CREATE TABLE teachers (
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

CREATE INDEX ix_teachers_school_id ON teachers (school_id);

UPDATE alembic_version SET version_num='0002_geo_partner_schools' WHERE alembic_version.version_num = '0001_initial_auth_tables';

-- Running upgrade 0002_geo_partner_schools -> 0003_user_district_scope_indexes

ALTER TABLE users ADD COLUMN district_id UUID;

ALTER TABLE users ADD CONSTRAINT fk_users_district_id_districts FOREIGN KEY(district_id) REFERENCES districts (id) ON DELETE SET NULL;

CREATE INDEX ix_users_district_id ON users (district_id);

CREATE INDEX ix_users_role ON users (role);

CREATE INDEX ix_users_partner_org_id ON users (partner_org_id);

UPDATE alembic_version SET version_num='0003_user_district_scope_indexes' WHERE alembic_version.version_num = '0002_geo_partner_schools';

-- Running upgrade 0003_user_district_scope_indexes -> 0004_monitoring_visits

CREATE TYPE visit_form_status AS ENUM ('draft', 'finalized');

CREATE TYPE infrastructure_item_status AS ENUM ('available', 'not_available', 'needs_repair');

CREATE TABLE kpis (
    id UUID NOT NULL, 
    name VARCHAR(200) NOT NULL, 
    description TEXT, 
    max_score INTEGER NOT NULL, 
    category VARCHAR(120) NOT NULL, 
    sort_order INTEGER NOT NULL, 
    PRIMARY KEY (id)
);

INSERT INTO kpis (id, name, description, max_score, category, sort_order) VALUES ('cb8a154b-82ad-508b-83c9-e8c5a6124117', 'Enrollment & Attendance', 'Enrollment trends and attendance regularity.', 5, 'Quarterly Monitoring', 1);

INSERT INTO kpis (id, name, description, max_score, category, sort_order) VALUES ('e5c38374-6645-5c5a-b3e9-02b03b1e1a58', 'Classroom Instruction Quality', 'Quality of teaching and learning processes.', 5, 'Quarterly Monitoring', 2);

INSERT INTO kpis (id, name, description, max_score, category, sort_order) VALUES ('c17c116e-c334-58ee-bdc5-ff37090511b8', 'Teacher Availability', 'Staff presence and timetable coverage.', 5, 'Quarterly Monitoring', 3);

INSERT INTO kpis (id, name, description, max_score, category, sort_order) VALUES ('847c1fb3-d34a-5e5a-b4a6-c0ac2b00b371', 'School Infrastructure', 'Buildings, utilities, and facilities.', 5, 'Quarterly Monitoring', 4);

INSERT INTO kpis (id, name, description, max_score, category, sort_order) VALUES ('e88d93f3-88e4-50fc-97f2-84b66d9ee755', 'Student Learning Environment', 'Safety, hygiene, and learner experience.', 5, 'Quarterly Monitoring', 5);

INSERT INTO kpis (id, name, description, max_score, category, sort_order) VALUES ('c4cc94c1-56f6-568f-ab53-6fc238ae93b4', 'Management & Governance', 'Leadership, records, and SMC engagement.', 5, 'Quarterly Monitoring', 6);

INSERT INTO kpis (id, name, description, max_score, category, sort_order) VALUES ('37daaf67-680c-5338-8a4c-07d8bf3acc9b', 'Community Engagement', 'Parent and community participation.', 5, 'Quarterly Monitoring', 7);

CREATE TABLE visits (
    id UUID NOT NULL, 
    school_id UUID NOT NULL, 
    quarter VARCHAR(20) NOT NULL, 
    visit_date DATE, 
    visited_by UUID NOT NULL, 
    status visit_form_status DEFAULT 'draft'::visit_form_status NOT NULL, 
    remarks TEXT, 
    aggregate_score NUMERIC(6, 2), 
    gps_latitude FLOAT, 
    gps_longitude FLOAT, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(school_id) REFERENCES schools (id) ON DELETE CASCADE, 
    FOREIGN KEY(visited_by) REFERENCES users (id) ON DELETE RESTRICT, 
    CONSTRAINT uq_visit_school_quarter UNIQUE (school_id, quarter)
);

CREATE INDEX ix_visits_school_id ON visits (school_id);

CREATE INDEX ix_visits_visited_by ON visits (visited_by);

CREATE TABLE kpi_scores (
    id UUID NOT NULL, 
    visit_id UUID NOT NULL, 
    kpi_id UUID NOT NULL, 
    score INTEGER NOT NULL, 
    remarks TEXT, 
    PRIMARY KEY (id), 
    FOREIGN KEY(kpi_id) REFERENCES kpis (id) ON DELETE RESTRICT, 
    FOREIGN KEY(visit_id) REFERENCES visits (id) ON DELETE CASCADE, 
    CONSTRAINT uq_kpi_score_visit_kpi UNIQUE (visit_id, kpi_id)
);

CREATE INDEX ix_kpi_scores_visit_id ON kpi_scores (visit_id);

CREATE TABLE infrastructure_checklist (
    id UUID NOT NULL, 
    visit_id UUID NOT NULL, 
    item_name VARCHAR(150) NOT NULL, 
    status infrastructure_item_status NOT NULL, 
    remarks TEXT, 
    PRIMARY KEY (id), 
    FOREIGN KEY(visit_id) REFERENCES visits (id) ON DELETE CASCADE
);

CREATE INDEX ix_infrastructure_checklist_visit_id ON infrastructure_checklist (visit_id);

CREATE TABLE documents (
    id UUID NOT NULL, 
    school_id UUID NOT NULL, 
    visit_id UUID, 
    file_name VARCHAR(255) NOT NULL, 
    file_url TEXT NOT NULL, 
    file_type VARCHAR(50), 
    uploaded_by UUID NOT NULL, 
    metadata JSON, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(school_id) REFERENCES schools (id) ON DELETE CASCADE, 
    FOREIGN KEY(uploaded_by) REFERENCES users (id) ON DELETE RESTRICT, 
    FOREIGN KEY(visit_id) REFERENCES visits (id) ON DELETE CASCADE
);

CREATE INDEX ix_documents_school_id ON documents (school_id);

CREATE INDEX ix_documents_visit_id ON documents (visit_id);

UPDATE alembic_version SET version_num='0004_monitoring_visits' WHERE alembic_version.version_num = '0003_user_district_scope_indexes';

-- Running upgrade 0004_monitoring_visits -> 0005_classroom_observations

CREATE TABLE classroom_observations (
    id UUID NOT NULL, 
    visit_id UUID NOT NULL, 
    teacher_id UUID, 
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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(visit_id) REFERENCES visits (id) ON DELETE CASCADE, 
    FOREIGN KEY(teacher_id) REFERENCES teachers (id) ON DELETE SET NULL
);

CREATE INDEX ix_classroom_observations_visit_id ON classroom_observations (visit_id);

ALTER TABLE documents ADD COLUMN classroom_observation_id UUID;

ALTER TABLE documents ADD CONSTRAINT fk_documents_classroom_observation_id_classroom_observations FOREIGN KEY(classroom_observation_id) REFERENCES classroom_observations (id) ON DELETE SET NULL;

CREATE INDEX ix_documents_classroom_observation_id ON documents (classroom_observation_id);

UPDATE alembic_version SET version_num='0005_classroom_observations' WHERE alembic_version.version_num = '0004_monitoring_visits';

-- Running upgrade 0005_classroom_observations -> 0006_attendance

CREATE TYPE teacher_attendance_approval_status AS ENUM ('pending', 'approved', 'rejected');

ALTER TABLE users ADD COLUMN linked_teacher_id UUID;

ALTER TABLE users ADD CONSTRAINT fk_users_linked_teacher_id_teachers FOREIGN KEY(linked_teacher_id) REFERENCES teachers (id) ON DELETE SET NULL;

CREATE INDEX ix_users_linked_teacher_id ON users (linked_teacher_id);

CREATE TABLE teacher_attendance (
    id UUID NOT NULL, 
    school_id UUID NOT NULL, 
    attendance_date DATE NOT NULL, 
    teacher_id UUID NOT NULL, 
    present BOOLEAN NOT NULL, 
    remarks TEXT, 
    verification_photo_url TEXT, 
    approval_status teacher_attendance_approval_status DEFAULT 'pending'::teacher_attendance_approval_status NOT NULL, 
    submitted_by_user_id UUID NOT NULL, 
    approved_by_user_id UUID, 
    approved_at TIMESTAMP WITH TIME ZONE, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(approved_by_user_id) REFERENCES users (id) ON DELETE SET NULL, 
    FOREIGN KEY(school_id) REFERENCES schools (id) ON DELETE CASCADE, 
    FOREIGN KEY(submitted_by_user_id) REFERENCES users (id) ON DELETE RESTRICT, 
    FOREIGN KEY(teacher_id) REFERENCES teachers (id) ON DELETE CASCADE, 
    CONSTRAINT uq_teacher_attendance_day UNIQUE (school_id, attendance_date, teacher_id)
);

CREATE INDEX ix_teacher_attendance_school_id ON teacher_attendance (school_id);

CREATE INDEX ix_teacher_attendance_attendance_date ON teacher_attendance (attendance_date);

CREATE TABLE student_daily_attendance (
    id UUID NOT NULL, 
    school_id UUID NOT NULL, 
    attendance_date DATE NOT NULL, 
    boys_present INTEGER NOT NULL, 
    girls_present INTEGER NOT NULL, 
    submitted_by_user_id UUID NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(school_id) REFERENCES schools (id) ON DELETE CASCADE, 
    FOREIGN KEY(submitted_by_user_id) REFERENCES users (id) ON DELETE RESTRICT, 
    CONSTRAINT uq_student_attendance_school_day UNIQUE (school_id, attendance_date)
);

CREATE INDEX ix_student_daily_attendance_school_id ON student_daily_attendance (school_id);

UPDATE alembic_version SET version_num='0006_attendance' WHERE alembic_version.version_num = '0005_classroom_observations';

-- Running upgrade 0006_attendance -> 0007_reports

CREATE TYPE report_status AS ENUM ('draft', 'submitted', 'approved', 'rejected');

CREATE TABLE reports (
    id UUID NOT NULL, 
    school_id UUID NOT NULL, 
    quarter VARCHAR(20) NOT NULL, 
    visit_id UUID, 
    summary TEXT, 
    recommendations TEXT, 
    principal_infrastructure_notes TEXT, 
    principal_daily_activity_notes TEXT, 
    generated_snapshot JSON, 
    status report_status DEFAULT 'draft'::report_status NOT NULL, 
    review_remarks TEXT, 
    reviewed_by_user_id UUID, 
    reviewed_at TIMESTAMP WITH TIME ZONE, 
    created_by_user_id UUID NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(created_by_user_id) REFERENCES users (id) ON DELETE RESTRICT, 
    FOREIGN KEY(reviewed_by_user_id) REFERENCES users (id) ON DELETE SET NULL, 
    FOREIGN KEY(school_id) REFERENCES schools (id) ON DELETE CASCADE, 
    FOREIGN KEY(visit_id) REFERENCES visits (id) ON DELETE SET NULL, 
    CONSTRAINT uq_report_school_quarter UNIQUE (school_id, quarter)
);

CREATE INDEX ix_reports_school_id ON reports (school_id);

CREATE INDEX ix_reports_quarter ON reports (quarter);

CREATE INDEX ix_reports_status ON reports (status);

CREATE TABLE report_comments (
    id UUID NOT NULL, 
    report_id UUID NOT NULL, 
    user_id UUID NOT NULL, 
    body TEXT NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(report_id) REFERENCES reports (id) ON DELETE CASCADE, 
    FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE INDEX ix_report_comments_report_id ON report_comments (report_id);

UPDATE alembic_version SET version_num='0007_reports' WHERE alembic_version.version_num = '0006_attendance';

-- Running upgrade 0007_reports -> 0008_issues_notify

CREATE TYPE issue_category AS ENUM ('infrastructure', 'teachers', 'students', 'facility');

CREATE TYPE issue_severity AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TYPE issue_status AS ENUM ('open', 'assigned', 'resolved', 'closed');

CREATE TABLE issues (
    id UUID NOT NULL, 
    school_id UUID NOT NULL, 
    category issue_category NOT NULL, 
    details TEXT NOT NULL, 
    severity issue_severity NOT NULL, 
    status issue_status DEFAULT 'open'::issue_status NOT NULL, 
    raised_by_user_id UUID NOT NULL, 
    assigned_to_user_id UUID, 
    attachment_url VARCHAR(500), 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(assigned_to_user_id) REFERENCES users (id) ON DELETE SET NULL, 
    FOREIGN KEY(raised_by_user_id) REFERENCES users (id) ON DELETE RESTRICT, 
    FOREIGN KEY(school_id) REFERENCES schools (id) ON DELETE CASCADE
);

CREATE INDEX ix_issues_school_id ON issues (school_id);

CREATE INDEX ix_issues_status ON issues (status);

CREATE INDEX ix_issues_raised_by_user_id ON issues (raised_by_user_id);

CREATE TABLE work_tasks (
    id UUID NOT NULL, 
    school_id UUID NOT NULL, 
    title VARCHAR(200) NOT NULL, 
    details TEXT, 
    assignee_user_id UUID NOT NULL, 
    due_date DATE, 
    is_completed BOOLEAN DEFAULT false NOT NULL, 
    completed_at TIMESTAMP WITH TIME ZONE, 
    created_by_user_id UUID NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(assignee_user_id) REFERENCES users (id) ON DELETE CASCADE, 
    FOREIGN KEY(created_by_user_id) REFERENCES users (id) ON DELETE RESTRICT, 
    FOREIGN KEY(school_id) REFERENCES schools (id) ON DELETE CASCADE
);

CREATE INDEX ix_work_tasks_school_id ON work_tasks (school_id);

CREATE INDEX ix_work_tasks_assignee_user_id ON work_tasks (assignee_user_id);

CREATE TABLE notifications (
    id UUID NOT NULL, 
    user_id UUID NOT NULL, 
    title VARCHAR(200) NOT NULL, 
    message TEXT NOT NULL, 
    is_read BOOLEAN DEFAULT false NOT NULL, 
    kind VARCHAR(80), 
    ref_type VARCHAR(80), 
    ref_id VARCHAR(80), 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_notifications_user_id ON notifications (user_id);

CREATE INDEX ix_notifications_user_id_is_read ON notifications (user_id, is_read);

CREATE TABLE announcements (
    id UUID NOT NULL, 
    district_id UUID, 
    title VARCHAR(200) NOT NULL, 
    body TEXT NOT NULL, 
    attachment_url VARCHAR(500), 
    created_by_user_id UUID NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(created_by_user_id) REFERENCES users (id) ON DELETE RESTRICT, 
    FOREIGN KEY(district_id) REFERENCES districts (id) ON DELETE CASCADE
);

CREATE INDEX ix_announcements_district_id ON announcements (district_id);

CREATE TABLE webhook_subscriptions (
    id UUID NOT NULL, 
    url VARCHAR(2000) NOT NULL, 
    secret VARCHAR(128) NOT NULL, 
    events JSON NOT NULL, 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    created_by_user_id UUID NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(created_by_user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE password_reset_tokens (
    id UUID NOT NULL, 
    user_id UUID NOT NULL, 
    token_hash VARCHAR(64) NOT NULL, 
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    used_at TIMESTAMP WITH TIME ZONE, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_password_reset_tokens_token_hash ON password_reset_tokens (token_hash);

CREATE INDEX ix_password_reset_tokens_user_id ON password_reset_tokens (user_id);

UPDATE alembic_version SET version_num='0008_issues_notify' WHERE alembic_version.version_num = '0007_reports';

-- Running upgrade 0008_issues_notify -> 0009_user_roles_ie_partner

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'ie';

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'partner';

UPDATE users SET role = 'ie'::user_role WHERE role::text = 'enumerator';

UPDATE users SET role = 'partner'::user_role WHERE role::text IN ('principal', 'teacher') AND partner_org_id IS NOT NULL;

UPDATE users SET role = 'government'::user_role WHERE role::text IN ('deo', 'principal', 'teacher');

UPDATE alembic_version SET version_num='0009_user_roles_ie_partner' WHERE alembic_version.version_num = '0008_issues_notify';

-- Running upgrade 0009_user_roles_ie_partner -> 0010_kpi_weight

ALTER TABLE kpis ADD COLUMN weight NUMERIC(5, 2) DEFAULT 1.0 NOT NULL;

UPDATE alembic_version SET version_num='0010_kpi_weight' WHERE alembic_version.version_num = '0009_user_roles_ie_partner';

-- Running upgrade 0010_kpi_weight -> 0011_visit_schedule

ALTER TABLE visits ADD COLUMN scheduled_date DATE;

ALTER TABLE visits ADD COLUMN scheduled_time_start TIME WITHOUT TIME ZONE;

ALTER TABLE visits ADD COLUMN scheduled_time_end TIME WITHOUT TIME ZONE;

UPDATE alembic_version SET version_num='0011_visit_schedule' WHERE alembic_version.version_num = '0010_kpi_weight';

-- Running upgrade 0011_visit_schedule -> 0012_visits_scheduled_date_index

CREATE INDEX IF NOT EXISTS ix_visits_scheduled_date ON visits (scheduled_date);

UPDATE alembic_version SET version_num='0012_visits_scheduled_date_index' WHERE alembic_version.version_num = '0011_visit_schedule';

COMMIT;

