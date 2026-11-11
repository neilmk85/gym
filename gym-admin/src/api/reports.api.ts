import { apiFetch, apiFetchBlob } from './client'
import type { DashboardStats } from '@/types/report.types'

export interface ReportParams {
  from?: string
  to?: string
}

// ── Typed response shapes ────────────────────────────────────────────────────

export interface RevenueReport {
  from: string
  to: string
  total_revenue: number
  total_refunds: number
  net_revenue: number
  transaction_count: number
  by_method: { method: string; amount: number; count: number }[]
  by_day: { date: string; amount: number; count: number }[]
}

export interface AttendanceReport {
  from: string
  to: string
  total_check_ins: number
  unique_members: number
  avg_daily_check_ins: number
  avg_duration_mins: number
  peak_hour: number
  by_day: { date: string; count: number }[]
  by_method: { method: string; count: number }[]
  by_hour: { hour: number; count: number }[]
}

export interface MemberReport {
  total_members: number
  active_members: number
  paused_members: number
  cancelled_members: number
  expired_members: number
  new_this_month: number
  by_gender: { gender: string; count: number }[]
  growth_by_month: { month: string; new: number }[]
}

export interface SubscriptionReport {
  active: number
  paused: number
  cancelled: number
  expired: number
  auto_renew_count: number
  expiring_in_7_days: number
  by_plan: { plan_id: number; plan_name: string; count: number }[]
}

export interface ExpiringMember {
  member_id: number
  name: string
  phone: string
  email: string
  plan_name: string
  end_date: string
  days_left: number
}

export interface ExpiringMembersReport {
  days: number
  count: number
  members: ExpiringMember[]
}

export interface TrainerStat {
  trainer_id: number
  name: string
  email: string
  phone: string
  specializations: string[]
  experience_years: number
  hourly_rate: number
  max_clients_per_day: number
  is_active: boolean
  assigned_members: number
  classes_this_month: number
  total_classes: number
}

export interface SpecializationCount {
  specialization: string
  count: number
}

export interface InactiveMember {
  member_id: number
  name: string
  phone: string
  email: string
  member_code: string
  status: string
  joined_date: string
  last_visit: string | null
  days_since_visit: number | null
}

export interface InactiveMembersReport {
  days: number
  count: number
  members: InactiveMember[]
}

export interface TrainerReport {
  total_trainers: number
  active_trainers: number
  assigned_members: number
  unassigned_members: number
  trainers: TrainerStat[]
  by_specialization: SpecializationCount[]
}

export const reportsApi = {
  dashboard: () => apiFetch<DashboardStats>('/reports/dashboard'),
  revenue:   (params?: ReportParams) => apiFetch<RevenueReport>('/reports/revenue', { params }),
  attendance:(params?: ReportParams) => apiFetch<AttendanceReport>('/reports/attendance', { params }),
  members:   ()                      => apiFetch<MemberReport>('/reports/members'),
  subscriptions: ()                  => apiFetch<SubscriptionReport>('/reports/subscriptions'),
  classes:   (params?: ReportParams) => apiFetch<unknown>('/reports/classes', { params }),
  expiring:  (days = 30)             => apiFetch<ExpiringMembersReport>(`/reports/expiring?days=${days}`),
  inactive:  (days = 30)             => apiFetch<InactiveMembersReport>(`/reports/inactive-members?days=${days}`),
  trainers:  ()                      => apiFetch<TrainerReport>('/reports/trainers'),

  downloadCSV: (type: string, params?: ReportParams) =>
    apiFetchBlob(`/reports/${type}`, { ...params, format: 'csv' }),

  memberTimeline: (memberId: number) =>
    apiFetch<unknown[]>(`/members/${memberId}/timeline`),
}
