import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { reportsApi, type SubscriptionReport } from '@/api/reports.api'
import { subscriptionsApi } from '@/api/subscriptions.api'
import { plansApi } from '@/api/plans.api'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Subscription } from '@/types/subscription.types'
import type { Plan } from '@/types/plan.types'
import {
  CreditCard, Search, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, PauseCircle, Clock,
  Users, TrendingUp, AlertTriangle, RefreshCw,
} from 'lucide-react'

const PER_PAGE = 25

const STATUS_CFG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  active:    { label: 'Active',    cls: 'bg-green-50 text-green-700 border border-green-200',  icon: <CheckCircle2 className="w-3 h-3" /> },
  paused:    { label: 'Paused',    cls: 'bg-amber-50 text-amber-700 border border-amber-200',  icon: <PauseCircle className="w-3 h-3" /> },
  cancelled: { label: 'Cancelled', cls: 'bg-red-50 text-red-600 border border-red-200',        icon: <XCircle className="w-3 h-3" /> },
  expired:   { label: 'Expired',   cls: 'bg-gray-100 text-gray-500 border border-gray-200',    icon: <Clock className="w-3 h-3" /> },
}

function daysLeft(endDate: string): number {
  return Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000)
}

function memberName(s: Subscription): string {
  const u = s.member?.user
  if (u?.first_name || u?.last_name) return `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim()
  return `Member #${s.member_id}`
}

