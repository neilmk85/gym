export type CheckInMethod = 'qr' | 'manual' | 'geofence' | 'card'

export interface AttendanceRecord {
  id: number
  member_id: number
  facility_id: number
  check_in_at: string
  check_out_at?: string
  duration_mins?: number
  method: CheckInMethod
  notes?: string
  created_at: string
  member?: {
    id: number
    membership_status: string
    user: {
      first_name: string
      last_name: string
      email?: string
      phone?: string
    }
  }
}
