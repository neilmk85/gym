import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { crmApi } from '@/api/crm.api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { Plus, CheckCircle, Clock } from 'lucide-react'

export default function LeadFollowUpsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [enquiryId, setEnquiryId] = useState('')
  const [searchId, setSearchId] = useState<number | null>(null)

  const { data: followUps = [], isLoading } = useQuery({
    queryKey: ['lead-followups', searchId],
    queryFn: () => crmApi.listFollowUps(searchId!).then(r => r.data),
    enabled: !!searchId,
  })

  const completeMutation = useMutation({
    mutationFn: (id: number) => crmApi.completeFollowUp(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lead-followups', searchId] }),
  })

  const pending = followUps.filter(f => !f.is_completed)
  const done = followUps.filter(f => f.is_completed)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Lead Follow-Ups</h1>
        {searchId && (
          <Button size="sm" onClick={() => navigate('/crm/follow-ups/new?enquiry_id=' + searchId)}>
            <Plus className="w-4 h-4 mr-2" />Schedule Follow-Up
          </Button>
        )}
      </div>

      <div className="flex gap-3">
        <Input placeholder="Enter Enquiry ID" value={enquiryId} onChange={e => setEnquiryId(e.target.value)} className="max-w-xs" type="number" />
        <Button variant="outline" onClick={() => setSearchId(Number(enquiryId))} disabled={!enquiryId}>Load</Button>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading...</p>}

      {searchId && !isLoading && (
        <div className="space-y-6">
          {pending.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Clock className="w-5 h-5 text-orange-500" /> Pending ({pending.length})</h2>
              <div className="space-y-3">
                {pending.map(f => (
                  <Card key={f.id}>
                    <CardContent className="pt-4 flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline">Due {formatDate(f.due_date)}</Badge>
                          <span className="text-sm text-muted-foreground">Assigned to #{f.assigned_to_id}</span>
                        </div>
                        {f.subject && <p className="font-medium">{f.subject}</p>}
                        {f.notes && <p className="text-sm text-muted-foreground mt-1">{f.notes}</p>}
                      </div>
                      <Button size="sm" variant="outline" onClick={() => completeMutation.mutate(f.id)} disabled={completeMutation.isPending}>
                        <CheckCircle className="w-4 h-4 mr-1" /> Done
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {done.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-muted-foreground"><CheckCircle className="w-5 h-5 text-green-500" /> Completed ({done.length})</h2>
              <div className="space-y-3">
                {done.map(f => (
                  <Card key={f.id} className="opacity-60">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary">Completed {f.completed_at ? formatDate(f.completed_at) : ''}</Badge>
                      </div>
                      {f.subject && <p className="font-medium">{f.subject}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {followUps.length === 0 && (
            <p className="text-muted-foreground text-sm">No follow-ups for enquiry #{searchId}.</p>
          )}
        </div>
      )}
    </div>
  )
}
