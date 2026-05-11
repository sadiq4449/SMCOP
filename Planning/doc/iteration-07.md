# Iteration 7 — Reports, Approvals & Exports

## Goal

Turn visit and operational data into quarterly reports, route them through DEO approval, and expose read-only outputs to Government users with PDF/Excel export.

## Source references

- `Planning/PRD.md` — §3.5 Reporting Module, §5.6 Reporting
- `Planning/Feature.md` — §10 Reporting Module
- `Planning/API-CONTRACT.md` — §11 Report Generation APIs
- `Planning/DB-SCHEMA.md` — `reports` (extend schema as needed for status, quarter, school)
- `Planning/USER-STORIES.md` — Super Admin §1.2; Government §2.1–2.2; DEO §3.1; Principal §4.2

## In scope

- Report entity per school/quarter (or per visit) with summary, recommendations, status
- Create report from visit data (auto-generated sections from KPIs, observations, infrastructure)
- `PATCH /reports/{id}/status` — DEO approve/reject with remarks
- Super Admin override/edit on any report
- Government read-only report library with filters (district, school, quarter)
- Government comments on reports (read-only role except comment/flag endpoints if allowed by policy)
- Comparison views: school vs school, district vs district, quarter vs quarter (API + basic UI tables/charts)
- PDF and Excel export for authorized roles
- Principal submission of school-level compliance reports (infrastructure/daily activity) as inputs to district reporting where defined in PRD

## Out of scope

- AI-generated narrative summaries (Phase 2)
- Webhooks on report approval (optional future in API contract)

## Deliverables

| Layer | Deliverable |
| --- | --- |
| API | `POST /reports`, `GET /reports`, `PATCH /reports/{id}/status` |
| API | Comparison endpoints or query params for multi-entity/quarter compare |
| Backend | Report generation service assembling visit/KPI/attendance slices |
| Frontend | DEO approval queue; Government report browser; export actions |
| Export | PDF/Excel generation pipeline |

## User stories covered

- As a DEO, I want to approve or reject principal/enumerator reports so data remains accurate.
- As a Government User, I want to view school reports and compare districts.
- As a Government User, I want to add comments on reports and download documentation.
- As a Super Admin, I want to view and override any report and download full datasets.
- As a Principal, I want to submit infrastructure and daily school reports for compliance.

## Acceptance criteria

- Report status transitions follow allowed workflow (e.g. draft → submitted → approved/rejected).
- Government users cannot approve or edit report body fields.
- Approved reports are visible in Government portal with same quarter/school keys as visits.
- Export files match on-screen summary figures for the same filters.
- Comparison queries return aligned metrics for selected schools/districts/quarters.

## Depends on

Iterations 4–6 (visits, observations, attendance data).

## Unblocks

Executive dashboards (Iteration 8) and issue escalation tied to report findings (Iteration 9).
