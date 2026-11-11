import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FormDrawer } from '@/components/shared/FormDrawer'
import { AvatarWithFallback } from '@/components/shared/AvatarWithFallback'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { attendanceApi } from '@/api/attendance.api'
import { bookingsApi } from '@/api/bookings.api'
import { membersApi } from '@/api/members.api'
import { formatDate, formatDateTime } from '@/lib/utils'
import type { Member } from '@/types/member.types'
import type { AttendanceRecord } from '@/types/attendance.types'
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Users,
  CheckSquare,
  Dumbbell,
  Search,
  ExternalLink,
  Clock,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BookingItem {
  id: number
  member_id: number
  status: string
  booked_at: string
  class?: {
    id: number
    name: string
    scheduled_at?: string
    class_type?: string
    duration_mins?: number
    trainer?: {
      user?: { first_name: string; last_name: string }
    }
  }
}

interface MemberRow {
  member: Member
  presentDays: Set<string>
  checkIns: AttendanceRecord[]
  ptSessions: BookingItem[]
  lastVisit: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function firstWeekday(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}
function toDateStr(iso: string) {
  return iso.split('T')[0]
}

// ─── Member Calendar Drawer ───────────────────────────────────────────────────

function MemberCalendarDrawer({
  row,
  year,
  month,
  totalDays,
  onClose,
}: {
  row: MemberRow | null
  year: number
  month: number
  totalDays: number
  onClose: () => void
}) {
  const navigate = useNavigate()
  const todayStr = new Date().toISOString().split('T')[0]
  const pad = firstWeekday(year, month)

  return (
    <FormDrawer
      isOpen={!!row}
      onClose={onClose}
      title="Monthly Detail"
      description={row ? `${row.member.user.first_name} ${row.member.user.last_name} · ${MONTH_NAMES[month]} ${year}` : ''}
      wide
    >
      {row && (
        <div className="space-y-6">
          {/* Member header */}
          <div className="flex items-start gap-3">
            <AvatarWithFallback
              firstName={row.member.user.first_name}
              lastName={row.member.user.last_name}
              className="h-12 w-12 text-base shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-base">
                  {row.member.user.first_name} {row.member.user.last_name}
                </p>
                <StatusBadge status={row.member.membership_status} />
              </div>
              <p className="text-xs text-muted-foreground">{row.member.user.email}</p>
              <p className="text-xs text-muted-foreground">{row.member.member_code}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              onClick={() => navigate(`/members/${row.member.id}`)}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              Profile
            </Button>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-green-50 border border-green-100 p-3 text-center">
              <p className="text-2xl font-bold text-green-700">{row.presentDays.size}</p>
              <p className="text-xs text-green-600 mt-0.5">Days Present</p>
            </div>
            <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-center">
              <p className="text-2xl font-bold text-red-600">{totalDays - row.presentDays.size}</p>
              <p className="text-xs text-red-500 mt-0.5">Days Absent</p>
            </div>
            <div className="rounded-xl bg-violet-50 border border-violet-100 p-3 text-center">
              <p className="text-2xl font-bold text-violet-700">{row.ptSessions.length}</p>
              <p className="text-xs text-violet-600 mt-0.5">PT Sessions</p>
            </div>
          </div>

          {/* Calendar heatmap */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-primary" />
              {MONTH_NAMES[month]} {year} — Attendance Calendar
            </h3>

            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DAY_ABBR.map(d => (
                <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-1">
              {/* Leading blank cells for alignment */}
              {Array.from({ length: pad }).map((_, i) => (
                <div key={`pad-${i}`} />
              ))}
              {Array.from({ length: totalDays }, (_, i) => i + 1).map(day => {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const isPresent = row.presentDays.has(dateStr)
                const isPast = dateStr < todayStr
                const isToday = dateStr === todayStr
                return (
                  <div
                    key={day}
                    title={
                      isPresent
                        ? `Present on ${dateStr}`
                        : isPast
                          ? `Absent on ${dateStr}`
                          : dateStr
                    }
                    className={[
                      'aspect-square rounded-lg flex items-center justify-center text-xs font-semibold transition-all',
                      isPresent
                        ? 'bg-green-500 text-white shadow-sm'
                        : isPast || isToday
                          ? 'bg-red-50 text-red-400 border border-red-100'
                          : 'bg-muted/30 text-muted-foreground/50',
                      isToday ? 'ring-2 ring-primary ring-offset-1' : '',
                    ].join(' ')}
                  >
                    {day}
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-green-500 inline-block" /> Present
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-red-50 border border-red-100 inline-block" /> Absent
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-muted/30 inline-block" /> Upcoming
              </span>
            </div>
          </div>

          {/* Check-in log */}
          {row.checkIns.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-primary" />
                Check-in Log ({row.checkIns.length})
              </h3>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {row.checkIns
                  .slice()
                  .sort((a, b) => new Date(b.check_in_at).getTime() - new Date(a.check_in_at).getTime())
                  .map(r => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between rounded-lg bg-sky-50 border border-sky-100 px-3 py-2 text-xs"
                    >
                      <span className="font-medium text-sky-800">{formatDateTime(r.check_in_at)}</span>
                      <div className="flex items-center gap-2">
                        {r.duration_mins != null && (
                          <span className="text-sky-600">{r.duration_mins} min</span>
                        )}
                        <Badge variant="outline" className="text-[10px] capitalize border-sky-200 text-sky-700">
                          {r.method}
                        </Badge>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* PT Sessions */}
          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
              <Dumbbell className="h-4 w-4 text-primary" />
              PT Sessions This Month ({row.ptSessions.length})
            </h3>
            {row.ptSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No class sessions attended this month.</p>
            ) : (
              <div className="space-y-1.5">
                {row.ptSessions
                  .slice()
                  .sort((a, b) => {
                    const da = new Date(a.class?.scheduled_at ?? a.booked_at).getTime()
                    const db = new Date(b.class?.scheduled_at ?? b.booked_at).getTime()
                    return da - db
                  })
                  .map(s => (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 rounded-lg bg-violet-50 border border-violet-100 px-3 py-2.5"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-violet-900 truncate">
                          {s.class?.name ?? 'Class'}
                        </p>
                        <p className="text-xs text-violet-500">
                          {s.class?.scheduled_at ? formatDate(s.class.scheduled_at) : ''}
                          {s.class?.duration_mins ? ` · ${s.class.duration_mins} min` : ''}
                          {s.class?.trainer?.user
                            ? ` · ${s.class.trainer.user.first_name} ${s.class.trainer.user.last_name}`
                            : ''}
                        </p>
                      </div>
                      {s.class?.class_type && (
                        <Badge variant="outline" className="text-[10px] capitalize border-violet-200 text-violet-700 shrink-0">
                          {s.class.class_type}
                        </Badge>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </FormDrawer>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MonthlyReportPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [search, setSearch] = useState('')
  const [selectedRow, setSelectedRow] = useState<MemberRow | null>(null)

  const totalDays = daysInMonth(year, month)
  const from = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(totalDays).padStart(2, '0')}`

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth()

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: membersRaw, isLoading: membersLoading } = useQuery({
    queryKey: ['monthly-members'],
    queryFn: () => membersApi.list({ per_page: 500 }),
    staleTime: 60_000,
  })

  const { data: attRaw, isLoading: attLoading } = useQuery({
    queryKey: ['monthly-attendance', year, month],
    queryFn: () => attendanceApi.list({ from, to, per_page: 3000 }),
  })

  const { data: bookingsRaw, isLoading: bookingsLoading } = useQuery({
    queryKey: ['monthly-bookings-attended', year, month],
    queryFn: () => bookingsApi.list({ status: 'attended', per_page: 3000 }),
  })

  const isLoading = membersLoading || attLoading || bookingsLoading

  // ── Data processing ───────────────────────────────────────────────────────────

  const rows = useMemo<MemberRow[]>(() => {
    const members = (membersRaw as { members?: Member[] })?.members ?? []
    const attendance = ((attRaw as { attendance?: AttendanceRecord[] })?.attendance ?? []) as AttendanceRecord[]
    const allBookings = ((bookingsRaw as { bookings?: BookingItem[] })?.bookings ?? []) as BookingItem[]

    // Filter bookings to this month by class scheduled_at
    const monthBookings = allBookings.filter(b => {
      const dt = b.class?.scheduled_at
      if (!dt) return false
      const d = new Date(dt)
      return d.getFullYear() === year && d.getMonth() === month
    })

    // Group attendance by member_id
    const attByMember = new Map<number, AttendanceRecord[]>()
    for (const a of attendance) {
      const list = attByMember.get(a.member_id) ?? []
      list.push(a)
      attByMember.set(a.member_id, list)
    }

    // Group bookings by member_id
    const bookingsByMember = new Map<number, BookingItem[]>()
    for (const b of monthBookings) {
      const list = bookingsByMember.get(b.member_id) ?? []
      list.push(b)
      bookingsByMember.set(b.member_id, list)
    }

    return members.map(member => {
      const memberAtt = attByMember.get(member.id) ?? []
      const presentDays = new Set(memberAtt.map(a => toDateStr(a.check_in_at)))
      const ptSessions = bookingsByMember.get(member.id) ?? []
      const lastVisit = memberAtt.length > 0
        ? memberAtt.reduce((latest, a) =>
            new Date(a.check_in_at) > new Date(latest.check_in_at) ? a : latest
          ).check_in_at
        : null

      return { member, presentDays, checkIns: memberAtt, ptSessions, lastVisit }
    })
  }, [membersRaw, attRaw, bookingsRaw, year, month])

  // ── Aggregate stats ──────────────────────────────────────────────────────────

  const totalVisited = rows.filter(r => r.presentDays.size > 0).length
  const totalCheckIns = rows.reduce((s, r) => s + r.checkIns.length, 0)
  const totalPT = rows.reduce((s, r) => s + r.ptSessions.length, 0)

  // ── Search filter ────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter(r => {
      const name = `${r.member.user.first_name} ${r.member.user.last_name}`.toLowerCase()
      return (
        name.includes(q) ||
        r.member.user.email.toLowerCase().includes(q) ||
        (r.member.member_code ?? '').toLowerCase().includes(q)
      )
    })
  }, [rows, search])

  return (
    <div className="space-y-6">

      {/* ── Edge-to-edge header ── */}
      <div className="relative overflow-hidden -mx-6 -mt-6 bg-gradient-to-br from-indigo-700 via-violet-700 to-purple-800 text-white">
        <div className="relative px-6 pt-6">

          {/* Title row + month navigator */}
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <p className="text-[11px] font-semibold tracking-widest uppercase text-white/55 mb-1.5">Reports</p>
              <div className="flex items-center gap-2.5 mb-1">
                <CalendarDays className="w-5 h-5 opacity-80" />
                <h1 className="text-2xl font-bold tracking-tight">Member Attendance Report</h1>
              </div>
              <p className="text-sm text-white/65">
                Attendance &amp; PT sessions per member · {totalDays} days · {from} → {to}
              </p>
            </div>

            {/* Month navigation */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={prevMonth}
                className="flex items-center justify-center w-8 h-8 rounded-full border border-white/30 text-white hover:bg-white/15 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-4 py-1.5 rounded-full bg-white text-indigo-700 text-sm font-semibold shadow-sm min-w-[160px] text-center">
                {MONTH_NAMES[month]} {year}
              </span>
              <button
                onClick={nextMonth}
                disabled={isCurrentMonth}
                className="flex items-center justify-center w-8 h-8 rounded-full border border-white/30 text-white hover:bg-white/15 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* 4 stat panels */}
        {!isLoading && (
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/15 border-t border-white/15">
            <div className="px-5 py-4">
              <p className="text-xl font-bold leading-none">{rows.length}</p>
              <p className="text-xs font-medium text-white/85 mt-1">Total Members</p>
              <p className="text-xs text-white/45 mt-0.5">in this period</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-xl font-bold leading-none text-green-300">{totalVisited}</p>
              <p className="text-xs font-medium text-white/85 mt-1">Visited This Month</p>
              <p className="text-xs text-white/45 mt-0.5">at least 1 check-in</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-xl font-bold leading-none text-sky-300">{totalCheckIns}</p>
              <p className="text-xs font-medium text-white/85 mt-1">Total Check-ins</p>
              <p className="text-xs text-white/45 mt-0.5">gym entries</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-xl font-bold leading-none text-violet-300">{totalPT}</p>
              <p className="text-xs font-medium text-white/85 mt-1">PT Sessions</p>
              <p className="text-xs text-white/45 mt-0.5">attended classes</p>
            </div>
          </div>
        )}

        <div className="absolute -right-6 -top-6 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute right-20 -bottom-8 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />
      </div>

      {/* Member table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="text-base">Member Breakdown</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, code…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-sidebar">
                <tr>
                  {['Member', 'Days Present', 'Days Absent', 'Attendance %', 'PT Sessions', 'Last Visit', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <Skeleton className="h-4 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                      No members found{search ? ` for "${search}"` : ''}
                    </td>
                  </tr>
                ) : (
                  filtered.map(row => {
                    const present = row.presentDays.size
                    const absent = totalDays - present
                    const pct = Math.round((present / totalDays) * 100)

                    return (
                      <tr
                        key={row.member.id}
                        className="hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => setSelectedRow(row)}
                      >
                        {/* Member */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <AvatarWithFallback
                              firstName={row.member.user.first_name}
                              lastName={row.member.user.last_name}
                              className="h-8 w-8 text-xs shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="font-medium truncate">
                                {row.member.user.first_name} {row.member.user.last_name}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">{row.member.member_code}</p>
                            </div>
                          </div>
                        </td>

                        {/* Days present with mini progress bar */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-green-700 w-6 text-right">{present}</span>
                            <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden shrink-0">
                              <div
                                className="h-full rounded-full bg-green-500 transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Days absent */}
                        <td className="px-4 py-3">
                          <span className={`font-medium ${absent > totalDays * 0.7 ? 'text-red-500' : absent > totalDays * 0.4 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                            {absent}
                          </span>
                        </td>

                        {/* Attendance % */}
                        <td className="px-4 py-3">
                          <span className={`font-semibold ${pct >= 70 ? 'text-green-600' : pct >= 40 ? 'text-amber-600' : 'text-red-500'}`}>
                            {pct}%
                          </span>
                        </td>

                        {/* PT sessions */}
                        <td className="px-4 py-3">
                          {row.ptSessions.length > 0 ? (
                            <Badge className="bg-violet-100 text-violet-700 border-violet-200 hover:bg-violet-200">
                              {row.ptSessions.length} session{row.ptSessions.length !== 1 ? 's' : ''}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* Last visit */}
                        <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                          {row.lastVisit ? formatDate(row.lastVisit) : '—'}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <StatusBadge status={row.member.membership_status} />
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer note */}
          {!isLoading && filtered.length > 0 && (
            <div className="px-4 py-3 border-t text-xs text-muted-foreground">
              Showing {filtered.length} of {rows.length} members · Click a row to see the calendar view and PT session details
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail drawer */}
      <MemberCalendarDrawer
        row={selectedRow}
        year={year}
        month={month}
        totalDays={totalDays}
        onClose={() => setSelectedRow(null)}
      />
    </div>
  )
}
