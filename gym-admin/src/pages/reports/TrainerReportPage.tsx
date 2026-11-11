import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Dumbbell, Users, TrendingUp, CheckCircle2, Timer,
  ArrowLeft, AlertTriangle, ChevronDown, Wallet, Clock,
} from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ptApi, type MemberPTPackage, type PTSession } from '@/api/pt.api'
import { trainersApi } from '@/api/trainers.api'
import { commissionApi, type CommissionEntry, type CommissionPayout } from '@/api/commission.api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { getPackageSplit, computeSplit } from '@/lib/service-types'

// ─── Date preset helpers ──────────────────────────────────────────────────────

type Preset = 'today' | 'this_week' | 'this_month' | 'last_month' | 'last_3m' | 'last_6m' | 'this_year' | 'all_time' | 'custom'

const PRESETS: { id: Preset; label: string }[] = [
  { id: 'today',      label: 'Today'         },
  { id: 'this_week',  label: 'This Week'     },
  { id: 'this_month', label: 'This Month'    },
  { id: 'last_month', label: 'Last Month'    },
  { id: 'last_3m',    label: 'Last 3 Months' },
  { id: 'last_6m',    label: 'Last 6 Months' },
  { id: 'this_year',  label: 'This Year'     },
  { id: 'all_time',   label: 'All Time'      },
  { id: 'custom',     label: 'Custom Range'  },
]

