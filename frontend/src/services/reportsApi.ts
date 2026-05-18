import type { ApiResponse } from '../types/auth'
import type {
  CompareDistrictsResult,
  CompareQuartersResult,
  CompareReportsResult,
  PaginatedReports,
  ReportComment,
  ReportSummary,
} from '../types/report'
import { apiClient, unwrapBlobResponse } from './api'

export async function listReports(params: {
  skip?: number
  limit?: number
  school_id?: string
  quarter?: string
  district_id?: string
  status?: string
}): Promise<PaginatedReports> {
  const { data } = await apiClient.get<ApiResponse<PaginatedReports>>('/reports', { params })
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function createReport(body: {
  school_id: string
  quarter: string
  summary?: string | null
  recommendations?: string | null
}): Promise<ReportSummary> {
  const { data } = await apiClient.post<ApiResponse<ReportSummary>>('/reports', body)
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function getReport(id: string): Promise<ReportSummary> {
  const { data } = await apiClient.get<ApiResponse<ReportSummary>>(`/reports/${id}`)
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function patchReport(id: string, body: Record<string, unknown>): Promise<ReportSummary> {
  const { data } = await apiClient.patch<ApiResponse<ReportSummary>>(`/reports/${id}`, body)
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function reviewReport(
  id: string,
  body: { status: 'approved' | 'rejected'; remarks?: string | null },
): Promise<ReportSummary> {
  const { data } = await apiClient.patch<ApiResponse<ReportSummary>>(`/reports/${id}/status`, body)
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function listReportComments(id: string): Promise<ReportComment[]> {
  const { data } = await apiClient.get<ApiResponse<ReportComment[]>>(`/reports/${id}/comments`)
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function addReportComment(id: string, body: string): Promise<ReportComment> {
  const { data } = await apiClient.post<ApiResponse<ReportComment>>(`/reports/${id}/comments`, {
    body,
  })
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function compareDistricts(quarter: string, districtIdsCsv: string) {
  const { data } = await apiClient.get<ApiResponse<CompareDistrictsResult>>('/reports/compare/districts', {
    params: { quarter, district_ids: districtIdsCsv },
  })
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function compareQuarters(schoolId: string, quartersCsv: string) {
  const { data } = await apiClient.get<ApiResponse<CompareQuartersResult>>('/reports/compare/quarters', {
    params: { school_id: schoolId, quarters: quartersCsv },
  })
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function compareReports(quarter: string, schoolIdsCsv: string): Promise<CompareReportsResult> {
  const { data } = await apiClient.get<ApiResponse<CompareReportsResult>>('/reports/compare', {
    params: { quarter, school_ids: schoolIdsCsv },
  })
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

async function assertBinaryExport(blob: Blob, format: 'xlsx' | 'pdf') {
  const prefix = new Uint8Array(await blob.slice(0, 8).arrayBuffer())
  if (format === 'pdf') {
    const sig = String.fromCharCode(...prefix.slice(0, 4))
    if (sig !== '%PDF') {
      const text = await blob.text()
      let hint = 'Server returned a non-PDF response.'
      try {
        const j = JSON.parse(text) as { message?: string }
        if (typeof j.message === 'string' && j.message.trim()) hint = j.message.trim()
      } catch {
        if (text.includes('<!DOCTYPE') || text.includes('<html')) {
          hint = 'Received HTML instead of a PDF—API routing or auth may have failed.'
        }
      }
      throw new Error(hint)
    }
    return
  }
  // XLSX is a ZIP archive — local file header starts with PK
  if (prefix[0] !== 0x50 || prefix[1] !== 0x4b) {
    const text = await blob.text()
    let hint = 'Server returned a non-Excel response.'
    try {
      const j = JSON.parse(text) as { message?: string }
      if (typeof j.message === 'string' && j.message.trim()) hint = j.message.trim()
    } catch {
      /* keep hint */
    }
    throw new Error(hint)
  }
}

export async function downloadReportExport(reportId: string, format: 'xlsx' | 'pdf'): Promise<Blob> {
  const res = await apiClient.get<Blob>(`/reports/${reportId}/export`, {
    params: { format },
    responseType: 'blob',
    validateStatus: () => true,
    headers: {
      Accept:
        format === 'pdf'
          ? 'application/pdf,application/octet-stream;q=0.9,*/*;q=0.8'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream;q=0.9,*/*;q=0.8',
    },
  })
  const blob = await unwrapBlobResponse(res, 'Export failed')
  await assertBinaryExport(blob, format)
  return blob
}
