import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const isInitialized   = useAuthStore(s => s.isInitialized)

  if (!isInitialized) return null   // wait for bootstrap to finish
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}
