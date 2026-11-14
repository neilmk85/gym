import { useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { subscriptionsApi } from '@/api/subscriptions.api'
import { plansApi } from '@/api/plans.api'
import { paymentsApi } from '@/api/payments.api'
import type { Plan } from '@/types/plan.types'
import type { Subscription } from '@/types/subscription.types'
import {
  ArrowLeft, User, CheckCircle2, Calendar, CreditCard,
  Banknote, Smartphone, Building2, SplitSquareHorizontal,
  RefreshCw, ChevronDown, ChevronRight,
} from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const today = () => new Date().toISOString().slice(0, 10)

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function formatDate(d: string | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

// ─── Payment method config ────────────────────────────────────────────────────

const METHODS = [
  { key: 'cash',          label: 'Cash',          icon: <Banknote className="h-4 w-4" /> },
  { key: 'upi',           label: 'UPI',            icon: <Smartphone className="h-4 w-4" /> },
  { key: 'card',          label: 'Card',           icon: <CreditCard className="h-4 w-4" /> },
  { key: 'bank_transfer', label: 'Bank Transfer',  icon: <Building2 className="h-4 w-4" /> },
] as const

type Method = (typeof METHODS)[number]['key']

// ─── Stepper ─────────────────────────────────────────────────────────────────

function StepDot({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  return (
    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors
      ${done  ? 'bg-indigo-600 border-indigo-600 text-white'
      : active ? 'border-indigo-600 text-indigo-600 bg-white dark:bg-gray-900'
               : 'border-gray-300 text-gray-400 bg-white dark:bg-gray-900'}`}>
      {done ? <CheckCircle2 className="h-4 w-4" /> : n}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MembershipRenewalPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const subId = Number(params.get('subId') ?? 0)

  // ── Fetch old subscription ──────────────────────────────────────────────────
  const { data: oldSub, isLoading: loadingSub } = useQuery<Subscription>({
    queryKey: ['subscription', subId],
    queryFn: () => subscriptionsApi.getById(subId),
    enabled: subId > 0,
  })

  // ── Fetch plans ─────────────────────────────────────────────────────────────
  const { data: plansData } = useQuery({
    queryKey: ['plans', 'active'],
    queryFn: () => plansApi.list(true),
  })
  const plans: Plan[] = (plansData as { plans: Plan[] } | undefined)?.plans ?? []

  // ── Form state ──────────────────────────────────────────────────────────────
  const [keepPlan, setKeepPlan] = useState(true)
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null)
  const [startDate, setStartDate] = useState(today())
  const [discountAmount, setDiscountAmount] = useState(0)
  const [promoCode, setPromoCode] = useState('')

  // Payment
  const [method, setMethod] = useState<Method>('cash')
  const [isSplit, setIsSplit] = useState(false)
  const [pay1Amount, setPay1Amount] = useState<number | ''>('')
  const [pay1Method, setPay1Method] = useState<Method>('cash')
  const [pay1Notes, setPay1Notes] = useState('')
  const [pay1Date, setPay1Date] = useState(today())
  const [pay2Amount, setPay2Amount] = useState<number | ''>('')
  const [pay2Method, setPay2Method] = useState<Method>('cash')
  const [pay2Notes, setPay2Notes] = useState('')
  const [pay2Date, setPay2Date] = useState(today())
  const [payNotes, setPayNotes] = useState('')
  const [payRef, setPayRef] = useState('')
  const [payDate, setPayDate] = useState(today())

  // ── Derived values ───────────────────────────────────────────────────────────
  const activePlan = useMemo<Plan | null>(() => {
    if (keepPlan && oldSub?.plan) return oldSub.plan as Plan
    if (!keepPlan && selectedPlanId) return plans.find(p => p.id === selectedPlanId) ?? null
    return null
  }, [keepPlan, oldSub, selectedPlanId, plans])

  const planPrice = activePlan?.price_amount ?? 0
  const billingDays = activePlan?.billing_period_days ?? 30
  const endDate = addDays(startDate, billingDays)
  const finalAmount = Math.max(0, planPrice - discountAmount)

  const memberName = useMemo(() => {
    const sub = oldSub as (Subscription & { member?: { user?: { first_name?: string; last_name?: string } } }) | undefined
    if (!sub?.member?.user) return 'Member'
    return `${sub.member.user.first_name ?? ''} ${sub.member.user.last_name ?? ''}`.trim()
  }, [oldSub])

  const memberId = oldSub?.member_id

  const totalPaid = isSplit
    ? (Number(pay1Amount) || 0) + (Number(pay2Amount) || 0)
    : Number(pay1Amount) || 0
  const balanceDue = finalAmount - totalPaid

  const canRenew =
    !!activePlan &&
    !!memberId &&
    startDate &&
    (isSplit
      ? (Number(pay1Amount) || 0) > 0 || (Number(pay2Amount) || 0) > 0
      : true)

  // ── Mutations ────────────────────────────────────────────────────────────────
  const renewMutation = useMutation({
    mutationFn: async () => {
      const newSub = await subscriptionsApi.create({
        member_id: memberId,
        plan_id: activePlan!.id,
        start_date: startDate,
        manual_discount_amount: discountAmount,
        promo_code: promoCode || undefined,
        auto_renew: activePlan!.auto_renew,
      })

      const promises: Promise<unknown>[] = []

      if (isSplit) {
        if (Number(pay1Amount) > 0) {
          promises.push(paymentsApi.record({
            member_id: memberId,
            subscription_id: newSub.id,
            amount: Number(pay1Amount),
            payment_method: pay1Method,
            paid_at: pay1Date,
            notes: pay1Notes || undefined,
          }))
        }
        if (Number(pay2Amount) > 0) {
          promises.push(paymentsApi.record({
            member_id: memberId,
            subscription_id: newSub.id,
            amount: Number(pay2Amount),
            payment_method: pay2Method,
            paid_at: pay2Date,
            notes: pay2Notes || undefined,
          }))
        }
      } else if (Number(pay1Amount) > 0) {
        promises.push(paymentsApi.record({
          member_id: memberId,
          subscription_id: newSub.id,
          amount: Number(pay1Amount),
          payment_method: method,
          paid_at: payDate,
          notes: payNotes || (payRef ? `Ref: ${payRef}` : undefined),
        }))
      }

      await Promise.all(promises)
      return newSub
    },
    onSuccess: () => {
      toast.success('Membership renewed successfully')
      navigate('/memberships')
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to renew membership')
    },
  })

  // ── Render ───────────────────────────────────────────────────────────────────
  if (!subId) {
    return (
      <div className="p-8 text-center text-gray-500">
        No subscription selected. <button onClick={() => navigate('/memberships')} className="text-indigo-600 underline">Go back</button>
      </div>
    )
  }

  if (loadingSub) {
    return <div className="p-8 text-center text-gray-400">Loading subscription details…</div>
  }

  if (!oldSub) {
    return (
      <div className="p-8 text-center text-gray-500">
        Subscription not found. <button onClick={() => navigate('/memberships')} className="text-indigo-600 underline">Go back</button>
      </div>
    )
  }

  const steps = [
    { label: 'Plan',     done: !!activePlan },
    { label: 'Pricing',  done: !!activePlan },
    { label: 'Payment',  done: isSplit ? totalPaid > 0 : Number(pay1Amount) > 0 },
    { label: 'Review',   done: canRenew },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center gap-4">
        <button onClick={() => navigate('/memberships')} className="text-gray-500 hover:text-gray-900 dark:hover:text-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3">
          <RefreshCw className="h-5 w-5 text-indigo-600" />
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Renew Membership</h1>
            <p className="text-xs text-gray-500">Subscription #{subId} · {memberName}</p>
          </div>
        </div>
        {/* Step indicators */}
        <div className="ml-auto hidden md:flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={s.label} className="flex items-center gap-2">
              {i > 0 && <ChevronRight className="h-3 w-3 text-gray-300" />}
              <div className="flex items-center gap-1.5">
                <StepDot n={i + 1} active={i === steps.findIndex(x => !x.done)} done={s.done} />
                <span className="text-xs text-gray-500">{s.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">

        {/* ── LEFT COLUMN ──────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Expired Subscription Card */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {initials(memberName)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 dark:text-gray-100">{memberName}</div>
                <div className="text-xs text-gray-500">Member ID: {oldSub.member_id}</div>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                  Expired
                </span>
                <div className="text-xs text-gray-500 mt-0.5">
                  {oldSub.plan?.name} · ended {formatDate(oldSub.end_date as string)}
                </div>
              </div>
            </div>
          </div>

          {/* STEP 1: Plan Selection */}
          <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 text-xs flex items-center justify-center font-bold">1</span>
                Membership Plan
              </h2>
            </div>
            <div className="p-5 space-y-4">
              {/* Same / Different plan toggle */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => { setKeepPlan(true); setSelectedPlanId(null) }}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${keepPlan
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}
                >
                  <div className="font-medium text-sm text-gray-900 dark:text-gray-100">Continue same plan</div>
                  <div className="text-xs text-gray-500 mt-0.5">{oldSub.plan?.name} · {fmtCurrency(oldSub.plan?.price_amount ?? 0)}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setKeepPlan(false)}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${!keepPlan
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}
                >
                  <div className="font-medium text-sm text-gray-900 dark:text-gray-100">Change plan</div>
                  <div className="text-xs text-gray-500 mt-0.5">Pick a different membership</div>
                </button>
              </div>

              {/* Plan picker when "Change plan" selected */}
              {!keepPlan && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {plans.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPlanId(p.id)}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${selectedPlanId === p.id
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}
                    >
                      <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{p.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {fmtCurrency(p.price_amount)} · {Math.round(p.billing_period_days / 30)}mo
                        {p.type !== 'standard' && <span className="ml-1 capitalize text-indigo-500">({p.type})</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Dates */}
              {activePlan && (
                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
                    <div className="h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-sm text-gray-700 dark:text-gray-300 flex items-center">
                      {formatDate(endDate)} <span className="ml-1 text-xs text-gray-400">({Math.round(billingDays / 30)}mo)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* STEP 2: Pricing */}
          {activePlan && (
            <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 text-xs flex items-center justify-center font-bold">2</span>
                  Pricing
                </h2>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Plan price</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{fmtCurrency(planPrice)}</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Discount (₹)</label>
                    <input
                      type="number"
                      min={0}
                      max={planPrice}
                      value={discountAmount || ''}
                      onChange={e => setDiscountAmount(Math.max(0, Number(e.target.value)))}
                      placeholder="0"
                      className="w-full h-9 px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Promo Code</label>
                    <input
                      type="text"
                      value={promoCode}
                      onChange={e => setPromoCode(e.target.value.toUpperCase())}
                      placeholder="Optional"
                      className="w-full h-9 px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between py-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg px-4">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">Net Payable</span>
                  <span className="text-xl font-bold text-indigo-600">{fmtCurrency(finalAmount)}</span>
                </div>
              </div>
            </section>
          )}

          {/* STEP 3: Payment */}
          {activePlan && (
            <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 text-xs flex items-center justify-center font-bold">3</span>
                  Payment
                </h2>
                <button
                  type="button"
                  onClick={() => setIsSplit(s => !s)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium border transition-all ${isSplit
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-indigo-400'}`}
                >
                  <SplitSquareHorizontal className="h-3.5 w-3.5" />
                  Split Payment
                </button>
              </div>

              <div className="p-5 space-y-5">
                {!isSplit ? (
                  /* Single payment */
                  <div className="space-y-4">
                    {/* Method tabs */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-2">Payment Method</label>
                      <div className="grid grid-cols-4 gap-2">
                        {METHODS.map(m => (
                          <button
                            key={m.key}
                            type="button"
                            onClick={() => setMethod(m.key)}
                            className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all ${method === m.key
                              ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600'
                              : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'}`}
                          >
                            {m.icon}
                            <span className="text-xs font-medium">{m.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Amount Paid (₹)</label>
                        <input
                          type="number"
                          min={0}
                          value={pay1Amount}
                          onChange={e => setPay1Amount(e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder={String(finalAmount)}
                          className="w-full h-9 px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Payment Date</label>
                        <input
                          type="date"
                          value={payDate}
                          onChange={e => setPayDate(e.target.value)}
                          className="w-full h-9 px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    {(method === 'upi' || method === 'bank_transfer' || method === 'card') && (
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Reference / Transaction ID</label>
                        <input
                          type="text"
                          value={payRef}
                          onChange={e => setPayRef(e.target.value)}
                          placeholder="UPI ref / cheque no. / card last 4"
                          className="w-full h-9 px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Notes (optional)</label>
                      <textarea
                        value={payNotes}
                        onChange={e => setPayNotes(e.target.value)}
                        rows={2}
                        placeholder="Any payment notes…"
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                      />
                    </div>
                  </div>
                ) : (
                  /* Split payment */
                  <div className="space-y-5">
                    <p className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
                      Record two separate payments. Total should equal the net payable of {fmtCurrency(finalAmount)}.
                    </p>

                    {/* Payment 1 */}
                    <div className="rounded-lg border border-indigo-200 dark:border-indigo-800 p-4 space-y-3">
                      <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Payment 1</div>
                      <div className="grid grid-cols-4 gap-2">
                        {METHODS.map(m => (
                          <button
                            key={m.key}
                            type="button"
                            onClick={() => setPay1Method(m.key)}
                            className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 text-xs transition-all ${pay1Method === m.key
                              ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600'
                              : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'}`}
                          >
                            {m.icon}
                            <span>{m.label}</span>
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Amount (₹)</label>
                          <input
                            type="number"
                            min={0}
                            value={pay1Amount}
                            onChange={e => setPay1Amount(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="0"
                            className="w-full h-9 px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                          <input
                            type="date"
                            value={pay1Date}
                            onChange={e => setPay1Date(e.target.value)}
                            className="w-full h-9 px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                        <input
                          type="text"
                          value={pay1Notes}
                          onChange={e => setPay1Notes(e.target.value)}
                          placeholder="Reference / notes"
                          className="w-full h-9 px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    {/* Payment 2 */}
                    <div className="rounded-lg border border-purple-200 dark:border-purple-800 p-4 space-y-3">
                      <div className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Payment 2</div>
                      <div className="grid grid-cols-4 gap-2">
                        {METHODS.map(m => (
                          <button
                            key={m.key}
                            type="button"
                            onClick={() => setPay2Method(m.key)}
                            className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 text-xs transition-all ${pay2Method === m.key
                              ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20 text-purple-600'
                              : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'}`}
                          >
                            {m.icon}
                            <span>{m.label}</span>
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Amount (₹)</label>
                          <input
                            type="number"
                            min={0}
                            value={pay2Amount}
                            onChange={e => setPay2Amount(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="0"
                            className="w-full h-9 px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                          <input
                            type="date"
                            value={pay2Date}
                            onChange={e => setPay2Date(e.target.value)}
                            className="w-full h-9 px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                        <input
                          type="text"
                          value={pay2Notes}
                          onChange={e => setPay2Notes(e.target.value)}
                          placeholder="Reference / notes"
                          className="w-full h-9 px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    {/* Balance indicator */}
                    <div className={`flex items-center justify-between px-4 py-2 rounded-lg text-sm font-medium ${balanceDue > 0 ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400' : balanceDue < 0 ? 'bg-red-50 dark:bg-red-900/20 text-red-600' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'}`}>
                      <span>{balanceDue > 0 ? 'Balance due' : balanceDue < 0 ? 'Overpaid by' : 'Fully paid'}</span>
                      {balanceDue !== 0 && <span>{fmtCurrency(Math.abs(balanceDue))}</span>}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        {/* ── RIGHT COLUMN: Sticky Summary ────────────────────────────────── */}
        <div className="lg:sticky lg:top-6 h-fit">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="px-5 py-4 bg-indigo-600 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm">
                  {initials(memberName)}
                </div>
                <div>
                  <div className="font-semibold">{memberName}</div>
                  <div className="text-xs text-indigo-200">Renewal Summary</div>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {activePlan ? (
                <>
                  <div className="space-y-2.5">
                    <Row label="Plan" value={activePlan.name} />
                    <Row label="Duration" value={`${Math.round(billingDays / 30)} months`} />
                    <Row label="Start date" value={formatDate(startDate)} />
                    <Row label="End date" value={formatDate(endDate)} />
                  </div>

                  <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-2">
                    <Row label="Plan price" value={fmtCurrency(planPrice)} />
                    {discountAmount > 0 && (
                      <Row label="Discount" value={`− ${fmtCurrency(discountAmount)}`} valueClass="text-green-600" />
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">Net Payable</span>
                      <span className="text-lg font-bold text-indigo-600">{fmtCurrency(finalAmount)}</span>
                    </div>
                  </div>

                  {(isSplit ? totalPaid > 0 : Number(pay1Amount) > 0) && (
                    <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-2">
                      {!isSplit ? (
                        <>
                          <Row label="Method" value={METHODS.find(m => m.key === method)?.label ?? method} />
                          <Row label="Amount paid" value={fmtCurrency(Number(pay1Amount))} />
                          {balanceDue > 0 && <Row label="Balance due" value={fmtCurrency(balanceDue)} valueClass="text-amber-600" />}
                        </>
                      ) : (
                        <>
                          {Number(pay1Amount) > 0 && <Row label={`Payment 1 (${METHODS.find(m => m.key === pay1Method)?.label})`} value={fmtCurrency(Number(pay1Amount))} />}
                          {Number(pay2Amount) > 0 && <Row label={`Payment 2 (${METHODS.find(m => m.key === pay2Method)?.label})`} value={fmtCurrency(Number(pay2Amount))} />}
                          <Row label="Total paid" value={fmtCurrency(totalPaid)} />
                          {balanceDue > 0 && <Row label="Balance due" value={fmtCurrency(balanceDue)} valueClass="text-amber-600" />}
                        </>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-6 text-gray-400 text-sm">Select a plan to see summary</div>
              )}

              <button
                type="button"
                disabled={!canRenew || renewMutation.isPending}
                onClick={() => renewMutation.mutate()}
                className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
              >
                {renewMutation.isPending ? (
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {renewMutation.isPending ? 'Renewing…' : 'Confirm Renewal'}
              </button>

              {!canRenew && activePlan && (
                <p className="text-xs text-center text-gray-400">
                  {!activePlan ? 'Select a plan' : 'Fill in the payment details to continue'}
                </p>
              )}
            </div>
          </div>

          {/* Features summary */}
          {activePlan && (
            <div className="mt-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Plan Includes</div>
              <div className="space-y-1.5">
                {activePlan.gym_floor_access && <Feature label="Gym floor access" />}
                {activePlan.cardio_section_access && <Feature label="Cardio section" />}
                {activePlan.group_class_access && <Feature label="Group classes" />}
                {activePlan.locker_access && <Feature label="Locker access" />}
                {activePlan.pt_access && <Feature label="PT sessions" />}
                {activePlan.facility_access && <Feature label="All facilities" />}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, valueClass = '' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className={`font-medium text-gray-900 dark:text-gray-100 ${valueClass}`}>{value}</span>
    </div>
  )
}

function Feature({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
      {label}
    </div>
  )
}
