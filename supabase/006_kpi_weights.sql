-- EPIC 6: Add weight column to kpis for weighted aggregate score.
-- Idempotent so it can be re-applied per environment.

ALTER TABLE kpis
  ADD COLUMN IF NOT EXISTS weight numeric(5,2) NOT NULL DEFAULT 1.0;

UPDATE alembic_version
   SET version_num = '0010_kpi_weight'
 WHERE version_num <> '0010_kpi_weight';
