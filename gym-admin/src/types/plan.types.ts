export interface Plan {
  id: number
  name: string
  price_amount: number
  original_price?: number
  billing_period_days: number
  is_active: boolean
  group_class_access: boolean
  pt_access: boolean
  locker_access: boolean
  type: string
  member_category: 'individual' | 'couple' | 'group'
  gender: 'any' | 'male' | 'female'
  min_members: number
  max_members: number
  max_discount_percent: number
  max_classes_per_month?: number
  max_pt_sessions_per_month?: number
  activity_type?: 'all' | 'gym' | 'swimming' | 'yoga' | 'zumba' | 'bollyfit' | 'functional'
  is_offer?: boolean
  offer_label?: string
  offer_valid_until?: string
  created_at: string
}
