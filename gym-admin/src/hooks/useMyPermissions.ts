import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/api/client'
import { useAuthStore } from '@/store/auth.store'

export function useMyPermissions() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)

  const { data } = useQuery({
    queryKey: ['my-permissions'],
    queryFn: () => apiFetch<{ permissions: string[] }>('/auth/my-permissions'),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  })

  const permissions = data?.permissions ?? []

  const hasPermission = (perm: string) => permissions.includes(perm)

  return { permissions, hasPermission }
}
