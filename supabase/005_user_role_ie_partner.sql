-- Extend auth roles for SMCOP scope (run once after older snapshots).

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'ie';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'partner';

UPDATE users SET role = 'ie'::user_role WHERE role::text = 'enumerator';
UPDATE users SET role = 'partner'::user_role
WHERE role::text IN ('principal', 'teacher') AND partner_org_id IS NOT NULL;
UPDATE users SET role = 'government'::user_role
WHERE role::text IN ('deo', 'principal', 'teacher');
