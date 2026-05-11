# Iteration 10 — Phase 2 & Platform Hardening (Optional)

## Goal

Address PRD and technical design items deferred from MVP, harden production operations, and prepare for scale beyond initial Render deployment.

## Source references

- `Planning/PRD.md` — §6 Non-Functional Requirements, §9 Future Features
- `Planning/Feature.md` — §18 Future Enhancements
- `Planning/TECHNICAL-DESIGN.md` — §11–14 Deployment, logging, scalability, future enhancements
- `Planning/API-CONTRACT.md` — §15 Webhooks; 2FA noted as future in auth sections
- `Planning/DB-SCHEMA.md` — §6 Future Scalability

## In scope (pick per release train)

- Password recovery and optional two-factor authentication
- Offline visit form capture and sync for enumerators
- Dynamic forms/survey builder for monitoring templates (Feature §9)
- Timetable management (Principal edit, Government read-only)
- Lesson plans and student performance/grades (Teacher/Principal)
- Student promotion and merit lists
- Infrastructure asset register and incident reporting beyond visit checklist
- Webhooks: `report_approved`, `visit_submitted`, `issue_resolved`
- AI-assisted report summarization and attendance trend insights (pilot)
- Mobile app or PWA packaging for field use
- Rate limiting, WAF, and migration path from Render to AWS (or equivalent)
- Database partitioning/archival for 5+ years of quarterly data
- Celery/async workers for heavy exports and email
- Row-level security policies in PostgreSQL for defense in depth
- Automated backups, restore drills, and uptime monitoring

## Out of scope

- Items already delivered in Iterations 1–9 unless explicitly extended

## Deliverables

| Track | Example deliverable |
| --- | --- |
| Security | 2FA, password reset, hardened upload scanning |
| Field ops | Offline sync client strategy and conflict resolution |
| Product | Timetable, lesson plans, dynamic forms |
| Platform | Webhooks, async jobs, observability, backup runbooks |
| Intelligence | AI report draft from visit payload (human review required) |

## User stories covered

- Deferred stories from `USER-STORIES.md`: password recovery (§7.1), offline enumerator submit (§6.1), lesson plans and grades (Teacher §5.2), timetable views (Government §2.3), Super Admin custom forms (§1.4).

## Acceptance criteria

- Each Phase 2 feature ships with RBAC enforcement on API and UI, audit logging for mutations, and documentation of env/config changes.
- Non-functional targets from PRD re-validated after scale features (dashboard load, 10k schools data volume tests).
- Production checklist completed: backups, monitoring, incident response, and security review.

## Depends on

Stable MVP from Iterations 1–9.

## Unblocks

Long-term multi-partner expansion, mobile-first field adoption, and government transparency at scale.
