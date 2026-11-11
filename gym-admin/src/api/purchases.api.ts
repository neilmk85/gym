import { apiFetch } from './client'
import type { PageParams, PageMeta } from '@/types/common.types'

export interface PurchaseItem {
  id?: number
  item_name: string
  description?: string
  category?: string
  quantity: number
  unit: string
  unit_price: number
  discount_amount: number
  tax_percent: number
  total_price: number
}

export interface Purchase {
  id: number
  purchase_number: string
  vendor_id?: number
  vendor_name: string
  purchase_date: string
  expected_delivery?: string
  received_date?: string
  invoice_number?: string
  items: PurchaseItem[]
  subtotal: number
  item_discount: number
  additional_discount: number
  tax_percent: number
  tax_amount: number
  shipping_charges: number
  total_amount: number
  amount_paid: number
  payment_method?: string
  payment_date?: string
  payment_reference?: string
  payment_status: string
  status: string
  received_by?: string
  notes?: string
  created_at: string
  updated_at: string
}

export const purchasesApi = {
  list: (params?: PageParams & { status?: string; payment_status?: string; vendor_id?: number }) =>
    apiFetch<{ data: Purchase[]; meta: PageMeta }>('/purchases', { params }),

  getById: (id: number) =>
    apiFetch<Purchase>(`/purchases/${id}`),

  create: (data: Record<string, unknown>) =>
    apiFetch<Purchase>('/purchases', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: number, data: Record<string, unknown>) =>
    apiFetch<Purchase>(`/purchases/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: number) =>
    apiFetch<void>(`/purchases/${id}`, { method: 'DELETE' }),
}
