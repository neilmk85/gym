import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { subscriptionsApi, type MembershipTransfer } from '@/api/subscriptions.api'
import { membersApi } from '@/api/members.api'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import {
  ArrowLeft, Search, ChevronRight, CheckCircle2,
  ArrowRight, Calendar, CalendarDays, User, Repeat,
  AlertTriangle, Info, History,
} from 'lucide-react'
import type { Member } from '@/types/member.types'
import type { Subscription } from '@/types/subscription.types'

function MemberAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  const cls = size === 'lg' ? 'h-12 w-12 text-base' : size === 'sm' ? 'h-7 w-7 text-[10px]' : 'h-9 w-9 text-xs'
  return (
    <div className={`${cls} rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shrink-0`}>
      {initials}
    </div>
  )
}

function daysRemaining(end: string) {
  return Math.max(0, Math.ceil((new Date(end).getTime() - Date.now()) / 86400000))
}

function addMonths(date: Date, months: number) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

function toISO(d: Date) { return d.toISOString().slice(0, 10) }

export default function MembershipTransferPage() {
  const navigate = useNavigate()

  // Step 1 — source member
  const [srcSearch, setSrcSearch]           = useState('')
  const [srcMember, setSrcMember]           = useState<Member | null>(null)
  const [srcSub, setSrcSub]                 = useState<Subscription | null>(null)

  // Step 2 — transfer config
  const [monthsToTransfer, setMonths]       = useState(1)
  const [transferStart, setTransferStart]   = useState(toISO(new Date()))

  // Step 3 — target member
  const [tgtSearch, setTgtSearch]           = useState('')
  const [tgtMember, setTgtMember]           = useState<Member | null>(null)

  // Step 4 — reason
  const [reason, setReason]                 = useState('')

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: srcMembersData } = useQuery({
    queryKey: ['transfer-src-search', srcSearch],
    queryFn: () => membersApi.list({ search: srcSearch, per_page: 8 }),
    enabled: !srcMember && srcSearch.length > 0,
  })
  const srcMembers: Member[] = (srcMembersData as any)?.members ?? []

  const { data: srcSubsData, isLoading: loadingSubs } = useQuery({
    queryKey: ['transfer-src-subs', srcMember?.id],
    queryFn: () => subscriptionsApi.getByMember(srcMember!.id),
    enabled: !!srcMember,
  })
  const srcSubs: Subscription[] = (srcSubsData as any)?.subscriptions ?? []
  const activeSubs = srcSubs.filter(s => s.status === 'active' || s.status === 'paused')

  const { data: tgtMembersData } = useQuery({
    queryKey: ['transfer-tgt-search', tgtSearch],
    queryFn: () => membersApi.list({ search: tgtSearch, per_page: 8 }),
    enabled: !tgtMember && tgtSearch.length > 0,
  })
  const tgtMembers: Member[] = (tgtMembersData as any)?.members ?? []

  // ── Derived calculations ──────────────────────────────────────────────────
  const transferEnd = useMemo(() => {
    if (!transferStart) return ''
    return toISO(addMonths(new Date(transferStart), monthsToTransfer))
  }, [transferStart, monthsToTransfer])

  const srcRemainingDays  = srcSub ? daysRemaining(srcSub.end_date) : 0
  const srcRemainingMonths = srcSub
    ? Math.max(0, Math.floor(
        (new Date(srcSub.end_date).getTime() - new Date(transferStart).getTime()) / (86400000 * 30)
      ))
    : 0

  // Old member's membership will effectively end at transferStart
  const srcNewEndDate = transferStart

  const canTransfer = !!srcSub && !!tgtMember && monthsToTransfer >= 1 && !!transferStart && !!reason && tgtMember.id !== srcMember?.id

  // ── Mutation ──────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: () => subscriptionsApi.transfer(srcSub!.id, {
      target_member_id:   tgtMember!.id,
      months_to_transfer: monthsToTransfer,
      transfer_start_date: transferStart,
      transfer_end_date:   transferEnd,
      reason,
    }),
    onSuccess: () => {
      toast.success('Membership transferred successfully')
      navigate('/memberships')
    },
    onError: (e: any) => toast.error(e?.message ?? 'Transfer failed'),
  })

  // ── Steps indicator ───────────────────────────────────────────────────────
  const steps = [
    { label: 'Source Member', done: !!srcSub },
    { label: 'Transfer Period', done: !!srcSub && monthsToTransfer >= 1 && !!transferStart },
    { label: 'Target Member', done: !!tgtMember },
    { label: 'Confirm', done: canTransfer },
  ]

  return (
    <div className="min-h-screen bg-gray-50/60">

      {/* Top bar */}
      <div className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/memberships')}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center">
                <Repeat className="h-4 w-4 text-white" />
              </div>
              <span className="font-semibold text-sm">Transfer Membership</span>
            </div>
          </div>

          {/* Step progress */}
          <div className="hidden sm:flex items-center gap-1.5">
            {steps.map((step, i) => (
              <div key={step.label} className="flex items-center gap-1.5">
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  step.done ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'
                }`}>
                  {step.done
                    ? <CheckCircle2 className="h-3.5 w-3.5" />
                    : <span className="h-3.5 w-3.5 rounded-full border-2 border-current flex items-center justify-center text-[9px] font-bold">{i+1}</span>
                  }
                  {step.label}
                </div>
                {i < steps.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-gray-300" />}
              </div>
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={() => navigate('/memberships')}>Cancel</Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 items-start">

        {/* ── Left column ── */}
        <div className="space-y-5">

          {/* ① Source member */}
          <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b bg-gray-50/70 flex items-center gap-2">
              <div className="h-6 w-6 rounded-md bg-indigo-100 flex items-center justify-center">
                <User className="h-3.5 w-3.5 text-indigo-600" />
              </div>
              <span className="text-sm font-semibold">Step 1 — From Member</span>
              {srcSub && <CheckCircle2 className="h-4 w-4 text-emerald-500 ml-auto" />}
            </div>
            <div className="p-5 space-y-4">
              {/* Member search */}
              {!srcMember ? (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search member by name or email…" value={srcSearch}
                      onChange={e => setSrcSearch(e.target.value)} className="pl-9" autoFocus />
                  </div>
                  {srcMembers.length > 0 && (
                    <div className="border rounded-xl divide-y overflow-hidden">
                      {srcMembers.map(m => (
                        <button key={m.id} onClick={() => { setSrcMember(m); setSrcSub(null) }}
                          className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-indigo-50 transition-colors group">
                          <MemberAvatar name={`${m.user.first_name} ${m.user.last_name}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{m.user.first_name} {m.user.last_name}</p>
                            <p className="text-xs text-muted-foreground truncate">{m.user.email}</p>
                          </div>
                          <span className="text-xs text-muted-foreground font-mono">{m.member_code}</span>
                          <ChevronRight className="h-4 w-4 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-indigo-50 border border-indigo-100">
                  <MemberAvatar name={`${srcMember.user.first_name} ${srcMember.user.last_name}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{srcMember.user.first_name} {srcMember.user.last_name}</p>
                    <p className="text-xs text-muted-foreground">{srcMember.user.email}</p>
                    <span className="inline-block mt-0.5 text-[10px] px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-medium">
                      {srcMember.member_code}
                    </span>
                  </div>
                  <button onClick={() => { setSrcMember(null); setSrcSub(null); setSrcSearch('') }}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium shrink-0">Change</button>
                </div>
              )}

              {/* Active memberships */}
              {srcMember && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Active Memberships
                  </p>
                  {loadingSubs ? (
                    <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />)}</div>
                  ) : activeSubs.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                      This member has no active memberships to transfer.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {activeSubs.map(sub => {
                        const days = daysRemaining(sub.end_date)
                        const selected = srcSub?.id === sub.id
                        return (
                          <button key={sub.id} onClick={() => setSrcSub(selected ? null : sub)}
                            className={`w-full text-left rounded-xl border p-4 transition-all ${
                              selected ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                            }`}>
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-semibold text-sm">{sub.plan?.name ?? `Plan #${sub.plan_id}`}</p>
                                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(sub.start_date)}</span>
                                  <ArrowRight className="h-3 w-3" />
                                  <span>{formatDate(sub.end_date)}</span>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className={`text-lg font-bold ${days <= 30 ? 'text-amber-600' : 'text-indigo-600'}`}>{days}</p>
                                <p className="text-[10px] text-muted-foreground">days left</p>
                              </div>
                              {selected && <CheckCircle2 className="h-5 w-5 text-indigo-600 shrink-0" />}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* ② Transfer period */}
          {srcSub && (
            <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b bg-gray-50/70 flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-sky-100 flex items-center justify-center">
                  <CalendarDays className="h-3.5 w-3.5 text-sky-600" />
                </div>
                <span className="text-sm font-semibold">Step 2 — Transfer Period</span>
              </div>
              <div className="p-5 space-y-5">

                {/* Remaining info */}
                <div className="bg-sky-50 border border-sky-100 rounded-xl p-4 flex items-start gap-3">
                  <Info className="h-4 w-4 text-sky-600 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-sky-800">Remaining on this membership</p>
                    <p className="text-sky-700 mt-0.5">
                      {srcRemainingDays} days remaining · ends {formatDate(srcSub.end_date)}
                    </p>
                  </div>
                </div>

                {/* Months to transfer */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Months to Transfer
                  </label>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setMonths(m => Math.max(1, m-1))}
                      className="h-9 w-9 rounded-lg border flex items-center justify-center text-lg font-bold hover:bg-gray-50 transition-colors">−</button>
                    <div className="flex-1 text-center">
                      <span className="text-3xl font-bold text-indigo-700">{monthsToTransfer}</span>
                      <span className="text-sm text-muted-foreground ml-1">month{monthsToTransfer !== 1 ? 's' : ''}</span>
                    </div>
                    <button onClick={() => setMonths(m => Math.min(srcRemainingMonths || 24, m+1))}
                      className="h-9 w-9 rounded-lg border flex items-center justify-center text-lg font-bold hover:bg-gray-50 transition-colors">+</button>
                  </div>
                  {srcRemainingMonths > 0 && (
                    <div className="flex gap-2 flex-wrap pt-1">
                      {[1, 2, 3, srcRemainingMonths].filter((v, i, a) => a.indexOf(v) === i && v <= srcRemainingMonths).map(m => (
                        <button key={m} onClick={() => setMonths(m)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                            monthsToTransfer === m ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-indigo-50'
                          }`}>
                          {m === srcRemainingMonths ? `All (${m}mo)` : `${m}mo`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Transfer Start Date (new member)
                    </label>
                    <Input type="date" value={transferStart}
                      min={toISO(new Date())}
                      max={srcSub.end_date}
                      onChange={e => setTransferStart(e.target.value)}
                      className="h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Transfer End Date (auto-calculated)
                    </label>
                    <div className="h-10 rounded-md border bg-gray-50 px-3 flex items-center text-sm font-medium text-indigo-700">
                      {transferEnd ? formatDate(transferEnd) : '—'}
                    </div>
                  </div>
                </div>

                {/* What happens to old member */}
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold text-amber-800">Old member's membership</p>
                    <p className="text-amber-700 mt-0.5">
                      {srcMember?.user.first_name}'s membership will be stopped on <strong>{formatDate(srcNewEndDate)}</strong>.
                      Any remaining time after that date ({Math.max(0, srcRemainingMonths - monthsToTransfer)} months) will be forfeited
                      unless you also issue a credit note.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ③ Target member */}
          {srcSub && (
            <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b bg-gray-50/70 flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-emerald-100 flex items-center justify-center">
                  <User className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                <span className="text-sm font-semibold">Step 3 — To Member</span>
                {tgtMember && <CheckCircle2 className="h-4 w-4 text-emerald-500 ml-auto" />}
              </div>
              <div className="p-5">
                {!tgtMember ? (
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Search recipient member…" value={tgtSearch}
                        onChange={e => setTgtSearch(e.target.value)} className="pl-9" />
                    </div>
                    {tgtMembers.length > 0 && (
                      <div className="border rounded-xl divide-y overflow-hidden">
                        {tgtMembers.map(m => {
                          const isSame = m.id === srcMember?.id
                          return (
                            <button key={m.id} onClick={() => !isSame && setTgtMember(m)} disabled={isSame}
                              className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors group ${isSame ? 'opacity-40 cursor-not-allowed' : 'hover:bg-emerald-50'}`}>
                              <MemberAvatar name={`${m.user.first_name} ${m.user.last_name}`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{m.user.first_name} {m.user.last_name}</p>
                                <p className="text-xs text-muted-foreground truncate">{m.user.email}</p>
                              </div>
                              {isSame
                                ? <span className="text-xs text-muted-foreground">Same member</span>
                                : <ChevronRight className="h-4 w-4 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                              }
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                    <MemberAvatar name={`${tgtMember.user.first_name} ${tgtMember.user.last_name}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{tgtMember.user.first_name} {tgtMember.user.last_name}</p>
                      <p className="text-xs text-muted-foreground">{tgtMember.user.email}</p>
                      <span className="inline-block mt-0.5 text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium">
                        {tgtMember.member_code}
                      </span>
                    </div>
                    <button onClick={() => { setTgtMember(null); setTgtSearch('') }}
                      className="text-xs text-emerald-600 hover:text-emerald-800 font-medium shrink-0">Change</button>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ④ Reason */}
          {srcSub && tgtMember && (
            <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b bg-gray-50/70">
                <span className="text-sm font-semibold">Step 4 — Reason for Transfer</span>
              </div>
              <div className="p-5">
                <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
                  placeholder="e.g. Member relocated, gifting remaining months to family member…"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 resize-none" />
              </div>
            </section>
          )}
        </div>

        {/* ── Right column: Summary ── */}
        <div className="space-y-4 xl:sticky xl:top-[65px]">
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 bg-indigo-600 flex items-center gap-2">
              <Repeat className="h-4 w-4 text-white/80" />
              <span className="text-sm font-semibold text-white">Transfer Summary</span>
            </div>

            {/* From */}
            <div className="px-5 py-4 border-b">
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide font-medium">From</p>
              {srcMember ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <MemberAvatar name={`${srcMember.user.first_name} ${srcMember.user.last_name}`} size="sm" />
                    <span className="text-sm font-semibold">{srcMember.user.first_name} {srcMember.user.last_name}</span>
                  </div>
                  {srcSub && (
                    <div className="text-xs text-muted-foreground space-y-1 pl-9">
                      <p>{srcSub.plan?.name}</p>
                      <p>Ends: <span className="font-medium text-amber-600">{formatDate(srcNewEndDate)}</span> (stopped)</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">Not selected</p>
              )}
            </div>

            {/* Arrow */}
            <div className="flex justify-center py-2 border-b">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ArrowRight className="h-4 w-4 text-indigo-400" />
                <span>{monthsToTransfer} month{monthsToTransfer !== 1 ? 's' : ''} transferred</span>
              </div>
            </div>

            {/* To */}
            <div className="px-5 py-4 border-b">
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide font-medium">To</p>
              {tgtMember ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <MemberAvatar name={`${tgtMember.user.first_name} ${tgtMember.user.last_name}`} size="sm" />
                    <span className="text-sm font-semibold">{tgtMember.user.first_name} {tgtMember.user.last_name}</span>
                  </div>
                  {srcSub && transferStart && transferEnd && (
                    <div className="text-xs text-muted-foreground space-y-1 pl-9">
                      <p>{srcSub.plan?.name}</p>
                      <p>{formatDate(transferStart)} → <span className="font-medium text-emerald-600">{formatDate(transferEnd)}</span></p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">Not selected</p>
              )}
            </div>

            {/* Period detail */}
            {srcSub && transferStart && transferEnd && (
              <div className="px-5 py-4 border-b space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="font-medium">{srcSub.plan?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-medium">{monthsToTransfer} month{monthsToTransfer !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Start</span>
                  <span className="font-medium">{formatDate(transferStart)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">End</span>
                  <span className="font-medium text-emerald-600">{formatDate(transferEnd)}</span>
                </div>
              </div>
            )}

            <div className="px-5 py-4">
              {!canTransfer && (
                <p className="text-xs text-muted-foreground text-center mb-3">
                  {!srcSub ? 'Select a membership to transfer' :
                   !tgtMember ? 'Select the recipient member' :
                   !reason ? 'Enter a reason for the transfer' :
                   tgtMember?.id === srcMember?.id ? 'Source and target members must differ' : ''}
                </p>
              )}
              <Button
                className="w-full h-11 font-semibold bg-indigo-600 hover:bg-indigo-700 text-white"
                disabled={!canTransfer || mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                <Repeat className="h-4 w-4" />
                {mutation.isPending ? 'Transferring…' : 'Confirm Transfer'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Transfer History ── */}
      <TransferHistory />
    </div>
  )
}

function TransferHistory() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['subscriptions', 'transfers'],
    queryFn: () => subscriptionsApi.listTransfers({ per_page: 50 }),
    retry: false,
  })

  const transfers: MembershipTransfer[] = (data as any)?.transfers ?? []

  return (
    <div className="max-w-6xl mx-auto px-6 pb-10">
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b bg-gray-50/70 flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-indigo-100 flex items-center justify-center">
            <History className="h-3.5 w-3.5 text-indigo-600" />
          </div>
          <span className="text-sm font-semibold">Transfer History</span>
          {transfers.length > 0 && (
            <span className="ml-1 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
              {transfers.length}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="divide-y">
            {[1,2,3].map(i => (
              <div key={i} className="px-5 py-4 flex items-center gap-4">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2"><Skeleton className="h-3 w-40" /><Skeleton className="h-3 w-56" /></div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            ))}
          </div>
        ) : isError || transfers.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Repeat className="h-8 w-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No transfers recorded yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Completed transfers will appear here.</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr] gap-4 px-5 py-2.5 bg-gray-50/50 border-b text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              <span>From Member</span>
              <span>To Member</span>
              <span>Plan</span>
              <span>Period</span>
              <span>Date</span>
            </div>
            <div className="divide-y">
              {transfers.map(t => (
                <div key={t.id} className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr] gap-4 px-5 py-3.5 items-center hover:bg-gray-50/50 transition-colors">
                  {/* From */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-7 w-7 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                      {t.source_member_name?.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.source_member_name || `Member #${t.source_member_id}`}</p>
                      <p className="text-xs text-muted-foreground">Sub #{t.source_subscription_id}</p>
                    </div>
                  </div>
                  {/* To */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ArrowRight className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                    <div className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                      {t.target_member_name?.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.target_member_name || `Member #${t.target_member_id}`}</p>
                      <p className="text-xs text-muted-foreground">Sub #{t.new_subscription_id}</p>
                    </div>
                  </div>
                  {/* Plan */}
                  <div>
                    <span className="text-sm font-medium">{t.plan_name}</span>
                    <p className="text-xs text-muted-foreground">{t.months_transferred}mo</p>
                  </div>
                  {/* Period */}
                  <div className="text-xs text-muted-foreground">
                    <p>{formatDate(t.transfer_start_date)}</p>
                    <p className="text-emerald-600 font-medium">{formatDate(t.transfer_end_date)}</p>
                  </div>
                  {/* Date */}
                  <div className="text-sm text-muted-foreground">{formatDate(t.created_at)}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
