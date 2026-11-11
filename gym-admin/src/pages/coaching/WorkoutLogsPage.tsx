import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { coachingApi, type WorkoutLog } from '@/api/coaching.api'
import { formatDate } from '@/lib/utils'

const statusColor = (s: string) => {
  if (s === 'completed') return 'green'
  if (s === 'skipped') return 'red'
  return 'yellow'
}

export default function WorkoutLogsPage() {
  const navigate = useNavigate()
  const [filterMemberId, setFilterMemberId] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['workout-logs', filterMemberId],
    queryFn: () => filterMemberId
      ? coachingApi.listWorkoutLogsByMember(filterMemberId, { per_page: 50 })
      : Promise.resolve({ workout_logs: [] }),
    enabled: !!filterMemberId,
  })

  const logs: WorkoutLog[] = (data as any)?.workout_logs ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Workout Logs" subtitle="Member workout session records" />
        <Button onClick={() => navigate('/coaching/logs/new')}>+ Log Workout</Button>
      </div>

      <div className="flex gap-2 items-center">
        <Label className="text-sm text-muted-foreground whitespace-nowrap">View Member ID:</Label>
        <Input
          type="number"
          className="max-w-32"
          placeholder="Member ID"
          onChange={e => setFilterMemberId(parseInt(e.target.value) || null)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : !filterMemberId ? (
            <EmptyState title="Enter a Member ID" description="Enter a member ID above to view their workout logs." />
          ) : logs.length === 0 ? (
            <EmptyState title="No workout logs" description="This member has no workout logs yet." />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-sidebar">
                <tr>
                  {['Date', 'Status', 'Duration', 'Notes'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map(l => (
                  <tr key={l.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{formatDate(l.log_date)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={l.status} color={statusColor(l.status)} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{l.duration_minutes ? `${l.duration_minutes} min` : '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs truncate">{l.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
