import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { CSVExportButton } from '@/components/shared/CSVExportButton'
import { reportsApi } from '@/api/reports.api'
import { paymentsApi } from '@/api/payments.api'
import { QUERY_KEYS } from '@/lib/constants'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
import type { Payment } from '@/types/payment.types'
import {
  TrendingUp, IndianRupee, ArrowDownLeft, Receipt,
  CreditCard, Banknote, Smartphone, Building, ChevronDown,
  ArrowUpRight, Minus,
} from 'lucide-react'

// ── Date presets ──────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, '0') }
function toStr(d: Date) { return d.toISOString().split('T')[0] }

const PRESETS = [
  { label: 'Today',         value: 'today' },
  { label: 'Yesterday',     value: 'yesterday' },
  { label: 'Last 7 Days',   value: 'last7' },
  { label: 'Last 30 Days',  value: 'last30' },
  { label: 'This Month',    value: 'thisMonth' },
  { label: 'Last Month',    value: 'lastMonth' },
  { label: 'This Quarter',  value: 'thisQuarter' },
  { label: 'This Year',     value: 'thisYear' },
]

function getPresetDates(preset: string): { from: string; to: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()

  switch (preset) {
    case 'today':
      return { from: toStr(now), to: toStr(now) }
    case 'yesterday': {
      const d = new Date(now); d.setDate(d.getDate() - 1)
      return { from: toStr(d), to: toStr(d) }
    }
    case 'last7': {
      const d = new Date(now); d.setDate(d.getDate() - 6)
      return { from: toStr(d), to: toStr(now) }
    }
    case 'last30': {
      const d = new Date(now); d.setDate(d.getDate() - 29)
      return { from: toStr(d), to: toStr(now) }
    }
    case 'thisMonth':
      return { from: `${y}-${pad(m + 1)}-01`, to: toStr(now) }
    case 'lastMonth': {
      const lm = m === 0 ? 11 : m - 1
      const ly = m === 0 ? y - 1 : y
      const lastDay = new Date(ly, lm + 1, 0).getDate()
      return { from: `${ly}-${pad(lm + 1)}-01`, to: `${ly}-${pad(lm + 1)}-${pad(lastDay)}` }
    }
    case 'thisQuarter': {
      const qm = Math.floor(m / 3) * 3
      return { from: `${y}-${pad(qm + 1)}-01`, to: toStr(now) }
    }
    case 'thisYear':
      return { from: `${y}-01-01`, to: toStr(now) }
    default: {
      const d = new Date(now); d.setDate(d.getDate() - 29)
      return { from: toStr(d), to: toStr(now) }
    }
  }
}

// ── Payment method config ─────────────────────────────────────────────────────

const METHOD_CFG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  cash:          { label: 'Cash',          icon: <Banknote className="w-3.5 h-3.5" />,   color: 'bg-green-100 text-green-700 border-green-200' },
  upi:           { label: 'UPI',           icon: <Smartphone className="w-3.5 h-3.5" />, color: 'bg-violet-100 text-violet-700 border-violet-200' },
  card:          { label: 'Card',          icon: <CreditCard className="w-3.5 h-3.5" />, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  bank_transfer: { label: 'Bank Transfer', icon: <Building className="w-3.5 h-3.5" />,   color: 'bg-sky-100 text-sky-700 border-sky-200' },
  razorpay:      { label: 'Razorpay',      icon: <CreditCard className="w-3.5 h-3.5" />, color: 'bg-cyan-100 text-[#007a99] border-cyan-200' },
  other:         { label: 'Other',         icon: <Receipt className="w-3.5 h-3.5" />,    color: 'bg-gray-100 text-gray-600 border-gray-200' },
}

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700 border-green-200' },
  pending:   { label: 'Pending',   color: 'bg-amber-100 text-amber-700 border-amber-200' },
  failed:    { label: 'Failed',    color: 'bg-red-100 text-red-600 border-red-200' },
  refunded:  { label: 'Refunded',  color: 'bg-gray-100 text-gray-500 border-gray-200' },
}

