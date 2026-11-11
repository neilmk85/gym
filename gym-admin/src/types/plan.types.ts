export interface Plan {
  id: number
  name: string
  price_amount: number
  billing_period_days: number
  is_active: boolean
  group_class_access: boolean
  created_at: string
}
