import { matchPath } from 'react-router-dom'

/** Ordered most-specific first so dynamic segments resolve correctly. */
const ROUTE_TITLE_ENTRIES: { pattern: string; title: string }[] = [
  { pattern: '/dashboard/reports/compare', title: 'Compare reports' },
  { pattern: '/dashboard/reports', title: 'Reports' },
  { pattern: '/dashboard/users/new', title: 'Invite user' },
  { pattern: '/dashboard/users/:userId/edit', title: 'Edit user' },
  { pattern: '/dashboard/users', title: 'Users' },
  { pattern: '/dashboard/ie-assignments', title: 'Evaluator assignments' },
  { pattern: '/dashboard/audit-log', title: 'Audit log' },
  { pattern: '/dashboard/partner-orgs', title: 'Partner organizations' },
  { pattern: '/dashboard/geography', title: 'Geography' },
  { pattern: '/dashboard/schools/new', title: 'Add school' },
  { pattern: '/dashboard/schools/:schoolId/edit', title: 'Edit school' },
  { pattern: '/dashboard/schools/:schoolId', title: 'School details' },
  { pattern: '/dashboard/schools', title: 'Schools' },
  { pattern: '/dashboard/settings', title: 'Settings' },
  { pattern: '/dashboard/districts', title: 'Districts' },
  { pattern: '/dashboard/monitoring/new', title: 'New monitoring visit' },
  { pattern: '/dashboard/monitoring/:visitId', title: 'Monitoring visit' },
  { pattern: '/dashboard/monitoring', title: 'Monitoring visits' },
  { pattern: '/dashboard/visit-calendar', title: 'Visit calendar' },
  { pattern: '/dashboard/assigned-schools', title: 'Assigned schools' },
  { pattern: '/dashboard/issues', title: 'Issues & tasks' },
  { pattern: '/dashboard/observations', title: 'Observations' },
  { pattern: '/dashboard', title: 'Dashboard' },
]

export function pageTitleForPath(pathname: string): string {
  for (const { pattern, title } of ROUTE_TITLE_ENTRIES) {
    if (matchPath({ path: pattern, end: true }, pathname)) return title
  }
  return 'Portal'
}
