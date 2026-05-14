import type { ApiResponse } from '../types/auth'
import { apiClient } from './api'

export async function getDashboardSystem(params: {
  quarter?: string
  district_skip?: number
  district_limit?: number
}) {
  const { data } = await apiClient.get<ApiResponse<Record<string, unknown>>>('/dashboard/system', { params })
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function getDashboardGovernment(params: {
  quarter?: string
  district_skip?: number
  district_limit?: number
}) {
  const { data } = await apiClient.get<ApiResponse<Record<string, unknown>>>('/dashboard/government', { params })
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function getDashboardDistrict(params: {
  quarter?: string
  district_id?: string
  school_skip?: number
  school_limit?: number
}) {
  const { data } = await apiClient.get<ApiResponse<Record<string, unknown>>>('/dashboard/district', { params })
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function getDashboardSchool(schoolId: string, params?: { quarter?: string; visits_limit?: number }) {
  const { data } = await apiClient.get<ApiResponse<Record<string, unknown>>>(`/dashboard/school/${schoolId}`, {
    params,
  })
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}
