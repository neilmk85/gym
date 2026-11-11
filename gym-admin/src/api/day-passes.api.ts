import { apiFetch } from './client'

export const dayPassesApi = {
  list: (params?: { status?: string; date_from?: string; date_to?: string; search?: string }) =>
    apiFetch<{ day_passes: unknown[]; meta: unknown }>('/day-passes', { params }),
  getById: (id: number) => apiFetch<unknown>(`/day-passes/${id}`),
  create: (data: Record<string, unknown>) =>
    apiFetch<unknown>('/day-passes', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Record<string, unknown>) =>
    apiFetch<unknown>(`/day-passes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch<void>(`/day-passes/${id}`, { method: 'DELETE' }),
  checkIn: (id: number) =>
    apiFetch<unknown>(`/day-passes/${id}/check-in`, { method: 'POST' }),
}
