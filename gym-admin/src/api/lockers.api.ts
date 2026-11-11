import { apiFetch } from './client'

export interface Locker {
  id: number
  number: string
  location: string
  status: 'available' | 'occupied' | 'maintenance'
  notes: string
  created_at: string
  updated_at: string
}

export interface LockerAllotment {
  id: number
  locker_id: number
  member_id: number
  start_date: string
  end_date: string
  fee_amount: number
  fee_paid: boolean
  status: 'active' | 'expired' | 'released'
  notes: string
  released_at?: string
  created_at: string
  updated_at: string
  locker: Locker
  member: {
    id: number
    member_code: string
    user: { first_name: string; last_name: string; email: string; phone?: string }
  }
}

export interface CreateLockerPayload {
  number: string
  location?: string
  notes?: string
}

export interface UpdateLockerPayload {
  number?: string
  location?: string
  status?: string
  notes?: string
}

export interface AllocateLockerPayload {
  locker_id: number
  member_id: number
  start_date: string   // YYYY-MM-DD
  end_date: string     // YYYY-MM-DD
  fee_amount: number
  notes?: string
}

export const lockersApi = {
  // Lockers
  createLocker: (payload: CreateLockerPayload) =>
    apiFetch<Locker>('/lockers', { method: 'POST', body: JSON.stringify(payload) }),

  listLockers: (status?: string) =>
    apiFetch<{ lockers: Locker[] }>('/lockers', { params: status ? { status } : undefined }),

  updateLocker: (id: number, payload: UpdateLockerPayload) =>
    apiFetch<Locker>(`/lockers/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  deleteLocker: (id: number) =>
    apiFetch<{ message: string }>(`/lockers/${id}`, { method: 'DELETE' }),

  // Allotments
  allocate: (payload: AllocateLockerPayload) =>
    apiFetch<LockerAllotment>('/locker-allotments', { method: 'POST', body: JSON.stringify(payload) }),

  listActiveAllotments: () =>
    apiFetch<{ allotments: LockerAllotment[] }>('/locker-allotments'),

  markFeePaid: (id: number) =>
    apiFetch<LockerAllotment>(`/locker-allotments/${id}/mark-paid`, { method: 'POST', body: '{}' }),

  release: (id: number) =>
    apiFetch<LockerAllotment>(`/locker-allotments/${id}/release`, { method: 'POST', body: '{}' }),
}
