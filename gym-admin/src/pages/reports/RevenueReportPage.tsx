import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  ArrowUpRight, Minus, Search, ChevronLeft, ChevronRight, Calendar,
} from 'lucide-react'

// ── Date presets ──────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, '0') }
function toStr(d: Date) { return d.toISOString().split('T')[0] }

const PRESETS = [
  { label: 'Today',        value: 'today' },
  { label: 'Yesterday',    value: 'yesterday' },
  { label: 'Last 7 Days',  value: 'last7' },
  { label: 'Last 30 Days', value: 'last30' },
  { label: 'This Month',   value: 'thisMonth' },
  { label: 'Last Month',   value: 'lastMonth' },
  { label: 'This Quarter', value: 'thisQuarter' },
  { label: 'This Year',    value: 'thisYear' },
  { label: 'Custom…',      value: 'custom' },
]

function getPresetDates(preset: string): { from: string; to: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  switch (preset) {
    case 'today':     return { from: toStr(now), to: toStr(now) }
    case 'yesterday': { const d = new Date(now); d.setDate(d.getDate() - 1); return { from: toStr(d), to: toStr(d) } }
    case 'last7':     { const d = new Date(now); d.setDate(d.getDate() - 6); return { from: toStr(d), to: toStr(now) } }
    case 'last30':    { const d = new Date(now); d.setDate(d.getDate() - 29); return { from: toStr(d), to: toStr(now) } }
    case 'thisMonth': return { from: `${y}-${pad(m + 1)}-01`, to: toStr(now) }
    case 'lastMonth': {
      const lm = m === 0 ? 11 : m - 1; const ly = m === 0 ? y - 1 : y
      return { from: `${ly}-${pad(lm + 1)}-01`, to: `${ly}-${pad(lm + 1)}-${pad(new Date(ly, lm + 1, 0).getDate())}` }
    }
    case 'thisQuarter': { const qm = Math.floor(m / 3) * 3; return { from: `${y}-${pad(qm + 1)}-01`, to: toStr(now) } }
    case 'thisYear':  return { from: `${y}-01-01`, to: toStr(now) }
    default:          { const d = new Date(now); d.setDate(d.getDate() - 29); return { from: toStr(d), to: toStr(now) } }
  }
}

// ── Payment method / status config ───────────────────────────────────────────