function MethodBadge({ method }: { method: string }) {
  const cfg = METHOD_CFG[method] ?? METHOD_CFG.other
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.color}`}>
      {cfg.icon} {cfg.label}
    </span>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RevenueReportPage() {
  const [preset, setPreset] = useState('last30')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const { from, to } = useMemo(() => getPresetDates(preset), [preset])

  const presetLabel = PRESETS.find(p => p.value === preset)?.label ?? 'Last 30 Days'

  // Revenue summary from reports API
  const { data: reportData, isLoading: reportLoading } = useQuery({
    queryKey: QUERY_KEYS.revenueReport({ from, to }),
    queryFn: () => reportsApi.revenue({ from, to }),
  })

  // Transactions list
  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: ['payments', 'revenue-report', from, to],
    queryFn: () => paymentsApi.list({ from, to, per_page: 100 }),
  })

  const report = reportData as {
    total_revenue?: number
    net_revenue?: number
    total_refunds?: number
    transaction_count?: number
    by_method?: { method: string; amount: number; count: number }[]
    by_day?: { date: string; amount: number; count: number }[]
  } | undefined

  const payments: Payment[] = (paymentsData as any)?.data ?? (paymentsData as any)?.payments ?? []
  const byMethod = report?.by_method ?? []
  const byDay = report?.by_day ?? []

  const totalRevenue    = report?.total_revenue ?? 0
  const netRevenue      = report?.net_revenue ?? 0
  const totalRefunds    = report?.total_refunds ?? 0
  const txCount         = report?.transaction_count ?? payments.length
  const avgTx           = txCount > 0 ? totalRevenue / txCount : 0
  const topDay          = byDay.length > 0 ? byDay.reduce((a, b) => a.amount > b.amount ? a : b) : null

  const isLoading = reportLoading

  return (
    <div className="space-y-6">

      {/* ── Gradient header ── */}
      <div className="relative overflow-hidden -mx-6 -mt-6 bg-gradient-to-br from-emerald-700 via-teal-700 to-cyan-700 text-white">
        <div className="relative px-6 pt-6">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <p className="text-[11px] font-semibold tracking-widest uppercase text-white/55 mb-1.5">Reports</p>
              <div className="flex items-center gap-2.5 mb-1">
                <IndianRupee className="w-5 h-5 opacity-80" />
                <h1 className="text-2xl font-bold tracking-tight">Revenue Report</h1>
              </div>
              <p className="text-sm text-white/65">
                {from} → {to}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Preset dropdown */}
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(v => !v)}
                  className="flex items-center gap-2 bg-white/15 hover:bg-white/25 border border-white/30 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  {presetLabel}
                  <ChevronDown className="w-4 h-4" />
                </button>
                {dropdownOpen && (
                  <div className="absolute right-0 mt-1 w-44 rounded-lg bg-white shadow-lg border border-gray-100 z-50 overflow-hidden">
                    {PRESETS.map(p => (
                      <button
                        key={p.value}
                        onClick={() => { setPreset(p.value); setDropdownOpen(false) }}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                          preset === p.value
                            ? 'bg-emerald-50 text-emerald-700 font-medium'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <CSVExportButton
                endpoint="/reports/revenue"
                params={{ from, to }}
                filename={`revenue-report-${from}-${to}.csv`}
              />
            </div>
          </div>
        </div>

        {/* Stat strip */}
        {!isLoading && (
          <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-white/15 border-t border-white/15">
            <div className="px-5 py-4">
              <p className="text-xl font-bold leading-none">{formatCurrency(totalRevenue)}</p>
              <p className="text-xs font-medium text-white/85 mt-1">Total Revenue</p>
              <p className="text-xs text-white/45 mt-0.5">gross collected</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-xl font-bold leading-none text-emerald-300">{formatCurrency(netRevenue)}</p>
              <p className="text-xs font-medium text-white/85 mt-1">Net Revenue</p>
              <p className="text-xs text-white/45 mt-0.5">after refunds</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-xl font-bold leading-none text-sky-300">{txCount}</p>
              <p className="text-xs font-medium text-white/85 mt-1">Transactions</p>
              <p className="text-xs text-white/45 mt-0.5">completed payments</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-xl font-bold leading-none text-yellow-300">{formatCurrency(avgTx)}</p>
              <p className="text-xs font-medium text-white/85 mt-1">Avg per Transaction</p>
              <p className="text-xs text-white/45 mt-0.5">per payment</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-xl font-bold leading-none text-red-300">{formatCurrency(totalRefunds)}</p>
              <p className="text-xs font-medium text-white/85 mt-1">Total Refunds</p>
              <p className="text-xs text-white/45 mt-0.5">money returned</p>
            </div>
          </div>
        )}

        <div className="absolute -right-6 -top-6 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute right-20 -bottom-8 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />
      </div>

      {/* ── Insight cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Top earning day */}
        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-teal-50">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-emerald-100">
                <ArrowUpRight className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-sm font-semibold text-emerald-800">Best Day</p>
            </div>
            {isLoading ? <Skeleton className="h-8 w-32" /> : topDay ? (
              <>
                <p className="text-2xl font-bold text-emerald-700">{formatCurrency(topDay.amount)}</p>
                <p className="text-xs text-emerald-600 mt-1">{formatDate(topDay.date)} · {topDay.count} transactions</p>
              </>
            ) : <p className="text-muted-foreground text-sm">No data</p>}
          </CardContent>
        </Card>

        {/* Refund rate */}
        <Card className="border-0 shadow-sm bg-gradient-to-br from-red-50 to-rose-50">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-red-100">
                <ArrowDownLeft className="w-4 h-4 text-red-600" />
              </div>
              <p className="text-sm font-semibold text-red-800">Refund Rate</p>
            </div>
            {isLoading ? <Skeleton className="h-8 w-24" /> : (
              <>
                <p className="text-2xl font-bold text-red-600">
                  {totalRevenue > 0 ? ((totalRefunds / totalRevenue) * 100).toFixed(1) : '0.0'}%
                </p>
                <p className="text-xs text-red-500 mt-1">{formatCurrency(totalRefunds)} refunded of {formatCurrency(totalRevenue)}</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Top method */}
        <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-indigo-50">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-violet-100">
                <Smartphone className="w-4 h-4 text-violet-600" />
              </div>
              <p className="text-sm font-semibold text-violet-800">Top Payment Method</p>
            </div>
            {isLoading ? <Skeleton className="h-8 w-24" /> : byMethod.length > 0 ? (() => {
              const top = byMethod.reduce((a, b) => a.amount > b.amount ? a : b)
              const cfg = METHOD_CFG[top.method] ?? METHOD_CFG.other
              return (
                <>
                  <p className="text-2xl font-bold text-violet-700">{cfg.label}</p>
                  <p className="text-xs text-violet-500 mt-1">{formatCurrency(top.amount)} · {top.count} transactions</p>
                </>
              )
            })() : <p className="text-muted-foreground text-sm">No data</p>}
          </CardContent>
        </Card>
      </div>

      {/* ── Revenue by payment method ── */}
      {(byMethod.length > 0 || isLoading) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Revenue by Payment Method</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-sidebar">
                <tr>
                  {['Method', 'Transactions', 'Revenue', 'Share'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-light text-sidebar-foreground uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    {[1,2,3,4].map(j => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>)}
                  </tr>
                )) : byMethod.map(row => {
                  const share = totalRevenue > 0 ? (row.amount / totalRevenue) * 100 : 0
                  return (
                    <tr key={row.method} className="hover:bg-muted/30">
                      <td className="px-4 py-3"><MethodBadge method={row.method} /></td>
                      <td className="px-4 py-3 text-muted-foreground">{row.count}</td>
                      <td className="px-4 py-3 font-semibold">{formatCurrency(row.amount)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${share}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground">{share.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* ── Daily breakdown ── */}
      {(byDay.length > 0 || isLoading) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Daily Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-sidebar sticky top-0">
                  <tr>
                    {['Date', 'Transactions', 'Revenue', 'vs Avg'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-light text-sidebar-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {[1,2,3,4].map(j => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>)}
                    </tr>
                  )) : (() => {
                    const avg = byDay.length > 0 ? byDay.reduce((s, d) => s + d.amount, 0) / byDay.length : 0
                    return byDay.slice().sort((a, b) => b.date.localeCompare(a.date)).map(row => {
                      const diff = row.amount - avg
                      return (
                        <tr key={row.date} className="hover:bg-muted/30">
                          <td className="px-4 py-3 text-muted-foreground">{formatDate(row.date)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{row.count}</td>
                          <td className="px-4 py-3 font-semibold">{formatCurrency(row.amount)}</td>
                          <td className="px-4 py-3">
                            {diff === 0 ? (
                              <span className="text-xs text-muted-foreground flex items-center gap-1"><Minus className="w-3 h-3" /> avg</span>
                            ) : diff > 0 ? (
                              <span className="text-xs text-emerald-600 flex items-center gap-1"><ArrowUpRight className="w-3 h-3" />+{formatCurrency(diff)}</span>
                            ) : (
                              <span className="text-xs text-red-500 flex items-center gap-1"><ArrowDownLeft className="w-3 h-3" />{formatCurrency(diff)}</span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  })()}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Transactions table ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Transactions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-sidebar">
                <tr>
                  {['Member', 'Plan', 'Amount', 'Method', 'Status', 'Paid On'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-light text-sidebar-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {paymentsLoading ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {[1,2,3,4,5,6].map(j => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>)}
                  </tr>
                )) : payments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-muted-foreground">No transactions found for this period.</td>
                  </tr>
                ) : payments.map(p => {
                  const memberName = p.member
                    ? `${p.member.user.first_name} ${p.member.user.last_name}`
                    : `Member #${p.member_id}`
                  const statusCfg = STATUS_CFG[p.status] ?? STATUS_CFG.completed
                  return (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <p className="font-medium">{memberName}</p>
                        {p.member?.user?.email && (
                          <p className="text-xs text-muted-foreground">{p.member.user.email}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.subscription?.plan?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold">{formatCurrency(p.amount)}</p>
                        {p.refund_amount && p.refund_amount > 0 && (
                          <p className="text-xs text-red-500">Refund: {formatCurrency(p.refund_amount)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3"><MethodBadge method={p.payment_method} /></td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full border ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                        {formatDateTime(p.paid_at)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {!paymentsLoading && payments.length > 0 && (
            <div className="px-4 py-3 border-t text-xs text-muted-foreground">
              Showing {payments.length} transactions · {from} to {to}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
