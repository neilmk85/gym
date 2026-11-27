import { apiFetch } from './client'
import type { PageParams, PageMeta } from '@/types/common.types'

export type StaffRole = 'trainer' | 'receptionist' | 'manager' | 'other'

export interface TrainerProfileSnippet {
  id: number
  bio?: string
  specializations?: string[]
  certifications?: string[]
  experience_years: number
  hourly_rate: number
  max_clients_per_day: number
  is_active: boolean
}

export interface Staff {
  id: number
  employee_id: string
  role: StaffRole
  user_id?: number
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
  device_user_id?: string
  created_at: string
  updated_at: string
  trainer_profile?: TrainerProfileSnippet
}

export const staffApi = {
  list: (params?: PageParams & { status?: string; department?: string; role?: string; search?: string }) =>
    apiFetch<{ data: Staff[]; meta: PageMeta }>('/staff', { params }),

  getById: (id: number) =>
    apiFetch<Staff>(`/staff/${id}`),

  create: (data: Record<string, unknown>) =>
    apiFetch<Staff>('/staff', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: number, data: Record<string, unknown>) =>
    apiFetch<Staff>(`/staff/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: number) =>
    apiFetch<void>(`/staff/${id}`, { method: 'DELETE' }),

  linkDevice: (id: number, deviceUserId: string) =>
    apiFetch<Staff>(`/staff/${id}/device-link`, {
      method: 'PATCH',
      body: JSON.stringify({ device_user_id: deviceUserId }),
    }),
}
