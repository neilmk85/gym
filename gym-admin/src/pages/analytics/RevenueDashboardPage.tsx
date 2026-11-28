import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { TrendingUp, CreditCard, ArrowDownRight, DollarSign } from 'lucide-react'
import { reportsApi } from '@/api/reports.api'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/PageHeader'
import { formatCurrency } from '@/lib/utils'

function getDefaultDates(daysBack = 30) {
  const to   = new Date()
  const from = new Date()
  from.setDate(from.getDate() - daysBack)
  return { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] }
}

const COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899']
const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash', upi: 'UPI', card: 'Card',
  bank_transfer: 'Bank', cheque: 'Cheque', other: 'Other',
}

const RANGE_OPTIONS = [
  { label: '7 days',  days: 7  },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
]

export default function RevenueDashboardPage() {
  const [range, setRange] = useState(30)
  const { from, to } = getDefaultDates(range)

  const { data: rev, isLoading: revLoading } = useQuery({
    queryKey: ['analytics-revenue', range],
    queryFn: () => reportsApi.revenue({ from, to }),
  })
  const { data: subs, isLoading: subsLoading } = useQuery({
    queryKey: ['analytics-subs'],
    queryFn: () => reportsApi.subscriptions(),
  })

  const isLoading = revLoading || subsLoading

  const statCards = [
    { label: 'Total Revenue',    value: formatCurrency(rev?.total_revenue  ?? 0), icon: <TrendingUp className="h-5 w-5" />,      color: '#10b981' },
    { label: 'Net Revenue',      value: formatCurrency(rev?.net_revenue    ?? 0), icon: <DollarSign className="h-5 w-5" />,      color: '#0ea5e9' },
    { label: 'Total Refunds',    value: formatCurrency(rev?.total_refunds  ?? 0), icon: <ArrowDownRight className="h-5 w-5" />,  color: '#ef4444' },
    { label: 'Transactions',     value: rev?.transaction_count ?? 0,              icon: <CreditCard className="h-5 w-5" />,      color: '#8b5cf6' },
  ]

  const byMethod = (rev?.by_method ?? []).map(m => ({
    ...m, name: METHOD_LABELS[m.method] ?? m.method,
  }))

  const byPlan = (subs?.by_plan ?? []).map(p => ({
    name: p.plan_name, count: p.count,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revenue Dashboard"
        subtitle="Monthly trends and plan-wise breakdown"
        icon={<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}><TrendingUp className="h-5 w-5" /></div>}
        actions={
          <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
            {RANGE_OPTIONS.map(o => (
              <button key={o.days} onClick={() => setRange(o.days)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${range === o.days ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
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
                <p className="text-xl font-bold text-slate-800">{isLoading ? '…' : s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by day */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-5">Daily Revenue</h3>
            {isLoading
              ? <div className="h-56 flex items-center justify-center text-slate-400">Loading…</div>
              : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={rev?.by_day ?? []} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => [formatCurrency(v), 'Revenue']} />
                    <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )
            }
          </CardContent>
        </Card>

        {/* Revenue by payment method */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-5">By Payment Method</h3>
            {isLoading
              ? <div className="h-56 flex items-center justify-center text-slate-400">Loading…</div>
              : byMethod.length === 0
                ? <div className="h-56 flex items-center justify-center text-slate-400">No data</div>
                : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={byMethod} dataKey="amount" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {byMethod.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                )
            }
          </CardContent>
        </Card>
      </div>

      {/* Plan-wise breakdown */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-5">Active Subscriptions by Plan</h3>
          {isLoading
            ? <div className="h-56 flex items-center justify-center text-slate-400">Loading…</div>
            : byPlan.length === 0
              ? <div className="h-56 flex items-center justify-center text-slate-400">No data</div>
              : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={byPlan} layout="vertical" margin={{ top: 4, right: 40, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                    <Tooltip formatter={(v: number) => [v, 'Members']} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {byPlan.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
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
