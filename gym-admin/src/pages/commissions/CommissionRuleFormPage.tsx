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
import { Card, CardContent } from '@/components/ui/card'
import { commissionApi } from '@/api/commission.api'

const schema = z.object({
  staff_id: z.coerce.number().int().positive('Staff ID required'),
  event_type: z.string().min(1, 'Event type required'),
  rule_type: z.enum(['percentage', 'fixed']),
  value: z.coerce.number().min(0, 'Value must be ≥ 0'),
})

type FormValues = z.infer<typeof schema>

export default function CommissionRuleFormPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [searchParams] = useSearchParams()
  const staffIdFromUrl = searchParams.get('staff_id')

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      staff_id: staffIdFromUrl ? Number(staffIdFromUrl) : undefined as any,
      rule_type: 'percentage',
      value: 0,
    },
  })

  const ruleType = watch('rule_type')

  const mutation = useMutation({
    mutationFn: (data: FormValues) => commissionApi.createRule({
      staff_id: data.staff_id,
      event_type: data.event_type,
      rule_type: data.rule_type,
      value: data.value,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commission-rules'] })
      toast.success('Commission rule created')
      navigate('/commissions')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to create rule'),
  })

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" title="Back" onClick={() => navigate('/commissions')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Add Commission Rule</h1>
          <p className="text-sm text-muted-foreground">Create a commission rule for a staff member</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit(v => mutation.mutate(v))} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Staff User ID <span className="text-destructive">*</span></Label>
              <Input type="number" min="1" {...register('staff_id')} placeholder="Staff User ID" />
              {errors.staff_id && <p className="text-xs text-destructive">{errors.staff_id.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Event Type <span className="text-destructive">*</span></Label>
              <Input {...register('event_type')} placeholder="new_subscription, pt_session…" />
              {errors.event_type && <p className="text-xs text-destructive">{errors.event_type.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Rule Type <span className="text-destructive">*</span></Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" {...register('rule_type')}>
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed (paise)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Value ({ruleType === 'percentage' ? '%' : 'paise'}) <span className="text-destructive">*</span></Label>
                <Input type="number" min="0" step="0.01" {...register('value')} placeholder="10" />
                {errors.value && <p className="text-xs text-destructive">{errors.value.message}</p>}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate('/commissions')}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Creating...' : 'Create Rule'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