function presetDates(id: Preset): { from: string; to: string } {
  const now = new Date()
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  const today = fmt(now)
  switch (id) {
    case 'today':      return { from: today, to: today }
    case 'this_week':  { const d = new Date(now); d.setDate(d.getDate() - d.getDay()); return { from: fmt(d), to: today } }
    case 'this_month': return { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, to: today }
    case 'last_month': {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const e = new Date(now.getFullYear(), now.getMonth(), 0)
      return { from: fmt(s), to: fmt(e) }
    }
    case 'last_3m': { const d = new Date(now); d.setMonth(d.getMonth() - 3); return { from: fmt(d), to: today } }
    case 'last_6m': { const d = new Date(now); d.setMonth(d.getMonth() - 6); return { from: fmt(d), to: today } }
    case 'this_year':  return { from: `${now.getFullYear()}-01-01`, to: today }
    default:           return { from: '', to: '' }
  }
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function memberName(pkg: MemberPTPackage) {
  const u = pkg.member?.user
  return u ? `${u.first_name} ${u.last_name}`.trim() : `Member #${pkg.member_id}`
}

function memberEmail(pkg: MemberPTPackage) {
  return pkg.member?.user?.email ?? ''
}

function inDateRange(date: string, from: string, to: string) {
  if (!from && !to) return true
  const d = date.split('T')[0]
  if (from && d < from) return false
  if (to   && d > to)   return false
  return true
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted/40 first:rounded-tl last:rounded-tr whitespace-nowrap">
      {children}
    </th>
  )
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-sm align-top ${className ?? ''}`}>{children}</td>
}

function SkeletonRows({ cols, rows = 4 }: { cols: number; rows?: number }) {
  return <>{Array.from({ length: rows }).map((_, i) => (
    <tr key={i}>
      {Array.from({ length: cols }).map((__, c) => (
        <td key={c} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse w-24" /></td>
      ))}
    </tr>
  ))}</>
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TrainerReportPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const trainerId = Number(id)

  // ── Filters ──
  const [preset, setPreset] = useState<Preset>('all_time')
  const [from,   setFrom]   = useState('')
  const [to,     setTo]     = useState('')
  const [memberSearch, setMemberSearch] = useState('')

  const handlePreset = (p: Preset) => {
    setPreset(p)
    if (p !== 'custom') {
      const d = presetDates(p)
      setFrom(d.from)
      setTo(d.to)
    }
  }

  // ── Data ──
  const { data: trainerData, isLoading: trainerLoading } = useQuery({
    queryKey: ['trainer', trainerId],
    queryFn: () => trainersApi.getById(trainerId),
    enabled: !!trainerId,
  })
  const trainer = trainerData as any

  const staffId: number | undefined = trainer?.user_id

  const { data: pkgData, isLoading: pkgLoading } = useQuery({
    queryKey: ['pt-report', 'trainer-packages', trainerId],
    queryFn: () => ptApi.listAllMemberPackages({ per_page: 1000 }),
    enabled: !!trainerId,
  })

  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ['pt-report', 'trainer-sessions', trainerId],
    queryFn: () => ptApi.listAllSessions({ trainer_id: trainerId, per_page: 1000 }),
    enabled: !!trainerId,
  })

  const { data: commissionsData } = useQuery({
    queryKey: ['commissions', staffId],
    queryFn: () => commissionApi.listEntries(staffId!, 1, 500),
    enabled: !!staffId,
  })

  const { data: payoutsData } = useQuery({
    queryKey: ['payouts', staffId],
    queryFn: () => commissionApi.listPayouts(staffId!, 1, 500),
    enabled: !!staffId,
  })

  const isLoading = trainerLoading || pkgLoading || sessionsLoading

  // ── Filter packages by trainer and date ──
  const allPkgs: MemberPTPackage[] = useMemo(() => {
    const raw: MemberPTPackage[] = (pkgData as any)?.member_pt_packages ?? []
    return raw.filter(p => p.trainer_id === trainerId)
  }, [pkgData, trainerId])

  const filteredPkgs = useMemo(() => {
    return allPkgs.filter(p => inDateRange(p.purchased_at, from, to))
  }, [allPkgs, from, to])

  const allSessions: PTSession[] = useMemo(() => {
    const raw: PTSession[] = (sessionsData as any)?.pt_sessions ?? []
    return raw.filter(s => inDateRange(s.scheduled_at, from, to))
  }, [sessionsData, from, to])

  const commEntries: CommissionEntry[] = useMemo(() => {
    const raw: CommissionEntry[] = (commissionsData as any)?.data ?? []
    return raw.filter(e => inDateRange(e.created_at, from, to))
  }, [commissionsData, from, to])

  const payouts: CommissionPayout[] = useMemo(() => {
    const raw: CommissionPayout[] = (payoutsData as any)?.data ?? []
    return raw.filter(p => inDateRange(p.created_at, from, to))
  }, [payoutsData, from, to])

  // ── Computed stats ──
  const stats = useMemo(() => {
    const totalRevenue     = filteredPkgs.reduce((s, p) => s + p.amount, 0)
    const totalSessions    = filteredPkgs.reduce((s, p) => s + p.total_sessions, 0)
    const sessionsUsed     = filteredPkgs.reduce((s, p) => s + p.used_sessions, 0)
    const sessionsRemaining = totalSessions - sessionsUsed
    const completedSessions = allSessions.filter(s => s.status === 'completed').length
    const trainerEarned    = commEntries
      .filter(e => ['approved', 'paid'].includes(e.status))
      .reduce((s, e) => s + e.comm_paise, 0) / 100
    const trainerDue       = commEntries
      .filter(e => e.status === 'pending')
      .reduce((s, e) => s + e.comm_paise, 0) / 100
    const totalPaidOut     = payouts
      .filter(p => p.status === 'paid')
      .reduce((s, p) => s + p.total_paise, 0) / 100
    const uniqueMembers    = new Set(filteredPkgs.map(p => p.member_id)).size
    return { totalRevenue, totalSessions, sessionsUsed, sessionsRemaining, completedSessions, trainerEarned, trainerDue, totalPaidOut, uniqueMembers }
  }, [filteredPkgs, allSessions, commEntries, payouts])

  // ── Per-member breakdown ──
  const memberRows = useMemo(() => {
    const map = new Map<number, {
      memberId: number; name: string; email: string
      packages: MemberPTPackage[]
      totalPaid: number; totalEarned: number; sessionsSold: number; sessionsUsed: number
    }>()
    for (const pkg of filteredPkgs) {
      if (!map.has(pkg.member_id)) {
        map.set(pkg.member_id, {
          memberId: pkg.member_id, name: memberName(pkg), email: memberEmail(pkg),
          packages: [], totalPaid: 0, totalEarned: 0, sessionsSold: 0, sessionsUsed: 0,
        })
      }
      const row = map.get(pkg.member_id)!
      const split = getPackageSplit(pkg.pt_package_id)
      const gymEarned = split ? (computeSplit(split).gymPct / 100) * pkg.amount : pkg.amount
      row.packages.push(pkg)
      row.totalPaid    += pkg.amount
      row.totalEarned  += gymEarned
      row.sessionsSold += pkg.total_sessions
      row.sessionsUsed += pkg.used_sessions
    }
    return [...map.values()].sort((a, b) => b.totalPaid - a.totalPaid)
  }, [filteredPkgs])

  const displayedRows = useMemo(() => {
    const q = memberSearch.toLowerCase()
    return memberRows.filter(r => !q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q))
  }, [memberRows, memberSearch])

  const trainerDisplayName = trainer?.user
    ? `${trainer.user.first_name} ${trainer.user.last_name}`.trim()
    : `Trainer #${trainerId}`

  const headerStats = isLoading ? undefined : [
    { label: 'Members Enrolled',    value: stats.uniqueMembers,                   sub: 'all time',     icon: <Users className="h-4 w-4 text-white" /> },
    { label: 'Gym Revenue',         value: formatCurrency(stats.totalRevenue),    sub: 'from PT sales', icon: <TrendingUp className="h-4 w-4 text-white" /> },
    { label: 'Trainer Earned',      value: formatCurrency(stats.trainerEarned),   sub: 'approved',     icon: <Wallet className="h-4 w-4 text-white" /> },
    { label: 'Due to Trainer',      value: formatCurrency(stats.trainerDue),      sub: 'pending',      icon: <Clock className="h-4 w-4 text-white" /> },
    { label: 'Sessions Conducted',  value: stats.completedSessions,               sub: 'completed',    icon: <CheckCircle2 className="h-4 w-4 text-white" /> },
    { label: 'Sessions Remaining',  value: stats.sessionsRemaining,               sub: 'unused',       icon: <Timer className="h-4 w-4 text-white" /> },
  ]

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      {trainerLoading ? (
        <div className="rounded-2xl bg-muted h-40 animate-pulse" />
      ) : (
        <PageHeader
          title={trainerDisplayName}
          subtitle={`Personal Trainer · Detailed performance & earnings report`}
          icon={<Dumbbell className="h-6 w-6 text-white" />}
          stats={headerStats}
          actions={
            <button
              onClick={() => navigate('/reports/pt')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-sm font-medium transition-all border border-white/20"
            >
              <ArrowLeft className="h-4 w-4" />
              PT Report
            </button>
          }
        />
      )}

      {/* ── Member Breakdown ── */}
      <Card className="border shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b flex flex-wrap items-center gap-3">
          <Users className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-semibold text-sm">Member Breakdown</span>
          <span className="text-xs text-muted-foreground">{displayedRows.length} member{displayedRows.length !== 1 ? 's' : ''}</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search by phone, name, email"
              value={memberSearch}
              onChange={e => setMemberSearch(e.target.value)}
              className="h-8 w-64 text-xs"
            />
            <div className="relative">
              <select
                value={preset}
                onChange={e => handlePreset(e.target.value as Preset)}
                className="h-8 rounded-md border border-input bg-background px-3 pr-7 text-xs focus:outline-none appearance-none"
              >
                {PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
            </div>
            {preset === 'custom' && (
              <>
                <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-8 w-32 text-xs" />
                <span className="text-xs text-muted-foreground">→</span>
                <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-8 w-32 text-xs" />
              </>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <Th>Member</Th>
                <Th>Packages</Th>
                <Th>Amount Paid</Th>
                <Th>Amount Earned</Th>
                <Th>Charge / Session</Th>
                <Th>Sessions Sold</Th>
                <Th>Sessions Done</Th>
                <Th>Remaining</Th>
                <Th>Last Package</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && <SkeletonRows cols={9} />}
              {!isLoading && displayedRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-14 text-center text-sm text-muted-foreground">
                    {memberSearch ? 'No members match your search.' : 'No packages found for the selected date range.'}
                  </td>
                </tr>
              )}
              {!isLoading && displayedRows.map(row => {
                const perSession = row.sessionsSold > 0 ? row.totalPaid / row.sessionsSold : 0
                const pct = row.sessionsSold > 0 ? Math.round((row.sessionsUsed / row.sessionsSold) * 100) : 0
                const latestPkg = [...row.packages].sort((a, b) =>
                  new Date(b.purchased_at).getTime() - new Date(a.purchased_at).getTime())[0]
                return (
                  <tr key={row.memberId} className="hover:bg-muted/20 transition-colors">
                    <Td>
                      <p className="font-medium">{row.name}</p>
                      {row.email && <p className="text-xs text-muted-foreground mt-0.5">{row.email}</p>}
                    </Td>
                    <Td>
                      <div className="space-y-0.5">
                        {row.packages.map(pkg => (
                          <div key={pkg.id} className="text-xs text-muted-foreground">
                            {pkg.pt_package?.name ?? `#${pkg.pt_package_id}`}
                          </div>
                        ))}
                      </div>
                    </Td>
                    <Td><span className="font-semibold">{formatCurrency(row.totalPaid)}</span></Td>
                    <Td><span className="font-semibold text-emerald-700">{formatCurrency(row.totalEarned)}</span></Td>
                    <Td className="text-muted-foreground">{perSession > 0 ? formatCurrency(perSession) : '—'}</Td>
                    <Td>{row.sessionsSold}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <span className="text-green-700 font-medium">{row.sessionsUsed}</span>
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full ${pct >= 90 ? 'bg-red-400' : pct >= 70 ? 'bg-amber-400' : 'bg-primary'}`}
                            style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{pct}%</span>
                      </div>
                    </Td>
                    <Td><span className="text-amber-600 font-medium">{row.sessionsSold - row.sessionsUsed}</span></Td>
                    <Td className="text-muted-foreground whitespace-nowrap">{latestPkg ? formatDate(latestPkg.purchased_at) : '—'}</Td>
                  </tr>
                )
              })}
            </tbody>
            {!isLoading && displayedRows.length > 0 && (
              <tfoot>
                <tr className="bg-muted/40 border-t font-semibold text-sm">
                  <td className="px-4 py-2.5 text-xs uppercase tracking-wide text-muted-foreground">TOTAL</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{filteredPkgs.length} packages</td>
                  <td className="px-4 py-2.5">{formatCurrency(stats.totalRevenue)}</td>
                  <td className="px-4 py-2.5 text-emerald-700">{formatCurrency(displayedRows.reduce((s, r) => s + r.totalEarned, 0))}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">—</td>
                  <td className="px-4 py-2.5">{stats.totalSessions}</td>
                  <td className="px-4 py-2.5 text-green-700">{stats.sessionsUsed}</td>
                  <td className="px-4 py-2.5 text-amber-600">{stats.sessionsRemaining}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {/* ── Package Detail ── */}
      <Card className="border shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b flex flex-wrap items-center gap-3">
          <Dumbbell className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-semibold text-sm">All Packages</span>
          <span className="text-xs text-muted-foreground">{filteredPkgs.length} package{filteredPkgs.length !== 1 ? 's' : ''}</span>
          <div className="ml-auto">
            <Input
              placeholder="Search by phone, name, email"
              value={memberSearch}
              onChange={e => setMemberSearch(e.target.value)}
              className="h-8 w-64 text-xs"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <Th>Package</Th>
                <Th>Amount Paid</Th>
                <Th>Amount Earned</Th>
                <Th>Charge / Session</Th>
                <Th>Sessions</Th>
                <Th>Purchased</Th>
                <Th>Expires</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && <SkeletonRows cols={8} />}
              {!isLoading && filteredPkgs.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No packages in the selected period.
                  </td>
                </tr>
              )}
              {!isLoading && filteredPkgs
                .filter(p => {
                  const q = memberSearch.toLowerCase()
                  if (!q) return true
                  return memberName(p).toLowerCase().includes(q) || memberEmail(p).toLowerCase().includes(q)
                })
                .sort((a, b) => new Date(b.purchased_at).getTime() - new Date(a.purchased_at).getTime())
                .map(pkg => {
                  const isActive = pkg.is_active && new Date(pkg.expires_at) > new Date()
                  const isExpired = new Date(pkg.expires_at) < new Date()
                  const status = !pkg.is_active ? 'inactive' : isExpired ? 'expired' : 'active'
                  const perSession = pkg.total_sessions > 0 ? pkg.amount / pkg.total_sessions : 0
                  const fillPct = pkg.total_sessions > 0 ? Math.round((pkg.used_sessions / pkg.total_sessions) * 100) : 0
                  const dl = Math.ceil((new Date(pkg.expires_at).getTime() - Date.now()) / 86400000)
                  return (
                    <tr key={pkg.id} className="hover:bg-muted/20 transition-colors">
                      <Td>
                        {(() => {
                          const category = getPackageSplit(pkg.pt_package_id)?.category
                          const baseName = (pkg.pt_package?.name ?? `#${pkg.pt_package_id}`)
                            .replace(/\s*pack(age)?\s*/gi, '').trim()
                          const title = category ? `${baseName} - ${category}` : baseName
                          return (
                            <>
                              <p className="font-medium">{title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {pkg.pt_package?.sessions} sessions · {pkg.pt_package?.validity_days}d validity
                              </p>
                            </>
                          )
                        })()}
                      </Td>
                      <Td><span className="font-semibold">{formatCurrency(pkg.amount)}</span></Td>
                      <Td>
                        {(() => {
                          const split = getPackageSplit(pkg.pt_package_id)
                          const gymEarned = split ? (computeSplit(split).gymPct / 100) * pkg.amount : pkg.amount
                          return <span className="font-semibold text-emerald-700">{formatCurrency(gymEarned)}</span>
                        })()}
                      </Td>
                      <Td className="text-muted-foreground">{perSession > 0 ? formatCurrency(perSession) : '—'}</Td>
                      <Td>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-medium">{pkg.used_sessions} / {pkg.total_sessions}</span>
                          <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className={`h-full rounded-full ${fillPct >= 90 ? 'bg-red-400' : fillPct >= 70 ? 'bg-amber-400' : 'bg-primary'}`}
                              style={{ width: `${fillPct}%` }} />
                          </div>
                          <span className="text-[10px] text-muted-foreground">{pkg.total_sessions - pkg.used_sessions} left</span>
                        </div>
                      </Td>
                      <Td className="text-muted-foreground whitespace-nowrap">{formatDate(pkg.purchased_at)}</Td>
                      <Td className="whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {isActive && dl <= 7 && <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />}
                          <span className={isActive && dl <= 7 ? 'text-orange-600 font-medium' : 'text-muted-foreground'}>
                            {formatDate(pkg.expires_at)}
                          </span>
                        </div>
                        {isActive && (
                          <p className={`text-[10px] mt-0.5 ${dl <= 0 ? 'text-red-500' : dl <= 7 ? 'text-orange-500' : 'text-muted-foreground'}`}>
                            {dl <= 0 ? 'Expired' : `${dl}d left`}
                          </p>
                        )}
                      </Td>
                      <Td>
                        <StatusBadge status={status} />
                      </Td>
                    </tr>
                  )
                })
              }
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Commission & Payouts ── */}
      {staffId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Commission entries */}
          <Card className="border shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">Commission Entries</span>
              <span className="ml-auto text-xs text-muted-foreground">{commEntries.length} entries</span>
            </div>
            {commEntries.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">No commission entries in this period.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <Th>Date</Th>
                      <Th>Event</Th>
                      <Th>Base</Th>
                      <Th>Commission</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {commEntries.slice(0, 20).map(e => (
                      <tr key={e.id} className="hover:bg-muted/20 transition-colors">
                        <Td className="text-muted-foreground whitespace-nowrap">{formatDate(e.created_at)}</Td>
                        <Td className="capitalize text-muted-foreground">{e.event_type.replace(/_/g, ' ')}</Td>
                        <Td>{formatCurrency(e.base_amt_paise / 100)}</Td>
                        <Td><span className="font-semibold">{formatCurrency(e.comm_paise / 100)}</span></Td>
                        <Td><StatusBadge status={e.status} /></Td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/40 border-t font-semibold text-sm">
                      <td colSpan={3} className="px-4 py-2.5 text-xs uppercase tracking-wide text-muted-foreground">TOTAL EARNED</td>
                      <td className="px-4 py-2.5">{formatCurrency(stats.trainerEarned)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>

          {/* Payouts */}
          <Card className="border shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">Payouts to Trainer</span>
              <span className="ml-auto text-xs text-muted-foreground">{payouts.length} payouts</span>
            </div>
            {payouts.length === 0 ? (
              <div className="px-5 py-10 text-sm text-center text-muted-foreground">No payouts recorded in this period.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <Th>Period</Th>
                      <Th>Amount</Th>
                      <Th>Paid On</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {payouts.map(p => (
                      <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                        <Td className="text-muted-foreground whitespace-nowrap">
                          {formatDate(p.period_start)} → {formatDate(p.period_end)}
                        </Td>
                        <Td><span className="font-semibold">{formatCurrency(p.total_paise / 100)}</span></Td>
                        <Td className="text-muted-foreground">{p.paid_at ? formatDate(p.paid_at) : '—'}</Td>
                        <Td><StatusBadge status={p.status} /></Td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/40 border-t font-semibold text-sm">
                      <td className="px-4 py-2.5 text-xs uppercase tracking-wide text-muted-foreground">TOTAL PAID OUT</td>
                      <td className="px-4 py-2.5">{formatCurrency(stats.totalPaidOut)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            {/* Due summary */}
            {stats.trainerDue > 0 && (
              <div className="px-5 py-3 border-t bg-amber-50 flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span className="text-amber-700">
                  <span className="font-semibold">{formatCurrency(stats.trainerDue)}</span> pending — due to trainer from approved commissions
                </span>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
