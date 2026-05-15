-- Optional: link seeded IE to schools so visit APIs work.
-- Run after geography and at least one school exist.

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
WHERE email = 'ie@example.com'
  AND EXISTS (SELECT 1 FROM schools WHERE emis_code LIKE 'SMOCP-DEMO-%');

UPDATE users u
SET assigned_schools = COALESCE(
  (
    SELECT jsonb_agg(s.id::text)
    FROM (SELECT id FROM schools ORDER BY name LIMIT 1) AS s(id)
  ),
  '[]'::jsonb
)
WHERE email = 'ie@example.com'
  AND NOT EXISTS (SELECT 1 FROM schools WHERE emis_code LIKE 'SMOCP-DEMO-%')
  AND EXISTS (SELECT 1 FROM schools LIMIT 1)
  AND (assigned_schools IS NULL OR assigned_schools = '[]'::jsonb);
