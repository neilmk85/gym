import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { subscriptionsApi } from '@/api/subscriptions.api'
import { plansApi } from '@/api/plans.api'
import { QUERY_KEYS } from '@/lib/constants'
import { formatCurrency } from '@/lib/utils'

const schema = z.object({
  member_id: z.coerce.number().int().positive('Member ID required'),
  plan_id: z.coerce.number().int().positive('Plan ID required'),
  start_date: z.string().min(1, 'Start date required'),
  manual_discount_amount: z.coerce.number().min(0, 'Cannot be negative').default(0),
  promo_code: z.string().optional(),
  auto_renew: z.boolean().default(false),
  extra_months: z.coerce.number().int().min(0).default(0),
  extra_days: z.coerce.number().int().min(0).default(0),
})

type FormValues = z.infer<typeof schema>

export default function SubscriptionFormPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [planIdInput, setPlanIdInput] = useState<number | null>(null)

  const { register, handleSubmit, control, watch, formState: { errors }, setError, clearErrors } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      start_date: new Date().toISOString().split('T')[0],
      manual_discount_amount: 0,
      auto_renew: false,
      extra_months: 0,
      extra_days: 0,
    },
  })

  const watchedPlanId = watch('plan_id')
  const watchedDiscount = watch('manual_discount_amount') ?? 0

  // Debounce plan ID lookup
  useEffect(() => {
    const t = setTimeout(() => setPlanIdInput(watchedPlanId || null), 500)
    return () => clearTimeout(t)
  }, [watchedPlanId])

  const { data: planData } = useQuery({
    queryKey: [QUERY_KEYS.plans, planIdInput],
    queryFn: () => plansApi.getById(planIdInput!),
    enabled: !!planIdInput && planIdInput > 0,
  })
  const selectedPlan = planData as any

  const maxDiscountPercent: number = selectedPlan?.max_discount_percent ?? 0
  const price: number = selectedPlan?.price_amount ?? 0
  const maxDiscountAmount = price > 0 ? (price * maxDiscountPercent) / 100 : 0
  const finalAmount = Math.max(0, price - Number(watchedDiscount))
  const discountExceedsMax = maxDiscountPercent > 0 && Number(watchedDiscount) > maxDiscountAmount

  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      if (discountExceedsMax) {
        throw new Error(`Discount cannot exceed ₹${maxDiscount.toLocaleString('en-IN')} for this plan`)
      }
      return subscriptionsApi.create({
        ...data,
        manual_discount_amount: data.manual_discount_amount || 0,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.subscriptions] })
      toast.success('Subscription created')
      navigate('/memberships')
    },
    onError: (err: any) => toast.error(err?.message ?? err?.response?.data?.error ?? 'Failed to create subscription'),
  })

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" title="Back" onClick={() => navigate('/memberships')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">New Membership</h1>
          <p className="text-sm text-muted-foreground">Create a new membership</p>
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
                <Label>Plan ID <span className="text-destructive">*</span></Label>
                <Input type="number" min="1" {...register('plan_id')} placeholder="Plan ID" />
                {errors.plan_id && <p className="text-xs text-destructive">{errors.plan_id.message}</p>}
                {selectedPlan && (
                  <p className="text-xs text-muted-foreground">{selectedPlan.name} · {formatCurrency(selectedPlan.price_amount)}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Start Date <span className="text-destructive">*</span></Label>
              <Input type="date" {...register('start_date')} />
              {errors.start_date && <p className="text-xs text-destructive">{errors.start_date.message}</p>}
            </div>

            {/* Discount */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>
                  Discount (₹)
                  {maxDiscountPercent > 0 && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      max {maxDiscountPercent}% = {formatCurrency(maxDiscountAmount)}
                    </span>
                  )}
                  {selectedPlan && maxDiscountPercent === 0 && (
                    <span className="ml-2 text-xs font-normal text-amber-600">no discount allowed on this plan</span>
                  )}
                </Label>
                {selectedPlan && price > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Final: <span className={`font-semibold ${Number(watchedDiscount) > 0 ? 'text-emerald-600' : 'text-foreground'}`}>
                      {formatCurrency(finalAmount)}
                    </span>
                  </span>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  className={`pl-7 ${discountExceedsMax ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  placeholder="0"
                  disabled={selectedPlan && maxDiscountPercent === 0}
                  {...register('manual_discount_amount')}
                />
              </div>
              {discountExceedsMax && (
                <p className="text-xs text-destructive">
                  Discount exceeds the maximum of {formatCurrency(maxDiscountAmount)} ({maxDiscountPercent}%) allowed for this plan
                </p>
              )}
              {errors.manual_discount_amount && (
                <p className="text-xs text-destructive">{errors.manual_discount_amount.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Promo Code</Label>
              <Input {...register('promo_code')} placeholder="SAVE10" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Extra Months</Label>
                <Input type="number" min="0" {...register('extra_months')} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Extra Days</Label>
                <Input type="number" min="0" {...register('extra_days')} placeholder="0" />
              </div>
            </div>

            <Controller control={control} name="auto_renew" render={({ field }) => (
              <label className="flex items-center gap-3 cursor-pointer select-none py-1">
                <input type="checkbox" checked={field.value} onChange={e => field.onChange(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 accent-primary cursor-pointer" />
                <span className="text-sm">Auto Renew</span>
              </label>
            )} />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate('/memberships')}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending || discountExceedsMax}>
                {mutation.isPending ? 'Creating...' : 'Create Membership'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
