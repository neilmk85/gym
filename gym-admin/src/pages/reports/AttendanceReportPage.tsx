import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Users,
  Clock,
  TrendingUp,
  UserX,
  Search,
  X,
  Download,
  LayoutList,
  TableProperties,
} from 'lucide-react'
import { staffAttendanceApi } from '@/api/staff-attendance.api'
import type { StaffAttendanceRecord } from '@/api/staff-attendance.api'
import { staffApi } from '@/api/staff.api'
import type { Staff } from '@/api/staff.api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DAY_ABBR = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const STATUS_CFG = {
  present:  { short: 'P',  full: 'Present',   bg: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  absent:   { short: 'A',  full: 'Absent',    bg: 'bg-red-100 text-red-700 border border-red-200' },
  half_day: { short: 'H',  full: 'Half Day',  bg: 'bg-amber-100 text-amber-700 border border-amber-200' },
  leave:    { short: 'L',  full: 'Leave',     bg: 'bg-blue-100 text-blue-700 border border-blue-200' },
  holiday:  { short: 'Ho', full: 'Holiday',   bg: 'bg-purple-100 text-purple-700 border border-purple-200' },
} as const

// ─── Types ────────────────────────────────────────────────────────────────────

type StatusKey = keyof typeof STATUS_CFG

