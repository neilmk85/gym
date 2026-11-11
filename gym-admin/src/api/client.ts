import { useAuthStore } from '@/store/auth.store'

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) ?? '/api/v1'

export class ApiError extends Error {
  code: string
  status: number
  details?: string

  constructor(code: string, message: string, status: number, details?: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.details = details
  }
}

// Singleton refresh promise to prevent concurrent refresh races
let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('gym_refresh_token')
  if (!refreshToken) return null

  try {
    const res = await fetch(`${BASE_URL}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    if (!res.ok) return null
    const body = await res.json()
    if (!body.success) return null

    const { access_token, refresh_token } = body.data
    useAuthStore.getState().updateAccessToken(access_token)
    localStorage.setItem('gym_refresh_token', refresh_token)
    return access_token
  } catch {
    return null
  }
}

interface FetchOptions extends RequestInit {
  params?: object
  isRetry?: boolean
}

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { params, isRetry, ...fetchOptions } = options

  // Build URL with query params
  let url = `${BASE_URL}${path}`
  if (params) {
    const query = new URLSearchParams()
    for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
      if (v !== undefined && v !== null && v !== '') {
        query.set(k, String(v))
      }
    }
    const qs = query.toString()
    if (qs) url = `${url}?${qs}`
  }

  // Attach auth header
  const accessToken = useAuthStore.getState().accessToken
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  }
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`

  const res = await fetch(url, { ...fetchOptions, headers })

  // Handle 401 — attempt token refresh once
  if (res.status === 401 && !isRetry) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => { refreshPromise = null })
    }
    const newToken = await refreshPromise
    if (!newToken) {
      useAuthStore.getState().logout()
      throw new ApiError('UNAUTHORIZED', 'Session expired. Please log in again.', 401)
    }
    // Retry with new token
    return apiFetch<T>(path, { ...options, isRetry: true })
  }

  // Parse JSON envelope
  const body = await res.json()

  if (!body.success || !res.ok) {
    throw new ApiError(
      body.error?.code ?? 'UNKNOWN_ERROR',
      body.error?.message ?? 'An unexpected error occurred',
      res.status,
      body.error?.details,
    )
  }

  return body.data as T
}

// Convenience for CSV blob downloads
export async function apiFetchBlob(path: string, params?: Record<string, string>): Promise<Blob> {
  const accessToken = useAuthStore.getState().accessToken
  let url = `${BASE_URL}${path}`
  if (params) {
    const query = new URLSearchParams(params)
    url = `${url}?${query.toString()}`
  }
  const res = await fetch(url, {
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  })
  if (!res.ok) throw new ApiError('DOWNLOAD_ERROR', 'Failed to download file', res.status)
  return res.blob()
}
