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
  rating: z.enum(['excellent', 'good', 'average', 'poor']),
  feedback: z.string().min(1, 'Feedback is required'),
  goals: z.string().optional(),
  recommendations: z.string().optional(),
  feedback_date: z.string().min(1, 'Feedback date required'),
})

type FormValues = z.infer<typeof schema>

export default function TrainerFeedbackFormPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      rating: 'good',
      feedback_date: new Date().toISOString().split('T')[0],
    },
  })

  const mutation = useMutation({
    mutationFn: (data: FormValues) => coachingApi.createTrainerFeedback(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coaching', 'feedback'] })
      toast.success('Feedback submitted')
      navigate('/coaching/feedback')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to submit feedback'),
  })

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" title="Back" onClick={() => navigate('/coaching/feedback')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Add Trainer Feedback</h1>
          <p className="text-sm text-muted-foreground">Record trainer feedback for a member</p>
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Rating <span className="text-destructive">*</span></Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" {...register('rating')}>
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="average">Average</option>
                  <option value="poor">Poor</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Feedback Date <span className="text-destructive">*</span></Label>
                <Input type="date" {...register('feedback_date')} />
                {errors.feedback_date && <p className="text-xs text-destructive">{errors.feedback_date.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Feedback <span className="text-destructive">*</span></Label>
              <Textarea {...register('feedback')} rows={3} placeholder="Overall feedback about the member's progress…" />
              {errors.feedback && <p className="text-xs text-destructive">{errors.feedback.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Goals</Label>
              <Textarea {...register('goals')} rows={2} placeholder="Current goals…" />
            </div>

            <div className="space-y-1.5">
              <Label>Recommendations</Label>
              <Textarea {...register('recommendations')} rows={2} placeholder="Recommendations for improvement…" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate('/coaching/feedback')}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Submitting...' : 'Submit Feedback'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
