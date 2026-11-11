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
import { coachingApi } from '@/api/coaching.api'

const schema = z.object({
  member_id: z.coerce.number().int().positive('Member ID required'),
  trainer_id: z.coerce.number().int().positive('Trainer ID required'),
  title: z.string().min(1, 'Title required'),
  description: z.string().optional(),
  start_date: z.string().min(1, 'Start date required'),
  end_date: z.string().optional(),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export default function DietAssignmentFormPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { start_date: new Date().toISOString().split('T')[0] },
  })

  const mutation = useMutation({
    mutationFn: (data: FormValues) => coachingApi.createDietAssignment(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coaching', 'diet'] })
      toast.success('Diet assignment created')
      navigate('/coaching/diet')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to create assignment'),
  })

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" title="Back" onClick={() => navigate('/coaching/diet')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">New Diet Assignment</h1>
          <p className="text-sm text-muted-foreground">Assign a diet plan to a member</p>
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
                <Label>Trainer ID <span className="text-destructive">*</span></Label>
                <Input type="number" min="1" {...register('trainer_id')} placeholder="Trainer ID" />
                {errors.trainer_id && <p className="text-xs text-destructive">{errors.trainer_id.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Title <span className="text-destructive">*</span></Label>
              <Input {...register('title')} placeholder="e.g. High Protein Diet Plan" />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea {...register('description')} rows={3} placeholder="Diet plan overview…" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Start Date <span className="text-destructive">*</span></Label>
                <Input type="date" {...register('start_date')} />
                {errors.start_date && <p className="text-xs text-destructive">{errors.start_date.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>End Date</Label>
                <Input type="date" {...register('end_date')} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea {...register('notes')} rows={2} placeholder="Additional notes…" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate('/coaching/diet')}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Creating...' : 'Create Assignment'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
