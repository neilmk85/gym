export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded'
export type PaymentMethod = 'cash' | 'upi' | 'card' | 'bank_transfer' | 'razorpay' | 'other'

export interface Payment {
  id: number
  member_id: number
  subscription_id?: number
  amount: number
  currency?: string
  status: PaymentStatus
  payment_method: PaymentMethod
  transaction_id?: string
  reference_number?: string
  notes?: string
  refund_amount?: number
  refund_reason?: string
  refunded_at?: string
  paid_at: string
  created_at: string
  member?: {
    id: number
    user: {
      first_name: string
      last_name: string
      email?: string
      phone?: string
    }
  }
  subscription?: {
    id: number
    plan?: {
      id: number
      name: string
      price_amount: number
    }
  }
}
