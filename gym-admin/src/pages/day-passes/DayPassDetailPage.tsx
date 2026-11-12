import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  ArrowLeft, Pencil, Trash2, UserPlus, LogIn,
  User, Mail, Phone, Calendar, Clock, CheckCircle2,
  Building2, CreditCard, Star, Check, Lock,
  FileText, Ticket, AlertTriangle, TimerOff,
} from 'lucide-react'

import { StatusBadge } from '@/components/shared/StatusBadge'
import { FormDrawer } from '@/components/shared/FormDrawer'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'

import { dayPassesApi } from '@/api/day-passes.api'
import { plansApi } from '@/api/plans.api'
import { membersApi } from '@/api/members.api'
import { subscriptionsApi } from '@/api/subscriptions.api'
import { QUERY_KEYS } from '@/lib/constants'
import { useAuthStore } from '@/store/auth.store'
import { formatDate, formatDateTime, formatCurrency } from '@/lib/utils'
import type { Plan } from '@/types/plan.types'

// ─── Types ─────────────────────────────────────────────────────────────────

interface DayPass {
  id: number
  facility_id: number
  guest_name: string
  guest_email: string
  guest_phone: string
  pass_date: string
  valid_from: string
  valid_until: string
  price: number
  status: 'active' | 'used' | 'expired' | 'cancelled'
  notes: string
  created_by_id?: number
  checked_in_at?: string
  created_at: string
  updated_at: string
}

// ─── Schemas ───────────────────────────────────────────────────────────────

const editSchema = z.object({
  guest_name:  z.string().min(1, 'Guest name is required'),
  guest_email: z.string().email('Enter a valid email').or(z.literal('')).optional(),
  guest_phone: z.string().optional(),
  price:       z.coerce.number().min(0, 'Price must be 0 or more'),
  notes:       z.string().optional(),
  status:      z.enum(['active', 'used', 'expired', 'cancelled']).optional(),
})
type EditFormValues = z.infer<typeof editSchema>

const convertSchema = z.object({
  first_name:    z.string().min(1, 'First name is required'),
  last_name:     z.string().min(1, 'Last name is required'),
  email:         z.string().email('Valid email required'),
  phone:         z.string().min(7, 'Phone is required'),
  password:      z.string().min(8, 'Min. 8 characters'),
  date_of_birth: z.string().min(1, 'Date of birth is required'),
  gender:        z.enum(['male', 'female', 'other'], { required_error: 'Gender is required' }),
})
type ConvertFormValues = z.infer<typeof convertSchema>

// ─── Helpers ───────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return (name ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0] ?? '')
    .join('')
    .toUpperCase()
}

/**
 * Returns expiry state for the valid_until timestamp.
 */
function getExpiryState(validUntil: string | undefined): {
  label: string
  color: 'green' | 'amber' | 'red'
  icon: 'ok' | 'warn' | 'expired'
} {
  if (!validUntil) return { label: '—', color: 'green', icon: 'ok' }
  const now = new Date()
  const exp = new Date(validUntil)
  const diffMs = exp.getTime() - now.getTime()
  const diffH  = diffMs / (1000 * 60 * 60)

  if (diffMs < 0)    return { label: 'Expired', color: 'red',   icon: 'expired' }
  if (diffH < 3)     return { label: 'Expiring soon', color: 'amber', icon: 'warn' }
  return              { label: 'Valid',   color: 'green', icon: 'ok' }
}

/**
 * Parse structured prefix fields from notes.
 * Notes are encoded as: "Activity: Gym | DOB: 1990-01-01 | City: Mumbai | Free text here"
 * Returns the activity label and the free-text tail (everything after all "Key: Value" segments).
 */
