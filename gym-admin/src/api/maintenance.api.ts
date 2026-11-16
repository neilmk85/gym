import { apiFetch } from './client'
import type { PageMeta } from '@/types/common.types'

export type MaintenanceStatus = 'pending' | 'in_progress' | 'done' | 'cancelled'
export type MaintenancePriority = 'low' | 'medium' | 'high'
export type MaintenanceCategory =
  | 'equipment' | 'plumbing' | 'electrical' | 'hvac' | 'flooring' | 'other'

export interface MaintenanceTask {
  id: number
  facility_id: number
  title: string
  description: string
  category: MaintenanceCategory
  priority: MaintenancePriority
  status: MaintenanceStatus
  assigned_to: string
  estimate_cost: number
  actual_cost: number
  scheduled_at?: string | null
  completed_at?: string | null
  notes: string
  created_by_id?: number
  created_at: string
  updated_at: string
}

export interface MaintenanceListResponse {
  tasks: MaintenanceTask[]
  meta: PageMeta
}

export interface CreateMaintenancePayload {
  facility_id?: number
  title: string
  description?: string
  category?: MaintenanceCategory
  priority?: MaintenancePriority
  assigned_to?: string
  estimate_cost?: number
  scheduled_at?: string
  notes?: string
}

export interface UpdateMaintenancePayload {
  title?: string
  description?: string
  category?: MaintenanceCategory
  priority?: MaintenancePriority
  status?: MaintenanceStatus
  assigned_to?: string
  estimate_cost?: number
  actual_cost?: number
  scheduled_at?: string
  notes?: string
}

export interface MaintenanceListParams {
  page?: number
  per_page?: number
  facility_id?: number
  status?: MaintenanceStatus | ''
  category?: MaintenanceCategory | ''
  priority?: MaintenancePriority | ''
}

export const maintenanceApi = {
  list: (params?: MaintenanceListParams) =>
    apiFetch<MaintenanceListResponse>('/maintenance', { params }),

  getById: (id: number) =>
    apiFetch<MaintenanceTask>(`/maintenance/${id}`),

  create: (data: CreateMaintenancePayload) =>
    apiFetch<MaintenanceTask>('/maintenance', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: number, data: UpdateMaintenancePayload) =>
    apiFetch<MaintenanceTask>(`/maintenance/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    apiFetch<{ message: string }>(`/maintenance/${id}`, { method: 'DELETE' }),
}
