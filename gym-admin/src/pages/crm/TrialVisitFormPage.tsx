import { useNavigate, useSearchParams } from 'react-router-dom'
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
import { crmApi } from '@/api/crm.api'

const schema = z.object({
  enquiry_id: z.coerce.number().int().positive('Enquiry ID required'),
  scheduled_at: z.string().min(1, 'Date & time required'),
  assigned_to_id: z.coerce.number().int().optional().nullable(),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export default function TrialVisitFormPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [searchParams] = useSearchParams()
  const enquiryIdFromUrl = searchParams.get('enquiry_id')

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      enquiry_id: enquiryIdFromUrl ? Number(enquiryIdFromUrl) : undefined as any,
    },
  })

  const mutation = useMutation({
    mutationFn: (data: FormValues) => crmApi.scheduleTrial(data.enquiry_id, {
      scheduled_at: new Date(data.scheduled_at).toISOString(),
      assigned_to_id: data.assigned_to_id || undefined,
      notes: data.notes,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trials-by-enquiry'] })
      qc.invalidateQueries({ queryKey: ['upcoming-trials'] })
      toast.success('Trial visit scheduled')
      navigate('/crm/trials')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to schedule trial'),
  })

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" title="Back" onClick={() => navigate('/crm/trials')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Schedule Trial Visit</h1>
          <p className="text-sm text-muted-foreground">Book a trial session for a lead</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit(v => mutation.mutate(v))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Enquiry ID <span className="text-destructive">*</span></Label>
                <Input type="number" min="1" {...register('enquiry_id')} placeholder="Enquiry ID" />
                {errors.enquiry_id && <p className="text-xs text-destructive">{errors.enquiry_id.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Assign Trainer (User ID)</Label>
                <Input type="number" min="1" {...register('assigned_to_id')} placeholder="Optional" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Date & Time <span className="text-destructive">*</span></Label>
              <Input type="datetime-local" {...register('scheduled_at')} />
              {errors.scheduled_at && <p className="text-xs text-destructive">{errors.scheduled_at.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea {...register('notes')} rows={3} placeholder="Any notes about the trial visit…" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate('/crm/trials')}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Scheduling...' : 'Schedule Trial'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
