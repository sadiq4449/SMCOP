import axios, { type AxiosError } from 'axios'

import type { ApiResponse } from '../types/auth'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

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
  if (!data || typeof data !== 'object') return undefined
  const o = data as Record<string, unknown>
  if (typeof o.message === 'string' && o.message.trim()) return o.message
  if (typeof o.detail === 'string' && o.detail.trim()) return o.detail
  if (Array.isArray(o.detail)) {
    const parts = o.detail
      .map((x) => (typeof x === 'object' && x && 'msg' in x ? String((x as { msg: unknown }).msg) : String(x)))
      .filter(Boolean)
    if (parts.length) return parts.join(' ')
  }
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
    if (status === 404) {
      return 'API route not found (404). Check deployment rewrites and API prefix.'
    }
    if (status === 500) {
      return 'Server error (500). Check Vercel function logs and DATABASE_URL / database migrations.'
    }
    if (status === 503) {
      return 'API unavailable (503). Check Vercel env (DATABASE_URL), Supabase pooler URI, and /health/db on the deployment.'
    }
    return fallback
  }

  return fallback
}
