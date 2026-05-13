import axios, { type AxiosError } from 'axios'

import type { ApiResponse } from '../types/auth'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? '/api/v1' : '/svc/v1')

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export function setAuthToken(token: string | null) {
  if (token) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`
    return
  }

  delete apiClient.defaults.headers.common.Authorization
}

function messageFromUnknownData(data: unknown): string | undefined {
  if (data == null) return undefined
  if (typeof data === 'string') {
    const t = data.trim()
    if (!t || t.startsWith('<')) return undefined
    return t.length > 800 ? `${t.slice(0, 800)}…` : t
  }
  if (typeof data !== 'object') return undefined
  const o = data as Record<string, unknown>
  if (typeof o.message === 'string' && o.message.trim()) return o.message.trim()
  if (o.detail != null) {
    if (typeof o.detail === 'string' && o.detail.trim()) return o.detail.trim()
    const nested = messageFromUnknownData(o.detail)
    if (nested) return nested
    if (Array.isArray(o.detail)) {
      const parts = o.detail
        .map((x) => (typeof x === 'object' && x && 'msg' in x ? String((x as { msg: unknown }).msg) : String(x)))
        .filter(Boolean)
      if (parts.length) return parts.join(' ')
    }
  }
  if (typeof o.error === 'string' && o.error.trim()) return o.error.trim()
  if (o.errors && typeof o.errors === 'object') {
    const e = o.errors as Record<string, unknown>
    const code = typeof e.code === 'string' ? e.code : undefined
    const hint = typeof e.hint === 'string' ? e.hint : undefined
    if (code && hint) return `${code}: ${hint}`
    if (hint) return hint
    if (code) return code
  }
  return undefined
}

export function getApiErrorMessage(error: unknown, fallback = 'Request failed') {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiResponse<unknown> & Record<string, unknown>>
    const data = axiosError.response?.data
    const msg = messageFromUnknownData(data)
    if (msg) {
      return msg
    }
    const status = axiosError.response?.status
    if (!axiosError.response) {
      return 'Cannot reach the API. Check that the backend is running and the API URL is correct.'
    }
    if (status === 401) {
      return 'Invalid email or password, or the account is inactive. If you use the demo users, run supabase/001_seed_demo_users.sql in Supabase after migrations.'
    }
    if (status === 403) {
      return 'Forbidden (403). Check Vercel / firewall rules and that the request hits the API, not a static file.'
    }
    if (status === 404) {
      return 'API route not found (404). Check deployment rewrites and API prefix.'
    }
    if (status === 405) {
      return (
        'Method not allowed (405). The POST hit the static web app (HTML), not the Python API. ' +
        'Production builds call /svc/v1 (see vercel.json rewrite) because Vercel treats /api/* specially. ' +
        'If you still see this, redeploy and confirm GET /health/db returns JSON. Override with VITE_API_BASE_URL and API_V1_PREFIX if needed.'
      )
    }
    if (status === 408) {
      return 'Request timeout (408). Retry or check network.'
    }
    if (status === 409) {
      return 'Conflict (409). The server rejected the request.'
    }
    if (status === 422) {
      return 'The server rejected the sign-in request (validation). Check email and password format.'
    }
    if (status === 429) {
      return 'Too many requests (429). Wait and retry.'
    }
    if (status === 500) {
      return 'Server error (500). Check Vercel function logs and DATABASE_URL / database migrations.'
    }
    if (status === 502 || status === 504) {
      return 'Gateway timeout or bad gateway. The API server may be cold-starting or overloaded; retry or check Vercel logs.'
    }
    if (status === 503) {
      return 'API unavailable (503). Check Vercel env (DATABASE_URL), Supabase pooler URI, and /health/db on the deployment.'
    }
    const label = axiosError.response?.statusText?.trim()
    if (status != null) {
      return `${fallback} (HTTP ${status}${label ? ` ${label}` : ''}).`
    }
    return fallback
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim()
  }

  return fallback
}
