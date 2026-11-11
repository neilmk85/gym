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
  activity_type: z.enum(['call', 'email', 'visit', 'message', 'other']),
  subject: z.string().optional(),
  notes: z.string().optional(),
  outcome: z.string().optional(),
  activity_date: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export default function LeadActivityFormPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [searchParams] = useSearchParams()
  const enquiryIdFromUrl = searchParams.get('enquiry_id')

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      enquiry_id: enquiryIdFromUrl ? Number(enquiryIdFromUrl) : undefined as any,
      activity_type: 'call',
      activity_date: new Date().toISOString().split('T')[0],
    },
  })

  const enquiryId = watch('enquiry_id')

  const mutation = useMutation({
    mutationFn: (data: FormValues) => crmApi.logActivity(data.enquiry_id, {
      activity_type: data.activity_type,
      subject: data.subject,
      notes: data.notes,
      outcome: data.outcome,
      activity_date: data.activity_date,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-activities'] })
      toast.success('Activity logged')
      navigate('/crm/activities')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to log activity'),
  })

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" title="Back" onClick={() => navigate('/crm/activities')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Log Activity</h1>
          <p className="text-sm text-muted-foreground">Record a lead activity or interaction</p>
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
                <Label>Activity Type <span className="text-destructive">*</span></Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" {...register('activity_type')}>
                  <option value="call">Call</option>
                  <option value="email">Email</option>
                  <option value="visit">Visit</option>
                  <option value="message">Message</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input {...register('subject')} placeholder="Topic of the interaction" />
            </div>

            <div className="space-y-1.5">
              <Label>Activity Date</Label>
              <Input type="date" {...register('activity_date')} />
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea {...register('notes')} rows={3} placeholder="What was discussed…" />
            </div>

            <div className="space-y-1.5">
              <Label>Outcome</Label>
              <Input {...register('outcome')} placeholder="e.g. Interested in monthly plan" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate('/crm/activities')}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Logging...' : 'Log Activity'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
