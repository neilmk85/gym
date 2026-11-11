import { apiFetch } from './client'
import type { Member } from '@/types/member.types'
import type { PaginatedData, PageParams } from '@/types/common.types'

export interface MemberListParams extends PageParams {
  search?: string
  status?: string
  facility_id?: number
  trainer_id?: number
  joined_from?: string
  joined_to?: string
}

export const membersApi = {
  list: (params?: MemberListParams) =>
    apiFetch<PaginatedData<Member>>('/members', { params }),

  getById: (id: number) => apiFetch<Member>(`/members/${id}`),

  create: (data: Record<string, unknown>) =>
    apiFetch<Member>('/members', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: number, data: Record<string, unknown>) =>
    apiFetch<Member>(`/members/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: number, reason: string) =>
    apiFetch<void>(`/members/${id}`, { method: 'DELETE', body: JSON.stringify({ reason }) }),

  freeze: (id: number, reason: string, months?: number) =>
    apiFetch<Member>(`/members/${id}/freeze`, {
      method: 'POST',
      body: JSON.stringify({ reason, freeze_months: months }),
    }),

  unfreeze: (id: number) =>
    apiFetch<Member>(`/members/${id}/unfreeze`, { method: 'POST' }),

  getTimeline: (id: number) =>
    apiFetch<unknown[]>(`/members/${id}/timeline`),

  getSubscriptions: (id: number) =>
    apiFetch<PaginatedData<unknown>>(`/members/${id}/subscriptions`),

  getPayments: (id: number) =>
    apiFetch<PaginatedData<unknown>>(`/members/${id}/payments`),

  getBookings: (id: number) =>
    apiFetch<PaginatedData<unknown>>(`/members/${id}/bookings`),

  getAttendanceStats: (id: number) =>
    apiFetch<unknown>(`/members/${id}/attendance/stats`),

  assignTrainer: (id: number, trainerId: number | null, trainerName: string) =>
    apiFetch<unknown>(`/members/${id}/assign-trainer`, {
      method: 'PATCH',
      body: JSON.stringify({ trainer_id: trainerId, trainer_name: trainerName }),
    }),
}
