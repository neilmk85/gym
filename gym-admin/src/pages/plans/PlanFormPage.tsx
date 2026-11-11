import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, CheckCircle, Ban, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { plansApi } from '@/api/plans.api'
import { QUERY_KEYS } from '@/lib/constants'
import {
  loadPlanTimeRestriction, savePlanTimeRestriction,
  ALL_DAYS, type PlanTimeRestriction,
} from '@/lib/plan-time-store'

const planSchema = z.object({
  facility_id: z.coerce.number().min(1, 'Facility is required'),
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional().default(''),
  type: z.enum(['basic', 'premium', 'vip', 'custom']),
  billing_period_days: z.coerce.number().int().min(1, 'Must be ≥ 1 day'),
  price_amount: z.coerce.number().min(0, 'Price must be ≥ 0'),
  currency: z.string().min(1, 'Currency is required').default('INR'),
  max_discount_percent: z.coerce.number().min(0, 'Must be ≥ 0').max(100, 'Cannot exceed 100%').default(0),
  group_class_access: z.boolean().default(false),
  pt_access: z.boolean().default(false),
  locker_access: z.boolean().default(false),
  facility_access: z.boolean().default(true),
  gym_floor_access: z.boolean().default(true),
  cardio_section_access: z.boolean().default(true),
  auto_renew: z.boolean().default(false),
  max_classes_per_month: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
    z.number().int().min(0).nullable(),
  ),
  max_pt_sessions_per_month: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
    z.number().int().min(0).nullable(),
  ),
  grace_period_days: z.coerce.number().int().min(0).default(0),
  cancellation_notice_days: z.coerce.number().int().min(0).default(0),
  display_order: z.coerce.number().int().min(0).default(0),
})

const editPlanSchema = planSchema.omit({ facility_id: true })

type PlanFormValues = z.infer<typeof planSchema>
type EditPlanFormValues = z.infer<typeof editPlanSchema>

function CheckRow({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex items-center gap-3 cursor-pointer py-1 select-none">
      <input id={id} type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 accent-primary cursor-pointer" />
      <span className="text-sm">{label}</span>
    </label>
  )
}

