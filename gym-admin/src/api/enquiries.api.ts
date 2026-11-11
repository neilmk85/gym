import { apiFetch } from './client'
import type { Enquiry } from '@/types/enquiry.types'
import type { PageParams } from '@/types/common.types'

export interface EnquiryListParams extends PageParams {
  status?: string
  search?: string
  facility_id?: number
}

export const enquiriesApi = {
  list: (params?: EnquiryListParams) =>
    apiFetch<unknown>('/enquiries', { params }),

  getById: (id: number) =>
    apiFetch<Enquiry>(`/enquiries/${id}`),

  create: (data: Record<string, unknown>) =>
    apiFetch<Enquiry>('/enquiries', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: number, data: Record<string, unknown>) =>
    apiFetch<Enquiry>(`/enquiries/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: number) =>
    apiFetch<void>(`/enquiries/${id}`, { method: 'DELETE' }),
}
