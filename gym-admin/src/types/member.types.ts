export type MemberStatus = 'active' | 'frozen' | 'expired' | 'cancelled' | 'pending' | 'paused'

export interface MemberUser {
  id: number
  email: string
  first_name: string
  last_name: string
  phone?: string
  date_of_birth?: string
  gender?: string
  height_cm?: number
  weight_kg?: number
  profile_photo_url?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  emergency_contact_relationship?: string
}

export interface MemberSubscriptionPlan {
  id: number
  name: string
}

export interface MemberCurrentSubscription {
  id: number
  end_date: string
  status: string
  plan: MemberSubscriptionPlan
}

export interface Member {
  id: number
  member_code: string
  membership_status: MemberStatus
  joined_date: string
  current_plan_id?: number
  current_subscription_id?: number
  facility_id: number
  member_notes?: string
  assigned_trainer_id?: number | null
  health_declaration?: Record<string, unknown>
  user: MemberUser
  current_subscription?: MemberCurrentSubscription
}
