export type EnquirySource =
  | 'walk_in'
  | 'phone_call'
  | 'email'
  | 'social_media'
  | 'referral'
  | 'website'
  | 'other'

export type EnquiryStatus =
  | 'new'
  | 'contacted'
  | 'visit_scheduled'
  | 'converted'
  | 'closed'

export interface Enquiry {
  id: number
  facility_id: number
  first_name?: string
  last_name?: string
  name: string
  email?: string
  phone: string
  source: EnquirySource
  source_detail?: string
  referred_by?: string
  membership_type?: string
  plan_interest?: string
  budget_range?: string
  fitness_goal?: string
  status: EnquiryStatus
  assigned_to_id?: number
  notes?: string
  remarks?: string
  follow_up_date?: string
  likely_joining_date?: string
  trial_visit_date?: string
  converted_member_id?: number
  created_by_id?: number
  created_at: string
  updated_at: string
  assigned_to?: {
    id: number
    first_name: string
    last_name: string
    email: string
  }
}
