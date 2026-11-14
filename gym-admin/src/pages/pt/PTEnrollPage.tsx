import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SearchInput } from '@/components/shared/SearchInput'
import { Button } from '@/components/ui/button'
import { ptApi } from '@/api/pt.api'
import { trainersApi } from '@/api/trainers.api'
import { membersApi } from '@/api/members.api'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Dumbbell, User, ChevronRight, Check,
  Trophy, Users, CalendarDays, IndianRupee, FileText, Layers,
} from 'lucide-react'
import type { Member } from '@/types/member.types'
import {
  loadPackageSplits, computeSplit, type PackageSplit, getPackageDuration,
} from '@/lib/service-types'

function memberFullName(m: Member) {
  return `${m.user.first_name} ${m.user.last_name}`.trim()
}

const PAY_LABELS: Record<string, string> = {
  cash: 'Cash',
  upi: 'UPI',
  internet_banking: 'Internet Banking',
  card: 'Card',
  cheque: 'Cheque',
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export default function PTEnrollPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [searchParams] = useSearchParams()

  // ── State ──────────────────────────────────────────────────────────────────
  const prefilledMemberId = Number(searchParams.get('member_id') ?? 0)

  const [pkgSplits, setPkgSplits] = useState<Record<string, PackageSplit>>({})
  useEffect(() => { setPkgSplits(loadPackageSplits()) }, [])

  const [memberSearch, setMemberSearch]         = useState('')
  const [selectedMember, setSelectedMember]     = useState<Member | null>(null)
  const [selectedPkgId, setSelectedPkgId]       = useState<number | null>(null)
  const [selectedTrainerId, setSelectedTrainerId] = useState<number | null>(null)
  const [amount, setAmount]                     = useState('')
  const [notes, setNotes]                       = useState('')
  const [step, setStep]                         = useState<1 | 2 | 3>(prefilledMemberId ? 2 : 1)

  // Date fields
  const [startDate, setStartDate]       = useState(todayStr())
  const [expiryDate, setExpiryDate]     = useState('')
  const [expiryManual, setExpiryManual] = useState(false)
  const [validityDays, setValidityDays]       = useState<number | ''>(90)
  const [durationMinutes, setDurationMinutes] = useState<number | ''>(60)

  // Payment
  const [isSplit, setIsSplit]                 = useState(false)
  const [payMethod1, setPayMethod1]           = useState('upi')
  const [payAmount1, setPayAmount1]           = useState('')
  const [payMethod2, setPayMethod2]           = useState('cash')
  const [payAmount2, setPayAmount2]           = useState('')

  // ── Data ───────────────────────────────────────────────────────────────────
  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ['enroll-members', memberSearch],
    queryFn: () => membersApi.list({ search: memberSearch, per_page: 20 }),
    enabled: step === 1,
  })

  const { data: prefilledData } = useQuery({
    queryKey: ['member', prefilledMemberId],
    queryFn: () => membersApi.getById(prefilledMemberId),
    enabled: prefilledMemberId > 0 && !selectedMember,
    select: (d: any) => {
      const m = d?.member ?? d
      if (m && !selectedMember) setSelectedMember(m)
      return m
    },
  })

  const { data: pkgsData } = useQuery({
    queryKey: ['pt-packages'],
    queryFn: () => ptApi.listPackages(),
  })

  const { data: trainersData } = useQuery({
    queryKey: ['trainers'],
    queryFn: () => trainersApi.list(true),
  })

  const members  = (membersData as any)?.members ?? []
  const packages = ((pkgsData as any)?.pt_packages ?? []).filter((p: any) => p.is_active)
  const trainers = (trainersData as any)?.trainers ?? []

  const selectedPkg = packages.find((p: any) => p.id === selectedPkgId) ?? null

  const selectedSplit: PackageSplit | null = useMemo(() =>
    selectedPkgId ? (pkgSplits[String(selectedPkgId)] ?? null) : null,
    [selectedPkgId, pkgSplits]
  )

  const enrollSplit = useMemo(() =>
    selectedSplit && selectedSplit.gymPct > 0 ? computeSplit(selectedSplit) : null,
    [selectedSplit]
  )

  // Derived payment values
  const amountNum   = Number(amount) || 0
  const receivedNum = isSplit
    ? (Number(payAmount1) || 0) + (Number(payAmount2) || 0)
    : (Number(payAmount1) || 0)
  const dueNum      = Math.max(0, amountNum - receivedNum)

  // Auto-compute expiry when start date or validity days change
  useEffect(() => {
    if (!expiryManual && validityDays !== '') {
      setExpiryDate(addDays(startDate, Number(validityDays)))
    }
  }, [startDate, validityDays, expiryManual])

  function handleStartDateChange(val: string) {
    setStartDate(val)
    setExpiryManual(false)
  }

  function handleExpiryDateChange(val: string) {
    setExpiryDate(val)
    setExpiryManual(true)
  }

  function handleValidityDaysChange(val: string) {
    const days = val === '' ? '' : Number(val)
    setValidityDays(days)
    if (val !== '' && Number(val) > 0) {
      setExpiryDate(addDays(startDate, Number(val)))
      setExpiryManual(false)
    }
  }

  // Pre-fill amount, validity, and duration when package changes
  function selectPackage(id: number) {
    setSelectedPkgId(id)
    const pkg = packages.find((p: any) => p.id === id)
    if (pkg) {
      setAmount(String(pkg.price))
      setValidityDays(pkg.validity_days)
      setDurationMinutes(getPackageDuration(id))
      setExpiryManual(false)
    }
  }

  // ── Mutation ───────────────────────────────────────────────────────────────
  const enrollMutation = useMutation({
    mutationFn: () => ptApi.purchasePackage({
      member_id:      selectedMember!.id,
      pt_package_id:  selectedPkgId!,
      trainer_id:     selectedTrainerId ?? undefined,
      amount:         amountNum,
      amount_paid:    receivedNum,
      payment_method: isSplit ? 'split' : payMethod1,
      start_date:        startDate,
      expires_at:        expiryDate || undefined,
      duration_minutes:  durationMinutes || 60,
      notes,
      facility_id:       1,
    }),
    onSuccess: () => {
      toast.success('PT package enrolled successfully')
      qc.invalidateQueries({ queryKey: ['pt-report'] })
      navigate('/pt/packages')
    },
    onError: (e: any) => toast.error(e?.message ?? 'Enrollment failed'),
  })

  const canSubmit = selectedMember && selectedPkgId && amountNum > 0 && receivedNum >= 0

  // ── Steps ──────────────────────────────────────────────────────────────────
  const STEPS = [
    { n: 1 as const, label: 'Select Member',   icon: <User className="w-4 h-4" /> },
    { n: 2 as const, label: 'Choose Package',  icon: <Trophy className="w-4 h-4" /> },
    { n: 3 as const, label: 'Confirm & Enroll', icon: <Check className="w-4 h-4" /> },
  ]

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="relative overflow-hidden -mx-6 -mt-6 bg-gradient-to-br from-indigo-700 via-violet-700 to-purple-800 text-white">
        <div className="relative px-6 pt-6 pb-6">
          <p className="text-[11px] font-semibold tracking-widest uppercase text-white/55 mb-1.5">Personal Training</p>
          <div className="flex items-center gap-2.5 mb-1">
            <Dumbbell className="w-5 h-5 opacity-80" />
            <h1 className="text-2xl font-bold tracking-tight">Enroll Member in PT</h1>
          </div>
          <p className="text-sm text-white/65">Sell a PT package to a member and assign a trainer</p>

          {/* Step indicators */}
          <div className="flex items-center gap-2 mt-5">
            {STEPS.map((s, i) => (
              <div key={s.n} className="flex items-center gap-2">
                <button
                  onClick={() => { if (s.n < step || (s.n === 2 && selectedMember)) setStep(s.n) }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all
                    ${step === s.n ? 'bg-white text-[#007a99] shadow-sm' :
                      s.n < step ? 'bg-white/20 text-white hover:bg-white/30 cursor-pointer' :
                      'bg-white/10 text-white/40 cursor-default'}`}
                >
                  {s.n < step ? <Check className="w-3 h-3" /> : s.icon}
                  {s.label}
                </button>
                {i < STEPS.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-white/30" />}
              </div>
            ))}
          </div>
        </div>
        <div className="absolute -right-6 -top-6 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
      </div>

      {/* ── Step 1: Select Member ── */}
      {step === 1 && (
        <Card className="shadow-lg shadow-gray-200/80 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b bg-teal-50/60 flex items-center gap-3">
            <Users className="w-4 h-4 text-teal-600 shrink-0" />
            <p className="font-semibold text-sm text-teal-700 shrink-0">Search & Select Member</p>
            <SearchInput
              placeholder="Search by name, phone or email…"
              value={memberSearch}
              onChange={setMemberSearch}
              className="w-72"
              autoFocus
            />
          </div>
          <div className="p-4 space-y-3">
            <div className="divide-y rounded-lg border overflow-hidden">
              {membersLoading && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">Searching…</div>
              )}
              {!membersLoading && members.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {memberSearch ? 'No members found' : 'Start typing to search members'}
                </div>
              )}
              {members.map((m: Member) => (
                <button
                  key={m.id}
                  onClick={() => { setSelectedMember(m); setStep(2) }}
                  className="w-full text-left px-4 py-3 hover:bg-teal-50/60 transition-colors flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-medium text-sm">{memberFullName(m)}</p>
                    <p className="text-xs text-muted-foreground">{m.user.email} · {m.member_code}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium
                    ${m.membership_status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                    {m.membership_status}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* ── Step 2: Choose Package + Trainer ── */}
      {step === 2 && (
        <div className="space-y-5">
          {/* Member + Package selection row */}
          <Card className="shadow-lg shadow-gray-200/80 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b bg-teal-50/60 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-teal-600" />
              <p className="font-semibold text-sm text-teal-700">Member &amp; Package</p>
            </div>
            <div className="p-4 grid grid-cols-2 gap-4">
              {/* Member */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Member</label>
                <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-muted/40">
                  <User className="w-4 h-4 text-[#00B4D8] shrink-0" />
                  <span className="text-sm font-semibold text-[#005f7a] truncate">{selectedMember ? memberFullName(selectedMember) : '—'}</span>
                  <span className="text-xs text-[#00B4D8] shrink-0">{selectedMember?.member_code}</span>
                  {prefilledMemberId === 0 && (
                    <button
                      onClick={() => { setSelectedMember(null); setStep(1) }}
                      className="ml-auto text-xs text-[#00B4D8] hover:text-[#007a99] underline shrink-0"
                    >Change</button>
                  )}
                </div>
              </div>

              {/* Package dropdown */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">PT Package</label>
                {packages.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    No active packages.{' '}
                    <button className="text-teal-600 underline" onClick={() => navigate('/pt/packages/new')}>Create one</button>
                  </p>
                ) : (
                  <select
                    value={selectedPkgId ?? ''}
                    onChange={e => e.target.value && selectPackage(Number(e.target.value))}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  >
                    <option value="">— Select a package —</option>
                    {packages.map((pkg: any) => (
                      <option key={pkg.id} value={pkg.id}>
                        {pkg.name} · {pkg.sessions} sessions · {pkg.validity_days}d · ₹{pkg.price.toLocaleString('en-IN')}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </Card>

          {/* Trainer + amount + dates + payment */}
          {selectedPkgId && (
            <Card className="shadow-lg shadow-gray-200/80 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b bg-teal-50/60 flex items-center gap-2">
                <Users className="w-4 h-4 text-teal-600" />
                <p className="font-semibold text-sm text-teal-700">Assign Trainer & Set Amount</p>
              </div>
              <div className="p-4 space-y-4">

                {/* Trainer + Amount Charged */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Trainer <span className="text-muted-foreground font-normal">(optional)</span></label>
                    <select
                      value={selectedTrainerId ?? ''}
                      onChange={e => setSelectedTrainerId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                    >
                      <option value="">Unassigned — assign later</option>
                      {trainers.map((t: any) => (
                        <option key={t.id} value={t.id}>
                          {t.user?.first_name} {t.user?.last_name}
                          {t.specialization ? ` · ${t.specialization}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Amount Charged</label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="number" min="0" step="100"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        className="pl-9 font-semibold"
                        placeholder={selectedPkg ? String(selectedPkg.price) : '0'}
                      />
                    </div>
                    {selectedPkg && Number(amount) !== selectedPkg.price && (
                      <p className="text-xs text-amber-600">
                        Package list price is {formatCurrency(selectedPkg.price)} — you've overridden it
                      </p>
                    )}
                  </div>
                </div>

                {/* Start Date + Expiry Date + Validity Days + Duration */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Start Date</label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={e => handleStartDateChange(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium flex items-center gap-1.5">
                      Expiry Date
                      {expiryManual && (
                        <span className="text-[10px] font-normal text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                          overridden
                        </span>
                      )}
                    </label>
                    <Input
                      type="date"
                      value={expiryDate}
                      min={startDate}
                      onChange={e => handleExpiryDateChange(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Validity (days)</label>
                    <Input
                      type="number"
                      min="1"
                      value={validityDays}
                      onChange={e => handleValidityDaysChange(e.target.value)}
                      className="text-sm"
                      placeholder="90"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Session Duration (min)</label>
                    <Input
                      type="number"
                      min="1"
                      value={durationMinutes}
                      onChange={e => setDurationMinutes(e.target.value === '' ? '' : Number(e.target.value))}
                      className="text-sm"
                      placeholder="60"
                    />
                  </div>
                </div>

                {/* Payment */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Payment</label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isSplit}
                        onChange={e => setIsSplit(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-[#007a99] focus:ring-[#00B4D8]"
                      />
                      <span className="text-sm text-muted-foreground">Split payment</span>
                    </label>
                  </div>

                  {/* Payment row(s) */}
                  <div className="space-y-2">
                    {/* Row 1 */}
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={payMethod1}
                        onChange={e => setPayMethod1(e.target.value)}
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                      >
                        <option value="cash">Cash</option>
                        <option value="upi">UPI</option>
                        <option value="internet_banking">Internet Banking</option>
                        <option value="card">Card</option>
                        <option value="cheque">Cheque</option>
                      </select>
                      <div className="relative">
                        <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="number" min="0" step="100"
                          value={payAmount1}
                          onChange={e => setPayAmount1(e.target.value)}
                          className="pl-9"
                          placeholder="Amount"
                        />
                      </div>
                    </div>

                    {/* Row 2 — only when split */}
                    {isSplit && (
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={payMethod2}
                          onChange={e => setPayMethod2(e.target.value)}
                          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                        >
                          <option value="cash">Cash</option>
                          <option value="upi">UPI</option>
                          <option value="internet_banking">Internet Banking</option>
                          <option value="card">Card</option>
                          <option value="cheque">Cheque</option>
                        </select>
                        <div className="relative">
                          <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            type="number" min="0" step="100"
                            value={payAmount2}
                            onChange={e => setPayAmount2(e.target.value)}
                            className="pl-9"
                            placeholder="Amount"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Received / Due summary */}
                  <div className={`grid gap-2 ${dueNum > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    <div className="flex items-center justify-between rounded-lg bg-green-50 border border-green-100 px-4 py-2.5 text-sm">
                      <span className="text-green-700 font-medium">Received</span>
                      <span className="font-bold text-green-700">{formatCurrency(receivedNum)}</span>
                    </div>
                    {dueNum > 0 && (
                      <div className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-100 px-4 py-2.5 text-sm">
                        <span className="text-amber-700 font-medium">Due</span>
                        <span className="font-bold text-amber-700">{formatCurrency(dueNum)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Notes <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Goals, focus areas, special instructions…"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  />
                </div>

                <Button className="w-full" onClick={() => setStep(3)}>
                  Review & Confirm <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── Step 3: Confirm & Enroll ── */}
      {step === 3 && selectedMember && selectedPkg && (
        <Card className="shadow-lg shadow-gray-200/80 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b bg-teal-50/60 flex items-center gap-2">
            <FileText className="w-4 h-4 text-teal-600" />
            <p className="font-semibold text-sm text-teal-700">Review Enrollment</p>
          </div>
          <div className="p-6 space-y-4">
            {/* Summary card */}
            <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-cyan-100 divide-y divide-indigo-100/60">
              {[
                { label: 'Member',  value: `${memberFullName(selectedMember)} (${selectedMember.member_code})` },
                { label: 'Package', value: `${selectedPkg.name} · ${selectedPkg.sessions} sessions` },
                { label: 'Trainer', value: selectedTrainerId
                    ? (() => { const t = trainers.find((x: any) => x.id === selectedTrainerId); return t ? `${t.user?.first_name} ${t.user?.last_name}` : '—' })()
                    : 'Unassigned' },
                { label: 'Start Date',        value: startDate },
                { label: 'Expiry Date',       value: expiryDate || '—', sub: expiryManual ? 'manually set' : `+${validityDays}d from start` },
                { label: 'Session Duration',  value: `${durationMinutes || 60} min` },
                { label: 'Amount Charged', value: formatCurrency(amountNum), bold: true },
                ...(isSplit
                  ? [
                      { label: `Payment 1 (${PAY_LABELS[payMethod1] ?? payMethod1})`, value: formatCurrency(Number(payAmount1) || 0), green: true },
                      { label: `Payment 2 (${PAY_LABELS[payMethod2] ?? payMethod2})`, value: formatCurrency(Number(payAmount2) || 0), green: true },
                    ]
                  : [{ label: `Payment (${PAY_LABELS[payMethod1] ?? payMethod1})`, value: formatCurrency(receivedNum), green: true }]
                ),
                ...(dueNum > 0 ? [{ label: 'Amount Due', value: formatCurrency(dueNum), amber: true }] : []),
                ...(notes ? [{ label: 'Notes', value: notes }] : []),
              ].map((row: any) => (
                <div key={row.label} className="flex justify-between gap-4 px-4 py-3 text-sm">
                  <span className="text-muted-foreground shrink-0">{row.label}</span>
                  <div className="text-right">
                    <span className={`font-medium ${row.bold ? 'font-bold text-teal-700 text-base' : ''} ${row.green ? 'text-green-700' : ''} ${row.amber ? 'text-amber-600' : ''}`}>
                      {row.value}
                    </span>
                    {row.sub && <p className="text-[10px] text-muted-foreground mt-0.5">{row.sub}</p>}
                  </div>
                </div>
              ))}
            </div>

            {/* Revenue split preview */}
            {enrollSplit && selectedSplit ? (
              <div className="rounded-xl p-4 space-y-3 bg-teal-50 border border-teal-100">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 shrink-0 text-teal-600" />
                  <p className="text-xs font-semibold text-teal-700">
                    Revenue Split{selectedSplit.category ? ` — ${selectedSplit.category}` : ''}
                  </p>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden bg-muted flex">
                  <div className="h-full bg-teal-500 rounded-full" style={{ width: `${enrollSplit.gymPct}%` }} />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1 rounded-lg p-3 bg-teal-600 text-white text-center text-sm">
                    <p className="font-bold">{formatCurrency(amountNum * enrollSplit.gymPct / 100)}</p>
                    <p className="opacity-80 text-xs mt-0.5">Gym earns ({enrollSplit.gymPct}%)</p>
                  </div>
                  <div className="flex-1 rounded-lg p-3 bg-muted text-center text-sm">
                    <p className="font-bold text-foreground">{formatCurrency(amountNum * enrollSplit.trainerPct / 100)}</p>
                    <p className="text-muted-foreground text-xs mt-0.5">Trainer earns ({enrollSplit.trainerPct}%)</p>
                  </div>
                </div>
              </div>
            ) : !selectedSplit && selectedPkgId ? (
              <div className="rounded-xl border border-dashed p-3 flex items-start gap-2 text-xs text-muted-foreground">
                <Layers className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>No revenue split configured for this package.{' '}
                  <a href="/pt/packages" className="ml-1 text-primary underline underline-offset-2">Set it up in PT Packages.</a>
                </span>
              </div>
            ) : null}

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep(2)} disabled={enrollMutation.isPending}>
                Back
              </Button>
              <Button
                className="flex-1 bg-[#0096b4] hover:bg-indigo-700 text-white"
                onClick={() => enrollMutation.mutate()}
                disabled={!canSubmit || enrollMutation.isPending}
              >
                {enrollMutation.isPending ? 'Enrolling…' : 'Confirm Enrollment'}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
