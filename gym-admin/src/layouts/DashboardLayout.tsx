import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { useUIStore } from '@/store/ui.store'
import { useEffect } from 'react'
import { facilitiesApi } from '@/api/facilities.api'

export function DashboardLayout() {
  const { theme, facilityName, setFacilityName } = useUIStore()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useEffect(() => {
    if (!facilityName) {
      facilitiesApi.getById(1).then((f: any) => {
        if (f?.name) setFacilityName(f.name)
      }).catch(() => {/* ignore */})
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6 bg-white">
        <Outlet />
      </main>
    </div>
  )
}
