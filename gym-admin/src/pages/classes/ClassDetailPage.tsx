import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { classesApi } from '@/api/classes.api'
import { QUERY_KEYS } from '@/lib/constants'
import { formatDateTime } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'

export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const classId = Number(id)

  const { data: gymClass, isLoading, isError } = useQuery({
    queryKey: QUERY_KEYS.gymClass(classId),
    queryFn: () => classesApi.getById(classId),
    enabled: !!classId,
  })

  const { data: rosterData, isLoading: rosterLoading } = useQuery({
    queryKey: QUERY_KEYS.classRoster(classId),
    queryFn: () => classesApi.getRoster(classId),
    enabled: !!classId,
  })

  const c = gymClass as {
    name?: string
    class_type?: string
    trainer_id?: number
    start_time?: string
    end_time?: string
    duration_mins?: number
    max_capacity?: number
    current_bookings?: number
    status?: string
    is_active?: boolean
  } | undefined

  const roster = Array.isArray(rosterData)
    ? rosterData
    : ((rosterData as unknown) as { bookings?: unknown[] } | undefined)?.bookings ?? []

  if (isError) {
    return (
      <div className="p-6">
        <Button variant="outline" onClick={() => navigate('/classes')} className="mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Classes
        </Button>
        <p className="text-destructive">Failed to load class details.</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={isLoading ? 'Loading...' : (c?.name ?? `Class ${id}`)}
        subtitle={c?.class_type ? `Type: ${c.class_type}` : `Class ID: ${id}`}
        actions={
          <Button variant="outline" onClick={() => navigate('/classes')}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">Class Details</h3>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-medium">{c?.name ?? '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="capitalize">{c?.class_type ?? '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Trainer ID</span>
                  <span>{c?.trainer_id ?? 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Start Time</span>
                  <span>{c?.start_time ? formatDateTime(c.start_time) : '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">End Time</span>
                  <span>{c?.end_time ? formatDateTime(c.end_time) : '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duration</span>
                  <span>{c?.duration_mins !== undefined ? `${c.duration_mins} min` : '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Capacity</span>
                  <span>
                    {c?.current_bookings !== undefined && c?.max_capacity !== undefined
                      ? `${c.current_bookings} / ${c.max_capacity}`
                      : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  {c?.status ? <StatusBadge status={c.status} /> : <span>-</span>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">Class Roster</h3>
            {rosterLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : roster.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bookings for this class yet.</p>
            ) : (
              <div className="space-y-2">
                {roster.map((booking, idx) => {
                  const b = booking as {
                    id?: number
                    member_id?: number
                    status?: string
                    created_at?: string
                  }
                  return (
                    <div
                      key={b.id ?? idx}
                      className="flex items-center justify-between p-2 rounded border text-sm"
                    >
                      <span className="text-muted-foreground">Member #{b.member_id ?? '-'}</span>
                      <div className="flex items-center gap-2">
                        {b.status && <StatusBadge status={b.status} />}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
