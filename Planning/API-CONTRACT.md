REST API Specification (Version 1.0)
School Monitoring, Classroom Observation & Reporting Portal

Auth Type: JWT (Bearer Token)
Response Format: JSON
Status Codes: 200, 201, 400, 401, 403, 404, 409, 500

1. Standard API Response Format
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {}
}
On Error:
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "field": "Invalid value"
  }
}
2. Authentication APIs
POST /auth/login

Login for all users.

Request
{
  "email": "user@example.com",
  "password": "123456"
}
Response
{
  "token": "jwt-token-here",
  "role": "super_admin",
  "user": {
    "id": 1,
    "name": "John Doe"
  }
}
3. User Management (Super Admin Only)
GET /users

List all system users (filter by role optional).

POST /users

Create new user.

PATCH /users/{id}

Update user details.

DELETE /users/{id}

Delete user.

4. Geographical Hierarchy APIs
District → Taluka → UC → School
GET /districts

List all districts.

GET /districts/{id}/talukas

List talukas under district.

GET /talukas/{id}/ucs

List UCs under taluka.

GET /ucs/{id}/schools

List schools under UC.

5. School Management APIs (Super Admin Only)
GET /schools

All schools.

POST /schools

Create school.

Body Example
{
  "emis_code": "12345",
  "school_name": "Govt Primary School",
  "district_id": 2,
  "taluka_id": 10,
  "uc_id": 48,
  "ppp_node": "Org-A"
}
PATCH /schools/{id}

Update school.

DELETE /schools/{id}

Delete school.

6. Monitoring Visit Module (IE Enumerator Only)
POST /visits

Create new quarterly monitoring visit.

Request
{
  "school_id": 44,
  "visit_date": "2026-01-15",
  "quarter": "Q1-2026"
}
Response
{
  "visit_id": 104
}
POST /visits/{visit_id}/kpis

Submit KPI scores.

Request
{
  "kpi_1": 3,
  "kpi_2": 4,
  "kpi_3": 5,
  "kpi_4": 2,
  "kpi_5": 1,
  "kpi_6": 4,
  "kpi_7": 5,
  "remarks": "School improving"
}
POST /visits/{visit_id}/evidence

Upload multiple photos/files.

GET /visits?school_id=44&quarter=Q1-2026

Retrieve previous visit history.

7. Classroom Observation APIs
POST /class-observation

Create observation.

Request
{
  "visit_id": 104,
  "teacher_name": "Ali Raza",
  "subject": "Math",
  "grade": "4",
  "score_engagement": 4,
  "score_pedagogy": 3,
  "score_environment": 5,
  "remarks": "Good teaching"
}
GET /class-observation?school_id=44

List observations per school.

8. Attendance Module
Teacher Attendance
POST /attendance/teacher
{
  "school_id": 44,
  "date": "2026-01-15",
  "teachers": [
    { "name": "Ayesha", "present": true },
    { "name": "Rizwan", "present": false }
  ]
}
Student Attendance
POST /attendance/student
{
  "school_id": 44,
  "date": "2026-01-15",
  "boys_present": 45,
  "girls_present": 38
}
GET /attendance/teacher?school_id=44&month=2026-01

Retrieve monthly teacher attendance.

9. Issue Reporting Module
POST /issues

Report an issue.

Request
{
  "school_id": 44,
  "category": "Infrastructure",
  "details": "Boundary wall damaged",
  "severity": "High"
}
GET /issues?school_id=44

View issues per school.

PATCH /issues/{id}

Change status → open, assigned, resolved, closed; optional `assigned_to_user_id` (Super Admin / DEO). Government may create and list issues but cannot PATCH.

9b. Notifications (Iteration 9)
GET /notifications/unread-count
GET /notifications?unread_only=&skip=&limit=
PATCH /notifications/{id}/read
POST /notifications/mark-all-read

9c. Operational tasks (Iteration 9)
POST /tasks — Super Admin, DEO (principal/teacher assignees within school scope)
GET /tasks?school_id=
PATCH /tasks/{id} — complete or edit (by assignee or author per rules)

9d. Announcements (Iteration 9)
POST /announcements — Super Admin (optional `district_id` for district broadcast), DEO (own district only)
GET /announcements

