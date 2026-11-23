import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { useMyPermissions } from '@/hooks/useMyPermissions'

export function PermissionGuard({ permission, children }: { permission: string; children: React.ReactNode }) {
  const { user } = useAuthStore()
  const { hasPermission } = useMyPermissions()

  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'superadmin' || hasPermission(permission)) return <>{children}</>
  return <Navigate to="/403" replace />
}
