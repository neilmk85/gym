import { apiFetch } from './client'
import type { Subscription } from '@/types/subscription.types'
import type { PaginatedData, PageParams } from '@/types/common.types'

export interface SubscriptionListParams extends PageParams {
  status?: string
  from?: string
  to?: string
}

export const subscriptionsApi = {
  list: (params?: SubscriptionListParams) =>
    apiFetch<PaginatedData<Subscription>>('/subscriptions', { params }),

  getById: (id: number) => apiFetch<Subscription>(`/subscriptions/${id}`),

  create: (data: Record<string, unknown>) =>
    apiFetch<Subscription>('/subscriptions', { method: 'POST', body: JSON.stringify(data) }),

  pause: (id: number, reason: string, days: number, startDate?: string) =>
    apiFetch<Subscription>(`/subscriptions/${id}/pause`, {
      method: 'POST',
      body: JSON.stringify({ reason, days, start_date: startDate }),
    }),

  resume: (id: number) =>
    apiFetch<Subscription>(`/subscriptions/${id}/resume`, { method: 'POST' }),

  cancel: (id: number, reason: string, feedback?: string) =>
    apiFetch<Subscription>(`/subscriptions/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason, feedback }),
    }),

  upgrade: (id: number, newPlanId: number) =>
    apiFetch<Subscription>(`/subscriptions/${id}/upgrade`, {
      method: 'POST',
      body: JSON.stringify({ new_plan_id: newPlanId }),
    }),

  extend: (id: number, extraMonths: number, extraDays: number, reason?: string) =>
    apiFetch<Subscription>(`/subscriptions/${id}/extend`, {
      method: 'POST',
      body: JSON.stringify({ extra_months: extraMonths, extra_days: extraDays, reason: reason ?? '' }),
    }),

  setAutoRenew: (id: number, autoRenew: boolean) =>
    apiFetch<Subscription>(`/subscriptions/${id}/auto-renew`, {
      method: 'PATCH',
      body: JSON.stringify({ auto_renew: autoRenew }),
    }),

  transfer: (id: number, data: {
    target_member_id: number
    months_to_transfer: number
    transfer_start_date: string
    transfer_end_date: string
    reason?: string
  }) =>
    apiFetch<{ old_subscription: Subscription; new_subscription: Subscription }>(
      `/subscriptions/${id}/transfer`,
      { method: 'POST', body: JSON.stringify(data) },
    ),

  getByMember: (memberId: number) =>
    apiFetch<{ subscriptions: Subscription[] }>(`/members/${memberId}/subscriptions`),
}
