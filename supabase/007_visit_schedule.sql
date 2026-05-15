-- EPIC 3/16: Planned inspection schedule on visits (nullable until IE sets it).

ALTER TABLE visits ADD COLUMN IF NOT EXISTS scheduled_date date NULL;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS scheduled_time_start time NULL;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS scheduled_time_end time NULL;

CREATE INDEX IF NOT EXISTS ix_visits_scheduled_date ON visits (scheduled_date);

UPDATE alembic_version
   SET version_num = '0011_visit_schedule'
 WHERE version_num <> '0011_visit_schedule';
