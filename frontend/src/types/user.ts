import type { UserRole } from './auth'

export interface UserAdminRow {
  id: string
  full_name: string
  email: string
  role: UserRole
  status: string
  partner_org_id: string | null
  district_id: string | null
  linked_teacher_id?: string | null
  assigned_schools: string[]
  created_at: string
  updated_at: string
}

export interface PaginatedUsers {
  items: UserAdminRow[]
  total: number
}

export interface ActivityLogRow {
  id: string
  user_id: string | null
  action: string
  target: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface PaginatedActivityLogs {
  items: ActivityLogRow[]
  total: number
}
