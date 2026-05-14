-- Optional: link seeded demo users to real geography/school rows so scoped APIs work.
-- Run in Supabase SQL Editor after geography and at least one school exist.
-- Idempotent for the emails/conditions below.

-- DEO: needs district_id or district-scoped lists return empty
UPDATE users
SET district_id = (SELECT id FROM districts ORDER BY name LIMIT 1)
WHERE email = 'deo@example.com'
  AND district_id IS NULL
  AND EXISTS (SELECT 1 FROM districts LIMIT 1);

-- Field roles: assigned_schools JSON array of school UUID strings as text.
-- When SMOCP-DEMO-* schools exist, merge them into whatever is already assigned (dedupe).
UPDATE users u
SET assigned_schools = (
  SELECT COALESCE(jsonb_agg(v ORDER BY v), '[]'::jsonb)
  FROM (
    SELECT t.elem AS v
    FROM jsonb_array_elements_text(COALESCE(u.assigned_schools, '[]'::jsonb)) AS t(elem)
    UNION
    SELECT s.id::text AS v
    FROM schools s
    WHERE s.emis_code LIKE 'SMOCP-DEMO-%'
  ) x(v)
)
WHERE email IN ('principal@example.com', 'enumerator@example.com', 'teacher@example.com')
  AND EXISTS (SELECT 1 FROM schools WHERE emis_code LIKE 'SMOCP-DEMO-%');

-- No demo-coded schools: first-time backfill only (single school).
UPDATE users
SET assigned_schools = COALESCE(
  (
    SELECT jsonb_agg(s.id::text)
    FROM (SELECT id FROM schools ORDER BY name LIMIT 1) AS s(id)
  ),
  '[]'::jsonb
)
WHERE email IN ('principal@example.com', 'enumerator@example.com', 'teacher@example.com')
  AND NOT EXISTS (SELECT 1 FROM schools WHERE emis_code LIKE 'SMOCP-DEMO-%')
  AND EXISTS (SELECT 1 FROM schools LIMIT 1)
  AND (assigned_schools IS NULL OR assigned_schools = '[]'::jsonb);
