export interface BreakTime {
  start_time: string  // "HH:MM"
  end_time: string
  label: string
}

export interface TrainerSchedule {
  id: number
  trainer_id: number
  day_of_week: number  // 0=Mon … 6=Sun
  start_time: string
  end_time: string
  breaks: BreakTime[]
  notes?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TrainerProfile {
  id: number
  user_id: number
  facility_id: number
  bio: string
  specializations: string[]
  certifications: string[]
  experience_years: number
  hourly_rate: number
  max_clients_per_day: number
  weekly_off_days?: number[]
  is_active: boolean
  user?: {
    id: number
    email: string
    first_name: string
    last_name: string
    phone?: string
  }
  facility?: {
    id: number
    name: string
  }
}
