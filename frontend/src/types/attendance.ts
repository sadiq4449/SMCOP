export interface TeacherAttendanceRecord {
  id: string
  school_id: string
  attendance_date: string
  teacher_id: string
  teacher_name: string | null
  present: boolean
  remarks: string | null
  verification_photo_url: string | null
  approval_status: string
  submitted_by_user_id: string
  approved_by_user_id: string | null
  approved_at: string | null
}

export interface MonthlyTeacherAttendance {
  school_id: string
  month: string
  records: TeacherAttendanceRecord[]
  summary: Record<string, Record<string, number>>
}

export interface StudentAttendanceDay {
  id: string
  school_id: string
  attendance_date: string
  boys_present: number
  girls_present: number
  submitted_by_user_id: string
}

export interface MonthlyStudentAttendance {
  school_id: string
  month: string
  days: StudentAttendanceDay[]
  totals: Record<string, number>
}
