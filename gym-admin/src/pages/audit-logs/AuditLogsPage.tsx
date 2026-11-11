import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { auditLogsApi } from '@/api/audit-logs.api'
import { QUERY_KEYS } from '@/lib/constants'
import { formatDateTime } from '@/lib/utils'

const PER_PAGE = 20

export default function AuditLogsPage() {
  const [page, setPage] = useState(1)

  const { data, isLoading, isError } = useQuery({
    queryKey: QUERY_KEYS.auditLogs({ page, per_page: PER_PAGE }),
    queryFn: () => auditLogsApi.list({ page, per_page: PER_PAGE }),
  })

  const logs = (data as { logs?: unknown[] })?.logs
    ?? (data as { items?: unknown[] })?.items
    ?? []
  const meta = (data as { meta?: { total?: number; per_page?: number } })?.meta
  const total = meta?.total ?? 0
  const perPage = meta?.per_page ?? PER_PAGE

  return (
    <div>
      <PageHeader title="Audit Logs" subtitle="System activity and change history" />

      <Card>
        <CardContent className="p-0">
          {isError && (
            <div className="p-6 text-sm text-destructive">Failed to load audit logs. Please try again.</div>
          )}
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !isError && logs.length === 0 ? (
            <EmptyState title="No audit logs found" />
          ) : (
            <div className="rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-sidebar">
                  <tr>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">User ID</th>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Action</th>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Resource Type</th>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Resource ID</th>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">IP Address</th>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {logs.map((log, idx) => {
                    const l = log as {
                      id?: number
                      user_id?: number
                      action?: string
                      resource_type?: string
                      resource_id?: number | string
                      ip_address?: string
                      created_at?: string
                    }
                    return (
                      <tr key={l.id ?? idx} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">{l.user_id ?? '-'}</td>
                        <td className="px-4 py-3 font-mono text-xs capitalize">
                          {l.action?.replace(/_/g, ' ') ?? '-'}
                        </td>
                        <td className="px-4 py-3 capitalize text-muted-foreground">
                          {l.resource_type?.replace(/_/g, ' ') ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{l.resource_id ?? '-'}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {l.ip_address ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {l.created_at ? formatDateTime(l.created_at) : '-'}
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
