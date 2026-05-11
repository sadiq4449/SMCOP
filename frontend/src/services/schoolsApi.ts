import type { ApiResponse } from '../types/auth'
import type {
  District,
  EnrollmentRow,
  PaginatedSchools,
  PartnerOrg,
  SchoolDetail,
  SchoolSummary,
  Taluka,
  TeacherRow,
  UnionCouncil,
} from '../types/school'
import { apiClient } from './api'

export async function getDistricts(): Promise<District[]> {
  const { data } = await apiClient.get<ApiResponse<District[]>>('/districts')
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function getTalukas(districtId: string): Promise<Taluka[]> {
  const { data } = await apiClient.get<ApiResponse<Taluka[]>>(`/districts/${districtId}/talukas`)
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function getUnionCouncils(talukaId: string): Promise<UnionCouncil[]> {
  const { data } = await apiClient.get<ApiResponse<UnionCouncil[]>>(`/talukas/${talukaId}/ucs`)
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function getSchools(params: {
  skip?: number
  limit?: number
  district_id?: string
  taluka_id?: string
  uc_id?: string
  partner_org_id?: string
  status?: string
  q?: string
}): Promise<PaginatedSchools> {
  const { data } = await apiClient.get<ApiResponse<PaginatedSchools>>('/schools', { params })
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function getSchool(id: string): Promise<SchoolDetail> {
  const { data } = await apiClient.get<ApiResponse<SchoolDetail>>(`/schools/${id}`)
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function createSchool(body: Record<string, unknown>): Promise<SchoolDetail> {
  const { data } = await apiClient.post<ApiResponse<SchoolDetail>>('/schools', body)
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function updateSchool(id: string, body: Record<string, unknown>): Promise<SchoolDetail> {
  const { data } = await apiClient.patch<ApiResponse<SchoolDetail>>(`/schools/${id}`, body)
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function deleteSchool(id: string): Promise<void> {
  const { data } = await apiClient.delete<ApiResponse<{ status: string }>>(`/schools/${id}`)
  if (!data.success) throw new Error(data.message)
}

export async function getPartnerOrgs(): Promise<PartnerOrg[]> {
  const { data } = await apiClient.get<ApiResponse<PartnerOrg[]>>('/partner-orgs')
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function createPartnerOrg(body: Record<string, unknown>): Promise<PartnerOrg> {
  const { data } = await apiClient.post<ApiResponse<PartnerOrg>>('/partner-orgs', body)
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function updatePartnerOrg(id: string, body: Record<string, unknown>): Promise<PartnerOrg> {
  const { data } = await apiClient.patch<ApiResponse<PartnerOrg>>(`/partner-orgs/${id}`, body)
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function deletePartnerOrg(id: string): Promise<void> {
  const { data } = await apiClient.delete<ApiResponse<{ status: string }>>(`/partner-orgs/${id}`)
  if (!data.success) throw new Error(data.message)
}

export async function getEnrollment(schoolId: string): Promise<EnrollmentRow[]> {
  const { data } = await apiClient.get<ApiResponse<EnrollmentRow[]>>(`/schools/${schoolId}/enrollment`)
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function createEnrollment(schoolId: string, body: { quarter: string; boys: number; girls: number }) {
  const { data } = await apiClient.post<ApiResponse<EnrollmentRow>>(`/schools/${schoolId}/enrollment`, body)
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function getTeachers(schoolId: string): Promise<TeacherRow[]> {
  const { data } = await apiClient.get<ApiResponse<TeacherRow[]>>(`/schools/${schoolId}/teachers`)
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function createTeacher(
  schoolId: string,
  body: { name: string; gender: string; subject?: string | null; status?: string },
) {
  const { data } = await apiClient.post<ApiResponse<TeacherRow>>(`/schools/${schoolId}/teachers`, body)
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function deleteTeacher(schoolId: string, teacherId: string) {
  const { data } = await apiClient.delete<ApiResponse<{ status: string }>>(
    `/schools/${schoolId}/teachers/${teacherId}`,
  )
  if (!data.success) throw new Error(data.message)
}

export async function schoolsUnderUc(ucId: string): Promise<SchoolSummary[]> {
  const { data } = await apiClient.get<ApiResponse<SchoolSummary[]>>(`/ucs/${ucId}/schools`)
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}
