import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/shared/SearchInput'
import { Card } from '@/components/ui/card'
import { attendanceApi } from '@/api/attendance.api'
import { QUERY_KEYS } from '@/lib/constants'
import { formatDateTime } from '@/lib/utils'
import type { AttendanceRecord } from '@/types/attendance.types'
import {
  ScanLine, Users, ChevronLeft, ChevronRight,
  LogIn, LogOut, Clock, Wifi, QrCode, Hand, Fingerprint, Timer,
} from 'lucide-react'

const PER_PAGE = 25

const METHOD_CFG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  qr:       { label: 'QR Code', cls: 'bg-blue-50 text-blue-700 border border-blue-200',    icon: <QrCode className="w-3 h-3" /> },
  manual:   { label: 'Manual',  cls: 'bg-amber-50 text-amber-700 border border-amber-200', icon: <Hand className="w-3 h-3" /> },
  geofence: { label: 'Geo',     cls: 'bg-purple-50 text-purple-700 border border-purple-200', icon: <Wifi className="w-3 h-3" /> },
  card:     { label: 'Card',    cls: 'bg-teal-50 text-teal-700 border border-teal-200',    icon: <Fingerprint className="w-3 h-3" /> },
}

function getDuration(checkIn?: string, checkOut?: string, durationMins?: number): string {
  if (durationMins != null) {
    if (durationMins < 60) return `${durationMins} min`
    const h = Math.floor(durationMins / 60), m = durationMins % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  if (!checkIn || !checkOut) return '—'
  const mins = Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 60000)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60), m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function getName(r: AttendanceRecord): string {
  const u = r.member?.user
  if (u?.first_name || u?.last_name) return `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim()
  return `Member #${r.member_id}`
}