function parseNotes(notes: string): { activity: string | null; freeText: string | null } {
  if (!notes) return { activity: null, freeText: null }

  const segments = notes.split(' | ')
  const structured: string[] = []
  const free: string[] = []

  let seenFree = false
  for (const seg of segments) {
    if (!seenFree && /^[A-Za-z ]+:/.test(seg)) {
      structured.push(seg)
    } else {
      seenFree = true
      free.push(seg)
    }
  }

  const activitySeg = structured.find((s) => s.startsWith('Activity:'))
  const activity = activitySeg ? activitySeg.replace(/^Activity:\s*/, '').trim() : null
  const freeText = free.length > 0 ? free.join(' | ').trim() : null

  return { activity, freeText }
}

// ─── Ocean Section Card ────────────────────────────────────────────────────

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-0">
        <div className="flex items-center gap-3 px-6 py-3 rounded-t-xl border-b bg-muted/30">
          <div className="h-7 w-7 rounded-lg bg-background border border-border flex items-center justify-center shrink-0 text-muted-foreground">
            {icon}
          </div>
          <h3 className="text-sm font-semibold text-foreground tracking-wide">{title}</h3>
        </div>
        <div className="p-6">{children}</div>
      </CardContent>
    </Card>
  )
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-muted-foreground shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <div className="text-sm font-medium mt-0.5 break-all">{value}</div>
      </div>
    </div>
  )
}

// ─── Edit Form ─────────────────────────────────────────────────────────────

