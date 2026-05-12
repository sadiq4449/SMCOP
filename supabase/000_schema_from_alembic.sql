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
