import { apiFetch } from './client'

export interface StaffLoginRow {
  staff_id: number
  employee_id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  role: string
  department: string
  has_login: boolean
  login_enabled: boolean
  user_id?: number
}

export interface StaffLoginsResponse {
  staff: StaffLoginRow[]
  meta: { total: number; page: number; per_page: number; total_pages: number }
}

export const staffLoginsApi = {
  list: (params: { search?: string; page?: number; per_page?: number }) => {
    const q = new URLSearchParams()
    if (params.search)   q.set('search', params.search)
    if (params.page)     q.set('page', String(params.page))
    if (params.per_page) q.set('per_page', String(params.per_page))
    return apiFetch<StaffLoginsResponse>(`/superadmin/staff-logins?${q}`)
  },

  grantLogin: (staffId: number) =>
    apiFetch(`/superadmin/staff/${staffId}/login`, { method: 'POST', body: '{}' }),

  toggleLogin: (staffId: number, loginEnabled: boolean) =>
    apiFetch(`/superadmin/staff/${staffId}/login`, {
      method: 'PATCH',
      body: JSON.stringify({ login_enabled: loginEnabled }),
    }),
}
