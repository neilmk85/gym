import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import {
  TrendingUp, Users, Activity, CreditCard, AlertTriangle,
  Calendar, DollarSign, UserCheck, UserX, Clock, Zap,
  BarChart2, RefreshCw, Phone, Mail, ChevronLeft, ChevronRight,
  LayoutList, LineChart, Dumbbell, Star, Award, CheckCircle2,
} from 'lucide-react'
import { reportsApi, type TrainerStat, type InactiveMember } from '@/api/reports.api'
import { paymentsApi } from '@/api/payments.api'
import { membersApi } from '@/api/members.api'
import { attendanceApi } from '@/api/attendance.api'
import { subscriptionsApi } from '@/api/subscriptions.api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { CSVExportButton } from '@/components/shared/CSVExportButton'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import type { Payment } from '@/types/payment.types'
import type { Member } from '@/types/member.types'
import type { AttendanceRecord } from '@/types/attendance.types'
import type { Subscription } from '@/types/subscription.types'

// ─── Theme ───────────────────────────────────────────────────────────────────

const CHART_COLORS = {
  revenue:    ['#027DFD', '#60a5fa', '#93c5fd', '#bfdbfe'],
  members:    ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe'],
  attendance: ['#f59e0b', '#fbbf24', '#fcd34d', '#fde68a'],
  gender:     ['#027DFD', '#ec4899', '#94a3b8'],
  plans:      ['#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe'],
}

const PER_PAGE = 15

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDefaultDates(daysBack = 30) {
  const to   = new Date()
  const from = new Date()
  from.setDate(from.getDate() - daysBack)
  return {
    from: from.toISOString().split('T')[0],
    to:   to.toISOString().split('T')[0],
  }
}

function fmtHour(h: number) {
  if (h === 0)  return '12am'
  if (h < 12)   return `${h}am`
  if (h === 12) return '12pm'
  return `${h - 12}pm`
}

function fmtMonthLabel(m: string) {
  const [y, mo] = m.split('-')
  return new Date(+y, +mo - 1).toLocaleString('default', { month: 'short', year: '2-digit' })
}

function fmtDayLabel(d: string) {
  return new Date(d).toLocaleDateString('default', { month: 'short', day: 'numeric' })
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : s
}

function memberName(member?: { user?: { first_name?: string; last_name?: string } } | null) {
  if (!member?.user) return '—'
  return `${member.user.first_name ?? ''} ${member.user.last_name ?? ''}`.trim() || '—'
}

// ─── Sub-tab toggle ───────────────────────────────────────────────────────────

type SubTab = 'summary' | 'transactions'

function SubTabBar({ active, onChange }: { active: SubTab; onChange: (v: SubTab) => void }) {
  return (
    <div className="flex gap-1 mb-6 p-1 bg-muted rounded-xl w-fit">
      {([
        { id: 'summary',      label: 'Summary',      icon: <LineChart className="h-3.5 w-3.5" /> },
        { id: 'transactions', label: 'Transactions',  icon: <LayoutList className="h-3.5 w-3.5" /> },
      ] as { id: SubTab; label: string; icon: React.ReactNode }[]).map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
            active === t.id
              ? 'bg-white text-sky-700 shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ─── Shared components ────────────────────────────────────────────────────────

interface KpiCardProps {
  label:    string
  value:    string | number
  sub?:     string
  icon:     React.ReactNode
  color?:   string
  loading?: boolean
}
function KpiCard({ label, value, sub, icon, color = 'bg-sky-50', loading }: KpiCardProps) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        {loading ? (
          <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-7 w-16" /></div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
              <p className="text-2xl font-bold mt-1 text-foreground">{value}</p>
              {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
            </div>
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>{icon}</div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface SectionCardProps {
  title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode
}
function SectionCard({ title, subtitle, children, action }: SectionCardProps) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-semibold text-base">{title}</h3>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

function DateRangePicker({ from, to, onFromChange, onToChange }: {
  from: string; to: string
  onFromChange: (v: string) => void; onToChange: (v: string) => void
}) {
  return (
    <Card className="border-0 shadow-sm mb-6">
      <CardContent className="p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => onFromChange(e.target.value)} className="w-40 h-9" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => onToChange(e.target.value)} className="w-40 h-9" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between pt-4 border-t mt-2">
      <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
      <div className="flex gap-1">
        <Button size="sm" variant="outline" className="h-8 w-8 p-0" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" className="h-8 w-8 p-0" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={cn('text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted/40 first:rounded-tl-lg last:rounded-tr-lg', className)}>
      {children}
    </th>
  )
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn('px-3 py-2.5 text-sm', className)}>{children}</td>
}
function TableSkeleton({ cols, rows = 6 }: { cols: number; rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3">
          {Array.from({ length: cols }).map((_, j) => <Skeleton key={j} className="h-8 flex-1" />)}
        </div>
      ))}
    </div>
  )
}

function RevenueTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-background border rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold mb-1">{label}</p>
      <p className="text-sky-600 font-bold">{formatCurrency(payload[0]?.value ?? 0)}</p>
    </div>
  )
}
function CountTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-background border rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold mb-1">{label}</p>
      <p className="font-bold">{payload[0]?.value}</p>
    </div>
  )
}

// ─── Main tabs ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'revenue',    label: 'Revenue',          icon: <DollarSign className="h-4 w-4" /> },
  { id: 'members',    label: 'Members',          icon: <Users className="h-4 w-4" /> },
  { id: 'attendance', label: 'Attendance',       icon: <Activity className="h-4 w-4" /> },
  { id: 'plans',      label: 'Plans',            icon: <BarChart2 className="h-4 w-4" /> },
  { id: 'training',   label: 'Personal Training',icon: <Dumbbell className="h-4 w-4" /> },
  { id: 'alerts',     label: 'Alerts',           icon: <AlertTriangle className="h-4 w-4" /> },
] as const
type TabId = typeof TABS[number]['id']

// ═══════════════════════════════════════════════════════════════════════════════
// REVENUE TAB
// ═══════════════════════════════════════════════════════════════════════════════

