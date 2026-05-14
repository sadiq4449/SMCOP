import type { ApiResponse } from '../types/auth'
import type { District, Taluka, UnionCouncil } from '../types/school'
import { apiClient } from './api'

export async function adminCreateDistrict(body: { name: string; code?: string | null }): Promise<District> {
  const { data } = await apiClient.post<ApiResponse<District>>('/districts', body)
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function adminUpdateDistrict(id: string, body: { name?: string; code?: string | null }): Promise<District> {
  const { data } = await apiClient.patch<ApiResponse<District>>(`/districts/${id}`, body)
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function adminDeleteDistrict(id: string): Promise<void> {
  const { data } = await apiClient.delete<ApiResponse<{ status: string }>>(`/districts/${id}`)
  if (!data.success) throw new Error(data.message)
}

export async function adminCreateTaluka(districtId: string, body: { name: string }): Promise<Taluka> {
  const { data } = await apiClient.post<ApiResponse<Taluka>>(`/districts/${districtId}/talukas`, body)
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function adminUpdateTaluka(
  id: string,
  body: { name?: string; district_id?: string | null },
): Promise<Taluka> {
  const { data } = await apiClient.patch<ApiResponse<Taluka>>(`/talukas/${id}`, body)
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function adminDeleteTaluka(id: string): Promise<void> {
  const { data } = await apiClient.delete<ApiResponse<{ status: string }>>(`/talukas/${id}`)
  if (!data.success) throw new Error(data.message)
}

export async function adminCreateUnionCouncil(talukaId: string, body: { name: string }): Promise<UnionCouncil> {
  const { data } = await apiClient.post<ApiResponse<UnionCouncil>>(`/talukas/${talukaId}/ucs`, body)
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function adminUpdateUnionCouncil(
  id: string,
  body: { name?: string; taluka_id?: string | null },
): Promise<UnionCouncil> {
  const { data } = await apiClient.patch<ApiResponse<UnionCouncil>>(`/ucs/${id}`, body)
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function adminDeleteUnionCouncil(id: string): Promise<void> {
  const { data } = await apiClient.delete<ApiResponse<{ status: string }>>(`/ucs/${id}`)
  if (!data.success) throw new Error(data.message)
}
