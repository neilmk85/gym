import { apiFetch } from './client'
import type { GymClass } from '@/types/class.types'
import type { PaginatedData, PageParams } from '@/types/common.types'

export const classesApi = {
  list: (params?: PageParams & { trainer_id?: number; status?: string; date?: string }) =>
    apiFetch<PaginatedData<GymClass>>('/classes', { params }),

  upcoming: () => apiFetch<GymClass[]>('/classes/upcoming'),

  getById: (id: number) => apiFetch<GymClass>(`/classes/${id}`),

  getRoster: (id: number) => apiFetch<unknown[]>(`/classes/${id}/bookings`),

  create: (data: Record<string, unknown>) =>
    apiFetch<GymClass>('/classes', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: number, data: Record<string, unknown>) =>
    apiFetch<GymClass>(`/classes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  cancel: (id: number, reason: string) =>
    apiFetch<void>(`/classes/${id}`, { method: 'DELETE', body: JSON.stringify({ reason }) }),
}
