import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Plus, Pencil, Trash2, LogIn, TicketCheck, CheckCircle2, Ticket, Users,
  DollarSign, X, CalendarDays, UserPlus, Lock, Star, Check, CreditCard,
  MoreHorizontal,
} from 'lucide-react'

import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SearchInput } from '@/components/shared/SearchInput'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

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
}

// ─── Convert to Member Modal ───────────────────────────────────────────────

const OCEAN = 'linear-gradient(135deg, #042B59 0%, #0553B1 52%, #027DFD 100%)'

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

interface ConvertModalProps {
  pass: DayPass
  onClose: () => void
}

function ConvertToMemberModal({ pass, onClose }: ConvertModalProps) {
  const queryClient = useQueryClient()
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [convStep, setConvStep] = useState<'idle' | 'member' | 'subscription' | 'done'>('idle')

  // Split guest_name into first/last
  const nameParts = (pass.guest_name ?? '').trim().split(/\s+/)
  const defaultFirst = nameParts[0] ?? ''
  const defaultLast  = nameParts.slice(1).join(' ') || ''

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
    convStep === 'member'       ? 'Creating member account…' :
    convStep === 'subscription' ? 'Assigning subscription plan…' :
    convStep === 'done'         ? 'Done!' : ''

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="rounded-t-xl px-6 py-5" style={{ background: OCEAN }}>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
                <UserPlus className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-white text-lg font-semibold">Convert to Full Member</DialogTitle>
                <DialogDescription className="text-white/70 text-sm mt-0.5">
                  Creating a member account for <span className="font-medium text-white">{pass.guest_name}</span>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <form onSubmit={form.handleSubmit((d) => convertMutation.mutate(d))} className="p-6 space-y-6">

          {/* ── Personal Info ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Personal Information</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">First Name <span className="text-destructive">*</span></Label>
                <Input {...form.register('first_name')} className="h-9" />
                {form.formState.errors.first_name && <p className="text-xs text-destructive">{form.formState.errors.first_name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Last Name <span className="text-destructive">*</span></Label>
                <Input {...form.register('last_name')} className="h-9" />
                {form.formState.errors.last_name && <p className="text-xs text-destructive">{form.formState.errors.last_name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Email <span className="text-destructive">*</span></Label>
                <Input type="email" {...form.register('email')} className="h-9" />
                {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Phone <span className="text-destructive">*</span></Label>
                <Input {...form.register('phone')} className="h-9" />
                {form.formState.errors.phone && <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Date of Birth <span className="text-destructive">*</span></Label>
                <Input type="date" {...form.register('date_of_birth')} className="h-9" />
                {form.formState.errors.date_of_birth && <p className="text-xs text-destructive">{form.formState.errors.date_of_birth.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Gender <span className="text-destructive">*</span></Label>
                <Controller
                  name="gender"
                  control={form.control}
                  render={({ field }) => (
                    <Select value={field.value ?? ''} onValueChange={field.onChange} className="w-full h-9">
                      <option value="">Select…</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </Select>
                  )}
                />
                {form.formState.errors.gender && <p className="text-xs text-destructive">{form.formState.errors.gender.message}</p>}
              </div>
            </div>

            {/* Password */}
            <div className="mt-4 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Password <span className="text-destructive">*</span></Label>
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
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword
                    ? <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" /></svg>
                    : <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  }
                </button>
              </div>
              {form.formState.errors.password && <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>}
            </div>
          </div>

          {/* ── Plan Selection ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Subscription Plan</p>
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
                    <div className="absolute top-3 right-3 h-5 w-5 rounded-full flex items-center justify-center" style={{ background: OCEAN }}>
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                  <p className="font-semibold text-sm text-muted-foreground">No Plan</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Assign later from member profile</p>
                </button>

                {plans.map(plan => (
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
                      <div className="absolute top-3 right-3 h-5 w-5 rounded-full flex items-center justify-center" style={{ background: OCEAN }}>
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Star className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                      <p className="font-semibold text-sm truncate pr-6">{plan.name}</p>
                    </div>
                    <p className="text-base font-bold text-sky-700">{formatCurrency(plan.price_amount)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Every {plan.billing_period_days} days
                      {plan.group_class_access && (
                        <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">Classes</Badge>
                      )}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div>
              {convStep !== 'idle' && convStep !== 'done' && (
                <p className="text-xs text-sky-600 font-medium animate-pulse">{stepLabel}</p>
              )}
              {selectedPlanId && (
                <p className="text-xs text-muted-foreground">
                  Will also create subscription: <span className="font-medium text-foreground">{plans.find(p => p.id === selectedPlanId)?.name}</span>
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={convertMutation.isPending}>
                Cancel
              </Button>
              <Button
                type="submit"
                loading={convertMutation.isPending}
                className="px-6"
                style={{ background: OCEAN, border: 'none' }}
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

export default function DayPassesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'admin'
  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager'

  const [deleteTarget, setDeleteTarget] = useState<DayPass | null>(null)
  const [convertTarget, setConvertTarget] = useState<DayPass | null>(null)

  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [datePreset, setDatePreset] = useState<string>('today')

  // ── Date preset helpers ────────────────────────────────────────────────
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const applyPreset = (preset: string) => {
    setDatePreset(preset)
    const now = new Date()
    if (preset === 'today') {
      setDateFrom(fmt(now)); setDateTo(fmt(now))
    } else if (preset === 'yesterday') {
      const y = new Date(now); y.setDate(y.getDate() - 1)
      setDateFrom(fmt(y)); setDateTo(fmt(y))
    } else if (preset === 'this_week') {
      const start = new Date(now); start.setDate(now.getDate() - now.getDay())
      setDateFrom(fmt(start)); setDateTo(fmt(now))
    } else if (preset === 'last_week') {
      const start = new Date(now); start.setDate(now.getDate() - now.getDay() - 7)
      const end = new Date(start); end.setDate(start.getDate() + 6)
      setDateFrom(fmt(start)); setDateTo(fmt(end))
    } else if (preset === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      setDateFrom(fmt(start)); setDateTo(fmt(now))
    } else if (preset === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0)
      setDateFrom(fmt(start)); setDateTo(fmt(end))
    } else if (preset === 'all') {
      setDateFrom(''); setDateTo('')
    } else if (preset === 'custom') {
      // keep existing dates, let user pick
    }
  }

  // initialise to today on mount
  useState(() => { applyPreset('today') })

  const clearAll = () => {
    setSearch('')
    setStatusFilter('')
    setDatePreset('all')
    setDateFrom('')
    setDateTo('')
  }

  // ── Query ──────────────────────────────────────────────────────────────

  const { data, isLoading, isError } = useQuery({
    queryKey: ['day-passes', { status: statusFilter, date_from: dateFrom, date_to: dateTo, search }],
    queryFn: () =>
      dayPassesApi.list({
        status: statusFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        search: search || undefined,
      }),
  })

  const passes: DayPass[] = (
    (data as { day_passes?: unknown[] })?.day_passes ?? []
  ) as DayPass[]

  // Summary stats
  const today = new Date().toISOString().slice(0, 10)
  const todayPasses = passes.filter((p) => p.pass_date?.slice(0, 10) === today)
  const todayActive = todayPasses.filter((p) => p.status === 'active').length
  const todayIssued = todayPasses.length

  // ── Mutations ──────────────────────────────────────────────────────────

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['day-passes'] })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => dayPassesApi.delete(id),
    onSuccess: () => {
      toast.success('Day pass deleted')
      setDeleteTarget(null)
      invalidate()
    },
    onError: () => toast.error('Failed to delete day pass'),
  })

  const checkInMutation = useMutation({
    mutationFn: (id: number) => dayPassesApi.checkIn(id),
    onSuccess: () => {
      toast.success('Guest checked in successfully')
      invalidate()
    },
    onError: () => toast.error('Failed to check in guest'),
  })

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return
    deleteMutation.mutate(deleteTarget.id)
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Day Passes"
        subtitle="Issue and manage single-day guest passes"
        actions={
          isAdminOrManager ? (
            <Button onClick={() => navigate('/day-passes/new')}>
              <Plus className="h-4 w-4" />
              Issue Day Pass
            </Button>
          ) : undefined
        }
        stats={[
          {
            label: 'Active Today',
            value: isLoading ? '…' : todayActive,
            sub: 'currently valid',
            icon: <CheckCircle2 className="h-4 w-4 text-white" />,
          },
          {
            label: 'Issued Today',
            value: isLoading ? '…' : todayIssued,
            sub: 'passes today',
            icon: <Ticket className="h-4 w-4 text-white" />,
          },
          {
            label: 'Used Today',
            value: isLoading ? '…' : todayPasses.filter((p) => p.status === 'used').length,
            sub: 'checked in',
            icon: <Users className="h-4 w-4 text-white" />,
          },
          {
            label: 'Total Shown',
            value: isLoading ? '…' : passes.length,
            sub: 'in current filter',
            icon: <DollarSign className="h-4 w-4 text-white" />,
          },
        ]}
      />

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.07)] p-4 mb-5 space-y-3">

        {/* Row 1: Search + Status + Date presets */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <SearchInput
            placeholder="Search by guest name…"
            value={search}
            onChange={setSearch}
            className="min-w-[200px]"
          />

          {/* Status */}
          <Select value={statusFilter} onValueChange={setStatusFilter} className="w-36 h-9">
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="used">Used</option>
            <option value="expired">Expired</option>
            <option value="cancelled">Cancelled</option>
          </Select>

          {/* Divider */}
          <div className="h-6 w-px bg-gray-200 hidden sm:block" />

          {/* Date preset dropdown */}
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
            <select
              value={datePreset}
              onChange={(e) => applyPreset(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_week">This Week</option>
              <option value="last_week">Last Week</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="all">All Time</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
        </div>

        {/* Row 2: Custom date range — only shown when custom is selected */}
        {datePreset === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36 h-8 text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">To</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36 h-8 text-sm" />
            </div>
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo('') }} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                <X className="h-3 w-3" /> Clear dates
              </button>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isError && (
            <div className="p-6 text-sm text-destructive">Failed to load day passes. Please try again.</div>
          )}

          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !isError && passes.length === 0 ? (
            <EmptyState
              title="No day passes found"
              description="Issue a day pass to grant guests temporary access to the facility."
            />
          ) : (
            <div className="overflow-x-auto rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-sidebar">
                  <tr>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide whitespace-nowrap">Guest Name</th>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide whitespace-nowrap">Email</th>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide whitespace-nowrap">Phone</th>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide whitespace-nowrap">Pass Date</th>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide whitespace-nowrap">Valid Until</th>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide whitespace-nowrap">Price</th>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide whitespace-nowrap">Status</th>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide whitespace-nowrap">Check-In</th>
                    <th className="text-right px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {passes.map((pass, idx) => (
                    <tr
                      key={pass.id ?? idx}
                      className="hover:bg-sky-50/40 transition-colors cursor-pointer"
                      onClick={() => navigate(`/day-passes/${pass.id}`)}
                    >
                      {/* Guest Name */}
                      <td className="px-4 py-3 font-medium whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-sky-100 flex items-center justify-center shrink-0 text-sky-700 text-[10px] font-bold">
                            {pass.guest_name?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                          </div>
                          <span className="text-sm">{pass.guest_name}</span>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-4 py-3 text-muted-foreground max-w-[160px] truncate text-sm">
                        {pass.guest_email || <span className="text-xs italic text-gray-300">—</span>}
                      </td>

                      {/* Phone */}
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-sm">
                        {pass.guest_phone || <span className="text-xs italic text-gray-300">—</span>}
                      </td>

                      {/* Pass Date */}
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        {pass.pass_date ? formatDate(pass.pass_date) : '—'}
                      </td>

                      {/* Valid Until */}
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground text-sm">
                        {pass.valid_until ? formatDateTime(pass.valid_until) : '—'}
                      </td>

                      {/* Price */}
                      <td className="px-4 py-3 whitespace-nowrap font-semibold text-sm tabular-nums">
                        {formatCurrency(pass.price)}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <StatusBadge status={pass.status} />
                      </td>

                      {/* Check-In Time */}
                      <td className="px-4 py-3 whitespace-nowrap text-xs">
                        {pass.checked_in_at ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                            {formatDateTime(pass.checked_in_at)}
                          </span>
                        ) : (
                          <span className="text-gray-300 italic">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">

                          {/* Check In */}
                          {pass.status === 'active' && (
                            <button
                              title="Check In"
                              onClick={() => checkInMutation.mutate(pass.id)}
                              disabled={checkInMutation.isPending}
                              className="h-8 w-8 rounded-lg flex items-center justify-center text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 transition-all disabled:opacity-40"
                            >
                              <LogIn className="h-4 w-4" />
                            </button>
                          )}

                          {/* Convert to Member */}
                          {isAdminOrManager && (
                            <button
                              title="Convert to Full Member"
                              onClick={() => setConvertTarget(pass)}
                              className="h-8 w-8 rounded-lg flex items-center justify-center text-sky-400 hover:text-sky-600 hover:bg-sky-50 transition-all"
                            >
                              <UserPlus className="h-4 w-4" />
                            </button>
                          )}

                          {/* Edit */}
                          {isAdminOrManager && (
                            <button
                              title="Edit Pass"
                              onClick={() => navigate(`/day-passes/${pass.id}/edit`)}
                              className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}

                          {/* Delete */}
                          {isAdmin && (
                            <button
                              title="Delete Pass"
                              onClick={() => setDeleteTarget(pass)}
                              className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Convert to Member Modal */}
      {convertTarget && (
        <ConvertToMemberModal
          pass={convertTarget}
          onClose={() => setConvertTarget(null)}
        />
      )}

      {/* Delete Modal */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Day Pass"
        description={
          deleteTarget
            ? `Are you sure you want to delete the day pass for "${deleteTarget.guest_name}"? This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
