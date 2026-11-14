import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { loyaltyApi } from '@/api/loyalty.api'
import type { LoyaltyConfig } from '@/api/loyalty.api'
import { membersApi } from '@/api/members.api'
import type { Member } from '@/types/member.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SearchInput } from '@/components/shared/SearchInput'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Star, Gift, TrendingUp, ArrowUpRight, ArrowDownRight,
  Copy, ArrowLeft, Users, Info, ChevronRight,
  Coins, UserPlus, ShoppingBag, Award, Settings, Save,
  RefreshCw, IndianRupee
} from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'

// ── how-it-works steps ─────────────────────────────────────────────────────
const HOW_IT_WORKS = [
  {
    icon: <UserPlus className="w-5 h-5 text-teal-600" />,
    bg: 'bg-teal-50',
    title: 'Member joins or renews',
    desc: 'Points are automatically credited when a member buys or renews a membership plan.',
  },
  {
    icon: <Star className="w-5 h-5 text-cyan-500" />,
    bg: 'bg-cyan-50',
    title: 'Points keep accumulating',
    desc: 'Every eligible action — renewal, referral, attendance milestones — adds to their balance.',
  },
  {
    icon: <Gift className="w-5 h-5 text-purple-600" />,
    bg: 'bg-purple-50',
    title: 'Refer a friend → bonus points',
    desc: 'Each member gets a unique referral code. When a friend joins using that code, the member earns extra points.',
  },
  {
    icon: <ShoppingBag className="w-5 h-5 text-green-600" />,
    bg: 'bg-green-50',
    title: 'Redeem anytime',
    desc: 'Points can be redeemed for a discount on the next renewal, merchandise, or any benefit you offer.',
  },
]

const TX_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  earned:   { icon: <ArrowUpRight className="w-4 h-4" />,   color: 'text-green-600 bg-green-50',  label: 'Points Earned'   },
  redeemed: { icon: <ArrowDownRight className="w-4 h-4" />, color: 'text-red-600 bg-red-50',      label: 'Points Used'     },
  expired:  { icon: <ArrowDownRight className="w-4 h-4" />, color: 'text-gray-500 bg-gray-50',    label: 'Points Expired'  },
  adjusted: { icon: <TrendingUp className="w-4 h-4" />,     color: 'text-blue-600 bg-blue-50',    label: 'Manual Adjust'   },
}

const REF_STATUS: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-700',
  converted: 'bg-green-100 text-green-700',
  expired:   'bg-gray-100 text-gray-500',
}

const MEMBER_STATUS_COLORS: Record<string, string> = {
  active:    'bg-green-100 text-green-700',
  frozen:    'bg-blue-100 text-blue-700',
  expired:   'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-600',
  pending:   'bg-yellow-100 text-yellow-700',
  paused:    'bg-orange-100 text-orange-700',
}

type View      = 'list' | 'detail'
type DetailTab = 'overview' | 'history' | 'referrals'
type PageTab   = 'members' | 'settings'

