export interface ApiEnvelope<T> {
  success: boolean
  data: T
  error?: {
    code: string
    message: string
    details?: string
  }
}

export interface PageMeta {
  page: number
  per_page: number
  total: number
  total_pages: number
}

export interface PaginatedData<T> {
  items: T[]
  meta: PageMeta
}

export interface PageParams {
  page?: number
  per_page?: number
}
