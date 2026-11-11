import { apiFetch } from './client'

export interface StaffAttendanceRecord {
  id: number
  facility_id: number
  staff_id: number
  date: string
  status: 'present' | 'absent' | 'half_day' | 'leave' | 'holiday'
  check_in?: string
  check_out?: string
  working_hours: number
  notes?: string
  marked_by_id: number
  created_at: string
  staff?: {
    id: number
    employee_id: string
    first_name: string
    last_name: string
    department: string
    designation: string
  }
}

export interface SalarySlip {
  id: number
  facility_id: number
  staff_id: number
  month: number
  year: number
  working_days: number
  present_days: number
  absent_days: number
  half_days: number
  leave_days: number
  holiday_days: number
  base_salary: number
  earned_salary: number
  deductions: number
  bonus: number
  net_salary: number
  status: 'draft' | 'finalized' | 'paid'
  paid_at?: string
  notes?: string
  generated_by_id: number
  created_at: string
  staff?: {
    id: number
    employee_id: string
    first_name: string
    last_name: string
    department: string
    designation: string
    salary: number
  }
}

export interface MarkAttendanceRequest {
  date: string
  status: 'present' | 'absent' | 'half_day' | 'leave' | 'holiday'
  check_in?: string
  check_out?: string
  working_hours?: number
  notes?: string
}

export interface GenerateSlipRequest {
  working_days?: number
  bonus?: number
  deductions?: number
  notes?: string
}

export const staffAttendanceApi = {
  markAttendance: (staffId: number, data: MarkAttendanceRequest) =>
    apiFetch<StaffAttendanceRecord>(`/staff/${staffId}/attendance`, { method: 'POST', body: JSON.stringify(data) }),

  listByStaff: (staffId: number, month?: number, year?: number) => {
    const params = new URLSearchParams()
    if (month) params.set('month', String(month))
    if (year) params.set('year', String(year))
    return apiFetch<StaffAttendanceRecord[]>(`/staff/${staffId}/attendance?${params}`)
  },

  listByDate: (date: string) =>
    apiFetch<StaffAttendanceRecord[]>(`/staff/attendance?date=${date}`),

  listByMonth: (month: number, year: number) =>
    apiFetch<StaffAttendanceRecord[]>(`/staff/attendance/monthly?month=${month}&year=${year}`),

  generateSalarySlip: (staffId: number, month: number, year: number, data?: GenerateSlipRequest) =>
    apiFetch<SalarySlip>(`/staff/${staffId}/salary-slip?month=${month}&year=${year}`, {
      method: 'POST',
      body: JSON.stringify(data ?? {}),
    }),

  getSalarySlip: (staffId: number, month: number, year: number) =>
    apiFetch<SalarySlip | null>(`/staff/${staffId}/salary-slip?month=${month}&year=${year}`),

  listSalarySlips: (month?: number, year?: number) => {
    const params = new URLSearchParams()
    if (month) params.set('month', String(month))
    if (year) params.set('year', String(year))
    return apiFetch<SalarySlip[]>(`/staff/salary-slips?${params}`)
  },

  updateSlipStatus: (slipId: number, status: 'draft' | 'finalized' | 'paid', paidAt?: string) =>
    apiFetch<SalarySlip>(`/staff/salary-slips/${slipId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, paid_at: paidAt }),
    }),

  listSlipsByStaff: (staffId: number) =>
    apiFetch<SalarySlip[]>(`/staff/${staffId}/salary-slips/history`),
}
