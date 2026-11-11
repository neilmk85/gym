export type ExpenseStatus = 'pending' | 'approved' | 'rejected'
export type ExpensePaymentMethod = 'cash' | 'card' | 'transfer' | 'other'

export interface ExpenseCategory {
  id: number
  name: string
  description?: string
  color: string
  icon: string
  is_active: boolean
  created_by_id?: number
  created_at: string
  updated_at: string
}

export interface Expense {
  id: number
  facility_id: number
  category_id?: number
  title: string
  amount: number
  expense_date: string
  payment_method: ExpensePaymentMethod
  vendor?: string
  receipt_url?: string
  notes?: string
  status: ExpenseStatus
  created_by_id?: number
  created_at: string
  updated_at: string
  category?: ExpenseCategory
}
