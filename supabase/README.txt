Supabase setup (you create the project in the dashboard; we cannot do that from the IDE).

1) Create a project: https://supabase.com/dashboard → New project → choose region/password.

2) Create tables (pick ONE):

   A) Alembic (recommended — same version tracking as local dev)
      - Supabase → Project Settings → Database → Connection string → URI.
      - Use "Session pool" / port 6543 for Vercel; use "Direct" / 5432 for local Alembic if you prefer.
      - Put the URI in backend/.env as DATABASE_URL (or SUPABASE_DATABASE_URL).
        Example shape: postgresql://postgres.PROJECT_REF:YOUR_PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres
      - From repo: cd backend && alembic upgrade head

   B) SQL Editor (no Alembic on your machine)
      - Supabase → SQL → New query → paste contents of 000_schema_from_alembic.sql → Run.

   Optional demo login rows if `/health/schema` shows users_row_count: 0 (startup seed did not run on serverless):
      - Run 001_seed_demo_users.sql in the SQL Editor (idempotent). Password for each demo email: Password123!

3) App / Vercel env vars (same URL/password as above, one of):
   DATABASE_URL=...
   or SUPABASE_DATABASE_URL=...
   or SUPABASE_DB_URL=...
   The app also accepts POSTGRES_URL / POSTGRES_PRISMA_URL (names used by the Vercel Supabase integration).

   NOTE: `vercel env pull` often shows linked Postgres vars as empty placeholders locally — secrets still inject at
   runtime on Vercel. If the runtime lacks POSTGRES_* vars for Python, add DATABASE_URL manually in the Vercel dashboard:
   Supabase → Project Settings → Database → Connect → Direct → URI (match port to the mode shown: transaction pooler
   often 6543; session pooler often 5432 on the pooler host).

   After saving env vars, assign them to Production (and Preview if you use preview URLs), then Redeploy. Open
   `/health/env` — `any_database_env_set` must be true — and `/health/db` for a short connection error line if login fails.
   Encode special characters in the DB password inside the URI (`&` `#` `*` etc.).

   Vercel Root Directory (critical for login / API):
   If Project Settings → General → Root Directory is set to "frontend" (or any subfolder), files OUTSIDE that folder
   are not deployed — including repo-root `api/index.py` and root `vercel.json` may not apply. Then `/api/v1/*` and
   `/health/*` behave like the SPA: GET returns small `index.html`, POST /auth/login returns 405, and the UI shows a
   generic "Login failed". Fix: set Root Directory to empty (use the git repository root). Keep build as
   `cd frontend && npm install && npm run build` and output `frontend/dist` (from root vercel.json or dashboard).
   Redeploy, then open `/health/db` in the browser — you must see JSON, not an HTML page.

   If `/health/schema` shows `public_table_count: 0`, Vercel is pointing at a different empty DB than the project where you
   ran SQL. Use the URI from the SAME Supabase project (pooler username looks like `postgres.PROJECT_REF` matching your ref).

4) CORS: add your frontend origin (e.g. https://smcop-portal.vercel.app) to CORS_ORIGINS.

Regenerate 000_schema_from_alembic.sql after new Alembic revisions:
  cd backend
  set DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/postgres
  alembic upgrade head --sql > ../supabase/000_schema_from_alembic.sql
