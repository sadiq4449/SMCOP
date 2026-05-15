export interface KPIRow {
  id: string
  name: string
  description: string | null
  max_score: number
  category: string
  sort_order: number
  weight: number
}

export interface KpiScoreRow {
  kpi_id: string
  score: number
  remarks: string | null
  kpi_name?: string | null
  kpi_max_score?: number | null
}

export interface InfrastructureRow {
  id: string
  item_name: string
  status: string
  remarks: string | null
}

export interface VisitDocumentRow {
  id: string
  file_name: string
  file_type: string | null
  download_path: string
  created_at: string
  metadata?: Record<string, unknown> | null
}

export interface VisitSummary {
  id: string
  school_id: string
  quarter: string
  visit_date: string | null
  status: string
  aggregate_score: number | null
  visited_by_id: string
  created_at: string
  updated_at: string
}

export interface VisitDetail extends VisitSummary {
  remarks: string | null
  gps_latitude: number | null
  gps_longitude: number | null
  kpi_scores: KpiScoreRow[]
  infrastructure: InfrastructureRow[]
  documents: VisitDocumentRow[]
}

export interface PaginatedVisits {
  items: VisitSummary[]
  total: number
}
