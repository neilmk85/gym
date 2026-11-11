import { apiFetch } from './client'
import type { LoginResponse, RefreshResponse, AuthUser } from '@/types/auth.types'

export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: (refreshToken: string) =>
    apiFetch<void>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    }),

  me: () => apiFetch<AuthUser>('/auth/me'),

  updateMe: (data: { first_name: string; last_name: string; phone?: string }) =>
    apiFetch<AuthUser>('/auth/me', { method: 'PATCH', body: JSON.stringify(data) }),

  forgotPassword: (email: string) =>
    apiFetch<void>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, password: string) =>
    apiFetch<void>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, new_password: password }),
    }),

  changePassword: (currentPassword: string, newPassword: string) =>
    apiFetch<void>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    }),

  refresh: (refreshToken: string) =>
    apiFetch<RefreshResponse>('/auth/refresh-token', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    }),
}
