import { apiFetch } from './client'

export interface LeadActivity {
  id: number
  enquiry_id: number
  performed_by_id: number
  activity_type: 'call' | 'email' | 'visit' | 'message' | 'other'
  subject?: string
  notes?: string
  outcome?: string
  activity_date: string
  created_at: string
}

export interface LeadFollowUp {
  id: number
  enquiry_id: number
  assigned_to_id: number
  due_date: string
  subject?: string
  notes?: string
  is_completed: boolean
  completed_at?: string
  created_at: string
  updated_at: string
}

export interface TrialVisit {
  id: number
  enquiry_id: number
  scheduled_at: string
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show'
  assigned_to_id?: number
  notes?: string
  feedback?: string
  converted_to_member_id?: number
  created_at: string
  updated_at: string
}

export interface MemberWaiver {
  id: number
  member_id: number
  waiver_type: 'parq' | 'liability' | 'medical'
  status: 'pending' | 'signed' | 'expired'
  content?: string
  answers?: string
  signed_at?: string
  expires_at?: string
  ip_address?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface LogActivityPayload {
  activity_type?: string
  subject?: string
  notes?: string
  outcome?: string
  activity_date?: string
}

export interface CreateFollowUpPayload {
  assigned_to_id: number
  due_date: string
  subject?: string
  notes?: string
}

export interface ScheduleTrialPayload {
  scheduled_at: string
  assigned_to_id?: number
  notes?: string
}

export interface CreateWaiverPayload {
  member_id: number
  waiver_type: string
  content?: string
  answers?: string
  expires_at?: string
  notes?: string
}

export const crmApi = {
  // Activities
  logActivity: (enquiryId: number, payload: LogActivityPayload) =>
    apiFetch<LeadActivity>(`/enquiries/${enquiryId}/activities`, { method: 'POST', body: JSON.stringify(payload) }),
  listActivities: (enquiryId: number) =>
    apiFetch<LeadActivity[]>(`/enquiries/${enquiryId}/activities`),

  // Follow-ups
  createFollowUp: (enquiryId: number, payload: CreateFollowUpPayload) =>
    apiFetch<LeadFollowUp>(`/enquiries/${enquiryId}/follow-ups`, { method: 'POST', body: JSON.stringify(payload) }),
  listFollowUps: (enquiryId: number) =>
    apiFetch<LeadFollowUp[]>(`/enquiries/${enquiryId}/follow-ups`),
  completeFollowUp: (id: number) =>
    apiFetch<{ status: string }>(`/follow-ups/${id}/complete`, { method: 'POST', body: JSON.stringify({}) }),

  // Trial visits
  scheduleTrial: (enquiryId: number, payload: ScheduleTrialPayload) =>
    apiFetch<TrialVisit>(`/enquiries/${enquiryId}/trials`, { method: 'POST', body: JSON.stringify(payload) }),
  listTrials: (enquiryId: number) =>
    apiFetch<TrialVisit[]>(`/enquiries/${enquiryId}/trials`),
  listUpcomingTrials: (page = 1, perPage = 20) =>
    apiFetch<{ data: TrialVisit[]; meta: unknown }>('/trials/upcoming', { params: { page, per_page: perPage } }),
  updateTrialStatus: (id: number, status: string, feedback?: string) =>
    apiFetch<{ status: string }>(`/trials/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, feedback }) }),
  updateTrial: (id: number, payload: ScheduleTrialPayload) =>
    apiFetch<TrialVisit>(`/trials/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  // Waivers
  createWaiver: (payload: CreateWaiverPayload) =>
    apiFetch<MemberWaiver>('/waivers', { method: 'POST', body: JSON.stringify(payload) }),
  getWaiver: (id: number) =>
    apiFetch<MemberWaiver>(`/waivers/${id}`),
  signWaiver: (id: number) =>
    apiFetch<{ status: string }>(`/waivers/${id}/sign`, { method: 'POST', body: JSON.stringify({}) }),
  listWaiversByMember: (memberId: number) =>
    apiFetch<MemberWaiver[]>(`/members/${memberId}/waivers`),
}
