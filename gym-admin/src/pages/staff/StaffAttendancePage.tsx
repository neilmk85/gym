import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { staffApi, type Staff } from '@/api/staff.api'
import { staffAttendanceApi, type StaffAttendanceRecord, type MarkAttendanceRequest, type AttendanceSummaryRow } from '@/api/staff-attendance.api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import {
  ClipboardList, ChevronLeft, ChevronRight, UserCheck, UserX,
  Coffee, Palmtree, Calendar, Users, TrendingUp, Clock, CheckCircle2, XCircle, AlertCircle,
} from 'lucide-react'
import { format, getDaysInMonth, startOfMonth } from 'date-fns'
import { PageHeader } from '@/components/shared/PageHeader'

type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'leave' | 'holiday'
type MainTab = 'summary' | 'daily' | 'monthly'
type SummaryTab = 'trainer' | 'staff'

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; short: string; cls: string; bg: string; icon: React.ElementType }> = {
  present:  { label: 'Present',  short: 'P',  cls: 'text-green-700',  bg: 'bg-green-100',  icon: UserCheck  },
  absent:   { label: 'Absent',   short: 'A',  cls: 'text-red-700',    bg: 'bg-red-100',    icon: UserX      },
  half_day: { label: 'Half Day', short: 'H',  cls: 'text-amber-700',  bg: 'bg-amber-100',  icon: Coffee     },
  leave:    { label: 'Leave',    short: 'L',  cls: 'text-blue-700',   bg: 'bg-blue-100',   icon: Palmtree   },
  holiday:  { label: 'Holiday',  short: 'Ho', cls: 'text-purple-700', bg: 'bg-purple-100', icon: Calendar   },
}

function StatusBadge({ status }: { status: AttendanceStatus }) {
  const c = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${c.bg} ${c.cls}`}>
      {c.short}
    </span>
  )
}

function MarkButton({ status, active, onClick }: { status: AttendanceStatus; active: boolean; onClick: () => void }) {
  const c = STATUS_CONFIG[status]
  return (
    <button onClick={onClick}
      className={`text-xs font-medium px-2 py-1 rounded transition-all ${
        active ? `${c.bg} ${c.cls} ring-2 ring-offset-1 ring-current` : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
      }`} title={c.label}>
      {c.short}
    </button>
  )
}

function PctBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? 'bg-green-500' : pct >= 75 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className={`text-xs font-semibold w-10 text-right ${pct >= 90 ? 'text-green-700' : pct >= 75 ? 'text-amber-700' : 'text-red-600'}`}>
        {pct.toFixed(0)}%
      </span>
    </div>
  )
}

function SummaryTable({ rows, type }: { rows: AttendanceSummaryRow[]; type: SummaryTab }) {
  if (rows.length === 0) return (
    <div className="p-10 text-center text-slate-400 text-sm">No {type === 'trainer' ? 'trainers' : 'non-trainer staff'} found.</div>
  )
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-sidebar">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-light uppercase tracking-wide text-sidebar-foreground">Name</th>
            <th className="text-center px-4 py-3 text-xs font-light uppercase tracking-wide text-sidebar-foreground">Expected Days</th>
            <th className="text-center px-4 py-3 text-xs font-light uppercase tracking-wide text-sidebar-foreground">Present</th>
            <th className="text-center px-4 py-3 text-xs font-light uppercase tracking-wide text-sidebar-foreground">Absent</th>
            <th className="text-center px-4 py-3 text-xs font-light uppercase tracking-wide text-sidebar-foreground">Hours Worked</th>
            <th className="text-center px-4 py-3 text-xs font-light uppercase tracking-wide text-sidebar-foreground">Expected Hrs</th>
            <th className="px-4 py-3 text-xs font-light uppercase tracking-wide text-sidebar-foreground min-w-[140px]">Attendance</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map(r => (
            <tr key={r.staff_id} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {r.first_name[0]}{r.last_name[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-slate-900">{r.first_name} {r.last_name}</span>
                      {r.schedule_fallback && type === 'trainer' && (
                        <span title="No shift schedule set — using Mon–Sat default">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400">{r.employee_id}</div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-center font-semibold text-slate-700">{r.expected_days}</td>
              <td className="px-4 py-3 text-center">
                <span className="inline-flex items-center gap-1 font-semibold text-green-700">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {r.present_days % 1 === 0 ? r.present_days : r.present_days.toFixed(1)}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className="inline-flex items-center gap-1 font-semibold text-red-600">
                  <XCircle className="w-3.5 h-3.5" />
                  {r.absent_days}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className="font-semibold text-slate-700">
                  {type === 'trainer'
                    ? `${r.hours_worked.toFixed(1)}h`
                    : `~${r.hours_worked.toFixed(0)}h`}
                </span>
                {type === 'staff' && <span className="text-xs text-slate-400 ml-1">(est.)</span>}
              </td>
              <td className="px-4 py-3 text-center text-slate-500">{r.expected_hours.toFixed(0)}h</td>
              <td className="px-4 py-3"><PctBar pct={r.attendance_pct} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px capitalize ${
        active ? 'border-[#00B4D8] text-[#007a99]' : 'border-transparent text-slate-500 hover:text-slate-700'
      }`}>
      {children}
    </button>
  )
}

