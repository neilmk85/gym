import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Pencil, Ban, Radio, Search } from 'lucide-react'

import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

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

type StatusFilter = 'all' | 'active' | 'inactive'

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all',      label: 'All' },
  { value: 'active',   label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PromoCodesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch]             = useState('')
  const [deactivateTarget, setDeactivateTarget] = useState<PromoCode | null>(null)
  const [broadcastTarget, setBroadcastTarget]   = useState<PromoCode | null>(null)

  // ── Query ──────────────────────────────────────────────────────────────────

  const { data, isLoading, isError } = useQuery({
    queryKey: QUERY_KEYS.promoCodes,
    queryFn: () => promoCodesApi.list(),
  })

  const allPromoCodes: PromoCode[] = (
    (data as { promo_codes?: unknown[] })?.promo_codes ??
    (data as { items?: unknown[] })?.items ??
    []
  ) as PromoCode[]

  const promoCodes = useMemo(() => {
    let list = allPromoCodes
    if (statusFilter === 'active')   list = list.filter(p => p.is_active)
    if (statusFilter === 'inactive') list = list.filter(p => !p.is_active)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.code.toLowerCase().includes(q) ||
        p.discount_type?.toLowerCase().includes(q) ||
        p.applicable_plans?.some(pl => pl.toLowerCase().includes(q))
      )
    }
    return list
  }, [allPromoCodes, statusFilter, search])

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
      const promo = allPromoCodes.find(p => p.id === id)
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
        {/* ── Tabs + Search bar ── */}
        <div className="flex items-center px-4 border-b">
          <div className="flex items-center">
            {STATUS_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={[
                  'px-3 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                  statusFilter === tab.value
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700',
                ].join(' ')}
              >
                {tab.label}
                {tab.value !== 'all' && (
                  <span className={[
                    'ml-1.5 text-xs px-1.5 py-0.5 rounded-full',
                    statusFilter === tab.value
                      ? 'bg-purple-100 text-purple-600'
                      : 'bg-slate-100 text-slate-500',
                  ].join(' ')}>
                    {tab.value === 'active'
                      ? allPromoCodes.filter(p => p.is_active).length
                      : allPromoCodes.filter(p => !p.is_active).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="ml-8 border-l border-slate-200 pl-8 py-2 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search codes…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 w-56 text-sm"
              />
            </div>
          </div>
        </div>

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
              description={search ? 'Try a different search term.' : 'Create discount codes to attract new members.'}
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
