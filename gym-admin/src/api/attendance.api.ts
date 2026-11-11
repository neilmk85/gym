import { apiFetch } from './client'
import type { AttendanceRecord } from '@/types/attendance.types'
import type { PaginatedData, PageParams } from '@/types/common.types'

export const attendanceApi = {
  list: (params?: PageParams & { member_id?: number; from?: string; to?: string }) =>
    apiFetch<PaginatedData<AttendanceRecord>>('/attendance', { params }),

  checkIn: (data: Record<string, unknown>) =>
    apiFetch<unknown>('/attendance/check-in', { method: 'POST', body: JSON.stringify(data) }),

  checkOut: (memberId: number) =>
    apiFetch<unknown>('/attendance/check-out', {
      method: 'POST',
      body: JSON.stringify({ member_id: memberId }),
    }),

  getQRCode: (memberId: number) =>
    apiFetch<{ qr_code: string }>(`/members/${memberId}/qr-code`),

  getMemberStats: (memberId: number) =>
    apiFetch<unknown>(`/members/${memberId}/attendance/stats`),
}