export default function StaffAttendancePage() {
  const qc = useQueryClient()
  const today = new Date()
  const [mainTab, setMainTab] = useState<MainTab>('summary')
  const [summaryTab, setSummaryTab] = useState<SummaryTab>('trainer')
  const [standardHours, setStandardHours] = useState(9)

  // Summary date range — default current month
  const [sumFrom, setSumFrom] = useState(format(startOfMonth(today), 'yyyy-MM-dd'))
  const [sumTo,   setSumTo]   = useState(format(today, 'yyyy-MM-dd'))

  // Daily/Monthly state
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [year, setYear]   = useState(today.getFullYear())
  const [selectedDate, setSelectedDate] = useState(format(today, 'yyyy-MM-dd'))
  const monthName = new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' })
  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 12) { setMonth(1);  setYear(y => y + 1) } else setMonth(m => m + 1) }

  // ── Summary queries ───────────────────────────────────────────────────────
  const { data: trainerSummary, isFetching: trainerFetching } = useQuery({
    queryKey: ['staff-attendance-summary', 'trainer', sumFrom, sumTo, standardHours],
    queryFn: () => staffAttendanceApi.attendanceSummary(sumFrom, sumTo, 'trainer', standardHours),
    enabled: mainTab === 'summary',
  })
  const { data: staffSummary, isFetching: staffFetching } = useQuery({
    queryKey: ['staff-attendance-summary', 'staff', sumFrom, sumTo, standardHours],
    queryFn: () => staffAttendanceApi.attendanceSummary(sumFrom, sumTo, 'staff', standardHours),
    enabled: mainTab === 'summary',
  })

  // ── Daily / Monthly queries ───────────────────────────────────────────────
  const { data: staffData } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffApi.list({ per_page: 500, status: 'active' }),
  })
  const allStaff: Staff[] = useMemo(() => staffData?.data ?? [], [staffData])

  const { data: dailyData, isLoading: dailyLoading } = useQuery({
    queryKey: ['staff-attendance-date', selectedDate],
    queryFn: () => staffAttendanceApi.listByDate(selectedDate),
    enabled: mainTab === 'daily',
  })
  const { data: monthlyData, isLoading: monthlyLoading } = useQuery({
    queryKey: ['staff-attendance-monthly', month, year],
    queryFn: () => staffAttendanceApi.listByMonth(month, year),
    enabled: mainTab === 'monthly',
  })

  const attendanceByStaffDate = useMemo(() => {
    const map = new Map<string, AttendanceStatus>()
    const records = mainTab === 'daily' ? (dailyData ?? []) : (monthlyData ?? [])
    records.forEach((r: StaffAttendanceRecord) => {
      const dateKey = r.date.split('T')[0]
      map.set(`${r.staff_id}:${dateKey}`, r.status as AttendanceStatus)
    })
    return map
  }, [dailyData, monthlyData, mainTab])

  const markMutation = useMutation({
    mutationFn: ({ staffId, req }: { staffId: number; req: MarkAttendanceRequest }) =>
      staffAttendanceApi.markAttendance(staffId, req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-attendance-date', selectedDate] })
      qc.invalidateQueries({ queryKey: ['staff-attendance-monthly', month, year] })
    },
    onError: () => toast.error('Failed to mark attendance'),
  })

  const dailySummary = useMemo(() => {
    const records = dailyData ?? []
    return {
      present: records.filter((r: StaffAttendanceRecord) => r.status === 'present').length,
      absent:  records.filter((r: StaffAttendanceRecord) => r.status === 'absent').length,
      halfDay: records.filter((r: StaffAttendanceRecord) => r.status === 'half_day').length,
      leave:   records.filter((r: StaffAttendanceRecord) => r.status === 'leave').length,
      total:   allStaff.length,
    }
  }, [dailyData, allStaff])

  const daysInMonth = getDaysInMonth(new Date(year, month - 1))
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  // Summary meta
  const activeSummary = summaryTab === 'trainer' ? trainerSummary : staffSummary
  const summaryFetching = summaryTab === 'trainer' ? trainerFetching : staffFetching
  const summaryRows: AttendanceSummaryRow[] = activeSummary?.rows ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff Attendance"
        section="Staff"
        subtitle="Fallback manual attendance — primary source is biometric"
        icon={<ClipboardList className="h-5 w-5" />}
        statLayout="grid"
        stats={[
          { label: 'Total Staff',    value: allStaff.length },
          { label: 'Present Today',  value: dailySummary.present },
          { label: 'Absent',         value: dailySummary.absent  },
          { label: 'On Leave',       value: dailySummary.leave   },
        ]}
      />

      {/* ── Main tabs ── */}
      <div className="flex border-b border-border">
        <TabBtn active={mainTab === 'summary'} onClick={() => setMainTab('summary')}>
          <span className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Summary</span>
        </TabBtn>
        <TabBtn active={mainTab === 'daily'}   onClick={() => setMainTab('daily')}>Daily Mark</TabBtn>
        <TabBtn active={mainTab === 'monthly'} onClick={() => setMainTab('monthly')}>Monthly Grid</TabBtn>
      </div>

      {/* ══════════════════════════════ SUMMARY TAB ══════════════════════════════ */}
      {mainTab === 'summary' && (
        <div className="space-y-5">
          {/* Controls */}
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-slate-600">From</label>
                  <input type="date" value={sumFrom} onChange={e => setSumFrom(e.target.value)}
                    max={sumTo}
                    className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-slate-600">To</label>
                  <input type="date" value={sumTo} onChange={e => setSumTo(e.target.value)}
                    min={sumFrom} max={format(today, 'yyyy-MM-dd')}
                    className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <label className="text-sm font-medium text-slate-600">Standard hours/day</label>
                  <select value={standardHours} onChange={e => setStandardHours(Number(e.target.value))}
                    className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                    {[6,7,8,9,10,12].map(h => <option key={h} value={h}>{h}h</option>)}
                  </select>
                </div>
                {activeSummary && (
                  <div className="text-xs text-slate-400">
                    {activeSummary.expected_days} working days · {activeSummary.expected_hours}h expected
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Sub-tabs */}
          <div className="flex gap-1 p-1 bg-slate-100 rounded-lg w-fit">
            {(['trainer', 'staff'] as SummaryTab[]).map(t => (
              <button key={t} onClick={() => setSummaryTab(t)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  summaryTab === t
                    ? 'bg-white shadow-sm text-slate-900'
                    : 'text-slate-500 hover:text-slate-700'
                }`}>
                {t === 'trainer' ? '🏋️ Trainers' : '👥 Non-Trainers'}
              </button>
            ))}
          </div>

          {/* Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-teal-600" />
                {summaryTab === 'trainer' ? 'Trainer' : 'Non-Trainer Staff'} Attendance
                <span className="text-xs font-normal text-slate-400 ml-1">
                  {sumFrom} → {sumTo}
                  {summaryTab === 'trainer' && <span className="ml-2 text-indigo-500">· Hours from biometric · Expected from shift schedule</span>}
                  {summaryTab === 'staff'   && <span className="ml-2 text-amber-500">· Hours estimated ({standardHours}h/day)</span>}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {summaryFetching ? (
                <div className="p-10 text-center text-slate-400">Loading…</div>
              ) : (
                <SummaryTable rows={summaryRows} type={summaryTab} />
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════ DAILY TAB ══════════════════════════════ */}
      {mainTab === 'daily' && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-slate-600">Date</label>
                  <input type="date" value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    max={format(today, 'yyyy-MM-dd')}
                    className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div className="flex items-center gap-4 ml-auto text-sm">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-400 inline-block" /> Present: <strong>{dailySummary.present}</strong></span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-400   inline-block" /> Absent:  <strong>{dailySummary.absent}</strong></span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block" /> Half Day:<strong>{dailySummary.halfDay}</strong></span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-400  inline-block" /> Leave:   <strong>{dailySummary.leave}</strong></span>
                  <span className="text-slate-400">/ {dailySummary.total} total</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-3 flex-wrap text-xs text-slate-600">
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <span key={k} className={`flex items-center gap-1 ${v.cls}`}>
                <span className={`w-5 h-5 rounded text-center font-bold text-xs flex items-center justify-center ${v.bg}`}>{v.short}</span>
                {v.label}
              </span>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-teal-600" />
                Staff for {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {dailyLoading ? (
                <div className="p-8 text-center text-slate-400">Loading...</div>
              ) : allStaff.length === 0 ? (
                <div className="p-8 text-center text-slate-400">No active staff found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-sidebar">
                      <tr>
                        <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Employee</th>
                        <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Department</th>
                        <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Role</th>
                        <th className="text-center px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Status</th>
                        <th className="text-center px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Mark</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {allStaff.map(s => {
                        const key = `${s.id}:${selectedDate}`
                        const current = attendanceByStaffDate.get(key)
                        return (
                          <tr key={s.id}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white text-xs font-bold">
                                  {s.first_name[0]}{s.last_name[0]}
                                </div>
                                <div>
                                  <div className="font-medium text-slate-900">{s.first_name} {s.last_name}</div>
                                  <div className="text-xs text-slate-400">{s.employee_id}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600">{s.department}</td>
                            <td className="px-4 py-3 text-sm text-slate-600 capitalize">{s.role}</td>
                            <td className="px-4 py-3 text-center">
                              {current ? <StatusBadge status={current} /> : <span className="text-xs text-slate-300">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-1">
                                {(['present', 'absent', 'half_day', 'leave', 'holiday'] as AttendanceStatus[]).map(st => (
                                  <MarkButton key={st} status={st} active={current === st}
                                    onClick={() => markMutation.mutate({ staffId: s.id, req: { date: selectedDate, status: st } })} />
                                ))}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════ MONTHLY TAB ══════════════════════════════ */}
      {mainTab === 'monthly' && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <button onClick={prevMonth} className="p-1.5 rounded hover:bg-slate-100"><ChevronLeft className="h-4 w-4" /></button>
                <span className="font-semibold text-slate-700 min-w-[140px] text-center">{monthName} {year}</span>
                <button onClick={nextMonth} className="p-1.5 rounded hover:bg-slate-100"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-3 flex-wrap text-xs text-slate-600">
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <span key={k} className={`flex items-center gap-1 ${v.cls}`}>
                <span className={`w-5 h-5 rounded text-center font-bold text-xs flex items-center justify-center ${v.bg}`}>{v.short}</span>
                {v.label}
              </span>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">{monthName} {year} — Monthly Overview</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {monthlyLoading ? (
                <div className="p-8 text-center text-slate-400">Loading...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-sidebar">
                      <tr>
                        <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide min-w-[180px]">Staff</th>
                        {days.map(d => {
                          const isSun = new Date(year, month - 1, d).getDay() === 0
                          return (
                            <th key={d} className={`text-center px-1 py-3 font-light text-sidebar-foreground text-xs w-9 ${isSun ? 'text-red-400 bg-red-50' : ''}`}>
                              {d}
                            </th>
                          )
                        })}
                        <th className="text-center px-3 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide min-w-[80px]">P/WD</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {allStaff.map(s => {
                        let presentCount = 0, halfDayCount = 0
                        return (
                          <tr key={s.id}>
                            <td className="px-4 py-2">
                              <div className="font-medium text-slate-900 truncate max-w-[160px]">{s.first_name} {s.last_name}</div>
                              <div className="text-slate-400">{s.employee_id}</div>
                            </td>
                            {days.map(d => {
                              const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`
                              const st = attendanceByStaffDate.get(`${s.id}:${dateStr}`) as AttendanceStatus | undefined
                              const isSun = new Date(year, month - 1, d).getDay() === 0
                              if (st === 'present')  presentCount++
                              if (st === 'half_day') halfDayCount++
                              const cfg = st ? STATUS_CONFIG[st] : null
                              return (
                                <td key={d} className={`text-center px-0.5 py-1 ${isSun ? 'bg-red-50' : ''}`}>
                                  {cfg ? (
                                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold ${cfg.bg} ${cfg.cls}`}>
                                      {cfg.short}
                                    </span>
                                  ) : <span className={`inline-block w-6 h-6 rounded ${isSun ? 'bg-red-50' : 'bg-transparent'}`} />}
                                </td>
                              )
                            })}
                            <td className="text-center px-3 py-2 font-semibold text-slate-700">
                              {presentCount + Math.round(halfDayCount * 0.5)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
