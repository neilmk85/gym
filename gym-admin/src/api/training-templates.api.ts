import { apiFetch } from './client'

export const trainingTemplatesApi = {
  list: (params?: { category?: string; difficulty?: string; active_only?: boolean }) =>
    apiFetch<{ training_templates: unknown[]; meta: unknown }>('/training-templates', { params }),
  getById: (id: number) => apiFetch<unknown>(`/training-templates/${id}`),
  create: (data: Record<string, unknown>) =>
    apiFetch<unknown>('/training-templates', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Record<string, unknown>) =>
    apiFetch<unknown>(`/training-templates/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch<void>(`/training-templates/${id}`, { method: 'DELETE' }),
}
