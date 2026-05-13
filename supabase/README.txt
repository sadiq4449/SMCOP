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

   Vercel Root Directory + framework (critical for login / API):
   - Root Directory must be the git repository root (e.g. "." or empty), not "frontend", or `api/index.py` is not deployed.
   - Static output must live in repo-root **`public/`** (build copies `frontend/dist` there). Using only `frontend/dist` as
     `outputDirectory` can deploy as a static-only app so **`vercel.json` rewrites never reach** the Python function — then
     `/health/db` loads the React bundle. This repo uses `outputDirectory: "public"` plus a build step that copies Vite output.
   - Production SPA calls the API under **`/svc/v1`** (see `vercel.json` rewrite + backend default when `VERCEL` is set) so
     browser traffic does not use **`/api/v1`**, which Vercel often resolves as static filesystem routes and returns 405.
   - If Framework Preset is **Vite**, Vercel may ignore root `vercel.json` rewrites — then GET `/health/db` returns `index.html`.
     Use dashboard **Other** (no auto-detect), or keep this repo’s `vercel.json` with `"framework": null` — never the string
     `"framework": "other"` (invalid JSON, deployment fails). Disable dashboard overrides for Build / Output if needed.
     Redeploy; purge CDN cache if `/health/db` still serves HTML.

   If `/health/schema` shows `public_table_count: 0`, Vercel is pointing at a different empty DB than the project where you
   ran SQL. Use the URI from the SAME Supabase project (pooler username looks like `postgres.PROJECT_REF` matching your ref).

4) CORS: add your frontend origin (e.g. https://smcop-portal.vercel.app) to CORS_ORIGINS.

Regenerate 000_schema_from_alembic.sql after new Alembic revisions:
  cd backend
  set DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/postgres
  alembic upgrade head --sql > ../supabase/000_schema_from_alembic.sql
