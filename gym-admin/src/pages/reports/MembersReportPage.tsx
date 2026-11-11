import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatsCard } from '@/components/shared/StatsCard'
import { CSVExportButton } from '@/components/shared/CSVExportButton'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { reportsApi } from '@/api/reports.api'
import { QUERY_KEYS } from '@/lib/constants'
import { Users, TrendingUp, UserCheck } from 'lucide-react'

function getDefaultDates() {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 30)
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  }
}

export default function MembersReportPage() {
  const defaults = getDefaultDates()
  const [from, setFrom] = useState(defaults.from)
  const [to, setTo] = useState(defaults.to)

  const { data, isLoading, isError } = useQuery({
    queryKey: QUERY_KEYS.membersReport({ from, to }),
    queryFn: () => reportsApi.members({ from, to }),
  })

  const report = data as {
    summary?: {
      total_members?: number
      new_members?: number
      active_members?: number
      churned_members?: number
    }
    daily_breakdown?: unknown[]
  } | undefined

  const summary = report?.summary
  const dailyBreakdown = report?.daily_breakdown ?? []

  return (
    <div>
      <PageHeader
        title="Members Report"
        subtitle="Member growth and demographics"
        actions={
          <CSVExportButton
            endpoint="/reports/members"
            params={{ from, to }}
            filename={`members-report-${from}-${to}.csv`}
          />
        }
      />

      {/* Date range */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex flex-col gap-1">
              <Label htmlFor="from">From</Label>
              <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="to">To</Label>
              <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
            </div>
          </div>
        </CardContent>
      </Card>

      {isError && (
        <p className="text-sm text-destructive mb-4">Failed to load members report. Please try again.</p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard
          title="Total Members"
          value={summary?.total_members ?? 0}
          icon={<Users className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <StatsCard
          title="New Members"
          value={summary?.new_members ?? 0}
          icon={<TrendingUp className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <StatsCard
          title="Active Members"
          value={summary?.active_members ?? 0}
          icon={<UserCheck className="h-4 w-4" />}
          isLoading={isLoading}
        />
        <StatsCard
          title="Churned Members"
          value={summary?.churned_members ?? 0}
          icon={<Users className="h-4 w-4" />}
          isLoading={isLoading}
        />
      </div>

      {/* Daily breakdown */}
      {dailyBreakdown.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">Daily Breakdown</h3>
            <div className="rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-sidebar">
                  <tr>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Date</th>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">New Members</th>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Churned</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {dailyBreakdown.map((row, idx) => {
                    const r = row as { date?: string; new_members?: number; churned?: number }
                    return (
                      <tr key={r.date ?? idx} className="hover:bg-muted/30">
                        <td className="px-4 py-3 text-muted-foreground">{r.date ?? '-'}</td>
                        <td className="px-4 py-3">{r.new_members ?? 0}</td>
                        <td className="px-4 py-3">{r.churned ?? 0}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
