# SMCOP Feature Status Matrix

Status against [Planning/updated_feature_epic_user_stories.md](./updated_feature_epic_user_stories.md), aligned with the four-role PPP model from [exective_summary.md](./exective_summary.md) and [prob_statment.md](./prob_statment.md).

Legend: ✅ Done · 🟡 Partial (gap noted) · ❌ Missing

| EPIC | Feature | Status | Notes / Gap |
| --- | --- | --- | --- |
| 1. Authentication & RBAC | Secure login, four roles, sessions | ✅ | Super Admin, PPP Node (Government), Independent Evaluator (IE), Partner. JWT + password reset live. |
| 2. Dashboard & Analytics | Role-based dashboards | ✅ | `DashboardPage` per role with animated KPI gauges. |
| 3. Visit Assignment Management | Schedule, reschedule, notify | 🟡 | Schools-to-IE mapping + **`scheduled_date` / optional `scheduled_time_*` on visits**, list filters (`scheduled_month`, `unscheduled`), `notify_visit_scheduled`; IE creates/edits schedule from visit form. Gap: Super Admin “schedule on behalf of IE” UX (IE-only today). |
| 4. Inspection Management | Digital inspection capture | ✅ | `VisitFormPage`, drafts, finalize, KPI capture, classroom observations, remarks. |
| 5. Evidence Upload | Photos & docs per visit/observation | ✅ | `documents` table with optional S3 presigned upload. |
| 6. KPI & Scoring Engine | Configurable KPIs, weights, live score | 🟡→✅ | Seven KPIs aligned with exec summary; **`weight` column shipped this iteration**. Admin UI for editing weights pending. |
| 7. Auto Report Generation | Quarterly reports, exports | ✅ | Snapshot-based reports, PDF/XLSX, IE submit → Super Admin review. |
| 8. Findings Review | Severity, strengths/weaknesses | 🟡 | `issues` has severity; observation rubric covers strengths/weaknesses; **no consolidated findings page yet**. |
| 9. Action Plan Management | Tasks with owners, due dates | 🟡 | `work_tasks` exists; **no explicit `status` enum (open/in_progress/blocked/done) or partner self-update**. |
| 10. Progress Tracking | Completion %, overdue alerts | ❌ | Needs derived completion % per school + overdue flags + notifications. |
| 11. Quarterly Evaluation | Scorecards, district rankings, recurring issue analysis | 🟡 | Quarterly reports exist; **no district ranking endpoint or recurring-issue analytics**. |
| 12. School Profile Management | Centralized profile + trend | ✅ | `SchoolDetailPage` covers profile, enrollment, observations, attendance summary. |
| 13. Reports Center | Filter by district/quarter/school + archive | 🟡 | Quarter filter live; **no district/school filter combo yet**; archive uses status `rejected`/`approved`. |
| 14. Alerts & Risk Monitoring | Low-perf, overdue, missing-evidence alerts | ❌ | Notifications infrastructure ready; **no automated rules yet**. |
| 15. Benchmarking & Comparison | District/partner/observer benchmarks | 🟡 | Compare pages were removed in last refactor; **needs a leaner, scoped compare workspace**. |
| 16. Calendar & Scheduling | Monthly visit calendar | ✅ | **`VisitCalendarPage`** (`/dashboard/visit-calendar`): month grid + unscheduled drafts; nav for SA/government/IE/partner. |
| 17. Notifications Center | Real-time toasts + inbox | ✅ | Notification panel with portal + DEEP link refs. |
| 18. User & Partner Management | Manage NGO partners, school mapping, permission summary | ✅ | Partner orgs CRUD; user → school mapping; role descriptors in nav. |
| 19. Search & Filters | Advanced filters + global search | 🟡 | Per-page filters present; **no global header search yet**. |
| 20. Audit Logs & Activity Tracking | All user actions visible | ✅ | `activity_logs` populated; **`ActivityLogsPage` for Super Admin**. |

## Recommended next sprints (sized for a single PR each)

1. ~~**Visit scheduling + calendar**~~ — **Shipped** this iteration (backend schedule fields + notifications + calendar page). Next polish: SA schedules-for-IE flow if needed.
2. **Action plans status flow** (EPIC 9 + 10 + 14): `work_tasks.status` enum (`open|in_progress|blocked|done`), due-date overdue rule, automated notification when overdue or assigned, completion % per school.
3. **Findings consolidator** (EPIC 8): page that aggregates issues + observations into a severity-grouped findings view with auto strengths/weaknesses summary from observation rubric.
4. **Benchmark workspace** (EPIC 11 + 15): district ranking, NGO partner benchmark table, recurring-issue (most-frequent category over N quarters).
5. **Global search & reports filters** (EPIC 19 + 13): header omnibox (schools/visits/reports) and district+school filters in Reports Center.
6. **Smart alerts** (EPIC 14): rule engine emitting notifications for low-perf, overdue, and missing-evidence cases.

## Terminology mapping (doc → SMCOP role)

- **Observer** → Independent Evaluator (IE)
- **NGO Partner / Partner Organization** → Partner role
- **Government User / Reviewer** → PPP Node (Government) / Super Admin where data is mutated
- **School Representative** → out of scope for current four-role model (deferred; we'll route School Rep capabilities through Partner where the school sits inside a partner-managed network)