const METHOD_CFG: Record<string, { label: string; icon: React.ReactNode; color: string; chip: string }> = {
  cash:          { label: 'Cash',          icon: <Banknote className="w-3.5 h-3.5" />,   color: 'bg-green-100 text-green-700 border-green-200',   chip: 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' },
  upi:           { label: 'UPI',           icon: <Smartphone className="w-3.5 h-3.5" />, color: 'bg-violet-100 text-violet-700 border-violet-200', chip: 'bg-violet-100 text-violet-700 border-violet-200 hover:bg-violet-200' },
  card:          { label: 'Card',          icon: <CreditCard className="w-3.5 h-3.5" />, color: 'bg-blue-100 text-blue-700 border-blue-200',       chip: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200' },
  bank_transfer: { label: 'Bank Transfer', icon: <Building className="w-3.5 h-3.5" />,   color: 'bg-sky-100 text-sky-700 border-sky-200',          chip: 'bg-sky-100 text-sky-700 border-sky-200 hover:bg-sky-200' },
  razorpay:      { label: 'Razorpay',      icon: <CreditCard className="w-3.5 h-3.5" />, color: 'bg-cyan-100 text-[#007a99] border-cyan-200',      chip: 'bg-cyan-100 text-[#007a99] border-cyan-200 hover:bg-cyan-200' },
  other:         { label: 'Other',         icon: <Receipt className="w-3.5 h-3.5" />,    color: 'bg-gray-100 text-gray-600 border-gray-200',       chip: 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200' },
}

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  completed: { label: 'Completed', color: 'text-emerald-600' },
  pending:   { label: 'Pending',   color: 'bg-amber-400 text-white border-amber-400' },
  failed:    { label: 'Failed',    color: 'bg-red-500 text-white border-red-500' },
  refunded:  { label: 'Refunded',  color: 'bg-slate-400 text-white border-slate-400' },
}

function MethodBadge({ method }: { method: string }) {
  const cfg = METHOD_CFG[method] ?? METHOD_CFG.other
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.color}`}>
      {cfg.icon} {cfg.label}
    </span>
  )
}

const PER_PAGE = 20

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RevenueReportPage() {
  const [preset, setPreset]           = useState('last30')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [customFrom, setCustomFrom]   = useState('')
  const [customTo, setCustomTo]       = useState('')
  const datePickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!dropdownOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  // Transaction filters
  const [methodFilter, setMethodFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch]             = useState('')
  const [txPage, setTxPage]             = useState(1)

  const { from, to } = useMemo(() => {
    if (preset === 'custom' && customFrom && customTo) return { from: customFrom, to: customTo }
    return getPresetDates(preset)
  }, [preset, customFrom, customTo])

  const presetLabel = PRESETS.find(p => p.value === preset)?.label ?? 'Last 30 Days'

  const handlePreset = (val: string) => {
    setPreset(val)
    setDropdownOpen(false)
    setTxPage(1)
    if (val !== 'custom') { setCustomFrom(''); setCustomTo('') }
  }

  // Revenue summary
  const { data: reportData, isLoading: reportLoading } = useQuery({
    queryKey: QUERY_KEYS.revenueReport({ from, to }),
    queryFn: () => reportsApi.revenue({ from, to }),
  })

  // Transactions (paginated, filtered via API)
  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: ['payments', 'revenue-report', from, to, methodFilter, statusFilter, txPage],
    queryFn: () => paymentsApi.list({
      from, to,
      method: methodFilter || undefined,
      status: statusFilter || undefined,
      page: txPage,
      per_page: PER_PAGE,
    }),
  })

  const report = reportData as {
    total_revenue?: number; net_revenue?: number; total_refunds?: number
    transaction_count?: number
    by_method?: { method: string; amount: number; count: number }[]
    by_day?: { date: string; amount: number; count: number }[]
  } | undefined

  const allPayments: Payment[] = (paymentsData as any)?.payments ?? (paymentsData as any)?.data ?? []
  const txMeta = (paymentsData as any)?.meta as { total?: number; per_page?: number } | undefined
  const txTotal = txMeta?.total ?? allPayments.length

  // Client-side name search on loaded page
  const payments = useMemo(() => {
    if (!search.trim()) return allPayments
    const q = search.toLowerCase()
    return allPayments.filter(p => {
      const name = p.member ? `${p.member.user.first_name} ${p.member.user.last_name}` : ''
      const phone = p.member?.user?.phone ?? ''
      return name.toLowerCase().includes(q) || phone.includes(q)
    })
  }, [allPayments, search])

  const byMethod = report?.by_method ?? []
  const byDay    = report?.by_day ?? []
  const totalRevenue = report?.total_revenue ?? 0
  const netRevenue   = report?.net_revenue ?? 0
  const totalRefunds = report?.total_refunds ?? 0
  const txCount      = report?.transaction_count ?? 0
  const avgTx        = txCount > 0 ? totalRevenue / txCount : 0
  const topDay       = byDay.length > 0 ? byDay.reduce((a, b) => a.amount > b.amount ? a : b) : null
  const isLoading    = reportLoading

  const totalPages = Math.ceil(txTotal / PER_PAGE)

  return (
    <div className="space-y-6">

      {/* ── Gradient header ── */}
      <div className="relative -mx-6 -mt-6" style={{ background: 'linear-gradient(to bottom, #d0f5fb 0%, #e8f9fc 35%, #f4fbfd 60%, rgba(255,255,255,0) 100%)' }}>
        <div className="relative px-6 pt-6">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <p className="text-[11px] font-semibold tracking-widest uppercase text-[#0096b4]/70 mb-1.5">Reports</p>
              <div className="flex items-center gap-2.5 mb-1">
                <IndianRupee className="w-5 h-5 text-[#0096b4]" />
                <h1 className="text-2xl font-semibold tracking-wide text-[#1a1a2e]">Revenue Report</h1>
              </div>
              <p className="text-sm text-slate-500">{from} → {to}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Preset dropdown */}
              <div className="relative" ref={datePickerRef}>
                <button
                  onClick={() => setDropdownOpen(v => !v)}
                  className="flex items-center gap-2 bg-white border border-slate-200 shadow-sm text-slate-700 text-sm font-medium px-4 py-2 rounded-lg hover:border-[#00B4D8] hover:text-[#00B4D8] transition-colors"
                >
                  <Calendar className="w-4 h-4" />
                  {presetLabel}
                  <ChevronDown className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-72 rounded-xl bg-white shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-slate-100 z-50 overflow-hidden">
                    <div className="p-3 border-b border-slate-100">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2.5">Quick Select</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {PRESETS.filter(p => p.value !== 'custom').map(p => (
                          <button key={p.value} onClick={() => handlePreset(p.value)}
                            className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                              preset === p.value
                                ? 'bg-[#00B4D8] text-white shadow-sm'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                            }`}
                          >{p.label}</button>
                        ))}
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2.5">Custom Range</p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-medium text-slate-500 w-8 shrink-0">From</label>
                          <input type="date" value={customFrom}
                            onChange={e => { setCustomFrom(e.target.value); setTxPage(1); if (e.target.value && customTo) { handlePreset('custom') } }}
                            className="flex-1 h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00B4D8] focus:border-transparent" />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-medium text-slate-500 w-8 shrink-0">To</label>
                          <input type="date" value={customTo}
                            onChange={e => { setCustomTo(e.target.value); setTxPage(1); if (customFrom && e.target.value) { handlePreset('custom') } }}
                            className="flex-1 h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00B4D8] focus:border-transparent" />
                        </div>
                      </div>
                      {customFrom && customTo && (
                        <button onClick={() => { handlePreset('custom'); setDropdownOpen(false) }}
                          className="mt-2.5 w-full h-8 rounded-lg bg-[#00B4D8] text-white text-sm font-semibold tracking-wide hover:bg-[#0096b4] transition-colors">
                          Apply Range
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <CSVExportButton endpoint="/reports/revenue" params={{ from, to }} filename={`revenue-report-${from}-${to}.csv`} />
            </div>
          </div>
        </div>

        {/* Stat strip */}
        {!isLoading && (
          <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-teal-100 border-t border-teal-100">
            {[
              { val: formatCurrency(totalRevenue), label: 'Total Revenue',        sub: 'gross collected',    color: 'text-[#1a1a2e]' },
              { val: formatCurrency(netRevenue),   label: 'Net Revenue',           sub: 'after refunds',      color: 'text-green-600' },
              { val: txCount,                      label: 'Transactions',          sub: 'completed payments', color: 'text-[#0096b4]' },
              { val: formatCurrency(avgTx),        label: 'Avg per Transaction',   sub: 'per payment',        color: 'text-amber-600' },
              { val: formatCurrency(totalRefunds), label: 'Total Refunds',         sub: 'money returned',     color: 'text-red-600' },
            ].map(s => (
              <div key={s.label} className="px-5 py-4">
                <p className={`text-xl font-bold leading-none ${s.color}`}>{s.val}</p>
                <p className="text-xs font-medium text-slate-600 mt-1">{s.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Insight cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Best Day */}
        <div className="relative rounded-2xl overflow-hidden p-6 flex flex-col justify-between min-h-[140px]"
          style={{ background: 'linear-gradient(135deg, #3a7ca5 0%, #1a2f5e 100%)', boxShadow: '0 8px 32px rgba(26,47,94,0.35)' }}>
          <div className="absolute -right-4 -bottom-4 opacity-[0.12]">
            <ArrowUpRight className="w-28 h-28 text-white" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/60">Best Day</p>
          {isLoading ? <Skeleton className="h-8 w-32 bg-white/10" /> : topDay ? (
            <>
              <p className="text-[1.9rem] font-semibold tracking-wide text-white mt-2 leading-none">{formatCurrency(topDay.amount)}</p>
              <p className="text-xs text-white/50 tracking-wide mt-3">{formatDate(topDay.date)} · {topDay.count} transactions</p>
            </>
          ) : <p className="text-sm text-slate-500 mt-2">No data</p>}
        </div>

        {/* Refund Rate */}
        <div className="relative rounded-2xl overflow-hidden p-6 flex flex-col justify-between min-h-[140px]"
          style={{ background: 'linear-gradient(135deg, #3a7ca5 0%, #1a2f5e 100%)', boxShadow: '0 8px 32px rgba(26,47,94,0.35)' }}>
          <div className="absolute -right-4 -bottom-4 opacity-[0.12]">
            <ArrowDownLeft className="w-28 h-28 text-white" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/60">Refund Rate</p>
          {isLoading ? <Skeleton className="h-8 w-24 bg-white/10" /> : (
            <>
              <p className="text-[1.9rem] font-semibold tracking-wide text-white mt-2 leading-none">
                {totalRevenue > 0 ? ((totalRefunds / totalRevenue) * 100).toFixed(1) : '0.0'}%
              </p>
              <p className="text-xs text-white/50 tracking-wide mt-3">{formatCurrency(totalRefunds)} refunded of {formatCurrency(totalRevenue)}</p>
            </>
          )}
        </div>

        {/* Top Payment Method */}
        <div className="relative rounded-2xl overflow-hidden p-6 flex flex-col justify-between min-h-[140px]"
          style={{ background: 'linear-gradient(135deg, #3a7ca5 0%, #1a2f5e 100%)', boxShadow: '0 8px 32px rgba(26,47,94,0.35)' }}>
          <div className="absolute -right-4 -bottom-4 opacity-[0.12]">
            <Smartphone className="w-28 h-28 text-white" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/60">Top Payment Method</p>
          {isLoading ? <Skeleton className="h-8 w-24 bg-white/10" /> : byMethod.length > 0 ? (() => {
            const top = byMethod.reduce((a, b) => a.amount > b.amount ? a : b)
            const cfg = METHOD_CFG[top.method] ?? METHOD_CFG.other
            return (
              <>
                <p className="text-[1.9rem] font-semibold tracking-wide text-white mt-2 leading-none">{cfg.label}</p>
                <p className="text-xs text-white/50 tracking-wide mt-3">{formatCurrency(top.amount)} · {top.count} transactions</p>
              </>
            )
          })() : <p className="text-sm text-white/40 mt-2">No data</p>}
        </div>
      </div>

      {/* ── Revenue by payment method ── */}
      {(byMethod.length > 0 || isLoading) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Revenue by Payment Method</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead style={{ background: 'linear-gradient(135deg, #3a7ca5 0%, #1a2f5e 100%)' }}>
                <tr>
                  {['Method', 'Transactions', 'Revenue', 'Share'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-light uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.75)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>{[1,2,3,4].map(j => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>)}</tr>
                )) : byMethod.map(row => {
                  const share = totalRevenue > 0 ? (row.amount / totalRevenue) * 100 : 0
                  return (
                    <tr key={row.method} className="hover:bg-muted/30 cursor-pointer" onClick={() => { setMethodFilter(methodFilter === row.method ? '' : row.method); setTxPage(1) }}>
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
            {!isLoading && byMethod.length > 0 && (
              <p className="px-4 py-2 text-xs text-muted-foreground border-t">Click a row to filter transactions by that method</p>
            )}
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
                <thead className="sticky top-0" style={{ background: 'linear-gradient(135deg, #3a7ca5 0%, #1a2f5e 100%)' }}>
                  <tr>
                    {['Date', 'Transactions', 'Revenue', 'Share %'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-light uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.75)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>{[1,2,3,4].map(j => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>)}</tr>
                  )) : (() => {
                    const total = byDay.reduce((s, d) => s + d.amount, 0)
                    const maxAmount = Math.max(...byDay.map(d => d.amount), 1)
                    const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
                    const sorted = byDay.slice().sort((a, b) => b.date.localeCompare(a.date))
                    return sorted.map(row => {
                      const share = total > 0 ? (row.amount / total) * 100 : 0
                      const barPct = (row.amount / maxAmount) * 100
                      const isTop = row.amount === maxAmount
                      const dow = DAY_NAMES[new Date(row.date).getDay()]
                      return (
                        <tr key={row.date} className={`hover:bg-muted/30 ${isTop ? 'bg-emerald-50/60' : ''}`}>
                          <td className="px-4 py-3">
                            <span className="font-medium text-foreground">{formatDate(row.date)}</span>
                            <span className="ml-2 text-xs text-muted-foreground">{dow}</span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{row.count}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className="font-semibold tabular-nums">{formatCurrency(row.amount)}</span>
                              <div className="flex-1 min-w-[60px] max-w-[120px] h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                <div className="h-full rounded-full bg-[#00B4D8]" style={{ width: `${barPct}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-sm font-semibold tabular-nums ${isTop ? 'text-emerald-600' : 'text-slate-600'}`}>
                              {share.toFixed(1)}%
                            </span>
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
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base">
              Transactions
              {txTotal > 0 && <span className="ml-2 text-sm font-normal text-muted-foreground">({txTotal} total)</span>}
            </CardTitle>

            {/* Filters row */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search member…"
                  className="pl-8 pr-3 h-8 w-44 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value); setTxPage(1) }}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">All statuses</option>
                {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>

          {/* Method filter chips */}
          <div className="flex gap-1.5 flex-wrap mt-2">
            <button
              onClick={() => { setMethodFilter(''); setTxPage(1) }}
              className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${methodFilter === '' ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >All modes</button>
            {Object.entries(METHOD_CFG).map(([key, cfg]) => (
              <button key={key}
                onClick={() => { setMethodFilter(methodFilter === key ? '' : key); setTxPage(1) }}
                className={`inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
                  methodFilter === key ? cfg.color + ' ring-1 ring-offset-0' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >{cfg.icon} {cfg.label}</button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: 'linear-gradient(135deg, #3a7ca5 0%, #1a2f5e 100%)' }}>
                <tr>
                  {['Member', 'Plan', 'Amount', 'Mode', 'Status', 'Paid On'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-light uppercase tracking-wide whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.75)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {paymentsLoading ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>{[1,2,3,4,5,6].map(j => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>)}</tr>
                )) : payments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-muted-foreground">
                      No transactions found{(methodFilter || statusFilter || search) ? ' for the selected filters' : ' for this period'}.
                    </td>
                  </tr>
                ) : payments.map(p => {
                  const memberName = p.member ? `${p.member.user.first_name} ${p.member.user.last_name}` : `Member #${p.member_id}`
                  const phone = p.member?.user?.phone
                  const statusCfg = STATUS_CFG[p.status] ?? STATUS_CFG.completed
                  return (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <p className="font-medium">{memberName}</p>
                        {phone && <p className="text-xs text-muted-foreground">{phone}</p>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.subscription?.plan?.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold">{formatCurrency(p.amount)}</p>
                        {p.refund_amount && p.refund_amount > 0 && (
                          <p className="text-xs text-red-500">Refund: {formatCurrency(p.refund_amount)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3"><MethodBadge method={p.payment_method} /></td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex text-xs font-semibold px-3 py-1 rounded-full ${statusCfg.color}`}>{statusCfg.label}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{formatDateTime(p.paid_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!paymentsLoading && txTotal > PER_PAGE && (
            <div className="px-4 py-3 border-t flex items-center justify-between text-xs text-muted-foreground">
              <span>Showing {((txPage - 1) * PER_PAGE) + 1}–{Math.min(txPage * PER_PAGE, txTotal)} of {txTotal}</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setTxPage(p => Math.max(1, p - 1))}
                  disabled={txPage === 1}
                  className="p-1 rounded hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                ><ChevronLeft className="w-4 h-4" /></button>
                <span className="px-2">Page {txPage} of {totalPages}</span>
                <button
                  onClick={() => setTxPage(p => Math.min(totalPages, p + 1))}
                  disabled={txPage === totalPages}
                  className="p-1 rounded hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                ><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}
          {!paymentsLoading && payments.length > 0 && txTotal <= PER_PAGE && (
            <div className="px-4 py-3 border-t text-xs text-muted-foreground">
              Showing {payments.length} transactions · {from} to {to}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
