import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Cell,
} from 'recharts'
import { Activity, Users, Clock, TrendingUp, Calendar } from 'lucide-react'
import { reportsApi } from '@/api/reports.api'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/PageHeader'
import { formatDate } from '@/lib/utils'

function getDefaultDates(daysBack = 30) {
  const to   = new Date()
  const from = new Date()
  from.setDate(from.getDate() - daysBack)
  return { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] }
}

function fmtHour(h: number) {
  if (h === 0)  return '12am'
  if (h < 12)   return `${h}am`
  if (h === 12) return '12pm'
  return `${h - 12}pm`
}

const HEAT_MAX_COLOR = '#0ea5e9'
const HEAT_MIN_COLOR = '#e0f7ff'

function heatColor(val: number, max: number) {
  if (max === 0) return HEAT_MIN_COLOR
  const t = val / max
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * t)
  const minRgb = [224, 247, 255]
  const maxRgb = [14, 165, 233]
  return `rgb(${lerp(minRgb[0], maxRgb[0])},${lerp(minRgb[1], maxRgb[1])},${lerp(minRgb[2], maxRgb[2])})`
}

const RANGE_OPTIONS = [
  { label: '7 days',  days: 7  },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
]

export default function AttendanceDashboardPage() {
  const [range, setRange] = useState(30)
  const { from, to } = getDefaultDates(range)

  const { data, isLoading } = useQuery({
    queryKey: ['analytics-attendance', range],
    queryFn: () => reportsApi.attendance({ from, to }),
  })

  const byDay  = data?.by_day  ?? []
  const byHour = data?.by_hour ?? []
  const maxHourCount = Math.max(1, ...byHour.map(h => h.count))

  const statCards = [
    { label: 'Total Check-ins',     value: data?.total_check_ins    ?? 0, icon: <Activity className="h-5 w-5" />, color: '#0ea5e9' },
    { label: 'Unique Members',      value: data?.unique_members     ?? 0, icon: <Users className="h-5 w-5" />,    color: '#8b5cf6' },
    { label: 'Avg Daily Check-ins', value: (data?.avg_daily_check_ins ?? 0).toFixed(1), icon: <TrendingUp className="h-5 w-5" />, color: '#10b981' },
    { label: 'Peak Hour',           value: data?.peak_hour != null ? fmtHour(data.peak_hour) : '—', icon: <Clock className="h-5 w-5" />, color: '#f59e0b' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance Dashboard"
        subtitle="Daily check-ins and peak hour analysis"
        icon={<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm" style={{ background: 'linear-gradient(135deg, #0ea5e9, #0284c7)' }}><Activity className="h-5 w-5" /></div>}
        actions={
          <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
            {RANGE_OPTIONS.map(o => (
              <button key={o.days} onClick={() => setRange(o.days)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${range === o.days ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {o.label}
              </button>
            ))}
          </div>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(s => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 text-white" style={{ background: s.color }}>
                {s.icon}
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">{s.label}</p>
                <p className="text-2xl font-bold text-slate-800">{isLoading ? '…' : s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Daily check-ins line chart */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-5">
            <Calendar className="h-4 w-4 text-sky-500" />
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Daily Check-ins</h3>
          </div>
          {isLoading
            ? <div className="h-56 flex items-center justify-center text-slate-400">Loading…</div>
            : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={byDay} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => [v, 'Check-ins']} labelFormatter={d => formatDate(d)} />
                  <Line type="monotone" dataKey="count" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )
          }
        </CardContent>
      </Card>

      {/* Peak hours heatmap */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-5">
            <Clock className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Peak Hours Heatmap</h3>
            <span className="ml-auto text-xs text-slate-400">Darker = more check-ins</span>
          </div>
          {isLoading
            ? <div className="h-24 flex items-center justify-center text-slate-400">Loading…</div>
            : (
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(12, 1fr)' }}>
                {Array.from({ length: 24 }, (_, h) => {
                  const row = byHour.find(r => r.hour === h)
                  const count = row?.count ?? 0
                  return (
                    <div key={h} title={`${fmtHour(h)}: ${count} check-ins`}
                      className="rounded-lg flex flex-col items-center gap-1 py-3 cursor-default transition-transform hover:scale-105"
                      style={{ background: heatColor(count, maxHourCount) }}>
                      <span className="text-[10px] font-bold text-slate-600">{fmtHour(h)}</span>
                      <span className="text-xs font-semibold text-slate-700">{count}</span>
                    </div>
                  )
                })}
              </div>
            )
          }
        </CardContent>
      </Card>

      {/* Bar chart by hour */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-5">
            <Activity className="h-4 w-4 text-sky-500" />
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Check-ins by Hour</h3>
          </div>
          {isLoading
            ? <div className="h-56 flex items-center justify-center text-slate-400">Loading…</div>
            : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byHour} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickFormatter={fmtHour} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => [v, 'Check-ins']} labelFormatter={h => fmtHour(Number(h))} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {byHour.map((entry, i) => (
                      <Cell key={i} fill={heatColor(entry.count, maxHourCount)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </CardContent>
      </Card>
    </div>
  )
}
