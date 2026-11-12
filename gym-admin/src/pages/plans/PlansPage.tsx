import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Pencil, Ban, CheckCircle, Calendar, Users, Clock } from 'lucide-react'

import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'

import { plansApi } from '@/api/plans.api'
import { QUERY_KEYS } from '@/lib/constants'
import { formatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import { loadAllPlanTimeRestrictions } from '@/lib/plan-time-store'
import type { Plan } from '@/types/plan.types'

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
type FilterMode = 'active' | 'all'

export default function PlansPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'
  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager'

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6 space-y-3">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <Card key={plan.id} className="flex flex-col">
              <CardContent className="p-6 flex flex-col gap-3 flex-1">
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg font-semibold leading-tight">{plan.name}</h3>
                  <StatusBadge status={plan.is_active ? 'active' : 'inactive'} />
                </div>

                {/* Price */}
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-primary">{formatCurrency(plan.price_amount)}</span>
                  {plan.is_offer && plan.original_price && plan.original_price > plan.price_amount && (
                    <span className="text-sm text-muted-foreground line-through">{formatCurrency(plan.original_price)}</span>
                  )}
                </div>

                {/* Duration */}
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{plan.billing_period_days} days</span>
                </div>

                {/* Time restriction badge */}
                {(() => {
                  const tr = timeRestrictions[String(plan.id)]
                  if (!tr?.enabled) return null
                  return (
                    <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      <span>{tr.label || 'Time Restricted'}:</span>
                      <span>{tr.start_time} – {tr.end_time}</span>
                      {tr.days.length < 7 && (
                        <span className="text-amber-500">({tr.days.join(', ')})</span>
                      )}
                    </div>
                  )
                })()}

                {/* Offer badge */}
                {plan.is_offer && (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded-md px-2.5 py-1.5">
                    <span>🏷️</span>
                    <span>{plan.offer_label || 'Limited Offer'}</span>
                    {plan.offer_valid_until && (
                      <span className="font-normal text-orange-500">· until {new Date(plan.offer_valid_until).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                    )}
                  </div>
                )}

                {/* Category / Gender / Activity badges */}
                <div className="flex flex-wrap gap-1.5">
                  {plan.activity_type && plan.activity_type !== 'all' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200">
                      {plan.activity_type === 'swimming' && '🏊'}
                      {plan.activity_type === 'yoga' && '🧘'}
                      {plan.activity_type === 'zumba' && '💃'}
                      {plan.activity_type === 'bollyfit' && '🎵'}
                      {plan.activity_type === 'functional' && '🏋️'}
                      {plan.activity_type === 'gym' && '💪'}
                      {' '}{plan.activity_type.charAt(0).toUpperCase() + plan.activity_type.slice(1)}
                    </span>
                  )}
                  {plan.member_category === 'couple' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-pink-50 text-pink-700 border border-pink-200">
                      👫 Couple
                    </span>
                  )}
                  {plan.member_category === 'group' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                      👥 Group {plan.min_members && plan.min_members > 1 ? `(${plan.min_members}–${plan.max_members})` : ''}
                    </span>
                  )}
                  {plan.gender === 'male' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      ♂ Male
                    </span>
                  )}
                  {plan.gender === 'female' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                      ♀ Female
                    </span>
                  )}
                </div>

                {/* Feature badges */}
                <div className="flex flex-wrap gap-2 mt-auto pt-2">
                  {plan.group_class_access && (
                    <Badge variant="secondary">
                      <Users className="h-3 w-3 mr-1" />
                      Group Classes
                    </Badge>
                  )}
                </div>

                {/* Action buttons */}
                {(isAdminOrManager || (isAdmin && plan.is_active)) && (
                  <>
                    <Separator />
                    <div className="flex items-center gap-2 pt-1">
                      {isAdminOrManager && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => navigate(`/membership-plans/${plan.id}/edit`)}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          Edit
                        </Button>
                      )}
                      {isAdmin && plan.is_active && (
                        <Button
                          size="sm"
                          variant="destructive"
                          className="flex-1"
                          onClick={() => setDeactivatingPlan(plan)}
                        >
                          <Ban className="h-3.5 w-3.5 mr-1" />
                          Deactivate
                        </Button>
                      )}
                      {isAdmin && !plan.is_active && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-green-600 border-green-300 hover:bg-green-50"
                          onClick={() => activateMutation.mutate(plan.id)}
                          disabled={activateMutation.isPending}
                        >
                          <CheckCircle className="h-3.5 w-3.5 mr-1" />
                          Activate
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
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
