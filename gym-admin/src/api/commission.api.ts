import { apiFetch } from './client'

export interface CommissionRule {
  id: number
  staff_id: number
  event_type: string
  rule_type: 'percentage' | 'fixed'
  value: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CommissionEntry {
  id: number
  staff_id: number
  rule_id?: number
  event_type: string
  ref_model?: string
  ref_id?: number
  base_amt_paise: number
  comm_paise: number
  status: 'pending' | 'approved' | 'paid' | 'cancelled'
  approved_at?: string
  paid_at?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface CommissionPayout {
  id: number
  staff_id: number
  period_start: string
  period_end: string
  total_paise: number
  status: 'pending' | 'paid'
  paid_at?: string
  notes?: string
  created_at: string
  updated_at: string
}

export const commissionApi = {
  createRule: (payload: Omit<CommissionRule, 'id' | 'is_active' | 'created_at' | 'updated_at'>) =>
    apiFetch<CommissionRule>('/commission-rules', { method: 'POST', body: JSON.stringify(payload) }),
  listRules: (staffId: number) =>
    apiFetch<CommissionRule[]>(`/staff/${staffId}/commission-rules`),
  updateRule: (id: number, payload: Partial<CommissionRule>) =>
    apiFetch<CommissionRule>(`/commission-rules/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteRule: (id: number) =>
    apiFetch<{ status: string }>(`/commission-rules/${id}`, { method: 'DELETE' }),

  listEntries: (staffId: number, page = 1, perPage = 20) =>
    apiFetch<{ data: CommissionEntry[]; meta: unknown }>(`/staff/${staffId}/commissions`, { params: { page, per_page: perPage } }),
  approveEntry: (id: number) =>
    apiFetch<{ status: string }>(`/commissions/${id}/approve`, { method: 'POST', body: JSON.stringify({}) }),
  cancelEntry: (id: number) =>
    apiFetch<{ status: string }>(`/commissions/${id}/cancel`, { method: 'POST', body: JSON.stringify({}) }),

  createPayout: (staffId: number, periodStart: string, periodEnd: string) =>
    apiFetch<CommissionPayout>('/commission-payouts', { method: 'POST', body: JSON.stringify({ staff_id: staffId, period_start: periodStart, period_end: periodEnd }) }),
  markPayoutPaid: (id: number) =>
    apiFetch<{ status: string }>(`/commission-payouts/${id}/mark-paid`, { method: 'POST', body: JSON.stringify({}) }),
  listPayouts: (staffId: number, page = 1, perPage = 20) =>
    apiFetch<{ data: CommissionPayout[]; meta: unknown }>(`/staff/${staffId}/commission-payouts`, { params: { page, per_page: perPage } }),
}
