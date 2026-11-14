import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { staffApi, type Staff } from '@/api/staff.api'
import { staffAttendanceApi, type StaffAttendanceRecord, type MarkAttendanceRequest } from '@/api/staff-attendance.api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import {
  ClipboardList, ChevronLeft, ChevronRight, Check, X, Minus,
  UserCheck, UserX, Coffee, Palmtree, Calendar, Users,
} from 'lucide-react'
import { format, getDaysInMonth } from 'date-fns'
import { PageHeader } from '@/components/shared/PageHeader'

type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'leave' | 'holiday'

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
    <button
      onClick={onClick}
      className={`text-xs font-medium px-2 py-1 rounded transition-all ${
        active ? `${c.bg} ${c.cls} ring-2 ring-offset-1 ring-current` : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
      }`}
      title={c.label}
    >
      {c.short}
    </button>
  )
}

export default function StaffAttendancePage() {
  const qc = useQueryClient()
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [year, setYear] = useState(today.getFullYear())
  const [selectedDate, setSelectedDate] = useState(format(today, 'yyyy-MM-dd'))
  const [view, setView] = useState<'daily' | 'monthly'>('daily')

  const monthName = new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' })

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const { data: staffData } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffApi.list({ per_page: 500, status: 'active' }),
  })
  const allStaff: Staff[] = useMemo(() => staffData?.data ?? [], [staffData])

  // Daily view: attendance for selected date
  const { data: dailyData, isLoading: dailyLoading } = useQuery({
    queryKey: ['staff-attendance-date', selectedDate],
    queryFn: () => staffAttendanceApi.listByDate(selectedDate),
    enabled: view === 'daily',
  })

  // Monthly view: all attendance for the month
  const { data: monthlyData, isLoading: monthlyLoading } = useQuery({
    queryKey: ['staff-attendance-monthly', month, year],
    queryFn: () => staffAttendanceApi.listByMonth(month, year),
    enabled: view === 'monthly',
  })

  // Build attendance map for fast lookup
  const attendanceByStaffDate = useMemo(() => {
    const map = new Map<string, AttendanceStatus>()
    const records = view === 'daily' ? (dailyData ?? []) : (monthlyData ?? [])
    records.forEach((r: StaffAttendanceRecord) => {
      const dateKey = r.date.split('T')[0]
      map.set(`${r.staff_id}:${dateKey}`, r.status as AttendanceStatus)
    })
    return map
  }, [dailyData, monthlyData, view])

  const markMutation = useMutation({
    mutationFn: ({ staffId, req }: { staffId: number; req: MarkAttendanceRequest }) =>
      staffAttendanceApi.markAttendance(staffId, req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-attendance-date', selectedDate] })
      qc.invalidateQueries({ queryKey: ['staff-attendance-monthly', month, year] })
    },
    onError: () => toast.error('Failed to mark attendance'),
  })

  const handleMark = (staffId: number, date: string, status: AttendanceStatus) => {
    markMutation.mutate({ staffId, req: { date, status } })
  }

  // Days in month for the monthly grid
  const daysInMonth = getDaysInMonth(new Date(year, month - 1))
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  // Summary stats for the daily view
  const dailySummary = useMemo(() => {
    const records = dailyData ?? []
    return {
      present:  records.filter((r: StaffAttendanceRecord) => r.status === 'present').length,
      absent:   records.filter((r: StaffAttendanceRecord) => r.status === 'absent').length,
      halfDay:  records.filter((r: StaffAttendanceRecord) => r.status === 'half_day').length,
      leave:    records.filter((r: StaffAttendanceRecord) => r.status === 'leave').length,
      total:    allStaff.length,
    }
  }, [dailyData, allStaff])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff Attendance"
        subtitle="Track and manage daily staff attendance"
        icon={<ClipboardList className="h-5 w-5" />}
        stats={[
          { label: 'Total Staff', value: allStaff.length },
          { label: 'Present Today', value: dailySummary.present },
          { label: 'Absent',       value: dailySummary.absent  },
          { label: 'On Leave',     value: dailySummary.leave   },
        ]}
      />

      {/* ── View toggle ── */}
      <div className="flex border-b border-border">
        {(['daily', 'monthly'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px capitalize ${
              view === v
                ? 'border-[#00B4D8] text-[#007a99]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {v === 'daily' ? 'Daily' : 'Monthly'}
          </button>
        ))}
      </div>

      {/* Controls */}
      {view === 'daily' ? (
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-600">Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  max={format(today, 'yyyy-MM-dd')}
                  className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div className="flex items-center gap-4 ml-auto text-sm">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-400 inline-block" /> Present: <strong>{dailySummary.present}</strong></span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-400 inline-block" /> Absent: <strong>{dailySummary.absent}</strong></span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block" /> Half Day: <strong>{dailySummary.halfDay}</strong></span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-400 inline-block" /> Leave: <strong>{dailySummary.leave}</strong></span>
                <span className="text-slate-400">/ {dailySummary.total} total</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <button onClick={prevMonth} className="p-1.5 rounded hover:bg-slate-100"><ChevronLeft className="h-4 w-4" /></button>
              <span className="font-semibold text-slate-700 min-w-[140px] text-center">{monthName} {year}</span>
              <button onClick={nextMonth} className="p-1.5 rounded hover:bg-slate-100"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap text-xs text-slate-600">
        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
          <span key={k} className={`flex items-center gap-1 ${v.cls}`}>
            <span className={`w-5 h-5 rounded text-center font-bold text-xs flex items-center justify-center ${v.bg}`}>{v.short}</span>
            {v.label}
          </span>
        ))}
      </div>

      {/* Daily View */}
      {view === 'daily' && (
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
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                      <th className="text-left px-4 py-3 font-semibold">Employee</th>
                      <th className="text-left px-4 py-3 font-semibold">Department</th>
                      <th className="text-left px-4 py-3 font-semibold">Designation</th>
                      <th className="text-center px-4 py-3 font-semibold">Status</th>
                      <th className="text-center px-4 py-3 font-semibold">Mark</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allStaff.map(s => {
                      const key = `${s.id}:${selectedDate}`
                      const current = attendanceByStaffDate.get(key)
                      return (
                        <tr key={s.id} className="hover:bg-slate-50 transition-colors">
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
                          <td className="px-4 py-3 text-sm text-slate-600">{s.designation}</td>
                          <td className="px-4 py-3 text-center">
                            {current ? <StatusBadge status={current} /> : <span className="text-xs text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              {(['present', 'absent', 'half_day', 'leave', 'holiday'] as AttendanceStatus[]).map(st => (
                                <MarkButton
                                  key={st}
                                  status={st}
                                  active={current === st}
                                  onClick={() => handleMark(s.id, selectedDate, st)}
                                />
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
      )}

      {/* Monthly View */}
      {view === 'monthly' && (
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
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-4 py-3 font-semibold text-slate-500 uppercase tracking-wide min-w-[180px]">Staff</th>
                      {days.map(d => {
                        const date = new Date(year, month - 1, d)
                        const isSun = date.getDay() === 0
                        return (
                          <th key={d} className={`text-center px-1 py-3 font-semibold w-9 ${isSun ? 'text-red-400 bg-red-50' : 'text-slate-400'}`}>
                            {d}
                          </th>
                        )
                      })}
                      <th className="text-center px-3 py-3 font-semibold text-slate-500 uppercase tracking-wide min-w-[80px]">P/WD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {allStaff.map(s => {
                      let presentCount = 0
                      let halfDayCount = 0
                      return (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2">
                            <div className="font-medium text-slate-900 truncate max-w-[160px]">{s.first_name} {s.last_name}</div>
                            <div className="text-slate-400">{s.employee_id}</div>
                          </td>
                          {days.map(d => {
                            const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`
                            const st = attendanceByStaffDate.get(`${s.id}:${dateStr}`) as AttendanceStatus | undefined
                            const isSun = new Date(year, month - 1, d).getDay() === 0
                            if (st === 'present') presentCount++
                            if (st === 'half_day') halfDayCount++
                            const cfg = st ? STATUS_CONFIG[st] : null
                            return (
                              <td key={d} className={`text-center px-0.5 py-1 ${isSun ? 'bg-red-50' : ''}`}>
                                {cfg ? (
                                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold ${cfg.bg} ${cfg.cls}`}>
                                    {cfg.short}
                                  </span>
                                ) : (
                                  <span className={`inline-block w-6 h-6 rounded ${isSun ? 'bg-red-50' : 'bg-transparent'}`} />
                                )}
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
      )}
    </div>
  )
}
