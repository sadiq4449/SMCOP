import type { ApiResponse } from '../types/auth'
import type { MonthlyStudentAttendance, MonthlyTeacherAttendance, StudentAttendanceDay, TeacherAttendanceRecord } from '../types/attendance'
import { apiClient } from './api'

export async function submitTeacherAttendance(body: {
  school_id: string
  date: string
  teachers: Array<{
    teacher_id?: string | null
    name?: string | null
    present: boolean
    remarks?: string | null
    verification_photo_url?: string | null
  }>
}): Promise<TeacherAttendanceRecord[]> {
  const { data } = await apiClient.post<ApiResponse<TeacherAttendanceRecord[]>>('/attendance/teacher', body)
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function monthlyTeacherAttendance(params: {
  school_id: string
  month: string
  approval_status?: string
}): Promise<MonthlyTeacherAttendance> {
  const { data } = await apiClient.get<ApiResponse<MonthlyTeacherAttendance>>('/attendance/teacher', { params })
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function reviewTeacherAttendance(recordId: string, approval_status: 'approved' | 'rejected' | 'pending') {
  const { data } = await apiClient.patch<ApiResponse<TeacherAttendanceRecord>>(
    `/attendance/teacher-record/${recordId}`,
    { approval_status },
  )
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function submitStudentAttendance(body: {
  school_id: string
  date: string
  boys_present: number
  girls_present: number
}): Promise<StudentAttendanceDay> {
  const { data } = await apiClient.post<ApiResponse<StudentAttendanceDay>>('/attendance/student', body)
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function monthlyStudentAttendance(params: { school_id: string; month: string }): Promise<MonthlyStudentAttendance> {
  const { data } = await apiClient.get<ApiResponse<MonthlyStudentAttendance>>('/attendance/student', { params })
  if (!data.success || !data.data) throw new Error(data.message)
  return data.data
}

export async function downloadAttendanceExport(params: { school_id: string; month: string; kind: 'teacher' | 'student' }) {
  const response = await apiClient.get<ArrayBuffer>('/attendance/export.csv', {
    params,
    responseType: 'arraybuffer',
  })
  const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `attendance-${params.kind}-${params.school_id}-${params.month}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
