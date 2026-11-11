export type SubStatus = 'active' | 'paused' | 'cancelled' | 'expired'

export interface Subscription {
  id: number
  member_id: number
  plan_id: number
  plan?: {
    id: number
    name: string
    price_amount: number
  }
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
  status: SubStatus
  start_date: string
  end_date: string
  auto_renew: boolean
  free_months_added?: number
  free_days_added?: number
  created_at: string
}
