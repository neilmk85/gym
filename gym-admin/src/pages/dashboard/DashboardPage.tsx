import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  Users, TrendingUp, TrendingDown, DollarSign, CreditCard,
  UserPlus, Calendar, Activity, AlertTriangle, Dumbbell, ChevronRight,
  Flame, Star, Clock,
} from 'lucide-react'
import { reportsApi } from '@/api/reports.api'
import { QUERY_KEYS } from '@/lib/constants'
import { formatCurrency } from '@/lib/utils'
// date helpers (no date-fns dependency)
function fmtDate(d: Date, opts: Intl.DateTimeFormatOptions) {
  return d.toLocaleDateString('en-GB', opts)
}
function isoToDate(iso: string) {
  // parse yyyy-MM-dd safely without timezone shift
  const [y, m, day] = iso.split('-').map(Number)
  return new Date(y, m - 1, day)
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function isoDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function generateDailyAxis(from: Date, to: Date): string[] {
  const days: string[] = []
  const cur = new Date(from)
  while (cur <= to) {
    days.push(isoDate(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return days
}

function generateMonthlyAxis(months = 12): string[] {
  const result: string[] = []
  const now = new Date()
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    result.push(`${y}-${m}`)
  }
  return result
}

// ─── colour constants ─────────────────────────────────────────────────────────

const PIE_MEMBER_COLORS  = ['#10b981', '#f59e0b', '#ef4444', '#6366f1']
const PIE_PLAN_COLORS    = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#eab308']

// ─── sub-components ───────────────────────────────────────────────────────────

interface KpiCardProps {
  title: string
  value: string | number
  sub?: string
  icon: React.ReactNode
  trend?: number       // positive = up, negative = down, undefined = no arrow
  trendLabel?: string
  gradient: string
  href?: string
}

function KpiCard({ title, value, sub, icon, trend, trendLabel, gradient, href }: KpiCardProps) {
  const inner = (
    <div
      className="relative overflow-hidden rounded-2xl p-5 text-white shadow-lg hover:shadow-xl transition-shadow"
      style={{ background: gradient }}
    >
      {/* decorative circle */}
      <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10 pointer-events-none" />
      <div className="absolute -right-1 -top-1 h-14 w-14 rounded-full bg-white/10 pointer-events-none" />

      <div className="relative z-10 flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-white/70">{title}</p>
          <p className="mt-1 text-3xl font-bold">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-white/60">{sub}</p>}
          {trend !== undefined && (
            <div className="mt-2 flex items-center gap-1 text-xs">
              {trend >= 0
                ? <TrendingUp className="h-3.5 w-3.5 text-green-300" />
                : <TrendingDown className="h-3.5 w-3.5 text-red-300" />}
              <span className={trend >= 0 ? 'text-green-300' : 'text-red-300'}>
                {trend >= 0 ? '+' : ''}{trend}%
              </span>
              {trendLabel && <span className="text-white/50">{trendLabel}</span>}
            </div>
          )}
        </div>
        <div className="rounded-xl bg-white/20 p-2.5">{icon}</div>
      </div>
    </div>
  )

  return href ? <Link to={href} className="block">{inner}</Link> : inner
}

interface SectionCardProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  action?: React.ReactNode
}

function SectionCard({ title, subtitle, children, action }: SectionCardProps) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border/40 px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

// ─── custom tooltip ───────────────────────────────────────────────────────────

function CurrencyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-border/50 bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-foreground">{label}</p>
      <p className="text-emerald-500">{formatCurrency(payload[0]?.value ?? 0)}</p>
    </div>
  )
}

function CountTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-border/50 bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-foreground">{label}</p>
      <p className="text-violet-500">{payload[0]?.value} check-ins</p>
    </div>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const today      = new Date()
  const from30     = new Date(today); from30.setDate(today.getDate() - 29)
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const monthEnd   = new Date(today.getFullYear(), today.getMonth() + 1, 0)

  const { data: stats } = useQuery({
    queryKey: QUERY_KEYS.dashboardStats,
    queryFn:  reportsApi.dashboard,
    refetchInterval: 5 * 60 * 1000,
  })

  const { data: revenue } = useQuery({
    queryKey: QUERY_KEYS.revenueReport({ from: isoDate(from30), to: isoDate(today) }),
    queryFn:  () => reportsApi.revenue({ from: isoDate(from30), to: isoDate(today) }),
  })

  const { data: attendance } = useQuery({
    queryKey: QUERY_KEYS.attendanceReport({ from: isoDate(monthStart), to: isoDate(monthEnd) }),
    queryFn:  () => reportsApi.attendance({ from: isoDate(monthStart), to: isoDate(monthEnd) }),
  })

  const { data: members } = useQuery({
    queryKey: QUERY_KEYS.membersReport(),
    queryFn:  reportsApi.members,
  })

  const { data: subs } = useQuery({
    queryKey: ['reports', 'subscriptions'],
    queryFn:  reportsApi.subscriptions,
  })

  const { data: expiring } = useQuery({
    queryKey: ['reports', 'expiring', 14],
    queryFn:  () => reportsApi.expiring(14),
  })

  const { data: trainerReport } = useQuery({
    queryKey: ['reports', 'trainers'],
    queryFn:  reportsApi.trainers,
  })

  // ── derived stats ──────────────────────────────────────────────────────────

  const s = stats as any

  const revTrend = useMemo(() => {
    if (!s?.revenue_this_month || !s?.revenue_last_month) return undefined
    if (s.revenue_last_month === 0) return undefined
    return Math.round(((s.revenue_this_month - s.revenue_last_month) / s.revenue_last_month) * 100)
  }, [s])

  // revenue by day — fill zeros for all 30 days
  const revenueChartData = useMemo(() => {
    const byDay: Record<string, number> = {}
    revenue?.by_day?.forEach(d => { byDay[d.date] = d.amount })
    return generateDailyAxis(from30, today).map(date => ({
      date: fmtDate(isoToDate(date), { day: '2-digit', month: 'short' }),
      amount: byDay[date] ?? 0,
    }))
  }, [revenue, from30, today])

  // attendance by day — fill zeros for current month
  const attendanceChartData = useMemo(() => {
    const byDay: Record<string, number> = {}
    attendance?.by_day?.forEach(d => { byDay[d.date] = d.count })
    return generateDailyAxis(monthStart, today).map(date => ({
      date: isoToDate(date).getDate().toString().padStart(2, '0'),
      count: byDay[date] ?? 0,
    }))
  }, [attendance, monthStart, today])

  // member growth by month — last 12 months
  const growthChartData = useMemo(() => {
    const byMonth: Record<string, number> = {}
    members?.growth_by_month?.forEach(m => { byMonth[m.month] = m.new })
    return generateMonthlyAxis(12).map(month => ({
      month: fmtDate(isoToDate(month + '-01'), { month: 'short', year: '2-digit' }),
      new: byMonth[month] ?? 0,
    }))
  }, [members])

  // member status pie
  const memberPieData = useMemo(() => [
    { name: 'Active',    value: members?.active_members    ?? 0 },
    { name: 'Paused',    value: members?.paused_members    ?? 0 },
    { name: 'Cancelled', value: members?.cancelled_members ?? 0 },
    { name: 'Expired',   value: members?.expired_members   ?? 0 },
  ].filter(d => d.value > 0), [members])

  // subscription by plan pie
  const planPieData = useMemo(() =>
    (subs?.by_plan ?? []).map(p => ({ name: p.plan_name, value: p.count })),
  [subs])

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">

      {/* ── hero banner ── */}
      <div
        className="relative overflow-hidden px-6 py-8 text-white"
        style={{ background: 'linear-gradient(135deg, #042B59 0%, #0553B1 52%, #027DFD 100%)' }}
      >
        {/* decorative blobs */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-white/5 blur-2xl" />

        <div className="relative z-10 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-white/60">
              {today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <h1 className="mt-0.5 text-2xl font-bold sm:text-3xl">
              {getGreeting()}, Coach! 👋
            </h1>
            <p className="mt-1 text-sm text-white/70">
              Here's what's happening at your gym today.
            </p>
          </div>

          {/* quick stats strip */}
          <div className="mt-4 flex flex-wrap gap-4 sm:mt-0">
            {[
              { icon: <Flame className="h-4 w-4" />,    label: 'Check-ins today', value: s?.today_check_ins ?? 0 },
              { icon: <Calendar className="h-4 w-4" />, label: 'Classes today',   value: s?.upcoming_classes ?? 0 },
              { icon: <Dumbbell className="h-4 w-4" />, label: 'Active trainers', value: s?.active_trainers ?? 0 },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm backdrop-blur-sm">
                <span className="text-white/70">{item.icon}</span>
                <span className="font-bold">{item.value}</span>
                <span className="hidden text-white/60 sm:block">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── page body ── */}
      <div className="space-y-6 px-6 py-6">

        {/* ── expiring alert strip ── */}
        {(expiring?.count ?? 0) > 0 && (
          <Link to="/memberships" className="group flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 transition-colors hover:bg-amber-100 dark:border-amber-800/40 dark:bg-amber-900/20 dark:hover:bg-amber-900/30">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40">
                <AlertTriangle className="h-4.5 w-4.5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  {expiring?.count} membership{expiring!.count !== 1 ? 's' : ''} expiring within 14 days
                </p>
                <p className="text-xs text-amber-600/80 dark:text-amber-400/80">
                  {expiring?.members.slice(0, 3).map(m => m.name).join(', ')}
                  {(expiring?.count ?? 0) > 3 ? ` +${expiring!.count - 3} more` : ''}
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-amber-500 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard
            title="Total Members"
            value={s?.total_members ?? 0}
            sub="all time"
            icon={<Users className="h-5 w-5 text-white" />}
            gradient="linear-gradient(135deg, #3b82f6, #1d4ed8)"
            href="/members"
          />
          <KpiCard
            title="Active"
            value={s?.active_members ?? 0}
            sub="right now"
            icon={<Activity className="h-5 w-5 text-white" />}
            gradient="linear-gradient(135deg, #10b981, #059669)"
            href="/members"
          />
          <KpiCard
            title="Revenue"
            value={formatCurrency(s?.revenue_this_month ?? 0)}
            sub="this month"
            icon={<DollarSign className="h-5 w-5 text-white" />}
            trend={revTrend}
            trendLabel="vs last month"
            gradient="linear-gradient(135deg, #8b5cf6, #6d28d9)"
            href="/payments"
          />
          <KpiCard
            title="Subscriptions"
            value={s?.active_subscriptions ?? 0}
            sub="active plans"
            icon={<CreditCard className="h-5 w-5 text-white" />}
            gradient="linear-gradient(135deg, #f59e0b, #d97706)"
            href="/memberships"
          />
          <KpiCard
            title="New Members"
            value={s?.new_members_this_month ?? 0}
            sub="this month"
            icon={<UserPlus className="h-5 w-5 text-white" />}
            gradient="linear-gradient(135deg, #ec4899, #be185d)"
            href="/members"
          />
          <KpiCard
            title="Pending Pay"
            value={s?.pending_payments ?? 0}
            sub="awaiting"
            icon={<Clock className="h-5 w-5 text-white" />}
            gradient="linear-gradient(135deg, #ef4444, #b91c1c)"
            href="/payments"
          />
        </div>

        {/* ── charts row 1: revenue + member status ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* revenue area chart */}
          <div className="lg:col-span-2">
            <SectionCard
              title="Revenue — Last 30 Days"
              subtitle={`Net ${formatCurrency(revenue?.net_revenue ?? 0)} · ${revenue?.transaction_count ?? 0} transactions`}
            >
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={revenueChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false} axisLine={false}
                    interval={4}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false} axisLine={false}
                    tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                  />
                  <Tooltip content={<CurrencyTooltip />} />
                  <Area
                    type="monotone" dataKey="amount"
                    stroke="#10b981" strokeWidth={2}
                    fill="url(#revGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </SectionCard>
          </div>

          {/* member status donut */}
          <SectionCard
            title="Member Status"
            subtitle={`${members?.total_members ?? 0} total members`}
          >
            {memberPieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={memberPieData} cx="50%" cy="50%"
                      innerRadius={48} outerRadius={70}
                      paddingAngle={3} dataKey="value"
                    >
                      {memberPieData.map((_, i) => (
                        <Cell key={i} fill={PIE_MEMBER_COLORS[i % PIE_MEMBER_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number, n: string) => [v, n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                  {memberPieData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-1.5 text-xs">
                      <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: PIE_MEMBER_COLORS[i % PIE_MEMBER_COLORS.length] }} />
                      <span className="text-muted-foreground">{d.name}</span>
                      <span className="ml-auto font-medium">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">No data</div>
            )}
          </SectionCard>
        </div>

        {/* ── charts row 2: attendance + subscription by plan ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* attendance bar */}
          <div className="lg:col-span-2">
            <SectionCard
              title={`Attendance — ${today.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`}
              subtitle={`${attendance?.total_check_ins ?? 0} check-ins · avg ${attendance?.avg_daily_check_ins?.toFixed(1) ?? 0}/day`}
            >
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={attendanceChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barSize={8}>
                  <defs>
                    <linearGradient id="attGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#6d28d9" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false} axisLine={false}
                    interval={2}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false} axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CountTooltip />} />
                  <Bar dataKey="count" fill="url(#attGrad)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          </div>

          {/* subscription by plan donut */}
          <SectionCard
            title="Subscriptions by Plan"
            subtitle={`${subs?.active ?? 0} active · ${subs?.expiring_in_7_days ?? 0} expiring soon`}
          >
            {planPieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={planPieData} cx="50%" cy="50%"
                      innerRadius={48} outerRadius={70}
                      paddingAngle={3} dataKey="value"
                    >
                      {planPieData.map((_, i) => (
                        <Cell key={i} fill={PIE_PLAN_COLORS[i % PIE_PLAN_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number, n: string) => [v, n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 space-y-1">
                  {planPieData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-1.5 text-xs">
                      <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: PIE_PLAN_COLORS[i % PIE_PLAN_COLORS.length] }} />
                      <span className="truncate text-muted-foreground">{d.name}</span>
                      <span className="ml-auto font-medium">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">No data</div>
            )}
          </SectionCard>
        </div>

        {/* ── charts row 3: member growth full width ── */}
        <SectionCard
          title="Member Growth — Last 12 Months"
          subtitle={`${members?.new_this_month ?? 0} new members this month`}
          action={
            <Link to="/reports/members" className="flex items-center gap-1 text-xs text-primary hover:underline">
              Full report <ChevronRight className="h-3 w-3" />
            </Link>
          }
        >
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={growthChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false} axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false} axisLine={false}
                allowDecimals={false}
              />
              <Tooltip formatter={(v: number) => [v, 'New members']} />
              <Area
                type="monotone" dataKey="new"
                stroke="#3b82f6" strokeWidth={2}
                fill="url(#growthGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </SectionCard>

        {/* ── bottom row: trainers + top stats ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

          {/* trainer cards */}
          <SectionCard
            title="Trainer Overview"
            subtitle={`${trainerReport?.active_trainers ?? 0} active · ${trainerReport?.assigned_members ?? 0} assigned members`}
            action={
              <Link to="/trainers" className="flex items-center gap-1 text-xs text-primary hover:underline">
                View all <ChevronRight className="h-3 w-3" />
              </Link>
            }
          >
            <div className="space-y-3">
              {(trainerReport?.trainers ?? []).filter(t => t.is_active).slice(0, 4).map(t => (
                <Link
                  key={t.trainer_id}
                  to={`/trainers/${t.trainer_id}`}
                  className="group flex items-center gap-3 rounded-xl border border-border/40 p-3 transition-colors hover:bg-muted/40"
                >
                  {/* avatar */}
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white flex-shrink-0">
                    {t.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t.specializations?.slice(0, 2).join(' · ') || 'General'}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-foreground">{t.assigned_members}</p>
                    <p className="text-xs text-muted-foreground">clients</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                </Link>
              ))}
              {(trainerReport?.trainers ?? []).filter(t => t.is_active).length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-6">No active trainers</p>
              )}
            </div>
          </SectionCard>

          {/* quick metrics */}
          <SectionCard title="Quick Metrics" subtitle="Snapshot of key numbers">
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  label: 'Avg Daily Check-ins',
                  value: attendance?.avg_daily_check_ins?.toFixed(1) ?? '—',
                  icon: <Activity className="h-4 w-4" />,
                  color: 'text-violet-500 bg-violet-50 dark:bg-violet-900/20',
                },
                {
                  label: 'Peak Hour',
                  value: attendance?.peak_hour != null ? `${attendance.peak_hour}:00` : '—',
                  icon: <Flame className="h-4 w-4" />,
                  color: 'text-orange-500 bg-orange-50 dark:bg-orange-900/20',
                },
                {
                  label: 'Unassigned Members',
                  value: trainerReport?.unassigned_members ?? '—',
                  icon: <Users className="h-4 w-4" />,
                  color: 'text-red-500 bg-red-50 dark:bg-red-900/20',
                },
                {
                  label: 'Auto-renew Subs',
                  value: subs?.auto_renew_count ?? '—',
                  icon: <Star className="h-4 w-4" />,
                  color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20',
                },
                {
                  label: 'Unique Visitors',
                  value: attendance?.unique_members ?? '—',
                  icon: <UserPlus className="h-4 w-4" />,
                  color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20',
                },
                {
                  label: 'Expiring (14d)',
                  value: expiring?.count ?? '—',
                  icon: <AlertTriangle className="h-4 w-4" />,
                  color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20',
                },
              ].map(m => (
                <div key={m.label} className="flex items-center gap-3 rounded-xl border border-border/40 p-3">
                  <div className={`rounded-lg p-2 ${m.color}`}>{m.icon}</div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold">{m.value}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
