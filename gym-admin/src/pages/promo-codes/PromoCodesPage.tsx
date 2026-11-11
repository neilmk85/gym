import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Pencil, Ban, Radio } from 'lucide-react'

import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

import { promoCodesApi } from '@/api/promo-codes.api'
import { QUERY_KEYS } from '@/lib/constants'
import { formatDate } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PromoCode {
  id: number
  code: string
  discount_type: string
  discount_value: number
  max_uses?: number
  max_uses_per_member: number
  usage_count: number
  valid_from?: string
  valid_until?: string
  expires_at?: string
  is_active: boolean
  applicable_plans?: string[]
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PromoCodesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [deactivateTarget, setDeactivateTarget] = useState<PromoCode | null>(null)
  const [broadcastTarget, setBroadcastTarget] = useState<PromoCode | null>(null)

  // ── Query ──────────────────────────────────────────────────────────────────

  const { data, isLoading, isError } = useQuery({
    queryKey: QUERY_KEYS.promoCodes,
    queryFn: () => promoCodesApi.list(),
  })

  const promoCodes: PromoCode[] = (
    (data as { promo_codes?: unknown[] })?.promo_codes ??
    (data as { items?: unknown[] })?.items ??
    []
  ) as PromoCode[]

  // ── Mutations ──────────────────────────────────────────────────────────────

  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.promoCodes })

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => promoCodesApi.deactivate(id),
    onSuccess: () => {
      toast.success('Promo code deactivated')
      setDeactivateTarget(null)
      invalidate()
    },
    onError: () => {
      toast.error('Failed to deactivate promo code')
    },
  })

  const broadcastMutation = useMutation({
    mutationFn: (id: number) => promoCodesApi.broadcast(id),
    onSuccess: (_, id) => {
      const promo = promoCodes.find(p => p.id === id)
      toast.success(`Broadcast sent for ${promo?.code ?? 'promo code'} — all active members will be notified`)
      setBroadcastTarget(null)
    },
    onError: () => {
      toast.error('Failed to broadcast promo code')
    },
  })

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleDeactivateConfirm = () => {
    if (!deactivateTarget) return
    deactivateMutation.mutate(deactivateTarget.id)
  }

  const handleBroadcastConfirm = () => {
    if (!broadcastTarget) return
    broadcastMutation.mutate(broadcastTarget.id)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Promo Codes"
        subtitle="Manage promotional discount codes"
        actions={
          <Button onClick={() => navigate('/promo-codes/new')}>
            <Plus className="h-4 w-4" />
            Create Promo Code
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {isError && (
            <div className="p-6 text-sm text-destructive">
              Failed to load promo codes. Please try again.
            </div>
          )}

          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !isError && promoCodes.length === 0 ? (
            <EmptyState
              title="No promo codes found"
              description="Create discount codes to attract new members."
            />
          ) : (
            <div className="rounded-md overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-sidebar">
                  <tr>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Code</th>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Discount</th>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Usage</th>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Expiry</th>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Plans</th>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Status</th>
                    <th className="text-right px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {promoCodes.map((promo, idx) => {
                    const expiryStr = promo.valid_until ?? promo.expires_at
                    const usageLabel =
                      promo.max_uses != null
                        ? `${promo.usage_count} / ${promo.max_uses}`
                        : `${promo.usage_count} / ∞`

                    return (
                      <tr key={promo.id ?? idx} className="hover:bg-muted/30 transition-colors">
                        {/* Code */}
                        <td className="px-4 py-3 font-mono font-semibold">{promo.code}</td>

                        {/* Discount */}
                        <td className="px-4 py-3">
                          <span className="capitalize text-muted-foreground text-xs block">
                            {promo.discount_type?.replace(/_/g, ' ')}
                          </span>
                          <span className="font-medium">
                            {promo.discount_type === 'percentage'
                              ? `${promo.discount_value}%`
                              : `₹${promo.discount_value}`}
                          </span>
                        </td>

                        {/* Usage */}
                        <td className="px-4 py-3 text-muted-foreground">{usageLabel}</td>

                        {/* Expiry */}
                        <td className="px-4 py-3 text-muted-foreground">
                          {expiryStr ? formatDate(expiryStr) : 'No expiry'}
                        </td>

                        {/* Plans */}
                        <td className="px-4 py-3">
                          {promo.applicable_plans && promo.applicable_plans.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {promo.applicable_plans.map((plan) => (
                                <Badge key={plan} variant="outline" className="text-xs capitalize">
                                  {plan}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">All</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <StatusBadge status={promo.is_active ? 'active' : 'inactive'} />
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/promo-codes/${promo.id}/edit`)}
                            >
                              <Pencil className="h-3.5 w-3.5 mr-1" />
                              Edit
                            </Button>
                            {promo.is_active && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-emerald-600 hover:text-emerald-700 border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50"
                                onClick={() => setBroadcastTarget(promo)}
                              >
                                <Radio className="h-3.5 w-3.5 mr-1" />
                                Broadcast
                              </Button>
                            )}
                            {promo.is_active && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive"
                                onClick={() => setDeactivateTarget(promo)}
                              >
                                <Ban className="h-3.5 w-3.5 mr-1" />
                                Deactivate
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Deactivate Modal ─────────────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={handleDeactivateConfirm}
        title="Deactivate Promo Code"
        description={
          deactivateTarget
            ? `Are you sure you want to deactivate "${deactivateTarget.code}"? Members will no longer be able to use this code.`
            : ''
        }
        confirmLabel="Deactivate"
        variant="destructive"
        isLoading={deactivateMutation.isPending}
      />

      {/* ── Broadcast Modal ───────────────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={!!broadcastTarget}
        onClose={() => setBroadcastTarget(null)}
        onConfirm={handleBroadcastConfirm}
        title="Broadcast Promo Code"
        description={
          broadcastTarget
            ? `Send a notification about "${broadcastTarget.code}" to all active members? They will receive an in-app notification with the promo details.`
            : ''
        }
        confirmLabel="Send Broadcast"
        variant="default"
        isLoading={broadcastMutation.isPending}
      />
    </div>
  )
}
