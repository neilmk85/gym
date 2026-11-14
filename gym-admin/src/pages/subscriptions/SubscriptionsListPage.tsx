import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { FormDrawer } from '@/components/shared/FormDrawer'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SearchInput } from '@/components/shared/SearchInput'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { subscriptionsApi } from '@/api/subscriptions.api'
import { plansApi } from '@/api/plans.api'
import { QUERY_KEYS } from '@/lib/constants'
import { formatDate, cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import type { Subscription } from '@/types/subscription.types'
import type { Plan } from '@/types/plan.types'
import {
  Plus, Pause, Play, X, ArrowUpCircle, CalendarPlus,
  CreditCard, ChevronDown, ChevronUp, Repeat,
  TrendingUp, Calendar, Ban, LayoutList, Mail, Phone,
} from 'lucide-react'

const PER_PAGE = 20

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysRemaining(endDate: string) {
  const end = new Date(endDate)
  const now = new Date()
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000))
}

function formatCurrency(amount: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const PAUSE_PRESETS = [
  { label: '1 Week',   days: 7 },
  { label: '1 Month',  days: 30 },
  { label: '2 Months', days: 60 },
  { label: 'Custom',   days: 0 },
] as const

const todayISO = () => new Date().toISOString().slice(0, 10)

const pauseSchema = z.object({
  days:       z.coerce.number().min(1, 'Enter at least 1 day').max(365, 'Max 365 days'),
  start_date: z.string().min(1, 'Start date is required'),
  reason:     z.string().optional(),
})

const cancelSchema = z.object({
  reason:   z.string().min(1, 'Reason is required'),
  feedback: z.string().optional(),
})

const upgradeSchema = z.object({
  new_plan_id: z.coerce.number().min(1, 'Plan is required'),
})

const extendSchema = z.object({
  extra_months: z.coerce.number().min(0).max(24),
  extra_days:   z.coerce.number().min(0).max(365),
  reason:       z.string().optional(),
}).refine(d => d.extra_months > 0 || d.extra_days > 0, {
  message: 'Add at least 1 month or 1 day',
  path: ['extra_months'],
})

type PauseValues = z.infer<typeof pauseSchema>
type CancelValues   = z.infer<typeof cancelSchema>
type UpgradeValues  = z.infer<typeof upgradeSchema>
type ExtendValues   = z.infer<typeof extendSchema>


// ─── Pause Form ───────────────────────────────────────────────────────────────

function PauseForm({ sub, onClose }: { sub: Subscription; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [selectedPreset, setSelectedPreset] = useState<number | 'custom'>(7)
  const [days, setDays] = useState(7)
  const [startDate, setStartDate] = useState(todayISO())

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<PauseValues>({
    resolver: zodResolver(pauseSchema),
    defaultValues: { days: 7, start_date: todayISO() },
  })

  const watchedDays = watch('days') ?? days

  const resumeDate = (() => {
    try {
      const d = new Date(startDate)
      d.setDate(d.getDate() + Number(watchedDays))
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    } catch { return '—' }
  })()

  const mutation = useMutation({
    mutationFn: (d: PauseValues) => subscriptionsApi.pause(sub.id, d.reason ?? '', d.days, d.start_date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      toast.success('Subscription paused')
      onClose()
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to pause'),
  })

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
      <div className="rounded-lg bg-cyan-50 border border-cyan-200 p-3 text-sm text-cyan-800">
        Pausing will extend the subscription end date by the selected duration. Max 2 pauses per subscription.
      </div>

      {/* Duration presets */}
      <div className="space-y-2">
        <Label>Pause Duration <span className="text-destructive">*</span></Label>
        <div className="grid grid-cols-2 gap-2">
          {PAUSE_PRESETS.map((p) => {
            const isSelected = p.days === 0 ? selectedPreset === 'custom' : selectedPreset === p.days
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  if (p.days === 0) {
                    setSelectedPreset('custom')
                    setValue('days', 1)
                    setDays(1)
                  } else {
                    setSelectedPreset(p.days)
                    setValue('days', p.days)
                    setDays(p.days)
                  }
                }}
                className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors text-left ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-background border-border text-foreground hover:border-blue-400 hover:bg-blue-50'
                }`}
              >
                {p.label}
                {p.days > 0 && (
                  <span className={`block text-xs font-normal mt-0.5 ${isSelected ? 'text-blue-100' : 'text-muted-foreground'}`}>
                    {p.days} days
                  </span>
                )}
              </button>
            )
          })}
        </div>
        {selectedPreset === 'custom' && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Number of days</Label>
            <Input
              type="number"
              min={1}
              max={365}
              placeholder="e.g. 14"
              {...register('days')}
              onChange={(e) => { setValue('days', Number(e.target.value)); setDays(Number(e.target.value)) }}
            />
          </div>
        )}
        {errors.days && <p className="text-xs text-destructive">{errors.days.message}</p>}
      </div>

      {/* Start date + Resume date */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Pause Start Date <span className="text-destructive">*</span></Label>
          <Input
            type="date"
            min={todayISO()}
            {...register('start_date')}
            onChange={(e) => { setValue('start_date', e.target.value); setStartDate(e.target.value) }}
          />
          {errors.start_date && <p className="text-xs text-destructive">{errors.start_date.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className="text-muted-foreground">Resume Date</Label>
          <div className="flex h-10 items-center rounded-md border border-border bg-muted/40 px-3 text-sm font-medium text-foreground">
            {resumeDate}
          </div>
        </div>
      </div>

      {/* Reason */}
      <div className="space-y-1.5">
        <Label>Reason <span className="text-muted-foreground text-xs">(optional)</span></Label>
        <Input placeholder="e.g. Travelling abroad" {...register('reason')} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
        <Button type="submit" loading={mutation.isPending}>Pause Subscription</Button>
      </div>
    </form>
  )
}

// ─── Cancel Form ──────────────────────────────────────────────────────────────

function CancelForm({ sub, onClose }: { sub: Subscription; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { register, handleSubmit, formState: { errors } } = useForm<CancelValues>({
    resolver: zodResolver(cancelSchema),
  })

  const mutation = useMutation({
    mutationFn: (d: CancelValues) => subscriptionsApi.cancel(sub.id, d.reason, d.feedback),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      toast.success('Subscription cancelled')
      onClose()
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to cancel'),
  })

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
      <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
        Cancelling will immediately deactivate this subscription. This action cannot be undone.
      </div>
      <div className="space-y-1.5">
        <Label>Cancellation Reason <span className="text-destructive">*</span></Label>
        <Select {...register('reason')} className="w-full">
          <option value="">Select reason…</option>
          <option value="member_request">Member Request</option>
          <option value="non_payment">Non-Payment</option>
          <option value="relocation">Relocation</option>
          <option value="medical">Medical Reason</option>
          <option value="dissatisfied">Dissatisfied with service</option>
          <option value="other">Other</option>
        </Select>
        {errors.reason && <p className="text-xs text-destructive">{errors.reason.message}</p>}
      </div>
      <div className="space-y-1.5">
        <Label>Feedback <span className="text-muted-foreground text-xs">(optional)</span></Label>
        <Input placeholder="Additional comments…" {...register('feedback')} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>Back</Button>
        <Button type="submit" variant="destructive" loading={mutation.isPending}>Cancel Subscription</Button>
      </div>
    </form>
  )
}

// ─── Upgrade Form ─────────────────────────────────────────────────────────────

function UpgradeForm({ sub, plans, onClose }: { sub: Subscription; plans: Plan[]; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { register, handleSubmit, watch, formState: { errors } } = useForm<UpgradeValues>({
    resolver: zodResolver(upgradeSchema),
  })

  const mutation = useMutation({
    mutationFn: (d: UpgradeValues) => subscriptionsApi.upgrade(sub.id, d.new_plan_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      toast.success('Subscription upgraded successfully')
      onClose()
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to upgrade'),
  })

  const selectedId = watch('new_plan_id')
  const selectedPlan = plans.find((p) => p.id === Number(selectedId))
  const currentPrice = sub.plan?.price_amount ?? 0
  const otherPlans = plans.filter((p) => p.is_active && p.id !== sub.plan_id && p.price_amount > currentPrice)

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
      <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 text-sm text-orange-800">
        Only higher-tier plans are shown. Remaining days on the current plan are credited proportionally.
      </div>
      <div className="space-y-1.5">
        <Label>Current Plan</Label>
        <div className="rounded-lg border px-3 py-2 text-sm text-muted-foreground bg-muted/30 flex items-center justify-between">
          <span>{sub.plan?.name ?? `Plan #${sub.plan_id}`}</span>
          <span className="font-semibold text-gray-700">{sub.plan?.price_amount ? formatCurrency(sub.plan.price_amount) : ''}</span>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Upgrade To <span className="text-destructive">*</span></Label>
        {otherPlans.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No higher-tier plans available.</p>
        ) : (
          <Select {...register('new_plan_id')} className="w-full">
            <option value="">Select plan…</option>
            {otherPlans.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.name} — {formatCurrency(p.price_amount)} / {p.billing_period_days}d
              </option>
            ))}
          </Select>
        )}
        {selectedPlan && (
          <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2.5 text-sm text-orange-800 flex items-center justify-between">
            <span className="font-semibold">{selectedPlan.name}</span>
            <span>{formatCurrency(selectedPlan.price_amount)} · {selectedPlan.billing_period_days} days</span>
          </div>
        )}
        {errors.new_plan_id && <p className="text-xs text-destructive">{errors.new_plan_id.message}</p>}
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
        <Button type="submit" loading={mutation.isPending}>Upgrade Plan</Button>
      </div>
    </form>
  )
}

