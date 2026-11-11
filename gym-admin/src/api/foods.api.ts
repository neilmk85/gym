import { apiFetch } from './client'

export interface FoodItem {
  id: number
  name: string
  category: string
  unit: string        // g, ml, pcs, slice, tbsp
  per_unit: number    // 100 for g/ml, 1 for discrete
  cal_per: number
  protein_per: number
  carbs_per: number
  fat_per: number
  default_qty: number
  is_active: boolean
  created_at: string
}

export interface BulkImportPayload {
  name: string
  category: string
  unit: string
  per_unit: number
  cal_per?: number
  protein_per?: number
  carbs_per?: number
  fat_per?: number
  default_qty?: number
}

export interface BulkImportResult {
  imported: number
  skipped: number
  total: number
}

export const foodsApi = {
  list: (params?: { search?: string; category?: string; active_only?: boolean }) =>
    apiFetch<{ foods: FoodItem[]; total: number }>('/foods', { params }),
  getById: (id: number) =>
    apiFetch<FoodItem>(`/foods/${id}`),
  create: (data: Record<string, unknown>) =>
    apiFetch<FoodItem>('/foods', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Record<string, unknown>) =>
    apiFetch<FoodItem>(`/foods/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: number) =>
    apiFetch<void>(`/foods/${id}`, { method: 'DELETE' }),
  bulkImport: (foods: BulkImportPayload[]) =>
    apiFetch<BulkImportResult>('/foods/bulk', { method: 'POST', body: JSON.stringify({ foods }) }),
}
