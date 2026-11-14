import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { billingApi, type Receipt } from '@/api/billing.api'
import { QUERY_KEYS } from '@/lib/constants'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Receipt as ReceiptIcon, CreditCard, Banknote, Smartphone, ArrowLeftRight, FileText } from 'lucide-react'

const PER_PAGE = 20

const METHOD_CONFIG: Record<string, { label: string; icon: React.ElementType; bg: string; text: string; dot: string }> = {
  cash:         { label: 'Cash',        icon: Banknote,       bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  card:         { label: 'Card',        icon: CreditCard,     bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-400'    },
  upi:          { label: 'UPI',         icon: Smartphone,     bg: 'bg-purple-50',  text: 'text-purple-700',  dot: 'bg-purple-400'  },
  bank_transfer:{ label: 'Bank Transfer',icon: ArrowLeftRight, bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400'   },
  online:       { label: 'Online',      icon: CreditCard,     bg: 'bg-sky-50',     text: 'text-sky-700',     dot: 'bg-sky-400'     },
}

function getMethodConfig(method: string) {
  return METHOD_CONFIG[method.toLowerCase()] ?? {
    label: method.replace(/_/g, ' '),
    icon: CreditCard,
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    dot: 'bg-gray-400',
  }
}

function PaymentBadge({ method }: { method: string }) {
  const cfg = getMethodConfig(method)
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium capitalize ${cfg.bg} ${cfg.text}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  )
}

function formatPaidAt(dateStr: string) {
  const d = new Date(dateStr)
  const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  return { date, time }
}

export default function ReceiptsPage() {
  const [page, setPage]           = useState(1)
  const [methodFilter, setMethod] = useState('all')

  const { data, isLoading, isError } = useQuery({
    queryKey: QUERY_KEYS.receipts({ page, per_page: PER_PAGE }),
    queryFn: () => billingApi.listReceipts({ page, per_page: PER_PAGE }),
  })

  const allReceipts: Receipt[] = (data as { receipts?: Receipt[] })?.receipts ?? []
  const meta  = (data as { meta?: { total?: number } })?.meta
  const total = meta?.total ?? 0

  const receipts = useMemo(() =>
    methodFilter === 'all'
      ? allReceipts
      : allReceipts.filter(r => r.payment_method.toLowerCase() === methodFilter),
    [allReceipts, methodFilter],
  )

  const stats = useMemo(() => {
    const totalAmt = allReceipts.reduce((s, r) => s + Number(r.amount_received), 0)
    const byMethod: Record<string, number> = {}
    allReceipts.forEach(r => {
      const m = r.payment_method.toLowerCase()
      byMethod[m] = (byMethod[m] ?? 0) + 1
    })
    return { totalAmt, byMethod }
  }, [allReceipts])

  const methodTabs = ['all', ...Object.keys(stats.byMethod)]

  return (
    <div className="space-y-5">
      <PageHeader title="Receipts" subtitle="Payment receipts issued to members" />

      {/* Stats bar */}
      {!isLoading && allReceipts.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border p-4 shadow-sm">
            <p className="text-xs text-muted-foreground mb-1">Total Receipts</p>
            <p className="text-2xl font-bold">{total}</p>
          </div>
          <div className="bg-white rounded-xl border p-4 shadow-sm">
            <p className="text-xs text-muted-foreground mb-1">Amount (this page)</p>
            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.totalAmt)}</p>
          </div>
          {Object.entries(stats.byMethod).slice(0, 2).map(([method, count]) => {
            const cfg = getMethodConfig(method)
            return (
              <div key={method} className={`rounded-xl border p-4 shadow-sm ${cfg.bg}`}>
                <p className={`text-xs font-medium mb-1 ${cfg.text}`}>{cfg.label}</p>
                <p className={`text-2xl font-bold ${cfg.text}`}>{count}</p>
                <p className={`text-xs ${cfg.text} opacity-70`}>receipts</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Filter tabs */}
      {!isLoading && methodTabs.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          {methodTabs.map(m => {
            const cfg = m === 'all' ? null : getMethodConfig(m)
            const active = methodFilter === m
            return (
              <button key={m} onClick={() => setMethod(m)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  active
                    ? cfg ? `${cfg.bg} ${cfg.text} border-transparent shadow-sm` : 'bg-gray-900 text-white border-transparent'
                    : 'bg-white text-muted-foreground border-border hover:border-gray-300'
                }`}>
                {cfg && <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />}
                {m === 'all' ? 'All Methods' : cfg?.label ?? m}
                {m !== 'all' && (
                  <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${active ? 'bg-white/30' : 'bg-muted'}`}>
                    {stats.byMethod[m]}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Content */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {isError && (
          <div className="p-6 text-sm text-destructive">Failed to load receipts.</div>
        )}

        {isLoading ? (
          <div className="divide-y">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="px-5 py-4 flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ) : receipts.length === 0 ? (
          <EmptyState title="No receipts found" description="Receipts appear here after payments are recorded." />
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 px-5 py-2.5 bg-gray-50/70 border-b text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              <span>Receipt</span>
              <span>Member</span>
              <span>Method</span>
              <span>Date</span>
              <span className="text-right">Amount</span>
            </div>

            <div className="divide-y">
              {receipts.map(rec => {
                const { date, time } = formatPaidAt(rec.paid_at)
                const cfg = getMethodConfig(rec.payment_method)
                return (
                  <div key={rec.id}
                    className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 px-5 py-3.5 items-center hover:bg-gray-50/60 transition-colors group">

                    {/* Receipt # */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${cfg.bg}`}>
                        <ReceiptIcon className={`h-4 w-4 ${cfg.text}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-mono font-semibold text-sm text-primary truncate">{rec.receipt_number}</p>
                        {rec.invoice_id && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <FileText className="h-3 w-3" />
                            Inv #{rec.invoice_id}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Member */}
                    <div>
                      <span className="inline-block text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono font-medium">
                        #{rec.member_id}
                      </span>
                    </div>

                    {/* Method */}
                    <div>
                      <PaymentBadge method={rec.payment_method} />
                    </div>

                    {/* Date */}
                    <div>
                      <p className="text-sm font-medium">{date}</p>
                      <p className="text-xs text-muted-foreground">{time}</p>
                    </div>

                    {/* Amount */}
                    <div className="text-right">
                      <p className="text-base font-bold text-emerald-600">{formatCurrency(rec.amount_received)}</p>
                      <p className="text-[11px] text-muted-foreground uppercase">{rec.currency}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {total > PER_PAGE && (
          <div className="flex items-center justify-between px-5 py-3 border-t bg-gray-50/50">
            <span className="text-sm text-muted-foreground">
              {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} of {total}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button size="sm" variant="outline" disabled={page * PER_PAGE >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
