import { apiFetch } from './client'
import type { Facility } from '@/types/facility.types'

export const facilitiesApi = {
  list: () => apiFetch<{ facilities: Facility[] }>('/facilities'),
  getById: (id: number) => apiFetch<Facility>(`/facilities/${id}`),
  create: (data: Record<string, unknown>) =>
    apiFetch<Facility>('/facilities', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Record<string, unknown>) =>
    apiFetch<Facility>(`/facilities/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
}
