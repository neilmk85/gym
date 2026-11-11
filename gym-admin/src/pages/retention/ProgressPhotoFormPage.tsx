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
  photo_url: z.string().url('Must be a valid URL').min(1, 'Photo URL is required'),
  angle: z.enum(['front', 'side', 'back', '']).optional(),
  photo_date: z.string().min(1, 'Photo date required'),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export default function ProgressPhotoFormPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { photo_date: new Date().toISOString().split('T')[0], angle: '' },
  })

  const mutation = useMutation({
    mutationFn: (data: FormValues) => retentionApi.addPhoto({
      member_id: data.member_id,
      photo_url: data.photo_url,
      angle: data.angle || undefined,
      photo_date: data.photo_date,
      notes: data.notes,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['progress-photos'] })
      toast.success('Photo added')
      navigate('/retention/photos')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to add photo'),
  })

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" title="Back" onClick={() => navigate('/retention/photos')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Add Progress Photo</h1>
          <p className="text-sm text-muted-foreground">Record a progress photo for a member</p>
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
                <Label>Photo Date <span className="text-destructive">*</span></Label>
                <Input type="date" {...register('photo_date')} />
                {errors.photo_date && <p className="text-xs text-destructive">{errors.photo_date.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Photo URL <span className="text-destructive">*</span></Label>
              <Input type="url" {...register('photo_url')} placeholder="https://..." />
              {errors.photo_url && <p className="text-xs text-destructive">{errors.photo_url.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Angle</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" {...register('angle')}>
                <option value="">— Any —</option>
                <option value="front">Front</option>
                <option value="side">Side</option>
                <option value="back">Back</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea {...register('notes')} rows={3} placeholder="Any notes…" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate('/retention/photos')}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Adding...' : 'Add Photo'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
