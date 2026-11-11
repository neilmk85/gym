import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { retentionApi } from '@/api/retention.api'

const schema = z.object({
  member_id: z.coerce.number().int().positive('Member ID required'),
  risk_level: z.enum(['low', 'medium', 'high']),
  reason: z.string().min(1, 'Reason is required'),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export default function RetentionRiskFormPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { risk_level: 'medium' },
  })

  const mutation = useMutation({
    mutationFn: (data: FormValues) => retentionApi.raiseRisk(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['retention-risks'] })
      toast.success('Member flagged for follow-up')
      navigate('/retention/workspace')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to flag member'),
  })

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" title="Back" onClick={() => navigate('/retention/workspace')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Flag Member for Follow-up</h1>
          <p className="text-sm text-muted-foreground">Mark a member as at-risk for churn</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit(v => mutation.mutate(v))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Member ID <span className="text-destructive">*</span></Label>
                <Input type="number" min="1" {...register('member_id')} placeholder="Member ID" />
                {errors.member_id && <p className="text-xs text-destructive">{errors.member_id.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Risk Level <span className="text-destructive">*</span></Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" {...register('risk_level')}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Reason <span className="text-destructive">*</span></Label>
              <Textarea {...register('reason')} rows={3} placeholder="Why is this member at risk? e.g. hasn't visited in 3 weeks…" />
              {errors.reason && <p className="text-xs text-destructive">{errors.reason.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea {...register('notes')} rows={2} placeholder="Additional context…" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate('/retention/workspace')}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Flagging...' : 'Flag Member'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
