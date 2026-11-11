import { apiFetch } from './client'
import type { Payment } from '@/types/payment.types'
import type { PaginatedData, PageParams } from '@/types/common.types'

export interface PaymentListParams extends PageParams {
  from?: string
  to?: string
  status?: string
  method?: string
}

export const paymentsApi = {
  list: (params?: PaymentListParams) =>
    apiFetch<PaginatedData<Payment>>('/payments', { params }),

  listByMember: (memberId: number, params?: PageParams) =>
    apiFetch<PaginatedData<Payment>>(`/members/${memberId}/payments`, { params }),

  getById: (id: number) => apiFetch<Payment>(`/payments/${id}`),

  record: (data: Record<string, unknown>) =>
    apiFetch<Payment>('/payments', { method: 'POST', body: JSON.stringify(data) }),

  refund: (id: number, amount: number, reason: string) =>
    apiFetch<Payment>(`/payments/${id}/refund`, {
      method: 'POST',
      body: JSON.stringify({ amount, reason }),
    }),
}
