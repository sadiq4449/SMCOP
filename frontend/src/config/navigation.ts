import type { UserRole } from '../types/auth'

export interface NavItem {
  label: string
  path: string
}

const sharedDashboard: NavItem = { label: 'Dashboard', path: '/dashboard' }

const opsNav: NavItem = { label: 'Issues & tasks', path: '/dashboard/issues' }

/** Sidebar scoped to the four SMCOP persona roles (see Planning/problem statement). */
const roleNavigation: Record<UserRole, NavItem[]> = {
  super_admin: [
    sharedDashboard,
    opsNav,
    { label: 'Users', path: '/dashboard/users' },
    { label: 'IE school assignments', path: '/dashboard/ie-assignments' },
    { label: 'Audit log', path: '/dashboard/audit-log' },
    { label: 'Schools', path: '/dashboard/schools' },
    { label: 'Partner orgs', path: '/dashboard/partner-orgs' },
    { label: 'Geography', path: '/dashboard/geography' },
    { label: 'Visit calendar', path: '/dashboard/visit-calendar' },
    { label: 'Reports', path: '/dashboard/reports' },
    { label: 'Compare reports', path: '/dashboard/reports/compare' },
    { label: 'Settings', path: '/dashboard/settings' },
  ],
  government: [
    sharedDashboard,
    opsNav,
    { label: 'Schools', path: '/dashboard/schools' },
    { label: 'Districts', path: '/dashboard/districts' },
    { label: 'Reports', path: '/dashboard/reports' },
    { label: 'Compare reports', path: '/dashboard/reports/compare' },
  ],
  ie: [
    sharedDashboard,
    opsNav,
    { label: 'Schools', path: '/dashboard/schools' },
    { label: 'Districts', path: '/dashboard/districts' },
    { label: 'Assigned schools', path: '/dashboard/assigned-schools' },
    { label: 'Monitoring visits', path: '/dashboard/monitoring' },
    { label: 'Visit calendar', path: '/dashboard/visit-calendar' },
    { label: 'Observations', path: '/dashboard/observations' },
    { label: 'Reports', path: '/dashboard/reports' },
  ],
  partner: [
    sharedDashboard,
    opsNav,
    { label: 'Schools', path: '/dashboard/schools' },
    { label: 'Visit calendar', path: '/dashboard/visit-calendar' },
    { label: 'Observations', path: '/dashboard/observations' },
    { label: 'Reports', path: '/dashboard/reports' },
    { label: 'Compare reports', path: '/dashboard/reports/compare' },
  ],
}

export const roleLabels: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  government: 'PPP Node (Government)',
  ie: 'Independent Evaluator',
  partner: 'Partner organization',
}

export function getNavigationForRole(role: UserRole): NavItem[] {
  return roleNavigation[role]
}
