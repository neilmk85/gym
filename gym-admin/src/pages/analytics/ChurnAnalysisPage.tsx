import { useQuery } from '@tanstack/react-query'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { TrendingDown, Users, UserX, UserCheck, RefreshCw } from 'lucide-react'
import { reportsApi } from '@/api/reports.api'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#94a3b8', '#8b5cf6']

export default function ChurnAnalysisPage() {
  const { data: members,    isLoading: mLoading } = useQuery({ queryKey: ['analytics-members'],       queryFn: () => reportsApi.members() })
  const { data: subs,       isLoading: sLoading } = useQuery({ queryKey: ['analytics-subs-churn'],    queryFn: () => reportsApi.subscriptions() })
  const { data: inactive30, isLoading: i30Loading } = useQuery({ queryKey: ['analytics-inactive-30'], queryFn: () => reportsApi.inactive(30) })
  const { data: inactive90, isLoading: i90Loading } = useQuery({ queryKey: ['analytics-inactive-90'], queryFn: () => reportsApi.inactive(90) })

  const isLoading = mLoading || sLoading || i30Loading || i90Loading

  const total      = members?.total_members    ?? 0
  const active     = members?.active_members   ?? 0
  const cancelled  = members?.cancelled_members ?? 0
  const expired    = members?.expired_members   ?? 0
  const paused     = members?.paused_members    ?? 0

  const churnRate  = total > 0 ? ((cancelled + expired) / total * 100).toFixed(1) : '0'
  const retainRate = total > 0 ? (active / total * 100).toFixed(1) : '0'

  const statusData = [
    { name: 'Active',    value: active,    color: '#10b981' },
    { name: 'Expired',   value: expired,   color: '#ef4444' },
    { name: 'Paused',    value: paused,    color: '#f59e0b' },
    { name: 'Cancelled', value: cancelled, color: '#94a3b8' },
  ].filter(d => d.value > 0)

  const growthData = (members?.growth_by_month ?? []).slice(-6).map(g => ({
    month: g.month.slice(0, 7), new: g.new,
  }))

  const statCards = [
    { label: 'Churn Rate',       value: `${churnRate}%`,  icon: <TrendingDown className="h-5 w-5" />,  color: '#ef4444', sub: 'cancelled + expired' },
    { label: 'Retention Rate',   value: `${retainRate}%`, icon: <UserCheck className="h-5 w-5" />,     color: '#10b981', sub: 'currently active' },
    { label: 'Inactive (30d)',   value: inactive30?.count ?? 0, icon: <UserX className="h-5 w-5" />,   color: '#f59e0b', sub: 'no visit in 30 days' },
    { label: 'Inactive (90d)',   value: inactive90?.count ?? 0, icon: <RefreshCw className="h-5 w-5" />, color: '#8b5cf6', sub: 'no visit in 90 days' },
  ]

  const inactiveAtRisk = (inactive30?.members ?? []).slice(0, 10)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Churn Analysis"
        subtitle="Dropout rate, inactive members and retention trends"
        icon={<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}><TrendingDown className="h-5 w-5" /></div>}
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
                <p className="text-[10px] text-slate-400">{s.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Membership status pie */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-5">Membership Status Breakdown</h3>
            {isLoading
              ? <div className="h-56 flex items-center justify-center text-slate-400">Loading…</div>
              : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {statusData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number, name: string) => [v, name]} />
                  </PieChart>
                </ResponsiveContainer>
              )
            }
          </CardContent>
        </Card>

        {/* New members per month */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-5">New Members per Month</h3>
            {isLoading
              ? <div className="h-56 flex items-center justify-center text-slate-400">Loading…</div>
              : growthData.length === 0
                ? <div className="h-56 flex items-center justify-center text-slate-400">No data</div>
                : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={growthData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => [v, 'New Members']} />
                      <Bar dataKey="new" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )
            }
          </CardContent>
        </Card>
      </div>

      {/* At-risk members */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-5">
            <UserX className="h-4 w-4 text-red-500" />
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">At-Risk Members</h3>
            <span className="ml-auto text-xs text-slate-400">Inactive for 30+ days</span>
          </div>
          {isLoading
            ? <div className="py-8 text-center text-slate-400">Loading…</div>
            : inactiveAtRisk.length === 0
              ? <div className="py-8 text-center text-slate-400">No at-risk members</div>
              : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Member</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Code</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Last Visit</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Days Inactive</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inactiveAtRisk.map(m => (
                      <tr key={m.member_id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-800">{m.name}</td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-xs">{m.member_code}</td>
                        <td className="px-4 py-3"><Badge className="capitalize bg-slate-100 text-slate-600">{m.status}</Badge></td>
                        <td className="px-4 py-3 text-slate-600">{m.last_visit ? formatDate(m.last_visit) : 'Never'}</td>
                        <td className="px-4 py-3">
                          <Badge className={`${(m.days_since_visit ?? 0) > 60 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                            {m.days_since_visit ?? '—'}d
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
          }
        </CardContent>
      </Card>
    </div>
  )
}