export default function PlanFormPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)

  // Time restriction (stored locally)
  const [timeRestriction, setTimeRestriction] = useState<PlanTimeRestriction>({
    enabled: false, start_time: '06:00', end_time: '17:00', days: ALL_DAYS, label: 'Happy Hours',
  })

  useEffect(() => {
    if (isEdit && id) setTimeRestriction(loadPlanTimeRestriction(Number(id)))
  }, [isEdit, id])

  const updateTR = (patch: Partial<PlanTimeRestriction>) =>
    setTimeRestriction(prev => ({ ...prev, ...patch }))

  const toggleDay = (day: string) => {
    const days = timeRestriction.days.includes(day)
      ? timeRestriction.days.filter(d => d !== day)
      : [...timeRestriction.days, day]
    updateTR({ days })
  }

  const { data: planData, isLoading } = useQuery({
    queryKey: [QUERY_KEYS.plans, id],
    queryFn: () => plansApi.getById(Number(id)),
    enabled: isEdit,
  })
  const plan = planData as any

  const createForm = useForm<PlanFormValues>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      facility_id: 1,
      name: '',
      description: '',
      type: 'basic',
      billing_period_days: 30,
      price_amount: 0,
      currency: 'INR',
      group_class_access: false,
      pt_access: false,
      locker_access: false,
      facility_access: true,
      gym_floor_access: true,
      cardio_section_access: true,
      auto_renew: false,
      max_classes_per_month: null,
      max_pt_sessions_per_month: null,
      grace_period_days: 0,
      cancellation_notice_days: 0,
      display_order: 0,
      max_discount_percent: 0,
    },
  })

  const editForm = useForm<EditPlanFormValues>({
    resolver: zodResolver(editPlanSchema),
    values: plan ? {
      name: plan.name ?? '',
      description: plan.description ?? '',
      type: plan.type ?? 'basic',
      billing_period_days: plan.billing_period_days ?? 30,
      price_amount: plan.price_amount ?? 0,
      currency: plan.currency ?? 'INR',
      max_discount_percent: plan.max_discount_percent ?? 0,
      group_class_access: plan.group_class_access ?? false,
      pt_access: plan.pt_access ?? false,
      locker_access: plan.locker_access ?? false,
      facility_access: plan.facility_access ?? true,
      gym_floor_access: plan.gym_floor_access ?? true,
      cardio_section_access: plan.cardio_section_access ?? true,
      auto_renew: plan.auto_renew ?? false,
      max_classes_per_month: plan.max_classes_per_month ?? null,
      max_pt_sessions_per_month: plan.max_pt_sessions_per_month ?? null,
      grace_period_days: plan.grace_period_days ?? 0,
      cancellation_notice_days: plan.cancellation_notice_days ?? 0,
      display_order: plan.display_order ?? 0,
    } : undefined,
  })

  const activateMutation = useMutation({
    mutationFn: () => plansApi.activate(Number(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.plans] })
      toast.success('Plan activated')
      navigate('/membership-plans')
    },
    onError: () => toast.error('Failed to activate plan'),
  })

  const deactivateMutation = useMutation({
    mutationFn: () => plansApi.deactivate(Number(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.plans] })
      toast.success('Plan deactivated')
      navigate('/membership-plans')
    },
    onError: () => toast.error('Failed to deactivate plan'),
  })

  const createMutation = useMutation({
    mutationFn: (data: PlanFormValues) => plansApi.create(data),
    onSuccess: (resp: any) => {
      const planId = resp?.plan?.id ?? resp?.id
      if (planId) savePlanTimeRestriction(planId, timeRestriction)
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.plans] })
      toast.success('Plan created')
      navigate('/membership-plans')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to create plan'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: EditPlanFormValues) => plansApi.update(Number(id), data),
    onSettled: (_data: unknown, err: unknown) => {
      savePlanTimeRestriction(Number(id), timeRestriction)
      if (err) {
        toast.error((err as any)?.response?.data?.error ?? 'Failed to update plan')
      } else {
        qc.invalidateQueries({ queryKey: [QUERY_KEYS.plans] })
        toast.success('Plan updated')
        navigate('/membership-plans')
      }
    },
  })

  if (isEdit && isLoading) return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-96 w-full" />
    </div>
  )

  const activeForm = isEdit ? editForm : createForm
  const activeMutation = isEdit ? updateMutation : createMutation

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" title="Back" onClick={() => navigate('/membership-plans')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{isEdit ? 'Edit Plan' : 'Create Plan'}</h1>
          <p className="text-sm text-muted-foreground">
            {isEdit ? 'Update membership plan details' : 'Create a new membership plan'}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <form
            onSubmit={
              isEdit
                ? editForm.handleSubmit(v => updateMutation.mutate(v))
                : createForm.handleSubmit(v => createMutation.mutate(v))
            }
            className="space-y-5"
          >
            {/* Row 1: Name + Type + Billing Period + Facility ID (create only) */}
            <div className={`grid gap-4 ${isEdit ? 'grid-cols-3' : 'grid-cols-4'}`}>
              {!isEdit && (
                <div className="space-y-1.5">
                  <Label>Facility ID <span className="text-destructive">*</span></Label>
                  <Input type="number" min="1" {...createForm.register('facility_id')} placeholder="1" />
                  {createForm.formState.errors.facility_id && (
                    <p className="text-xs text-destructive">{createForm.formState.errors.facility_id.message}</p>
                  )}
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Plan Name <span className="text-destructive">*</span></Label>
                <Input {...activeForm.register('name')} placeholder="e.g. Monthly Premium" />
                {activeForm.formState.errors.name && (
                  <p className="text-xs text-destructive">{activeForm.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Plan Type <span className="text-destructive">*</span></Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" {...activeForm.register('type')}>
                  <option value="basic">Basic</option>
                  <option value="premium">Premium</option>
                  <option value="vip">VIP</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Billing Period (days) <span className="text-destructive">*</span></Label>
                <Input type="number" min="1" {...activeForm.register('billing_period_days')} placeholder="30" />
                {activeForm.formState.errors.billing_period_days && (
                  <p className="text-xs text-destructive">{activeForm.formState.errors.billing_period_days.message}</p>
                )}
              </div>
            </div>

            {/* Row 2: Price + Max Classes + Max PT Sessions + Max Discount */}
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label>Price (₹) <span className="text-destructive">*</span></Label>
                <Input type="number" min="0" step="0.01" {...activeForm.register('price_amount')} placeholder="0" />
                {activeForm.formState.errors.price_amount && (
                  <p className="text-xs text-destructive">{activeForm.formState.errors.price_amount.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Max Classes / Month</Label>
                <Input type="number" min="0" {...activeForm.register('max_classes_per_month')} placeholder="Unlimited" />
              </div>
              <div className="space-y-1.5">
                <Label>Max PT Sessions / Month</Label>
                <Input type="number" min="0" {...activeForm.register('max_pt_sessions_per_month')} placeholder="Unlimited" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-red-600">Max Discount</Label>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    className="pr-7"
                    {...activeForm.register('max_discount_percent')}
                    placeholder="0"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                </div>
                <p className="text-[10px] text-muted-foreground">max % allowed when selling</p>
                {activeForm.formState.errors.max_discount_percent && (
                  <p className="text-xs text-destructive">{activeForm.formState.errors.max_discount_percent.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Features</Label>
              <div className="border rounded-md px-4 py-2 flex flex-wrap gap-x-6 gap-y-1">
                <Controller control={activeForm.control} name="facility_access" render={({ field }) => (
                  <CheckRow id="facility_access" label="Facility Access" checked={field.value} onChange={field.onChange} />
                )} />
                <Controller control={activeForm.control} name="group_class_access" render={({ field }) => (
                  <CheckRow id="group_class_access" label="Group Class Access" checked={field.value} onChange={field.onChange} />
                )} />
                <Controller control={activeForm.control} name="pt_access" render={({ field }) => (
                  <CheckRow id="pt_access" label="Personal Training Access" checked={field.value} onChange={field.onChange} />
                )} />
                <Controller control={activeForm.control} name="locker_access" render={({ field }) => (
                  <CheckRow id="locker_access" label="Locker Access" checked={field.value} onChange={field.onChange} />
                )} />
                <Controller control={activeForm.control} name="gym_floor_access" render={({ field }) => (
                  <CheckRow id="gym_floor_access" label="Gym Floor" checked={field.value} onChange={field.onChange} />
                )} />
                <Controller control={activeForm.control} name="cardio_section_access" render={({ field }) => (
                  <CheckRow id="cardio_section_access" label="Cardio Section" checked={field.value} onChange={field.onChange} />
                )} />
                <Controller control={activeForm.control} name="auto_renew" render={({ field }) => (
                  <CheckRow id="auto_renew" label="Auto Renew" checked={field.value} onChange={field.onChange} />
                )} />
              </div>
            </div>

            {/* Grace Period / Cancellation / Display Order */}
            <div className="grid grid-cols-5 gap-4">
              <div className="space-y-1.5">
                <Label>Grace Period (days)</Label>
                <Input type="number" min="0" {...activeForm.register('grace_period_days')} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Cancellation Notice (days)</Label>
                <Input type="number" min="0" {...activeForm.register('cancellation_notice_days')} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Display Order</Label>
                <Input type="number" min="0" {...activeForm.register('display_order')} placeholder="0" />
              </div>
            </div>

            {/* ── Time Restriction (Happy Hours) ── */}
            <div className="border rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => updateTR({ enabled: !timeRestriction.enabled })}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium bg-muted/40 hover:bg-muted/60 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500" />
                  <span>Access Time Restriction</span>
                  <span className="text-xs text-muted-foreground font-normal">(Happy Hours, Off-Peak…)</span>
                </div>
                <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${timeRestriction.enabled ? 'bg-amber-500' : 'bg-muted-foreground/30'}`}>
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${timeRestriction.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
              </button>

              {timeRestriction.enabled && (
                <div className="px-4 py-4 space-y-4 border-t">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Label</Label>
                      <Input
                        value={timeRestriction.label}
                        onChange={e => updateTR({ label: e.target.value })}
                        placeholder="e.g. Happy Hours"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Access From</Label>
                      <Input
                        type="time"
                        value={timeRestriction.start_time}
                        onChange={e => updateTR({ start_time: e.target.value })}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Access Until</Label>
                      <Input
                        type="time"
                        value={timeRestriction.end_time}
                        onChange={e => updateTR({ end_time: e.target.value })}
                        className="h-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Valid Days</Label>
                    <div className="flex gap-1.5 flex-wrap">
                      {ALL_DAYS.map(day => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDay(day)}
                          className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                            timeRestriction.days.includes(day)
                              ? 'bg-amber-500 text-white border-amber-500'
                              : 'bg-background text-muted-foreground border-input hover:border-amber-400'
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                    <span className="font-medium">{timeRestriction.label || 'Time Restricted'}:</span>{' '}
                    Members on this plan can access the gym only between{' '}
                    <span className="font-medium">{timeRestriction.start_time}</span> and{' '}
                    <span className="font-medium">{timeRestriction.end_time}</span> on{' '}
                    <span className="font-medium">
                      {timeRestriction.days.length === 7 ? 'all days' : timeRestriction.days.join(', ')}
                    </span>.
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea {...activeForm.register('description')} rows={2} placeholder="Brief plan description…" className="resize-none" />
            </div>

            <div className="flex justify-between gap-2 pt-2">
              <div className="flex gap-2">
                {isEdit && plan && !plan.is_active && (
                  <Button
                    type="button"
                    variant="outline"
                    className="text-green-600 border-green-300 hover:bg-green-50"
                    onClick={() => activateMutation.mutate()}
                    disabled={activateMutation.isPending}
                  >
                    <CheckCircle className="h-4 w-4 mr-1.5" />
                    {activateMutation.isPending ? 'Activating...' : 'Activate Plan'}
                  </Button>
                )}
                {isEdit && plan && plan.is_active && (
                  <Button
                    type="button"
                    variant="outline"
                    className="text-red-600 border-red-300 hover:bg-red-50"
                    onClick={() => deactivateMutation.mutate()}
                    disabled={deactivateMutation.isPending}
                  >
                    <Ban className="h-4 w-4 mr-1.5" />
                    {deactivateMutation.isPending ? 'Deactivating...' : 'Deactivate Plan'}
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => navigate('/membership-plans')}>Cancel</Button>
                <Button type="submit" disabled={activeMutation.isPending}>
                  {activeMutation.isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Plan'}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
