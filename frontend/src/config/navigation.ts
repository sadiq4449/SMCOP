import type { UserRole } from '../types/auth'

export interface NavItem {
  label: string
  path: string
}

const sharedDashboard: NavItem = { label: 'Dashboard', path: '/dashboard' }

const opsNav: NavItem = { label: 'Issues & tasks', path: '/dashboard/issues' }

const roleNavigation: Record<UserRole, NavItem[]> = {
  super_admin: [
    sharedDashboard,
    opsNav,
    { label: 'Users', path: '/dashboard/users' },
    { label: 'Audit log', path: '/dashboard/audit-log' },
    { label: 'Schools', path: '/dashboard/schools' },
    { label: 'Partner orgs', path: '/dashboard/partner-orgs' },
    { label: 'Geography', path: '/dashboard/geography' },
    { label: 'Reports', path: '/dashboard/reports' },
    { label: 'Settings', path: '/dashboard/settings' },
  ],
  government: [
    sharedDashboard,
    opsNav,
    { label: 'Schools', path: '/dashboard/schools' },
    { label: 'School Reports', path: '/dashboard/school-reports' },
    { label: 'Comparisons', path: '/dashboard/comparisons' },
  ],
  deo: [
    sharedDashboard,
    opsNav,
    { label: 'Schools', path: '/dashboard/schools' },
    { label: 'Approvals', path: '/dashboard/approvals' },
    { label: 'Comparisons', path: '/dashboard/comparisons' },
    { label: 'Field Visits', path: '/dashboard/visits' },
    { label: 'Observations', path: '/dashboard/observations' },
  ],
  enumerator: [
    sharedDashboard,
    opsNav,
    { label: 'Schools', path: '/dashboard/schools' },
    { label: 'Reports', path: '/dashboard/reports' },
    { label: 'Assigned Schools', path: '/dashboard/assigned-schools' },
    { label: 'Monitoring Visits', path: '/dashboard/monitoring' },
    { label: 'Observations', path: '/dashboard/observations' },
  ],
  principal: [
    sharedDashboard,
    opsNav,
    { label: 'Schools', path: '/dashboard/schools' },
    { label: 'Observations', path: '/dashboard/observations' },
    { label: 'Attendance', path: '/dashboard/attendance' },
    { label: 'Timetable', path: '/dashboard/timetable' },
    { label: 'School Reports', path: '/dashboard/reports' },
  ],
  teacher: [
    sharedDashboard,
    opsNav,
    { label: 'My Attendance', path: '/dashboard/my-attendance' },
    { label: 'Class Attendance', path: '/dashboard/class-attendance' },
    { label: 'Timetable', path: '/dashboard/timetable' },
  ],
}

export const roleLabels: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  government: 'Government',
  deo: 'District Education Officer',
  enumerator: 'Enumerator',
  principal: 'Principal',
  teacher: 'Teacher',
}

export function getNavigationForRole(role: UserRole): NavItem[] {
  return roleNavigation[role]
}
