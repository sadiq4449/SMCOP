# Iteration 2 — Geography, Partner Orgs & School Registry

## Goal

Model the District → Taluka → UC → School hierarchy and school master records so monitoring, attendance, and reporting can attach to stable school identities.

## Source references

- `Planning/PRD.md` — §3.1 School Management, §5.5 Search & Filters
- `Planning/Feature.md` — §4 School Management, §1.1 Super Admin school CRUD, §1.2 Government read-only
- `Planning/API-CONTRACT.md` — §4 Geographical Hierarchy, §5 School Management
- `Planning/DB-SCHEMA.md` — `partner_orgs`, `schools`, `school_enrollment`, `teachers`
- `Planning/USER-STORIES.md` — Super Admin §1.1 (schools, districts/clusters), Government §2.3 read-only profiles

## In scope

- Partner organization (`partner_orgs`) CRUD for Super Admin
- Geographic hierarchy APIs: districts, talukas, UCs, schools under UC
- School CRUD for Super Admin: EMIS code, name, location fields, level, gender, partner link, principal contact
- School list/detail with filters by district, taluka, UC, partner, status
- School enrollment snapshot per quarter (create/read; full edit rules can follow monitoring cadence)
- Teacher directory records per school (master list; attendance and observation link in later iterations)
- Government and Viewer read-only school browse and profile pages
- Row-level rules: Government cannot POST/PATCH/DELETE school endpoints
- Search and pagination on school lists

## Out of scope

- Assigning users to schools (Iteration 3)
- Visit/KPI data on school profiles
- GPS map UI and image galleries (fields may be stubbed)
- Bulk import/export of schools

## Deliverables

| Layer | Deliverable |
| --- | --- |
| API | `GET /districts`, nested taluka/UC/school list endpoints per contract |
| API | `GET/POST/PATCH/DELETE /schools` with Super Admin write enforcement |
| API | Partner org endpoints for Super Admin |
| Database | Tables: `partner_orgs`, `schools`, `school_enrollment`, `teachers` per schema |
| Frontend | School list, create/edit forms, read-only profile for Government |
| Frontend | Hierarchy filters on school list |

## User stories covered

- As a Super Admin, I want to manage schools (add/edit/delete) so school data stays current.
- As a Super Admin, I want to manage districts, clusters, and classes to control educational structures (geography + school structure in this iteration).
- As a Government User, I want to view school profiles without editing them.

## Acceptance criteria

- Super Admin can create a school with unique EMIS code; duplicate EMIS returns `409`.
- Government user receives `403` on school mutation APIs and sees no edit controls in UI.
- Schools can be filtered by district/taluka/UC and opened in a detail view.
- Partner org linkage appears on school records where applicable.
- Enrollment and teacher rows are scoped to a school and retrievable via API.

## Depends on

Iteration 1 (auth, RBAC, app shell).

## Unblocks

User assignment (Iteration 3), visits (Iteration 4), attendance (Iteration 6).
