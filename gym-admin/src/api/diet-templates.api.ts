import { apiFetch } from './client'

export const dietTemplatesApi = {
  list: (params?: { category?: string; active_only?: boolean }) =>
    apiFetch<{ diet_templates: unknown[]; meta: unknown }>('/diet-templates', { params }),
  getById: (id: number) => apiFetch<unknown>(`/diet-templates/${id}`),
  create: (data: Record<string, unknown>) =>
    apiFetch<unknown>('/diet-templates', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Record<string, unknown>) =>
    apiFetch<unknown>(`/diet-templates/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch<void>(`/diet-templates/${id}`, { method: 'DELETE' }),
}
