import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Pencil, Ban, CheckCircle, Calendar, Users, Clock, Dumbbell, Lock, Zap, Tag, X, Check } from 'lucide-react'

import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

import { plansApi } from '@/api/plans.api'
import { QUERY_KEYS } from '@/lib/constants'
import { formatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import { loadAllPlanTimeRestrictions } from '@/lib/plan-time-store'
import type { Plan } from '@/types/plan.types'

const PLAN_GRADIENTS: Record<string, { grad: string; badge: string; accent: string }> = {
  basic:     { grad: 'from-blue-600 to-blue-800',     badge: 'bg-blue-500/25 text-blue-50',   accent: '#3b82f6' },
  standard:  { grad: 'from-cyan-500 to-teal-700',     badge: 'bg-cyan-400/25 text-cyan-50',   accent: '#06b6d4' },
  premium:   { grad: 'from-violet-600 to-purple-800', badge: 'bg-violet-400/25 text-violet-50', accent: '#8b5cf6' },
  corporate: { grad: 'from-emerald-500 to-green-700', badge: 'bg-emerald-400/25 text-emerald-50', accent: '#10b981' },
  trial:     { grad: 'from-amber-500 to-orange-600',  badge: 'bg-amber-400/25 text-amber-50', accent: '#f59e0b' },
}

const ACTIVITY_ICONS: Record<string, string> = {
  swimming: '🏊', yoga: '🧘', zumba: '💃', bollyfit: '🎵', functional: '🏋️', gym: '💪'
}

function perDay(price: number, days: number) {
  return (price / days).toFixed(0)
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
type FilterMode = 'active' | 'all'

export default function PlansPage() {
  const navigate = useNavigate()
  const { user, hasRole } = useAuthStore()
  const isAdmin = hasRole(['owner'])
  const isAdminOrManager = hasRole(['owner', 'reception', 'manager'])

  const queryClient = useQueryClient()

  // UI state
  const [filterMode, setFilterMode] = useState<FilterMode>('active')
  const [deactivatingPlan, setDeactivatingPlan] = useState<Plan | null>(null)
  const timeRestrictions = loadAllPlanTimeRestrictions()

  // Queries
  const { data, isLoading, isError } = useQuery({
    queryKey: [...QUERY_KEYS.plans, filterMode],
    queryFn: () => plansApi.list(filterMode === 'active' ? true : false),
  })

  const plans: Plan[] = ((data as { plans?: Plan[] })?.plans ?? [])

  // Mutations
  const activateMutation = useMutation({
    mutationFn: (id: number) => plansApi.activate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.plans, exact: false })
      toast.success('Plan activated successfully')
    },
    onError: () => toast.error('Failed to activate plan. Please try again.'),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => plansApi.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.plans, exact: false })
      toast.success('Plan deactivated successfully')
      setDeactivatingPlan(null)
      setFilterMode('all')
    },
    onError: () => {
      toast.error('Failed to deactivate plan. Please try again.')
    },
  })

  // Handlers
  const handleDeactivateConfirm = () => {
    if (!deactivatingPlan) return
    deactivateMutation.mutate(deactivatingPlan.id)
  }

  return (
    <div>
      <PageHeader
        title="Membership Plans"
        subtitle="Manage your gym membership plans"
        actions={
          isAdminOrManager ? (
            <Button onClick={() => navigate('/membership-plans/new')}>
              <Plus className="h-4 w-4" />
              Create Plan
            </Button>
          ) : undefined
        }
      />

      {/* Filter toggle */}
      <div className="flex items-center gap-2 mb-5">
        <Button
          size="sm"
          variant={filterMode === 'active' ? 'default' : 'outline'}
          onClick={() => setFilterMode('active')}
        >
          Active
        </Button>
        <Button
          size="sm"
          variant={filterMode === 'all' ? 'default' : 'outline'}
          onClick={() => setFilterMode('all')}
        >
          All
        </Button>
      </div>

      {isError && (
        <p className="text-sm text-destructive mb-4">Failed to load plans. Please try again.</p>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl overflow-hidden border border-border shadow-sm">
              <Skeleton className="h-36 w-full" />
              <div className="p-5 space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-9 w-full mt-2" />
              </div>
            </div>
          ))}
        </div>
      ) : plans.length === 0 ? (
        <EmptyState
          title="No plans found"
          description={
            filterMode === 'active'
              ? 'No active plans. Switch to "All" or create a new plan.'
              : 'Create your first membership plan to get started.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {plans.map((plan) => {
            const g = PLAN_GRADIENTS[plan.type] ?? PLAN_GRADIENTS.standard
            const tr = timeRestrictions[String(plan.id)]
            const hasTimeRestriction = tr?.enabled
            const perDayPrice = perDay(plan.price_amount, plan.billing_period_days)

            return (
              <div
                key={plan.id}
                className={`rounded-2xl overflow-hidden border flex flex-col shadow-sm hover:shadow-lg transition-shadow duration-200 ${
                  plan.is_active ? 'border-border' : 'border-dashed border-muted-foreground/30 opacity-70'
                }`}
              >
                {/* ── Gradient header ── */}
                <div className={`bg-gradient-to-br ${g.grad} px-5 pt-5 pb-6 relative`}>
                  {/* Status + type row */}
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-[11px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full ${g.badge}`}>
                      {plan.type}
                    </span>
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                      plan.is_active
                        ? 'bg-white/20 text-white'
                        : 'bg-black/20 text-white/70'
                    }`}>
                      {plan.is_active ? '● Active' : '○ Inactive'}
                    </span>
                  </div>

                  {/* Plan name */}
                  <h3 className="text-xl font-bold text-white leading-snug mb-1">{plan.name}</h3>

                  {/* Category / gender / activity tags */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {plan.activity_type && plan.activity_type !== 'all' && (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white/15 text-white/90">
                        {ACTIVITY_ICONS[plan.activity_type]} {plan.activity_type.charAt(0).toUpperCase() + plan.activity_type.slice(1)}
                      </span>
                    )}
                    {plan.member_category === 'couple' && (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white/15 text-white/90">👫 Couple</span>
                    )}
                    {plan.member_category === 'group' && (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white/15 text-white/90">
                        👥 Group{plan.min_members > 1 ? ` (${plan.min_members}–${plan.max_members})` : ''}
                      </span>
                    )}
                    {plan.gender === 'male' && (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white/15 text-white/90">♂ Male</span>
                    )}
                    {plan.gender === 'female' && (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white/15 text-white/90">♀ Female</span>
                    )}
                  </div>

                  {/* Price block */}
                  <div className="flex items-end gap-3">
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-extrabold text-white tracking-tight">
                          {formatCurrency(plan.price_amount)}
                        </span>
                        {plan.is_offer && plan.original_price && plan.original_price > plan.price_amount && (
                          <span className="text-sm text-white/50 line-through">{formatCurrency(plan.original_price)}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-white/60 text-xs flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {plan.billing_period_days} days
                        </span>
                        <span className="text-white/40 text-xs">·</span>
                        <span className="text-white/60 text-xs">₹{perDayPrice}/day</span>
                      </div>
                    </div>
                    {plan.max_discount_percent > 0 && (
                      <span className="ml-auto text-xs font-bold px-2.5 py-1.5 rounded-lg bg-white/20 text-white flex items-center gap-1">
                        <Tag className="h-3 w-3" />
                        Up to {plan.max_discount_percent}% off
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Body ── */}
                <div className="bg-card flex-1 flex flex-col px-5 pt-4 pb-5 gap-4">

                  {/* Offer banner */}
                  {plan.is_offer && (
                    <div className="flex items-center gap-2 text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                      <Zap className="h-3.5 w-3.5 shrink-0 text-orange-500" />
                      <span>{plan.offer_label || 'Limited Offer'}</span>
                      {plan.offer_valid_until && (
                        <span className="ml-auto font-normal text-orange-500">
                          until {new Date(plan.offer_valid_until).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Time restriction banner */}
                  {hasTimeRestriction && (
                    <div className="flex items-center gap-2 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      <span>{tr.label || 'Time Restricted'}: {tr.start_time} – {tr.end_time}</span>
                      {tr.days.length < 7 && (
                        <span className="ml-auto text-amber-500">{tr.days.join(', ')}</span>
                      )}
                    </div>
                  )}

                  {/* Features checklist */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                    {[
                      { icon: <Users className="h-3.5 w-3.5" />, label: 'Group Classes', value: plan.group_class_access },
                      { icon: <Dumbbell className="h-3.5 w-3.5" />, label: 'PT Access', value: plan.pt_access },
                      { icon: <Lock className="h-3.5 w-3.5" />, label: 'Locker', value: plan.locker_access },
                      { icon: <Calendar className="h-3.5 w-3.5" />, label: plan.max_classes_per_month ? `${plan.max_classes_per_month} classes/mo` : 'Unlimited classes', value: true },
                    ].map(({ icon, label, value }) => (
                      <div key={label} className={`flex items-center gap-1.5 text-xs ${value ? 'text-foreground' : 'text-muted-foreground/50'}`}>
                        <span className={`flex-shrink-0 ${value ? 'text-emerald-500' : 'text-muted-foreground/30'}`}>
                          {value ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                        </span>
                        <span className={`flex items-center gap-1 ${!value ? 'line-through' : ''}`}>
                          {icon} {label}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Included class types */}
                  {plan.included_class_types && plan.included_class_types.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-[11px] text-muted-foreground font-medium w-full mb-0.5">Free classes included:</span>
                      {plan.included_class_types.map((ct: string) => (
                        <span key={ct} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 capitalize">
                          {ct}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Action buttons */}
                  {(isAdminOrManager || isAdmin) && (
                    <div className="flex gap-2 mt-auto pt-1">
                      {isAdminOrManager && (
                        <button
                          onClick={() => navigate(`/membership-plans/${plan.id}/edit`)}
                          className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium h-9 rounded-xl border border-border bg-background hover:bg-muted transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                      )}
                      {isAdmin && plan.is_active && (
                        <button
                          onClick={() => setDeactivatingPlan(plan)}
                          className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium h-9 rounded-xl border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                        >
                          <Ban className="h-3.5 w-3.5" />
                          Deactivate
                        </button>
                      )}
                      {isAdmin && !plan.is_active && (
                        <button
                          onClick={() => activateMutation.mutate(plan.id)}
                          disabled={activateMutation.isPending}
                          className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium h-9 rounded-xl border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 transition-colors disabled:opacity-50"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          Activate
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Deactivate Confirm Modal */}
      <ConfirmModal
        isOpen={!!deactivatingPlan}
        onClose={() => setDeactivatingPlan(null)}
        onConfirm={handleDeactivateConfirm}
        title="Deactivate Plan"
        description={
          deactivatingPlan
            ? `Are you sure you want to deactivate "${deactivatingPlan.name}"? Existing subscribers will not be affected, but no new subscriptions can be created for this plan.`
            : ''
        }
        confirmLabel="Deactivate"
        variant="destructive"
        isLoading={deactivateMutation.isPending}
      />
    </div>
  )
}
