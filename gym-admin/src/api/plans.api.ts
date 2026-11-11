import { apiFetch } from './client'
import type { Plan } from '@/types/plan.types'

export const plansApi = {
  list: (activeOnly?: boolean) =>
    apiFetch<{ plans: Plan[]; meta: unknown }>('/plans', {
      params: activeOnly !== undefined ? { active_only: activeOnly } : undefined,
    }),

  getById: (id: number) => apiFetch<Plan>(`/plans/${id}`),

  create: (data: Record<string, unknown>) =>
    apiFetch<Plan>('/plans', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: number, data: Record<string, unknown>) =>
    apiFetch<Plan>(`/plans/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deactivate: (id: number) =>
    apiFetch<void>(`/plans/${id}`, { method: 'DELETE' }),

  activate: (id: number) =>
    apiFetch<void>(`/plans/${id}/activate`, { method: 'POST' }),
}
