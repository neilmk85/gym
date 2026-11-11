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
  assigned_to_id: z.coerce.number().int().positive('Assign To required'),
  due_date: z.string().min(1, 'Due date required'),
  subject: z.string().optional(),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export default function LeadFollowUpFormPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [searchParams] = useSearchParams()
  const enquiryIdFromUrl = searchParams.get('enquiry_id')

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      enquiry_id: enquiryIdFromUrl ? Number(enquiryIdFromUrl) : undefined as any,
      due_date: '',
    },
  })

  const mutation = useMutation({
    mutationFn: (data: FormValues) => crmApi.createFollowUp(data.enquiry_id, {
      assigned_to_id: data.assigned_to_id,
      due_date: data.due_date,
      subject: data.subject,
      notes: data.notes,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-followups'] })
      toast.success('Follow-up scheduled')
      navigate('/crm/follow-ups')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to schedule follow-up'),
  })

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" title="Back" onClick={() => navigate('/crm/follow-ups')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Schedule Follow-Up</h1>
          <p className="text-sm text-muted-foreground">Create a follow-up task for a lead</p>
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
                <Label>Assign To (User ID) <span className="text-destructive">*</span></Label>
                <Input type="number" min="1" {...register('assigned_to_id')} placeholder="Staff User ID" />
                {errors.assigned_to_id && <p className="text-xs text-destructive">{errors.assigned_to_id.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Due Date <span className="text-destructive">*</span></Label>
              <Input type="date" {...register('due_date')} />
              {errors.due_date && <p className="text-xs text-destructive">{errors.due_date.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input {...register('subject')} placeholder="Follow-up about membership…" />
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea {...register('notes')} rows={3} placeholder="What to discuss or do…" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate('/crm/follow-ups')}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Scheduling...' : 'Schedule Follow-Up'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
