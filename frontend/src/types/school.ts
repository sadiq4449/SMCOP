export interface District {
  id: string
  name: string
  code: string | null
}

export interface Taluka {
  id: string
  district_id: string
  name: string
}

export interface UnionCouncil {
  id: string
  taluka_id: string
  name: string
}

export interface SchoolSummary {
  id: string
  emis_code: string
  name: string
  uc_id: string
  district_name: string
  taluka_name: string
  uc_name: string
  level: string
  gender: string
  partner_org_id: string | null
  partner_org_name: string | null
  principal_name: string | null
  principal_phone: string | null
  status: string
}

export interface SchoolDetail {
  id: string
  emis_code: string
  name: string
  uc_id: string
  district_id: string
  district_name: string
  taluka_id: string
  taluka_name: string
  uc_name: string
  level: string
  gender: string
  partner_org_id: string | null
  partner_org_name: string | null
  principal_name: string | null
  principal_phone: string | null
  gps_latitude: number | null
  gps_longitude: number | null
  status: string
}

export interface PaginatedSchools {
  items: SchoolSummary[]
  total: number
}

export interface PartnerOrg {
  id: string
  name: string
  contact_person: string | null
  email: string | null
  phone: string | null
  address: string | null
}

export interface EnrollmentRow {
  id: string
  school_id: string
  quarter: string
  boys: number
  girls: number
  total: number
}

export interface TeacherRow {
  id: string
  school_id: string
  name: string
  gender: string
  subject: string | null
  status: string
}
