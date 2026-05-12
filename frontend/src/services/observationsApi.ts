import type { ApiResponse } from '../types/auth'
import type { ClassroomObservation, PaginatedObservations } from '../types/observation'
import { apiClient } from './api'

export async function listObservations(params: {
  skip?: number
  limit?: number
  school_id?: string
  visit_id?: string
  quarter?: string
}): Promise<PaginatedObservations> {
  const { data } = await apiClient.get<ApiResponse<PaginatedObservations>>('/class-observation', { params })
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function getObservation(id: string): Promise<ClassroomObservation> {
  const { data } = await apiClient.get<ApiResponse<ClassroomObservation>>(`/class-observation/${id}`)
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function createObservation(body: Record<string, unknown>): Promise<ClassroomObservation> {
  const { data } = await apiClient.post<ApiResponse<ClassroomObservation>>('/class-observation', body)
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function patchObservation(id: string, body: Record<string, unknown>): Promise<ClassroomObservation> {
  const { data } = await apiClient.patch<ApiResponse<ClassroomObservation>>(`/class-observation/${id}`, body)
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function uploadObservationEvidence(observationId: string, file: File): Promise<{ document_id: string; download_path: string }> {
  const fd = new FormData()
  fd.append('file', file)
  const { data } = await apiClient.post<ApiResponse<{ document_id: string; download_path: string }>>(
    `/class-observation/${observationId}/evidence`,
    fd,
  )
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}