// ── Settings form ──────────────────────────────────────────────────────────
function SettingsTab() {
  const qc = useQueryClient()
  const { data: config, isLoading } = useQuery({
    queryKey: ['loyalty-config'],
    queryFn: () => loyaltyApi.getConfig(),
  })

  const [form, setForm] = useState<Partial<LoyaltyConfig>>({})

  const current = { ...config, ...form } as LoyaltyConfig

  const saveMutation = useMutation({
    mutationFn: () => loyaltyApi.updateConfig({
      points_on_new_membership: current.points_on_new_membership,
      points_on_renewal:        current.points_on_renewal,
      points_on_referral:       current.points_on_referral,
      points_on_day_pass:       current.points_on_day_pass,
      points_on_pt_session:     current.points_on_pt_session,
      points_per_rupee:         current.points_per_rupee,
      min_redeem_points:        current.min_redeem_points,
      max_redeem_per_tx:        current.max_redeem_per_tx,
      is_active:                current.is_active ?? true,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty-config'] })
      setForm({})
      toast.success('Loyalty settings saved')
    },
    onError: () => toast.error('Failed to save settings'),
  })

  const n = (key: keyof LoyaltyConfig) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: Number(e.target.value) }))

  if (isLoading) return <div className="py-16 text-center text-muted-foreground">Loading settings…</div>

  const rupeeValue = current.points_per_rupee > 0
    ? `${current.points_per_rupee} points = ₹1`
    : '—'

  return (
    <div className="space-y-6">

      {/* Conversion summary banner */}
      <div className="bg-teal-50 border border-teal-200 rounded-xl px-5 py-4 flex items-start gap-3">
        <IndianRupee className="w-5 h-5 text-teal-600 mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold text-teal-700 text-sm">Current conversion rate</p>
          <p className="text-teal-600 text-sm">{rupeeValue} · minimum {current.min_redeem_points ?? 0} points to redeem · max {current.max_redeem_per_tx ?? 0} points per transaction</p>
        </div>
      </div>

      {/* Earning rules */}
      <Card className="shadow-lg shadow-gray-200/80 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b bg-gradient-to-r from-teal-50 via-cyan-50 to-sky-50">
          <p className="font-semibold text-teal-700 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Earning Rules — Points credited per activity
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Set how many points a member earns for each action</p>
        </div>
        <CardContent className="p-5">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            {([
              { label: 'New membership',  key: 'points_on_new_membership' as keyof LoyaltyConfig, icon: <UserPlus className="w-4 h-4 text-teal-500" />,  hint: 'Points when a member joins' },
              { label: 'Membership renewal', key: 'points_on_renewal' as keyof LoyaltyConfig,    icon: <RefreshCw className="w-4 h-4 text-cyan-500" />,  hint: 'Points on each renewal' },
              { label: 'Referral conversion', key: 'points_on_referral' as keyof LoyaltyConfig,  icon: <Users className="w-4 h-4 text-sky-500" />,       hint: 'Points when referral converts' },
              { label: 'Day pass',          key: 'points_on_day_pass' as keyof LoyaltyConfig,    icon: <Star className="w-4 h-4 text-[#00B4D8]" />,     hint: 'Points for a single day pass' },
              { label: 'PT session',        key: 'points_on_pt_session' as keyof LoyaltyConfig,  icon: <Award className="w-4 h-4 text-purple-500" />,    hint: 'Points per PT session' },
            ]).map(({ label, key, icon, hint }) => (
              <div key={key} className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs font-medium">
                  {icon} {label}
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={form[key] !== undefined ? form[key] as number : (config?.[key] as number ?? '')}
                  onChange={n(key)}
                  className=""
                />
                <p className="text-xs text-muted-foreground">{hint}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Redemption rules */}
      <Card className="shadow-lg shadow-gray-200/80 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b bg-gradient-to-r from-teal-50 via-cyan-50 to-sky-50">
          <p className="font-semibold text-teal-700 flex items-center gap-2">
            <Coins className="w-4 h-4" /> Redemption Rules — How points are exchanged for value
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Control the conversion rate and limits when members cash in their points</p>
        </div>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-medium">
                <IndianRupee className="w-4 h-4 text-teal-500" /> Points per ₹1
              </Label>
              <Input
                type="number"
                min={1}
                value={form.points_per_rupee !== undefined ? form.points_per_rupee : (config?.points_per_rupee ?? '')}
                onChange={n('points_per_rupee')}
                />
              <p className="text-xs text-muted-foreground">How many points equal ₹1 in value (e.g. 10 means 100pts = ₹10)</p>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-medium">
                <Gift className="w-4 h-4 text-purple-500" /> Minimum to redeem
              </Label>
              <Input
                type="number"
                min={0}
                value={form.min_redeem_points !== undefined ? form.min_redeem_points : (config?.min_redeem_points ?? '')}
                onChange={n('min_redeem_points')}
                />
              <p className="text-xs text-muted-foreground">Minimum points a member must have before redeeming</p>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-medium">
                <ShoppingBag className="w-4 h-4 text-green-500" /> Max per transaction
              </Label>
              <Input
                type="number"
                min={0}
                value={form.max_redeem_per_tx !== undefined ? form.max_redeem_per_tx : (config?.max_redeem_per_tx ?? '')}
                onChange={n('max_redeem_per_tx')}
                />
              <p className="text-xs text-muted-foreground">Maximum points redeemable in a single transaction</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          className="bg-teal-600 hover:bg-teal-700 text-white px-8"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || Object.keys(form).length === 0}
        >
          <Save className="w-4 h-4 mr-2" />
          {saveMutation.isPending ? 'Saving…' : 'Save Settings'}
        </Button>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function LoyaltyPage() {
  const qc = useQueryClient()
  const [pageTab, setPageTab]   = useState<PageTab>('members')
  const [search, setSearch]     = useState('')
  const [member, setMember]     = useState<Member | null>(null)
  const [view, setView]         = useState<View>('list')
  const [tab, setTab]           = useState<DetailTab>('overview')
  const [redeemPoints, setRedeemPoints] = useState('')
  const [redeemDesc, setRedeemDesc]     = useState('')

  const { data: membersRaw, isLoading: loadingMembers } = useQuery({
    queryKey: ['members-loyalty', search],
    queryFn: () => membersApi.list({ search, per_page: 50 }),
  })
  const members: Member[] = (membersRaw as any)?.data ?? []

  const mid = member?.id ?? null

  const { data: account } = useQuery({
    queryKey: ['loyalty-account', mid],
    queryFn: () => loyaltyApi.getLoyaltyAccount(mid!),
    enabled: !!mid,
  })
  const { data: referralCode } = useQuery({
    queryKey: ['referral-code', mid],
    queryFn: () => loyaltyApi.getReferralCode(mid!),
    enabled: !!mid,
  })
  const { data: referrals = [] } = useQuery({
    queryKey: ['referrals', mid],
    queryFn: () => loyaltyApi.listReferrals(mid!),
    enabled: !!mid,
  })
  const { data: txData } = useQuery({
    queryKey: ['loyalty-tx', mid],
    queryFn: () => loyaltyApi.listTransactions(mid!),
    enabled: !!mid,
  })
  const transactions: any[] = (txData as any)?.data ?? []

  const redeemMutation = useMutation({
    mutationFn: () => loyaltyApi.redeemPoints(mid!, Number(redeemPoints), redeemDesc),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty-account', mid] })
      qc.invalidateQueries({ queryKey: ['loyalty-tx', mid] })
      setRedeemPoints(''); setRedeemDesc('')
      toast.success('Points redeemed successfully')
    },
    onError: () => toast.error('Failed to redeem points'),
  })

  const openMember = (m: Member) => {
    setMember(m); setView('detail'); setTab('overview')
    setRedeemPoints(''); setRedeemDesc('')
  }

  return (
    <div className="space-y-6">

      <PageHeader
        title="Loyalty & Referrals"
        subtitle="Reward members for staying loyal — earn points on every renewal and referral, redeem for discounts or benefits."
        icon={<Award className="h-5 w-5" />}
      />

      {/* ── Page-level tabs (Members / Settings) ────────────────────────── */}
      <div className="flex border-b border-border">
        {([
          { key: 'members',  label: 'Members',  icon: <Users className="w-4 h-4" /> },
          { key: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
        ] as { key: PageTab; label: string; icon: React.ReactNode }[]).map(t => (
          <button
            key={t.key}
            onClick={() => { setPageTab(t.key); if (t.key === 'members') { setView('list'); setMember(null) } }}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${
              pageTab === t.key
                ? 'border-[#00B4D8] text-[#007a99]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── Settings tab ───────────────────────────────────────────────── */}
      {pageTab === 'settings' && <SettingsTab />}

      {/* ── Members tab ────────────────────────────────────────────────── */}
      {pageTab === 'members' && (
        <>
          {/* How it works (shown only on list view) */}
          {view === 'list' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {HOW_IT_WORKS.map((step, i) => (
                <div key={i} className={`rounded-xl p-4 border ${step.bg}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 rounded-lg bg-white/70">{step.icon}</div>
                    <span className="text-xs font-bold text-muted-foreground">STEP {i + 1}</span>
                  </div>
                  <p className="font-semibold text-sm mb-1">{step.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          )}

          {view === 'list' ? (
            /* ── MEMBERS TABLE ───────────────────────────────────────────── */
            <Card className="shadow-lg shadow-gray-200/80 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b gap-4 bg-teal-50/60">
                <p className="font-medium text-sm text-teal-700 whitespace-nowrap flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  {loadingMembers ? 'Loading...' : `${members.length} member${members.length !== 1 ? 's' : ''}`}
                </p>
                <SearchInput
                  placeholder="Search by name or phone..."
                  value={search}
                  onChange={setSearch}
                  className="w-72"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-sidebar">
                    <tr>
                      <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Member</th>
                      <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Phone</th>
                      <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Member Since</th>
                      <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {loadingMembers && (
                      <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Loading members...</td></tr>
                    )}
                    {!loadingMembers && members.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-14 text-center">
                          <Users className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                          <p className="text-muted-foreground text-sm">No members found{search ? ` for "${search}"` : ''}.</p>
                        </td>
                      </tr>
                    )}
                    {members.map(m => (
                      <tr
                        key={m.id}
                        className="hover:bg-teal-50/40 cursor-pointer transition-colors"
                        onClick={() => openMember(m)}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium">{m.user.first_name} {m.user.last_name}</p>
                          <p className="text-xs text-muted-foreground">{m.member_code}</p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{m.user.phone ?? '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(m.joined_date)}</td>
                        <td className="px-4 py-3">
                          <Badge className={`text-xs capitalize ${MEMBER_STATUS_COLORS[m.membership_status] ?? 'bg-gray-100'}`}>
                            {m.membership_status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

          ) : member && (
            /* ── MEMBER DETAIL ───────────────────────────────────────────── */
            <div className="space-y-5">

              {/* Back + member bar */}
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" title="Back to list" onClick={() => { setView('list'); setMember(null) }}>
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div className="flex-1 flex items-center justify-between bg-muted/40 border rounded-xl px-4 py-3">
                  <div>
                    <p className="font-semibold">{member.user.first_name} {member.user.last_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {member.member_code}{member.user.phone ? ` · ${member.user.phone}` : ''}
                    </p>
                  </div>
                  <Badge className={`text-xs capitalize ${MEMBER_STATUS_COLORS[member.membership_status] ?? ''}`}>
                    {member.membership_status}
                  </Badge>
                </div>
              </div>

              {/* Points summary cards */}
              {account && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 p-5 text-white shadow-md shadow-teal-200">
                    <div className="flex items-center gap-2 mb-3 opacity-90 text-sm font-medium">
                      <Coins className="w-4 h-4" /> Current Balance
                    </div>
                    <p className="text-4xl font-bold">{account.balance}</p>
                    <p className="text-xs opacity-80 mt-1">points available to use</p>
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 p-5 text-white shadow-md shadow-green-200">
                    <div className="flex items-center gap-2 mb-3 opacity-90 text-sm font-medium">
                      <TrendingUp className="w-4 h-4" /> Total Earned
                    </div>
                    <p className="text-4xl font-bold">{account.total_earned}</p>
                    <p className="text-xs opacity-80 mt-1">all time</p>
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-purple-500 to-[#0096b4] p-5 text-white shadow-md shadow-purple-200">
                    <div className="flex items-center gap-2 mb-3 opacity-90 text-sm font-medium">
                      <Gift className="w-4 h-4" /> Total Redeemed
                    </div>
                    <p className="text-4xl font-bold">{account.total_redeemed}</p>
                    <p className="text-xs opacity-80 mt-1">all time</p>
                  </div>
                </div>
              )}

              {/* Detail tabs */}
              <div className="flex border-b">
                {([
                  { key: 'overview',  label: 'Overview & Redeem', icon: <Star className="w-4 h-4" /> },
                  { key: 'history',   label: 'Points History',    icon: <TrendingUp className="w-4 h-4" /> },
                  { key: 'referrals', label: 'Referrals',         icon: <UserPlus className="w-4 h-4" /> },
                ] as { key: DetailTab; label: string; icon: React.ReactNode }[]).map(t => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                      tab === t.key
                        ? 'border-teal-600 text-teal-700'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t.icon}{t.label}
                  </button>
                ))}
              </div>

              {/* Tab: Overview */}
              {tab === 'overview' && (
                <div className="grid md:grid-cols-2 gap-5">
                  <Card className="shadow-sm">
                    <CardContent className="p-5">
                      <p className="font-semibold text-sm mb-1 flex items-center gap-2">
                        <Gift className="w-4 h-4 text-purple-500" /> Referral Code
                      </p>
                      <p className="text-xs text-muted-foreground mb-4">
                        Share this code with friends. When they join the gym using this code, {member.user.first_name} earns bonus points.
                      </p>
                      {referralCode ? (
                        <div className="flex items-center gap-3 bg-muted/50 rounded-lg px-4 py-3">
                          <span className="text-2xl font-mono font-bold tracking-widest flex-1">{referralCode.code}</span>
                          <Button size="icon" variant="ghost" title="Copy referral code" onClick={() => { navigator.clipboard.writeText(referralCode.code); toast.success('Code copied!') }}>
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No referral code generated yet.</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm">
                    <CardContent className="p-5">
                      <p className="font-semibold text-sm mb-1 flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4 text-green-500" /> Redeem Points
                      </p>
                      <p className="text-xs text-muted-foreground mb-4">
                        Use this to apply a member's points as a discount on their next renewal or any other benefit.
                        Current balance: <span className="font-semibold text-teal-600">{account?.balance ?? 0} pts</span>
                      </p>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label>Points to redeem</Label>
                            <Input
                              type="number"
                              placeholder="e.g. 100"
                              value={redeemPoints}
                              max={account?.balance}
                              onChange={e => setRedeemPoints(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Reason / where used</Label>
                            <Input
                              placeholder="e.g. Membership renewal discount"
                              value={redeemDesc}
                              onChange={e => setRedeemDesc(e.target.value)}
                            />
                          </div>
                        </div>
                        {Number(redeemPoints) > (account?.balance ?? 0) && (
                          <p className="text-xs text-red-600 flex items-center gap-1">
                            <Info className="w-3 h-3" /> Cannot redeem more than the available balance.
                          </p>
                        )}
                        <Button
                          className="bg-teal-600 hover:bg-teal-700 text-white w-full"
                          onClick={() => redeemMutation.mutate()}
                          disabled={
                            redeemMutation.isPending ||
                            !redeemPoints ||
                            Number(redeemPoints) <= 0 ||
                            Number(redeemPoints) > (account?.balance ?? 0)
                          }
                        >
                          {redeemMutation.isPending ? 'Processing...' : 'Redeem Points'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Tab: History */}
              {tab === 'history' && (
                <div>
                  {transactions.length === 0 ? (
                    <div className="text-center py-12 border rounded-xl text-muted-foreground">
                      <Coins className="w-10 h-10 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">No point transactions yet.</p>
                      <p className="text-xs mt-1">Points will appear here once the member earns or redeems them.</p>
                    </div>
                  ) : (
                    <Card className="shadow-sm overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-sidebar">
                          <tr>
                            <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Type</th>
                            <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Description</th>
                            <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Date</th>
                            <th className="text-right px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Points</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {transactions.map((tx: any) => {
                            const txCfg = TX_CONFIG[tx.tx_type] ?? TX_CONFIG.adjusted
                            return (
                              <tr key={tx.id}>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${txCfg.color}`}>
                                    {txCfg.icon} {txCfg.label}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">{tx.description ?? '—'}</td>
                                <td className="px-4 py-3 text-muted-foreground">{formatDate(tx.created_at)}</td>
                                <td className={`px-4 py-3 text-right font-bold ${tx.points > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {tx.points > 0 ? '+' : ''}{tx.points}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </Card>
                  )}
                </div>
              )}

              {/* Tab: Referrals */}
              {tab === 'referrals' && (
                <div>
                  {(referrals as any[]).length === 0 ? (
                    <div className="text-center py-12 border rounded-xl text-muted-foreground">
                      <UserPlus className="w-10 h-10 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">No referrals yet.</p>
                      <p className="text-xs mt-1">When someone joins using {member.user.first_name}'s referral code, it shows up here.</p>
                    </div>
                  ) : (
                    <Card className="shadow-sm overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-sidebar">
                          <tr>
                            <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Referred Person</th>
                            <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Status</th>
                            <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Date</th>
                            <th className="text-right px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Reward Points</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {(referrals as any[]).map((ref: any) => (
                            <tr key={ref.id}>
                              <td className="px-4 py-3">{ref.referee_email ?? '—'}</td>
                              <td className="px-4 py-3">
                                <Badge className={`text-xs capitalize ${REF_STATUS[ref.status] ?? 'bg-gray-100 text-gray-600'}`}>
                                  {ref.status}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">{formatDate(ref.created_at)}</td>
                              <td className="px-4 py-3 text-right font-bold text-green-600">
                                {ref.reward_points > 0 ? `+${ref.reward_points}` : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Card>
                  )}
                </div>
              )}

            </div>
          )}
        </>
      )}
    </div>
  )
}
