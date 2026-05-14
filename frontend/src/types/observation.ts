export interface ObservationDoc {
  id: string
  file_name: string
  file_type: string | null
  download_path: string
  created_at: string
}

export interface ClassroomObservation {
  id: string
  visit_id: string
  visit_status?: string
  school_id: string
  quarter: string
  teacher_id: string | null
  teacher_name: string | null
  subject: string
  grade: string
  observation_date: string | null
  score_engagement: number
  score_pedagogy: number
  score_environment: number
  strengths: string | null
  weaknesses: string | null
  recommendations: string | null
  remarks: string | null
  reviewer_comments: string | null
  created_at: string
  updated_at: string
  documents: ObservationDoc[]
}

export interface PaginatedObservations {
  items: ClassroomObservation[]
  total: number
}
