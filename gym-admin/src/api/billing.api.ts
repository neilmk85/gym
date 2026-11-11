import { apiFetch } from './client'

export interface TaxProfile {
  id: number
  facility_id: number
  legal_name: string
  gstin: string
  address: string
  invoice_prefix: string
  receipt_prefix: string
  credit_note_prefix: string
  financial_year_start: string
  tax_inclusive: boolean
  is_active: boolean
}

export interface TaxRate {
  id: number
  name: string
  rate: number
  cgst_rate: number
  sgst_rate: number
  igst_rate: number
  is_default: boolean
  is_active: boolean
}

export interface InvoiceLine {
  id: number
  invoice_id: number
  description: string
  quantity: number
  unit_price: number
  discount_amount: number
  taxable_amount: number
  tax_rate_id?: number
  tax_rate_snapshot: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  tax_amount: number
  line_total: number
  sort_order: number
}

export interface Invoice {
  id: number
  invoice_number: string
  facility_id: number
  member_id: number
  payment_id?: number
  subscription_id?: number
  status: 'draft' | 'issued' | 'cancelled'
  issue_date: string
  seller_name: string
  seller_gstin: string
  seller_address: string
  buyer_name: string
  buyer_phone: string
  buyer_email: string
  buyer_gstin?: string
  buyer_address?: string
  subtotal: number
  discount_amount: number
  taxable_amount: number
  tax_amount: number
  total: number
  currency: string
  notes?: string
  issued_by_id: number
  cancelled_at?: string
  cancel_reason?: string
  created_at: string
  lines?: InvoiceLine[]
}

export interface Receipt {
  id: number
  receipt_number: string
  invoice_id?: number
  payment_id: number
  member_id: number
  facility_id: number
  amount_received: number
  currency: string
  payment_method: string
  paid_at: string
  notes?: string
  issued_by_id: number
  created_at: string
}

export interface CreditNote {
  id: number
  credit_note_number: string
  original_invoice_id?: number
  payment_id?: number
  member_id: number
  facility_id: number
  reason: string
  amount: number
  tax_amount: number
  currency: string
  status: 'draft' | 'issued'
  issued_by_id: number
  issued_at: string
  created_at: string
}

export interface SubscriptionFreeze {
  id: number
  subscription_id: number
  member_id: number
  start_date: string
  end_date: string
  reason?: string
  status: 'pending' | 'active' | 'completed' | 'cancelled'
  extension_days: number
  extension_applied: boolean
  approved_by_id?: number
  approved_at?: string
  created_by_id: number
  created_at: string
  updated_at: string
}

export interface UpgradeQuote {
  quote_id: number
  subscription_id: number
  member_id: number
  from_plan_id: number
  to_plan_id: number
  days_remaining: number
  prorated_credit: number
  new_plan_charge: number
  amount_due: number
  currency: string
  expires_at: string
}

