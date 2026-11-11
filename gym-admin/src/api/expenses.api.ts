import { apiFetch } from './client'
import type { Expense, ExpenseCategory } from '@/types/expense.types'
import type { PaginatedData, PageParams } from '@/types/common.types'

export const expenseCategoriesApi = {
  list: (activeOnly = true) =>
    apiFetch<{ categories: ExpenseCategory[] }>('/expense-categories', {
      params: { active_only: activeOnly },
    }),

  getById: (id: number) =>
    apiFetch<ExpenseCategory>(`/expense-categories/${id}`),

  create: (data: Record<string, unknown>) =>
    apiFetch<ExpenseCategory>('/expense-categories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: number, data: Record<string, unknown>) =>
    apiFetch<ExpenseCategory>(`/expense-categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    apiFetch<void>(`/expense-categories/${id}`, { method: 'DELETE' }),
}

export const expensesApi = {
  list: (params?: PageParams & {
    facility_id?: number
    category_id?: number
    status?: string
    date_from?: string
    date_to?: string
  }) =>
    apiFetch<{ expenses: Expense[]; meta: PaginatedData<Expense>['meta'] }>('/expenses', { params }),

  getById: (id: number) =>
    apiFetch<Expense>(`/expenses/${id}`),

  create: (data: Record<string, unknown>) =>
    apiFetch<Expense>('/expenses', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: number, data: Record<string, unknown>) =>
    apiFetch<Expense>(`/expenses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: number) =>
    apiFetch<void>(`/expenses/${id}`, { method: 'DELETE' }),
}
