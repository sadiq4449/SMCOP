# Iteration 3 — User Administration & Role Assignments

## Goal

Let Super Admin govern who can access the portal and which schools or districts each operational role may see.

## Source references

- `Planning/PRD.md` — §3.9 Role & Permission Management, §4 User Roles
- `Planning/Feature.md` — §1 User Roles & Permissions, §17 System Administration
- `Planning/API-CONTRACT.md` — §3 User Management, §12 Role-Based Access Rules
- `Planning/DB-SCHEMA.md` — `users` (role, `partner_org_id`, `assigned_schools`), permission model
- `Planning/USER-STORIES.md` — Super Admin §1.1, §1.3; DEO §3.1 assign enumerators

## In scope

- User CRUD for Super Admin: create, update, deactivate, delete
- Role assignment on user records
- Assign schools to Principals, Enumerators, and field monitors (`assigned_schools`)
- Assign district scope for DEO accounts
- Partner Admin scope via `partner_org_id` where applicable
- User list filters by role, status, district, partner
- Audit log entries for user create/update/delete and role changes
- Frontend admin screens: user list, user form, assignment pickers (schools, district)
- API enforcement matrix documented in code for at least schools and users modules

## Out of scope

- Custom permission builder UI beyond fixed role matrix
- Self-service password reset flow (can be stubbed; full flow optional here)
- SSO/OAuth

## Deliverables

| Layer | Deliverable |
| --- | --- |
| API | `GET/POST/PATCH/DELETE /users` with Super Admin-only writes |
| API | Assignment fields persisted and honored on school/visit list filters |
| Database | User fields aligned with schema; indexes on role and partner |
| Frontend | Super Admin user management module |
| Security | Audit trail for privileged user mutations |

## User stories covered

- As a Super Admin, I want to create, edit, and delete users.
- As a Super Admin, I want to assign roles so each user has proper permissions.
- As a Super Admin, I want to assign schools to Principals and DEOs (and enumerators).
- As a Super Admin, I want to view audit logs to track suspicious activity.
- As a DEO, I want to assign field enumerators for school visits (assignment data model ready; visit UI in Iteration 4).

## Acceptance criteria

- Only Super Admin can mutate users; other roles receive `403`.
- Deactivated users cannot authenticate.
- Enumerator school lists are limited to `assigned_schools`.
- DEO-scoped queries return only schools in the DEO district once district linkage is set.
- User changes produce `activity_logs` rows with actor, action, and target metadata.

## Depends on

Iteration 1 (auth/RBAC), Iteration 2 (schools and geography).

## Unblocks

Field workflows (monitoring, principal school ops) with correct data scope.
