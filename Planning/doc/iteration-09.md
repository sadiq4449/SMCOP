# Iteration 9 — Issues, Tasks & Notifications

## Goal

Close the operational loop with issue tracking, assignments to Principals/DEOs, and in-app (and email) alerts for pending work.

## Source references

- `Planning/PRD.md` — §3.6 Issue Tracking, §3.8 Notifications
- `Planning/Feature.md` — §11 Task & Issue Management, §12 Notifications, §13 Communication
- `Planning/API-CONTRACT.md` — §9 Issue Reporting Module
- `Planning/DB-SCHEMA.md` — `notifications`, `activity_logs`
- `Planning/USER-STORIES.md` — §8.3 Issue Tracking; §7.2 Notifications; Government §2.2 flags

## In scope

- Issue entity: school, category (Infrastructure / Teachers / Students / Facility), details, severity, status (open, assigned, resolved, closed)
- `POST /issues`, `GET /issues`, `PATCH /issues/{id}` for status and assignee
- Assign issues to Principal or DEO; Government view-only status
- Enumerator and Government ability to raise flags/issues per permission policy
- Task assignment from DEO/Super Admin to Principal/Teacher with due dates and completion state
- In-app notifications (`notifications` table): unread count, mark read, list by user
- Email notifications for critical events (report pending approval, issue assigned, visit submitted)
- Notification triggers: pending approvals, report status changes, issue escalation
- Optional circular/announcement broadcast to schools in a district (basic MVP: title, body, attachment link)

## Out of scope

- SMS/WhatsApp alerts (optional future)
- Full messaging threads between schools and district (stretch beyond basic announcements)
- Complex workflow engine with arbitrary states

## Deliverables

| Layer | Deliverable |
| --- | --- |
| API | Issues CRUD/status per contract; notification read APIs |
| Database | Issues/tasks tables; `notifications` as per schema |
| Frontend | Issue list/detail; create issue; assign/resolve UI; notification bell |
| Integrations | Email provider configuration for transactional messages |

## User stories covered

- As a system user, I want to open and track issues such as missing facilities or teacher gaps.
- As a DEO, I want to assign improvement tasks to Principals when issues are detected.
- As a Government User, I want to raise flags for underperforming schools and view issue status.
- As any user, I want notifications for tasks, approvals, or alerts.

## Acceptance criteria

- Issue visibility respects school/district scope for Principal and DEO.
- Government cannot change issue assignment but can view status (and create flags if policy enabled).
- Status transitions are audited in `activity_logs`.
- Users receive in-app notification when assigned an issue or task.
- Email sends on configured events without blocking API success path (async or queue acceptable).

## Depends on

Iterations 1–3 (users/RBAC), Iteration 2 (schools); benefits from Iterations 7–8 for approval-driven alerts.

## Unblocks

Operational readiness for field and district teams; optional webhook layer later.
