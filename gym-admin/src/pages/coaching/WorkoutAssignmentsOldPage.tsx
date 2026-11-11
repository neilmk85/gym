import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { coachingApi, type WorkoutAssignment } from '@/api/coaching.api'
import { formatDate } from '@/lib/utils'

const statusColor = (s: string) => {
  if (s === 'active') return 'green'
  if (s === 'revoked') return 'red'
  return 'gray'
}

export default function WorkoutAssignmentsOldPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [filterTrainerId, setFilterTrainerId] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['workout-assignments-old', filterTrainerId],
    queryFn: () => filterTrainerId
      ? coachingApi.listWorkoutAssignmentsByTrainer(filterTrainerId, { per_page: 50 })
      : Promise.resolve({ workout_assignments: [] }),
    enabled: !!filterTrainerId,
  })

  const assignments: WorkoutAssignment[] = (data as any)?.workout_assignments ?? []

  const revokeMutation = useMutation({
    mutationFn: (id: number) => coachingApi.revokeWorkoutAssignment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workout-assignments-old'] }),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Workout Assignments" subtitle="Assign workout plans to members" />
        <Button onClick={() => navigate('/coaching/workouts/new')}>+ New Assignment</Button>
      </div>

      <div className="flex gap-2 items-center">
        <Label className="text-sm text-muted-foreground whitespace-nowrap">View by Trainer ID:</Label>
        <Input
          type="number"
          className="max-w-32"
          placeholder="Trainer ID"
          onChange={e => setFilterTrainerId(parseInt(e.target.value) || null)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : !filterTrainerId ? (
            <EmptyState title="Enter a Trainer ID" description="Enter a trainer ID above to view their assignments." />
          ) : assignments.length === 0 ? (
            <EmptyState title="No assignments found" description="This trainer has no workout assignments yet." />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-sidebar">
                <tr>
                  {['Member', 'Title', 'Start Date', 'End Date', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {assignments.map(a => {
                  const memberName = a.member?.user ? `${a.member.user.first_name} ${a.member.user.last_name}` : `Member #${a.member_id}`
                  return (
                    <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{memberName}</td>
                      <td className="px-4 py-3">{a.title}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(a.start_date)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{a.end_date ? formatDate(a.end_date) : '—'}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={a.status} color={statusColor(a.status)} />
                      </td>
                      <td className="px-4 py-3">
                        {a.status === 'active' && (
                          <Button size="sm" variant="outline" className="text-destructive"
                            onClick={() => revokeMutation.mutate(a.id)}
                            disabled={revokeMutation.isPending}>
                            Revoke
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
