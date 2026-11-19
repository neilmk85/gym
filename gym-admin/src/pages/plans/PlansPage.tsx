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
  if (days <= 31)  return 'per month'
  if (days <= 62)  return 'per 2 months'
  if (days <= 95)  return 'per 3 months'
  if (days <= 185) return 'per 6 months'
  if (days <= 370) return 'per year'
  if (days <= 460) return 'per 15 months'
  return `per ${days} days`
}

function genderLabel(g: string) {
  if (g === 'male')   return '♂ Male'
  if (g === 'female') return '♀ Female'
  return null
}

// single gradient used across all cards, matching the reference image
const CARD_GRAD = 'linear-gradient(135deg, #14b8a6 0%, #6366f1 100%)'

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
  const hasRenewalDiff = plan.renewal_price && plan.renewal_price > 0 && plan.renewal_price !== plan.price_amount
  const inactive = !plan.is_active

  const badgeLabel = plan.is_offer && plan.offer_label
    ? plan.offer_label.toUpperCase()
    : (!plan.is_offer && plan.type === 'premium') ? 'MOST POPULAR' : null

  const features = [
    plan.group_class_access    && 'Group Classes',
    plan.pt_access             && 'Personal Training',
    plan.locker_access         && 'Locker Access',
    plan.gym_floor_access      && 'Gym Floor',
    plan.cardio_section_access && 'Cardio Section',
    plan.facility_access       && 'Facility Access',
  ].filter(Boolean) as string[]

  return (
    <div
      className={`rounded-2xl flex flex-col overflow-hidden transition-all duration-200
        ${inactive
          ? 'opacity-55 border border-dashed border-muted-foreground/30 shadow-none'
          : 'border border-border shadow-md hover:shadow-xl hover:-translate-y-0.5'
        }`}
      style={{ background: 'var(--card)' }}
    >
      {/* ── Slim gradient banner ── */}
      <div
        className="flex items-center justify-center py-2.5 px-4"
        style={{ background: CARD_GRAD }}
      >
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-white">
          {badgeLabel ?? (genderLabel(plan.gender ?? 'any') ?? (
            plan.member_category === 'couple' ? '👫 Couple Plan'
            : plan.member_category === 'group' ? '👥 Group Plan'
            : 'Membership'
          ))}
        </span>
      </div>

      {/* ── Card body ── */}
      <div className="flex-1 flex flex-col px-5 pt-5 pb-5 gap-4 bg-card">

        {/* Plan name */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[17px] font-bold text-foreground leading-tight">{plan.name}</h3>
            {inactive && (
              <span className="text-[10px] font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded-full uppercase tracking-wide shrink-0 mt-0.5">
                Inactive
              </span>
            )}
          </div>

          {/* Gender / category tags (when not in banner) */}
          {badgeLabel && (
            <div className="flex gap-1.5 mt-1 flex-wrap">
              {genderLabel(plan.gender ?? 'any') && (
                <span className="text-[11px] font-medium text-muted-foreground">{genderLabel(plan.gender ?? 'any')}</span>
              )}
              {plan.member_category === 'couple' && <span className="text-[11px] text-muted-foreground">👫 Couple</span>}
            </div>
          )}
        </div>

        {/* Price */}
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-[30px] font-extrabold text-foreground leading-none tracking-tight">
              {formatCurrency(plan.price_amount)}
            </span>
            <span className="text-muted-foreground text-sm">{periodLabel(plan.billing_period_days)}</span>
          </div>
          {hasRenewalDiff && (
            <div className="mt-1 flex items-center gap-1.5 text-muted-foreground text-xs">
              <RefreshCw className="h-3 w-3" />
              Renewal: <span className="font-semibold text-foreground">{formatCurrency(plan.renewal_price!)}</span>
            </div>
          )}
          {plan.max_discount_percent > 0 && (
            <div className="mt-1 flex items-center gap-1 text-muted-foreground text-xs">
              <Tag className="h-3 w-3" />
              Up to {plan.max_discount_percent}% discount
            </div>
          )}
        </div>

        {/* Offer expiry / time restriction */}
        {plan.is_offer && plan.offer_valid_until && (
          <div className="flex items-center gap-2 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5">
            <Zap className="h-3.5 w-3.5 shrink-0 text-orange-500" />
            Valid until {new Date(plan.offer_valid_until).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        )}
        {timeRestriction?.enabled && (
          <div className="flex items-center gap-2 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            {timeRestriction.label}: {timeRestriction.start_time} – {timeRestriction.end_time}
          </div>
        )}

        {/* Features checklist */}
        <ul className="space-y-2">
          {features.map(f => (
            <li key={f} className="flex items-center gap-2.5 text-sm text-foreground">
              <span className="flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#14b8a6,#6366f1)' }}>
                <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              {f}
            </li>
          ))}
          {plan.max_classes_per_month != null && (
            <li className="flex items-center gap-2.5 text-sm text-foreground">
              <span className="flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#14b8a6,#6366f1)' }}>
                <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              {plan.max_classes_per_month} classes / month
            </li>
          )}
          {plan.steam_bath_per_month != null && (
            <li className="flex items-center gap-2.5 text-sm text-foreground">
              <span className="flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#14b8a6,#6366f1)' }}>
                <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              {plan.steam_bath_per_month} steam bath / month
            </li>
          )}
        </ul>

        {/* Included class types */}
        {plan.included_class_types && plan.included_class_types.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {plan.included_class_types.map((ct: string) => (
              <span key={ct} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 capitalize">
                {ct.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        )}

        {/* Action buttons */}
        {(isAdminOrManager || isAdmin) && (
          <div className="mt-auto pt-1 flex gap-2">
            {isAdminOrManager && (
              <button
                onClick={onEdit}
                className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold h-10 rounded-xl border-2 transition-all hover:bg-muted/50"
                style={{ borderColor: '#14b8a6', color: '#0d9488' }}
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
