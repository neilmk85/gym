import { apiFetch } from './client'

export interface PTPackage {
  id: number
  facility_id: number
  name: string
  description?: string
  category: string
  sessions: number
  validity_days: number
  price: number
  currency: string
  gym_pct: number
  status: 'active' | 'inactive'
  is_active: boolean
  created_at: string
}

export interface MemberPTPackage {
  id: number
  member_id: number
  facility_id: number
  pt_package_id: number
  trainer_id?: number
  payment_id?: number
  total_sessions: number
  used_sessions: number
  amount: number
  currency: string
  purchased_at: string
  expires_at: string
  is_active: boolean
  notes?: string
  pt_package?: PTPackage
  member?: { id: number; user?: { first_name: string; last_name: string; email?: string; phone?: string } }
  trainer?: { id: number; user?: { first_name: string; last_name: string } }
}

export interface PTSession {
  id: number
  member_id: number
  facility_id: number
  member_pt_package_id?: number
  trainer_id: number
  scheduled_at: string
  duration_minutes: number
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show'
  notes?: string
  trainer_notes?: string
  cancel_reason?: string
  completed_at?: string
  created_at: string
  member?: { user?: { first_name: string; last_name: string } }
  trainer?: { user?: { first_name: string; last_name: string } }
}

export interface SessionCreditLedger {
  id: number
  member_id: number
  member_pt_package_id: number
  pt_session_id?: number
  entry_type: 'credit' | 'debit' | 'expiry' | 'refund'
  sessions: number
  balance_after: number
  description?: string
  created_at: string
}

export const ptApi = {
  // Packages
  listPackages: (facilityId = 1) =>
    apiFetch<{ pt_packages: PTPackage[] }>(`/pt-packages?facility_id=${facilityId}`),

  createPackage: (data: Partial<PTPackage>) =>
    apiFetch<PTPackage>('/pt-packages', { method: 'POST', body: JSON.stringify(data) }),

  updatePackage: (id: number, data: Partial<PTPackage>) =>
    apiFetch<PTPackage>(`/pt-packages/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deactivatePackage: (id: number) =>
    apiFetch<{ status: string }>(`/pt-packages/${id}`, { method: 'DELETE' }),

  // All member packages (facility-wide, for reports)
  listAllMemberPackages: (params?: { facility_id?: number; page?: number; per_page?: number }) => {
    const qs = new URLSearchParams()
    qs.set('facility_id', String(params?.facility_id ?? 1))
    if (params?.page) qs.set('page', String(params.page))
    if (params?.per_page) qs.set('per_page', String(params.per_page))
    return apiFetch<{ member_pt_packages: MemberPTPackage[]; meta: { total: number; page: number; per_page: number } }>(
      `/member-pt-packages?${qs}`
    )
  },

  // Member packages
  purchasePackage: (data: Record<string, unknown>) =>
    apiFetch<MemberPTPackage>('/member-pt-packages', { method: 'POST', body: JSON.stringify(data) }),

  getMemberPackages: (memberId: number, params?: { page?: number; per_page?: number }) => {
    const qs = new URLSearchParams()
    if (params?.page) qs.set('page', String(params.page))
    if (params?.per_page) qs.set('per_page', String(params.per_page))
    return apiFetch<{ pt_packages: MemberPTPackage[]; meta: unknown }>(`/members/${memberId}/pt-packages?${qs}`)
  },

  getActiveMemberPackages: (memberId: number) =>
    apiFetch<{ pt_packages: MemberPTPackage[] }>(`/members/${memberId}/pt-packages/active`),

  // Sessions
  scheduleSession: (data: Record<string, unknown>) =>
    apiFetch<PTSession>('/pt-sessions', { method: 'POST', body: JSON.stringify(data) }),

  getSession: (id: number) => apiFetch<PTSession>(`/pt-sessions/${id}`),

  completeSession: (id: number, trainerNotes?: string) =>
    apiFetch<PTSession>(`/pt-sessions/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ trainer_notes: trainerNotes ?? '' }),
    }),

  cancelSession: (id: number, reason: string) =>
    apiFetch<PTSession>(`/pt-sessions/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  markNoShow: (id: number) =>
    apiFetch<PTSession>(`/pt-sessions/${id}/no-show`, { method: 'POST' }),

  getMemberSessions: (memberId: number, params?: { page?: number; per_page?: number }) => {
    const qs = new URLSearchParams()
    if (params?.page) qs.set('page', String(params.page))
    if (params?.per_page) qs.set('per_page', String(params.per_page))
    return apiFetch<{ pt_sessions: PTSession[]; meta: unknown }>(`/members/${memberId}/pt-sessions?${qs}`)
  },

  getTrainerSessions: (trainerId: number, params?: { page?: number; per_page?: number }) => {
    const qs = new URLSearchParams()
    if (params?.page) qs.set('page', String(params.page))
    if (params?.per_page) qs.set('per_page', String(params.per_page))
    return apiFetch<{ pt_sessions: PTSession[]; meta: unknown }>(`/trainers/${trainerId}/pt-sessions?${qs}`)
  },

  listAllSessions: (params?: { facility_id?: number; trainer_id?: number; status?: string; page?: number; per_page?: number }) => {
    const qs = new URLSearchParams()
    qs.set('facility_id', String(params?.facility_id ?? 1))
    if (params?.trainer_id) qs.set('trainer_id', String(params.trainer_id))
    if (params?.status && params.status !== 'all') qs.set('status', params.status)
    if (params?.page) qs.set('page', String(params.page))
    if (params?.per_page) qs.set('per_page', String(params.per_page))
    return apiFetch<{ pt_sessions: PTSession[]; meta: { total: number; page: number; per_page: number } }>(`/pt-sessions?${qs}`)
  },

  getSessionCredits: (memberId: number) =>
    apiFetch<{ credits: SessionCreditLedger[] }>(`/members/${memberId}/session-credits`),
}
