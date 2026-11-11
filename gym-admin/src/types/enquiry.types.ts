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
  name: string
  email?: string
  phone: string
  source: EnquirySource
  plan_interest?: string
  status: EnquiryStatus
  assigned_to_id?: number
  notes?: string
  follow_up_date?: string
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
