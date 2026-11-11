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
  log_date: z.string().min(1, 'Log date required'),
  status: z.enum(['completed', 'skipped', 'partial']),
  duration_minutes: z.coerce.number().int().min(0).optional(),
  notes: z.string().optional(),
  exercises: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export default function WorkoutLogFormPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      log_date: new Date().toISOString().split('T')[0],
      status: 'completed',
    },
  })

  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      const payload = {
        ...data,
        exercises: data.exercises ? JSON.parse(data.exercises) : undefined,
      }
      return coachingApi.createWorkoutLog(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coaching', 'logs'] })
      toast.success('Workout logged')
      navigate('/coaching/logs')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to log workout'),
  })

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" title="Back" onClick={() => navigate('/coaching/logs')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Log Workout</h1>
          <p className="text-sm text-muted-foreground">Record a completed workout session</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit(v => mutation.mutate(v))} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Member ID <span className="text-destructive">*</span></Label>
              <Input type="number" min="1" {...register('member_id')} placeholder="Member ID" />
              {errors.member_id && <p className="text-xs text-destructive">{errors.member_id.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Log Date <span className="text-destructive">*</span></Label>
                <Input type="date" {...register('log_date')} />
                {errors.log_date && <p className="text-xs text-destructive">{errors.log_date.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Status <span className="text-destructive">*</span></Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" {...register('status')}>
                  <option value="completed">Completed</option>
                  <option value="partial">Partial</option>
                  <option value="skipped">Skipped</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Duration (minutes)</Label>
              <Input type="number" min="0" {...register('duration_minutes')} placeholder="60" />
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea {...register('notes')} rows={3} placeholder="How did the session go?" />
            </div>

            <div className="space-y-1.5">
              <Label>Exercises (JSON)</Label>
              <Textarea {...register('exercises')} rows={4} placeholder='[{"name":"Squat","sets":3,"reps":10}]' />
              <p className="text-xs text-muted-foreground">Optional JSON array of exercises performed</p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate('/coaching/logs')}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Logging...' : 'Log Workout'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
