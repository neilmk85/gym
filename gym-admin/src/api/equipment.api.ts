import { apiFetch } from './client'
import type { PageParams, PageMeta } from '@/types/common.types'

export interface Equipment {
  id: number
  name: string
  brand: string
  category: string
  quantity: number
  weight_kg?: number
  unit: string
  condition: string
  location?: string
  serial_number?: string
  purchased_at?: string
  notes?: string
  created_at: string
  updated_at: string
}

export const equipmentApi = {
  list: (params?: PageParams & { condition?: string; category?: string; search?: string }) =>
    apiFetch<{ data: Equipment[]; meta: PageMeta }>('/equipment', { params }),

  getById: (id: number) =>
    apiFetch<Equipment>(`/equipment/${id}`),

  create: (data: Record<string, unknown>) =>
    apiFetch<Equipment>('/equipment', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: number, data: Record<string, unknown>) =>
    apiFetch<Equipment>(`/equipment/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: number) =>
    apiFetch<void>(`/equipment/${id}`, { method: 'DELETE' }),
}
