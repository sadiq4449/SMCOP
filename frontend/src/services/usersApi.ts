import type { ApiResponse } from '../types/auth'
import type { PaginatedActivityLogs, PaginatedUsers, UserAdminRow } from '../types/user'
import { apiClient } from './api'

export async function listUsers(params: {
  skip?: number
  limit?: number
  role?: string
  status?: string
  district_id?: string
  partner_org_id?: string
  q?: string
}): Promise<PaginatedUsers> {
  const { data } = await apiClient.get<ApiResponse<PaginatedUsers>>('/users', { params })
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function getUser(id: string): Promise<UserAdminRow> {
  const { data } = await apiClient.get<ApiResponse<UserAdminRow>>(`/users/${id}`)
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function createUser(body: Record<string, unknown>): Promise<UserAdminRow> {
  const { data } = await apiClient.post<ApiResponse<UserAdminRow>>('/users', body)
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function updateUser(id: string, body: Record<string, unknown>): Promise<UserAdminRow> {
  const { data } = await apiClient.patch<ApiResponse<UserAdminRow>>(`/users/${id}`, body)
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

/** Super Admin replaces Independent Evaluator school assignments (PATCH ``/users/{id}/assigned-schools``). */
export async function patchUserAssignedSchools(
  id: string,
  assignedSchools: string[],
): Promise<UserAdminRow> {
  const { data } = await apiClient.patch<ApiResponse<UserAdminRow>>(`/users/${id}/assigned-schools`, {
    assigned_schools: assignedSchools,
  })
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function deleteUser(id: string): Promise<void> {
  const { data } = await apiClient.delete<ApiResponse<{ status: string }>>(`/users/${id}`)
  if (!data.success) throw new Error(data.message)
}

export async function listActivityLogs(params: {
  skip?: number
  limit?: number
  action?: string
}): Promise<PaginatedActivityLogs> {
  const { data } = await apiClient.get<ApiResponse<PaginatedActivityLogs>>('/admin/activity-logs', { params })
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}
