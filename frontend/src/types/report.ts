export type ReportWorkflowStatus = 'draft' | 'submitted' | 'approved' | 'rejected'

export interface ReportSummary {
  id: string
  school_id: string
  quarter: string
  visit_id: string | null
  summary: string | null
  recommendations: string | null
  principal_infrastructure_notes: string | null
  principal_daily_activity_notes: string | null
  generated_snapshot: Record<string, unknown> | null
  status: ReportWorkflowStatus
  review_remarks: string | null
  reviewed_by_user_id: string | null
  reviewed_at: string | null
  created_by_user_id: string
  created_at: string
  updated_at: string
}

export interface PaginatedReports {
  items: ReportSummary[]
  total: number
}

export interface CompareSchoolRow {
  school_id: string
  school_name: string | null
  quarter: string
  visit_found: boolean
  visit_status: string | null
  aggregate_score: number | null
  classroom_observation_count: number | null
  report_status: string | null
  report_id: string | null
}

export interface CompareReportsResult {
  quarter: string
  schools: CompareSchoolRow[]
}

export interface ReportComment {
  id: string
  user_id: string
  body: string
  created_at: string
}