function EditForm({
  pass,
  onSubmit,
  isLoading,
  onClose,
}: {
  pass: DayPass
  onSubmit: (values: EditFormValues) => void
  isLoading: boolean
  onClose: () => void
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      guest_name:  pass.guest_name,
      guest_email: pass.guest_email ?? '',
      guest_phone: pass.guest_phone ?? '',
      price:       pass.price,
      notes:       pass.notes ?? '',
      status:      pass.status,
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="edit_guest_name">
          Guest Name <span className="text-destructive">*</span>
        </Label>
        <Input id="edit_guest_name" {...register('guest_name')} />
        {errors.guest_name && (
          <p className="text-xs text-destructive">{errors.guest_name.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="edit_guest_email">Email</Label>
          <Input id="edit_guest_email" type="email" {...register('guest_email')} />
          {errors.guest_email && (
            <p className="text-xs text-destructive">{errors.guest_email.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit_guest_phone">Phone</Label>
          <Input id="edit_guest_phone" type="tel" {...register('guest_phone')} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="edit_price">Price (₹)</Label>
        <Input id="edit_price" type="number" min="0" step="0.01" {...register('price')} />
        {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label>Status</Label>
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <Select value={field.value ?? ''} onValueChange={field.onChange} className="w-full">
              <option value="">Select status…</option>
              <option value="active">Active</option>
              <option value="used">Used</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          )}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="edit_notes">Notes</Label>
        <Textarea id="edit_notes" {...register('notes')} rows={3} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" loading={isLoading}>
          Save Changes
        </Button>
      </div>
    </form>
  )
}

// ─── Convert to Member Modal ───────────────────────────────────────────────

function ConvertToMemberModal({
  pass,
  onClose,
}: {
  pass: DayPass
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [convStep, setConvStep] = useState<'idle' | 'member' | 'subscription' | 'done'>('idle')

  const nameParts = (pass.guest_name ?? '').trim().split(/\s+/)
  const defaultFirst = nameParts[0] ?? ''
  const defaultLast  = nameParts.slice(1).join(' ')

  const { data: plansData } = useQuery({
    queryKey: QUERY_KEYS.plans,
    queryFn: () => plansApi.list(true),
  })
  const plans: Plan[] = (plansData as { plans?: Plan[] })?.plans ?? []

  const form = useForm<ConvertFormValues>({
    resolver: zodResolver(convertSchema),
    defaultValues: {
      first_name: defaultFirst,
      last_name:  defaultLast,
      email:      pass.guest_email ?? '',
      phone:      pass.guest_phone ?? '',
      password:   '',
    },
  })

  const convertMutation = useMutation({
    mutationFn: async (data: ConvertFormValues) => {
      setConvStep('member')
      const member = await membersApi.create({
        first_name:    data.first_name,
        last_name:     data.last_name,
        email:         data.email,
        phone:         data.phone,
        password:      data.password,
        date_of_birth: data.date_of_birth,
        gender:        data.gender,
        facility_id:   pass.facility_id,
      })

      if (selectedPlanId && (member as { id?: number })?.id) {
        setConvStep('subscription')
        try {
          await subscriptionsApi.create({
            member_id:  (member as { id: number }).id,
            plan_id:    selectedPlanId,
            auto_renew: true,
          })
        } catch {
          toast.warning('Member created but subscription failed')
        }
      }

      setConvStep('done')
      return member
    },
    onSuccess: () => {
      toast.success('Guest successfully converted to member!')
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.members })
      onClose()
    },
    onError: (err: Error) => {
      setConvStep('idle')
      toast.error(err.message || 'Failed to convert to member')
    },
  })

  const stepLabel =
    convStep === 'member'       ? 'Creating member account…'    :
    convStep === 'subscription' ? 'Assigning subscription plan…' :
    convStep === 'done'         ? 'Done!'                        : ''

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="rounded-t-xl px-6 py-5 border-b bg-muted/30">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-background border border-border flex items-center justify-center shrink-0 text-muted-foreground">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-foreground text-lg font-semibold">
                  Convert to Full Member
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-sm mt-0.5">
                  Creating a member account for{' '}
                  <span className="font-medium text-foreground">{pass.guest_name}</span>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <form
          onSubmit={form.handleSubmit((d) => convertMutation.mutate(d))}
          className="p-6 space-y-6"
        >
          {/* Personal Info */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Personal Information
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  First Name <span className="text-destructive">*</span>
                </Label>
                <Input {...form.register('first_name')} className="h-9" />
                {form.formState.errors.first_name && (
                  <p className="text-xs text-destructive">{form.formState.errors.first_name.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Last Name <span className="text-destructive">*</span>
                </Label>
                <Input {...form.register('last_name')} className="h-9" />
                {form.formState.errors.last_name && (
                  <p className="text-xs text-destructive">{form.formState.errors.last_name.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input type="email" {...form.register('email')} className="h-9" />
                {form.formState.errors.email && (
                  <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Phone <span className="text-destructive">*</span>
                </Label>
                <Input {...form.register('phone')} className="h-9" />
                {form.formState.errors.phone && (
                  <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Date of Birth <span className="text-destructive">*</span>
                </Label>
                <Input type="date" {...form.register('date_of_birth')} className="h-9" />
                {form.formState.errors.date_of_birth && (
                  <p className="text-xs text-destructive">{form.formState.errors.date_of_birth.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Gender <span className="text-destructive">*</span>
                </Label>
                <Controller
                  name="gender"
                  control={form.control}
                  render={({ field }) => (
                    <Select
                      value={field.value ?? ''}
                      onValueChange={field.onChange}
                      className="w-full h-9"
                    >
                      <option value="">Select…</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </Select>
                  )}
                />
                {form.formState.errors.gender && (
                  <p className="text-xs text-destructive">{form.formState.errors.gender.message}</p>
                )}
              </div>
            </div>

            {/* Password */}
            <div className="mt-4 space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Password <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  {...form.register('password')}
                  placeholder="Min. 8 characters"
                  className="h-9 pl-9 pr-10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {form.formState.errors.password && (
                <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
              )}
            </div>
          </div>

          {/* Plan Selection */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Subscription Plan
              </p>
              <span className="text-xs text-muted-foreground font-light ml-auto">Optional</span>
            </div>

            {plans.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No active plans found.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* No plan */}
                <button
                  type="button"
                  onClick={() => setSelectedPlanId(null)}
                  className={`relative text-left rounded-xl border-2 p-3.5 transition-all ${
                    selectedPlanId === null
                      ? 'border-sky-500 bg-sky-50'
                      : 'border-border hover:border-sky-200 bg-white'
                  }`}
                >
                  {selectedPlanId === null && (
                    <div className="absolute top-3 right-3 h-5 w-5 rounded-full flex items-center justify-center bg-sky-500">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                  <p className="font-semibold text-sm text-muted-foreground">No Plan</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Assign later from member profile</p>
                </button>

                {plans.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`relative text-left rounded-xl border-2 p-3.5 transition-all ${
                      selectedPlanId === plan.id
                        ? 'border-sky-500 bg-sky-50'
                        : 'border-border hover:border-sky-200 bg-white'
                    }`}
                  >
                    {selectedPlanId === plan.id && (
                      <div className="absolute top-3 right-3 h-5 w-5 rounded-full flex items-center justify-center bg-sky-500">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Star className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                      <p className="font-semibold text-sm truncate pr-6">{plan.name}</p>
                    </div>
                    <p className="text-base font-bold text-sky-700">
                      {formatCurrency(plan.price_amount)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Every {plan.billing_period_days} days
                      {plan.group_class_access && (
                        <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">
                          Classes
                        </Badge>
                      )}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div>
              {convStep !== 'idle' && convStep !== 'done' && (
                <p className="text-xs text-sky-600 font-medium animate-pulse">{stepLabel}</p>
              )}
              {selectedPlanId && (
                <p className="text-xs text-muted-foreground">
                  Will also create subscription:{' '}
                  <span className="font-medium text-foreground">
                    {plans.find((p) => p.id === selectedPlanId)?.name}
                  </span>
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={convertMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={convertMutation.isPending}
                className="px-6"
              >
                <UserPlus className="h-4 w-4" />
                Convert to Member
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function DayPassDetailPage() {
  const { id } = useParams<{ id: string }>()
  const passId = Number(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'admin'

  const [editOpen, setEditOpen] = useState(false)
  const [convertOpen, setConvertOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // ── Query ────────────────────────────────────────────────────────────────

  const { data: passData, isLoading, isError } = useQuery({
    queryKey: QUERY_KEYS.dayPass(passId),
    queryFn: () => dayPassesApi.getById(passId),
    enabled: !!passId,
  })

  const pass = passData as DayPass | undefined

  // ── Mutations ────────────────────────────────────────────────────────────

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dayPass(passId) })

  const checkInMutation = useMutation({
    mutationFn: () => dayPassesApi.checkIn(passId),
    onSuccess: () => {
      toast.success('Guest checked in successfully')
      invalidate()
    },
    onError: () => toast.error('Failed to check in guest'),
  })

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      dayPassesApi.update(passId, payload),
    onSuccess: () => {
      toast.success('Day pass updated successfully')
      setEditOpen(false)
      invalidate()
    },
    onError: () => toast.error('Failed to update day pass'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => dayPassesApi.delete(passId),
    onSuccess: () => {
      toast.success('Day pass deleted')
      navigate('/day-passes')
    },
    onError: () => toast.error('Failed to delete day pass'),
  })

  const handleEdit = (values: EditFormValues) => {
    updateMutation.mutate({
      ...values,
      guest_email: values.guest_email || undefined,
    })
  }

  // ── Parsed notes ─────────────────────────────────────────────────────────

  const { activity, freeText } = pass?.notes
    ? parseNotes(pass.notes)
    : { activity: null, freeText: null }

  // ── Expiry state ──────────────────────────────────────────────────────────
  const expiryState = getExpiryState(pass?.valid_until)

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        {/* Header skeleton */}
        <div className="border-b border-border/40 bg-background px-8 py-8 shrink-0">
          <div className="flex items-center gap-6">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </div>
        <div className="px-8 py-8 grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl w-full mx-auto">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (isError || !pass) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p className="text-destructive font-medium">Failed to load day pass.</p>
        <Button variant="outline" onClick={() => navigate('/day-passes')}>
          <ArrowLeft className="h-4 w-4" />
          Back to Day Passes
        </Button>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const initials = getInitials(pass.guest_name)

  return (
    <div className="min-h-screen flex flex-col">

      {/* ── Header ── */}
      <div className="border-b border-border/40 bg-background px-8 py-6 shrink-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Avatar + info */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="h-16 w-16 rounded-full flex items-center justify-center shrink-0 text-xl font-bold text-foreground bg-muted border border-border">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Day Pass</p>
              <h1 className="text-2xl font-bold text-foreground truncate">{pass.guest_name}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-muted border border-border text-muted-foreground">
                  Pass #{pass.id}
                </span>
                <StatusBadge status={pass.status} />
              </div>
            </div>
          </div>

          {/* Expiry callout */}
          <div className={`shrink-0 flex items-center gap-3 px-4 py-2.5 rounded-xl border ${
            expiryState.color === 'red'   ? 'bg-red-50 border-red-200'   :
            expiryState.color === 'amber' ? 'bg-amber-50 border-amber-200' :
                                            'bg-emerald-50 border-emerald-200'
          }`}>
            {expiryState.icon === 'expired' && <TimerOff className="h-4 w-4 text-red-500 shrink-0" />}
            {expiryState.icon === 'warn'    && <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />}
            {expiryState.icon === 'ok'      && <Clock className="h-4 w-4 text-emerald-500 shrink-0" />}
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Expires</p>
              <p className="text-sm font-bold text-foreground leading-tight">
                {pass?.valid_until ? formatDateTime(pass.valid_until) : '—'}
              </p>
              <p className={`text-[11px] font-medium mt-0.5 ${
                expiryState.color === 'red' ? 'text-red-600' : expiryState.color === 'amber' ? 'text-amber-600' : 'text-emerald-600'
              }`}>{expiryState.label}</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {pass.status === 'active' && (
              <Button variant="outline" size="sm" onClick={() => checkInMutation.mutate()} disabled={checkInMutation.isPending} className="text-emerald-700 border-emerald-300 hover:bg-emerald-50">
                <LogIn className="h-4 w-4" /> Check In
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConvertOpen(true)}>
              <UserPlus className="h-4 w-4" /> Convert to Member
            </Button>
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)} className="text-destructive border-destructive/30 hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => navigate('/day-passes')}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="px-8 py-8 max-w-6xl w-full mx-auto space-y-6">

        {/* 2-col grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Card 1 — Guest Information */}
          <SectionCard
            icon={<User className="h-4 w-4 text-white" />}
            title="Guest Information"
          >
            <div className="space-y-4">
              <InfoRow
                icon={<User className="h-4 w-4" />}
                label="Guest Name"
                value={pass.guest_name || <span className="text-muted-foreground italic">—</span>}
              />
              <InfoRow
                icon={<Mail className="h-4 w-4" />}
                label="Email"
                value={
                  pass.guest_email ? (
                    <a
                      href={`mailto:${pass.guest_email}`}
                      className="text-sky-600 hover:underline"
                    >
                      {pass.guest_email}
                    </a>
                  ) : (
                    <span className="text-muted-foreground italic">—</span>
                  )
                }
              />
              <InfoRow
                icon={<Phone className="h-4 w-4" />}
                label="Phone"
                value={
                  pass.guest_phone ? (
                    <a href={`tel:${pass.guest_phone}`} className="text-sky-600 hover:underline">
                      {pass.guest_phone}
                    </a>
                  ) : (
                    <span className="text-muted-foreground italic">—</span>
                  )
                }
              />
            </div>
          </SectionCard>

          {/* Card 2 — Pass Details */}
          <SectionCard
            icon={<Ticket className="h-4 w-4 text-white" />}
            title="Pass Details"
          >
            <div className="space-y-4">
              <InfoRow
                icon={<Calendar className="h-4 w-4" />}
                label="Pass Date"
                value={pass.pass_date ? formatDate(pass.pass_date) : '—'}
              />
              <InfoRow
                icon={<Clock className="h-4 w-4" />}
                label="Valid From"
                value={pass.valid_from ? formatDateTime(pass.valid_from) : '—'}
              />
              <InfoRow
                icon={<Clock className="h-4 w-4" />}
                label="Valid Until"
                value={pass.valid_until ? formatDateTime(pass.valid_until) : '—'}
              />
              <InfoRow
                icon={<CreditCard className="h-4 w-4" />}
                label="Price"
                value={
                  <span className="text-sky-700 font-semibold">
                    {formatCurrency(pass.price)}
                  </span>
                }
              />
              <InfoRow
                icon={<Building2 className="h-4 w-4" />}
                label="Facility ID"
                value={pass.facility_id}
              />
              {activity && (
                <InfoRow
                  icon={<Star className="h-4 w-4" />}
                  label="Activity"
                  value={
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-700">
                      {activity}
                    </span>
                  }
                />
              )}
            </div>
          </SectionCard>
        </div>

        {/* Card 3 — Status & Timeline (full width) */}
        <SectionCard
          icon={<CheckCircle2 className="h-4 w-4 text-white" />}
          title="Status & Timeline"
        >
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-6">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</p>
              <div className="mt-1.5">
                <StatusBadge status={pass.status} />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Created</p>
              <p className="text-sm font-medium mt-1.5">
                {pass.created_at ? formatDateTime(pass.created_at) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Checked In</p>
              <p className="text-sm font-medium mt-1.5">
                {pass.checked_in_at ? (
                  <span className="text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    {formatDateTime(pass.checked_in_at)}
                  </span>
                ) : (
                  <span className="text-muted-foreground italic">—</span>
                )}
              </p>
            </div>

            {/* Expiry — colour-coded */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Expires At</p>
              <p className={`text-sm font-semibold mt-1.5 flex items-center gap-1.5 ${
                expiryState.color === 'red'   ? 'text-red-600'
                : expiryState.color === 'amber' ? 'text-amber-600'
                : 'text-emerald-600'
              }`}>
                {expiryState.icon === 'expired' && <TimerOff className="h-3.5 w-3.5 shrink-0" />}
                {expiryState.icon === 'warn'    && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
                {expiryState.icon === 'ok'      && <Clock className="h-3.5 w-3.5 shrink-0" />}
                {pass.valid_until ? formatDateTime(pass.valid_until) : '—'}
              </p>
              <p className={`text-xs font-medium mt-0.5 ${
                expiryState.color === 'red'   ? 'text-red-400'
                : expiryState.color === 'amber' ? 'text-amber-400'
                : 'text-emerald-400'
              }`}>
                {expiryState.label}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Last Updated</p>
              <p className="text-sm font-medium mt-1.5">
                {pass.updated_at ? formatDateTime(pass.updated_at) : '—'}
              </p>
            </div>
          </div>
        </SectionCard>

        {/* Card 4 — Notes (only shown if notes exist) */}
        {freeText && (
          <SectionCard
            icon={<FileText className="h-4 w-4 text-white" />}
            title="Notes"
          >
            <p className="text-sm text-foreground whitespace-pre-wrap">{freeText}</p>
          </SectionCard>
        )}
      </div>

      {/* ── Edit Drawer ── */}
      <FormDrawer
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title={`Edit Pass — ${pass.guest_name}`}
        description="Update the day pass details."
      >
        <EditForm
          pass={pass}
          onSubmit={handleEdit}
          isLoading={updateMutation.isPending}
          onClose={() => setEditOpen(false)}
        />
      </FormDrawer>

      {/* ── Convert to Member Modal ── */}
      {convertOpen && (
        <ConvertToMemberModal pass={pass} onClose={() => setConvertOpen(false)} />
      )}

      {/* ── Delete Confirm Modal ── */}
      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete Day Pass"
        description={`Are you sure you want to delete the day pass for "${pass.guest_name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
