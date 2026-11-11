import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/api/client'
import { toast } from 'sonner'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 10,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status < 500) return false
        return failureCount < 1
      },
      refetchOnWindowFocus: true,
    },
    mutations: {
      onError: (error) => {
        if (error instanceof ApiError && error.status === 401) return
        const message = error instanceof ApiError ? error.message : 'An unexpected error occurred'
        toast.error(message)
      },
    },
  },
})
