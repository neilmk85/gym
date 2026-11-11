export type PurchaseStatus = 'draft' | 'ordered' | 'received' | 'partially_received' | 'cancelled'
export type PaymentStatus = 'pending' | 'partial' | 'paid'
export type PurchasePaymentMethod = 'cash' | 'upi' | 'card' | 'bank_transfer' | 'cheque' | 'other'

export interface PurchaseLineItem {
  id: string
  item_name: string
  description?: string
  category: string
  quantity: number
  unit: 'pcs' | 'pairs' | 'kg' | 'sets' | 'boxes' | 'liters' | 'other'
  unit_price: number
  discount_amount: number
  tax_percent: number
  total_price: number
}

export interface Purchase {
  id: string
  purchase_number: string
  vendor_id?: string
  vendor_name: string
  purchase_date: string
  expected_delivery?: string
  received_date?: string
  invoice_number?: string
  items: PurchaseLineItem[]
  subtotal: number
  item_discount: number
  additional_discount: number
  tax_percent: number
  tax_amount: number
  shipping_charges: number
  total_amount: number
  amount_paid: number
  payment_method?: PurchasePaymentMethod
  payment_date?: string
  payment_reference?: string
  payment_status: PaymentStatus
  status: PurchaseStatus
  received_by?: string
  notes?: string
  created_at: string
  updated_at: string
}

export const PURCHASE_STATUSES: Record<PurchaseStatus, string> = {
  draft:               'Draft',
  ordered:             'Ordered',
  received:            'Received',
  partially_received:  'Partially Received',
  cancelled:           'Cancelled',
}

export const PAYMENT_STATUSES: Record<PaymentStatus, string> = {
  pending: 'Pending',
  partial: 'Partial',
  paid:    'Paid',
}

export const PURCHASE_PAYMENT_METHODS: Record<PurchasePaymentMethod, string> = {
  cash:          'Cash',
  upi:           'UPI',
  card:          'Card',
  bank_transfer: 'Bank Transfer',
  cheque:        'Cheque',
  other:         'Other',
}

export const LINE_ITEM_CATEGORIES = [
  'Equipment', 'Supplements', 'Cleaning Supplies', 'Stationery & Office',
  'IT & Tech', 'Food & Beverage', 'Uniforms & Apparel', 'Maintenance Parts',
  'Marketing Material', 'Spare Parts', 'Other',
]

export const LINE_ITEM_UNITS = ['pcs', 'pairs', 'kg', 'sets', 'boxes', 'liters', 'other'] as const

const KEY = 'gym_purchases_v1'
const COUNTER_KEY = 'gym_purchases_counter_v1'

function nextPONumber(): string {
  const n = parseInt(localStorage.getItem(COUNTER_KEY) ?? '0', 10) + 1
  localStorage.setItem(COUNTER_KEY, String(n))
  return 'PO-' + String(n).padStart(4, '0')
}

export function loadPurchases(): Purchase[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Purchase[]
  } catch { /* ignore */ }
  return []
}

export function savePurchases(list: Purchase[]): void {
  localStorage.setItem(KEY, JSON.stringify(list))
}

export function addPurchase(data: Omit<Purchase, 'id' | 'purchase_number' | 'created_at' | 'updated_at'>): Purchase {
  const list = loadPurchases()
  const now = new Date().toISOString()
  const purchase: Purchase = {
    ...data,
    id: crypto.randomUUID(),
    purchase_number: nextPONumber(),
    created_at: now,
    updated_at: now,
  }
  savePurchases([purchase, ...list])
  return purchase
}

export function updatePurchase(id: string, data: Partial<Purchase>): void {
  savePurchases(loadPurchases().map(p =>
    p.id === id ? { ...p, ...data, updated_at: new Date().toISOString() } : p
  ))
}

export function deletePurchase(id: string): void {
  savePurchases(loadPurchases().filter(p => p.id !== id))
}

export function calcTotals(
  items: PurchaseLineItem[],
  additionalDiscount: number,
  taxPercent: number,
  shippingCharges: number,
) {
  const subtotal = items.reduce((s, i) => s + i.total_price, 0)
  const itemDiscount = items.reduce((s, i) => s + i.discount_amount * i.quantity, 0)
  const taxableAmount = subtotal - additionalDiscount
  const taxAmount = (taxableAmount * taxPercent) / 100
  const total = taxableAmount + taxAmount + shippingCharges
  return { subtotal, itemDiscount, taxAmount, total }
}

export function newLineItem(): PurchaseLineItem {
  return {
    id: crypto.randomUUID(),
    item_name: '',
    category: 'Equipment',
    quantity: 1,
    unit: 'pcs',
    unit_price: 0,
    discount_amount: 0,
    tax_percent: 0,
    total_price: 0,
  }
}
