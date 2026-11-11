import { apiFetch } from './client'
import type { PaginatedData, PageParams } from '@/types/common.types'

export interface BookingMember {
  id: number
  user: { first_name: string; last_name: string; email: string }
}

export interface BookingDayPass {
  id: number
  guest_name: string
  guest_phone?: string
  guest_email?: string
}

export interface ClassBooking {
  id: number
  class_id: number
  member_id?: number
  day_pass_id?: number
  status: 'confirmed' | 'waitlisted' | 'cancelled' | 'attended' | 'no_show'
  waitlist_position?: number
  booked_at: string
  cancelled_at?: string
  cancel_reason?: string
  created_at: string
  updated_at: string
  class?: { id: number; name: string; start_time: string }
  member?: BookingMember
  day_pass?: BookingDayPass
}

export const bookingsApi = {
  list: (params?: PageParams & { class_id?: number; member_id?: number; status?: string }) =>
    apiFetch<{ bookings: ClassBooking[]; meta: unknown }>('/bookings', { params }),

  getById: (id: number) =>
    apiFetch<ClassBooking>(`/bookings/${id}`),

  bookClass: (data: { class_id: number; member_id?: number; day_pass_id?: number }) =>
    apiFetch<ClassBooking>('/bookings', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // kept for backwards compat
  book: (memberId: number, classId: number) =>
    apiFetch<ClassBooking>('/bookings', {
      method: 'POST',
      body: JSON.stringify({ member_id: memberId, class_id: classId }),
    }),

  cancel: (id: number, reason?: string) =>
    apiFetch<ClassBooking>(`/bookings/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    }),

  markAttended: (id: number) =>
    apiFetch<ClassBooking>(`/bookings/${id}/attend`, { method: 'POST' }),

  markNoShow: (id: number) =>
    apiFetch<ClassBooking>(`/bookings/${id}/no-show`, { method: 'POST' }),
}
