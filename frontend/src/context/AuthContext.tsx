import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { apiClient, getApiErrorMessage, setAuthToken } from '../services/api'
import type {
  ApiResponse,
  LoginResponseData,
  RefreshResponseData,
  UserProfile,
} from '../types/auth'

const ACCESS_TOKEN_KEY = 'smocp_access_token'
const REFRESH_TOKEN_KEY = 'smocp_refresh_token'

interface AuthContextValue {
  user: UserProfile | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function persistSession(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  setAuthToken(accessToken)
}

function clearSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  setAuthToken(null)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchProfile = useCallback(async () => {
    const response = await apiClient.get<ApiResponse<UserProfile>>('/auth/me')
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.message)
    }
    setUser(response.data.data)
  }, [])

  const refreshSession = useCallback(async () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
    if (!refreshToken) {
      throw new Error('Missing refresh token')
    }

    const response = await apiClient.post<ApiResponse<RefreshResponseData>>('/auth/refresh', {
      refresh_token: refreshToken,
    })

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.message)
    }

    persistSession(response.data.data.token, response.data.data.refresh_token)
    await fetchProfile()
  }, [fetchProfile])

  useEffect(() => {
    const bootstrap = async () => {
      const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY)
      if (!accessToken) {
        setIsLoading(false)
        return
      }

      setAuthToken(accessToken)

      try {
        await fetchProfile()
      } catch {
        try {
          await refreshSession()
        } catch {
          clearSession()
          setUser(null)
        }
      } finally {
        setIsLoading(false)
      }
    }

    void bootstrap()
  }, [fetchProfile, refreshSession])

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const response = await apiClient.post<ApiResponse<LoginResponseData>>('/auth/login', {
          email,
          password,
        })

        const body = response.data
        if (!body || typeof body !== 'object') {
          throw new Error('Unexpected response from the server. Check that VITE_API_BASE_URL matches your deployed API.')
        }
        if (!body.success || !body.data) {
          throw new Error(
            typeof body.message === 'string' && body.message.trim()
              ? body.message
              : 'Sign-in was rejected.',
          )
        }

        persistSession(body.data.token, body.data.refresh_token)
        setUser(body.data.user)
      } catch (error) {
        throw new Error(getApiErrorMessage(error, 'Login failed'))
      }
    },
    [],
  )

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)

    try {
      await apiClient.post('/auth/logout', { refresh_token: refreshToken })
    } catch {
      // Client session is cleared even if the API call fails.
    } finally {
      clearSession()
      setUser(null)
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      logout,
    }),
    [user, isLoading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
