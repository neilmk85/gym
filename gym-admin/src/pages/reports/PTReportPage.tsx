import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/PageHeader'
import { ptApi, type MemberPTPackage } from '@/api/pt.api'
import { trainersApi } from '@/api/trainers.api'
import { commissionApi } from '@/api/commission.api'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  Dumbbell, Search, ChevronLeft, ChevronRight,
  Users, TrendingUp, CheckCircle2, AlertTriangle,
  UserCheck, Timer,
} from 'lucide-react'

const PER_PAGE = 20

function memberName(pkg: MemberPTPackage) {
  const u = pkg.member?.user
  if (!u) return `Member #${pkg.member_id}`
  return `${u.first_name} ${u.last_name}`.trim()
}

function trainerName(pkg: MemberPTPackage) {
  const u = pkg.trainer?.user
  if (!u) return pkg.trainer_id ? `Trainer #${pkg.trainer_id}` : '—'
  return `${u.first_name} ${u.last_name}`.trim()
}

function daysLeft(expires: string) {
  return Math.ceil((new Date(expires).getTime() - Date.now()) / 86400000)
}

const STATUS_CFG = {
  active:   { label: 'Active',   cls: 'bg-green-50 text-green-700 border border-green-200' },
  expired:  { label: 'Expired',  cls: 'bg-red-50 text-red-600 border border-red-200' },
  inactive: { label: 'Inactive', cls: 'bg-gray-100 text-gray-500 border border-gray-200' },
}

function pkgStatus(pkg: MemberPTPackage): keyof typeof STATUS_CFG {
  if (!pkg.is_active) return 'inactive'
  if (new Date(pkg.expires_at) < new Date()) return 'expired'
  return 'active'
}

