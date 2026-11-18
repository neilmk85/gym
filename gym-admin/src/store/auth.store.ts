import { create } from 'zustand'
import type { AuthUser } from '@/types/auth.types'

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  isAuthenticated: boolean
  isInitialized: boolean
  setAuth: (user: AuthUser, accessToken: string) => void
  updateAccessToken: (token: string) => void
  logout: () => void
  setInitialized: () => void
  hasRole: (roles: string[]) => boolean
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isInitialized: false,

  setAuth: (user, accessToken) =>
    set({ user, accessToken, isAuthenticated: true, isInitialized: true }),

  updateAccessToken: (token) =>
    set({ accessToken: token }),

  logout: () => {
    localStorage.removeItem('gym_refresh_token')
    set({ user: null, accessToken: null, isAuthenticated: false })
  },

  setInitialized: () => set({ isInitialized: true }),

  hasRole: (roles) => {
    const user = useAuthStore.getState().user
    if (!user) return false
    if (user.role === 'superadmin') return true
    return roles.includes(user.role)
  },
}))
