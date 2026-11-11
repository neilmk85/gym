import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { coachingApi, type TrainerFeedback } from '@/api/coaching.api'
import { formatDate } from '@/lib/utils'

const ratingColor = (r: string) => {
  if (r === 'excellent') return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
  if (r === 'good') return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
  if (r === 'average') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
  if (r === 'poor') return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
  return ''
}

export default function TrainerFeedbackPage() {
  const navigate = useNavigate()
  const [filterMemberId, setFilterMemberId] = useState<number | null>(null)
  const [expandId, setExpandId] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['trainer-feedback', filterMemberId],
    queryFn: () => filterMemberId
      ? coachingApi.listFeedbackByMember(filterMemberId, { per_page: 50 })
      : Promise.resolve({ trainer_feedback: [] }),
    enabled: !!filterMemberId,
  })

  const feedbacks: TrainerFeedback[] = (data as any)?.trainer_feedback ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Trainer Feedback" subtitle="Progress notes and guidance from trainers" />
        <Button onClick={() => navigate('/coaching/feedback/new')}>+ Add Feedback</Button>
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
            <EmptyState title="Enter a Member ID" description="Enter a member ID to view their feedback history." />
          ) : feedbacks.length === 0 ? (
            <EmptyState title="No feedback yet" description="No trainer feedback for this member." />
          ) : (
            <div className="divide-y">
              {feedbacks.map(fb => {
                const trainerName = fb.trainer?.user ? `${fb.trainer.user.first_name} ${fb.trainer.user.last_name}` : `Trainer #${fb.trainer_id}`
                const isExpanded = expandId === fb.id
                return (
                  <div key={fb.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-muted-foreground">{formatDate(fb.feedback_date)}</span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs font-medium">{trainerName}</span>
                          {fb.rating && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ratingColor(fb.rating)}`}>
                              {fb.rating}
                            </span>
                          )}
                        </div>
                        <p className={`text-sm ${!isExpanded ? 'line-clamp-2' : ''}`}>{fb.feedback}</p>
                        {isExpanded && (
                          <div className="mt-2 space-y-2">
                            {fb.goals && (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Goals</p>
                                <p className="text-sm">{fb.goals}</p>
                              </div>
                            )}
                            {fb.recommendations && (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recommendations</p>
                                <p className="text-sm">{fb.recommendations}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => setExpandId(isExpanded ? null : fb.id)}>
                        {isExpanded ? 'Less' : 'More'}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
