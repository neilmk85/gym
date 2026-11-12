import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/shared/SearchInput'
import { Card } from '@/components/ui/card'
import { billingApi, type Invoice } from '@/api/billing.api'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  Receipt, ChevronLeft, ChevronRight,
  TrendingUp, FileText, DollarSign,
  CalendarDays, ChevronDown, Check, Download,
} from 'lucide-react'

const PER_PAGE = 25

function toDateString(d: Date) {
  return d.toISOString().slice(0, 10)
}

function defaultFrom() {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return toDateString(d)
}

function defaultTo() {
  return toDateString(new Date())
}

interface Preset {
  label: string
  getRange: () => { from: string; to: string }
}

const PRESETS: (Preset | 'divider')[] = [
  { label: 'Today',         getRange: () => { const t = toDateString(new Date()); return { from: t, to: t } } },
  { label: 'Yesterday',     getRange: () => { const d = new Date(); d.setDate(d.getDate()-1); const s = toDateString(d); return { from: s, to: s } } },
  'divider',
  { label: 'This Week',     getRange: () => { const d = new Date(); const day = d.getDay(); const mon = new Date(d); mon.setDate(d.getDate() - ((day+6)%7)); return { from: toDateString(mon), to: toDateString(new Date()) } } },
  { label: 'Last Week',     getRange: () => { const d = new Date(); const day = d.getDay(); const mon = new Date(d); mon.setDate(d.getDate() - ((day+6)%7) - 7); const sun = new Date(mon); sun.setDate(mon.getDate()+6); return { from: toDateString(mon), to: toDateString(sun) } } },
  'divider',
  { label: 'This Month',    getRange: () => { const d = new Date(); return { from: toDateString(new Date(d.getFullYear(), d.getMonth(), 1)), to: toDateString(new Date()) } } },
  { label: 'Last Month',    getRange: () => { const d = new Date(); const first = new Date(d.getFullYear(), d.getMonth()-1, 1); const last = new Date(d.getFullYear(), d.getMonth(), 0); return { from: toDateString(first), to: toDateString(last) } } },
  { label: 'Last 30 Days',  getRange: () => { const d = new Date(); const f = new Date(d); f.setDate(d.getDate()-30); return { from: toDateString(f), to: toDateString(d) } } },
  { label: 'Last 90 Days',  getRange: () => { const d = new Date(); const f = new Date(d); f.setDate(d.getDate()-90); return { from: toDateString(f), to: toDateString(d) } } },
  'divider',
  { label: 'This Quarter',  getRange: () => { const d = new Date(); const q = Math.floor(d.getMonth()/3); const first = new Date(d.getFullYear(), q*3, 1); return { from: toDateString(first), to: toDateString(new Date()) } } },
  { label: 'This Year',     getRange: () => { const d = new Date(); return { from: toDateString(new Date(d.getFullYear(), 0, 1)), to: toDateString(new Date()) } } },
  'divider',
  { label: 'Custom Range',  getRange: () => ({ from: '', to: '' }) },
]

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  issued:    { label: 'Issued',    cls: 'bg-green-50 text-green-700 border border-green-200' },
  draft:     { label: 'Draft',     cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-50 text-red-600 border border-red-200' },
}

function lineTotals(inv: Invoice) {
  if (!inv.lines || inv.lines.length === 0) return null
  return inv.lines.reduce(
    (acc, l) => ({
      cgst: acc.cgst + (l.cgst_amount ?? 0),
      sgst: acc.sgst + (l.sgst_amount ?? 0),
      igst: acc.igst + (l.igst_amount ?? 0),
    }),
    { cgst: 0, sgst: 0, igst: 0 },
  )
}

