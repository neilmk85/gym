import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { billingApi, type Receipt } from '@/api/billing.api'
import { QUERY_KEYS } from '@/lib/constants'
import { formatCurrency, formatDate } from '@/lib/utils'

const PER_PAGE = 20

export default function ReceiptsPage() {
  const [page, setPage] = useState(1)

  const { data, isLoading, isError } = useQuery({
    queryKey: QUERY_KEYS.receipts({ page, per_page: PER_PAGE }),
    queryFn: () => billingApi.listReceipts({ page, per_page: PER_PAGE }),
  })

  const receipts: Receipt[] = (data as { receipts?: Receipt[] })?.receipts ?? []
  const meta = (data as { meta?: { total?: number } })?.meta
  const total = meta?.total ?? 0

  return (
    <div>
      <PageHeader title="Receipts" subtitle="Payment receipts issued to members" />

      <Card>
        <CardContent className="p-0">
          {isError && (
            <div className="p-6 text-sm text-destructive">Failed to load receipts.</div>
          )}
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !isError && receipts.length === 0 ? (
            <EmptyState title="No receipts found" description="Receipts appear here after payments are recorded." />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-sidebar">
                <tr>
                  {['Receipt #', 'Member ID', 'Amount', 'Method', 'Date', 'Invoice #'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {receipts.map((rec) => (
                  <tr key={rec.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-primary">{rec.receipt_number}</td>
                    <td className="px-4 py-3">{rec.member_id}</td>
                    <td className="px-4 py-3 font-medium">{formatCurrency(rec.amount_received)}</td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">{rec.payment_method.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(rec.paid_at)}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {rec.invoice_id ? `#${rec.invoice_id}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {total > PER_PAGE && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-sm text-muted-foreground">
                {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} of {total}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                <Button size="sm" variant="outline" disabled={page * PER_PAGE >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
