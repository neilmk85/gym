import { apiFetch } from './client'

export interface BodyMeasurement {
  id: number
  member_id: number
  recorded_by_id: number
  measured_at: string
  weight_kg?: number
  height_cm?: number
  body_fat_pct?: number
  muscle_mass_kg?: number
  waist_cm?: number
  chest_cm?: number
  hips_cm?: number
  thigh_cm?: number
  bicep_cm?: number
  bmi?: number
  notes?: string
  created_at: string
}

export interface ProgressPhoto {
  id: number
  member_id: number
  uploaded_by_id: number
  photo_url: string
  angle?: string
  photo_date: string
  notes?: string
  created_at: string
}

export interface RetentionRisk {
  id: number
  member_id: number
  raised_by_id: number
  risk_level: 'low' | 'medium' | 'high'
  reason: string
  is_resolved: boolean
  resolved_at?: string
  notes?: string
  created_at: string
  member?: { user: { first_name: string; last_name: string } }
}

export interface RetentionAction {
  id: number
  retention_risk_id: number
  member_id: number
  assigned_to_id: number
  action_type: 'call' | 'message' | 'visit' | 'other'
  status: 'open' | 'done' | 'skipped'
  due_date: string
  notes?: string
  outcome?: string
  completed_at?: string
  created_at: string
}

export const retentionApi = {
  // Body measurements
  recordMeasurement: (data: Partial<BodyMeasurement> & { measured_at: string }) =>
    apiFetch('/body-measurements', { method: 'POST', body: JSON.stringify(data) }),

  getMeasurement: (id: number) => apiFetch(`/body-measurements/${id}`),

  listMeasurementsByMember: (memberId: number, params?: { page?: number; per_page?: number }) => {
    const q = new URLSearchParams()
    if (params?.page) q.set('page', String(params.page))
    if (params?.per_page) q.set('per_page', String(params.per_page))
    return apiFetch(`/members/${memberId}/body-measurements?${q}`)
  },

  deleteMeasurement: (id: number) =>
    apiFetch(`/body-measurements/${id}`, { method: 'DELETE' }),

  // Progress photos
  addPhoto: (data: { member_id: number; photo_url: string; angle?: string; photo_date?: string; notes?: string }) =>
    apiFetch('/progress-photos', { method: 'POST', body: JSON.stringify(data) }),

  getPhoto: (id: number) => apiFetch(`/progress-photos/${id}`),

  listPhotosByMember: (memberId: number, params?: { page?: number; per_page?: number }) => {
    const q = new URLSearchParams()
    if (params?.page) q.set('page', String(params.page))
    if (params?.per_page) q.set('per_page', String(params.per_page))
    return apiFetch(`/members/${memberId}/progress-photos?${q}`)
  },

  deletePhoto: (id: number) =>
    apiFetch(`/progress-photos/${id}`, { method: 'DELETE' }),

  // Retention risks
  raiseRisk: (data: { member_id: number; risk_level: string; reason: string; notes?: string }) =>
    apiFetch('/retention/risks', { method: 'POST', body: JSON.stringify(data) }),

  listOpenRisks: (params?: { page?: number; per_page?: number }) => {
    const q = new URLSearchParams()
    if (params?.page) q.set('page', String(params.page))
    if (params?.per_page) q.set('per_page', String(params.per_page))
    return apiFetch(`/retention/risks?${q}`)
  },

  getRisk: (id: number) => apiFetch(`/retention/risks/${id}`),

  resolveRisk: (id: number, notes?: string) =>
    apiFetch(`/retention/risks/${id}/resolve`, { method: 'POST', body: JSON.stringify({ notes }) }),

  listRisksByMember: (memberId: number, params?: { page?: number; per_page?: number }) => {
    const q = new URLSearchParams()
    if (params?.page) q.set('page', String(params.page))
    if (params?.per_page) q.set('per_page', String(params.per_page))
    return apiFetch(`/members/${memberId}/retention-risks?${q}`)
  },

  // Retention actions
  createAction: (data: {
    retention_risk_id: number
    member_id: number
    assigned_to_id: number
    action_type: string
    due_date: string
    notes?: string
  }) => apiFetch('/retention/actions', { method: 'POST', body: JSON.stringify(data) }),

  listActionsByRisk: (riskId: number) => apiFetch(`/retention/risks/${riskId}/actions`),

  completeAction: (id: number, outcome?: string) =>
    apiFetch(`/retention/actions/${id}/complete`, { method: 'POST', body: JSON.stringify({ outcome }) }),
}
