import { apiFetch } from './client'

export interface StaffUser {
  id: number
  email: string
  phone: string
  first_name: string
  last_name: string
  role: string
  status: string
  created_at: string
  updated_at: string
}

export interface StaffUsersResponse {
  users: StaffUser[]
  meta: { total: number; page: number; per_page: number; total_pages: number }
}

export interface UpdateUserPayload {
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  role?: string
  status?: string
}

export interface CreateUserPayload {
  first_name: string
  last_name: string
  email: string
  phone?: string
  password?: string
  role: string
}

export const superadminUsersApi = {
  list: (params: { search?: string; role?: string; status?: string; page?: number; per_page?: number }) => {
    const q = new URLSearchParams()
    if (params.search)   q.set('search', params.search)
    if (params.role)     q.set('role', params.role)
    if (params.status)   q.set('status', params.status)
    if (params.page)     q.set('page', String(params.page))
    if (params.per_page) q.set('per_page', String(params.per_page))
    return apiFetch<StaffUsersResponse>(`/superadmin/users?${q}`)
  },

  create: (payload: CreateUserPayload) =>
    apiFetch<StaffUser>('/superadmin/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  update: (id: number, payload: UpdateUserPayload) =>
    apiFetch<StaffUser>(`/superadmin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
}
