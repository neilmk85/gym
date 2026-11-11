import { apiFetch } from './client'
import type { PageParams, PageMeta } from '@/types/common.types'

export interface Vendor {
  id: number
  name: string
  contact_name?: string
  phone: string
  email?: string
  address?: string
  city?: string
  state?: string
  pincode?: string
  gst_number?: string
  pan_number?: string
  category: string
  payment_terms?: string
  credit_limit?: number
  bank_name?: string
  bank_account?: string
  bank_ifsc?: string
  status: string
  notes?: string
  created_at: string
  updated_at: string
}

export const vendorsApi = {
  list: (params?: PageParams & { status?: string; category?: string; search?: string }) =>
    apiFetch<{ data: Vendor[]; meta: PageMeta }>('/vendors', { params }),

  getById: (id: number) =>
    apiFetch<Vendor>(`/vendors/${id}`),

  create: (data: Record<string, unknown>) =>
    apiFetch<Vendor>('/vendors', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: number, data: Record<string, unknown>) =>
    apiFetch<Vendor>(`/vendors/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: number) =>
    apiFetch<void>(`/vendors/${id}`, { method: 'DELETE' }),
}