function RevenueSummary({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'revenue', from, to],
    queryFn:  () => reportsApi.revenue({ from, to }),
  })

  const r = data
  const byDay    = (r?.by_day ?? []).map(d => ({ ...d, label: fmtDayLabel(d.date) }))
  const byMethod = r?.by_method ?? []
  const totalMethod = byMethod.reduce((s, m) => s + m.amount, 0)
  const avgPerDay = byDay.filter(d => d.amount > 0).length > 0
    ? (r?.total_revenue ?? 0) / byDay.filter(d => d.amount > 0).length : 0

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Revenue"    value={formatCurrency(r?.total_revenue ?? 0)}   icon={<DollarSign className="h-5 w-5 text-sky-600" />}     color="bg-sky-50"     loading={isLoading} />
        <KpiCard label="Net Revenue"      value={formatCurrency(r?.net_revenue ?? 0)}      icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}  color="bg-emerald-50" loading={isLoading} />
        <KpiCard label="Transactions"     value={r?.transaction_count ?? 0}                icon={<CreditCard className="h-5 w-5 text-violet-600" />}   color="bg-violet-50"  loading={isLoading} />
        <KpiCard label="Avg / Active Day" value={formatCurrency(avgPerDay)}                icon={<BarChart2 className="h-5 w-5 text-amber-600" />}    color="bg-amber-50"   loading={isLoading} sub="on days with payments" />
      </div>

      <SectionCard
        title="Revenue Trend"
        subtitle="Daily revenue for selected period"
        action={<CSVExportButton endpoint="/reports/revenue" params={{ from, to }} filename={`revenue-${from}-${to}.csv`} />}
      >
        {isLoading ? <Skeleton className="h-56 w-full" /> : byDay.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">No revenue data for this period</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byDay} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<RevenueTooltip />} />
              <Bar dataKey="amount" fill="#027DFD" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="Payment Mode" subtitle="Revenue by payment method">
          {isLoading ? <Skeleton className="h-40 w-full" /> : byMethod.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No data</p>
          ) : (
            <div className="space-y-3">
              {byMethod.map((m, i) => {
                const pct = totalMethod > 0 ? (m.amount / totalMethod) * 100 : 0
                return (
                  <div key={m.method}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium">{capitalize(m.method)}</span>
                      <span className="text-muted-foreground">{formatCurrency(m.amount)} · {m.count} txns</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: CHART_COLORS.revenue[i % CHART_COLORS.revenue.length] }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Summary">
          <div className="divide-y text-sm">
            {([
              ['Gross Revenue', formatCurrency(r?.total_revenue ?? 0)],
              ['Refunds',       formatCurrency(r?.total_refunds ?? 0)],
              ['Net Revenue',   formatCurrency(r?.net_revenue ?? 0)],
              ['Transactions',  String(r?.transaction_count ?? 0)],
            ] as [string, string][]).map(([label, val]) => (
              <div key={label} className="flex justify-between py-2.5">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-semibold">{val}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

function RevenueTransactions({ from, to }: { from: string; to: string }) {
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'revenue', 'tx', from, to, page],
    queryFn:  () => paymentsApi.list({ from, to, page, per_page: PER_PAGE }),
  })

  const payments = ((data as unknown as { payments?: Payment[] })?.payments ?? []) as Payment[]
  const meta = (data as unknown as { meta?: { total?: number; total_pages?: number } })?.meta
  const total      = meta?.total ?? 0
  const totalPages = meta?.total_pages ?? 1

  return (
    <div>
      {isLoading ? <TableSkeleton cols={6} /> : payments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">No transactions found for this period</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground mb-3">{total} transactions in selected period</p>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr>
                <Th>Date</Th><Th>Member</Th><Th>Plan</Th><Th>Amount</Th><Th>Method</Th><Th>Status</Th>
              </tr></thead>
              <tbody className="divide-y">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                    <Td className="text-muted-foreground whitespace-nowrap">{formatDate(p.paid_at || p.created_at)}</Td>
                    <Td className="font-medium">{memberName(p.member)}</Td>
                    <Td className="text-muted-foreground">{p.subscription?.plan?.name ?? '—'}</Td>
                    <Td className="font-semibold tabular-nums">{formatCurrency(p.amount)}</Td>
                    <Td><span className="text-xs text-muted-foreground">{capitalize(p.payment_method)}</span></Td>
                    <Td><StatusBadge status={p.status} /></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </>
      )}
    </div>
  )
}

function RevenueTab({ from, to }: { from: string; to: string }) {
  const [sub, setSub] = useState<SubTab>('summary')
  return (
    <div>
      <div className="mb-4">
        <SubTabBar active={sub} onChange={setSub} />
      </div>
      {sub === 'summary'      && <RevenueSummary from={from} to={to} />}
      {sub === 'transactions' && <SectionCard title="Payment Transactions" subtitle="All payments for the selected date range"><RevenueTransactions from={from} to={to} /></SectionCard>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MEMBERS TAB
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Member sub-tab bar ───────────────────────────────────────────────────────

type MemberSubTab = 'overview' | 'active' | 'new' | 'expiring' | 'expired' | 'inactive'

const MEMBER_SUBTABS: { id: MemberSubTab; label: string }[] = [
  { id: 'overview',  label: 'Overview'   },
  { id: 'active',    label: 'Active'     },
  { id: 'new',       label: 'New Joinings' },
  { id: 'expiring',  label: 'Expiring'  },
  { id: 'expired',   label: 'Expired'   },
  { id: 'inactive',  label: 'Inactive'  },
]

function MemberSubTabBar({ active, onChange }: { active: MemberSubTab; onChange: (v: MemberSubTab) => void }) {
  return (
    <div className="flex flex-wrap gap-1 mb-6 p-1 bg-muted rounded-xl w-fit">
      {MEMBER_SUBTABS.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
            active === t.id
              ? 'bg-white text-sky-700 shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ─── Day selector pill group ──────────────────────────────────────────────────

function DaySelector({ value, options, onChange, label = 'Show for' }: {
  value: number; options: number[]; onChange: (d: number) => void; label?: string
}) {
  return (
    <div className="flex items-center gap-2 mb-5 flex-wrap">
      <span className="text-sm text-muted-foreground">{label}:</span>
      {options.map(d => (
        <button
          key={d}
          onClick={() => onChange(d)}
          className={cn(
            'px-3 py-1 rounded-full text-xs font-semibold transition-all',
            value === d ? 'text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80',
          )}
          className={cn('px-3 py-1 rounded-full text-xs font-semibold transition-all', value === d ? 'bg-sky-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80')}
          style={{}}
        >
          {d} days
        </button>
      ))}
    </div>
  )
}

// ─── Members: Overview ────────────────────────────────────────────────────────

function MembersSummary() {
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'members'],
    queryFn:  reportsApi.members,
  })

  const r = data
  const growth   = (r?.growth_by_month ?? []).map(g => ({ ...g, label: fmtMonthLabel(g.month) }))
  const byGender = r?.by_gender ?? []
  const statusData = r ? [
    { name: 'Active',    value: r.active_members,    color: '#10b981' },
    { name: 'Expired',   value: r.expired_members,   color: '#ef4444' },
    { name: 'Paused',    value: r.paused_members,    color: '#f59e0b' },
    { name: 'Cancelled', value: r.cancelled_members, color: '#94a3b8' },
  ].filter(s => s.value > 0) : []

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Members"  value={r?.total_members ?? 0}   icon={<Users className="h-5 w-5 text-sky-600" />}        color="bg-sky-50"     loading={isLoading} />
        <KpiCard label="Active"         value={r?.active_members ?? 0}  icon={<UserCheck className="h-5 w-5 text-emerald-600" />} color="bg-emerald-50" loading={isLoading} />
        <KpiCard label="New This Month" value={r?.new_this_month ?? 0}  icon={<Zap className="h-5 w-5 text-violet-600" />}       color="bg-violet-50"  loading={isLoading} />
        <KpiCard label="Expired"        value={r?.expired_members ?? 0} icon={<UserX className="h-5 w-5 text-red-600" />}        color="bg-red-50"     loading={isLoading} />
      </div>

      <SectionCard
        title="Monthly New Members"
        subtitle="Members joined per month (last 12 months)"
        action={<CSVExportButton endpoint="/reports/members" params={{}} filename="members-report.csv" />}
      >
        {isLoading ? <Skeleton className="h-56 w-full" /> : growth.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">No growth data</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={growth} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip content={<CountTooltip />} />
              <Bar dataKey="new" fill="#6366f1" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="Membership Status">
          {isLoading ? <Skeleton className="h-48 w-full" /> : statusData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No data</p>
          ) : (
            <div className="flex items-center gap-6">
              <PieChart width={140} height={140}>
                <Pie data={statusData} cx={65} cy={65} innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                  {statusData.map((s) => <Cell key={s.name} fill={s.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [v, '']} />
              </PieChart>
              <div className="space-y-2 flex-1">
                {statusData.map((s) => (
                  <div key={s.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                      <span className="text-muted-foreground">{s.name}</span>
                    </div>
                    <span className="font-semibold">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Gender Distribution">
          {isLoading ? <Skeleton className="h-48 w-full" /> : byGender.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No data</p>
          ) : (
            <div className="flex items-center gap-6">
              <PieChart width={140} height={140}>
                <Pie data={byGender.map(g => ({ name: g.gender, value: g.count }))} cx={65} cy={65} innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                  {byGender.map((_, i) => <Cell key={i} fill={CHART_COLORS.gender[i % CHART_COLORS.gender.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [v, '']} />
              </PieChart>
              <div className="space-y-2 flex-1">
                {byGender.map((g, i) => (
                  <div key={g.gender} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: CHART_COLORS.gender[i % CHART_COLORS.gender.length] }} />
                      <span className="text-muted-foreground capitalize">{g.gender || 'Unknown'}</span>
                    </div>
                    <span className="font-semibold">{g.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}

// ─── Members: Active ──────────────────────────────────────────────────────────

// ─── DatePresetPicker ─────────────────────────────────────────────────────────

type Preset = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'last_3m' | 'last_6m' | 'this_year' | 'all_time' | 'custom'

const PRESETS: { id: Preset; label: string }[] = [
  { id: 'today',       label: 'Today'       },
  { id: 'yesterday',   label: 'Yesterday'   },
  { id: 'this_week',   label: 'This Week'   },
  { id: 'last_week',   label: 'Last Week'   },
  { id: 'this_month',  label: 'This Month'  },
  { id: 'last_month',  label: 'Last Month'  },
  { id: 'last_3m',     label: 'Last 3 M'    },
  { id: 'last_6m',     label: 'Last 6 M'    },
  { id: 'this_year',   label: 'This Year'   },
  { id: 'all_time',    label: 'All Time'    },
  { id: 'custom',      label: 'Custom'      },
]

function presetDates(id: Preset): { from: string; to: string } {
  const now   = new Date()
  const fmt   = (d: Date) => d.toISOString().split('T')[0]
  const today = fmt(now)

  switch (id) {
    case 'today': return { from: today, to: today }
    case 'yesterday': {
      const d = new Date(now); d.setDate(d.getDate() - 1); const s = fmt(d)
      return { from: s, to: s }
    }
    case 'this_week': {
      const d = new Date(now); d.setDate(d.getDate() - d.getDay())
      return { from: fmt(d), to: today }
    }
    case 'last_week': {
      const end   = new Date(now); end.setDate(end.getDate() - end.getDay() - 1)
      const start = new Date(end); start.setDate(start.getDate() - 6)
      return { from: fmt(start), to: fmt(end) }
    }
    case 'this_month': {
      const d = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: fmt(d), to: today }
    }
    case 'last_month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end   = new Date(now.getFullYear(), now.getMonth(), 0)
      return { from: fmt(start), to: fmt(end) }
    }
    case 'last_3m': {
      const d = new Date(now); d.setMonth(d.getMonth() - 3)
      return { from: fmt(d), to: today }
    }
    case 'last_6m': {
      const d = new Date(now); d.setMonth(d.getMonth() - 6)
      return { from: fmt(d), to: today }
    }
    case 'this_year': {
      return { from: `${now.getFullYear()}-01-01`, to: today }
    }
    case 'all_time':
    case 'custom':
    default:
      return { from: '', to: '' }
  }
}

interface DatePresetPickerProps {
  from: string; to: string
  onChange: (from: string, to: string) => void
  label?: string
}

function DatePresetPicker({ from, to, onChange, label = 'Filter by date' }: DatePresetPickerProps) {
  const [active, setActive] = useState<Preset>('this_month')

  const apply = (id: Preset) => {
    setActive(id)
    if (id !== 'custom') {
      const d = presetDates(id)
      onChange(d.from, d.to)
    }
  }

  return (
    <div className="mb-5 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map(p => (
          <button
            key={p.id}
            onClick={() => apply(p.id)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium border transition-all',
              active === p.id
                ? 'text-white border-transparent shadow-sm'
                : 'bg-white border-border text-muted-foreground hover:border-sky-300 hover:text-sky-700',
            )}
            className={cn('px-3 py-1 rounded-full text-xs font-medium border transition-all', active === p.id ? 'bg-sky-600 text-white border-transparent shadow-sm' : 'bg-white border-border text-muted-foreground hover:border-sky-300 hover:text-sky-700')}
            style={{}}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date inputs — always visible when custom selected */}
      {active === 'custom' && (
        <div className="flex flex-wrap gap-3 items-end pt-1">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">From</Label>
            <Input
              type="date" value={from}
              onChange={(e) => onChange(e.target.value, to)}
              className="w-36 h-8 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">To</Label>
            <Input
              type="date" value={to}
              onChange={(e) => onChange(from, e.target.value)}
              className="w-36 h-8 text-sm"
            />
          </div>
        </div>
      )}

      {/* Show selected range as a small badge when a preset is active */}
      {active !== 'custom' && active !== 'all_time' && from && to && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">{from}</span> → <span className="font-medium">{to}</span>
        </p>
      )}
    </div>
  )
}

// ─── Members: Active ──────────────────────────────────────────────────────────

function MembersActive() {
  const initDates = presetDates('this_month')
  const [from,   setFrom]   = useState(initDates.from)
  const [to,     setTo]     = useState(initDates.to)
  const [search, setSearch] = useState('')
  const [page,   setPage]   = useState(1)

  const handleDateChange = (f: string, t: string) => { setFrom(f); setTo(t); setPage(1) }

  const { data, isLoading } = useQuery({
    queryKey: ['members', 'report', 'active', from, to, search, page],
    queryFn:  () => membersApi.list({
      status: 'active',
      joined_from: from || undefined,
      joined_to:   to   || undefined,
      search: search || undefined,
      page, per_page: PER_PAGE,
    }),
  })

  const members    = ((data as unknown as { members?: Member[] })?.members ?? []) as Member[]
  const meta       = (data as unknown as { meta?: { total?: number; total_pages?: number } })?.meta
  const total      = meta?.total ?? 0
  const totalPages = meta?.total_pages ?? 1

  return (
    <SectionCard
      title="Active Members"
      subtitle={total > 0 ? `${total} active members in selected period` : 'Active members filtered by join date'}
    >
      <DatePresetPicker from={from} to={to} onChange={handleDateChange} label="Filter by join date" />
      <div className="mb-4">
        <Input
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="h-8 w-60 text-sm"
        />
      </div>
      {isLoading ? <TableSkeleton cols={5} /> : members.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">No active members found for selected filters</p>
      ) : (
        <>
          <MemberTable members={members} showJoined />
          <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </>
      )}
    </SectionCard>
  )
}

// ─── Members: New Joinings ────────────────────────────────────────────────────

function MembersNew() {
  const initDates = presetDates('this_month')
  const [from, setFrom] = useState(initDates.from)
  const [to,   setTo]   = useState(initDates.to)
  const [view, setView] = useState<'list' | 'daily'>('list')
  const [page, setPage] = useState(1)

  const handleDateChange = (f: string, t: string) => { setFrom(f); setTo(t); setPage(1) }

  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ['members', 'report', 'new', from, to, page],
    queryFn:  () => membersApi.list({
      joined_from: from || undefined,
      joined_to:   to   || undefined,
      page, per_page: PER_PAGE,
    }),
  })

  // Summary chart data from reports API
  const { data: reportData } = useQuery({
    queryKey: ['reports', 'members'],
    queryFn:  reportsApi.members,
  })

  const members    = ((listData as unknown as { members?: Member[] })?.members ?? []) as Member[]
  const meta       = (listData as unknown as { meta?: { total?: number; total_pages?: number } })?.meta
  const total      = meta?.total ?? 0
  const totalPages = meta?.total_pages ?? 1
  const growth     = (reportData?.growth_by_month ?? []).map(g => ({ ...g, label: fmtMonthLabel(g.month) }))

  return (
    <div className="space-y-5">
      {/* Monthly growth chart */}
      <SectionCard title="Monthly Growth" subtitle="New members joined per month (last 12 months)">
        {growth.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No growth data available</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={growth} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip content={<CountTooltip />} />
              <Bar dataKey="new" fill="#6366f1" radius={[3, 3, 0, 0]} name="New Members" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </SectionCard>

      {/* Date-range member list */}
      <SectionCard
        title="New Joinings — Detail"
        subtitle={total > 0 ? `${total} members joined in selected period` : 'Members who joined in the selected date range'}
        action={
          <div className="flex gap-1 p-0.5 bg-muted rounded-lg">
            {(['list', 'daily'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={cn('px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                  view === v ? 'bg-white text-sky-700 shadow-sm' : 'text-muted-foreground')}
              >
                {v === 'list' ? 'List' : 'By Day'}
              </button>
            ))}
          </div>
        }
      >
        <DatePresetPicker from={from} to={to} onChange={handleDateChange} label="Filter by join date" />

        {view === 'list' ? (
          listLoading ? <TableSkeleton cols={5} /> : members.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No members joined in this period</p>
          ) : (
            <>
              <MemberTable members={members} showJoined />
              <Pagination page={page} totalPages={totalPages} onPage={setPage} />
            </>
          )
        ) : (
          /* Daily breakdown — pivot the members list by join date */
          listLoading ? <TableSkeleton cols={3} /> : members.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No members joined in this period</p>
          ) : (() => {
            const byDay: Record<string, Member[]> = {}
            members.forEach(m => {
              const day = m.joined_date.split('T')[0]
              if (!byDay[day]) byDay[day] = []
              byDay[day].push(m)
            })
            return (
              <div className="space-y-3">
                {Object.entries(byDay).sort(([a], [b]) => b.localeCompare(a)).map(([day, dayMembers]) => (
                  <div key={day} className="rounded-lg border overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b">
                      <span className="text-xs font-semibold">{new Date(day).toLocaleDateString('default', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      <span className="text-xs font-bold text-sky-700">{dayMembers.length} joined</span>
                    </div>
                    <div className="divide-y">
                      {dayMembers.map(m => (
                        <div key={m.id} className="flex items-center justify-between px-3 py-2 text-sm">
                          <span className="font-medium">{m.user.first_name} {m.user.last_name}</span>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {m.user.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{m.user.phone}</span>}
                            <StatusBadge status={m.membership_status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          })()
        )}
      </SectionCard>
    </div>
  )
}

// ─── Members: Expiring ────────────────────────────────────────────────────────

function MembersExpiring() {
  const [days, setDays] = useState(15)

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'expiring', days],
    queryFn:  () => reportsApi.expiring(days),
  })

  const members = data?.members ?? []

  function urgencyColor(d: number) {
    if (d <= 0) return 'bg-red-50 border-red-200'
    if (d <= 3) return 'bg-orange-50 border-orange-200'
    if (d <= 7) return 'bg-amber-50 border-amber-200'
    return 'bg-sky-50 border-sky-200'
  }
  function urgencyBadge(d: number) {
    if (d <= 0) return 'bg-red-100 text-red-700'
    if (d <= 3) return 'bg-orange-100 text-orange-700'
    if (d <= 7) return 'bg-amber-100 text-amber-700'
    return 'bg-sky-100 text-sky-700'
  }

  const expiringToday = members.filter(m => m.days_left <= 0).length
  const expiring3     = members.filter(m => m.days_left > 0 && m.days_left <= 3).length
  const expiring7     = members.filter(m => m.days_left > 0 && m.days_left <= 7).length

  return (
    <div className="space-y-5">
      {/* Summary pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Expiring Today', count: expiringToday, color: 'bg-red-50 border-red-200 text-red-700' },
          { label: 'Within 3 Days',  count: expiring3,     color: 'bg-orange-50 border-orange-200 text-orange-700' },
          { label: 'Within 7 Days',  count: expiring7,     color: 'bg-amber-50 border-amber-200 text-amber-700' },
          { label: `Within ${days} Days`, count: data?.count ?? 0, color: 'bg-sky-50 border-sky-200 text-sky-700' },
        ].map(s => (
          <div key={s.label} className={cn('rounded-xl border p-4 text-center', s.color)}>
            <p className="text-2xl font-bold">{s.count}</p>
            <p className="text-xs font-medium mt-0.5 opacity-80">{s.label}</p>
          </div>
        ))}
      </div>

      <SectionCard
        title="Expiring Memberships"
        subtitle={`${data?.count ?? 0} members expiring in the next ${days} days`}
      >
        <DaySelector value={days} options={[7, 15, 30, 60]} onChange={setDays} label="Show expiring within" />

        {isLoading ? (
          <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : members.length === 0 ? (
          <div className="text-center py-10">
            <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No memberships expiring in the next {days} days 🎉</p>
          </div>
        ) : (
          <div className="space-y-2">
            {members.map(m => (
              <div key={m.member_id} className={cn('rounded-lg border p-3 flex items-center justify-between gap-3', urgencyColor(m.days_left))}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{m.name}</p>
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', urgencyBadge(m.days_left))}>
                      {m.days_left <= 0 ? 'Expired today' : `${m.days_left}d left`}
                    </span>
                    <span className="text-[10px] bg-white/70 text-muted-foreground rounded px-1.5 py-0.5 border">{m.plan_name}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {m.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{m.phone}</span>}
                    {m.email && <span className="flex items-center gap-1 truncate max-w-[200px]"><Mail className="h-3 w-3" />{m.email}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">Expires</p>
                  <p className="text-xs font-semibold">{formatDate(m.end_date)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}

// ─── Members: Expired ─────────────────────────────────────────────────────────

function MembersExpired() {
  const initDates = presetDates('this_month')
  const [from,   setFrom]   = useState(initDates.from)
  const [to,     setTo]     = useState(initDates.to)
  const [search, setSearch] = useState('')
  const [page,   setPage]   = useState(1)

  const handleDateChange = (f: string, t: string) => { setFrom(f); setTo(t); setPage(1) }

  const { data, isLoading } = useQuery({
    queryKey: ['members', 'report', 'expired', from, to, search, page],
    queryFn:  () => membersApi.list({
      status:      'expired',
      joined_from: from || undefined,
      joined_to:   to   || undefined,
      search:      search || undefined,
      page, per_page: PER_PAGE,
    }),
  })

  const members    = ((data as unknown as { members?: Member[] })?.members ?? []) as Member[]
  const meta       = (data as unknown as { meta?: { total?: number; total_pages?: number } })?.meta
  const total      = meta?.total ?? 0
  const totalPages = meta?.total_pages ?? 1

  return (
    <SectionCard
      title="Expired Members"
      subtitle={total > 0 ? `${total} members with expired membership` : 'Members whose membership has expired'}
    >
      <DatePresetPicker from={from} to={to} onChange={handleDateChange} label="Filter by join date" />
      <div className="mb-4">
        <Input
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="h-8 w-60 text-sm"
        />
      </div>
      {isLoading ? <TableSkeleton cols={5} /> : members.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">No expired members found for selected filters</p>
      ) : (
        <>
          <MemberTable members={members} showJoined />
          <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </>
      )}
    </SectionCard>
  )
}

// ─── Members: Inactive ────────────────────────────────────────────────────────

function MembersInactive() {
  const [days, setDays] = useState(30)

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'inactive', days],
    queryFn:  () => reportsApi.inactive(days),
  })

  const members = data?.members ?? []

  function staleness(d: number | null) {
    if (d === null) return { color: 'bg-red-50 border-red-200', badge: 'bg-red-100 text-red-700', label: 'Never visited' }
    if (d >= 90)   return { color: 'bg-red-50 border-red-200', badge: 'bg-red-100 text-red-700', label: `${d}d ago` }
    if (d >= 60)   return { color: 'bg-orange-50 border-orange-200', badge: 'bg-orange-100 text-orange-700', label: `${d}d ago` }
    return { color: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-700', label: `${d}d ago` }
  }

  const neverVisited = members.filter(m => m.last_visit === null).length

  return (
    <div className="space-y-5">
      {/* Summary pills */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
          <p className="text-2xl font-bold text-amber-700">{data?.count ?? 0}</p>
          <p className="text-xs font-medium text-amber-600 mt-0.5">Inactive ≥ {days} days</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
          <p className="text-2xl font-bold text-red-700">{neverVisited}</p>
          <p className="text-xs font-medium text-red-600 mt-0.5">Never visited</p>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-center">
          <p className="text-2xl font-bold text-sky-700">{(data?.count ?? 0) - neverVisited}</p>
          <p className="text-xs font-medium text-sky-600 mt-0.5">Lapsed visitors</p>
        </div>
      </div>

      <SectionCard
        title="Inactive Members"
        subtitle={`Active members who haven't visited in the last ${days} days`}
      >
        <DaySelector value={days} options={[14, 30, 60, 90]} onChange={setDays} label="No visit in" />

        {isLoading ? (
          <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : members.length === 0 ? (
          <div className="text-center py-10">
            <Activity className="h-10 w-10 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">All active members have visited in the last {days} days 🎉</p>
          </div>
        ) : (
          <div className="space-y-2">
            {members.map((m: InactiveMember) => {
              const s = staleness(m.days_since_visit)
              return (
                <div key={m.member_id} className={cn('rounded-lg border p-3 flex items-center justify-between gap-3', s.color)}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{m.name}</p>
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', s.badge)}>{s.label}</span>
                      <span className="text-[10px] font-mono bg-white/70 text-muted-foreground rounded px-1.5 py-0.5 border">{m.member_code}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {m.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{m.phone}</span>}
                      {m.email && <span className="flex items-center gap-1 truncate max-w-[200px]"><Mail className="h-3 w-3" />{m.email}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">Last visit</p>
                    <p className="text-xs font-semibold">{m.last_visit ? formatDate(m.last_visit) : <span className="text-red-600">Never</span>}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>
    </div>
  )
}

// ─── Shared member table ──────────────────────────────────────────────────────

function MemberTable({ members, showJoined = true }: { members: Member[]; showJoined?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead><tr>
          <Th>Name</Th><Th>Phone</Th><Th>Email</Th><Th>Status</Th>
          {showJoined && <Th>Joined</Th>}
        </tr></thead>
        <tbody className="divide-y">
          {members.map((m) => (
            <tr key={m.id} className="hover:bg-muted/20 transition-colors">
              <Td className="font-medium">{m.user.first_name} {m.user.last_name}</Td>
              <Td>
                {m.user.phone
                  ? <span className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" />{m.user.phone}</span>
                  : '—'}
              </Td>
              <Td className="text-xs text-muted-foreground max-w-[180px] truncate">
                {m.user.email
                  ? <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{m.user.email}</span>
                  : '—'}
              </Td>
              <Td><StatusBadge status={m.membership_status} /></Td>
              {showJoined && <Td className="text-muted-foreground whitespace-nowrap">{formatDate(m.joined_date)}</Td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Members Tab shell ────────────────────────────────────────────────────────

function MembersTab() {
  const [sub, setSub] = useState<MemberSubTab>('overview')
  return (
    <div>
      <MemberSubTabBar active={sub} onChange={setSub} />
      {sub === 'overview'  && <MembersSummary />}
      {sub === 'active'    && <MembersActive />}
      {sub === 'new'       && <MembersNew />}
      {sub === 'expiring'  && <MembersExpiring />}
      {sub === 'expired'   && <MembersExpired />}
      {sub === 'inactive'  && <MembersInactive />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ATTENDANCE TAB
// ═══════════════════════════════════════════════════════════════════════════════

function AttendanceSummary({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'attendance', from, to],
    queryFn:  () => reportsApi.attendance({ from, to }),
  })

  const r = data
  const byDay    = (r?.by_day ?? []).map(d => ({ ...d, label: fmtDayLabel(d.date) }))
  const hourMap  = Object.fromEntries((r?.by_hour ?? []).map(h => [h.hour, h.count]))
  const byHour   = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: hourMap[i] ?? 0, label: fmtHour(i) }))
  const byMethod = r?.by_method ?? []

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Check-ins" value={r?.total_check_ins ?? 0}                                     icon={<Activity className="h-5 w-5 text-amber-600" />}   color="bg-amber-50"   loading={isLoading} />
        <KpiCard label="Unique Members"  value={r?.unique_members ?? 0}                                      icon={<Users className="h-5 w-5 text-sky-600" />}        color="bg-sky-50"     loading={isLoading} />
        <KpiCard label="Peak Hour"       value={r?.peak_hour !== undefined ? fmtHour(r.peak_hour) : '—'}     icon={<Zap className="h-5 w-5 text-violet-600" />}       color="bg-violet-50"  loading={isLoading} sub="busiest hour" />
        <KpiCard label="Avg Duration"    value={r?.avg_duration_mins ? `${Math.round(r.avg_duration_mins)}m` : '—'} icon={<Clock className="h-5 w-5 text-emerald-600" />} color="bg-emerald-50" loading={isLoading} sub="per visit" />
      </div>

      <SectionCard
        title="Daily Footfall"
        subtitle="Check-ins per day"
        action={<CSVExportButton endpoint="/reports/attendance" params={{ from, to }} filename={`attendance-${from}-${to}.csv`} />}
      >
        {isLoading ? <Skeleton className="h-56 w-full" /> : byDay.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">No data for this period</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byDay} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip content={<CountTooltip />} />
              <Bar dataKey="count" fill="#f59e0b" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="Peak Hours" subtitle="Check-ins by hour of day">
          {isLoading ? <Skeleton className="h-48 w-full" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byHour} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={2} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip content={<CountTooltip />} />
                <Bar dataKey="count" fill="#a78bfa" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard title="Check-in Method">
          {isLoading ? <Skeleton className="h-48 w-full" /> : byMethod.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No data</p>
          ) : (
            <div className="space-y-4 pt-2">
              {byMethod.map((m, i) => {
                const total = byMethod.reduce((s, x) => s + x.count, 0)
                const pct   = total > 0 ? (m.count / total) * 100 : 0
                return (
                  <div key={m.method}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium">{capitalize(m.method)}</span>
                      <span className="text-muted-foreground">{m.count} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: CHART_COLORS.attendance[i % 4] }} />
                    </div>
                  </div>
                )
              })}
              <div className="pt-2 border-t text-xs text-muted-foreground">
                Avg daily: <strong>{(r?.avg_daily_check_ins ?? 0).toFixed(1)}</strong> check-ins/day
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}

function AttendanceLog({ from, to }: { from: string; to: string }) {
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'attendance', 'log', from, to, page],
    queryFn:  () => attendanceApi.list({ from, to, page, per_page: PER_PAGE }),
  })

  const records    = ((data as unknown as { attendance?: AttendanceRecord[] })?.attendance ?? []) as AttendanceRecord[]
  const meta       = (data as unknown as { meta?: { total?: number; total_pages?: number } })?.meta
  const total      = meta?.total ?? 0
  const totalPages = meta?.total_pages ?? 1

  return (
    <div>
      {isLoading ? <TableSkeleton cols={5} /> : records.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">No attendance records for this period</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground mb-3">{total} check-ins in selected period</p>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr>
                <Th>Member</Th><Th>Check-In</Th><Th>Check-Out</Th><Th>Duration</Th><Th>Method</Th>
              </tr></thead>
              <tbody className="divide-y">
                {records.map((a) => (
                  <tr key={a.id} className="hover:bg-muted/20 transition-colors">
                    <Td className="font-medium">{memberName(a.member)}</Td>
                    <Td className="text-muted-foreground whitespace-nowrap">
                      {new Date(a.check_in_at).toLocaleString('default', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </Td>
                    <Td className="text-muted-foreground whitespace-nowrap">
                      {a.check_out_at
                        ? new Date(a.check_out_at).toLocaleString('default', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : <span className="text-amber-600 text-xs font-medium">Still in</span>}
                    </Td>
                    <Td className="text-muted-foreground">{a.duration_mins != null ? `${a.duration_mins}m` : '—'}</Td>
                    <Td><span className="text-xs text-muted-foreground">{capitalize(a.method)}</span></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </>
      )}
    </div>
  )
}

function AttendanceTab({ from, to }: { from: string; to: string }) {
  const [sub, setSub] = useState<SubTab>('summary')
  return (
    <div>
      <div className="mb-4">
        <SubTabBar active={sub} onChange={setSub} />
      </div>
      {sub === 'summary'      && <AttendanceSummary from={from} to={to} />}
      {sub === 'transactions' && <SectionCard title="Attendance Log" subtitle="Detailed check-in records for the selected date range"><AttendanceLog from={from} to={to} /></SectionCard>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PLANS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function PlansSummary() {
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'subscriptions'],
    queryFn:  reportsApi.subscriptions,
  })

  const s       = data
  const byPlan  = s?.by_plan ?? []
  const maxPlan = Math.max(...byPlan.map(p => p.count), 1)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Active Subscriptions" value={s?.active ?? 0}             icon={<UserCheck className="h-5 w-5 text-emerald-600" />}    color="bg-emerald-50" loading={isLoading} />
        <KpiCard label="Expiring in 7 Days"   value={s?.expiring_in_7_days ?? 0} icon={<AlertTriangle className="h-5 w-5 text-amber-600" />}  color="bg-amber-50"   loading={isLoading} />
        <KpiCard label="Auto-Renew Enabled"   value={s?.auto_renew_count ?? 0}   icon={<RefreshCw className="h-5 w-5 text-sky-600" />}        color="bg-sky-50"     loading={isLoading} />
        <KpiCard label="Expired"              value={s?.expired ?? 0}            icon={<UserX className="h-5 w-5 text-red-600" />}            color="bg-red-50"     loading={isLoading} />
      </div>

      <SectionCard title="Plan Popularity" subtitle="Subscriptions per plan">
        {isLoading ? <Skeleton className="h-48 w-full" /> : byPlan.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No plan data</p>
        ) : (
          <div className="space-y-3">
            {byPlan.map((p, i) => (
              <div key={p.plan_id}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{p.plan_name}</span>
                  <span className="text-muted-foreground">{p.count} members</span>
                </div>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(p.count / maxPlan) * 100}%`, background: CHART_COLORS.plans[i % CHART_COLORS.plans.length] }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Status Breakdown">
        <div className="divide-y text-sm">
          {([
            ['Active',    s?.active    ?? 0, 'text-emerald-600'],
            ['Paused',    s?.paused    ?? 0, 'text-amber-600'],
            ['Expired',   s?.expired   ?? 0, 'text-red-600'],
            ['Cancelled', s?.cancelled ?? 0, 'text-gray-500'],
          ] as [string, number, string][]).map(([label, val, cls]) => (
            <div key={label} className="flex justify-between py-2.5">
              <span className="text-muted-foreground">{label}</span>
              <span className={`font-semibold ${cls}`}>{val}</span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}

function PlansTransactions() {
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'plans', 'list', statusFilter, page],
    queryFn:  () => subscriptionsApi.list({ status: statusFilter || undefined, page, per_page: PER_PAGE }),
  })

  const subscriptions = ((data as unknown as { subscriptions?: Subscription[] })?.subscriptions ?? []) as Subscription[]
  const meta          = (data as unknown as { meta?: { total?: number; total_pages?: number } })?.meta
  const total         = meta?.total ?? 0
  const totalPages    = meta?.total_pages ?? 1

  return (
    <div>
      <div className="mb-4">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm text-muted-foreground"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="paused">Paused</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {isLoading ? <TableSkeleton cols={6} /> : subscriptions.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">No subscriptions found</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground mb-3">{total} subscriptions</p>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr>
                <Th>Member</Th><Th>Plan</Th><Th>Start</Th><Th>End</Th><Th>Status</Th><Th>Auto-Renew</Th>
              </tr></thead>
              <tbody className="divide-y">
                {subscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-muted/20 transition-colors">
                    <Td className="font-medium">{memberName(sub.member)}</Td>
                    <Td className="text-muted-foreground">{sub.plan?.name ?? '—'}</Td>
                    <Td className="text-muted-foreground whitespace-nowrap">{formatDate(sub.start_date)}</Td>
                    <Td className="text-muted-foreground whitespace-nowrap">{formatDate(sub.end_date)}</Td>
                    <Td><StatusBadge status={sub.status} /></Td>
                    <Td>
                      <span className={cn(
                        'text-xs font-semibold px-2 py-0.5 rounded-full',
                        sub.auto_renew ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500',
                      )}>
                        {sub.auto_renew ? 'Yes' : 'No'}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </>
      )}
    </div>
  )
}

function PlansTab() {
  const [sub, setSub] = useState<SubTab>('summary')
  return (
    <div>
      <SubTabBar active={sub} onChange={setSub} />
      {sub === 'summary'      && <PlansSummary />}
      {sub === 'transactions' && <SectionCard title="Subscription Records" subtitle="All subscription records"><PlansTransactions /></SectionCard>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PERSONAL TRAINING TAB
// ═══════════════════════════════════════════════════════════════════════════════

function TrainingSummary() {
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'trainers'],
    queryFn:  reportsApi.trainers,
  })

  const r        = data
  const trainers = r?.trainers ?? []
  const specs    = r?.by_specialization ?? []
  const maxSpec  = Math.max(...specs.map(s => s.count), 1)

  const utilizationColor = (assigned: number, max: number) => {
    const pct = max > 0 ? assigned / max : 0
    if (pct >= 0.9) return '#ef4444'
    if (pct >= 0.6) return '#f59e0b'
    return '#10b981'
  }

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Trainers"      value={r?.total_trainers ?? 0}     icon={<Dumbbell className="h-5 w-5 text-sky-600" />}        color="bg-sky-50"     loading={isLoading} />
        <KpiCard label="Active Trainers"     value={r?.active_trainers ?? 0}    icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />} color="bg-emerald-50" loading={isLoading} />
        <KpiCard label="Assigned Members"    value={r?.assigned_members ?? 0}   icon={<UserCheck className="h-5 w-5 text-violet-600" />}    color="bg-violet-50"  loading={isLoading} sub="members with a PT" />
        <KpiCard label="Unassigned Members"  value={r?.unassigned_members ?? 0} icon={<UserX className="h-5 w-5 text-amber-600" />}         color="bg-amber-50"   loading={isLoading} sub="no trainer assigned" />
      </div>

      {/* Trainer roster */}
      <SectionCard title="Trainer Roster" subtitle="All trainers with current workload">
        {isLoading ? <TableSkeleton cols={6} rows={4} /> : trainers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No trainers found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr>
                <Th>Trainer</Th>
                <Th>Specializations</Th>
                <Th>Experience</Th>
                <Th>Assigned Members</Th>
                <Th>Classes This Month</Th>
                <Th>Hourly Rate</Th>
                <Th>Status</Th>
              </tr></thead>
              <tbody className="divide-y">
                {trainers.map((t) => {
                  const utilPct = t.max_clients_per_day > 0 ? (t.assigned_members / t.max_clients_per_day) * 100 : 0
                  return (
                    <tr key={t.trainer_id} className="hover:bg-muted/20 transition-colors">
                      <Td>
                        <div>
                          <p className="font-medium text-sm">{t.name}</p>
                          {t.email && <p className="text-xs text-muted-foreground">{t.email}</p>}
                        </div>
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-1">
                          {(t.specializations ?? []).slice(0, 3).map(s => (
                            <span key={s} className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-700 font-medium capitalize">{s}</span>
                          ))}
                          {(t.specializations ?? []).length > 3 && (
                            <span className="text-[10px] text-muted-foreground">+{t.specializations.length - 3}</span>
                          )}
                        </div>
                      </Td>
                      <Td className="text-muted-foreground">{t.experience_years} yr{t.experience_years !== 1 ? 's' : ''}</Td>
                      <Td>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{t.assigned_members}</span>
                            <span className="text-xs text-muted-foreground">/ {t.max_clients_per_day} max</span>
                          </div>
                          <div className="mt-1 h-1.5 w-24 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(utilPct, 100)}%`,
                                background: utilizationColor(t.assigned_members, t.max_clients_per_day),
                              }}
                            />
                          </div>
                        </div>
                      </Td>
                      <Td className="text-muted-foreground">{t.classes_this_month}</Td>
                      <Td className="font-medium">₹{t.hourly_rate.toLocaleString()}/hr</Td>
                      <Td>
                        <span className={cn(
                          'text-[11px] font-semibold px-2 py-0.5 rounded-full',
                          t.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500',
                        )}>
                          {t.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Specialization breakdown + stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="Specialization Breakdown" subtitle="Expertise areas across active trainers">
          {isLoading ? <Skeleton className="h-48 w-full" /> : specs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No specialization data</p>
          ) : (
            <div className="space-y-3">
              {specs.map((s, i) => (
                <div key={s.specialization}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium capitalize">{s.specialization}</span>
                    <span className="text-muted-foreground">{s.count} trainer{s.count !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(s.count / maxSpec) * 100}%`,
                        background: CHART_COLORS.plans[i % CHART_COLORS.plans.length],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Quick Stats">
          {isLoading ? <Skeleton className="h-48 w-full" /> : (
            <div className="divide-y text-sm">
              {[
                ['Total Trainers',     r?.total_trainers ?? 0],
                ['Active Trainers',    r?.active_trainers ?? 0],
                ['Inactive Trainers',  (r?.total_trainers ?? 0) - (r?.active_trainers ?? 0)],
                ['Members with PT',    r?.assigned_members ?? 0],
                ['Members without PT', r?.unassigned_members ?? 0],
                ['PT Coverage',        r && (r.assigned_members + r.unassigned_members) > 0
                  ? `${Math.round((r.assigned_members / (r.assigned_members + r.unassigned_members)) * 100)}%`
                  : '0%'],
              ].map(([label, val]) => (
                <div key={String(label)} className="flex justify-between py-2.5">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-semibold">{val}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}

function TrainingTransactions() {
  const { data: trainerData, isLoading: trainerLoading } = useQuery({
    queryKey: ['reports', 'trainers'],
    queryFn:  reportsApi.trainers,
  })

  const [selectedTrainer, setSelectedTrainer] = useState<TrainerStat | null>(null)
  const [memberPage, setMemberPage] = useState(1)

  const { data: memberData, isLoading: memberLoading } = useQuery({
    queryKey: ['reports', 'training', 'members', selectedTrainer?.trainer_id, memberPage],
    queryFn:  () => membersApi.list({
      trainer_id: selectedTrainer!.trainer_id,
      page: memberPage,
      per_page: PER_PAGE,
    }),
    enabled: !!selectedTrainer,
  })

  const trainers = trainerData?.trainers ?? []
  const members  = ((memberData as unknown as { members?: Member[] })?.members ?? []) as Member[]
  const meta     = (memberData as unknown as { meta?: { total?: number; total_pages?: number } })?.meta
  const total      = meta?.total ?? 0
  const totalPages = meta?.total_pages ?? 1

  return (
    <div className="space-y-5">
      {/* Trainer selector */}
      <SectionCard title="Select a Trainer" subtitle="Choose a trainer to view their assigned members">
        {trainerLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : trainers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No trainers found</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {trainers.map((t) => (
              <button
                key={t.trainer_id}
                onClick={() => { setSelectedTrainer(t); setMemberPage(1) }}
                className={cn(
                  'rounded-xl border p-4 text-left transition-all',
                  selectedTrainer?.trainer_id === t.trainer_id
                    ? 'border-sky-400 bg-sky-50 ring-2 ring-sky-200'
                    : 'border-border hover:border-sky-200 hover:bg-muted/30',
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {t.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <span className={cn(
                    'text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0',
                    t.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500',
                  )}>
                    {t.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="font-semibold text-sm leading-tight">{t.name}</p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />{t.assigned_members} members
                  </span>
                  <span className="flex items-center gap-1">
                    <Star className="h-3 w-3" />{t.experience_years}yr
                  </span>
                </div>
                {(t.specializations ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {t.specializations.slice(0, 2).map(s => (
                      <span key={s} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white border border-sky-200 text-sky-600 capitalize">{s}</span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Assigned members list */}
      {selectedTrainer && (
        <SectionCard
          title={`Members Assigned to ${selectedTrainer.name}`}
          subtitle={`${total} member${total !== 1 ? 's' : ''} under this trainer`}
          action={
            <div className="flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Award className="h-4 w-4" />
                {selectedTrainer.experience_years} yrs exp
              </span>
              <span className="font-semibold text-sky-700">₹{selectedTrainer.hourly_rate.toLocaleString()}/hr</span>
            </div>
          }
        >
          {/* Trainer detail header */}
          <div className="mb-4 p-3 rounded-lg bg-muted/40 flex flex-wrap gap-4 items-center text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Specializations</p>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {(selectedTrainer.specializations ?? []).map(s => (
                  <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 font-medium capitalize">{s}</span>
                ))}
                {(selectedTrainer.specializations ?? []).length === 0 && <span className="text-muted-foreground">—</span>}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Max Clients / Day</p>
              <p className="font-semibold">{selectedTrainer.max_clients_per_day}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Classes This Month</p>
              <p className="font-semibold">{selectedTrainer.classes_this_month}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Classes</p>
              <p className="font-semibold">{selectedTrainer.total_classes}</p>
            </div>
          </div>

          {memberLoading ? (
            <TableSkeleton cols={5} />
          ) : members.length === 0 ? (
            <div className="text-center py-10">
              <Users className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No members assigned to this trainer</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr>
                    <Th>Member</Th><Th>Phone</Th><Th>Email</Th><Th>Status</Th><Th>Joined</Th>
                  </tr></thead>
                  <tbody className="divide-y">
                    {members.map((m) => (
                      <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                        <Td className="font-medium">{m.user.first_name} {m.user.last_name}</Td>
                        <Td>
                          {m.user.phone
                            ? <span className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" />{m.user.phone}</span>
                            : '—'}
                        </Td>
                        <Td className="text-xs text-muted-foreground max-w-[180px] truncate">
                          {m.user.email
                            ? <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{m.user.email}</span>
                            : '—'}
                        </Td>
                        <Td><StatusBadge status={m.membership_status} /></Td>
                        <Td className="text-muted-foreground whitespace-nowrap">{formatDate(m.joined_date)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={memberPage} totalPages={totalPages} onPage={setMemberPage} />
            </>
          )}
        </SectionCard>
      )}
    </div>
  )
}

function TrainingTab() {
  const [sub, setSub] = useState<SubTab>('summary')
  return (
    <div>
      <SubTabBar active={sub} onChange={setSub} />
      {sub === 'summary'      && <TrainingSummary />}
      {sub === 'transactions' && <TrainingTransactions />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALERTS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function AlertsTab() {
  const [days, setDays] = useState(30)

  const { data: expiringData, isLoading: exLoading } = useQuery({
    queryKey: ['reports', 'expiring', days],
    queryFn:  () => reportsApi.expiring(days),
  })
  const { data: subData } = useQuery({
    queryKey: ['reports', 'subscriptions'],
    queryFn:  reportsApi.subscriptions,
  })

  const expiringMembers = expiringData?.members ?? []
  const pendingPayments = (subData as { pending_payments?: number } | undefined)?.pending_payments
  const expiringToday   = expiringMembers.filter(m => m.days_left <= 0)
  const expiringWeek    = expiringMembers.filter(m => m.days_left > 0 && m.days_left <= 7)

  function urgencyColor(d: number) {
    if (d <= 0) return 'bg-red-50 border-red-200'
    if (d <= 3) return 'bg-orange-50 border-orange-200'
    if (d <= 7) return 'bg-amber-50 border-amber-200'
    return 'bg-sky-50 border-sky-200'
  }
  function urgencyBadge(d: number) {
    if (d <= 0) return 'bg-red-100 text-red-700'
    if (d <= 3) return 'bg-orange-100 text-orange-700'
    if (d <= 7) return 'bg-amber-100 text-amber-700'
    return 'bg-sky-100 text-sky-700'
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-red-200 bg-red-50/50 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-red-100 flex items-center justify-center shrink-0"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
            <div><p className="text-xs font-medium text-red-500 uppercase tracking-wide">Expiring Today</p><p className="text-3xl font-bold text-red-700">{expiringToday.length}</p></div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/50 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-amber-100 flex items-center justify-center shrink-0"><Clock className="h-5 w-5 text-amber-600" /></div>
            <div><p className="text-xs font-medium text-amber-600 uppercase tracking-wide">Expiring in 7 Days</p><p className="text-3xl font-bold text-amber-700">{expiringWeek.length}</p></div>
          </CardContent>
        </Card>
        <Card className="border-sky-200 bg-sky-50/50 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-sky-100 flex items-center justify-center shrink-0"><Calendar className="h-5 w-5 text-sky-600" /></div>
            <div><p className="text-xs font-medium text-sky-600 uppercase tracking-wide">Expiring in {days} Days</p><p className="text-3xl font-bold text-sky-700">{expiringData?.count ?? 0}</p></div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Show expiring within:</span>
        {[7, 15, 30, 60].map(d => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${days === d ? 'text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${days === d ? 'bg-sky-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            style={{}}
          >
            {d} days
          </button>
        ))}
      </div>

      <SectionCard title={`Expiring Memberships (next ${days} days)`} subtitle={`${expiringData?.count ?? 0} members need attention`}>
        {exLoading ? (
          <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : expiringMembers.length === 0 ? (
          <div className="text-center py-10">
            <UserCheck className="h-10 w-10 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No memberships expiring in the next {days} days 🎉</p>
          </div>
        ) : (
          <div className="space-y-2">
            {expiringMembers.map(m => (
              <div key={m.member_id} className={`rounded-lg border p-3 flex items-center justify-between gap-3 ${urgencyColor(m.days_left)}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{m.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${urgencyBadge(m.days_left)}`}>
                      {m.days_left <= 0 ? 'Expires today' : `${m.days_left}d left`}
                    </span>
                    <span className="text-[10px] bg-white/70 text-muted-foreground rounded px-1.5 py-0.5 border">{m.plan_name}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {m.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{m.phone}</span>}
                    {m.email && <span className="flex items-center gap-1 truncate"><Mail className="h-3 w-3" />{m.email}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">Expires</p>
                  <p className="text-xs font-semibold">{formatDate(m.end_date)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {pendingPayments !== undefined && pendingPayments > 0 && (
        <Card className="border-orange-200 bg-orange-50/60 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-orange-100 flex items-center justify-center shrink-0"><CreditCard className="h-5 w-5 text-orange-600" /></div>
            <div>
              <p className="text-xs font-medium text-orange-600 uppercase tracking-wide">Pending Payments</p>
              <p className="text-2xl font-bold text-orange-700">{pendingPayments}</p>
              <p className="text-xs text-orange-500 mt-0.5">Outstanding dues need collection</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT PAGE
// ═══════════════════════════════════════════════════════════════════════════════

const DATE_PRESETS: { id: Preset; label: string }[] = [
  { id: 'today',       label: 'Today'        },
  { id: 'yesterday',   label: 'Yesterday'    },
  { id: 'this_week',   label: 'This Week'    },
  { id: 'last_week',   label: 'Last Week'    },
  { id: 'this_month',  label: 'This Month'   },
  { id: 'last_month',  label: 'Last Month'   },
  { id: 'last_3m',     label: 'Last 3 Months'},
  { id: 'last_6m',     label: 'Last 6 Months'},
  { id: 'this_year',   label: 'This Year'    },
  { id: 'all_time',    label: 'All Time'     },
  { id: 'custom',      label: 'Custom Range' },
]

const DATE_FILTER_TABS: TabId[] = ['revenue', 'attendance']

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('revenue')
  const [preset, setPreset]       = useState<Preset>('this_month')
  const initDates = presetDates('this_month')
  const [from, setFrom] = useState(initDates.from)
  const [to,   setTo]   = useState(initDates.to)

  const handlePresetChange = (id: Preset) => {
    setPreset(id)
    if (id !== 'custom') {
      const d = presetDates(id)
      setFrom(d.from)
      setTo(d.to)
    }
  }

  const showDateFilter = DATE_FILTER_TABS.includes(activeTab)

  return (
    <div>
      {/* Header */}
      <div className="rounded-xl mb-6 border border-border/40 bg-background">
        <div className="px-6 py-5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
              <BarChart2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Reports & Analytics</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Business intelligence, member insights and operational analytics</p>
            </div>
          </div>
          {showDateFilter && (
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={preset}
                onChange={(e) => handlePresetChange(e.target.value as Preset)}
                className="h-8 rounded-lg border border-border bg-background text-foreground text-sm px-3 pr-8 cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {DATE_PRESETS.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
              {preset === 'custom' && (
                <>
                  <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-36 text-sm" />
                  <span className="text-muted-foreground text-xs">→</span>
                  <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-36 text-sm" />
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-1 px-6 pb-4 flex-wrap border-t border-border/40 pt-3">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-sky-50 text-sky-700 border border-sky-200'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        {activeTab === 'revenue'    && <RevenueTab from={from} to={to} />}
        {activeTab === 'members'    && <MembersTab />}
        {activeTab === 'attendance' && <AttendanceTab from={from} to={to} />}
        {activeTab === 'plans'      && <PlansTab />}
        {activeTab === 'training'   && <TrainingTab />}
        {activeTab === 'alerts'     && <AlertsTab />}
      </div>
    </div>
  )
}
