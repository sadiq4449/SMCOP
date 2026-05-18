import { apiClient } from './api'
import type { ApiResponse } from '../types/auth'

export interface IssueRow {
  id: string
  school_id: string
  category: string
  details: string
  severity: string
  status: string
  raised_by_user_id: string
  assigned_to_user_id: string | null
  attachment_url: string | null
  created_at: string
  updated_at: string
}

export interface TaskRow {
  id: string
  school_id: string
  title: string
  details: string | null
  assignee_user_id: string
  due_date: string | null
  is_completed: boolean
  completed_at: string | null
  created_by_user_id: string
  created_at: string
}

export interface NotificationRow {
  id: string
  title: string
  message: string
  is_read: boolean
  kind: string | null
  ref_type: string | null
  ref_id: string | null
  created_at: string
}

export interface AnnouncementRow {
  id: string
  title: string
  body: string
  attachment_url: string | null
  district_id: string | null
  created_by_user_id: string
  created_at: string
}

export async function listIssues(params?: { school_id?: string; status?: string; skip?: number; limit?: number }) {
  const { data } = await apiClient.get<ApiResponse<{ items: IssueRow[]; total: number }>>('/issues', { params })
  if (!data.success || !data.data) throw new Error(data.message || 'Failed to load issues')
  return data.data
}

export async function createIssue(body: {
  school_id: string
  category: string
  details: string
  severity: string
  attachment_url?: string | null
}) {
  const { data } = await apiClient.post<ApiResponse<IssueRow>>('/issues', body)
  if (!data.success || !data.data) throw new Error(data.message || 'Failed to create issue')
  return data.data
}

export async function patchIssue(id: string, body: { status?: string; assigned_to_user_id?: string | null; comment?: string }) {
  const { data } = await apiClient.patch<ApiResponse<IssueRow>>(`/issues/${id}`, body)
  if (!data.success || !data.data) throw new Error(data.message || 'Failed to update issue')
  return data.data
}

export async function getUnreadNotificationCount() {
  const { data } = await apiClient.get<ApiResponse<{ unread: number }>>('/notifications/unread-count')
  if (!data.success || !data.data) throw new Error(data.message || 'Failed')
  return data.data.unread
}

export async function listNotifications(params?: { unread_only?: boolean; limit?: number }) {
  const { data } = await apiClient.get<ApiResponse<{ items: NotificationRow[]; total: number }>>('/notifications', {
    params,
  })
  if (!data.success || !data.data) throw new Error(data.message || 'Failed')
  return data.data
}

export async function markNotificationRead(id: string) {
  const { data } = await apiClient.patch<ApiResponse<NotificationRow>>(`/notifications/${id}/read`)
  if (!data.success || !data.data) throw new Error(data.message || 'Failed')
  return data.data
}

export async function markAllNotificationsRead() {
  const { data } = await apiClient.post<ApiResponse<{ updated: number }>>('/notifications/mark-all-read')
  if (!data.success || !data.data) throw new Error(data.message || 'Failed')
  return data.data
}

export async function listTasks(params?: { school_id?: string }) {
  const { data } = await apiClient.get<ApiResponse<{ items: TaskRow[]; total: number }>>('/tasks', { params })
  if (!data.success || !data.data) throw new Error(data.message || 'Failed to load tasks')
  return data.data
}

export async function patchTask(id: string, body: { is_completed?: boolean }) {
  const { data } = await apiClient.patch<ApiResponse<TaskRow>>(`/tasks/${id}`, body)
  if (!data.success || !data.data) throw new Error(data.message || 'Failed')
  return data.data
}

export async function createTask(body: {
  school_id: string
  title: string
  details?: string | null
  assignee_user_id: string
  due_date?: string | null
}) {
  const { data } = await apiClient.post<ApiResponse<TaskRow>>('/tasks', body)
  if (!data.success || !data.data) throw new Error(data.message || 'Failed')
  return data.data
}

export interface AssigneeOption {
  id: string
  full_name: string
  email: string
  role: string
}

/** Programme administrators / DEO: principals, teachers, or issue-specific roles for assignment pickers. */
export async function listSchoolAssignees(schoolId: string, purpose: 'task' | 'issue') {
  const { data } = await apiClient.get<ApiResponse<{ items: AssigneeOption[] }>>('/assignees', {
    params: { school_id: schoolId, purpose },
  })
  if (!data.success || !data.data) throw new Error(data.message || 'Failed to load assignees')
  return data.data.items
}

export async function listAnnouncements() {
  const { data } = await apiClient.get<ApiResponse<{ items: AnnouncementRow[]; total: number }>>('/announcements', {
    params: { limit: 30 },
  })
  if (!data.success || !data.data) throw new Error(data.message || 'Failed')
  return data.data
}

export async function forgotPassword(email: string) {
  const { data } = await apiClient.post<ApiResponse<{ status: string }>>('/auth/forgot-password', { email })
  if (!data.success) throw new Error(data.message || 'Request failed')
  return data.message
}

export async function resetPassword(token: string, password: string) {
  const { data } = await apiClient.post<ApiResponse<{ status: string }>>('/auth/reset-password', { token, password })
  if (!data.success) throw new Error(data.message || 'Request failed')
  return data.message
}