export default function AttendancePage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [methodFilter, setMethodFilter] = useState('all')

  const queryParams = { page, per_page: PER_PAGE }

  const { data, isLoading, isError } = useQuery({
    queryKey: QUERY_KEYS.attendance(queryParams),
    queryFn: () => attendanceApi.list(queryParams),
  })

  // Handle both `records` and `items` response shapes
  const rawRecords: AttendanceRecord[] = (
    (data as any)?.records ??
    (data as any)?.items ??
    (data as any)?.data ??
    []
  )
  const meta    = (data as any)?.meta
  const total   = meta?.total ?? 0
  const perPage = meta?.per_page ?? PER_PAGE

  // Client-side filter
  const records = rawRecords.filter(r => {
    const matchSearch = !search.trim() ||
      getName(r).toLowerCase().includes(search.toLowerCase()) ||
      (r.member?.user?.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
      String(r.member_id).includes(search)
    const matchMethod = methodFilter === 'all' || r.method === methodFilter
    return matchSearch && matchMethod
  })

  // Stats from loaded page
  const stillIn      = rawRecords.filter(r => !r.check_out_at).length
  const checkedOut   = rawRecords.filter(r => !!r.check_out_at).length
  const qrCount      = rawRecords.filter(r => r.method === 'qr').length
  const manualCount  = rawRecords.filter(r => r.method === 'manual').length

  const durations = rawRecords
    .filter(r => r.check_out_at || r.duration_mins)
    .map(r => {
      if (r.duration_mins) return r.duration_mins
      const mins = Math.round(
        (new Date(r.check_out_at!).getTime() - new Date(r.check_in_at).getTime()) / 60000
      )
      return mins
    })
    .filter(m => m > 0)
  const avgDuration = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : null

  return (
    <div className="space-y-6">

      {/* ── Edge-to-edge header ── */}
      <div className="relative overflow-hidden -mx-6 -mt-6 bg-gradient-to-r from-teal-600 via-cyan-600 to-sky-600 px-6 py-6 text-white">
        <div className="relative">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <ScanLine className="w-6 h-6 opacity-90" />
                <h1 className="text-xl font-bold">Attendance</h1>
              </div>
              <p className="text-sm text-white/80 max-w-2xl">
                Live member check-in and check-out log — QR scans, manual entries, durations, and who is still inside the gym right now.
              </p>
            </div>
          </div>

          {/* Stat chips */}
          {!isLoading && (
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1 text-xs font-medium">
                <ScanLine className="w-3.5 h-3.5" /> {total} total records
              </div>
              {stillIn > 0 && (
                <div className="flex items-center gap-1.5 bg-green-400/30 backdrop-blur-sm border border-green-300/40 rounded-full px-3 py-1 text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
                  {stillIn} inside now
                </div>
              )}
              <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1 text-xs font-medium">
                <LogOut className="w-3.5 h-3.5" /> {checkedOut} checked out
              </div>
              {avgDuration != null && (
                <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1 text-xs font-medium">
                  <Timer className="w-3.5 h-3.5" /> avg {avgDuration} min
                </div>
              )}
              {qrCount > 0 && (
                <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1 text-xs font-medium">
                  <QrCode className="w-3.5 h-3.5" /> {qrCount} QR
                </div>
              )}
              {manualCount > 0 && (
                <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1 text-xs font-medium">
                  <Hand className="w-3.5 h-3.5" /> {manualCount} manual
                </div>
              )}
            </div>
          )}
        </div>
        <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute -right-2 -bottom-8 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
      </div>

      {isError && <p className="text-sm text-destructive">Failed to load attendance records.</p>}

      {/* ── Table card ── */}
      <Card className="shadow-lg shadow-gray-200/80 rounded-xl overflow-hidden">

        {/* Search + filter bar */}
        <div className="flex items-center justify-between gap-4 px-4 py-3 border-b bg-teal-50/60">
          <p className="font-medium text-sm text-teal-700 whitespace-nowrap flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            {isLoading ? 'Loading…' : `${records.length} record${records.length !== 1 ? 's' : ''}`}
          </p>
          <div className="flex items-center gap-2 flex-1 justify-end">
            <SearchInput
              placeholder="Name, email, member ID…"
              value={search}
              onChange={v => { setSearch(v); setPage(1) }}
              className="w-56"
            />
            <select value={methodFilter}
              onChange={e => { setMethodFilter(e.target.value); setPage(1) }}
              className="h-9 w-36 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-teal-400">
              <option value="all">All methods</option>
              <option value="qr">QR Code</option>
              <option value="manual">Manual</option>
              <option value="geofence">Geofence</option>
              <option value="card">Card</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gradient-to-r from-teal-50 via-cyan-50 to-sky-50">
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Member</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Check In</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Check Out</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Duration</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Method</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y">

              {isLoading && Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {[1,2,3,4,5,6,7].map(c => (
                    <td key={c} className="px-4 py-3">
                      <div className="h-4 bg-gray-100 rounded animate-pulse w-24" />
                    </td>
                  ))}
                </tr>
              ))}

              {!isLoading && records.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center">
                    <ScanLine className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-muted-foreground text-sm font-medium">No attendance records found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {search || methodFilter !== 'all'
                        ? 'Try adjusting your search or filter.'
                        : 'Check-ins will appear here as members arrive.'}
                    </p>
                  </td>
                </tr>
              )}

              {!isLoading && records.map((r, idx) => {
                const name      = getName(r)
                const email     = r.member?.user?.email
                const isInside  = !r.check_out_at
                const duration  = getDuration(r.check_in_at, r.check_out_at, r.duration_mins)
                const mCfg      = METHOD_CFG[r.method] ?? { label: r.method, cls: 'bg-gray-100 text-gray-600', icon: null }

                return (
                  <tr key={r.id ?? idx}
                    className={`hover:bg-teal-50/40 transition-colors ${isInside ? 'bg-green-50/30' : ''}`}>

                    {/* Member */}
                    <td className="px-4 py-3">
                      <p className="font-medium leading-tight">{name}</p>
                      {email && <p className="text-xs text-muted-foreground mt-0.5">{email}</p>}
                      <p className="text-xs font-mono text-muted-foreground">#{r.member_id}</p>
                    </td>

                    {/* Status — inside / checked out */}
                    <td className="px-4 py-3">
                      {isInside ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                          Inside
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                          <LogOut className="w-3 h-3" /> Left
                        </span>
                      )}
                    </td>

                    {/* Check in */}
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-1.5">
                        <LogIn className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                        <span className="text-sm">{formatDateTime(r.check_in_at)}</span>
                      </div>
                    </td>

                    {/* Check out */}
                    <td className="px-4 py-3">
                      {r.check_out_at ? (
                        <div className="flex items-start gap-1.5">
                          <LogOut className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                          <span className="text-sm text-muted-foreground">{formatDateTime(r.check_out_at)}</span>
                        </div>
                      ) : (
                        <span className="text-green-600 font-medium text-xs flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Still inside
                        </span>
                      )}
                    </td>

                    {/* Duration */}
                    <td className="px-4 py-3">
                      {r.check_out_at || r.duration_mins ? (
                        <span className="inline-flex items-center gap-1 text-sm font-medium">
                          <Timer className="w-3.5 h-3.5 text-muted-foreground" /> {duration}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Method */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${mCfg.cls}`}>
                        {mCfg.icon} {mCfg.label}
                      </span>
                    </td>

                    {/* Notes */}
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[160px]">
                      {r.notes
                        ? <span className="line-clamp-2 italic">"{r.notes}"</span>
                        : <span>—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!isLoading && total > 0 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t bg-muted/20 text-xs text-muted-foreground">
            <span>
              Showing {Math.min((page - 1) * perPage + 1, total)}–{Math.min(page * perPage, total)} of {total} records
            </span>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7" title="Previous page"
                onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <span className="flex items-center px-2 font-medium">Page {page}</span>
              <Button variant="outline" size="icon" className="h-7 w-7" title="Next page"
                onClick={() => setPage(p => p + 1)} disabled={page * perPage >= total}>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
