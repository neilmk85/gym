import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import type { Role } from '@/types/auth.types'

export function RoleGuard({ allowedRoles, children }: { allowedRoles: Role[]; children: React.ReactNode }) {
  const { user } = useAuthStore()
  if (!user) return <Navigate to="/login" replace />
  if (!allowedRoles.includes(user.role)) return <Navigate to="/403" replace />
  return <>{children}</>
}