function escCsv(v: string | number | undefined | null) {
  const s = String(v ?? '')
  return `"${s.replace(/"/g, '""')}"`
}

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map(r => r.join(',')).join('\n')
  const blob = new Blob(['﻿' + csv, { type: 'text/csv;charset=utf-8' }] as unknown as BlobPart[], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function GSTReportPage() {
  const [from, setFrom]           = useState(defaultFrom)
  const [to, setTo]               = useState(defaultTo)
  const [page, setPage]           = useState(1)
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [activePreset, setActivePreset] = useState('Last 30 Days')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [showCustom, setShowCustom]     = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function applyPreset(preset: Preset) {
    if (preset.label === 'Custom Range') {
      setShowCustom(true)
      setActivePreset('Custom Range')
      setDropdownOpen(false)
      return
    }
    const r = preset.getRange()
    setFrom(r.from)
    setTo(r.to)
    setActivePreset(preset.label)
    setShowCustom(false)
    setPage(1)
    setDropdownOpen(false)
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['gst-report', 'invoices'],
    queryFn: () => billingApi.listInvoices({ per_page: 500 }),
  })

  const allInvoices: Invoice[] = (data as any)?.invoices ?? []

  // Filter by date range
  const dateFiltered = useMemo(() =>
    allInvoices.filter(inv => {
      const d = inv.issue_date.slice(0, 10)
      return d >= from && d <= to
    }),
    [allInvoices, from, to],
  )

  // Stats over date-filtered invoices
  const stats = useMemo(() => {
    let taxable = 0, tax = 0, cgst = 0, sgst = 0, igst = 0
    let issued = 0, cancelled = 0
    for (const inv of dateFiltered) {
      taxable += inv.taxable_amount ?? 0
      tax     += inv.tax_amount ?? 0
      if (inv.status === 'issued') issued++
      if (inv.status === 'cancelled') cancelled++
      const lt = lineTotals(inv)
      if (lt) { cgst += lt.cgst; sgst += lt.sgst; igst += lt.igst }
    }
    return { taxable, tax, cgst, sgst, igst, issued, cancelled }
  }, [dateFiltered])

  // Client-side search + status filter + pagination
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return dateFiltered.filter(inv => {
      const matchSearch = !q ||
        (inv.invoice_number ?? '').toLowerCase().includes(q) ||
        (inv.buyer_name ?? '').toLowerCase().includes(q) ||
        (inv.buyer_gstin ?? '').toLowerCase().includes(q)
      const matchStatus = statusFilter === 'all' || inv.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [dateFiltered, search, statusFilter])

  const totalFiltered = filtered.length
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function h(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const exportGSTR1 = () => {
    const rows: string[][] = [[
      'GSTIN/UIN of Recipient', 'Receiver Name', 'Invoice Number', 'Invoice Date',
      'Invoice Value', 'Place Of Supply', 'Reverse Charge', 'Invoice Type',
      'E-Commerce GSTIN', 'Rate', 'Taxable Value', 'Cess Amount',
      'CGST Amount', 'SGST Amount', 'IGST Amount',
    ].map(escCsv)]
    for (const inv of filtered) {
      if (inv.status === 'cancelled') continue
      const lt = lineTotals(inv)
      const total = (inv.taxable_amount ?? 0) + (inv.tax_amount ?? 0)
      const isoDate = inv.issue_date.slice(0, 10)
      const ddmmyyyy = isoDate.split('-').reverse().join('/')
      const invType = inv.buyer_gstin ? 'Regular' : 'B2C Others'
      rows.push([
        escCsv(inv.buyer_gstin ?? ''),
        escCsv(inv.buyer_name),
        escCsv(inv.invoice_number),
        escCsv(ddmmyyyy),
        escCsv(total.toFixed(2)),
        escCsv(''),
        escCsv('N'),
        escCsv(invType),
        escCsv(''),
        escCsv(''),
        escCsv((inv.taxable_amount ?? 0).toFixed(2)),
        escCsv('0'),
        escCsv((lt?.cgst ?? 0).toFixed(2)),
        escCsv((lt?.sgst ?? 0).toFixed(2)),
        escCsv((lt?.igst ?? 0).toFixed(2)),
      ])
    }
    downloadCSV(`GSTR1-${from}-to-${to}.csv`, rows)
    setExportOpen(false)
  }

  const exportTally = () => {
    const rows: string[][] = [[
      'Date', 'Voucher Type', 'Voucher Number', 'Party Name', 'GSTIN',
      'Ledger Name', 'Amount', 'GST Rate', 'Taxable Amount',
      'CGST', 'SGST', 'IGST', 'Narration',
    ].map(escCsv)]
    for (const inv of filtered) {
      if (inv.status === 'cancelled') continue
      const lt = lineTotals(inv)
      const isoDate = inv.issue_date.slice(0, 10)
      const ddmmyyyy = isoDate.split('-').reverse().join('-')
      const rate = inv.lines?.[0]?.tax_rate_snapshot ?? 0
      rows.push([
        escCsv(ddmmyyyy),
        escCsv('Sales'),
        escCsv(inv.invoice_number),
        escCsv(inv.buyer_name),
        escCsv(inv.buyer_gstin ?? ''),
        escCsv('Sales Account'),
        escCsv(((inv.taxable_amount ?? 0) + (inv.tax_amount ?? 0)).toFixed(2)),
        escCsv(`${rate}%`),
        escCsv((inv.taxable_amount ?? 0).toFixed(2)),
        escCsv((lt?.cgst ?? 0).toFixed(2)),
        escCsv((lt?.sgst ?? 0).toFixed(2)),
        escCsv((lt?.igst ?? 0).toFixed(2)),
        escCsv(`Invoice ${inv.invoice_number} - ${inv.buyer_name}`),
      ])
    }
    downloadCSV(`Tally-Import-${from}-to-${to}.csv`, rows)
    setExportOpen(false)
  }

  const QUICK_PRESETS = [
    { label: 'This Month',   key: 'This Month' },
    { label: 'This Quarter', key: 'This Quarter' },
    { label: 'This Year',    key: 'This Year' },
    { label: 'Last 30d',     key: 'Last 30 Days' },
  ]

  return (
    <div className="space-y-6">

      {/* ── Edge-to-edge header ── */}
      <div className="relative overflow-hidden -mx-6 -mt-6 bg-gradient-to-br from-indigo-700 via-violet-700 to-purple-800 text-white">
        <div className="relative px-6 pt-6">

          {/* Row 1: title + date preset tabs */}
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <p className="text-[11px] font-semibold tracking-widest uppercase text-white/55 mb-1.5">Reports</p>
              <div className="flex items-center gap-2.5 mb-1">
                <Receipt className="w-5 h-5 opacity-80" />
                <h1 className="text-2xl font-bold tracking-tight">GST Report</h1>
              </div>
              <p className="text-sm text-white/65">
                CGST · SGST · IGST breakdown across all issued invoices
              </p>
            </div>

            {/* Preset tabs + Custom dropdown */}
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
              {QUICK_PRESETS.map(({ label, key }) => (
                <button key={key}
                  onClick={() => {
                    const p = PRESETS.find(x => x !== 'divider' && x.label === key)
                    if (p && p !== 'divider') applyPreset(p)
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap
                    ${activePreset === key
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'border border-white/30 text-white hover:bg-white/15'}`}>
                  {label}
                </button>
              ))}

              {/* Custom dropdown button */}
              <div ref={dropdownRef} className="relative">
                <button
                  onClick={() => setDropdownOpen(o => !o)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all
                    ${activePreset === 'Custom Range'
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'border border-white/30 text-white hover:bg-white/15'}`}>
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span>{activePreset === 'Custom Range' && showCustom && from && to
                    ? `${formatDate(from)} – ${formatDate(to)}`
                    : 'Custom'}</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden py-1">
                    {PRESETS.map((p, i) => {
                      if (p === 'divider') return <div key={`d${i}`} className="my-1 border-t border-gray-100" />
                      const isActive = activePreset === p.label
                      return (
                        <button key={p.label}
                          onClick={() => applyPreset(p)}
                          className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between transition-colors
                            ${isActive ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>
                          {p.label}
                          {isActive && <Check className="w-3.5 h-3.5" />}
                        </button>
                      )
                    })}
                  </div>
                )}

                {showCustom && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 z-50 p-4 space-y-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Custom Range</p>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-500">From</label>
                      <input type="date" value={from} max={to}
                        onChange={e => { setFrom(e.target.value); setPage(1) }}
                        className="w-full h-9 rounded-md border border-gray-200 px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-500">To</label>
                      <input type="date" value={to} min={from}
                        onChange={e => { setTo(e.target.value); setPage(1) }}
                        className="w-full h-9 rounded-md border border-gray-200 px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                    </div>
                    <button onClick={() => { setShowCustom(false) }}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 rounded-md transition-colors">
                      Apply
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: 6 big stat panels */}
        {!isLoading && (
          <div className="grid grid-cols-2 md:grid-cols-6 divide-x divide-white/15 border-t border-white/15">
            <div className="px-5 py-4">
              <p className="text-xl font-bold leading-none">{formatCurrency(stats.taxable + stats.tax)}</p>
              <p className="text-xs font-medium text-white/85 mt-1">Total Revenue</p>
              <p className="text-xs text-white/45 mt-0.5">taxable + tax</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-xl font-bold leading-none">{formatCurrency(stats.taxable)}</p>
              <p className="text-xs font-medium text-white/85 mt-1">Taxable Amount</p>
              <p className="text-xs text-white/45 mt-0.5">excl. tax</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-xl font-bold leading-none text-yellow-300">{formatCurrency(stats.tax)}</p>
              <p className="text-xs font-medium text-white/85 mt-1">Tax Collected</p>
              <p className="text-xs text-white/45 mt-0.5">CGST + SGST + IGST</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-xl font-bold leading-none">{dateFiltered.length}</p>
              <p className="text-xs font-medium text-white/85 mt-1">Total Invoices</p>
              <p className="text-xs text-white/45 mt-0.5">all statuses</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-xl font-bold leading-none text-green-300">{stats.issued}</p>
              <p className="text-xs font-medium text-white/85 mt-1">Issued</p>
              <p className="text-xs text-white/45 mt-0.5">in selected period</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-xl font-bold leading-none text-red-300">{stats.cancelled}</p>
              <p className="text-xs font-medium text-white/85 mt-1">Cancelled</p>
              <p className="text-xs text-white/45 mt-0.5">voided invoices</p>
            </div>
          </div>
        )}

        {/* Decorative circles */}
        <div className="absolute -right-6 -top-6 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute right-20 -bottom-8 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />
      </div>

      {isError && <p className="text-sm text-destructive">Failed to load invoices. Please try again.</p>}

      {/* ── Table card ── */}
      <Card className="shadow-lg shadow-gray-200/80 rounded-xl overflow-hidden">

        {/* Search + filter bar */}
        <div className="flex items-center justify-between gap-4 px-4 py-3 border-b bg-teal-50/60">
          <p className="font-medium text-sm text-teal-700 whitespace-nowrap flex items-center gap-1.5">
            <Receipt className="w-4 h-4" />
            {isLoading ? 'Loading…' : `${totalFiltered} invoice${totalFiltered !== 1 ? 's' : ''}`}
          </p>
          <div className="flex items-center gap-2 flex-1 justify-end">
            <SearchInput
              placeholder="Invoice no, buyer, GSTIN…"
              value={search}
              onChange={v => { setSearch(v); setPage(1) }}
              className="w-60"
            />
            <select value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
              className="h-9 w-36 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
              <option value="all">All statuses</option>
              <option value="issued">Issued</option>
              <option value="draft">Draft</option>
              <option value="cancelled">Cancelled</option>
            </select>
            {/* Export dropdown */}
            <div ref={exportRef} className="relative">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-teal-700 border-teal-200 hover:bg-teal-50"
                onClick={() => setExportOpen(o => !o)}
                disabled={filtered.length === 0}
              >
                <Download className="h-4 w-4" />
                Export
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
              </Button>
              {exportOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden py-1">
                  <button
                    onClick={exportGSTR1}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-teal-50 flex flex-col gap-0.5"
                  >
                    <span className="font-medium">GSTR-1 CSV</span>
                    <span className="text-xs text-gray-400">Government filing format (B2B/B2C)</span>
                  </button>
                  <div className="my-1 border-t border-gray-100" />
                  <button
                    onClick={exportTally}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-teal-50 flex flex-col gap-0.5"
                  >
                    <span className="font-medium">Tally Import CSV</span>
                    <span className="text-xs text-gray-400">TallyPrime / Tally ERP 9 voucher format</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gradient-to-r from-teal-50 via-cyan-50 to-sky-50">
                <th className="text-left px-4 py-3 font-semibold text-teal-700 whitespace-nowrap">Invoice No</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Buyer</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700 whitespace-nowrap">Issue Date</th>
                <th className="text-right px-4 py-3 font-semibold text-teal-700 whitespace-nowrap">Taxable</th>
                <th className="text-right px-4 py-3 font-semibold text-teal-700">CGST</th>
                <th className="text-right px-4 py-3 font-semibold text-teal-700">SGST</th>
                <th className="text-right px-4 py-3 font-semibold text-teal-700">IGST</th>
                <th className="text-right px-4 py-3 font-semibold text-teal-700 whitespace-nowrap">Total Tax</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-teal-700">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">

              {isLoading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 10 }).map((__, c) => (
                    <td key={c} className="px-4 py-3">
                      <div className="h-4 bg-gray-100 rounded animate-pulse w-16" />
                    </td>
                  ))}
                </tr>
              ))}

              {!isLoading && paged.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-14 text-center">
                    <Receipt className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-muted-foreground text-sm font-medium">No invoices found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {search || statusFilter !== 'all'
                        ? 'Try adjusting your search or filter.'
                        : 'No invoices exist in the selected date range.'}
                    </p>
                  </td>
                </tr>
              )}

              {!isLoading && paged.map((inv, idx) => {
                const lt     = lineTotals(inv)
                const sCfg   = STATUS_CFG[inv.status] ?? { label: inv.status, cls: 'bg-gray-100 text-gray-600' }
                const total  = (inv.taxable_amount ?? 0) + (inv.tax_amount ?? 0)

                return (
                  <tr key={inv.id ?? idx} className="hover:bg-teal-50/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-medium">{inv.invoice_number}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium leading-tight">{inv.buyer_name}</p>
                      {inv.buyer_gstin && (
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">{inv.buyer_gstin}</p>
                      )}
                      {inv.buyer_email && (
                        <p className="text-xs text-muted-foreground mt-0.5">{inv.buyer_email}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {formatDate(inv.issue_date)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatCurrency(inv.taxable_amount ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {lt ? formatCurrency(lt.cgst) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {lt ? formatCurrency(lt.sgst) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {lt ? formatCurrency(lt.igst) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-amber-700">
                      {formatCurrency(inv.tax_amount ?? 0)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${sCfg.cls}`}>
                        {sCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold">
                      {formatCurrency(total)}
                    </td>
                  </tr>
                )
              })}
            </tbody>

            {/* Totals footer row */}
            {!isLoading && paged.length > 0 && (() => {
              const ft = filtered.reduce(
                (acc, inv) => {
                  const lt = lineTotals(inv)
                  return {
                    taxable: acc.taxable + (inv.taxable_amount ?? 0),
                    cgst: acc.cgst + (lt?.cgst ?? 0),
                    sgst: acc.sgst + (lt?.sgst ?? 0),
                    igst: acc.igst + (lt?.igst ?? 0),
                    tax: acc.tax + (inv.tax_amount ?? 0),
                    total: acc.total + (inv.taxable_amount ?? 0) + (inv.tax_amount ?? 0),
                  }
                },
                { taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0, total: 0 },
              )
              return (
                <tfoot>
                  <tr className="bg-teal-50/60 border-t-2 border-teal-200 font-semibold text-teal-800">
                    <td colSpan={3} className="px-4 py-2.5 text-xs uppercase tracking-wide">
                      Totals ({filtered.length} invoices)
                    </td>
                    <td className="px-4 py-2.5 text-right">{formatCurrency(ft.taxable)}</td>
                    <td className="px-4 py-2.5 text-right">{ft.cgst > 0 ? formatCurrency(ft.cgst) : '—'}</td>
                    <td className="px-4 py-2.5 text-right">{ft.sgst > 0 ? formatCurrency(ft.sgst) : '—'}</td>
                    <td className="px-4 py-2.5 text-right">{ft.igst > 0 ? formatCurrency(ft.igst) : '—'}</td>
                    <td className="px-4 py-2.5 text-right text-amber-700">{formatCurrency(ft.tax)}</td>
                    <td />
                    <td className="px-4 py-2.5 text-right">{formatCurrency(ft.total)}</td>
                  </tr>
                </tfoot>
              )
            })()}
          </table>
        </div>

        {/* Pagination */}
        {!isLoading && totalFiltered > PER_PAGE && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t bg-muted/20 text-xs text-muted-foreground">
            <span>
              Showing {Math.min((page - 1) * PER_PAGE + 1, totalFiltered)}–{Math.min(page * PER_PAGE, totalFiltered)} of {totalFiltered}
            </span>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7" title="Previous page"
                onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <span className="flex items-center px-2 font-medium">Page {page}</span>
              <Button variant="outline" size="icon" className="h-7 w-7" title="Next page"
                onClick={() => setPage(p => p + 1)} disabled={page * PER_PAGE >= totalFiltered}>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
