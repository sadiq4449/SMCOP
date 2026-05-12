-- Demo users (same emails/passwords as backend/app/db/seed.py). Password for all: Password123!
-- Safe to re-run: skips rows that already exist (unique email).
-- Run in Supabase SQL Editor after 000_schema_from_alembic.sql.

BEGIN;

INSERT INTO users (id, full_name, email, password_hash, role, partner_org_id, district_id, assigned_schools, status)
VALUES
  (gen_random_uuid(), 'Super Admin', 'superadmin@example.com', '$2b$12$L1G8IR0YQHU0A6Q2uXSBdu5LkVHXkq4PIHZOtL2a4I3kf2seabxTW', 'super_admin'::user_role, NULL, NULL, '[]'::jsonb, 'active'::user_status),
  (gen_random_uuid(), 'Government User', 'government@example.com', '$2b$12$L1G8IR0YQHU0A6Q2uXSBdu5LkVHXkq4PIHZOtL2a4I3kf2seabxTW', 'government'::user_role, NULL, NULL, '[]'::jsonb, 'active'::user_status),
  (gen_random_uuid(), 'District Education Officer', 'deo@example.com', '$2b$12$L1G8IR0YQHU0A6Q2uXSBdu5LkVHXkq4PIHZOtL2a4I3kf2seabxTW', 'deo'::user_role, NULL, NULL, '[]'::jsonb, 'active'::user_status),
  (gen_random_uuid(), 'Field Enumerator', 'enumerator@example.com', '$2b$12$L1G8IR0YQHU0A6Q2uXSBdu5LkVHXkq4PIHZOtL2a4I3kf2seabxTW', 'enumerator'::user_role, NULL, NULL, '[]'::jsonb, 'active'::user_status),
  (gen_random_uuid(), 'School Principal', 'principal@example.com', '$2b$12$L1G8IR0YQHU0A6Q2uXSBdu5LkVHXkq4PIHZOtL2a4I3kf2seabxTW', 'principal'::user_role, NULL, NULL, '[]'::jsonb, 'active'::user_status),
  (gen_random_uuid(), 'School Teacher', 'teacher@example.com', '$2b$12$L1G8IR0YQHU0A6Q2uXSBdu5LkVHXkq4PIHZOtL2a4I3kf2seabxTW', 'teacher'::user_role, NULL, NULL, '[]'::jsonb, 'active'::user_status)
ON CONFLICT (email) DO NOTHING;

COMMIT;
