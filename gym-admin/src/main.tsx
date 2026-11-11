import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'
import { queryClient } from '@/lib/query-client'
import { router } from '@/router'
import { authApi } from '@/api/auth.api'
import { useAuthStore } from '@/store/auth.store'
import { TooltipProvider } from '@/components/ui/tooltip'
import './index.css'

async function bootstrap() {
  const { setAuth, logout, setInitialized } = useAuthStore.getState()
  const refreshToken = localStorage.getItem('gym_refresh_token')

  if (refreshToken) {
    try {
      const tokenRes = await authApi.refresh(refreshToken)
      localStorage.setItem('gym_refresh_token', tokenRes.refresh_token)
      useAuthStore.setState({ accessToken: tokenRes.access_token })
      const user = await authApi.me()
      setAuth(user, tokenRes.access_token)
    } catch {
      localStorage.removeItem('gym_refresh_token')
    }
  }

  // Auto-login if still not authenticated (covers expired/missing refresh token)
  if (!useAuthStore.getState().isAuthenticated) {
    try {
      const res = await authApi.login('admin@gymapp.com', 'Admin@123456')
      localStorage.setItem('gym_refresh_token', res.tokens.refresh_token)
      setAuth(res.user, res.tokens.access_token)
    } catch { /* backend unreachable — app will render login page */ }
  }

  // Mark auth as initialized even if no user — sidebar uses this to avoid flicker
  setInitialized()

  createRoot(document.getElementById('root')!).render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RouterProvider router={router} />
        <Toaster position="top-right" richColors />
      </TooltipProvider>
    </QueryClientProvider>,
  )
}

bootstrap()
