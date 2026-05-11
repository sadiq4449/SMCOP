# Iteration 1 — Foundation, Auth & App Shell

## Goal

Stand up the full-stack baseline so every later module shares the same security model, API conventions, database access, and portal chrome.

## Source references

- `Planning/PRD.md` — §5.1 Authentication, §5.2 Navigation, §6.2 Security
- `Planning/TECHNICAL-DESIGN.md` — §1–2 Architecture & stack, §3.1–3.2 Auth & RBAC, §5 Frontend, §9 Security
- `Planning/API-CONTRACT.md` — §1 Response format, §2 Authentication
- `Planning/DB-SCHEMA.md` — `users`, `activity_logs`
- `Planning/colortheme.md` — full palette and layout direction
- `Planning/USER-STORIES.md` — §7.1 Authentication (shared)

## In scope

- Monorepo or split repo layout: React (Vite) + FastAPI + PostgreSQL
- Environment configuration for local dev and Render deployment targets
- PostgreSQL connection, SQLAlchemy base models, migration workflow
- JWT login, token validation, refresh-token rotation (if included in v1 auth design)
- Password hashing (bcrypt), login/logout API, authenticated session on the client
- RBAC middleware skeleton with roles: Super Admin, Government, DEO, Enumerator, Principal, Teacher
- Standard JSON API envelope (`success`, `message`, `data`, `errors`)
- Versioned API prefix (`/api/v1/`)
- React app shell: login page, protected routes, role-aware sidebar layout, responsive frame
- Tailwind theme tokens mapped from `colortheme.md` (primary blue `#1E3A8A`, backgrounds, text, status colors)
- Basic audit logging for auth events (login success/failure)
- CI/CD skeleton (GitHub Actions build + deploy hooks)

## Out of scope

- School, visit, attendance, report, or dashboard business features
- File uploads and object storage
- Email/SMS notifications
- Two-factor authentication (future phase)

## Deliverables

| Layer | Deliverable |
| --- | --- |
| Backend | FastAPI app structure (`main`, `core`, `api`, `models`, `schemas`, `middleware`) |
| Backend | `POST /api/v1/auth/login` and authenticated `GET /api/v1/auth/me` (or equivalent) |
| Backend | Role guard decorator/middleware used by at least one protected sample route |
| Database | `users` table aligned with `DB-SCHEMA.md` (role enum, status, timestamps) |
| Database | `activity_logs` table for auth and admin actions |
| Frontend | Login screen, auth context, Axios client with bearer token |
| Frontend | Empty dashboard route per role with sidebar + header only |
| Ops | Documented env vars; deployable empty portal to Render/Vercel |

## User stories covered

- As any user, I want to log in securely to protect my data.
- As any user, I want a role-based view upon login (shell only in this iteration).

## Acceptance criteria

- Valid credentials return JWT; invalid credentials return `401` with standard error body.
- Protected endpoints reject missing/invalid tokens and wrong roles with `401`/`403`.
- Frontend blocks unauthenticated navigation and shows role-appropriate sidebar items (placeholders allowed).
- UI uses the government ERP palette from `colortheme.md` on login and shell pages.
- Passwords are never stored in plain text.
- A new environment can be provisioned from documented steps without undocumented manual fixes.

## Depends on

None (first iteration).

## Unblocks

All subsequent iterations.
