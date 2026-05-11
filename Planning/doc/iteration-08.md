# Iteration 8 — Role Dashboards & Analytics

## Goal

Deliver role-specific dashboards with KPI charts, trends, and operational snapshots so each stakeholder can monitor performance without ad-hoc queries.

## Source references

- `Planning/PRD.md` — §3.7 Dashboard & Analytics, §6.1 Performance
- `Planning/Feature.md` — §3 Dashboard & Analytics
- `Planning/API-CONTRACT.md` — §10 Analytics & Dashboard APIs
- `Planning/TECHNICAL-DESIGN.md` — §10 Performance Optimization (caching, pagination)
- `Planning/USER-STORIES.md` — §8.1 Dashboards; role-specific dashboard stories in §1–4

## In scope

- `GET /dashboard/system` — Super Admin: totals, district breakdown, visit completion, heatmap placeholders
- `GET /dashboard/district` — DEO: pending visits/approvals, low performers, facility gaps
- `GET /dashboard/school/{id}` — Principal: attendance, visit history, KPI trends
- Government dashboard — read-only district KPIs, visit summary, issue overview (issues detailed in Iteration 9)
- Chart components: KPI trends, enrollment, attendance, monitoring completion
- Cached or materialized metrics for dashboard load under 3 seconds (PRD NFR)
- Pagination and indexed queries on dashboard feeds
- Mobile-responsive dashboard layouts using `colortheme.md` status colors for indicators

## Out of scope

- Custom KPI builder for Super Admin (defer unless timeboxed stretch)
- Predictive analytics and AI trend detection (Phase 2)

## Deliverables

| Layer | Deliverable |
| --- | --- |
| API | Role-scoped dashboard endpoints with enforced filters |
| Backend | Aggregation queries/services with indexes on `school_id`, `district_id`, `quarter` |
| Frontend | Four dashboard experiences (Super Admin, DEO, Principal, Government) |
| Performance | Measured p95 load target documented for representative dataset |

## User stories covered

- As a Super Admin, I want analytics for all districts to evaluate system-wide performance.
- As a DEO, I want district-level dashboards to track KPIs and pending work.
- As a Principal, I want school-level analytics to identify gaps.
- As a Government User, I want district dashboards and high-level performance indicators.
- As a system user, I want charts and analytics to understand performance visually.

## Acceptance criteria

- Each role sees only data permitted by RBAC and assignment scope.
- Dashboard APIs return consistent figures with underlying report/visit/attendance APIs for the same filters.
- Government dashboard has no mutation actions.
- Primary dashboard views load within PRD target on seeded benchmark data.
- Empty states and zero-data quarters render without errors.

## Depends on

Iterations 4–7 (source metrics and approved reports).

## Unblocks

Iteration 9 notification triggers based on dashboard thresholds (optional).
