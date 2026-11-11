import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { paymentsApi } from '@/api/payments.api'
import { QUERY_KEYS } from '@/lib/constants'
import { formatCurrency, formatDate } from '@/lib/utils'

const PER_PAGE = 20

export default function PaymentsListPage() {
  const [page, setPage] = useState(1)

  const { data, isLoading, isError } = useQuery({
    queryKey: QUERY_KEYS.payments({ page, per_page: PER_PAGE }),
    queryFn: () => paymentsApi.list({ page, per_page: PER_PAGE }),
  })

  const payments = (data as { payments?: unknown[] })?.payments
    ?? (data as { items?: unknown[] })?.items
    ?? []
  const meta = (data as { meta?: { total?: number; per_page?: number } })?.meta
  const total = meta?.total ?? 0
  const perPage = meta?.per_page ?? PER_PAGE

  return (
    <div>
      <PageHeader title="Payments" subtitle="View and manage payment records" />

      <Card>
        <CardContent className="p-0">
          {isError && (
            <div className="p-6 text-sm text-destructive">Failed to load payments. Please try again.</div>
          )}
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !isError && payments.length === 0 ? (
            <EmptyState title="No payments found" />
          ) : (
            <div className="rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-sidebar">
                  <tr>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Payment ID</th>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Member ID</th>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Amount</th>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Method</th>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {payments.map((payment, idx) => {
                    const p = payment as {
                      id?: number
                      member_id?: number
                      amount?: number
                      payment_method?: string
                      status?: string
                      created_at?: string
                    }
                    return (
                      <tr key={p.id ?? idx} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs">{p.id ?? '-'}</td>
                        <td className="px-4 py-3">{p.member_id ?? '-'}</td>
                        <td className="px-4 py-3 font-medium">
                          {p.amount !== undefined ? formatCurrency(p.amount) : '-'}
                        </td>
                        <td className="px-4 py-3 capitalize text-muted-foreground">
                          {p.payment_method?.replace(/_/g, ' ') ?? '-'}
                        </td>
                        <td className="px-4 py-3">
                          {p.status ? <StatusBadge status={p.status} /> : '-'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {p.created_at ? formatDate(p.created_at) : '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {!isLoading && total > 0 && (
        <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
          <span>
            Showing {Math.min((page - 1) * perPage + 1, total)}–{Math.min(page * perPage, total)} of {total}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>
              Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page * perPage >= total}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
