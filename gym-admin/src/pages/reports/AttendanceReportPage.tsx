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
  X,
  Download,
  LayoutList,
  TableProperties,
} from 'lucide-react'
import { trainersApi } from '@/api/trainers.api'
import type { TrainerProfile } from '@/types/trainer.types'
import { SearchInput } from '@/components/shared/SearchInput'
import { PageHeader } from '@/components/shared/PageHeader'
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface PunchEntry {
  punched_at: string
  server_received_at?: string | null
}

interface DayPunch {
  date: string         // "2026-11-21"
  punches: PunchEntry[]
  duty_hours: number
}

interface TrainerDay {
  date: string
  firstIn: Date
  lastOut: Date
  dutyHours: number
  punchCount: number
}

interface TrainerSummary {
  trainer: TrainerProfile
  days: TrainerDay[]
  totalHours: number
  presentDays: number
  attendancePct: number
  dayMap: Map<string, TrainerDay> // key = "YYYY-MM-DD"
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

function formatHours(h: number) {
  if (!h) return '—'
  const hrs = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function trainerName(t: TrainerProfile) {
  return `${t.user?.first_name ?? ''} ${t.user?.last_name ?? ''}`.trim()
}

function trainerInitials(t: TrainerProfile) {
  const f = t.user?.first_name?.[0] ?? ''
  const l = t.user?.last_name?.[0] ?? ''
  return (f + l).toUpperCase()
}

// ─── Attendance dot for register ─────────────────────────────────────────────

function DayDot({ day }: { day?: TrainerDay }) {
  if (!day) return <span className="text-muted-foreground/30 text-[10px]">—</span>
  const color = day.dutyHours >= 7 ? 'bg-emerald-500' : day.dutyHours >= 4 ? 'bg-amber-400' : 'bg-orange-400'
  return <span className={cn('inline-block w-4 h-4 rounded-sm', color)} title={`${formatHours(day.dutyHours)}`} />
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────

function DetailDrawer({
  summary,
  year,
  month,
  onClose,
}: {
  summary: TrainerSummary
  year: number
  month: number
  onClose: () => void
}) {
  const { trainer, presentDays, totalHours, attendancePct, dayMap } = summary
  const days = daysInMonth(year, month)
  const monthDays = Array.from({ length: days }, (_, i) => i + 1)

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-[1px]" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full sm:w-[480px] z-50 bg-background border-l shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 flex items-start justify-between shrink-0 border-b" style={{ background: 'linear-gradient(to bottom, #d0f5fb 0%, #e8f9fc 60%, rgba(255,255,255,0) 100%)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white" style={{ background: 'linear-gradient(135deg, #0096b4, #00B4D8)' }}>
              {trainerInitials(trainer)}
            </div>
            <div>
              <div className="font-semibold text-[#1a1a2e]">{trainerName(trainer)}</div>
              <div className="text-xs text-slate-500">{trainer.specialization ?? trainer.designation ?? 'Trainer'}</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-teal-50 text-slate-500 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-3 divide-x border-b bg-muted/20 shrink-0">
          {[
            { label: 'Days Present', value: presentDays, color: 'text-emerald-600' },
            { label: 'Total Hours', value: formatHours(totalHours), color: 'text-blue-600' },
            { label: 'Attendance', value: `${attendancePct}%`, color: attendancePct >= 80 ? 'text-emerald-600' : attendancePct >= 60 ? 'text-amber-600' : 'text-red-600' },
          ].map(item => (
            <div key={item.label} className="p-3 text-center">
              <div className={cn('text-lg font-bold', item.color)}>{item.value}</div>
              <div className="text-[10px] text-muted-foreground">{item.label}</div>
            </div>
          ))}
        </div>

        {/* Day-by-day list */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/60 border-b">
              <tr>
                <th className="text-left px-5 py-2 text-xs font-medium text-muted-foreground">Date</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">In</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Out</th>
                <th className="text-right px-5 py-2 text-xs font-medium text-muted-foreground">Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {monthDays.map(d => {
                const dateKey = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`
                const day = dayMap.get(dateKey)
                const sun = isSunday(year, month, d)
                const dow = dayOfWeekLabel(year, month, d)
                return (
                  <tr key={d} className={cn('transition-colors', sun ? 'bg-muted/40' : day ? 'hover:bg-muted/20' : 'opacity-50')}>
                    <td className="px-5 py-2.5 font-medium text-foreground">
                      {String(d).padStart(2,'0')} <span className="text-muted-foreground font-normal text-xs">{dow}</span>
                    </td>
                    <td className="px-3 py-2.5 text-emerald-700 font-medium">
                      {sun ? <span className="text-xs text-muted-foreground">Sun</span>
                           : day ? formatTime(day.firstIn.toISOString()) : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">
                      {!sun && day ? formatTime(day.lastOut.toISOString()) : null}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      {!sun && day ? (
                        <span className={cn('font-semibold', day.dutyHours >= 7 ? 'text-emerald-600' : day.dutyHours >= 4 ? 'text-amber-600' : 'text-orange-600')}>
                          {formatHours(day.dutyHours)}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

// ─── Summary Table ────────────────────────────────────────────────────────────

function SummaryTable({ summaries, onSelect }: { summaries: TrainerSummary[]; onSelect: (id: number) => void }) {
  if (summaries.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <ClipboardList className="mx-auto h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm">No trainer data found</p>
      </div>
    )
  }
  return (
    <div className="rounded-xl border overflow-hidden bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Trainer</th>
              <th className="text-center px-3 py-3 font-medium text-muted-foreground">Days Present</th>
              <th className="text-center px-3 py-3 font-medium text-muted-foreground">Total Hours</th>
              <th className="text-center px-3 py-3 font-medium text-muted-foreground">Avg Hours/Day</th>
              <th className="text-center px-3 py-3 font-medium text-muted-foreground w-36">Attendance %</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {summaries.map(row => (
              <tr key={row.trainer.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => onSelect(row.trainer.id)}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-cyan-100 text-[#007a99] flex items-center justify-center text-xs font-bold shrink-0">
                      {trainerInitials(row.trainer)}
                    </div>
                    <div>
                      <div className="font-medium">{trainerName(row.trainer)}</div>
                      <div className="text-xs text-muted-foreground">{row.trainer.specialization ?? row.trainer.designation ?? 'Trainer'}</div>
                    </div>
                  </div>
                </td>
                <td className="text-center px-3 py-3 font-semibold text-emerald-600">{row.presentDays}</td>
                <td className="text-center px-3 py-3 text-muted-foreground font-medium">{formatHours(row.totalHours)}</td>
                <td className="text-center px-3 py-3 text-muted-foreground">
                  {row.presentDays > 0 ? formatHours(row.totalHours / row.presentDays) : '—'}
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={cn('h-full rounded-full', row.attendancePct >= 80 ? 'bg-emerald-500' : row.attendancePct >= 60 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${row.attendancePct}%` }} />
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

function RegisterMatrix({ summaries, year, month, onSelect }: { summaries: TrainerSummary[]; year: number; month: number; onSelect: (id: number) => void }) {
  const days = daysInMonth(year, month)
  const dayNums = Array.from({ length: days }, (_, i) => i + 1)

  if (summaries.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <ClipboardList className="mx-auto h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm">No trainer data found</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border overflow-hidden bg-card">
      <div className="overflow-x-auto">
        <table className="text-xs" style={{ minWidth: `${200 + days * 36}px` }}>
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="sticky left-0 z-10 bg-muted/50 text-left px-4 py-2 font-medium text-muted-foreground min-w-[160px]">Trainer</th>
              {dayNums.map(d => {
                const sun = isSunday(year, month, d)
                return (
                  <th key={d} className={cn('text-center px-1 py-2 font-medium w-9 min-w-[36px]', sun ? 'text-muted-foreground/40' : 'text-muted-foreground')}>
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
              <tr key={row.trainer.id} className="hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => onSelect(row.trainer.id)}>
                <td className="sticky left-0 z-10 bg-background px-4 py-2 border-r">
                  <div className="font-medium leading-tight">{trainerName(row.trainer)}</div>
                  <div className="text-muted-foreground text-[10px]">{row.trainer.specialization ?? 'Trainer'}</div>
                </td>
                {dayNums.map(d => {
                  const sun = isSunday(year, month, d)
                  const dateKey = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`
                  const day = row.dayMap.get(dateKey)
                  return (
                    <td key={d} className={cn('text-center px-1 py-1.5 w-9', sun && 'bg-muted/30')}>
                      {sun ? <span className="text-muted-foreground/30">—</span> : <DayDot day={day} />}
                    </td>
                  )
                })}
                <td className="text-center px-2 py-2">
                  <span className={cn('text-xs font-semibold', row.attendancePct >= 80 ? 'text-emerald-600' : row.attendancePct >= 60 ? 'text-amber-600' : 'text-red-600')}>
                    {row.attendancePct}%
                  </span>
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
    <div className="rounded-xl bg-white/70 border border-teal-100 px-4 py-3">
      <div className="flex items-start gap-2.5">
        <div className="p-1.5 rounded-lg bg-teal-50 text-[#0096b4]">{icon}</div>
        <div className="min-w-0">
          <div className="text-2xl font-bold leading-tight text-[#1a1a2e]">{value}</div>
          <div className="text-xs text-slate-600 mt-0.5">{label}</div>
          {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
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

function downloadCSV(summaries: TrainerSummary[], month: number, year: number) {
  const monthName = MONTH_NAMES[month - 1]
  const headers = ['Name', 'Specialization', 'Days Present', 'Total Hours', 'Avg Hours/Day', 'Attendance %']
  const rows = summaries.map(r => [
    trainerName(r.trainer),
    r.trainer.specialization ?? r.trainer.designation ?? 'Trainer',
    r.presentDays,
    r.totalHours.toFixed(2),
    r.presentDays > 0 ? (r.totalHours / r.presentDays).toFixed(2) : '0',
    `${r.attendancePct}%`,
  ])
  const csv = [headers, ...rows].map(row => row.map(c => `"${c}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `trainer-attendance-${monthName}-${year}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AttendanceReportPage() {
  const now = new Date()
  const [currentDate, setCurrentDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1))
  const [view, setView] = useState<'summary' | 'register'>('summary')
  const [search, setSearch] = useState('')
  const [selectedTrainerId, setSelectedTrainerId] = useState<number | null>(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1
  const monthStr = `${year}-${String(month).padStart(2, '0')}`

  const prevMonth = useCallback(() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)), [])
  const nextMonth = useCallback(() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)), [])

  // ── Fetch all trainers ────────────────────────────────────────────────────────

  const { data: trainerData } = useQuery({
    queryKey: ['trainers', 'all'],
    queryFn: () => trainersApi.list(false),
    staleTime: 5 * 60 * 1000,
  })
  const allTrainers: TrainerProfile[] = (trainerData as any)?.trainers ?? []

  // ── Fetch punch data for each trainer ────────────────────────────────────────

  const punchQueries = allTrainers.map(t => ({
    queryKey: ['trainer-punches', t.id, monthStr],
    queryFn: () => trainersApi.getPunches(t.id, monthStr),
    staleTime: 2 * 60 * 1000,
    enabled: allTrainers.length > 0,
  }))

  // useQueries equivalent: run individual queries per trainer
  const punchResults = useQuery({
    queryKey: ['trainer-punches-all', allTrainers.map(t => t.id).join(','), monthStr],
    queryFn: async () => {
      const results = await Promise.all(allTrainers.map(t => trainersApi.getPunches(t.id, monthStr)))
      return results
    },
    enabled: allTrainers.length > 0,
    staleTime: 2 * 60 * 1000,
  })

  const loadingAttendance = punchResults.isLoading
  const allPunchData: DayPunch[][] = (punchResults.data as any) ?? []

  // ── Working days ─────────────────────────────────────────────────────────────

  const workDays = useMemo(() => workingDaysInMonth(year, month), [year, month])

  // ── Build per-trainer summaries ───────────────────────────────────────────────

  const trainerSummaries: TrainerSummary[] = useMemo(() => {
    return allTrainers.map((trainer, idx) => {
      const rawDays: DayPunch[] = allPunchData[idx] ?? []
      const dayMap = new Map<string, TrainerDay>()
      const days: TrainerDay[] = []

      for (const dp of rawDays) {
        if (!dp.punches || dp.punches.length === 0) continue
        const times = dp.punches
          .map(p => new Date(p.server_received_at ?? p.punched_at))
          .filter(t => !isNaN(t.getTime()))
          .sort((a, b) => a.getTime() - b.getTime())
        if (times.length === 0) continue
        const firstIn = times[0]
        const lastOut = times[times.length - 1]
        const dutyHours = dp.duty_hours > 0
          ? dp.duty_hours
          : times.length >= 2 ? Math.round((lastOut.getTime() - firstIn.getTime()) / 36000) / 100 : 0
        const td: TrainerDay = { date: dp.date, firstIn, lastOut, dutyHours, punchCount: dp.punches.length }
        dayMap.set(dp.date, td)
        days.push(td)
      }

      const presentDays = days.length
      const totalHours = days.reduce((s, d) => s + d.dutyHours, 0)
      const attendancePct = workDays > 0 ? Math.round((presentDays / workDays) * 100) : 0
      return { trainer, days, totalHours, presentDays, attendancePct, dayMap }
    })
  }, [allTrainers, allPunchData, workDays])

  // ── Filter ────────────────────────────────────────────────────────────────────

  const filteredSummaries = useMemo(() => {
    return trainerSummaries
      .filter(row => {
        const name = trainerName(row.trainer).toLowerCase()
        return !search || name.includes(search.toLowerCase())
      })
      .sort((a, b) => b.attendancePct - a.attendancePct)
  }, [trainerSummaries, search])

  // ── Aggregate stats ───────────────────────────────────────────────────────────

  const totalTrainers = allTrainers.length
  const avgAttendance = filteredSummaries.length > 0
    ? Math.round(filteredSummaries.reduce((s, r) => s + r.attendancePct, 0) / filteredSummaries.length)
    : 0
  const totalHours = filteredSummaries.reduce((s, r) => s + r.totalHours, 0)
  const totalPresentToday = useMemo(() => {
    const today = now.toISOString().substring(0, 10)
    return trainerSummaries.filter(r => r.dayMap.has(today)).length
  }, [trainerSummaries])

  const selectedSummary = selectedTrainerId !== null
    ? trainerSummaries.find(s => s.trainer.id === selectedTrainerId) ?? null
    : null

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── PageHeader ── */}
      <PageHeader
        section="Reports"
        title="Staff Attendance"
        icon={<ClipboardList className="h-5 w-5" />}
        subtitle={`Work-hour tracking · ${workDays} working days`}
        statLayout="grid"
        stats={[
          { label: 'Total Trainers',  value: totalTrainers,                                               sub: 'active' },
          { label: 'Avg Attendance',  value: `${avgAttendance}%`,                                         sub: MONTH_NAMES[month - 1] },
          { label: 'Total Hours',     value: totalHours > 0 ? `${Math.round(totalHours)}h` : '—',        sub: 'this month' },
          { label: 'Present Today',   value: totalPresentToday,                                           sub: 'biometric today' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="flex items-center justify-center w-8 h-8 rounded-full border border-teal-200 text-[#0096b4] hover:bg-teal-50 transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-4 py-1.5 rounded-full text-sm font-semibold text-white min-w-[150px] text-center" style={{ background: 'linear-gradient(135deg, #0096b4, #00B4D8)' }}>
              {MONTH_NAMES[month - 1]} {year}
            </span>
            <button onClick={nextMonth} className="flex items-center justify-center w-8 h-8 rounded-full border border-teal-200 text-[#0096b4] hover:bg-teal-50 transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        }
      />

      {/* ── Single toolbar row: search | legend | spacer | dept | toggle | export ── */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search */}
        <SearchInput
          placeholder="Search staff name or ID…"
          value={search}
          onChange={setSearch}
          className="w-56"
        />

        {/* Legend — tiny inline chips */}
        {/* Legend for register view */}
        {view === 'register' && (
          <div className="flex items-center gap-1 ml-1">
            <span className="text-[10px] text-muted-foreground">Legend:</span>
            {[
              { color: 'bg-emerald-500', label: '≥7h' },
              { color: 'bg-amber-400', label: '4–7h' },
              { color: 'bg-orange-400', label: '<4h' },
            ].map(l => (
              <span key={l.label} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className={cn('inline-block w-3 h-3 rounded-sm', l.color)} />
                {l.label}
              </span>
            ))}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* View toggle */}
        <div className="flex gap-0.5 p-0.5 rounded-lg bg-muted">
          <button onClick={() => setView('summary')} className={cn('flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors', view === 'summary' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            <LayoutList className="h-3 w-3" /> Summary
          </button>
          <button onClick={() => setView('register')} className={cn('flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors', view === 'register' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            <TableProperties className="h-3 w-3" /> Register
          </button>
        </div>

        {/* Export */}
        <Button size="icon" variant="outline" className="border-0 shadow-none h-7 w-7" onClick={() => downloadCSV(filteredSummaries, month, year)} disabled={filteredSummaries.length === 0} title="Export CSV">
          <Download className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* ── Result count ── */}
      {!loadingAttendance && (
        <div className="text-xs text-muted-foreground">
          Showing {filteredSummaries.length} of {totalTrainers} trainers
          {filteredSummaries.some(r => r.presentDays > 0)
            ? ` · biometric data for ${MONTH_NAMES[month - 1]} ${year}`
            : ' · No punch data yet this month'}
        </div>
      )}

      {/* ── Main content ── */}
      {loadingAttendance ? (
        <TableSkeleton />
      ) : view === 'summary' ? (
        <SummaryTable summaries={filteredSummaries} onSelect={setSelectedTrainerId} />
      ) : (
        <RegisterMatrix
          summaries={filteredSummaries}
          year={year}
          month={month}
          onSelect={setSelectedTrainerId}
        />
      )}

      {/* ── Detail drawer ── */}
      {selectedSummary && (
        <DetailDrawer
          summary={selectedSummary}
          year={year}
          month={month}
          onClose={() => setSelectedTrainerId(null)}
        />
      )}
    </div>
  )
}
