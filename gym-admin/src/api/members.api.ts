import { apiFetch } from './client'
import type { Member } from '@/types/member.types'
import type { PaginatedData, PageParams } from '@/types/common.types'

export interface AttendancePeriod {
  present: number
  absent: number
  days_in_period: number
}

export interface AttendanceStats {
  member_id: number
  member_name: string
  member_code: string
  total_visits: number
  avg_duration_mins: number
  last_visit_at: string | null
  streak: number
  avg_visits_per_week: number
  week: AttendancePeriod
  month: AttendancePeriod
  quarter: AttendancePeriod
  half_year: AttendancePeriod
  year: AttendancePeriod
  risk: 'regular' | 'irregular' | 'at_risk'
}

export interface MemberListParams extends PageParams {
  search?: string
  status?: string
  facility_id?: number
  trainer_id?: number
  joined_from?: string
  joined_to?: string
  plan_id?: number
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

  getAttendanceSummary: (facilityId?: number) =>
    apiFetch<{ stats: AttendanceStats[] }>('/members/attendance/summary', {
      params: facilityId ? { facility_id: facilityId } : undefined,
    }),

  assignTrainer: (id: number, trainerId: number | null, trainerName: string) =>
    apiFetch<unknown>(`/members/${id}/assign-trainer`, {
      method: 'PATCH',
      body: JSON.stringify({ trainer_id: trainerId, trainer_name: trainerName }),
    }),

  linkDevice: (id: number, deviceUserId: string) =>
    apiFetch<Member>(`/members/${id}/device-link`, {
      method: 'PATCH',
      body: JSON.stringify({ device_user_id: deviceUserId }),
    }),

  getDeviceMappings: () =>
    apiFetch<Record<string, number>>('/members/device-mappings'),

  getLastScan: () =>
    apiFetch<{ device_user_id: string; name: string; scanned_at: string } | null>('/biometric/last-scan'),

  requestScan: () =>
    apiFetch<void>('/biometric/request-scan', { method: 'POST', body: '{}' }),

  requestEnroll: (subjectType: string, subjectId: number) =>
    apiFetch<{ device_user_id: string; status: string }>('/biometric/enroll', {
      method: 'POST',
      body: JSON.stringify({ subject_type: subjectType, subject_id: subjectId }),
    }),

  getEnrollStatus: () =>
    apiFetch<{ status: 'none' | 'pending' | 'done'; success?: boolean; device_user_id?: string }>('/biometric/enroll-status'),

  deleteDeviceUser: (deviceUserId: string) =>
    apiFetch<void>('/biometric/delete-device-user', {
      method: 'POST',
      body: JSON.stringify({ device_user_id: deviceUserId }),
    }),
}
