# Iteration 5 — Classroom Observations & Instruction Quality

## Goal

Capture structured classroom observations during monitoring visits and expose them for DEO review and historical comparison.

## Source references

- `Planning/PRD.md` — §3.3 Classroom Observation Module
- `Planning/Feature.md` — §9 Surveys & Forms Engine (observation template), §16 Multimedia Evidence
- `Planning/API-CONTRACT.md` — §7 Classroom Observation APIs
- `Planning/DB-SCHEMA.md` — `classroom_observations`, link to `visits` and `teachers`
- `Planning/USER-STORIES.md` — Enumerator evidence stories; DEO monitoring review

## In scope

- Observation records tied to `visit_id` and `teacher_id` (or teacher name fallback before full teacher linkage)
- Fields: subject, grade, observation date, rubric scores (engagement, pedagogy, environment, etc.), strengths, weaknesses, recommendations
- Enumerator-only create/update before visit finalization
- Photo attachments on observations (reuse document upload from Iteration 4)
- List observations by school and by visit
- DEO district read and review UI (comments optional if stored as metadata)
- Principal read-only view for their school’s observations
- Government read-only observation list on school profile

## Out of scope

- Dynamic form builder for arbitrary observation templates (fixed rubric in this iteration)
- Video upload (optional future)
- Automated lesson-quality AI scoring

## Deliverables

| Layer | Deliverable |
| --- | --- |
| API | `POST /class-observation`, `GET /class-observation?school_id=` |
| Database | `classroom_observations` with FK integrity to visits/teachers |
| Frontend | Observation form inside visit flow; school-level observation history |
| RBAC | Enumerator write; DEO/Principal/Government read within scope |

## User stories covered

- As an Enumerator, I want to observe teachers inside classrooms with indicators and evidence.
- As a DEO, I want to review enumerator visit reports including classroom observations.
- As a Government User, I want to view school visit and observation data read-only.

## Acceptance criteria

- Observations cannot be added to another enumerator’s visit without permission.
- Each observation is associated with exactly one visit and one teacher record where teacher exists.
- Scores and narrative fields persist and appear on school monitoring history.
- Government and Principal users cannot POST/PATCH observation endpoints.
- Observation list supports filter by school and quarter via visit linkage.

## Depends on

Iteration 4 (visits, evidence uploads), Iteration 2 (teachers).

## Unblocks

Instruction-quality analytics on dashboards (Iteration 8) and report summaries (Iteration 7).
