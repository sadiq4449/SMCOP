import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

import type { ApiResponse, RefreshResponseData } from '../types/auth'

/**
 * Resolved API base URL. On Vercel, the SPA must not POST to "/" or "/auth/*" —
 * those hit static index.html → 405. Default prod is same-origin `/svc/v1` (see vercel.json).
 */
function resolveApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return import.meta.env.DEV ? '/api/v1' : '/svc/v1'
  }
  let s = String(raw).trim().replace(/\/+$/, '')
  if (!s) {
    return import.meta.env.DEV ? '/api/v1' : '/svc/v1'
  }

  // Dashboard mistake: absolute URL at site origin only → axios joins "/auth/login" at root → SPA static → 405.
  if (import.meta.env.PROD && /^https?:\/\//i.test(s)) {
    try {
      const url = new URL(s)
      const path = url.pathname.replace(/\/+$/, '') || ''
      if (!path || path === '/') {
        return `${url.origin}/svc/v1`
      }
    } catch {
      /* use s */
    }
  }

  return s
}

const API_BASE_URL = resolveApiBaseUrl()

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

/** Kept in sync with AuthContext localStorage keys. */
const ACCESS_TOKEN_KEY = 'smocp_access_token'
const REFRESH_TOKEN_KEY = 'smocp_refresh_token'

export const SESSION_EXPIRED_EVENT = 'smocp:session-expired'

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean }

let refreshInFlight: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    try {
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
      if (!refreshToken) return null

      const { data } = await axios.post<ApiResponse<RefreshResponseData>>(
        `${API_BASE_URL}/auth/refresh`,
        { refresh_token: refreshToken },
        { headers: { 'Content-Type': 'application/json' } },
      )

      if (!data.success || !data.data) return null

      localStorage.setItem(ACCESS_TOKEN_KEY, data.data.token)
      localStorage.setItem(REFRESH_TOKEN_KEY, data.data.refresh_token)
      setAuthToken(data.data.token)
      return data.data.token
    } catch {
      return null
    } finally {
      refreshInFlight = null
    }
  })()

  return refreshInFlight
}

apiClient.interceptors.response.use(
  (res) => res,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || !error.config) {
      return Promise.reject(error)
    }
    const status = error.response?.status
    const cfg = error.config as RetryableConfig
    const url = String(cfg.url ?? '')

    if (
      status !== 401 ||
      cfg._retry ||
      url.includes('/auth/login') ||
      url.includes('/auth/refresh')
    ) {
      return Promise.reject(error)
    }

    const newToken = await refreshAccessToken()
    if (!newToken) {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
      return Promise.reject(error)
    }

    cfg._retry = true
    cfg.headers = cfg.headers ?? {}
    cfg.headers.Authorization = `Bearer ${newToken}`
    return apiClient(cfg)
  },
)

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
      return 'Session expired or authentication failed. Sign in again.'
    }
    if (status === 403) {
      return 'Permission denied (403). Your role or school assignment may not allow this action.'
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
