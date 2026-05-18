import type { UserRole } from '../types/auth'

export interface NavItem {
  label: string
  path: string
  /** Shown as native tooltip for extra context */
  hint?: string
}

export interface NavSection {
  title: string
  items: NavItem[]
}

export const roleLabels: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  government: 'PPP Node (Government)',
  ie: 'Independent Evaluator',
  partner: 'Partner organization',
}

const dash: NavItem = {
  label: 'Dashboard',
  path: '/dashboard',
  hint: 'Summary KPIs and charts for your role',
}

const issues: NavItem = {
  label: 'Issues & tasks',
  path: '/dashboard/issues',
  hint: 'Open issues and follow-ups',
}

const schools: NavItem = {
  label: 'Schools',
  path: '/dashboard/schools',
  hint: 'Directory: open a school for detail, attendance, and visits',
}

const districts: NavItem = {
  label: 'Districts',
  path: '/dashboard/districts',
  hint: 'Browse districts and drill into geography',
}

const monitoring: NavItem = {
  label: 'Monitoring visits',
  path: '/dashboard/monitoring',
  hint: 'Plan visits, drafts, and finalized monitoring forms',
}

const calendar: NavItem = {
  label: 'Visit calendar',
  path: '/dashboard/visit-calendar',
  hint: 'Calendar view of planned and completed visits',
}

const observations: NavItem = {
  label: 'Observations',
  path: '/dashboard/observations',
  hint: 'Structured observation notes from the field',
}

const reports: NavItem = {
  label: 'Reports',
  path: '/dashboard/reports',
  hint: 'Submitted reports, review, and exports',
}

const compare: NavItem = {
  label: 'Compare reports',
  path: '/dashboard/reports/compare',
  hint: 'Compare metrics across districts or periods',
}

const assignedSchools: NavItem = {
  label: 'Assigned schools',
  path: '/dashboard/assigned-schools',
  hint: 'Schools your administrator assigned to you',
}

/** Sidebar grouped by task — reduces wall-of-links confusion. */
export function getNavigationSectionsForRole(role: UserRole): NavSection[] {
  switch (role) {
    case 'super_admin':
      return [
        { title: 'Overview', items: [dash] },
        { title: 'Work queue', items: [issues] },
        {
          title: 'People & access',
          items: [
            { label: 'Users', path: '/dashboard/users', hint: 'Accounts, roles, and invitations' },
            {
              label: 'Evaluator assignments',
              path: '/dashboard/ie-assignments',
              hint: 'Which Independent Evaluators cover which schools',
            },
            { label: 'Audit log', path: '/dashboard/audit-log', hint: 'Security and change history' },
          ],
        },
        {
          title: 'Master data',
          items: [
            schools,
            {
              label: 'Partner organizations',
              path: '/dashboard/partner-orgs',
              hint: 'Organizations with portal access',
            },
            { label: 'Geography', path: '/dashboard/geography', hint: 'Districts, talukas, union councils' },
          ],
        },
        {
          title: 'Visits & reporting',
          items: [calendar, reports, compare],
        },
        {
          title: 'Preferences',
          items: [{ label: 'Settings', path: '/dashboard/settings', hint: 'Your profile and notifications' }],
        },
      ]
    case 'government':
      return [
        { title: 'Overview', items: [dash] },
        { title: 'Work queue', items: [issues] },
        { title: 'Schools & geography', items: [schools, districts] },
        { title: 'Field monitoring', items: [monitoring, calendar, observations] },
        { title: 'Reports', items: [reports, compare] },
      ]
    case 'ie':
      return [
        { title: 'Overview', items: [dash] },
        { title: 'Work queue', items: [issues] },
        {
          title: 'Your schools',
          items: [schools, districts, assignedSchools],
        },
        { title: 'Field monitoring', items: [monitoring, calendar, observations] },
        { title: 'Reports', items: [reports] },
      ]
    case 'partner':
      return [
        { title: 'Overview', items: [dash] },
        { title: 'Work queue', items: [issues] },
        { title: 'Schools', items: [schools] },
        { title: 'Field monitoring', items: [calendar, observations] },
        { title: 'Reports', items: [reports, compare] },
      ]
    default:
      return [{ title: 'Menu', items: [dash] }]
  }
}