9e. Password recovery (Iteration 10 subset)
POST /auth/forgot-password `{ "email": "..." }` — always masked success; sends email when SMTP is configured (`SMTP_HOST`, `PUBLIC_APP_URL`).
POST /auth/reset-password `{ "token": "...", "password": "..." }`

9f. Webhooks (Iteration 10)
POST /admin/webhooks `{ "url": "https://...", "events": ["report_approved","visit_submitted","issue_resolved"] }` — Super Admin; response includes `secret` once.
GET /admin/webhooks
DELETE /admin/webhooks/{id}

Signed delivery: JSON body `{"event","occurred_at","data"}` with headers `X-SMOCP-Event`, `X-SMOCP-Signature: sha256=<hmac>` using the subscription secret.

API routes under `API_V1_PREFIX` are rate-limited per client IP (env `API_RATE_LIMIT_PER_MINUTE`, stricter `LOGIN_RATE_LIMIT_PER_MINUTE` for `POST .../auth/login`).
For Super Admin:
GET /dashboard/system

Returns:

total schools, visit counts (draft/finalized), optional quarter filter, paginated district completion/score breakdown, heatmap placeholder.

For Government (read-only):
GET /dashboard/government

National roll-up + paginated districts; `issues.open_count` counts open + assigned issues nationally.

For DEO:
GET /dashboard/district?quarter=

District inferred from user. Pending draft visits, submitted reports queue, low performers, facility-gap schools, paginated school cards.

For Government or Super Admin (single district):
GET /dashboard/district?district_id=<uuid>&quarter=

For any role with school access:
GET /dashboard/school/{id}?quarter=

Attendance aggregates for the quarter window (same calendar bounds as report snapshots), enrollment trend, recent visits, KPI trend series.

11. Report Generation APIs
POST /reports

IE creates report (per quarter or per visit).

Request
{
  "school_id": 44,
  "quarter": "Q1-2026",
  "summary": "School performance improving",
  "recommendations": "Need more teacher training"
}
GET /reports?school_id=44&quarter=Q1-2026

List/filter reports.

GET /reports/{id}

Single report (detail).

GET /reports/compare?quarter=Q1-2026&school_ids=<comma-separated school UUIDs>

School-vs-school metrics for one quarter (visibility matches school/report read scope).

GET /reports/compare/districts?quarter=Q1-2026&district_ids=<comma-separated district UUIDs>

District roll-ups for one quarter (Government and Super Admin only).

GET /reports/compare/quarters?school_id=<uuid>&quarters=Q1-2026,Q2-2026

Quarter-over-quarter metrics for one school.

PATCH /reports/{id}

Draft body edits; submit draft → submitted. Reopen rejected → draft (Super Admin only). Approve/reject only via PATCH /reports/{id}/status when the report is already submitted.

GET /reports/{id}/export?format=pdf|xlsx

Download export (authorized roles only).

PATCH /reports/{id}/status

DEO approves/rejects.

Request
{
  "status": "approved",
  "remarks": "Good report"
}
12. Role-Based Access Rules (API Enforcement)
Role	Allowed APIs	Restrictions
Super Admin	All endpoints	None
IE Enumerator	Visits, KPI, Observation	Cannot modify schools/users
Principal	Attendance, issues	Cannot see other schools
Teacher	Classroom attendance	No admin access
DEO	District-level data, approve reports	Cannot modify schools/users
Gov User	Read-heavy dashboards, reports, issues (create/list), notifications, announcements, tasks list	No PATCH on issues; no report body writes; no school/user mutations
13. Error Codes
Code	Meaning
400	Validation error
401	Unauthorized
403	Forbidden (role restriction)
404	Not found
409	Conflict (duplicate quarter visit)
500	Server error
14. Security Standards
JWT validated in every endpoint
Strict role-based middleware
File upload scanning
Password hashing
Audit logging for all modifications
15. Webhooks (implemented)

Events: `report_approved`, `visit_submitted`, `issue_resolved`. Configure via `/admin/webhooks` (Super Admin). HTTP POST to subscriber URL; verification via `X-SMOCP-Signature` HMAC-SHA256 of the raw JSON body with the subscription secret.