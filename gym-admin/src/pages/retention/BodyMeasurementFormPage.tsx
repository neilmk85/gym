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
  measured_at: z.string().min(1, 'Date required'),
  weight_kg: z.coerce.number().positive().optional().or(z.literal('')),
  height_cm: z.coerce.number().positive().optional().or(z.literal('')),
  body_fat_pct: z.coerce.number().min(0).max(100).optional().or(z.literal('')),
  muscle_mass_kg: z.coerce.number().positive().optional().or(z.literal('')),
  waist_cm: z.coerce.number().positive().optional().or(z.literal('')),
  chest_cm: z.coerce.number().positive().optional().or(z.literal('')),
  hips_cm: z.coerce.number().positive().optional().or(z.literal('')),
  thigh_cm: z.coerce.number().positive().optional().or(z.literal('')),
  bicep_cm: z.coerce.number().positive().optional().or(z.literal('')),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export default function BodyMeasurementFormPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { measured_at: new Date().toISOString().split('T')[0] },
  })

  const mutation = useMutation({
    mutationFn: (data: FormValues) => retentionApi.recordMeasurement(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['retention', 'measurements'] })
      toast.success('Measurement recorded')
      navigate('/retention/measurements')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to record measurement'),
  })

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" title="Back" onClick={() => navigate('/retention/measurements')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Record Measurement</h1>
          <p className="text-sm text-muted-foreground">Record body measurements for a member</p>
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
                <Label>Measured At <span className="text-destructive">*</span></Label>
                <Input type="date" {...register('measured_at')} />
                {errors.measured_at && <p className="text-xs text-destructive">{errors.measured_at.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Weight (kg)</Label>
                <Input type="number" step="0.1" min="0" {...register('weight_kg')} placeholder="70.5" />
              </div>
              <div className="space-y-1.5">
                <Label>Height (cm)</Label>
                <Input type="number" step="0.1" min="0" {...register('height_cm')} placeholder="175" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Body Fat (%)</Label>
                <Input type="number" step="0.1" min="0" max="100" {...register('body_fat_pct')} placeholder="20.0" />
              </div>
              <div className="space-y-1.5">
                <Label>Muscle Mass (kg)</Label>
                <Input type="number" step="0.1" min="0" {...register('muscle_mass_kg')} placeholder="55.0" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Waist (cm)</Label>
                <Input type="number" step="0.1" min="0" {...register('waist_cm')} placeholder="80" />
              </div>
              <div className="space-y-1.5">
                <Label>Chest (cm)</Label>
                <Input type="number" step="0.1" min="0" {...register('chest_cm')} placeholder="95" />
              </div>
              <div className="space-y-1.5">
                <Label>Hips (cm)</Label>
                <Input type="number" step="0.1" min="0" {...register('hips_cm')} placeholder="90" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Thigh (cm)</Label>
                <Input type="number" step="0.1" min="0" {...register('thigh_cm')} placeholder="55" />
              </div>
              <div className="space-y-1.5">
                <Label>Bicep (cm)</Label>
                <Input type="number" step="0.1" min="0" {...register('bicep_cm')} placeholder="35" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea {...register('notes')} rows={2} placeholder="Any notes about this measurement…" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate('/retention/measurements')}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Recording...' : 'Record Measurement'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
