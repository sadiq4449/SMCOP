-- Demo schools + seeded teacher linked to demo teacher login (Iteration 6 self-attendance).
-- Run after 003_seed_geography_sindh_sample.sql (needs union_councils rows used below).
-- Run after 001_seed_demo_users.sql (updates teacher@example.com).
-- Idempotent: keyed by emis_code and teacher display name.

BEGIN;

INSERT INTO schools (id, emis_code, name, uc_id, level, gender, status)
SELECT gen_random_uuid(), v.emis, v.name, u.id,
  v.level::school_level,
  v.gender::school_gender,
  'active'::school_status
FROM (VALUES
  ('SMOCP-DEMO-001', 'SMOCP Demo Primary (Hyderabad)', 'UC Latifabad 1'::text, 'primary'::text, 'mixed'::text),
  ('SMOCP-DEMO-002', 'SMOCP Demo Middle (Karachi East)', 'UC-01 Gulshan'::text, 'middle'::text, 'girls'::text)
) AS v(emis, name, uc_name, level, gender)
JOIN union_councils u ON u.name = v.uc_name
WHERE NOT EXISTS (SELECT 1 FROM schools s WHERE s.emis_code = v.emis);

INSERT INTO teachers (id, school_id, name, gender, subject, status)
SELECT gen_random_uuid(), s.id, 'Demo Teacher (seeded)', 'male'::teacher_gender, 'General', 'active'::teacher_status
FROM schools s
WHERE s.emis_code = 'SMOCP-DEMO-001'
  AND NOT EXISTS (
    SELECT 1 FROM teachers t WHERE t.school_id = s.id AND t.name = 'Demo Teacher (seeded)'
  );

UPDATE users usr
SET linked_teacher_id = (
  SELECT t.id
  FROM teachers t
  JOIN schools s ON t.school_id = s.id
  WHERE s.emis_code = 'SMOCP-DEMO-001'
    AND t.name = 'Demo Teacher (seeded)'
  ORDER BY t.created_at
  LIMIT 1
)
WHERE usr.email = 'teacher@example.com'
  AND usr.linked_teacher_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM teachers t
    JOIN schools s ON t.school_id = s.id
    WHERE s.emis_code = 'SMOCP-DEMO-001'
      AND t.name = 'Demo Teacher (seeded)'
  );

COMMIT;
