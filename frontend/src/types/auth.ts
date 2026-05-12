export type UserRole =
  | 'super_admin'
  | 'government'
  | 'deo'
  | 'enumerator'
  | 'principal'
  | 'teacher'

export interface UserProfile {
  id: string
  full_name: string
  email: string
  role: UserRole
  status: string
  partner_org_id?: string | null
  district_id?: string | null
  assigned_schools?: string[]
}

export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T | null
  errors?: Record<string, string> | null
}

export interface LoginResponseData {
  token: string
  refresh_token: string
  role: UserRole
  user: UserProfile
}

export interface RefreshResponseData {
  token: string
  refresh_token: string
}
