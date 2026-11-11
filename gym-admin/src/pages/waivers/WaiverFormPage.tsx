import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
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
  member_id: z.coerce.number().int().positive('Member ID required'),
  waiver_type: z.enum(['liability', 'parq', 'medical']),
  content: z.string().optional(),
  answers: z.string().optional(),
  expires_at: z.string().optional(),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export default function WaiverFormPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [searchParams] = useSearchParams()
  const memberIdFromUrl = searchParams.get('member_id')

  const { register, handleSubmit, control, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      member_id: memberIdFromUrl ? Number(memberIdFromUrl) : undefined as any,
      waiver_type: 'liability',
    },
  })

  const waiverType = useWatch({ control, name: 'waiver_type' })

  const mutation = useMutation({
    mutationFn: (data: FormValues) => crmApi.createWaiver({ ...data, member_id: data.member_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['waivers'] })
      toast.success('Waiver created')
      navigate('/waivers')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to create waiver'),
  })

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" title="Back" onClick={() => navigate('/waivers')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Create Waiver</h1>
          <p className="text-sm text-muted-foreground">Create a liability or PAR-Q waiver for a member</p>
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
                <Label>Waiver Type <span className="text-destructive">*</span></Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" {...register('waiver_type')}>
                  <option value="liability">Liability</option>
                  <option value="parq">PAR-Q</option>
                  <option value="medical">Medical</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Waiver Content</Label>
              <Textarea {...register('content')} rows={6} placeholder="Enter the waiver text…" />
            </div>

            {waiverType === 'parq' && (
              <div className="space-y-1.5">
                <Label>PAR-Q Answers (JSON)</Label>
                <Textarea {...register('answers')} rows={3} placeholder='{"q1": true, "q2": false}' />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Expiry Date</Label>
              <Input type="date" {...register('expires_at')} />
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input {...register('notes')} placeholder="Any notes…" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate('/waivers')}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Creating...' : 'Create Waiver'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
