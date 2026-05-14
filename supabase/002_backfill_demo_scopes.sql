-- Optional: link seeded demo users to real geography/school rows so scoped APIs work.
-- Run in Supabase SQL Editor after geography and at least one school exist.
-- Idempotent for the emails/conditions below.

-- DEO: needs district_id or district-scoped lists return empty
UPDATE users
SET district_id = (SELECT id FROM districts ORDER BY name LIMIT 1)
WHERE email = 'deo@example.com'
  AND district_id IS NULL
  AND EXISTS (SELECT 1 FROM districts LIMIT 1);

-- Field roles: need assigned_schools JSON array of school UUID strings
UPDATE users
SET assigned_schools = (
  SELECT COALESCE(jsonb_agg(s.id::text), '[]'::jsonb)
  FROM (SELECT id FROM schools ORDER BY name LIMIT 1) AS s(id)
)
WHERE email IN ('principal@example.com', 'enumerator@example.com', 'teacher@example.com')
  AND EXISTS (SELECT 1 FROM schools LIMIT 1)
  AND (assigned_schools IS NULL OR assigned_schools = '[]'::jsonb);
