import { apiFetch } from './client'
import type { PageParams, PageMeta } from '@/types/common.types'

export interface Staff {
  id: number
  employee_id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  secondary_phone?: string
  date_of_birth?: string
  gender?: string
  address?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  department: string
  designation: string
  employment_type: string
  date_of_joining: string
  reporting_to?: string
  salary: number
  pan_number?: string
  aadhar_number?: string
  status: string
  notes?: string
  created_at: string
  updated_at: string
}

export const staffApi = {
  list: (params?: PageParams & { status?: string; department?: string; search?: string }) =>
    apiFetch<{ data: Staff[]; meta: PageMeta }>('/staff', { params }),

  getById: (id: number) =>
    apiFetch<Staff>(`/staff/${id}`),

  create: (data: Record<string, unknown>) =>
    apiFetch<Staff>('/staff', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: number, data: Record<string, unknown>) =>
    apiFetch<Staff>(`/staff/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: number) =>
    apiFetch<void>(`/staff/${id}`, { method: 'DELETE' }),
}
