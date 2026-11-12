import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, ShoppingBag, Eye, Trash2, ChevronDown,
  CheckCircle2, Clock, XCircle, PackageCheck, FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/shared/SearchInput'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import { purchasesApi, type Purchase } from '@/api/purchases.api'

type PurchaseStatus = 'draft' | 'ordered' | 'received' | 'partially_received' | 'cancelled'
type PaymentStatus = 'pending' | 'partial' | 'paid'

const PURCHASE_STATUSES: Record<PurchaseStatus, string> = {
  draft: 'Draft', ordered: 'Ordered', received: 'Received',
  partially_received: 'Partially Received', cancelled: 'Cancelled',
}
const PAYMENT_STATUSES: Record<PaymentStatus, string> = { pending: 'Pending', partial: 'Partial', paid: 'Paid' }

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<PurchaseStatus, { color: string; icon: React.ReactNode }> = {
  draft:              { color: 'bg-gray-100 text-gray-600 border-gray-200',    icon: <FileText className="w-3 h-3" /> },
  ordered:            { color: 'bg-blue-100 text-blue-700 border-blue-200',    icon: <Clock className="w-3 h-3" /> },
  received:           { color: 'bg-green-100 text-green-700 border-green-200', icon: <CheckCircle2 className="w-3 h-3" /> },
  partially_received: { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: <PackageCheck className="w-3 h-3" /> },
  cancelled:          { color: 'bg-red-100 text-red-600 border-red-200',       icon: <XCircle className="w-3 h-3" /> },
}

const PAYMENT_CFG: Record<PaymentStatus, { color: string }> = {
  pending: { color: 'bg-red-50 text-red-600 border-red-200' },
  partial: { color: 'bg-amber-50 text-amber-700 border-amber-200' },
  paid:    { color: 'bg-green-50 text-green-700 border-green-200' },
}

