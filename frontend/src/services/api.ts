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

export function getApiErrorMessage(error: unknown, fallback = 'Request failed') {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiResponse<unknown>>
    const data = axiosError.response?.data
    const msg =
      data && typeof data === 'object' && 'message' in data && typeof data.message === 'string'
        ? data.message
        : undefined
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
    return fallback
  }

  return fallback
}