export default function PTReportPage() {
  const [search, setSearch]           = useState('')
  const [trainerFilter, setTrainerFilter] = useState('all')
  const [statusFilter, setStatusFilter]   = useState('all')
  const [page, setPage]               = useState(1)

  const { data: pkgData, isLoading } = useQuery({
    queryKey: ['pt-report', 'member-packages'],
    queryFn: () => ptApi.listAllMemberPackages({ per_page: 500 }),
  })

  const { data: trainerData } = useQuery({
    queryKey: ['trainers'],
    queryFn: () => trainersApi.list(),
  })

  const allPkgs: MemberPTPackage[] = (pkgData as any)?.member_pt_packages ?? []
  const trainers = (trainerData as any)?.trainers ?? []

  // ── Stats ──
  const stats = useMemo(() => {
    const uniqueClients  = new Set(allPkgs.map(p => p.member_id)).size
    const activeClients  = new Set(allPkgs.filter(p => pkgStatus(p) === 'active').map(p => p.member_id)).size
    const totalRevenue   = allPkgs.reduce((s, p) => s + (p.amount ?? 0), 0)
    const totalSessions  = allPkgs.reduce((s, p) => s + p.total_sessions, 0)
    const usedSessions   = allPkgs.reduce((s, p) => s + p.used_sessions, 0)
    const remaining      = totalSessions - usedSessions
    return { uniqueClients, activeClients, totalRevenue, totalSessions, usedSessions, remaining }
  }, [allPkgs])

  // ── Trainer breakdown ──
  const trainerRows = useMemo(() => {
    const map = new Map<number, {
      trainerId: number; name: string
      clients: Set<number>; packages: number
      revenue: number; sessionsTotal: number; sessionsUsed: number
    }>()

    for (const pkg of allPkgs) {
      const tid = pkg.trainer_id ?? 0
      const tname = trainerName(pkg)
      if (!map.has(tid)) {
        map.set(tid, { trainerId: tid, name: tname, clients: new Set(), packages: 0, revenue: 0, sessionsTotal: 0, sessionsUsed: 0 })
      }
      const row = map.get(tid)!
      row.clients.add(pkg.member_id)
      row.packages++
      row.revenue      += pkg.amount ?? 0
      row.sessionsTotal += pkg.total_sessions
      row.sessionsUsed  += pkg.used_sessions
    }

    return [...map.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .map(r => ({ ...r, clientCount: r.clients.size }))
  }, [allPkgs])

  // ── Filtered client table ──
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return allPkgs.filter(pkg => {
      const matchSearch = !q ||
        memberName(pkg).toLowerCase().includes(q) ||
        trainerName(pkg).toLowerCase().includes(q) ||
        (pkg.pt_package?.name ?? '').toLowerCase().includes(q)
      const matchTrainer = trainerFilter === 'all' || String(pkg.trainer_id ?? 0) === trainerFilter
      const matchStatus  = statusFilter === 'all' || pkgStatus(pkg) === statusFilter
      return matchSearch && matchTrainer && matchStatus
    })
  }, [allPkgs, search, trainerFilter, statusFilter])

  const totalFiltered = filtered.length
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const headerStats = isLoading ? undefined : [
    { label: 'Total PT Clients',     value: stats.uniqueClients,            sub: 'all time',       icon: <Users className="h-4 w-4 text-white" /> },
    { label: 'Active PT Clients',    value: stats.activeClients,            sub: 'valid packages', icon: <UserCheck className="h-4 w-4 text-white" /> },
    { label: 'PT Revenue',           value: formatCurrency(stats.totalRevenue), sub: 'all packages', icon: <TrendingUp className="h-4 w-4 text-white" /> },
    { label: 'Sessions Sold',        value: stats.totalSessions,            sub: 'across all',     icon: <Dumbbell className="h-4 w-4 text-white" /> },
    { label: 'Sessions Done',        value: stats.usedSessions,             sub: 'completed',      icon: <CheckCircle2 className="h-4 w-4 text-white" /> },
    { label: 'Sessions Remaining',   value: stats.remaining,                sub: 'unused balance', icon: <Timer className="h-4 w-4 text-white" /> },
  ]

  return (
    <div className="space-y-6">

      <PageHeader
        title="PT Report"
        subtitle="Personal training revenue, trainer assignments & client session breakdown"
        icon={<Dumbbell className="h-6 w-6 text-white" />}
        stats={headerStats}
      />

      {/* ── Trainer breakdown ── */}
      <Card className="shadow-sm rounded-xl overflow-hidden border">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-muted-foreground" />
          <p className="font-semibold text-sm">Trainer Breakdown</p>
          <span className="ml-auto text-xs text-muted-foreground">{trainerRows.length} trainers</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Trainer</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Clients</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Packages</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Revenue</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sessions Sold</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Done</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Remaining</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">% Done</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((__, c) => (
                    <td key={c} className="px-4 py-3">
                      <div className="h-4 bg-muted rounded animate-pulse w-16" />
                    </td>
                  ))}
                </tr>
              ))}
              {!isLoading && trainerRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No PT data found
                  </td>
                </tr>
              )}
              {!isLoading && trainerRows.map(row => {
                const pct = row.sessionsTotal > 0 ? Math.round((row.sessionsUsed / row.sessionsTotal) * 100) : 0
                return (
                  <tr key={row.trainerId} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      {row.trainerId ? (
                        <Link to={`/reports/trainers/${row.trainerId}`} className="text-primary hover:underline">
                          {row.name}
                        </Link>
                      ) : row.name}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-muted-foreground" />
                        {row.clientCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{row.packages}</td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">{formatCurrency(row.revenue)}</td>
                    <td className="px-4 py-3 text-right">{row.sessionsTotal}</td>
                    <td className="px-4 py-3 text-right text-green-700 font-medium">{row.sessionsUsed}</td>
                    <td className="px-4 py-3 text-right text-amber-600 font-medium">{row.sessionsTotal - row.sessionsUsed}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {!isLoading && trainerRows.length > 0 && (
              <tfoot>
                <tr className="bg-muted/40 border-t font-semibold">
                  <td className="px-4 py-2.5 text-xs uppercase tracking-wide text-muted-foreground">TOTAL</td>
                  <td className="px-4 py-2.5 text-right">{stats.uniqueClients}</td>
                  <td className="px-4 py-2.5 text-right">{allPkgs.length}</td>
                  <td className="px-4 py-2.5 text-right">{formatCurrency(stats.totalRevenue)}</td>
                  <td className="px-4 py-2.5 text-right">{stats.totalSessions}</td>
                  <td className="px-4 py-2.5 text-right">{stats.usedSessions}</td>
                  <td className="px-4 py-2.5 text-right">{stats.remaining}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {/* ── Client PT packages table ── */}
      <Card className="shadow-sm rounded-xl overflow-hidden border">
        {/* Filter bar */}
        <div className="flex items-center justify-between gap-4 px-4 py-3 border-b">
          <p className="font-semibold text-sm whitespace-nowrap flex items-center gap-1.5">
            <Dumbbell className="w-4 h-4 text-muted-foreground" />
            {isLoading ? 'Loading…' : `${totalFiltered} package${totalFiltered !== 1 ? 's' : ''}`}
          </p>
          <div className="flex items-center gap-2 flex-1 justify-end flex-wrap">
            <div className="relative w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Member, trainer, package…" value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }} className="pl-9" />
            </div>
            <select value={trainerFilter}
              onChange={e => { setTrainerFilter(e.target.value); setPage(1) }}
              className="h-9 w-40 rounded-md border border-input bg-background px-3 text-sm focus:outline-none">
              <option value="all">All trainers</option>
              <option value="0">Unassigned</option>
              {trainers.map((t: any) => (
                <option key={t.id} value={String(t.id)}>
                  {t.user?.first_name} {t.user?.last_name}
                </option>
              ))}
            </select>
            <select value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
              className="h-9 w-32 rounded-md border border-input bg-background px-3 text-sm focus:outline-none">
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Member</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Package</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Trainer</th>
                <th className="text-right px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Amount Paid</th>
                <th className="text-center px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sessions</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Purchased</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Expires</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((__, c) => (
                    <td key={c} className="px-4 py-3">
                      <div className="h-4 bg-gray-100 rounded animate-pulse w-20" />
                    </td>
                  ))}
                </tr>
              ))}

              {!isLoading && paged.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-14 text-center">
                    <Dumbbell className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-muted-foreground text-sm font-medium">No PT packages found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {search || trainerFilter !== 'all' || statusFilter !== 'all'
                        ? 'Try adjusting your search or filters.'
                        : 'No PT packages have been sold yet.'}
                    </p>
                  </td>
                </tr>
              )}

              {!isLoading && paged.map((pkg, idx) => {
                const status = pkgStatus(pkg)
                const sCfg   = STATUS_CFG[status]
                const dl     = daysLeft(pkg.expires_at)
                const remaining = pkg.total_sessions - pkg.used_sessions
                const fillPct   = pkg.total_sessions > 0
                  ? Math.round((pkg.used_sessions / pkg.total_sessions) * 100) : 0
                const expiringSoon = status === 'active' && dl <= 7

                return (
                  <tr key={pkg.id ?? idx}
                    className={`hover:bg-muted/20 transition-colors ${expiringSoon ? 'bg-orange-50/30' : ''}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium leading-tight">{memberName(pkg)}</p>
                      {pkg.member?.user?.email && (
                        <p className="text-xs text-muted-foreground mt-0.5">{pkg.member.user.email}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium leading-tight">{pkg.pt_package?.name ?? `Package #${pkg.pt_package_id}`}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {pkg.pt_package?.sessions} sessions · {pkg.pt_package?.validity_days}d validity
                      </p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{trainerName(pkg)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">
                      {formatCurrency(pkg.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs font-medium">
                          {pkg.used_sessions} / {pkg.total_sessions}
                        </span>
                        <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full ${fillPct >= 90 ? 'bg-red-400' : fillPct >= 70 ? 'bg-amber-400' : 'bg-primary'}`}
                            style={{ width: `${fillPct}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{remaining} left</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {formatDate(pkg.purchased_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {expiringSoon && <AlertTriangle className="w-3.5 h-3.5 text-orange-500 shrink-0" />}
                        <span className={expiringSoon ? 'text-orange-600 font-medium' : 'text-muted-foreground'}>
                          {formatDate(pkg.expires_at)}
                        </span>
                      </div>
                      {status === 'active' && (
                        <p className={`text-xs mt-0.5 ${dl <= 0 ? 'text-red-500' : dl <= 7 ? 'text-orange-500' : 'text-muted-foreground'}`}>
                          {dl <= 0 ? 'Expired' : `${dl}d left`}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${sCfg.cls}`}>
                        {sCfg.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!isLoading && totalFiltered > PER_PAGE && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t text-xs text-muted-foreground">
            <span>
              Showing {Math.min((page - 1) * PER_PAGE + 1, totalFiltered)}–{Math.min(page * PER_PAGE, totalFiltered)} of {totalFiltered}
            </span>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7" title="Previous page"
                onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <span className="flex items-center px-2 font-medium">Page {page}</span>
              <Button variant="outline" size="icon" className="h-7 w-7" title="Next page"
                onClick={() => setPage(p => p + 1)} disabled={page * PER_PAGE >= totalFiltered}>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