// ─── Extend Form ─────────────────────────────────────────────────────────────

function ExtendForm({ sub, onClose }: { sub: Subscription; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { register, handleSubmit, watch, formState: { errors } } = useForm<ExtendValues>({
    resolver: zodResolver(extendSchema),
    defaultValues: { extra_months: 1, extra_days: 0 },
  })

  const extraMonths = Number(watch('extra_months') ?? 0)
  const extraDays   = Number(watch('extra_days') ?? 0)

  const newEndDate = React.useMemo(() => {
    const base = new Date(sub.end_date)
    base.setMonth(base.getMonth() + extraMonths)
    base.setDate(base.getDate() + extraDays)
    return base
  }, [sub.end_date, extraMonths, extraDays])

  const mutation = useMutation({
    mutationFn: (d: ExtendValues) => subscriptionsApi.extend(sub.id, d.extra_months, d.extra_days, d.reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      toast.success('Subscription extended successfully')
      onClose()
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to extend'),
  })

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">
      <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
        Adds free time to the current subscription end date — no extra charge.
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Free Months <span className="text-muted-foreground text-xs">(0–24)</span></Label>
          <Input type="number" min={0} max={24} {...register('extra_months')} />
          {errors.extra_months && <p className="text-xs text-destructive">{errors.extra_months.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Free Days <span className="text-muted-foreground text-xs">(0–365)</span></Label>
          <Input type="number" min={0} max={365} {...register('extra_days')} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Reason <span className="text-muted-foreground text-xs">(optional)</span></Label>
        <Input placeholder="e.g. Referral reward, service issue" {...register('reason')} />
      </div>

      {/* Preview */}
      <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-sky-50 p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Extension Preview</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Current End Date</p>
            <p className="font-semibold text-gray-700">{formatDate(sub.end_date)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">New End Date</p>
            <p className="font-semibold text-blue-700">
              {newEndDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-muted-foreground">Adding</p>
            <p className="font-semibold text-green-700">
              {extraMonths > 0 && `${extraMonths} month${extraMonths > 1 ? 's' : ''}`}
              {extraMonths > 0 && extraDays > 0 && ' + '}
              {extraDays > 0 && `${extraDays} day${extraDays > 1 ? 's' : ''}`}
              {extraMonths === 0 && extraDays === 0 && '—'}
              <span className="ml-1 text-xs font-normal text-green-600">free</span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
        <Button type="submit" loading={mutation.isPending}>
          <CalendarPlus className="h-4 w-4 mr-1.5" /> Apply Extension
        </Button>
      </div>
    </form>
  )
}

// ─── Row Detail Expand ────────────────────────────────────────────────────────

function ExpandedRow({ sub }: { sub: Subscription }) {
  const s = sub as Subscription & {
    original_amount?: number
    discount_amount?: number
    final_amount?: number
    currency?: string
    next_renewal_date?: string
    pause_count?: number
    paused_until?: string
    pause_reason?: string
    cancellation_reason?: string
    cancellation_feedback?: string
  }

  return (
    <tr>
      <td colSpan={9} className="px-6 py-4 bg-orange-50/50 border-b">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-light mb-1">Pricing</p>
            <p className="font-medium">{formatCurrency(s.final_amount ?? 0, s.currency)}</p>
            {s.discount_amount ? (
              <p className="text-xs text-green-600">Discount: {formatCurrency(s.discount_amount, s.currency)}</p>
            ) : null}
            {s.original_amount && s.discount_amount ? (
              <p className="text-xs text-muted-foreground line-through">{formatCurrency(s.original_amount, s.currency)}</p>
            ) : null}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-light mb-1">Renewal</p>
            <p className="font-medium">{s.auto_renew ? 'Auto-renew ON' : 'Auto-renew OFF'}</p>
            {s.next_renewal_date && <p className="text-xs text-muted-foreground">{formatDate(s.next_renewal_date)}</p>}
          </div>
          {((s.free_months_added ?? 0) > 0 || (s.free_days_added ?? 0) > 0) && (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-light mb-1">Free Time</p>
              <p className="font-medium text-emerald-700">
                {(s.free_months_added ?? 0) > 0 && `${s.free_months_added}mo`}
                {(s.free_months_added ?? 0) > 0 && (s.free_days_added ?? 0) > 0 && ' + '}
                {(s.free_days_added ?? 0) > 0 && `${s.free_days_added}d`}
                {' added'}
              </p>
            </div>
          )}
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-light mb-1">Pauses</p>
            <p className="font-medium">{s.pause_count ?? 0} / 2 used</p>
            {s.paused_until && <p className="text-xs text-muted-foreground">Until {formatDate(s.paused_until)}</p>}
            {s.pause_reason && <p className="text-xs text-muted-foreground">{s.pause_reason}</p>}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-light mb-1">Cancellation</p>
            {s.cancellation_reason
              ? <><p className="font-medium capitalize">{s.cancellation_reason.replace(/_/g, ' ')}</p>
                  {s.cancellation_feedback && <p className="text-xs text-muted-foreground">{s.cancellation_feedback}</p>}</>
              : <p className="text-muted-foreground">—</p>
            }
          </div>
        </div>
      </td>
    </tr>
  )
}

// ─── Subscription Detail Drawer ───────────────────────────────────────────────

type SubExtra = Subscription & {
  original_amount?: number
  discount_amount?: number
  final_amount?: number
  currency?: string
  next_renewal_date?: string
  pause_count?: number
  paused_until?: string
  pause_reason?: string
  cancellation_reason?: string
  cancellation_feedback?: string
  free_months_added?: number
  free_days_added?: number
  member?: { user?: { first_name?: string; last_name?: string; email?: string; phone?: string } }
}

interface DetailDrawerProps {
  sub: SubExtra
  plans: Plan[]
  canManage: boolean
  onClose: () => void
  onPause: () => void
  onResume: () => void
  onCancel: () => void
  onUpgrade: () => void
  onExtend: () => void
  onTransfer: () => void
  onToggleAutoRenew: () => void
  autoRenewPending: boolean
}

function SubscriptionDetailDrawer({
  sub, canManage, onClose,
  onPause, onResume, onCancel, onUpgrade, onExtend, onTransfer, onToggleAutoRenew, autoRenewPending,
}: DetailDrawerProps) {
  const isActive    = sub.status === 'active'
  const isPaused    = sub.status === 'paused'
  const isCancelled = sub.status === 'cancelled'
  const days        = daysRemaining(sub.end_date)
  const memberName  = sub.member?.user
    ? `${sub.member.user.first_name} ${sub.member.user.last_name}`
    : `Member #${sub.member_id}`
  const initials    = sub.member?.user
    ? `${sub.member.user.first_name?.[0] ?? ''}${sub.member.user.last_name?.[0] ?? ''}`
    : '?'

  const hasFreeTime = (sub.free_months_added ?? 0) > 0 || (sub.free_days_added ?? 0) > 0
  const freeTimeLabel = [
    (sub.free_months_added ?? 0) > 0 ? `${sub.free_months_added}mo` : '',
    (sub.free_days_added   ?? 0) > 0 ? `${sub.free_days_added}d`   : '',
  ].filter(Boolean).join(' + ')

  const daysColor = days <= 0 ? 'text-red-300' : days <= 7 ? 'text-red-200' : days <= 30 ? 'text-amber-200' : 'text-emerald-200'

  const InfoRow = ({ icon, label, value, valueClass }: { icon: React.ReactNode; label: string; value: React.ReactNode; valueClass?: string }) => (
    <div className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0 px-4">
      <div className="flex items-center gap-2.5 text-muted-foreground min-w-0">
        <span className="shrink-0 text-muted-foreground/60">{icon}</span>
        <span className="text-sm">{label}</span>
      </div>
      <span className={`text-sm font-semibold ml-4 shrink-0 ${valueClass ?? 'text-foreground'}`}>{value}</span>
    </div>
  )

  return (
    <div className="flex flex-col h-full -m-6">

      {/* ── Header — ocean theme matching app pages ── */}
      <div className="relative overflow-hidden text-white shrink-0" style={{
        background: 'linear-gradient(135deg, #042B59 0%, #0553B1 52%, #027DFD 100%)',
      }}>
        {/* Dot texture */}
        <div className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
        {/* Glow */}
        <div className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at 90% 50%, rgba(96,165,250,0.35) 0%, transparent 60%)' }} />
        {/* Dark vignette top-left */}
        <div className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at 0% 0%, rgba(0,0,0,0.25) 0%, transparent 50%)' }} />

        {/* Top row — mirrors PageHeader layout exactly */}
        <div className="relative px-8 py-5 flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0 border border-white/20 shadow-inner">
              <span className="text-base font-bold text-white">{initials}</span>
            </div>
            <div>
              <p className="text-[10px] font-light tracking-[0.2em] text-white/60 uppercase mb-0.5">
                Subscription #{sub.id}
              </p>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-white tracking-tight drop-shadow-sm">
                  {sub.plan?.name ?? `Plan #${sub.plan_id}`}
                </h1>
                <StatusBadge status={sub.status} />
              </div>
              <div className="text-sm text-white/70 mt-1 font-light flex items-center gap-3">
                <span>{memberName}</span>
                {hasFreeTime && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-white/15 text-white/90 rounded-full px-2.5 py-0.5 border border-white/20">
                    <CalendarPlus className="h-3 w-3" /> +{freeTimeLabel} free
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons — glassmorphic, right side of header */}
          {canManage && (isActive || isPaused) && (
            <div className="shrink-0 flex items-center gap-2 page-header-actions mr-10">
              {isActive && (
                <>
                  <Button variant="outline" size="sm" onClick={onExtend}>
                    <CalendarPlus className="h-3.5 w-3.5 mr-1.5" /> Add Free Time
                  </Button>
                  <Button variant="outline" size="sm" onClick={onUpgrade}>
                    <ArrowUpCircle className="h-3.5 w-3.5 mr-1.5" /> Upgrade
                  </Button>
                  <Button variant="outline" size="sm" onClick={onTransfer}>
                    <Repeat className="h-3.5 w-3.5 mr-1.5" /> Transfer
                  </Button>
                  <Button variant="outline" size="sm" onClick={onPause}>
                    <Pause className="h-3.5 w-3.5 mr-1.5" /> Pause
                  </Button>
                  <Button variant="outline" size="sm" onClick={onCancel}
                    style={{ borderColor: 'rgba(255,100,100,0.5)' }}
                    className="hover:!bg-red-500/20">
                    <X className="h-3.5 w-3.5 mr-1.5" /> Cancel
                  </Button>
                </>
              )}
              {isPaused && (
                <Button variant="outline" size="sm" onClick={onResume}>
                  <Play className="h-3.5 w-3.5 mr-1.5" /> Resume
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Stats strip — mirrors PageHeader stats strip */}
        <div className="relative grid pb-5 px-8"
          style={{
            borderTop: '1px solid rgba(255,255,255,0.18)',
            paddingTop: '14px',
            gridTemplateColumns: 'repeat(4, 1fr)',
          }}>
          {[
            { label: 'Start Date', value: formatDate(sub.start_date),    sub: 'subscription start' },
            { label: 'End Date',   value: formatDate(sub.end_date),      sub: 'subscription end' },
            { label: 'Days Left',  value: isCancelled ? '—' : days <= 0 ? 'Expired' : `${days}d`,
              sub: isCancelled ? 'terminated' : days <= 0 ? 'expired' : 'remaining', cls: daysColor },
            { label: 'Amount',     value: formatCurrency(sub.final_amount ?? sub.plan?.price_amount ?? 0, sub.currency ?? 'INR'), sub: 'plan price' },
          ].map(({ label, value, sub: subLabel, cls }, i) => (
            <div key={label} className="flex items-center gap-3 px-4"
              style={{ borderRight: i < 3 ? '1px solid rgba(255,255,255,0.18)' : 'none' }}>
              <div>
                <span className={`text-xl font-bold text-white leading-tight tracking-tight block ${cls ?? ''}`}>{value}</span>
                <span className="text-xs font-light text-white/75 tracking-wide block">{label}</span>
                {subLabel && <span className="text-[10px] text-white/50 block">{subLabel}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto bg-gray-50/50 px-6 py-5 space-y-5">

        {/* Three-column grid */}
        <div className="grid grid-cols-3 gap-4">

          {/* Col 1 — Plan & Billing */}
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1 mb-2">Plan & Billing</p>
            <div className="bg-white rounded-xl border border-border/50 shadow-sm overflow-hidden">
              <InfoRow icon={<CreditCard className="h-3.5 w-3.5" />} label="Plan" value={sub.plan?.name ?? `#${sub.plan_id}`} />
              <InfoRow
                icon={<TrendingUp className="h-3.5 w-3.5" />}
                label="Amount"
                value={
                  <span className="flex items-center gap-1.5">
                    {formatCurrency(sub.final_amount ?? sub.plan?.price_amount ?? 0, sub.currency ?? 'INR')}
                    {(sub.discount_amount ?? 0) > 0 && (
                      <span className="text-xs text-emerald-600 font-medium">−{formatCurrency(sub.discount_amount ?? 0)}</span>
                    )}
                  </span>
                }
              />
              <InfoRow
                icon={<Repeat className="h-3.5 w-3.5" />}
                label="Auto-Renew"
                value={
                  isActive && canManage ? (
                    <button onClick={onToggleAutoRenew} disabled={autoRenewPending}
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full border transition-colors ${
                        sub.auto_renew
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                      }`}>
                      {sub.auto_renew ? 'ON' : 'OFF'}
                    </button>
                  ) : (
                    <Badge variant={sub.auto_renew ? 'success' : 'outline'}>{sub.auto_renew ? 'Enabled' : 'Disabled'}</Badge>
                  )
                }
              />
              {sub.next_renewal_date && (
                <InfoRow icon={<Calendar className="h-3.5 w-3.5" />} label="Next Renewal" value={formatDate(sub.next_renewal_date)} />
              )}
              {hasFreeTime && (
                <InfoRow icon={<CalendarPlus className="h-3.5 w-3.5" />} label="Free Time" value={freeTimeLabel} valueClass="text-emerald-700" />
              )}
            </div>
          </div>

          {/* Col 2 — Member */}
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1 mb-2">Member</p>
            <div className="bg-white rounded-xl border border-border/50 shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40">
                <div className="h-9 w-9 rounded-full bg-sky-100 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-sky-600">{initials}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{memberName}</p>
                  <p className="text-xs text-muted-foreground">ID #{sub.member_id}</p>
                </div>
              </div>
              {sub.member?.user?.email && (
                <InfoRow icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={
                  <span className="truncate max-w-[140px] block">{sub.member.user.email}</span>
                } />
              )}
              {sub.member?.user?.phone && (
                <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={sub.member.user.phone} />
              )}
            </div>

            {/* Cancellation (in member column) */}
            {sub.cancellation_reason && (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1 mb-2 mt-4">Cancellation</p>
                <div className="bg-white rounded-xl border border-red-100 shadow-sm overflow-hidden">
                  <InfoRow icon={<X className="h-3.5 w-3.5 text-red-400" />} label="Reason"
                    value={sub.cancellation_reason.replace(/_/g, ' ')} valueClass="text-red-600 capitalize" />
                  {sub.cancellation_feedback && (
                    <div className="px-4 py-2.5 text-xs text-muted-foreground bg-red-50/50 border-t border-red-100">
                      {sub.cancellation_feedback}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Col 3 — Status + Pauses */}
          <div className="space-y-4">
            {/* Status card */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1 mb-2">Status</p>
              <div className={`rounded-xl p-4 border ${
                isActive    ? 'bg-emerald-50/80 border-emerald-200' :
                isPaused    ? 'bg-amber-50/80   border-amber-200'  :
                isCancelled ? 'bg-red-50/80     border-red-200'    :
                              'bg-gray-50        border-gray-200'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <StatusBadge status={sub.status} />
                  {!isCancelled && (
                    <span className={`text-xl font-black ${
                      days <= 0  ? 'text-red-500' : days <= 7  ? 'text-red-500' :
                      days <= 30 ? 'text-amber-500' : 'text-emerald-600'
                    }`}>
                      {days <= 0 ? 'Exp' : `${days}d`}
                    </span>
                  )}
                </div>
                {!isCancelled && days > 0 && (
                  <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
                    <div className={`h-full rounded-full ${
                      days <= 7 ? 'bg-red-400' : days <= 30 ? 'bg-amber-400' : 'bg-emerald-500'
                    }`} style={{ width: `${Math.min(100, (days / 365) * 100)}%` }} />
                  </div>
                )}
              </div>
            </div>

            {/* Pause history */}
            {sub.pause_count !== undefined && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1 mb-2">Pause History</p>
                <div className="bg-white rounded-xl border border-border/50 shadow-sm overflow-hidden">
                  <InfoRow icon={<Pause className="h-3.5 w-3.5" />} label="Used"
                    value={
                      <span className="flex items-center gap-1.5">
                        <span>{sub.pause_count ?? 0} / 2</span>
                        <span className="flex gap-0.5">
                          {[0,1].map(i => (
                            <span key={i} className={`h-2 w-3.5 rounded-full inline-block ${i < (sub.pause_count ?? 0) ? 'bg-sky-500' : 'bg-gray-200'}`} />
                          ))}
                        </span>
                      </span>
                    }
                  />
                  {sub.paused_until && <InfoRow icon={<Calendar className="h-3.5 w-3.5" />} label="Until" value={formatDate(sub.paused_until)} />}
                  {sub.pause_reason && <InfoRow icon={<Ban className="h-3.5 w-3.5" />} label="Reason" value={sub.pause_reason} />}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── Footer ── */}
      <div className="shrink-0 px-6 py-3.5 border-t bg-white/80 backdrop-blur-sm flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Subscription ID #{sub.id}</p>
        <Button variant="outline" size="sm" onClick={onClose} className="px-5">Close</Button>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type DrawerType = 'pause' | 'cancel' | 'upgrade' | 'extend' | 'view' | null

export default function SubscriptionsListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const canManage = user?.role === 'admin' || user?.role === 'manager'

  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [drawerType, setDrawerType] = useState<DrawerType>(null)
  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [resumeTarget, setResumeTarget] = useState<Subscription | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 400)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [search])

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data, isLoading, isError } = useQuery({
    queryKey: QUERY_KEYS.subscriptions({ page, per_page: PER_PAGE, status: statusFilter, search: debouncedSearch }),
    queryFn: () => subscriptionsApi.list({ page, per_page: PER_PAGE, status: statusFilter || undefined, search: debouncedSearch || undefined } as Record<string, unknown>),
  })

  const { data: plansData } = useQuery({
    queryKey: QUERY_KEYS.plans,
    queryFn: () => plansApi.list(true),
    staleTime: 5 * 60 * 1000,
  })

  // Stat queries — per_page:1 so only meta.total matters
  const statTotal     = useQuery({ queryKey: ['subscriptions', 'stats', 'all'],       queryFn: () => subscriptionsApi.list({ page: 1, per_page: 1 }),                    staleTime: 30000 })
  const statActive    = useQuery({ queryKey: ['subscriptions', 'stats', 'active'],    queryFn: () => subscriptionsApi.list({ page: 1, per_page: 1, status: 'active' }),    staleTime: 30000 })
  const statPaused    = useQuery({ queryKey: ['subscriptions', 'stats', 'paused'],    queryFn: () => subscriptionsApi.list({ page: 1, per_page: 1, status: 'paused' }),    staleTime: 30000 })
  const statExpired   = useQuery({ queryKey: ['subscriptions', 'stats', 'expired'],   queryFn: () => subscriptionsApi.list({ page: 1, per_page: 1, status: 'expired' }),   staleTime: 30000 })
  const statCancelled = useQuery({ queryKey: ['subscriptions', 'stats', 'cancelled'], queryFn: () => subscriptionsApi.list({ page: 1, per_page: 1, status: 'cancelled' }), staleTime: 30000 })

  const tmeta = (d: unknown) => (d as { meta?: { total?: number } })?.meta?.total ?? 0

  const subscriptions: Subscription[] = (data as { subscriptions?: Subscription[] })?.subscriptions ?? []
  const meta = (data as { meta?: { total?: number; per_page?: number } })?.meta
  const total = meta?.total ?? 0
  const perPage = meta?.per_page ?? PER_PAGE
  const plans: Plan[] = plansData?.plans ?? []

  // ── Mutations ─────────────────────────────────────────────────────────────

  const resumeMutation = useMutation({
    mutationFn: (id: number) => subscriptionsApi.resume(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      toast.success('Subscription resumed')
      setResumeTarget(null)
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to resume'),
  })

  const autoRenewMutation = useMutation({
    mutationFn: ({ id, val }: { id: number; val: boolean }) => subscriptionsApi.setAutoRenew(id, val),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      toast.success('Auto-renew updated')
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update'),
  })

  // ── Helpers ───────────────────────────────────────────────────────────────

  function openDrawer(type: DrawerType, sub?: Subscription) {
    setSelectedSub(sub ?? null)
    setDrawerType(type)
  }

  function closeDrawer() {
    setDrawerType(null)
    setSelectedSub(null)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Memberships"
        icon={<CreditCard className="h-6 w-6 text-white" />}
        stats={[
          { label: 'Active',    value: tmeta(statActive.data),    sub: 'currently running', icon: <TrendingUp className="h-4 w-4 text-white" /> },
          { label: 'Paused',   value: tmeta(statPaused.data),    sub: 'on hold',            icon: <Pause className="h-4 w-4 text-white" /> },
          { label: 'Expired',  value: tmeta(statExpired.data),   sub: 'needs renewal',      icon: <Calendar className="h-4 w-4 text-white" /> },
          { label: 'Cancelled', value: tmeta(statCancelled.data), sub: 'terminated',         icon: <Ban className="h-4 w-4 text-white" /> },
          { label: 'Total',    value: tmeta(statTotal.data),     sub: 'all memberships',    icon: <LayoutList className="h-4 w-4 text-white" /> },
        ]}
        actions={
          canManage ? (
            <Button onClick={() => navigate('/memberships/new')}>
              <Plus className="h-4 w-4" />
              New Membership
            </Button>
          ) : undefined
        }
      />

      {/* Table */}
      <Card className="border-0 shadow-md overflow-hidden">
        <CardContent className="p-0">
          {/* ── Toolbar ── */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60">
            <SearchInput
              placeholder="Search member name or mobile…"
              value={search}
              onChange={setSearch}
              className="w-full sm:w-72"
            />
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }} className="w-40 h-8 text-sm border-0 shadow-[0_2px_12px_rgba(0,0,0,0.12)]">
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </div>

          {isError && <div className="p-6 text-sm text-destructive">Failed to load subscriptions. Please try again.</div>}
          {isLoading ? (
            <div className="p-6 space-y-3">{[1,2,3,4,5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : !isError && subscriptions.length === 0 ? (
            <EmptyState title="No memberships found" description="Try adjusting your filters." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-sidebar">
                  <tr>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Member</th>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Plan</th>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Start</th>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">End</th>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Days Left</th>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Auto-Renew</th>
                    {canManage && (
                      <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Actions</th>
                    )}
                    <th className="px-4 py-3 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {subscriptions.map((sub) => {
                    const days = daysRemaining(sub.end_date)
                    const isExpanded = expandedId === sub.id
                    const isActive = sub.status === 'active'
                    const isPaused = sub.status === 'paused'
                    const isCancelled = sub.status === 'cancelled'

                    return (
                      <>
                        <tr
                          key={sub.id}
                          className="hover:bg-orange-50/40 transition-colors cursor-pointer"
                          onClick={() => openDrawer('view', sub)}
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium">
                              {(sub as Subscription & { member?: { user?: { first_name?: string; last_name?: string } } }).member?.user
                                ? `${(sub as Subscription & { member?: { user?: { first_name?: string; last_name?: string } } }).member?.user?.first_name} ${(sub as Subscription & { member?: { user?: { first_name?: string; last_name?: string } } }).member?.user?.last_name}`
                                : `Member #${sub.member_id}`}
                            </div>
                            <div className="text-xs text-muted-foreground">ID: {sub.member_id}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium">{sub.plan?.name ?? `Plan #${sub.plan_id}`}</div>
                            {sub.plan?.price_amount && (
                              <div className="text-xs text-muted-foreground">{formatCurrency(sub.plan.price_amount)}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={sub.status} />
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDate(sub.start_date)}</td>
                          <td className="px-4 py-3">
                            <div className="text-muted-foreground">{formatDate(sub.end_date)}</div>
                            {((sub.free_months_added ?? 0) > 0 || (sub.free_days_added ?? 0) > 0) && (
                              <div className="inline-flex items-center gap-1 mt-0.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                                <CalendarPlus className="h-3 w-3" />
                                +{(sub.free_months_added ?? 0) > 0 && `${sub.free_months_added}mo`}
                                {(sub.free_months_added ?? 0) > 0 && (sub.free_days_added ?? 0) > 0 && ' '}
                                {(sub.free_days_added ?? 0) > 0 && `${sub.free_days_added}d`}
                                {' free'}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {isCancelled ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <span className={cn(
                                'font-medium',
                                days <= 7 ? 'text-red-600' : days <= 30 ? 'text-amber-600' : 'text-green-600'
                              )}>
                                {days}d
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            {canManage && isActive ? (
                              <button
                                onClick={() => autoRenewMutation.mutate({ id: sub.id, val: !sub.auto_renew })}
                                disabled={autoRenewMutation.isPending}
                                className="cursor-pointer"
                                title="Click to toggle"
                              >
                                <Badge variant={sub.auto_renew ? 'success' : 'outline'}>
                                  {sub.auto_renew ? 'ON' : 'OFF'}
                                </Badge>
                              </button>
                            ) : (
                              <Badge variant={sub.auto_renew ? 'success' : 'outline'}>
                                {sub.auto_renew ? 'ON' : 'OFF'}
                              </Badge>
                            )}
                          </td>
                          {canManage && (
                            <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center gap-1">
                                {isActive && (
                                  <>
                                    <Button
                                      variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-blue-600"
                                      title="Add free months"
                                      onClick={() => openDrawer('extend', sub)}
                                    >
                                      <CalendarPlus className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-orange-600"
                                      title="Upgrade plan"
                                      onClick={() => openDrawer('upgrade', sub)}
                                    >
                                      <ArrowUpCircle className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-cyan-600"
                                      title="Pause membership"
                                      onClick={() => openDrawer('pause', sub)}
                                    >
                                      <Pause className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                      title="Cancel membership"
                                      onClick={() => openDrawer('cancel', sub)}
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </Button>
                                  </>
                                )}
                                {isPaused && (
                                  <Button
                                    variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-green-600"
                                    title="Resume membership"
                                    onClick={() => setResumeTarget(sub)}
                                  >
                                    <Play className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          )}
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <Button
                              variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"
                              title={isExpanded ? 'Collapse details' : 'Expand details'}
                              onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          </td>
                        </tr>
                        {isExpanded && <ExpandedRow key={`exp-${sub.id}`} sub={sub} />}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {!isLoading && total > 0 && (
        <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
          <span>Showing {Math.min((page - 1) * perPage + 1, total)}–{Math.min(page * perPage, total)} of {total}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>Previous</Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page * perPage >= total}>Next</Button>
          </div>
        </div>
      )}

      {/* ── View Drawer ── */}
      <FormDrawer isOpen={drawerType === 'view'} onClose={closeDrawer} title="" fullWidth glassmorphicClose>
        {selectedSub && (
          <SubscriptionDetailDrawer
            sub={selectedSub as SubExtra}
            plans={plans}
            canManage={canManage}
            onClose={closeDrawer}
            onPause={() => { closeDrawer(); openDrawer('pause', selectedSub) }}
            onResume={() => { setResumeTarget(selectedSub); closeDrawer() }}
            onCancel={() => { closeDrawer(); openDrawer('cancel', selectedSub) }}
            onUpgrade={() => { closeDrawer(); openDrawer('upgrade', selectedSub) }}
            onExtend={() => { closeDrawer(); openDrawer('extend', selectedSub) }}
            onTransfer={() => { closeDrawer(); navigate('/memberships/transfer') }}
            onToggleAutoRenew={() => autoRenewMutation.mutate({ id: selectedSub.id, val: !selectedSub.auto_renew })}
            autoRenewPending={autoRenewMutation.isPending}
          />
        )}
      </FormDrawer>

      {/* ── Drawers ── */}
      <FormDrawer isOpen={drawerType === 'pause'} onClose={closeDrawer} title="Pause Membership" description={`Pause membership for ${selectedSub?.plan?.name ?? ''}`}>
        {selectedSub && <PauseForm sub={selectedSub} onClose={closeDrawer} />}
      </FormDrawer>

      <FormDrawer isOpen={drawerType === 'cancel'} onClose={closeDrawer} title="Cancel Membership" description="This will deactivate the member's membership.">
        {selectedSub && <CancelForm sub={selectedSub} onClose={closeDrawer} />}
      </FormDrawer>

      <FormDrawer isOpen={drawerType === 'upgrade'} onClose={closeDrawer} title="Upgrade Plan" description="Switch to a different plan with prorated credit.">
        {selectedSub && <UpgradeForm sub={selectedSub} plans={plans} onClose={closeDrawer} />}
      </FormDrawer>

      <FormDrawer isOpen={drawerType === 'extend'} onClose={closeDrawer} title="Add Free Time" description="Extend the membership end date at no charge.">
        {selectedSub && <ExtendForm sub={selectedSub} onClose={closeDrawer} />}
      </FormDrawer>

      {/* Resume confirm */}
      <ConfirmModal
        isOpen={!!resumeTarget}
        onClose={() => setResumeTarget(null)}
        onConfirm={() => resumeTarget && resumeMutation.mutate(resumeTarget.id)}
        title="Resume Membership"
        description={`Resume the paused membership for Member #${resumeTarget?.member_id}? It will become active immediately.`}
        confirmLabel="Resume"
        variant="default"
        isLoading={resumeMutation.isPending}
      />
    </div>
  )
}
