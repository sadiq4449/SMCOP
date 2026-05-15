"""Role × API enforcement reference (Iterations 3–10).

This module documents how access is implemented so reviewers can compare routes to
the PRD matrix without spelunking every file.

Implemented enforcement
-----------------------
**Assignees** — ``GET /assignees``: ``SUPER_ADMIN`` or ``DEO`` with school access; ``purpose=task`` (principal/teacher) or ``purpose=issue`` (principal/DEO/super admin) for UI pickers.

**Users** — ``app.api.v1.users``:
  - List/create/get/patch/delete and generic ``PATCH /users/{id}``: ``SUPER_ADMIN`` only.
  - ``GET /users/assignment-candidates``: ``DEO`` only — field staff this district may assign (see ``app.services.user_school_assignment``).
  - ``PATCH /users/{id}/assigned-schools``: ``SUPER_ADMIN`` (full replace) or ``DEO`` (merge in-district schools, preserve out-of-district assignments); target role must be enumerator, principal, or teacher.
Mutations call ``app.services.audit.log_activity`` with structured metadata.

**Schools** — ``app.api.v1.schools``:
  - Writes (POST/PATCH/DELETE schools, enrollment, teachers): ``SUPER_ADMIN`` only.
  - Reads: any authenticated active user, scoped by ``app.services.school_access``:
      - ``SUPER_ADMIN``, ``GOVERNMENT``: all schools.
      - ``DEO``: schools whose UC lies in ``users.district_id`` (no rows if unset).
      - ``ENUMERATOR``, ``PRINCIPAL``, ``TEACHER``: intersection with ``assigned_schools``.

**Geography** — ``GET`` district/taluka/UC listing: authenticated.
``POST/PATCH/DELETE`` districts, talukas, and union councils: ``SUPER_ADMIN`` only (cannot delete nodes that still have schools under them).
``GET /ucs/{uc_id}/schools`` applies the same read scope as the schools list.

**Auth** — ``app.api.v1.auth``: login and refresh reject ``inactive`` users (401).

**Admin** — ``GET /admin/activity-logs``: ``SUPER_ADMIN`` only.

**Monitoring (Iteration 4)** — ``app.api.v1.kpis`` (catalog read, authenticated).
``app.api.v1.visits``: ``POST /visits`` only ``ENUMERATOR`` for schools in ``assigned_schools``.
``PATCH`` KPI/infrastructure/GPS/evidence blocked when ``status = finalized`` except ``SUPER_ADMIN``.
``GET /visits`` scoped via ``app.services.visit_access`` (DEO = district schools; Gov = all;
Enumerator = own visits + assigned schools; Principal/Teacher = assigned-school visits).
``GET /documents/{id}/download`` requires visit read access **or** observation read access when ``classroom_observation_id`` is set.

**Attendance (Iteration 6)** — ``app.api.v1.attendance``:
Writes blocked for Government/DEO/Enumerator. Principals + Super Admin submit bulk teacher attendance (auto-approved), approve pending rows, export CSV or Excel (``/attendance/export.csv``, ``/attendance/export.xlsx``).
Teachers submit only their linked teacher row (pending until principal approves); ``linked_teacher_id`` required on the user account.
Student aggregates via POST ``/attendance/student`` for Principals, Teachers, Super Admin within assigned schools.

**Reports (Iteration 7)** — ``app.api.v1.reports``:
Listing and row reads scoped via ``app.services.report_access.reports_select_filtered`` / ``can_read_report``.
``POST /reports`` and draft body edits: Super Admin, Enumerators, Principals with school access (no Government/DEO body writes).
``PATCH …/status`` approve/reject: DEO (district scope) and Super Admin; report must be ``submitted``.
Government: read list/detail, ``POST/GET …/comments``, ``GET …/export`` only—no PATCH on the report resource.
``GET /reports/compare`` (schools, same quarter), ``GET /reports/compare/districts`` (Government/Super Admin),
``GET /reports/compare/quarters`` (one school, multiple quarters) use the same visibility rules as report reads where applicable.
Approve/reject (``PATCH /reports/{id}/status``) requires ``submitted`` status for all roles including Super Admin.

**Dashboard (Iteration 8)** — ``app.api.v1.dashboard`` (read-only):
``GET /dashboard/system``: ``SUPER_ADMIN`` only — national totals + paginated district breakdown.
``GET /dashboard/government``: ``GOVERNMENT`` only — same roll-ups plus issues placeholder; no mutations.
``GET /dashboard/district``: ``DEO`` (implicit district) or ``GOVERNMENT``/``SUPER_ADMIN`` with ``district_id`` — pending work, low performers, facility gaps, school cards.
``GET /dashboard/school/{id}``: Super Admin, Government, DEO (school in district), Enumerator/Principal/Teacher with school access — attendance window, enrollment trend, visit/KPI history.
Aggregations use indexed ``visits.school_id`` / ``visits.quarter`` / geography joins; no response caching yet (PRD p95 on representative data).

**Issues & operations (Iteration 9)** — ``app.api.v1.issues``:
Create/list scoped by ``school_access``; roles: Super Admin, Government, DEO, Enumerator, Principal.
PATCH assignee or arbitrary status: Super Admin, DEO for schools in scope. Government cannot PATCH.
Principal / assigned Enumerator may set status to resolved/closed when allowed by ``issue_access``.

**Notifications** — ``app.api.v1.notifications``: authenticated user reads/updates only their rows.

**Tasks** — ``app.api.v1.tasks``: create Super Admin + DEO; list scoped by school/assignee; completion by assignee, Super Admin, or DEO in district.

**Announcements** — ``app.api.v1.announcements``: create Super Admin (optional national vs district) and DEO (district only); list filtered by viewer district/school scope.

**Auth recovery (Iteration 10 subset)** — ``POST /auth/forgot-password`` and ``POST /auth/reset-password`` are public; transactional email is best-effort when ``SMTP_*`` and ``PUBLIC_APP_URL`` are set.

**Webhooks (Iteration 10)** — ``/admin/webhooks`` Super Admin only; signed outbound POSTs from ``app.services.webhook_dispatch`` (non-blocking; subscribers should accept timeouts).

**Rate limit** — ``app.middleware.api_rate_limit.ApiRateLimitMiddleware`` applies to all paths under ``API_V1_PREFIX`` (separate tighter bucket for ``POST .../auth/login``).


PRD cross-check (API-CONTRACT §12)
----------------------------------
IE Enumerator / DEO cannot mutate schools or users in this codebase (403 on writes).
Principals cannot see schools outside ``assigned_schools`` for read endpoints that
list or load schools by id.
"""
