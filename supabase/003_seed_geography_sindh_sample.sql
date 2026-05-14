-- Idempotent geography seed (Sindh-style sample hierarchy).
-- Run in Supabase SQL Editor after 000_schema_from_alembic.sql (or Alembic).
-- Safe to re-run: skips rows that already match by district/taluka/UC name.

-- Districts (unique code required when set; use short codes)
INSERT INTO districts (id, name, code)
SELECT gen_random_uuid(), v.name, v.code
FROM (VALUES
  ('Karachi East', 'KHI-EAST'),
  ('Hyderabad', 'HYD-SN'),
  ('Badin', 'BADIN'),
  ('Sukkur', 'SUKKUR'),
  ('Thatta', 'THATTA')
) AS v(name, code)
WHERE NOT EXISTS (SELECT 1 FROM districts d WHERE d.name = v.name);

-- Talukas
INSERT INTO talukas (id, district_id, name)
SELECT gen_random_uuid(), d.id, v.taluka
FROM districts d
JOIN (VALUES
  ('Karachi East', 'Gulshan-e-Iqbal'),
  ('Karachi East', 'Jamshed Town'),
  ('Hyderabad', 'Latifabad'),
  ('Hyderabad', 'Qasimabad'),
  ('Badin', 'Badin'),
  ('Badin', 'Matli'),
  ('Sukkur', 'Rohri'),
  ('Sukkur', 'Sukkur City'),
  ('Thatta', 'Thatta'),
  ('Thatta', 'Mirpur Sakro')
) AS v(district_name, taluka)
  ON d.name = v.district_name
WHERE NOT EXISTS (
  SELECT 1 FROM talukas t
  WHERE t.district_id = d.id AND t.name = v.taluka
);

-- Union councils
INSERT INTO union_councils (id, taluka_id, name)
SELECT gen_random_uuid(), t.id, v.uc_name
FROM talukas t
JOIN districts d ON t.district_id = d.id
JOIN (VALUES
  ('Karachi East', 'Gulshan-e-Iqbal', 'UC-01 Gulshan'),
  ('Karachi East', 'Gulshan-e-Iqbal', 'UC-02 Gulshan'),
  ('Karachi East', 'Jamshed Town', 'UC Jamshed Quarters'),
  ('Hyderabad', 'Latifabad', 'UC Latifabad 1'),
  ('Hyderabad', 'Latifabad', 'UC Latifabad 2'),
  ('Hyderabad', 'Qasimabad', 'UC Qasimabad'),
  ('Badin', 'Badin', 'Badin UC 1'),
  ('Badin', 'Badin', 'Badin UC 2'),
  ('Badin', 'Matli', 'Matli UC'),
  ('Sukkur', 'Rohri', 'Rohri UC'),
  ('Sukkur', 'Sukkur City', 'Sukkur City UC'),
  ('Thatta', 'Thatta', 'Thatta UC'),
  ('Thatta', 'Mirpur Sakro', 'Mirpur Sakro UC')
) AS v(district_name, taluka_name, uc_name)
  ON d.name = v.district_name AND t.name = v.taluka_name
WHERE NOT EXISTS (
  SELECT 1 FROM union_councils u
  WHERE u.taluka_id = t.id AND u.name = v.uc_name
);
