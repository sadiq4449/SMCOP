# Delivery iterations

Build sequence for the School Monitoring, Classroom Observation & Reporting Portal (SMOCP), derived from `Planning/PRD.md`, `Feature.md`, `USER-STORIES.md`, `TECHNICAL-DESIGN.md`, `DB-SCHEMA.md`, `API-CONTRACT.md`, and `colortheme.md`.

| Iteration | Focus | Depends on |
| --- | --- | --- |
| [01](iteration-01.md) | Foundation, auth, RBAC, app shell, design tokens | — |
| [02](iteration-02.md) | Geography, partner orgs, school registry | 01 |
| [03](iteration-03.md) | User admin and role assignments | 01, 02 |
| [04](iteration-04.md) | Quarterly monitoring visits and KPI scoring | 01–03 |
| [05](iteration-05.md) | Classroom observations | 02, 04 |
| [06](iteration-06.md) | Teacher and student attendance | 01–03 |
| [07](iteration-07.md) | Reports, DEO approval, exports, comparisons | 04–06 |
| [08](iteration-08.md) | Role dashboards and analytics | 04–07 |
| [09](iteration-09.md) | Issues, tasks, notifications | 01–03; best after 07–08 |
| [10](iteration-10.md) | Phase 2 optional features and hardening | 01–09 |

Iterations 1–9 target MVP. Iteration 10 holds deferred PRD and technical-design items (offline mode, 2FA, dynamic forms, AI, mobile, webhooks).

Each iteration file lists scope, deliverables, mapped user stories, acceptance criteria, and upstream dependencies.