function StatusChip({ status }: { status: PurchaseStatus }) {
  const cfg = STATUS_CFG[status]
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.color}`}>
      {cfg.icon} {PURCHASE_STATUSES[status]}
    </span>
  )
}

function PaymentChip({ status }: { status: PaymentStatus }) {
  const cfg = PAYMENT_CFG[status]
  return (
    <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.color}`}>
      {PAYMENT_STATUSES[status]}
    </span>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DirectPurchasePage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [preset, setPreset] = useState('all')
  const [dateDropdown, setDateDropdown] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['purchases'],
    queryFn: () => purchasesApi.list({ per_page: 200 }),
  })
  const purchases: Purchase[] = data?.data ?? []

  const deleteMutation = useMutation({
    mutationFn: (id: number) => purchasesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchases'] })
      toast.success('Purchase order deleted')
    },
  })

  // Date range filter
  const DATE_PRESETS = [
    { label: 'All Time', value: 'all' },
    { label: 'This Month', value: 'thisMonth' },
    { label: 'Last Month', value: 'lastMonth' },
    { label: 'Last 30 Days', value: 'last30' },
    { label: 'This Quarter', value: 'thisQuarter' },
    { label: 'This Year', value: 'thisYear' },
  ]

  function inRange(dateStr: string): boolean {
    if (preset === 'all') return true
    const d = new Date(dateStr)
    const now = new Date()
    const y = now.getFullYear(), m = now.getMonth()
    if (preset === 'thisMonth') return d.getFullYear() === y && d.getMonth() === m
    if (preset === 'lastMonth') {
      const lm = m === 0 ? 11 : m - 1
      const ly = m === 0 ? y - 1 : y
      return d.getFullYear() === ly && d.getMonth() === lm
    }
    if (preset === 'last30') {
      const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 30)
      return d >= cutoff
    }
    if (preset === 'thisQuarter') {
      const qm = Math.floor(m / 3) * 3
      return d.getFullYear() === y && d.getMonth() >= qm
    }
    if (preset === 'thisYear') return d.getFullYear() === y
    return true
  }

  const filtered = useMemo(() => purchases.filter(p => {
    const matchStatus = statusFilter === 'all' || p.status === statusFilter
    const matchPayment = paymentFilter === 'all' || p.payment_status === paymentFilter
    const matchDate = inRange(p.purchase_date)
    const q = search.toLowerCase()
    const matchSearch = !q ||
      p.purchase_number.toLowerCase().includes(q) ||
      p.vendor_name.toLowerCase().includes(q) ||
      (p.invoice_number ?? '').toLowerCase().includes(q)
    return matchStatus && matchPayment && matchDate && matchSearch
  }), [purchases, search, statusFilter, paymentFilter, preset])

  // Stats
  const totalAmount  = filtered.reduce((s, p) => s + p.total_amount, 0)
  const totalPaid    = filtered.reduce((s, p) => s + p.amount_paid, 0)
  const totalPending = totalAmount - totalPaid
  const orderedCount = purchases.filter(p => p.status === 'ordered').length
  const draftCount   = purchases.filter(p => p.status === 'draft').length

  const handleDelete = (id: number, num: string) => {
    if (!confirm(`Delete purchase order ${num}?`)) return
    deleteMutation.mutate(id)
  }

  const presetLabel = DATE_PRESETS.find(p => p.value === preset)?.label ?? 'All Time'

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="relative overflow-hidden -mx-6 -mt-6 bg-gradient-to-br from-orange-700 via-amber-700 to-yellow-700 text-white">
        <div className="relative px-6 py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold tracking-widest uppercase text-white/55 mb-1.5">Purchases</p>
              <div className="flex items-center gap-2.5 mb-1">
                <ShoppingBag className="w-5 h-5 opacity-80" />
                <h1 className="text-2xl font-bold tracking-tight">Direct Purchases</h1>
              </div>
              <p className="text-sm text-white/65">Purchase orders — record what you buy from vendors</p>
            </div>
            <Button onClick={() => navigate('/purchases/direct/new')}
              className="shrink-0 bg-white text-orange-800 hover:bg-white/90">
              <Plus className="w-4 h-4 mr-1.5" /> New Purchase
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-white/15 border-t border-white/15">
          <div className="px-5 py-4">
            <p className="text-xl font-bold">{filtered.length}</p>
            <p className="text-xs font-medium text-white/85 mt-1">Purchase Orders</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xl font-bold">{formatCurrency(totalAmount)}</p>
            <p className="text-xs font-medium text-white/85 mt-1">Total Value</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xl font-bold text-green-300">{formatCurrency(totalPaid)}</p>
            <p className="text-xs font-medium text-white/85 mt-1">Amount Paid</p>
          </div>
          <div className="px-5 py-4">
            <p className={`text-xl font-bold ${totalPending > 0 ? 'text-red-300' : 'text-white'}`}>{formatCurrency(totalPending)}</p>
            <p className="text-xs font-medium text-white/85 mt-1">Outstanding</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xl font-bold text-amber-300">{orderedCount + draftCount}</p>
            <p className="text-xs font-medium text-white/85 mt-1">Open Orders</p>
            <p className="text-xs text-white/45 mt-0.5">{draftCount} draft · {orderedCount} ordered</p>
          </div>
        </div>
        <div className="absolute -right-6 -top-6 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute right-20 -bottom-8 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <SearchInput placeholder="Search PO, vendor, invoice…" value={search} onChange={setSearch} className="w-64" />

        {/* Date preset */}
        <div className="relative">
          <button onClick={() => setDateDropdown(v => !v)}
            className="flex items-center gap-2 h-9 rounded-md border border-input bg-background px-3 text-sm hover:bg-muted transition-colors">
            {presetLabel} <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {dateDropdown && (
            <div className="absolute top-10 left-0 w-44 rounded-lg bg-background shadow-lg border z-50 overflow-hidden">
              {DATE_PRESETS.map(p => (
                <button key={p.value} onClick={() => { setPreset(p.value); setDateDropdown(false) }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${preset === p.value ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`}>
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="all">All Status</option>
          {Object.entries(PURCHASE_STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="all">All Payments</option>
          {Object.entries(PAYMENT_STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-sidebar">
                <tr>
                  {['PO Number', 'Vendor', 'Date', 'Items', 'Total', 'Paid', 'Balance', 'Status', 'Payment', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-light text-sidebar-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr><td colSpan={10} className="text-center py-14 text-muted-foreground">Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-14 text-muted-foreground">
                      {purchases.length === 0
                        ? 'No purchases yet. Click "New Purchase" to record your first purchase.'
                        : 'No purchases match your filters.'}
                    </td>
                  </tr>
                ) : filtered.map(p => {
                  const balance = p.total_amount - p.amount_paid
                  return (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono font-semibold text-primary">{p.purchase_number}</span>
                        {p.invoice_number && (
                          <p className="text-xs text-muted-foreground">INV: {p.invoice_number}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{p.vendor_name}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {formatDate(p.purchase_date)}
                        {p.expected_delivery && (
                          <p className="text-xs">Due: {formatDate(p.expected_delivery)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.items.length} item{p.items.length !== 1 ? 's' : ''}
                      </td>
                      <td className="px-4 py-3 font-semibold">{formatCurrency(p.total_amount)}</td>
                      <td className="px-4 py-3 text-green-600 font-medium">{formatCurrency(p.amount_paid)}</td>
                      <td className="px-4 py-3">
                        <span className={balance > 0 ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                          {formatCurrency(balance)}
                        </span>
                      </td>
                      <td className="px-4 py-3"><StatusChip status={p.status} /></td>
                      <td className="px-4 py-3"><PaymentChip status={p.payment_status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button title="View / Edit" onClick={() => navigate(`/purchases/direct/${p.id}/edit`)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          {p.status === 'draft' && (
                            <button title="Delete" onClick={() => handleDelete(p.id, p.purchase_number)}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="px-4 py-3 border-t text-xs text-muted-foreground">
              Showing {filtered.length} of {purchases.length} purchase orders
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
