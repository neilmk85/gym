export type ClassStatus = 'scheduled' | 'ongoing' | 'completed' | 'cancelled'

export interface GymClass {
  id: number
  facility_id: number
  trainer_id?: number
  name: string
  class_type: string
  duration_mins: number
  max_capacity: number
  current_bookings: number
  start_time: string
  end_time: string
  status: ClassStatus
  is_active: boolean
  is_free: boolean
}