export default function MembershipsReportPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [planFilter, setPlanFilter] = useState('all')

  // Subscription report summary
  const { data: subReport } = useQuery({
    queryKey: ['reports', 'subscriptions'],
    queryFn: () => reportsApi.subscriptions(),
  })
  const summary = subReport as SubscriptionReport | undefined

  // Plans list (for filter + plan name lookup)
  const { data: plansData } = useQuery({
    queryKey: ['plans', 'all'],
    queryFn: () => plansApi.list(),
  })
  const plans: Plan[] = (plansData as any)?.plans ?? []
  const planMap = new Map(plans.map(p => [p.id, p]))

  // Subscriptions list
  const queryParams = {
    page,
    per_page: PER_PAGE,
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['subscriptions', 'report', queryParams],
    queryFn: () => subscriptionsApi.list(queryParams),
  })

  const rawSubs: Subscription[] = (data as any)?.data ?? (data as any)?.subscriptions ?? []
  const meta    = (data as any)?.meta
  const total   = meta?.total ?? 0
  const perPage = meta?.per_page ?? PER_PAGE

  // Client-side filter
  const subs = rawSubs.filter(s => {
    const matchSearch = !search.trim() ||
      memberName(s).toLowerCase().includes(search.toLowerCase()) ||
      (s.member?.user?.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (s.plan?.name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchPlan = planFilter === 'all' || String(s.plan_id) === planFilter
    return matchSearch && matchPlan
  })

  // Expiring soon (within 7 days, active only)
  const expiringSoon = rawSubs.filter(s =>
    s.status === 'active' && daysLeft(s.end_date) <= 7 && daysLeft(s.end_date) >= 0
  ).length

  return (
    <div className="space-y-6">

      {/* ── Edge-to-edge header ── */}
      <div className="relative overflow-hidden -mx-6 -mt-6 bg-gradient-to-r from-teal-600 via-cyan-600 to-sky-600 px-6 py-6 text-white">
        <div className="relative">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <CreditCard className="w-6 h-6 opacity-90" />
                <h1 className="text-xl font-bold">Memberships Report</h1>
              </div>
              <p className="text-sm text-white/80 max-w-2xl">
                Active subscriptions, plan-wise breakdown, renewal tracking, and expiring memberships — everything about your member lifecycle.
              </p>
            </div>
          </div>

          {/* Stat chips */}
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1 text-xs font-medium">
              <Users className="w-3.5 h-3.5" /> {total} total
            </div>
            {summary && (
              <>
                <div className="flex items-center gap-1.5 bg-green-400/30 backdrop-blur-sm border border-green-300/40 rounded-full px-3 py-1 text-xs font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-200" /> {summary.active} active
                </div>
                {summary.paused > 0 && (
                  <div className="flex items-center gap-1.5 bg-amber-400/30 backdrop-blur-sm border border-amber-300/40 rounded-full px-3 py-1 text-xs font-medium">
                    <PauseCircle className="w-3.5 h-3.5 text-amber-200" /> {summary.paused} paused
                  </div>
                )}
                {summary.cancelled > 0 && (
                  <div className="flex items-center gap-1.5 bg-red-400/20 backdrop-blur-sm border border-red-300/30 rounded-full px-3 py-1 text-xs font-medium">
                    <XCircle className="w-3.5 h-3.5 text-red-200" /> {summary.cancelled} cancelled
                  </div>
                )}
                {summary.expired > 0 && (
                  <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1 text-xs font-medium">
                    <Clock className="w-3.5 h-3.5" /> {summary.expired} expired
                  </div>
                )}
                <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1 text-xs font-medium">
                  <RefreshCw className="w-3.5 h-3.5" /> {summary.auto_renew_count} auto-renew
                </div>
                {expiringSoon > 0 && (
                  <div className="flex items-center gap-1.5 bg-amber-400/30 backdrop-blur-sm border border-amber-300/40 rounded-full px-3 py-1 text-xs font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-200" /> {expiringSoon} expiring ≤7 days
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute -right-2 -bottom-8 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
      </div>

      {/* ── Summary stat cards ── */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Active',    value: summary.active,          icon: <CheckCircle2 className="w-5 h-5 text-green-500" />,  bg: 'bg-green-50',  text: 'text-green-700' },
            { label: 'Paused',    value: summary.paused,          icon: <PauseCircle className="w-5 h-5 text-amber-500" />,   bg: 'bg-amber-50',  text: 'text-amber-700' },
            { label: 'Cancelled', value: summary.cancelled,       icon: <XCircle className="w-5 h-5 text-red-500" />,         bg: 'bg-red-50',    text: 'text-red-700' },
            { label: 'Expiring (7d)', value: summary.expiring_in_7_days, icon: <AlertTriangle className="w-5 h-5 text-orange-500" />, bg: 'bg-orange-50', text: 'text-orange-700' },
          ].map(({ label, value, icon, bg, text }) => (
            <Card key={label} className={`p-4 ${bg} border-0 shadow-sm`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{label}</p>
                  <p className={`text-2xl font-bold mt-0.5 ${text}`}>{value}</p>
                </div>
                {icon}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Plan breakdown ── */}
      {summary?.by_plan && summary.by_plan.length > 0 && (
        <Card className="shadow-lg shadow-gray-200/80 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b bg-teal-50/60 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-teal-600" />
            <p className="font-medium text-sm text-teal-700">Active Subscribers by Plan</p>
          </div>
          <div className="p-4">
            <div className="space-y-3">
              {summary.by_plan.map(p => {
                const planInfo = planMap.get(p.plan_id)
                const maxCount = Math.max(...summary.by_plan.map(x => x.count), 1)
                const pct = Math.round((p.count / maxCount) * 100)
                return (
                  <div key={p.plan_id} className="flex items-center gap-3">
                    <div className="w-32 shrink-0">
                      <p className="text-sm font-medium truncate">{p.plan_name}</p>
                      {planInfo && (
                        <p className="text-xs text-muted-foreground">{formatCurrency(planInfo.price_amount)}</p>
                      )}
                    </div>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-sm font-semibold w-8 text-right">{p.count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>
      )}

      {isError && <p className="text-sm text-destructive">Failed to load subscriptions.</p>}

      {/* ── Subscriptions table ── */}
      <Card className="shadow-lg shadow-gray-200/80 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-4 py-3 border-b bg-teal-50/60">
          <p className="font-medium text-sm text-teal-700 whitespace-nowrap flex items-center gap-1.5">
            <CreditCard className="w-4 h-4" />
            {isLoading ? 'Loading…' : `${subs.length} subscription${subs.length !== 1 ? 's' : ''}`}
          </p>
          <div className="flex items-center gap-2 flex-1 justify-end">
            <div className="relative w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-teal-400" />
              <Input placeholder="Name, email, plan…" value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }} className="pl-9" />
            </div>
            <select value={planFilter} onChange={e => { setPlanFilter(e.target.value); setPage(1) }}
              className="h-9 w-40 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
              <option value="all">All plans</option>
              {plans.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
            </select>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
              className="h-9 w-36 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="cancelled">Cancelled</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gradient-to-r from-teal-50 via-cyan-50 to-sky-50">
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Member</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Plan</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Start Date</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700">End Date</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Days Left</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Auto-Renew</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {[1,2,3,4,5,6,7].map(c => (
                    <td key={c} className="px-4 py-3">
                      <div className="h-4 bg-gray-100 rounded animate-pulse w-24" />
                    </td>
                  ))}
                </tr>
              ))}

              {!isLoading && subs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center">
                    <CreditCard className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-muted-foreground text-sm font-medium">No subscriptions found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {search || statusFilter !== 'all' || planFilter !== 'all'
                        ? 'Try adjusting your search or filters.'
                        : 'Subscriptions will appear here once created.'}
                    </p>
                  </td>
                </tr>
              )}

              {!isLoading && subs.map((s, idx) => {
                const name   = memberName(s)
                const email  = s.member?.user?.email
                const dl     = daysLeft(s.end_date)
                const sCfg   = STATUS_CFG[s.status] ?? { label: s.status, cls: 'bg-gray-100 text-gray-600', icon: null }
                const urgent = s.status === 'active' && dl <= 7 && dl >= 0

                return (
                  <tr key={s.id ?? idx}
                    className={`hover:bg-teal-50/40 transition-colors ${urgent ? 'bg-orange-50/30' : ''}`}>

                    <td className="px-4 py-3">
                      <p className="font-medium leading-tight">{name}</p>
                      {email && <p className="text-xs text-muted-foreground mt-0.5">{email}</p>}
                    </td>

                    <td className="px-4 py-3">
                      <p className="font-medium">{s.plan?.name ?? `Plan #${s.plan_id}`}</p>
                      {s.plan?.price_amount != null && (
                        <p className="text-xs text-muted-foreground">{formatCurrency(s.plan.price_amount)}</p>
                      )}
                    </td>

                    <td className="px-4 py-3 text-muted-foreground text-sm">{formatDate(s.start_date)}</td>

                    <td className="px-4 py-3 text-muted-foreground text-sm">{formatDate(s.end_date)}</td>

                    <td className="px-4 py-3">
                      {s.status === 'active' ? (
                        <span className={`text-sm font-medium ${dl <= 0 ? 'text-red-600' : dl <= 7 ? 'text-orange-600' : dl <= 30 ? 'text-amber-600' : 'text-green-700'}`}>
                          {dl <= 0 ? 'Expired' : `${dl}d`}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {s.auto_renew ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                          <RefreshCw className="w-3 h-3" /> On
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Off</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${sCfg.cls}`}>
                        {sCfg.icon} {sCfg.label}
                      </span>
                      {urgent && (
                        <p className="text-[10px] text-orange-600 font-medium mt-0.5 flex items-center gap-0.5">
                          <AlertTriangle className="w-3 h-3" /> Expiring soon
                        </p>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!isLoading && total > 0 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t bg-muted/20 text-xs text-muted-foreground">
            <span>Showing {Math.min((page-1)*perPage+1, total)}–{Math.min(page*perPage, total)} of {total}</span>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7" title="Previous page"
                onClick={() => setPage(p => p-1)} disabled={page === 1}>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <span className="flex items-center px-2 font-medium">Page {page}</span>
              <Button variant="outline" size="icon" className="h-7 w-7" title="Next page"
                onClick={() => setPage(p => p+1)} disabled={page*perPage >= total}>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
