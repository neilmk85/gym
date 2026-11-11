import { apiFetch } from './client'
import type { PaginatedData } from '@/types/common.types'

export const promoCodesApi = {
  list: () => apiFetch<PaginatedData<unknown>>('/promo-codes'),
  getById: (id: number) => apiFetch<unknown>(`/promo-codes/${id}`),
  create: (data: Record<string, unknown>) =>
    apiFetch<unknown>('/promo-codes', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Record<string, unknown>) =>
    apiFetch<unknown>(`/promo-codes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deactivate: (id: number) =>
    apiFetch<void>(`/promo-codes/${id}`, { method: 'DELETE' }),
  validate: (code: string, planId: number, memberId: number) =>
    apiFetch<unknown>('/promo-codes/validate', {
      params: { code, plan_id: planId, member_id: memberId },
    }),
  broadcast: (id: number) =>
    apiFetch<{ message: string; code: string }>(`/promo-codes/${id}/broadcast`, { method: 'POST' }),
}
