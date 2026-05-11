# Iteration 6 — Teacher & Student Attendance

## Goal

Record daily and monthly attendance for teachers and students, with principal approval and exportable summaries.

## Source references

- `Planning/PRD.md` — §3.4 Attendance Module
- `Planning/Feature.md` — §7 Attendance Module, §6–7 Teacher/Student management
- `Planning/API-CONTRACT.md` — §8 Attendance Module
- `Planning/TECHNICAL-DESIGN.md` — §3.5 Attendance System
- `Planning/USER-STORIES.md` — Principal §4.3; Teacher §5.1; Government §2.3 read-only attendance

## In scope

- Teacher attendance: daily marks per teacher, present/absent (and optional remarks)
- Student attendance: daily aggregates or class-level marks (align with API contract: boys/girls present or per-class rows)
- Teacher self-attendance entry for Teacher role
- Principal approval workflow for teacher attendance (status: pending / approved)
- Monthly retrieval APIs: `GET /attendance/teacher?school_id=&month=`
- Date-range filters and school-scoped access for Principal and Teacher
- Government read-only attendance views and summaries
- Export attendance summary (CSV/Excel) for Principal and Super Admin
- Optional photo verification field on teacher attendance (store URL reference)

## Out of scope

- GPS tagging for teacher attendance (enumerator-only field visits; optional later)
- SMS absentee alerts (Iteration 9)
- Biometric integrations

## Deliverables

| Layer | Deliverable |
| --- | --- |
| API | `POST /attendance/teacher`, `POST /attendance/student`, monthly GET endpoints |
| Database | `attendance_records` (or normalized teacher/student attendance tables per implementation) |
| Frontend | Teacher mark attendance UI; Principal approval queue; monthly summary views |
| Reports | Server-side aggregation for month/quarter totals |

## User stories covered

- As a Teacher, I want to mark student attendance and my self-attendance.
- As a Principal, I want to approve teacher attendance and monitor attendance trends.
- As a Government User, I want to view timetables, attendance, and teacher profiles without modifying them.

## Acceptance criteria

- Teachers can only submit attendance for their assigned school/classes.
- Principal can approve or reject pending teacher attendance for their school.
- Duplicate attendance for same teacher/school/date is rejected or upserted per defined rule.
- Government users have read-only API access and no mutation controls.
- Monthly summary returns consistent totals with daily records.

## Depends on

Iterations 1–3 (users, schools, assignments); Iteration 2 (teachers).

## Unblocks

Principal dashboard attendance widgets (Iteration 8) and attendance sections in reports (Iteration 7).
