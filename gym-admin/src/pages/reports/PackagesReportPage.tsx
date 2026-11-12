import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/shared/SearchInput'
import { Card } from '@/components/ui/card'
import { ptApi, type PTPackage } from '@/api/pt.api'
import { plansApi } from '@/api/plans.api'
import { reportsApi, type SubscriptionReport } from '@/api/reports.api'
import { formatCurrency } from '@/lib/utils'
import type { Plan } from '@/types/plan.types'
import {
  Package2, Zap, Ban, Users, CalendarDays,
  Layers, DollarSign, Clock4, CheckCircle2, XCircle,
} from 'lucide-react'

export default function PackagesReportPage() {
  const [pkgSearch, setPkgSearch]   = useState('')
  const [planSearch, setPlanSearch] = useState('')

  const { data: pkgData, isLoading: pkgLoading, isError: pkgError } = useQuery({
    queryKey: ['pt-packages'],
    queryFn: () => ptApi.listPackages(),
  })

  const { data: plansData, isLoading: plansLoading, isError: plansError } = useQuery({
    queryKey: ['plans'],
    queryFn: () => plansApi.list(),
  })

  const { data: subReport, isLoading: subLoading } = useQuery({
    queryKey: ['reports', 'subscriptions'],
    queryFn: () => reportsApi.subscriptions(),
  })

  const allPkgs: PTPackage[] = (pkgData as { pt_packages?: PTPackage[] })?.pt_packages ?? []
  const allPlans: Plan[]     = (plansData as { plans?: Plan[] })?.plans ?? []
  const subData              = subReport as SubscriptionReport | undefined

  const activePkgs   = allPkgs.filter(p => p.is_active)
  const activePlans  = allPlans.filter(p => p.is_active)
  const totalActive  = subData?.active ?? 0
  const expiring7    = subData?.expiring_in_7_days ?? 0
  const byPlanMap    = new Map((subData?.by_plan ?? []).map(r => [r.plan_id, r.count]))

  const filteredPkgs = pkgSearch.trim()
    ? allPkgs.filter(p => p.name.toLowerCase().includes(pkgSearch.toLowerCase()))
    : allPkgs

  const filteredPlans = planSearch.trim()
    ? allPlans.filter(p => p.name.toLowerCase().includes(planSearch.toLowerCase()))
    : allPlans

  const isLoading = pkgLoading || plansLoading || subLoading

  return (
    <div className="space-y-6">

      {/* ── Edge-to-edge header ── */}
      <div className="relative overflow-hidden -mx-6 -mt-6 bg-gradient-to-r from-teal-600 via-cyan-600 to-sky-600 px-6 py-6 text-white">
        <div className="relative">
          <div className="flex items-start gap-3 mb-1">
            <Package2 className="w-6 h-6 opacity-90 mt-0.5" />
            <div>
              <h1 className="text-xl font-bold">Packages &amp; Plans Report</h1>
              <p className="text-sm text-white/80 mt-0.5 max-w-2xl">
                PT session bundles and membership plans — pricing, active subscribers, and revenue overview.
              </p>
            </div>
          </div>

          {!isLoading && (
            <div className="flex flex-wrap gap-2 mt-4">
              <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1 text-xs font-medium">
                <Layers className="w-3.5 h-3.5" />
                {allPkgs.length + allPlans.length} total (packages + plans)
              </div>
              <div className="flex items-center gap-1.5 bg-green-400/30 backdrop-blur-sm border border-green-300/40 rounded-full px-3 py-1 text-xs font-medium">
                <Zap className="w-3.5 h-3.5 text-green-200" />
                {activePkgs.length} active PT packages
              </div>
              <div className="flex items-center gap-1.5 bg-green-400/30 backdrop-blur-sm border border-green-300/40 rounded-full px-3 py-1 text-xs font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-200" />
                {activePlans.length} active plans
              </div>
              <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1 text-xs font-medium">
                <Users className="w-3.5 h-3.5" />
                {totalActive} active subscribers
              </div>
              {expiring7 > 0 && (
                <div className="flex items-center gap-1.5 bg-amber-400/30 backdrop-blur-sm border border-amber-300/40 rounded-full px-3 py-1 text-xs font-medium">
                  <CalendarDays className="w-3.5 h-3.5 text-amber-200" />
                  {expiring7} expiring in 7 days
                </div>
              )}
            </div>
          )}
        </div>
        <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute -right-2 -bottom-8 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
      </div>

      {/* ── Section 1: PT Packages ── */}
      <div>
        <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
          <Clock4 className="w-4 h-4 text-teal-600" /> PT Packages
        </h2>

        {pkgError && <p className="text-sm text-destructive mb-3">Failed to load PT packages.</p>}

        <Card className="shadow-lg shadow-gray-200/80 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between gap-4 px-4 py-3 border-b bg-teal-50/60">
            <p className="font-medium text-sm text-teal-700 whitespace-nowrap flex items-center gap-1.5">
              <Package2 className="w-4 h-4" />
              {pkgLoading ? 'Loading…' : `${filteredPkgs.length} package${filteredPkgs.length !== 1 ? 's' : ''}`}
            </p>
            <SearchInput placeholder="Search packages…" value={pkgSearch} onChange={setPkgSearch} className="w-56" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gradient-to-r from-teal-50 via-cyan-50 to-sky-50">
                  <th className="text-left px-4 py-3 font-semibold text-teal-700">Package</th>
                  <th className="text-left px-4 py-3 font-semibold text-teal-700">Sessions</th>
                  <th className="text-left px-4 py-3 font-semibold text-teal-700">Validity</th>
                  <th className="text-left px-4 py-3 font-semibold text-teal-700">Price</th>
                  <th className="text-left px-4 py-3 font-semibold text-teal-700">Per Session</th>
                  <th className="text-left px-4 py-3 font-semibold text-teal-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pkgLoading && Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    {[1,2,3,4,5,6].map(c => (
                      <td key={c} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse w-20" />
                      </td>
                    ))}
                  </tr>
                ))}

                {!pkgLoading && filteredPkgs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center">
                      <Package2 className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">No PT packages found</p>
                    </td>
                  </tr>
                )}

                {!pkgLoading && filteredPkgs.map(pkg => (
                  <tr key={pkg.id} className="hover:bg-teal-50/40 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium">{pkg.name}</p>
                      {pkg.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 max-w-[200px]">
                          {pkg.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-lg font-bold text-teal-600">{pkg.sessions}</span>
                      <span className="text-xs text-muted-foreground ml-1">sessions</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {pkg.validity_days} days
                    </td>
                    <td className="px-4 py-3 font-semibold">{formatCurrency(pkg.price)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatCurrency(pkg.price / pkg.sessions)}
                    </td>
                    <td className="px-4 py-3">
                      {pkg.is_active ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                          <Zap className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                          <Ban className="w-3 h-3" /> Inactive
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* ── Section 2: Membership Plans ── */}
      <div>
        <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-teal-600" /> Membership Plans
        </h2>

        {plansError && <p className="text-sm text-destructive mb-3">Failed to load membership plans.</p>}

        <Card className="shadow-lg shadow-gray-200/80 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between gap-4 px-4 py-3 border-b bg-teal-50/60">
            <p className="font-medium text-sm text-teal-700 whitespace-nowrap flex items-center gap-1.5">
              <Layers className="w-4 h-4" />
              {plansLoading ? 'Loading…' : `${filteredPlans.length} plan${filteredPlans.length !== 1 ? 's' : ''}`}
            </p>
            <SearchInput placeholder="Search plans…" value={planSearch} onChange={setPlanSearch} className="w-56" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gradient-to-r from-teal-50 via-cyan-50 to-sky-50">
                  <th className="text-left px-4 py-3 font-semibold text-teal-700">Plan</th>
                  <th className="text-left px-4 py-3 font-semibold text-teal-700">Billing Period</th>
                  <th className="text-left px-4 py-3 font-semibold text-teal-700">Price</th>
                  <th className="text-left px-4 py-3 font-semibold text-teal-700">Active Subscribers</th>
                  <th className="text-left px-4 py-3 font-semibold text-teal-700">Est. Monthly Revenue</th>
                  <th className="text-left px-4 py-3 font-semibold text-teal-700">Group Classes</th>
                  <th className="text-left px-4 py-3 font-semibold text-teal-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {plansLoading && Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    {[1,2,3,4,5,6,7].map(c => (
                      <td key={c} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse w-20" />
                      </td>
                    ))}
                  </tr>
                ))}

                {!plansLoading && filteredPlans.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center">
                      <Layers className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">No membership plans found</p>
                    </td>
                  </tr>
                )}

                {!plansLoading && filteredPlans.map(plan => {
                  const activeSubs = byPlanMap.get(plan.id) ?? 0
                  const monthlyMultiplier = plan.billing_period_days > 0
                    ? 30 / plan.billing_period_days
                    : 1
                  const estMonthlyRevenue = Math.round(activeSubs * plan.price_amount * monthlyMultiplier)

                  return (
                    <tr key={plan.id} className="hover:bg-teal-50/40 transition-colors">
                      <td className="px-4 py-3 font-medium">{plan.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {plan.billing_period_days} days
                      </td>
                      <td className="px-4 py-3 font-semibold">{formatCurrency(plan.price_amount)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="font-medium">{activeSubs}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {activeSubs > 0 ? (
                          <span className="font-semibold text-teal-700">
                            {formatCurrency(estMonthlyRevenue)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {plan.group_class_access ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            <CheckCircle2 className="w-3 h-3" /> Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                            <XCircle className="w-3 h-3" /> No
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {plan.is_active ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                            <Zap className="w-3 h-3" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                            <Ban className="w-3 h-3" /> Inactive
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Summary footer */}
          {!plansLoading && filteredPlans.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t bg-muted/20 text-xs text-muted-foreground">
              <span>{activePlans.length} active plan{activePlans.length !== 1 ? 's' : ''} · {totalActive} total active subscribers</span>
              <span className="font-medium text-foreground flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5" />
                Est. total monthly: {formatCurrency(
                  filteredPlans.reduce((sum, plan) => {
                    const subs = byPlanMap.get(plan.id) ?? 0
                    const mult = plan.billing_period_days > 0 ? 30 / plan.billing_period_days : 1
                    return sum + Math.round(subs * plan.price_amount * mult)
                  }, 0)
                )}
              </span>
            </div>
          )}
        </Card>
      </div>

    </div>
  )
}