interface StaffSummary {
  staff: Staff
  present: number
  absent: number
  halfDay: number
  leave: number
  holiday: number
  totalHours: number
  attendancePct: number
  totalMarked: number
  dayMap: Map<number, StaffAttendanceRecord>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function workingDaysInMonth(year: number, month: number) {
  const days = daysInMonth(year, month)
  let count = 0
  for (let d = 1; d <= days; d++) {
    if (new Date(year, month - 1, d).getDay() !== 0) count++
  }
  return count
}

function isSunday(year: number, month: number, day: number) {
  return new Date(year, month - 1, day).getDay() === 0
}

function dayOfWeekLabel(year: number, month: number, day: number) {
  return DAY_ABBR[new Date(year, month - 1, day).getDay()]
}

function parseDayFromDate(dateStr: string): number {
  return parseInt(dateStr.substring(8, 10), 10)
}

function formatHours(h: number) {
  if (!h) return '—'
  const hrs = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`
}

// ─── Status Cell ─────────────────────────────────────────────────────────────

function StatusCell({ status }: { status?: StatusKey }) {
  if (!status) return <span className="text-muted-foreground/40 text-xs">—</span>
  const cfg = STATUS_CFG[status]
  return (
    <span className={cn('inline-flex items-center justify-center rounded px-1 text-[10px] font-semibold leading-5 min-w-[18px]', cfg.bg)}>
      {cfg.short}
    </span>
  )
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────

function DetailDrawer({
  summary,
  year,
  month,
  onClose,
}: {
  summary: StaffSummary
  year: number
  month: number
  onClose: () => void
}) {
  const { staff, present, absent, halfDay, leave, holiday, totalHours, attendancePct, dayMap } = summary
  const days = daysInMonth(year, month)
  const monthDays = Array.from({ length: days }, (_, i) => i + 1)

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/30 z-40 backdrop-blur-[1px]"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full sm:w-[480px] z-50 bg-background border-l shadow-2xl flex flex-col overflow-hidden">
        {/* Drawer header */}
        <div className="bg-gradient-to-br from-indigo-700 via-violet-700 to-purple-800 text-white px-5 py-4 flex items-start justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm">
                {staff.first_name[0]}{staff.last_name[0]}
              </div>
              <div>
                <div className="font-semibold">{staff.first_name} {staff.last_name}</div>
                <div className="text-xs text-white/70">{staff.employee_id} · {staff.designation}</div>
              </div>
            </div>
            <div className="mt-1 text-xs text-white/60">{staff.department}</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors mt-0.5">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-5 divide-x border-b bg-muted/20 shrink-0">
          {[
            { label: 'Present', value: present, color: 'text-emerald-600' },
            { label: 'Absent', value: absent, color: 'text-red-600' },
            { label: 'Half Day', value: halfDay, color: 'text-amber-600' },
            { label: 'Leave', value: leave, color: 'text-blue-600' },
            { label: 'Holiday', value: holiday, color: 'text-purple-600' },
          ].map(item => (
            <div key={item.label} className="p-3 text-center">
              <div className={cn('text-lg font-bold', item.color)}>{item.value}</div>
              <div className="text-[10px] text-muted-foreground">{item.label}</div>
            </div>
          ))}
        </div>

        {/* Attendance % + Hours */}
        <div className="flex items-center gap-4 px-5 py-3 border-b bg-muted/10 shrink-0">
          <div className="flex items-center gap-2 flex-1">
            <div className="text-sm text-muted-foreground">Attendance</div>
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', attendancePct >= 80 ? 'bg-emerald-500' : attendancePct >= 60 ? 'bg-amber-500' : 'bg-red-500')}
                style={{ width: `${attendancePct}%` }}
              />
            </div>
            <div className="text-sm font-semibold w-10 text-right">{attendancePct}%</div>
          </div>
          <div className="text-sm text-muted-foreground shrink-0">
            <span className="font-medium text-foreground">{formatHours(totalHours)}</span> total
          </div>
        </div>

        {/* Day-by-day list */}
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y">
            {monthDays.map(d => {
              const rec = dayMap.get(d)
              const sun = isSunday(year, month, d)
              const dowLabel = dayOfWeekLabel(year, month, d)
              const dateStr = `${String(d).padStart(2, '0')} ${dowLabel}`

              return (
                <div
                  key={d}
                  className={cn(
                    'flex items-center gap-3 px-5 py-2.5',
                    sun && 'bg-muted/40',
                    !rec && !sun && 'opacity-60',
                  )}
                >
                  <div className="w-14 shrink-0">
                    <span className="text-sm font-medium">{dateStr}</span>
                    {sun && <span className="ml-1 text-[10px] text-muted-foreground">(Sun)</span>}
                  </div>
                  <div className="flex-1">
                    {sun ? (
                      <span className="text-xs text-muted-foreground">Weekend</span>
                    ) : rec ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusCell status={rec.status as StatusKey} />
                        {rec.check_in && (
                          <span className="text-xs text-muted-foreground">
                            {rec.check_in}
                            {rec.check_out && ` → ${rec.check_out}`}
                          </span>
                        )}
                        {rec.working_hours > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {formatHours(rec.working_hours)}
                          </span>
                        )}
                        {rec.notes && (
                          <span className="text-xs text-muted-foreground italic truncate max-w-[140px]">{rec.notes}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not marked</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Summary Table ────────────────────────────────────────────────────────────

function SummaryTable({
  summaries,
  onSelectStaff,
}: {
  summaries: StaffSummary[]
  onSelectStaff: (id: number) => void
}) {
  if (summaries.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <ClipboardList className="mx-auto h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm">No staff members found</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border overflow-hidden bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Staff Member</th>
              <th className="text-center px-3 py-3 font-medium text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span className={cn('w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center', STATUS_CFG.present.bg)}>P</span>
                  Present
                </span>
              </th>
              <th className="text-center px-3 py-3 font-medium text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span className={cn('w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center', STATUS_CFG.absent.bg)}>A</span>
                  Absent
                </span>
              </th>
              <th className="text-center px-3 py-3 font-medium text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span className={cn('w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center', STATUS_CFG.half_day.bg)}>H</span>
                  Half
                </span>
              </th>
              <th className="text-center px-3 py-3 font-medium text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span className={cn('w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center', STATUS_CFG.leave.bg)}>L</span>
                  Leave
                </span>
              </th>
              <th className="text-center px-3 py-3 font-medium text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span className={cn('w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center', STATUS_CFG.holiday.bg)}>Ho</span>
                  Holiday
                </span>
              </th>
              <th className="text-center px-3 py-3 font-medium text-muted-foreground">Hours</th>
              <th className="text-center px-3 py-3 font-medium text-muted-foreground w-32">Attendance %</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {summaries.map(row => (
              <tr
                key={row.staff.id}
                className="hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => onSelectStaff(row.staff.id)}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
                      {row.staff.first_name[0]}{row.staff.last_name[0]}
                    </div>
                    <div>
                      <div className="font-medium">{row.staff.first_name} {row.staff.last_name}</div>
                      <div className="text-xs text-muted-foreground">{row.staff.employee_id} · {row.staff.department}</div>
                    </div>
                  </div>
                </td>
                <td className="text-center px-3 py-3 font-semibold text-emerald-600">{row.present}</td>
                <td className="text-center px-3 py-3 font-semibold text-red-600">{row.absent}</td>
                <td className="text-center px-3 py-3 font-semibold text-amber-600">{row.halfDay}</td>
                <td className="text-center px-3 py-3 font-semibold text-blue-600">{row.leave}</td>
                <td className="text-center px-3 py-3 font-semibold text-purple-600">{row.holiday}</td>
                <td className="text-center px-3 py-3 text-muted-foreground">{formatHours(row.totalHours)}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', row.attendancePct >= 80 ? 'bg-emerald-500' : row.attendancePct >= 60 ? 'bg-amber-500' : 'bg-red-500')}
                        style={{ width: `${row.attendancePct}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium w-9 text-right">{row.attendancePct}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Register Matrix ──────────────────────────────────────────────────────────

function RegisterMatrix({
  summaries,
  year,
  month,
  onSelectStaff,
}: {
  summaries: StaffSummary[]
  year: number
  month: number
  onSelectStaff: (id: number) => void
}) {
  const days = daysInMonth(year, month)
  const dayNums = Array.from({ length: days }, (_, i) => i + 1)

  if (summaries.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <ClipboardList className="mx-auto h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm">No staff members found</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border overflow-hidden bg-card">
      <div className="overflow-x-auto">
        <table className="text-xs" style={{ minWidth: `${200 + days * 36}px` }}>
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="sticky left-0 z-10 bg-muted/50 text-left px-4 py-2 font-medium text-muted-foreground min-w-[160px]">
                Staff
              </th>
              {dayNums.map(d => {
                const sun = isSunday(year, month, d)
                return (
                  <th
                    key={d}
                    className={cn(
                      'text-center px-1 py-2 font-medium w-9 min-w-[36px]',
                      sun ? 'text-muted-foreground/40' : 'text-muted-foreground',
                    )}
                  >
                    <div>{d}</div>
                    <div className={cn('text-[9px] font-normal', sun && 'text-red-400')}>{dayOfWeekLabel(year, month, d)}</div>
                  </th>
                )
              })}
              <th className="text-center px-2 py-2 font-medium text-muted-foreground min-w-[52px]">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {summaries.map(row => (
              <tr
                key={row.staff.id}
                className="hover:bg-muted/20 transition-colors cursor-pointer"
                onClick={() => onSelectStaff(row.staff.id)}
              >
                <td className="sticky left-0 z-10 bg-background px-4 py-2 border-r">
                  <div className="font-medium leading-tight">{row.staff.first_name} {row.staff.last_name}</div>
                  <div className="text-muted-foreground text-[10px]">{row.staff.department}</div>
                </td>
                {dayNums.map(d => {
                  const sun = isSunday(year, month, d)
                  const rec = row.dayMap.get(d)
                  return (
                    <td
                      key={d}
                      className={cn(
                        'text-center px-1 py-1.5 w-9',
                        sun && 'bg-muted/30',
                      )}
                    >
                      {sun ? (
                        <span className="text-muted-foreground/30 text-[10px]">—</span>
                      ) : (
                        <StatusCell status={rec?.status as StatusKey} />
                      )}
                    </td>
                  )
                })}
                <td className="text-center px-2 py-2">
                  <div className={cn(
                    'text-xs font-semibold',
                    row.attendancePct >= 80 ? 'text-emerald-600' : row.attendancePct >= 60 ? 'text-amber-600' : 'text-red-600',
                  )}>
                    {row.attendancePct}%
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl bg-white/10 border border-white/20 backdrop-blur-sm px-4 py-3">
      <div className="flex items-start gap-2.5">
        <div className="p-1.5 rounded-lg bg-white/10">{icon}</div>
        <div className="min-w-0">
          <div className="text-2xl font-bold leading-tight">{value}</div>
          <div className="text-xs text-white/70 mt-0.5">{label}</div>
          {sub && <div className="text-xs text-white/50 mt-0.5">{sub}</div>}
        </div>
      </div>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="p-4 border-b bg-muted/30">
        <Skeleton className="h-4 w-48" />
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 border-b last:border-0">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-2.5 w-24" />
          </div>
          {Array.from({ length: 5 }).map((_, j) => (
            <Skeleton key={j} className="h-4 w-6" />
          ))}
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  )
}

// ─── Download CSV ─────────────────────────────────────────────────────────────

function downloadCSV(summaries: StaffSummary[], month: number, year: number) {
  const monthName = MONTH_NAMES[month - 1]
  const headers = ['Employee ID', 'Name', 'Department', 'Designation', 'Present', 'Absent', 'Half Day', 'Leave', 'Holiday', 'Total Hours', 'Attendance %']
  const rows = summaries.map(r => [
    r.staff.employee_id,
    `${r.staff.first_name} ${r.staff.last_name}`,
    r.staff.department,
    r.staff.designation,
    r.present,
    r.absent,
    r.halfDay,
    r.leave,
    r.holiday,
    r.totalHours.toFixed(2),
    `${r.attendancePct}%`,
  ])
  const csv = [headers, ...rows].map(row => row.map(c => `"${c}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `staff-attendance-${monthName}-${year}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AttendanceReportPage() {
  const now = new Date()
  const [currentDate, setCurrentDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1))
  const [view, setView] = useState<'summary' | 'register'>('summary')
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('all')
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1

  const prevMonth = useCallback(() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)), [])
  const nextMonth = useCallback(() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)), [])

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: staffData } = useQuery({
    queryKey: ['staff', 'all-active'],
    queryFn: () => staffApi.list({ per_page: 500, status: 'active' }),
    staleTime: 5 * 60 * 1000,
  })

  const { data: attendanceData, isLoading: loadingAttendance } = useQuery({
    queryKey: ['staff-attendance-monthly', month, year],
    queryFn: () => staffAttendanceApi.listByMonth(month, year),
    staleTime: 2 * 60 * 1000,
  })

  const allStaff: Staff[] = (staffData as any)?.data ?? []
  const attendanceRecords: StaffAttendanceRecord[] = (attendanceData as any) ?? []

  // ── Working days ─────────────────────────────────────────────────────────────

  const workDays = useMemo(() => workingDaysInMonth(year, month), [year, month])

  // ── Build attendance map ──────────────────────────────────────────────────────

  const attendanceMap = useMemo(() => {
    const map = new Map<number, Map<number, StaffAttendanceRecord>>()
    for (const rec of attendanceRecords) {
      const day = parseDayFromDate(rec.date)
      if (!map.has(rec.staff_id)) map.set(rec.staff_id, new Map())
      map.get(rec.staff_id)!.set(day, rec)
    }
    return map
  }, [attendanceRecords])

  // ── Per-staff summaries ───────────────────────────────────────────────────────

  const staffSummaries: StaffSummary[] = useMemo(() => {
    return allStaff.map(s => {
      const dayMap = attendanceMap.get(s.id) ?? new Map()
      const records = Array.from(dayMap.values())
      const present  = records.filter(r => r.status === 'present').length
      const absent   = records.filter(r => r.status === 'absent').length
      const halfDay  = records.filter(r => r.status === 'half_day').length
      const leave    = records.filter(r => r.status === 'leave').length
      const holiday  = records.filter(r => r.status === 'holiday').length
      const totalHours = records.reduce((sum, r) => sum + (r.working_hours ?? 0), 0)
      const effective = present + halfDay * 0.5 + leave + holiday
      const attendancePct = workDays > 0 ? Math.round((effective / workDays) * 100) : 0
      return { staff: s, present, absent, halfDay, leave, holiday, totalHours, attendancePct, totalMarked: records.length, dayMap }
    })
  }, [allStaff, attendanceMap, workDays])

  // ── Departments ───────────────────────────────────────────────────────────────

  const departments = useMemo(() => {
    const depts = new Set(allStaff.map(s => s.department).filter(Boolean))
    return Array.from(depts).sort()
  }, [allStaff])

  // ── Filter + sort ─────────────────────────────────────────────────────────────

  const filteredSummaries = useMemo(() => {
    return staffSummaries
      .filter(row => {
        const name = `${row.staff.first_name} ${row.staff.last_name}`.toLowerCase()
        const matchSearch = !search || name.includes(search.toLowerCase()) ||
          (row.staff.employee_id ?? '').toLowerCase().includes(search.toLowerCase())
        const matchDept = deptFilter === 'all' || row.staff.department === deptFilter
        return matchSearch && matchDept
      })
      .sort((a, b) => b.attendancePct - a.attendancePct)
  }, [staffSummaries, search, deptFilter])

  // ── Aggregate stats ───────────────────────────────────────────────────────────

  const totalStaff = allStaff.length
  const avgAttendance = filteredSummaries.length > 0
    ? Math.round(filteredSummaries.reduce((sum, r) => sum + r.attendancePct, 0) / filteredSummaries.length)
    : 0
  const totalHours = filteredSummaries.reduce((sum, r) => sum + r.totalHours, 0)
  const todayAbsentCount = useMemo(() => {
    if (!isCurrentMonth) return null
    const todayNum = now.getDate()
    return attendanceRecords.filter(r => parseDayFromDate(r.date) === todayNum && r.status === 'absent').length
  }, [attendanceRecords, isCurrentMonth])

  const selectedSummary = selectedStaffId !== null
    ? staffSummaries.find(s => s.staff.id === selectedStaffId) ?? null
    : null

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* ── Edge-to-edge gradient header ── */}
      <div className="relative overflow-hidden -mx-6 -mt-6 bg-gradient-to-br from-indigo-700 via-violet-700 to-purple-800 text-white">
        <div className="relative px-6 pt-6 pb-5">
          {/* Title + month nav row */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
                <ClipboardList className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Staff Attendance Report</h1>
                <p className="text-sm text-white/70">
                  Work-hour tracking · {workDays} working days
                </p>
              </div>
            </div>

            {/* Month navigator */}
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={prevMonth}
                className="flex items-center justify-center w-8 h-8 rounded-full border border-white/30 text-white hover:bg-white/15 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-4 py-1.5 rounded-full bg-white text-indigo-700 text-sm font-semibold shadow-sm min-w-[160px] text-center">
                {MONTH_NAMES[month - 1]} {year}
              </span>
              <button
                onClick={nextMonth}
                className="flex items-center justify-center w-8 h-8 rounded-full border border-white/30 text-white hover:bg-white/15 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Stat cards row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              icon={<Users className="h-4 w-4" />}
              label="Total Staff"
              value={totalStaff}
              sub="active members"
            />
            <StatCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Avg Attendance"
              value={`${avgAttendance}%`}
              sub={`${MONTH_NAMES[month - 1]}`}
            />
            <StatCard
              icon={<Clock className="h-4 w-4" />}
              label="Total Hours"
              value={totalHours > 0 ? `${Math.round(totalHours)}h` : '—'}
              sub="this month"
            />
            <StatCard
              icon={<UserX className="h-4 w-4" />}
              label={isCurrentMonth ? "Absent Today" : "Absent Days"}
              value={isCurrentMonth ? (todayAbsentCount ?? '—') : filteredSummaries.reduce((s, r) => s + r.absent, 0)}
              sub={isCurrentMonth ? "marked absent today" : "total this month"}
            />
          </div>
        </div>

        {/* Decorative circles */}
        <div className="absolute -right-6 -top-6 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute right-20 -bottom-8 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-muted-foreground mr-1">Legend:</span>
        {(Object.entries(STATUS_CFG) as [StatusKey, (typeof STATUS_CFG)[StatusKey]][]).map(([k, v]) => (
          <span key={k} className={cn('inline-flex items-center gap-1 text-xs rounded px-2 py-0.5 font-medium', v.bg)}>
            <span className="font-bold">{v.short}</span>
            <span className="font-normal opacity-80">{v.full}</span>
          </span>
        ))}
      </div>

      {/* ── Controls row ── */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9 h-9 text-sm"
            placeholder="Search staff name or ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Department filter */}
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setDeptFilter('all')}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
              deptFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            All
          </button>
          {departments.map(dept => (
            <button
              key={dept}
              onClick={() => setDeptFilter(dept === deptFilter ? 'all' : dept)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                deptFilter === dept ? 'bg-indigo-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              {dept}
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* View toggle */}
        <div className="flex gap-1 p-1 rounded-lg bg-muted">
          <button
            onClick={() => setView('summary')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors',
              view === 'summary' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <LayoutList className="h-3.5 w-3.5" />
            Summary
          </button>
          <button
            onClick={() => setView('register')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors',
              view === 'register' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <TableProperties className="h-3.5 w-3.5" />
            Register
          </button>
        </div>

        {/* Download CSV */}
        <Button
          size="sm"
          variant="outline"
          className="h-9 gap-1.5"
          onClick={() => downloadCSV(filteredSummaries, month, year)}
          disabled={filteredSummaries.length === 0}
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>

      {/* ── Result count ── */}
      {!loadingAttendance && (
        <div className="text-xs text-muted-foreground">
          Showing {filteredSummaries.length} of {totalStaff} staff members
          {attendanceRecords.length > 0
            ? ` · ${attendanceRecords.length} attendance records this month`
            : ' · No attendance marked yet this month'}
        </div>
      )}

      {/* ── Main content ── */}
      {loadingAttendance ? (
        <TableSkeleton />
      ) : view === 'summary' ? (
        <SummaryTable summaries={filteredSummaries} onSelectStaff={setSelectedStaffId} />
      ) : (
        <RegisterMatrix
          summaries={filteredSummaries}
          year={year}
          month={month}
          onSelectStaff={setSelectedStaffId}
        />
      )}

      {/* ── Detail drawer ── */}
      {selectedSummary && (
        <DetailDrawer
          summary={selectedSummary}
          year={year}
          month={month}
          onClose={() => setSelectedStaffId(null)}
        />
      )}
    </div>
  )
}
