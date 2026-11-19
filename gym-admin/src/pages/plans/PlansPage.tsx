import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Plus, Pencil, Ban, CheckCircle, Users, Lock,
  Dumbbell, Clock, Zap, RefreshCw, Tag,
} from 'lucide-react'

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function periodLabel(days: number) {
  if (days <= 31)  return '/ month'
  if (days <= 62)  return '/ 2 months'
  if (days <= 95)  return '/ 3 months'
  if (days <= 185) return '/ 6 months'
  if (days <= 370) return '/ year'
  if (days <= 460) return '/ 15 months'
  return `/ ${days} days`
}

function genderLabel(g: string) {
  if (g === 'male')   return '♂ Male'
  if (g === 'female') return '♀ Female'
  return null
}

const GENDER_GRAD: Record<string, string> = {
  male:   'from-[#0ea5e9] to-[#0369a1]',
  female: 'from-[#ec4899] to-[#9d174d]',
  any:    'from-[#14b8a6] to-[#0f766e]',
}

// ─── Plan Card ────────────────────────────────────────────────────────────────

function PlanCard({
  plan, onEdit, onDeactivate, onActivate, activatingId, isAdmin, isAdminOrManager, timeRestriction,
}: {
  plan: Plan
  onEdit: () => void
  onDeactivate: () => void
  onActivate: () => void
  activatingId: number | null
  isAdmin: boolean
  isAdminOrManager: boolean
  timeRestriction?: { enabled: boolean; label: string; start_time: string; end_time: string; days: string[] }
}) {
  const grad = GENDER_GRAD[plan.gender ?? 'any'] ?? GENDER_GRAD.any
  const hasRenewalDiff = plan.renewal_price && plan.renewal_price > 0 && plan.renewal_price !== plan.price_amount
  const inactive = !plan.is_active

  const features = [
    plan.group_class_access  && 'Group Classes',
    plan.pt_access           && 'Personal Training',
    plan.locker_access       && 'Locker Access',
    plan.gym_floor_access    && 'Gym Floor',
    plan.cardio_section_access && 'Cardio Section',
    plan.facility_access     && 'Facility Access',
  ].filter(Boolean) as string[]

  return (
    <div className={`rounded-2xl flex flex-col overflow-hidden border transition-all duration-200
      ${inactive
        ? 'opacity-60 border-dashed border-muted-foreground/30 shadow-none'
        : 'border-transparent shadow-md hover:shadow-xl hover:-translate-y-0.5'
      }`}
      style={{ background: 'var(--card)' }}
    >
      {/* ── Top gradient band ── */}
      <div className={`bg-gradient-to-br ${grad} px-5 pt-4 pb-5 relative`}>
        {/* Popular / Offer badge */}
        {plan.is_offer && plan.offer_label && (
          <div className="absolute -top-px left-1/2 -translate-x-1/2 z-10">
            <div className="bg-gradient-to-r from-orange-400 to-pink-500 text-white text-[10px] font-bold uppercase tracking-widest px-5 py-1 rounded-b-xl shadow-sm">
              {plan.offer_label}
            </div>
          </div>
        )}
        {!plan.is_offer && plan.type === 'premium' && (
          <div className="absolute -top-px left-1/2 -translate-x-1/2 z-10">
            <div className="bg-gradient-to-r from-violet-500 to-purple-700 text-white text-[10px] font-bold uppercase tracking-widest px-5 py-1 rounded-b-xl shadow-sm">
              Most Popular
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between mb-1">
          <div className="flex gap-1.5 flex-wrap">
            {genderLabel(plan.gender ?? 'any') && (
              <span className="text-[11px] font-semibold bg-white/20 text-white px-2 py-0.5 rounded-full">
                {genderLabel(plan.gender ?? 'any')}
              </span>
            )}
            {plan.member_category === 'couple' && (
              <span className="text-[11px] font-semibold bg-white/20 text-white px-2 py-0.5 rounded-full">👫 Couple</span>
            )}
            {plan.member_category === 'group' && (
              <span className="text-[11px] font-semibold bg-white/20 text-white px-2 py-0.5 rounded-full">👥 Group</span>
            )}
          </div>
          {inactive && (
            <span className="text-[10px] bg-black/25 text-white/70 font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide">
              Inactive
            </span>
          )}
        </div>

        {/* Name */}
        <h3 className="text-[17px] font-bold text-white leading-tight mb-3">{plan.name}</h3>

        {/* Price */}
        <div className="flex items-baseline gap-2">
          <span className="text-[32px] font-extrabold text-white leading-none tracking-tight">
            {formatCurrency(plan.price_amount)}
          </span>
          <span className="text-white/70 text-sm font-medium">{periodLabel(plan.billing_period_days)}</span>
        </div>
        {hasRenewalDiff && (
          <div className="mt-1 flex items-center gap-1.5 text-white/75 text-xs">
            <RefreshCw className="h-3 w-3" />
            Renewal: <span className="font-semibold text-white">{formatCurrency(plan.renewal_price!)}</span>
          </div>
        )}
        {plan.max_discount_percent > 0 && (
          <div className="mt-1 flex items-center gap-1 text-white/75 text-xs">
            <Tag className="h-3 w-3" />
            Up to {plan.max_discount_percent}% discount allowed
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div className="flex-1 flex flex-col px-5 py-4 gap-3 bg-card">
        {/* Offer expiry */}
        {plan.is_offer && plan.offer_valid_until && (
          <div className="flex items-center gap-2 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5">
            <Zap className="h-3.5 w-3.5 shrink-0 text-orange-500" />
            Valid until {new Date(plan.offer_valid_until).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        )}

        {/* Time restriction */}
        {timeRestriction?.enabled && (
          <div className="flex items-center gap-2 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            {timeRestriction.label}: {timeRestriction.start_time} – {timeRestriction.end_time}
          </div>
        )}

        {/* Features */}
        <ul className="space-y-1.5">
          {features.map(f => (
            <li key={f} className="flex items-center gap-2.5 text-sm text-foreground">
              <span className="flex-shrink-0 h-5 w-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              {f}
            </li>
          ))}
          {plan.max_classes_per_month != null && (
            <li className="flex items-center gap-2.5 text-sm text-foreground">
              <span className="flex-shrink-0 h-5 w-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                <Users className="h-3 w-3" />
              </span>
              {plan.max_classes_per_month} classes / month
            </li>
          )}
          {plan.max_pt_sessions_per_month != null && (
            <li className="flex items-center gap-2.5 text-sm text-foreground">
              <span className="flex-shrink-0 h-5 w-5 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                <Dumbbell className="h-3 w-3" />
              </span>
              {plan.max_pt_sessions_per_month} PT sessions / month
            </li>
          )}
          {plan.steam_bath_per_month != null && (
            <li className="flex items-center gap-2.5 text-sm text-foreground">
              <span className="flex-shrink-0 h-5 w-5 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center">
                <Lock className="h-3 w-3" />
              </span>
              {plan.steam_bath_per_month} steam bath / month
            </li>
          )}
        </ul>

        {/* Included class types */}
        {plan.included_class_types && plan.included_class_types.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {plan.included_class_types.map((ct: string) => (
              <span key={ct} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 capitalize">
                {ct.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        )}

        {/* Action button */}
        {(isAdminOrManager || isAdmin) && (
          <div className="mt-auto pt-2 flex gap-2">
            {isAdminOrManager && (
              <button
                onClick={onEdit}
                className={`flex-1 flex items-center justify-center gap-2 text-sm font-semibold h-10 rounded-xl text-white transition-all
                  bg-gradient-to-r ${grad} hover:opacity-90 shadow-sm`}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit Plan
              </button>
            )}
            {isAdmin && plan.is_active && (
              <button
                onClick={onDeactivate}
                className="h-10 px-3 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                title="Deactivate"
              >
                <Ban className="h-4 w-4" />
              </button>
            )}
            {isAdmin && !plan.is_active && (
              <button
                onClick={onActivate}
                disabled={activatingId === plan.id}
                className="h-10 px-3 rounded-xl border border-emerald-200 text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                title="Activate"
              >
                <CheckCircle className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'regular' | 'offers'

export default function PlansPage() {
  const navigate = useNavigate()
  const { hasRole } = useAuthStore()
  const isAdmin = hasRole(['owner'])
  const isAdminOrManager = hasRole(['owner', 'reception', 'manager'])

  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('regular')
  const [deactivatingPlan, setDeactivatingPlan] = useState<Plan | null>(null)
  const [activatingId, setActivatingId] = useState<number | null>(null)
  const timeRestrictions = loadAllPlanTimeRestrictions()

  const { data, isLoading, isError } = useQuery({
    queryKey: [...QUERY_KEYS.plans, 'all'],
    queryFn: () => plansApi.list(false),
  })

  const allPlans: Plan[] = (data as { plans?: Plan[] })?.plans ?? []

  const regularPlans = allPlans.filter(p => !p.is_offer)
  const offerPlans   = allPlans.filter(p =>  p.is_offer)

  const activePlans   = (tab === 'regular' ? regularPlans : offerPlans).filter(p =>  p.is_active)
  const inactivePlans = (tab === 'regular' ? regularPlans : offerPlans).filter(p => !p.is_active)

  const activateMutation = useMutation({
    mutationFn: (id: number) => plansApi.activate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.plans, exact: false })
      toast.success('Plan activated')
      setActivatingId(null)
    },
    onError: () => { toast.error('Failed to activate plan'); setActivatingId(null) },
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => plansApi.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.plans, exact: false })
      toast.success('Plan deactivated')
      setDeactivatingPlan(null)
    },
    onError: () => toast.error('Failed to deactivate plan'),
  })

  const cardProps = (plan: Plan) => ({
    plan,
    onEdit: () => navigate(`/membership-plans/${plan.id}/edit`),
    onDeactivate: () => setDeactivatingPlan(plan),
    onActivate: () => { setActivatingId(plan.id); activateMutation.mutate(plan.id) },
    activatingId,
    isAdmin,
    isAdminOrManager,
    timeRestriction: timeRestrictions[String(plan.id)],
  })

  const tabClass = (t: Tab) =>
    `px-5 py-2 text-sm font-semibold rounded-full transition-all ${
      tab === t
        ? 'bg-primary text-primary-foreground shadow-sm'
        : 'text-muted-foreground hover:text-foreground'
    }`

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

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 bg-muted/50 rounded-full p-1 w-fit">
        <button className={tabClass('regular')} onClick={() => setTab('regular')}>
          Regular Packages
          {!isLoading && regularPlans.length > 0 && (
            <span className={`ml-2 text-[11px] font-bold px-1.5 py-0.5 rounded-full ${tab === 'regular' ? 'bg-white/25 text-white' : 'bg-muted text-muted-foreground'}`}>
              {regularPlans.filter(p => p.is_active).length}
            </span>
          )}
        </button>
        <button className={tabClass('offers')} onClick={() => setTab('offers')}>
          Offers
          {!isLoading && offerPlans.length > 0 && (
            <span className={`ml-2 text-[11px] font-bold px-1.5 py-0.5 rounded-full ${tab === 'offers' ? 'bg-white/25 text-white' : 'bg-muted text-muted-foreground'}`}>
              {offerPlans.filter(p => p.is_active).length}
            </span>
          )}
        </button>
      </div>

      {isError && <p className="text-sm text-destructive mb-4">Failed to load plans. Please try again.</p>}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4].map(i => (
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
      ) : activePlans.length === 0 && inactivePlans.length === 0 ? (
        <EmptyState
          title={tab === 'regular' ? 'No regular packages' : 'No offers'}
          description="Create a new plan to get started."
        />
      ) : (
        <div className="space-y-8">
          {/* Active plans */}
          {activePlans.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {activePlans.map(plan => <PlanCard key={plan.id} {...cardProps(plan)} />)}
            </div>
          )}

          {/* Inactive plans */}
          {inactivePlans.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 pl-1">
                Inactive Plans
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {inactivePlans.map(plan => <PlanCard key={plan.id} {...cardProps(plan)} />)}
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        isOpen={!!deactivatingPlan}
        onClose={() => setDeactivatingPlan(null)}
        onConfirm={() => deactivatingPlan && deactivateMutation.mutate(deactivatingPlan.id)}
        title="Deactivate Plan"
        description={
          deactivatingPlan
            ? `Deactivate "${deactivatingPlan.name}"? Existing subscribers won't be affected.`
            : ''
        }
        confirmLabel="Deactivate"
        variant="destructive"
        isLoading={deactivateMutation.isPending}
      />
    </div>
  )
}
