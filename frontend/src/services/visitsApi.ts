import type { ApiResponse } from '../types/auth'
import type { KPIRow, PaginatedVisits, VisitDetail, VisitSummary } from '../types/visit'
import { apiClient, unwrapBlobResponse } from './api'

export async function getKpis(): Promise<KPIRow[]> {
  const { data } = await apiClient.get<ApiResponse<KPIRow[]>>('/kpis')
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function listVisits(params: {
  skip?: number
  limit?: number
  school_id?: string
  quarter?: string
}): Promise<PaginatedVisits> {
  const { data } = await apiClient.get<ApiResponse<PaginatedVisits>>('/visits', { params })
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function createVisit(body: {
  school_id: string
  quarter: string
  visit_date?: string | null
}): Promise<VisitSummary> {
  const { data } = await apiClient.post<ApiResponse<VisitSummary>>('/visits', body)
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function getVisit(id: string): Promise<VisitDetail> {
  const { data } = await apiClient.get<ApiResponse<VisitDetail>>(`/visits/${id}`)
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function patchVisit(id: string, body: Record<string, unknown>): Promise<VisitDetail> {
  const { data } = await apiClient.patch<ApiResponse<VisitDetail>>(`/visits/${id}`, body)
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function submitVisitKpis(id: string, body: { scores: Array<{ kpi_id: string; score: number; remarks?: string | null }>; remarks?: string | null }) {
  const { data } = await apiClient.post<ApiResponse<VisitDetail>>(`/visits/${id}/kpis`, body)
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function uploadVisitEvidence(
  visitId: string,
  file: File,
  gps?: { latitude?: number | null; longitude?: number | null },
) {
  const fd = new FormData()
  fd.append('file', file)
  if (gps?.latitude != null) fd.append('gps_latitude', String(gps.latitude))
  if (gps?.longitude != null) fd.append('gps_longitude', String(gps.longitude))
  const { data } = await apiClient.post<ApiResponse<{ document_id: string; download_path: string }>>(
    `/visits/${visitId}/evidence`,
    fd,
  )
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function downloadDocument(documentId: string): Promise<Blob> {
  const res = await apiClient.get<Blob>(`/documents/${documentId}/download`, {
    responseType: 'blob',
    validateStatus: () => true,
  })
  return unwrapBlobResponse(res, 'Download failed')
}
