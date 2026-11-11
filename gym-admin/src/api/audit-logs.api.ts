import { apiFetch } from './client'
import type { PaginatedData, PageParams } from '@/types/common.types'

export const auditLogsApi = {
  list: (params?: PageParams & { user_id?: number; resource_type?: string; from?: string; to?: string }) =>
    apiFetch<PaginatedData<unknown>>('/audit-logs', { params }),
}
