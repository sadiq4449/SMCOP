-- Demo users (aligned with backend/app/db/seed.py). Password for all: Password123!
-- Run after 000_schema_from_alembic.sql and 005_user_role_ie_partner.sql (when migrating legacy DBs).

BEGIN;

INSERT INTO users (id, full_name, email, password_hash, role, partner_org_id, district_id, assigned_schools, status)
VALUES
  (gen_random_uuid(), 'Super Admin', 'superadmin@example.com', '$2b$12$L1G8IR0YQHU0A6Q2uXSBdu5LkVHXkq4PIHZOtL2a4I3kf2seabxTW', 'super_admin'::user_role, NULL, NULL, '[]'::jsonb, 'active'::user_status),
  (gen_random_uuid(), 'PPP Node (Government)', 'government@example.com', '$2b$12$L1G8IR0YQHU0A6Q2uXSBdu5LkVHXkq4PIHZOtL2a4I3kf2seabxTW', 'government'::user_role, NULL, NULL, '[]'::jsonb, 'active'::user_status),
  (gen_random_uuid(), 'Independent Evaluator', 'ie@example.com', '$2b$12$L1G8IR0YQHU0A6Q2uXSBdu5LkVHXkq4PIHZOtL2a4I3kf2seabxTW', 'ie'::user_role, NULL, NULL, '[]'::jsonb, 'active'::user_status);

-- Partner viewer (needs a seeded partner_org row — same script chain as geography demo).
INSERT INTO users (id, full_name, email, password_hash, role, partner_org_id, district_id, assigned_schools, status)
SELECT gen_random_uuid(), 'Partner Organization', 'partner@example.com',
       '$2b$12$L1G8IR0YQHU0A6Q2uXSBdu5LkVHXkq4PIHZOtL2a4I3kf2seabxTW',
       'partner'::user_role, po.id, NULL, '[]'::jsonb, 'active'::user_status
FROM partner_orgs po
ORDER BY po.created_at NULLS LAST
LIMIT 1
ON CONFLICT (email) DO NOTHING;

COMMIT;

-- Assign IE schools via Admin UI (PATCH /users/{id}/assigned-schools) or optional backfill SQL.
