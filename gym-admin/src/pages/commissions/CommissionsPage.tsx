import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { commissionApi } from '@/api/commission.api'
import { trainersApi } from '@/api/trainers.api'
import { ptApi } from '@/api/pt.api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  IndianRupee, Clock, BadgeCheck, Banknote, XCircle,
  TrendingUp, ListChecks, Wallet, ChevronRight, ArrowLeft,
  CheckCircle, Plus, Search, Users, Percent, Hash, Layers, Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { splitEventKey, computeSplit } from '@/lib/service-types'

const paise = (v: number) => v / 100

const EVENT_LABELS: Record<string, string> = {
  new_member:         'New Member Joined',
  membership_renewal: 'Membership Renewed',
  day_pass:           'Day Pass Issued',
  class_booking:      'Class Booked',
  personal_training:  'PT Session',
  referral:           'Member Referral',
}
const humanEvent = (k: string) => EVENT_LABELS[k] ?? k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

const STATUS_CFG: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
  pending:   { label: 'Awaiting Approval', cls: 'bg-yellow-50 text-yellow-800 border border-yellow-200', Icon: Clock },
  approved:  { label: 'Approved',          cls: 'bg-blue-50 text-blue-800 border border-blue-200',       Icon: BadgeCheck },
  paid:      { label: 'Paid Out',          cls: 'bg-green-50 text-green-800 border border-green-200',    Icon: Banknote },
  cancelled: { label: 'Cancelled',         cls: 'bg-gray-100 text-gray-500 border border-gray-200',      Icon: XCircle },
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_CFG[status] ?? STATUS_CFG.pending
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${c.cls}`}>
      <c.Icon className="w-3 h-3" />{c.label}
    </span>
  )
}

type View = 'list' | 'detail'
type DetailTab = 'earnings' | 'rules' | 'payouts'

const HOW_IT_WORKS = [
  { icon: <TrendingUp className="w-5 h-5 text-violet-600" />, bg: 'bg-violet-50', title: 'Activity happens', desc: 'A trainer brings in a new member, closes a renewal, or conducts a PT session.' },
  { icon: <BadgeCheck className="w-5 h-5 text-indigo-600" />, bg: 'bg-indigo-50', title: 'Entry recorded & reviewed', desc: 'A commission entry is auto-created. You review it and approve or cancel.' },
  { icon: <Banknote className="w-5 h-5 text-green-600" />,    bg: 'bg-green-50',  title: 'Batch payout & pay',       desc: 'Approved entries are grouped into a payout for a period, then marked paid.' },
]

export default function CommissionsPage() {
  const qc = useQueryClient()
  const [view, setView]           = useState<View>('list')
  const [search, setSearch]       = useState('')
  const [selectedTrainer, setSelectedTrainer] = useState<any>(null)
  const [tab, setTab]             = useState<DetailTab>('earnings')

  // PT packages from API — derive unique categories with gym% for the commission dropdown
  const { data: ptPackagesData } = useQuery({
    queryKey: ['pt-packages'],
    queryFn: () => ptApi.listPackages(),
  })

  const ptCategories = useMemo(() => {
    const packages = ptPackagesData?.pt_packages ?? []
    const seen = new Map<string, number>()
    packages.forEach((p: { category: string; gym_pct: number }) => {
      if (p.category && !seen.has(p.category)) seen.set(p.category, p.gym_pct ?? 60)
    })
    return Array.from(seen.entries()).map(([category, gymPct]) => ({ category, gymPct }))
  }, [ptPackagesData])

  // Add rule inline form
  const [showRuleForm, setShowRuleForm] = useState(false)
  const [ruleForm, setRuleForm] = useState({ event_type: 'new_member', rule_type: 'percentage' as 'percentage' | 'fixed', value: '', autoFilled: false })

  // Which PT category is currently selected (if any)
  const selectedPtCat = useMemo(() =>
    ptCategories.find(c => splitEventKey(c.category) === ruleForm.event_type),
    [ptCategories, ruleForm.event_type]
  )

  // Auto-fill trainer% when a PT category event is selected
  const handleEventTypeChange = (eventKey: string) => {
    const ptCat = ptCategories.find(c => splitEventKey(c.category) === eventKey)
    if (ptCat) {
      const { trainerPct } = computeSplit({ gymPct: ptCat.gymPct, category: ptCat.category })
      setRuleForm(f => ({ ...f, event_type: eventKey, rule_type: 'percentage', value: String(trainerPct), autoFilled: true }))
    } else {
      setRuleForm(f => ({ ...f, event_type: eventKey, autoFilled: false }))
    }
  }

  // Add payout inline form
  const [showPayoutForm, setShowPayoutForm] = useState(false)
  const [payoutForm, setPayoutForm] = useState({ period_start: '', period_end: '' })

  const { data: trainersData, isLoading: loadingTrainers } = useQuery({
    queryKey: ['trainers'],
    queryFn: () => trainersApi.list(),
  })
  const trainers: any[] = (trainersData as any)?.trainers ?? []
  const filtered = trainers.filter(t => {
    const name = `${t.user?.first_name ?? ''} ${t.user?.last_name ?? ''}`.trim().toLowerCase()
    return !search || name.includes(search.toLowerCase()) || (t.specialty ?? '').toLowerCase().includes(search.toLowerCase())
  })

  const sid = selectedTrainer?.user_id ?? null
  const trainerName = selectedTrainer ? `${selectedTrainer.user?.first_name ?? ''} ${selectedTrainer.user?.last_name ?? ''}`.trim() || 'Trainer' : ''

  const { data: rules = [] } = useQuery({
    queryKey: ['commission-rules', sid],
    queryFn: () => commissionApi.listRules(sid!),
    enabled: !!sid,
  })
  const { data: entriesData } = useQuery({
    queryKey: ['commission-entries', sid],
    queryFn: () => commissionApi.listEntries(sid!),
    enabled: !!sid,
  })
  const entries: any[] = (entriesData as any)?.data ?? []
  const { data: payoutsData } = useQuery({
    queryKey: ['commission-payouts', sid],
    queryFn: () => commissionApi.listPayouts(sid!),
    enabled: !!sid,
  })
  const payouts: any[] = (payoutsData as any)?.data ?? []

  const totalPending  = entries.filter(e => e.status === 'pending').reduce((s, e) => s + paise(e.comm_paise), 0)
  const totalApproved = entries.filter(e => e.status === 'approved').reduce((s, e) => s + paise(e.comm_paise), 0)
  const totalPaid     = payouts.filter(p => p.status === 'paid').reduce((s, p) => s + paise(p.total_paise), 0)

  const approveMutation = useMutation({
    mutationFn: (id: number) => commissionApi.approveEntry(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['commission-entries', sid] }); toast.success('Commission approved') },
    onError: () => toast.error('Failed to approve'),
  })
  const cancelMutation = useMutation({
    mutationFn: (id: number) => commissionApi.cancelEntry(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['commission-entries', sid] }); toast.success('Commission cancelled') },
    onError: () => toast.error('Failed to cancel'),
  })
  const addRuleMutation = useMutation({
    mutationFn: () => commissionApi.createRule({ staff_id: sid!, event_type: ruleForm.event_type, rule_type: ruleForm.rule_type, value: Number(ruleForm.value) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commission-rules', sid] })
      setShowRuleForm(false)
      setRuleForm({ event_type: 'new_member', rule_type: 'percentage', value: '', autoFilled: false })
      toast.success('Rule added')
    },
    onError: () => toast.error('Failed to add rule'),
  })
  const deleteRuleMutation = useMutation({
    mutationFn: (id: number) => commissionApi.deleteRule(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['commission-rules', sid] }); toast.success('Rule deleted') },
    onError: () => toast.error('Failed to delete'),
  })
  const createPayoutMutation = useMutation({
    mutationFn: () => commissionApi.createPayout(sid!, payoutForm.period_start, payoutForm.period_end),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commission-payouts', sid] })
      setShowPayoutForm(false)
      setPayoutForm({ period_start: '', period_end: '' })
      toast.success('Payout batch created')
    },
    onError: () => toast.error('Failed to create payout'),
  })
  const markPaidMutation = useMutation({
    mutationFn: (id: number) => commissionApi.markPayoutPaid(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['commission-payouts', sid] }); toast.success('Marked as paid') },
    onError: () => toast.error('Failed to update'),
  })

  const openTrainer = (t: any) => {
    setSelectedTrainer(t); setView('detail'); setTab('earnings')
    setShowRuleForm(false); setShowPayoutForm(false)
  }

  return (
    <div className="space-y-6">

      {/* ── Edge-to-edge header ───────────────────────────────────────── */}
      <div className="relative overflow-hidden -mx-6 -mt-6 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 px-6 py-6 text-white">
        <div className="relative">
          <div className="flex items-center gap-3 mb-1">
            <IndianRupee className="w-6 h-6 opacity-90" />
            <h1 className="text-xl font-bold">Commission Tracker</h1>
          </div>
          <p className="text-sm text-white/85 max-w-2xl">
            Track and pay commissions to your trainers and staff. Every sale or activity they drive earns them a commission — you review it, approve it, then pay it out in one batch.
          </p>
        </div>
        <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute -right-2 -bottom-8 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
      </div>

      {/* ── How it works (list view only) ────────────────────────────── */}
      {view === 'list' && (
        <div className="grid grid-cols-3 gap-3">
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

      {/* ── TRAINERS TABLE ───────────────────────────────────────────── */}
      {view === 'list' && (
        <Card className="shadow-lg shadow-gray-200/80 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b gap-4 bg-violet-50/60">
            <p className="font-medium text-sm text-violet-700 whitespace-nowrap flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              {loadingTrainers ? 'Loading…' : `${filtered.length} trainer${filtered.length !== 1 ? 's' : ''}`}
            </p>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-400" />
              <Input placeholder="Search trainers…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gradient-to-r from-violet-50 via-purple-50 to-indigo-50">
                  <th className="text-left px-4 py-3 font-semibold text-violet-700">Trainer</th>
                  <th className="text-left px-4 py-3 font-semibold text-violet-700">Specialty</th>
                  <th className="text-left px-4 py-3 font-semibold text-violet-700">Experience</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {loadingTrainers && (
                  <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">Loading trainers…</td></tr>
                )}
                {!loadingTrainers && filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-14 text-center">
                      <Users className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                      <p className="text-muted-foreground text-sm">No trainers found{search ? ` for "${search}"` : ''}.</p>
                    </td>
                  </tr>
                )}
                {filtered.map(t => {
                  const name = `${t.user?.first_name ?? ''} ${t.user?.last_name ?? ''}`.trim() || `Trainer #${t.user_id}`
                  return (
                    <tr key={t.user_id} className="hover:bg-violet-50/40 cursor-pointer transition-colors" onClick={() => openTrainer(t)}>
                      <td className="px-4 py-3">
                        <p className="font-medium">{name}</p>
                        <p className="text-xs text-muted-foreground">{t.user?.email ?? ''}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground capitalize">{t.specialty ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{t.experience_years ? `${t.experience_years} yr${t.experience_years !== 1 ? 's' : ''}` : '—'}</td>
                      <td className="px-4 py-3"><ChevronRight className="w-4 h-4 text-muted-foreground" /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── TRAINER DETAIL ───────────────────────────────────────────── */}
      {view === 'detail' && selectedTrainer && (
        <div className="space-y-5">

          {/* Back + trainer bar */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" title="Back to list" onClick={() => { setView('list'); setSelectedTrainer(null) }}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1 flex items-center justify-between bg-muted/40 border rounded-xl px-4 py-3">
              <div>
                <p className="font-semibold">{trainerName}</p>
                <p className="text-sm text-muted-foreground">{selectedTrainer.specialty ?? 'Trainer'}{selectedTrainer.experience_years ? ` · ${selectedTrainer.experience_years} yrs exp` : ''}</p>
              </div>
              <span className="text-xs bg-violet-100 text-violet-700 px-2.5 py-1 rounded-full font-medium">Staff</span>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 p-5 text-white shadow-md shadow-yellow-200">
              <div className="flex items-center gap-2 mb-3 opacity-90 text-sm font-medium"><Clock className="w-4 h-4" /> Pending Review</div>
              <p className="text-3xl font-bold">{formatCurrency(totalPending)}</p>
              <p className="text-xs opacity-80 mt-1">{entries.filter(e => e.status === 'pending').length} entries awaiting approval</p>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 p-5 text-white shadow-md shadow-blue-200">
              <div className="flex items-center gap-2 mb-3 opacity-90 text-sm font-medium"><BadgeCheck className="w-4 h-4" /> Approved</div>
              <p className="text-3xl font-bold">{formatCurrency(totalApproved)}</p>
              <p className="text-xs opacity-80 mt-1">{entries.filter(e => e.status === 'approved').length} entries ready to pay out</p>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 p-5 text-white shadow-md shadow-green-200">
              <div className="flex items-center gap-2 mb-3 opacity-90 text-sm font-medium"><Banknote className="w-4 h-4" /> Total Paid</div>
              <p className="text-3xl font-bold">{formatCurrency(totalPaid)}</p>
              <p className="text-xs opacity-80 mt-1">{payouts.filter(p => p.status === 'paid').length} payouts completed</p>
            </div>
          </div>

          {/* Detail tabs */}
          <div className="flex border-b">
            {([
              { key: 'earnings', label: 'Earnings',         icon: <TrendingUp className="w-4 h-4" /> },
              { key: 'rules',    label: 'Commission Rules',  icon: <ListChecks className="w-4 h-4" /> },
              { key: 'payouts',  label: 'Payouts',           icon: <Wallet className="w-4 h-4" /> },
            ] as { key: DetailTab; label: string; icon: React.ReactNode }[]).map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  tab === t.key ? 'border-violet-600 text-violet-700' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.icon}{t.label}
              </button>
            ))}
          </div>

          {/* ── Earnings ── */}
          {tab === 'earnings' && (
            <div className="space-y-3">
              <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 text-sm text-violet-700">
                Every commissionable activity <strong>{trainerName}</strong> performs creates an entry here. Review and approve or cancel each one.
              </div>
              {entries.length === 0 ? (
                <div className="text-center py-14 border rounded-xl text-muted-foreground">
                  <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p className="font-medium">No commission entries yet</p>
                  <p className="text-sm mt-1">Entries appear here when {trainerName} completes a commissionable activity.</p>
                </div>
              ) : (
                <Card className="shadow-lg shadow-gray-200/80 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gradient-to-r from-violet-50 via-purple-50 to-indigo-50">
                        <th className="text-left px-4 py-3 font-semibold text-violet-700">Activity</th>
                        <th className="text-left px-4 py-3 font-semibold text-violet-700">Date</th>
                        <th className="text-left px-4 py-3 font-semibold text-violet-700">Sale Value</th>
                        <th className="text-left px-4 py-3 font-semibold text-violet-700">Status</th>
                        <th className="text-right px-4 py-3 font-semibold text-violet-700">Commission</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {entries.map((e: any) => (
                        <tr key={e.id} className="hover:bg-muted/20">
                          <td className="px-4 py-3 font-medium">{humanEvent(e.event_type)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{formatDate(e.created_at)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{formatCurrency(paise(e.base_amt_paise))}</td>
                          <td className="px-4 py-3"><StatusBadge status={e.status} /></td>
                          <td className="px-4 py-3 text-right font-bold text-green-600">{formatCurrency(paise(e.comm_paise))}</td>
                          <td className="px-4 py-3">
                            {e.status === 'pending' && (
                              <div className="flex gap-1 justify-end">
                                <button onClick={() => approveMutation.mutate(e.id)} disabled={approveMutation.isPending}
                                  className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors">
                                  <CheckCircle className="w-3.5 h-3.5" /> Approve
                                </button>
                                <button onClick={() => cancelMutation.mutate(e.id)} disabled={cancelMutation.isPending}
                                  className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors">
                                  <XCircle className="w-3.5 h-3.5" /> Cancel
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              )}
            </div>
          )}

          {/* ── Rules ── */}
          {tab === 'rules' && (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 text-sm text-violet-700 flex-1">
                  Rules define how much commission <strong>{trainerName}</strong> earns per activity — e.g. "10% of sale for new member" or "₹200 flat for a PT session."
                </div>
                <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white shrink-0"
                  onClick={() => setShowRuleForm(v => !v)}>
                  <Plus className="w-4 h-4 mr-1" /> Add Rule
                </Button>
              </div>

              {/* Inline add-rule form */}
              {showRuleForm && (
                <Card className="border-violet-200 shadow-sm">
                  <div className="px-5 py-4 space-y-4">
                    <p className="font-semibold text-sm text-violet-700">New Commission Rule for {trainerName}</p>

                    <div className="grid grid-cols-3 gap-4">
                      {/* Event / Service Type */}
                      <div className="space-y-1.5">
                        <Label className="text-xs">Activity / Service Type</Label>
                        <select
                          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                          value={ruleForm.event_type}
                          onChange={e => handleEventTypeChange(e.target.value)}
                        >
                          <optgroup label="General Events">
                            {Object.entries(EVENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </optgroup>
                          {ptCategories.length > 0 && (
                            <optgroup label="PT Categories">
                              {ptCategories.map(c => (
                                <option key={c.category} value={splitEventKey(c.category)}>
                                  PT — {c.category}
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      </div>

                      {/* Rule type — locked to % for PT categories */}
                      <div className="space-y-1.5">
                        <Label className="text-xs">Type</Label>
                        <div className="flex gap-2">
                          {(['percentage', 'fixed'] as const).map(t => (
                            <button key={t}
                              onClick={() => !selectedPtCat && setRuleForm(f => ({ ...f, rule_type: t, autoFilled: false }))}
                              disabled={!!selectedPtCat && t !== 'percentage'}
                              className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-md border text-xs font-medium transition-colors ${
                                ruleForm.rule_type === t ? 'bg-violet-600 text-white border-violet-600' : 'bg-background border-input hover:bg-muted'
                              } disabled:opacity-40 disabled:cursor-not-allowed`}>
                              {t === 'percentage' ? <><Percent className="w-3.5 h-3.5" /> %</> : <><Hash className="w-3.5 h-3.5" /> Fixed</>}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Value — auto-filled from service type */}
                      <div className="space-y-1.5">
                        <Label className="text-xs flex items-center gap-1.5">
                          {ruleForm.rule_type === 'percentage' ? 'Trainer Earns (%)' : 'Amount (₹)'}
                          {ruleForm.autoFilled && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 font-semibold">
                              <Sparkles className="w-3 h-3" /> auto-filled
                            </span>
                          )}
                        </Label>
                        <Input
                          type="number" min={0} max={ruleForm.rule_type === 'percentage' ? 100 : undefined}
                          placeholder={ruleForm.rule_type === 'percentage' ? 'e.g. 40' : 'e.g. 200'}
                          value={ruleForm.value}
                          onChange={e => setRuleForm(f => ({ ...f, value: e.target.value, autoFilled: false }))}
                        />
                      </div>
                    </div>

                    {/* PT split preview card */}
                    {selectedPtCat && ruleForm.value && (
                      <div className="rounded-xl p-4 space-y-3 bg-violet-50 border border-violet-100">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 shrink-0 text-violet-600" />
                          <p className="text-xs font-semibold text-violet-700">
                            Revenue split — {selectedPtCat.category}
                          </p>
                          {ruleForm.autoFilled && (
                            <span className="ml-auto text-[10px] text-muted-foreground">from package config</span>
                          )}
                        </div>
                        <div>
                          <div className="w-full h-2 rounded-full overflow-hidden bg-muted flex">
                            <div className="h-full bg-violet-500 rounded-full" style={{ width: `${100 - Number(ruleForm.value)}%` }} />
                          </div>
                          <div className="flex justify-between text-[10px] font-medium mt-1">
                            <span className="text-violet-600">Gym {100 - Number(ruleForm.value)}%</span>
                            <span className="text-muted-foreground">Trainer {Number(ruleForm.value)}%</span>
                          </div>
                        </div>
                        <div className="flex gap-3 text-xs">
                          <div className="flex-1 rounded-lg p-2.5 bg-violet-600 text-white text-center">
                            <p className="font-bold">₹{(10000 * (100 - Number(ruleForm.value)) / 100).toLocaleString('en-IN')}</p>
                            <p className="opacity-80 mt-0.5">Gym earns</p>
                          </div>
                          <div className="flex-1 rounded-lg p-2.5 bg-muted text-center">
                            <p className="font-bold text-foreground">₹{(10000 * Number(ruleForm.value) / 100).toLocaleString('en-IN')}</p>
                            <p className="text-muted-foreground mt-0.5">Trainer earns</p>
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground">Preview based on ₹10,000 PT sale.</p>
                      </div>
                    )}

                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => setShowRuleForm(false)}>Cancel</Button>
                      <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white"
                        onClick={() => addRuleMutation.mutate()}
                        disabled={addRuleMutation.isPending || !ruleForm.value}>
                        {addRuleMutation.isPending ? 'Saving…' : 'Save Rule'}
                      </Button>
                    </div>
                  </div>
                </Card>
              )}

              {(rules as any[]).length === 0 && !showRuleForm ? (
                <div className="text-center py-14 border rounded-xl text-muted-foreground">
                  <ListChecks className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p className="font-medium">No rules set up yet</p>
                  <p className="text-sm mt-1">Click "Add Rule" to define how {trainerName} earns commission.</p>
                </div>
              ) : (
                <Card className="shadow-lg shadow-gray-200/80 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gradient-to-r from-violet-50 via-purple-50 to-indigo-50">
                        <th className="text-left px-4 py-3 font-semibold text-violet-700">Activity</th>
                        <th className="text-left px-4 py-3 font-semibold text-violet-700">Type</th>
                        <th className="text-left px-4 py-3 font-semibold text-violet-700">Rate</th>
                        <th className="text-left px-4 py-3 font-semibold text-violet-700">Status</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(rules as any[]).map((r: any) => (
                        <tr key={r.id} className="hover:bg-muted/20">
                          <td className="px-4 py-3 font-medium">{humanEvent(r.event_type)}</td>
                          <td className="px-4 py-3 text-muted-foreground capitalize">{r.rule_type}</td>
                          <td className="px-4 py-3 font-bold text-violet-700">
                            {r.rule_type === 'percentage' ? `${r.value}%` : formatCurrency(r.value)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.is_active ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                              {r.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => deleteRuleMutation.mutate(r.id)} disabled={deleteRuleMutation.isPending}
                              className="text-xs text-red-500 hover:text-red-700 transition-colors">Remove</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              )}
            </div>
          )}

          {/* ── Payouts ── */}
          {tab === 'payouts' && (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 text-sm text-violet-700 flex-1">
                  A <strong>payout</strong> bundles all approved commissions for a date range into one payment record. Create a payout, then mark it paid once you've transferred the money.
                </div>
                <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white shrink-0"
                  onClick={() => setShowPayoutForm(v => !v)}>
                  <Plus className="w-4 h-4 mr-1" /> Create Payout
                </Button>
              </div>

              {/* Inline payout form */}
              {showPayoutForm && (
                <Card className="border-violet-200 shadow-sm">
                  <div className="px-5 py-4 space-y-4">
                    <p className="font-semibold text-sm text-violet-700">New Payout Batch</p>
                    <p className="text-xs text-muted-foreground">All <strong>approved</strong> entries for {trainerName} within this period will be grouped into one payout.</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Period Start</Label>
                        <Input type="date" value={payoutForm.period_start} onChange={e => setPayoutForm(f => ({ ...f, period_start: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Period End</Label>
                        <Input type="date" value={payoutForm.period_end} onChange={e => setPayoutForm(f => ({ ...f, period_end: e.target.value }))} />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => setShowPayoutForm(false)}>Cancel</Button>
                      <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white"
                        onClick={() => createPayoutMutation.mutate()}
                        disabled={createPayoutMutation.isPending || !payoutForm.period_start || !payoutForm.period_end}>
                        {createPayoutMutation.isPending ? 'Creating…' : 'Create Payout Batch'}
                      </Button>
                    </div>
                  </div>
                </Card>
              )}

              {payouts.length === 0 && !showPayoutForm ? (
                <div className="text-center py-14 border rounded-xl text-muted-foreground">
                  <Wallet className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p className="font-medium">No payouts yet</p>
                  <p className="text-sm mt-1">Once you approve earnings, create a payout to record the payment.</p>
                </div>
              ) : (
                <Card className="shadow-lg shadow-gray-200/80 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gradient-to-r from-violet-50 via-purple-50 to-indigo-50">
                        <th className="text-left px-4 py-3 font-semibold text-violet-700">Period</th>
                        <th className="text-left px-4 py-3 font-semibold text-violet-700">Status</th>
                        <th className="text-left px-4 py-3 font-semibold text-violet-700">Paid On</th>
                        <th className="text-right px-4 py-3 font-semibold text-violet-700">Total</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {payouts.map((p: any) => (
                        <tr key={p.id} className="hover:bg-muted/20">
                          <td className="px-4 py-3 font-medium">{formatDate(p.period_start)} — {formatDate(p.period_end)}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.status === 'paid' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'}`}>
                              {p.status === 'paid' ? '✓ Paid' : 'Pending Payment'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{p.paid_at ? formatDate(p.paid_at) : '—'}</td>
                          <td className="px-4 py-3 text-right font-bold text-lg">{formatCurrency(paise(p.total_paise))}</td>
                          <td className="px-4 py-3 text-right">
                            {p.status === 'pending' && (
                              <Button size="sm" onClick={() => markPaidMutation.mutate(p.id)} disabled={markPaidMutation.isPending}
                                className="bg-green-600 hover:bg-green-700 text-white text-xs">
                                Mark as Paid
                              </Button>
                            )}
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
    </div>
  )
}
