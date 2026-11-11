import { apiFetch } from './client'
import { formatCurrency } from '@/lib/utils'

export interface Product {
  id: number
  name: string
  sku?: string
  category?: string
  description?: string
  mrp_paise: number
  price_paise: number
  cost_paise: number
  tax_rate_id?: number
  stock_qty: number
  low_stock_at: number
  is_active: boolean
  image_url?: string
  created_at: string
  updated_at: string
}

export interface POSOrderItem {
  id: number
  order_id: number
  product_id: number
  qty: number
  unit_paise: number
  tax_paise: number
  total_paise: number
  product?: Product
}

export interface POSOrder {
  id: number
  member_id?: number
  cashier_id: number
  status: 'open' | 'completed' | 'voided'
  total_paise: number
  tax_paise: number
  discount_paise: number
  grand_paise: number
  payment_mode: string
  notes?: string
  created_at: string
  updated_at: string
  items?: POSOrderItem[]
}

export interface StockMovement {
  id: number
  product_id: number
  movement_type: string
  qty: number
  qty_before: number
  qty_after: number
  ref_model?: string
  ref_id?: number
  notes?: string
  created_by_id: number
  created_at: string
}

export interface CreateProductPayload {
  name: string
  sku?: string
  category?: string
  description?: string
  price_paise: number
  cost_paise?: number
  stock_qty?: number
  low_stock_at?: number
  image_url?: string
}

export interface POSOrderItemInput {
  product_id: number
  qty: number
}

export interface CreateOrderPayload {
  member_id?: number
  items: POSOrderItemInput[]
  payment_mode?: string
  discount_paise?: number
  notes?: string
}

export const posApi = {
  createProduct: (payload: CreateProductPayload) =>
    apiFetch<Product>('/pos/products', { method: 'POST', body: JSON.stringify(payload) }),
  listProducts: (page = 1, perPage = 20, search = '', category = '') =>
    apiFetch<{ data: Product[]; meta: unknown }>('/pos/products', { params: { page, per_page: perPage, search, category } }),
  getProduct: (id: number) =>
    apiFetch<Product>(`/pos/products/${id}`),
  updateProduct: (id: number, payload: Partial<CreateProductPayload>) =>
    apiFetch<Product>(`/pos/products/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteProduct: (id: number) =>
    apiFetch<{ status: string }>(`/pos/products/${id}`, { method: 'DELETE' }),
  adjustStock: (id: number, delta: number, notes?: string) =>
    apiFetch<{ status: string }>(`/pos/products/${id}/stock`, { method: 'POST', body: JSON.stringify({ delta, notes }) }),
  listStockMovements: (productId: number, page = 1, perPage = 20) =>
    apiFetch<{ data: StockMovement[]; meta: unknown }>(`/pos/products/${productId}/stock-movements`, { params: { page, per_page: perPage } }),
  createOrder: (payload: CreateOrderPayload) =>
    apiFetch<POSOrder>('/pos/orders', { method: 'POST', body: JSON.stringify(payload) }),
  listOrders: (page = 1, perPage = 20) =>
    apiFetch<{ data: POSOrder[]; meta: unknown }>('/pos/orders', { params: { page, per_page: perPage } }),
  getOrder: (id: number) =>
    apiFetch<POSOrder>(`/pos/orders/${id}`),
  voidOrder: (id: number) =>
    apiFetch<{ status: string }>(`/pos/orders/${id}/void`, { method: 'POST', body: JSON.stringify({}) }),
}

export { formatCurrency }