export const billingApi = {
  // Tax profile
  getTaxProfile: (facilityId = 1) =>
    apiFetch<TaxProfile>(`/billing/tax-profile?facility_id=${facilityId}`),

  upsertTaxProfile: (data: Partial<TaxProfile>, facilityId = 1) =>
    apiFetch<TaxProfile>(`/billing/tax-profile?facility_id=${facilityId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Tax rates
  listTaxRates: () =>
    apiFetch<{ tax_rates: TaxRate[] }>('/billing/tax-rates'),

  createTaxRate: (data: Partial<TaxRate>) =>
    apiFetch<TaxRate>('/billing/tax-rates', { method: 'POST', body: JSON.stringify(data) }),

  updateTaxRate: (id: number, data: Partial<TaxRate>) =>
    apiFetch<TaxRate>(`/billing/tax-rates/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Invoices
  createInvoice: (data: Record<string, unknown>) =>
    apiFetch<Invoice>('/billing/invoices', { method: 'POST', body: JSON.stringify(data) }),

  listInvoices: (params?: { page?: number; per_page?: number; facility_id?: number }) => {
    const qs = new URLSearchParams()
    if (params?.page) qs.set('page', String(params.page))
    if (params?.per_page) qs.set('per_page', String(params.per_page))
    if (params?.facility_id) qs.set('facility_id', String(params.facility_id))
    return apiFetch<{ invoices: Invoice[]; meta: unknown }>(`/billing/invoices?${qs}`)
  },

  getInvoice: (id: number) => apiFetch<Invoice>(`/billing/invoices/${id}`),

  cancelInvoice: (id: number, reason: string) =>
    apiFetch<{ status: string }>(`/billing/invoices/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    }),

  listInvoicesByMember: (memberId: number, params?: { page?: number; per_page?: number }) => {
    const qs = new URLSearchParams()
    if (params?.page) qs.set('page', String(params.page))
    if (params?.per_page) qs.set('per_page', String(params.per_page))
    return apiFetch<{ invoices: Invoice[]; meta: unknown }>(`/members/${memberId}/invoices?${qs}`)
  },

  // Receipts
  createReceipt: (data: Record<string, unknown>) =>
    apiFetch<Receipt>('/billing/receipts', { method: 'POST', body: JSON.stringify(data) }),

  listReceipts: (params?: { page?: number; per_page?: number; facility_id?: number }) => {
    const qs = new URLSearchParams()
    if (params?.page) qs.set('page', String(params.page))
    if (params?.per_page) qs.set('per_page', String(params.per_page))
    return apiFetch<{ receipts: Receipt[]; meta: unknown }>(`/billing/receipts?${qs}`)
  },

  getReceipt: (id: number) => apiFetch<Receipt>(`/billing/receipts/${id}`),

  listReceiptsByMember: (memberId: number, params?: { page?: number; per_page?: number }) => {
    const qs = new URLSearchParams()
    if (params?.page) qs.set('page', String(params.page))
    if (params?.per_page) qs.set('per_page', String(params.per_page))
    return apiFetch<{ receipts: Receipt[]; meta: unknown }>(`/members/${memberId}/receipts?${qs}`)
  },

  // Credit notes
  createCreditNote: (data: Record<string, unknown>) =>
    apiFetch<CreditNote>('/billing/credit-notes', { method: 'POST', body: JSON.stringify(data) }),

  getCreditNote: (id: number) => apiFetch<CreditNote>(`/billing/credit-notes/${id}`),

  listCreditNotesByMember: (memberId: number, params?: { page?: number; per_page?: number }) => {
    const qs = new URLSearchParams()
    if (params?.page) qs.set('page', String(params.page))
    if (params?.per_page) qs.set('per_page', String(params.per_page))
    return apiFetch<{ credit_notes: CreditNote[]; meta: unknown }>(`/members/${memberId}/credit-notes?${qs}`)
  },

  // Subscription freezes
  freezeSubscription: (subscriptionId: number, data: { start_date: string; end_date: string; reason?: string }) =>
    apiFetch<SubscriptionFreeze>(`/subscriptions/${subscriptionId}/freeze`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  unfreezeSubscription: (freezeId: number) =>
    apiFetch<SubscriptionFreeze>(`/subscription-freezes/${freezeId}/unfreeze`, { method: 'POST' }),

  listFreezesForSubscription: (subscriptionId: number) =>
    apiFetch<{ freezes: SubscriptionFreeze[] }>(`/subscriptions/${subscriptionId}/freezes`),

  // Upgrade quote
  getUpgradeQuote: (subscriptionId: number, newPlanId: number) =>
    apiFetch<UpgradeQuote>(`/subscriptions/${subscriptionId}/upgrade-quote?new_plan_id=${newPlanId}`),

  // Entitlement ledger
  getEntitlementLedger: (subscriptionId: number) =>
    apiFetch<{ ledger: unknown[] }>(`/subscriptions/${subscriptionId}/entitlement-ledger`),
}
