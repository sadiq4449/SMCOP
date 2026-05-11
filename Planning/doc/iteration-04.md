# Iteration 4 — Quarterly Monitoring Visits & KPI Scoring

## Goal

Enable enumerators to conduct quarterly school visits, score KPIs, attach evidence, and persist visit history by quarter.

## Source references

- `Planning/PRD.md` — §3.2 Quarterly Monitoring, §5.3 Forms (draft), §5.4 Data Management
- `Planning/Feature.md` — §8 School Visit & Monitoring, §15 Infrastructure Tracking (checklist linkage)
- `Planning/API-CONTRACT.md` — §6 Monitoring Visit Module
- `Planning/DB-SCHEMA.md` — `visits`, `kpis`, `kpi_scores`, `infrastructure_checklist`, `documents`
- `Planning/USER-STORIES.md` — Enumerator §6.1–6.2; DEO §3.2 review visits

## In scope

- KPI master data (`kpis`): seven PRD categories with max scores and sort order
- Create visit per school per quarter; prevent duplicate quarter visit (`409`)
- KPI score submission per visit; remarks per KPI and visit-level remarks
- Auto-calculated aggregate monitoring score from KPI weights
- Save-as-draft and submit/finalize states for visit forms
- Evidence upload API (images; storage via S3/Cloudinary signed URLs)
- Infrastructure checklist rows per visit (available / not available / needs repair)
- Enumerator UI: assigned schools, visit form, photo upload, GPS capture field (store coordinates in metadata or dedicated columns)
- Visit history: `GET /visits?school_id=&quarter=`
- DEO read access to submitted visits in district (approve workflow in Iteration 7)

## Out of scope

- Classroom observation detail forms (Iteration 5)
- DEO approve/reject on formal reports (Iteration 7)
- Offline visit submission (Phase 2)
- AI photo-to-KPI detection (Phase 2)

## Deliverables

| Layer | Deliverable |
| --- | --- |
| API | `POST /visits`, `POST /visits/{id}/kpis`, `POST /visits/{id}/evidence`, visit list/detail |
| API | KPI catalog read for form rendering |
| Database | `visits`, `kpis`, `kpi_scores`, `infrastructure_checklist`, `documents` |
| Storage | Secure upload pipeline with access control |
| Frontend | Enumerator visit wizard/checklist UI with draft save |
| Business logic | Score aggregation service |

## User stories covered

- As an Enumerator, I want to see assigned schools so I know where to visit.
- As an Enumerator, I want to submit school visit forms with photos, GPS, notes, and ratings.
- As an Enumerator, I want to upload geo-tagged photos to verify my visit.
- As a DEO, I want to review enumerator visit reports for quality assurance (read-only until report approval in Iteration 7).

## Acceptance criteria

- Enumerator cannot create visits for schools outside `assigned_schools`.
- Second visit for same school/quarter returns `409`.
- Submitted visit stores all KPI scores and optional infrastructure checklist rows.
- Evidence files are linked to visit/school and retrievable by authorized roles only.
- Draft visits can be resumed; finalized visits are immutable except Super Admin override (policy flag).
- Historical visits remain queryable for later comparison dashboards.

## Depends on

Iterations 1–3 (auth, schools, user assignments).

## Unblocks

Classroom observations (Iteration 5), dashboards and reports (Iterations 7–8).
