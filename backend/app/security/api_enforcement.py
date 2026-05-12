"""Role × API enforcement reference (Iterations 3–4).

This module documents how access is implemented so reviewers can compare routes to
the PRD matrix without spelunking every file.

Implemented enforcement
-----------------------
**Users** — ``app.api.v1.users``: all routes require ``UserRole.SUPER_ADMIN``.
Mutations call ``app.services.audit.log_activity`` with structured metadata.

**Schools** — ``app.api.v1.schools``:
  - Writes (POST/PATCH/DELETE schools, enrollment, teachers): ``SUPER_ADMIN`` only.
  - Reads: any authenticated active user, scoped by ``app.services.school_access``:
      - ``SUPER_ADMIN``, ``GOVERNMENT``: all schools.
      - ``DEO``: schools whose UC lies in ``users.district_id`` (no rows if unset).
      - ``ENUMERATOR``, ``PRINCIPAL``, ``TEACHER``: intersection with ``assigned_schools``.

**Geography** — ``GET /ucs/{uc_id}/schools`` applies the same read scope as the schools list.

**Auth** — ``app.api.v1.auth``: login and refresh reject ``inactive`` users (401).

**Admin** — ``GET /admin/activity-logs``: ``SUPER_ADMIN`` only.

**Monitoring (Iteration 4)** — ``app.api.v1.kpis`` (catalog read, authenticated).
``app.api.v1.visits``: ``POST /visits`` only ``ENUMERATOR`` for schools in ``assigned_schools``.
``PATCH`` KPI/infrastructure/GPS/evidence blocked when ``status = finalized`` except ``SUPER_ADMIN``.
``GET /visits`` scoped via ``app.services.visit_access`` (DEO = district schools; Gov = all;
Enumerator = own visits + assigned schools; Principal/Teacher = assigned-school visits).
``GET /documents/{id}/download`` requires visit read access **or** observation read access when ``classroom_observation_id`` is set.

**Attendance (Iteration 6)** — ``app.api.v1.attendance``:
Writes blocked for Government/DEO/Enumerator. Principals + Super Admin submit bulk teacher attendance (auto-approved), approve pending rows, export CSV.
Teachers submit only their linked teacher row (pending until principal approves); ``linked_teacher_id`` required on the user account.
Student aggregates via POST ``/attendance/student`` for Principals, Teachers, Super Admin within assigned schools.

PRD cross-check (API-CONTRACT §12)
----------------------------------
IE Enumerator / DEO cannot mutate schools or users in this codebase (403 on writes).
Principals cannot see schools outside ``assigned_schools`` for read endpoints that
list or load schools by id.
"""
