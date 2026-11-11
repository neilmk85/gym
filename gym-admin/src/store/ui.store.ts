import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIState {
  sidebarCollapsed: boolean
  theme: 'light' | 'dark'
  facilityName: string
  toggleSidebar: () => void
  setTheme: (theme: 'light' | 'dark') => void
  setFacilityName: (name: string) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      theme: 'light',
      facilityName: '',
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setTheme: (theme) => set({ theme }),
      setFacilityName: (facilityName) => set({ facilityName }),
    }),
    { name: 'gym-ui-prefs' },
  ),
)
