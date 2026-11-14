import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { billingApi, type TaxRate } from '@/api/billing.api'
import { membersApi } from '@/api/members.api'
import { plansApi } from '@/api/plans.api'
import { QUERY_KEYS } from '@/lib/constants'
import type { Plan } from '@/types/plan.types'
import type { Member } from '@/types/member.types'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import {
  ArrowLeft, Plus, Trash2, Search, FileText, User, Building2,
  Receipt, ChevronRight, CheckCircle2, IndianRupee, Percent,
} from 'lucide-react'

interface LineItem {
  description: string
  quantity: string
  unit_price: string
  discount_amount: string
  tax_rate_id: string
}

function emptyLine(): LineItem {
  return { description: '', quantity: '1', unit_price: '', discount_amount: '0', tax_rate_id: '' }
}

function MemberAvatar({ name }: { name: string }) {
  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className="h-10 w-10 rounded-full bg-cyan-100 text-[#007a99] flex items-center justify-center text-sm font-bold shrink-0">
      {initials}
    </div>
  )
}

export default function InvoiceFormPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [memberSearch, setMemberSearch]     = useState('')
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [lines, setLines]                   = useState<LineItem[]>([emptyLine()])
  const [buyerGstin, setBuyerGstin]         = useState('')
  const [buyerAddress, setBuyerAddress]     = useState('')
  const [invoiceNotes, setInvoiceNotes]     = useState('')

  const { data: membersData } = useQuery({
    queryKey: ['invoice-member-search', memberSearch],
    queryFn: () => membersApi.list({ search: memberSearch, per_page: 8 }),
    enabled: !selectedMember && memberSearch.length > 0,
  })
  const { data: taxRatesData } = useQuery({
    queryKey: ['tax-rates'],
    queryFn: () => billingApi.listTaxRates(),
  })
  const { data: plansData } = useQuery({
    queryKey: QUERY_KEYS.plans,
    queryFn: () => plansApi.list(true),
  })

  const searchMembers: Member[] = (membersData as any)?.members ?? []
  const taxRates: TaxRate[]     = (taxRatesData as any)?.tax_rates ?? []
  const plans: Plan[]           = (plansData as any)?.plans ?? []

  function updateLine(i: number, field: keyof LineItem, value: string) {
    setLines(ls => ls.map((l, idx) => idx === i ? { ...l, [field]: value } : l))
  }

  const lineSubtotals = useMemo(() => lines.map(l => {
    const base    = Number(l.quantity || 0) * Number(l.unit_price || 0)
    const disc    = Number(l.discount_amount || 0)
    const taxable = Math.max(0, base - disc)
    const rate    = taxRates.find(r => String(r.id) === l.tax_rate_id)
    const taxPct  = rate ? (rate.cgst_rate + rate.sgst_rate + rate.igst_rate) : 0
    const tax     = taxable * (taxPct / 100)
    return { base, disc, taxable, tax, total: taxable + tax, taxPct, rate }
  }), [lines, taxRates])

  const grandTotal = lineSubtotals.reduce(
    (s, l) => ({
      subtotal: s.subtotal + l.base,
      discount: s.discount + l.disc,
      taxable:  s.taxable  + l.taxable,
      tax:      s.tax      + l.tax,
      total:    s.total    + l.total,
    }),
    { subtotal: 0, discount: 0, taxable: 0, tax: 0, total: 0 },
  )

  const filledLines = lines.filter(l => l.description && Number(l.unit_price) > 0)
  const canCreate   = !!selectedMember && filledLines.length > 0

  const createMutation = useMutation({
    mutationFn: () => billingApi.createInvoice({
      member_id:     selectedMember!.id,
      facility_id:   1,
      buyer_gstin:   buyerGstin,
      buyer_address: buyerAddress,
      notes:         invoiceNotes,
      lines: lines.map(l => ({
        description:     l.description,
        quantity:        Number(l.quantity),
        unit_price:      Number(l.unit_price),
        discount_amount: Number(l.discount_amount),
        tax_rate_id:     l.tax_rate_id ? Number(l.tax_rate_id) : undefined,
      })),
    }),
    onSuccess: () => {
      toast.success('Invoice created successfully')
      qc.invalidateQueries({ queryKey: ['billing', 'invoices'] })
      navigate('/billing/invoices')
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to create invoice'),
  })

  // ── Step indicators ───────────────────────────────────────────────────────
  const steps = [
    { label: 'Member',    done: !!selectedMember },
    { label: 'Items',     done: filledLines.length > 0 },
    { label: 'Review',    done: canCreate },
  ]

  return (
    <div className="min-h-screen bg-gray-50/60">

      {/* Top bar */}
      <div className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/billing/invoices')}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-[#0096b4] flex items-center justify-center">
                <FileText className="h-4 w-4 text-white" />
              </div>
              <span className="font-semibold text-sm">New GST Invoice</span>
            </div>
          </div>

          {/* Step progress */}
          <div className="hidden sm:flex items-center gap-1.5">
            {steps.map((step, i) => (
              <div key={step.label} className="flex items-center gap-1.5">
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  step.done
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-gray-100 text-gray-400'
                }`}>
                  {step.done
                    ? <CheckCircle2 className="h-3.5 w-3.5" />
                    : <span className="h-3.5 w-3.5 rounded-full border-2 border-current flex items-center justify-center text-[9px] font-bold">{i + 1}</span>
                  }
                  {step.label}
                </div>
                {i < steps.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-gray-300" />}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/billing/invoices')}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!canCreate || createMutation.isPending}
              onClick={() => createMutation.mutate()}
              className="bg-[#0096b4] hover:bg-indigo-700 text-white"
            >
              <FileText className="h-3.5 w-3.5" />
              {createMutation.isPending ? 'Creating…' : 'Create Invoice'}
            </Button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6 items-start">

        {/* ── Left column ── */}
        <div className="space-y-5">

          {/* ① Member */}
          <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b bg-gray-50/70 flex items-center gap-2">
              <div className="h-6 w-6 rounded-md bg-cyan-100 flex items-center justify-center">
                <User className="h-3.5 w-3.5 text-[#007a99]" />
              </div>
              <span className="text-sm font-semibold">Bill To</span>
              {selectedMember && <CheckCircle2 className="h-4 w-4 text-emerald-500 ml-auto" />}
            </div>
            <div className="p-5">
              {selectedMember ? (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-cyan-50 border border-cyan-100">
                  <MemberAvatar name={`${selectedMember.user.first_name} ${selectedMember.user.last_name}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{selectedMember.user.first_name} {selectedMember.user.last_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{selectedMember.user.email}</p>
                    <span className="inline-block mt-1 text-[10px] px-2 py-0.5 bg-cyan-100 text-[#007a99] rounded-full font-medium">
                      {selectedMember.member_code}
                    </span>
                  </div>
                  <button onClick={() => setSelectedMember(null)}
                    className="text-xs text-[#007a99] hover:text-[#005f7a] font-medium shrink-0">
                    Change
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search member by name or email…"
                      value={memberSearch}
                      onChange={e => setMemberSearch(e.target.value)}
                      className="pl-9"
                      autoFocus
                    />
                  </div>
                  {searchMembers.length > 0 && (
                    <div className="border rounded-xl divide-y overflow-hidden shadow-sm">
                      {searchMembers.map(m => (
                        <button key={m.id} onClick={() => setSelectedMember(m)}
                          className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-cyan-50 transition-colors group">
                          <MemberAvatar name={`${m.user.first_name} ${m.user.last_name}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{m.user.first_name} {m.user.last_name}</p>
                            <p className="text-xs text-muted-foreground truncate">{m.user.email}</p>
                          </div>
                          <span className="text-xs text-muted-foreground font-mono">{m.member_code}</span>
                          <ChevronRight className="h-4 w-4 text-[#00B4D8] opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  )}
                  {memberSearch.length > 0 && searchMembers.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No members found</p>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* ② Buyer details */}
          <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b bg-gray-50/70 flex items-center gap-2">
              <div className="h-6 w-6 rounded-md bg-purple-100 flex items-center justify-center">
                <Building2 className="h-3.5 w-3.5 text-purple-600" />
              </div>
              <span className="text-sm font-semibold">Buyer Details</span>
              <span className="ml-auto text-xs text-muted-foreground">Optional</span>
            </div>
            <div className="p-5 grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">GSTIN</label>
                <Input value={buyerGstin} onChange={e => setBuyerGstin(e.target.value)}
                  placeholder="22AAAAA0000A1Z5" className="font-mono text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Address</label>
                <Input value={buyerAddress} onChange={e => setBuyerAddress(e.target.value)}
                  placeholder="City, State" className="text-sm" />
              </div>
            </div>
          </section>

          {/* ③ Line items */}
          <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b bg-gray-50/70 flex items-center gap-2">
              <div className="h-6 w-6 rounded-md bg-sky-100 flex items-center justify-center">
                <Receipt className="h-3.5 w-3.5 text-sky-600" />
              </div>
              <span className="text-sm font-semibold">Line Items</span>
              {filledLines.length > 0 && (
                <span className="ml-1 text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-medium">
                  {filledLines.length}
                </span>
              )}
              <button onClick={() => setLines(ls => [...ls, emptyLine()])}
                className="ml-auto flex items-center gap-1.5 text-xs text-[#007a99] hover:text-[#005f7a] font-medium">
                <Plus className="h-3.5 w-3.5" /> Add Line
              </button>
            </div>

            <div className="divide-y">
              {lines.map((line, i) => {
                const sub = lineSubtotals[i]
                return (
                  <div key={i} className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      {/* Description */}
                      <div className="flex-1 space-y-1">
                        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Description *</label>
                        <datalist id={`plan-sug-${i}`}>
                          {plans.map(p => <option key={p.id} value={p.name} />)}
                        </datalist>
                        <Input
                          list={`plan-sug-${i}`}
                          value={line.description}
                          onChange={e => {
                            updateLine(i, 'description', e.target.value)
                            const match = plans.find(p => p.name === e.target.value)
                            if (match) updateLine(i, 'unit_price', String(match.price_amount))
                          }}
                          placeholder="e.g. Monthly Membership"
                          className="h-9"
                        />
                      </div>

                      {/* Delete */}
                      {lines.length > 1 && (
                        <button onClick={() => setLines(ls => ls.filter((_, idx) => idx !== i))}
                          className="mt-5 h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-all shrink-0">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Qty</label>
                        <Input type="number" min="1" value={line.quantity}
                          onChange={e => updateLine(i, 'quantity', e.target.value)}
                          className="h-9 text-center" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Unit Price (₹)</label>
                        <div className="relative">
                          <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input type="number" min="0" value={line.unit_price}
                            onChange={e => updateLine(i, 'unit_price', e.target.value)}
                            placeholder="0" className="h-9 pl-7" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Discount (₹)</label>
                        <div className="relative">
                          <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input type="number" min="0" value={line.discount_amount}
                            onChange={e => updateLine(i, 'discount_amount', e.target.value)}
                            className="h-9 pl-7" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                          <Percent className="h-3 w-3" /> Tax Rate
                        </label>
                        <select value={line.tax_rate_id}
                          onChange={e => updateLine(i, 'tax_rate_id', e.target.value)}
                          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00B4D8] cursor-pointer">
                          <option value="">No Tax</option>
                          {taxRates.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Per-line subtotal pill */}
                    {sub && sub.total > 0 && (
                      <div className="flex items-center justify-end gap-3 pt-1">
                        {sub.disc > 0 && (
                          <span className="text-xs text-muted-foreground">
                            Disc: <span className="text-green-600 font-medium">-{formatCurrency(sub.disc)}</span>
                          </span>
                        )}
                        {sub.tax > 0 && (
                          <span className="text-xs text-muted-foreground">
                            GST ({sub.taxPct}%): <span className="font-medium">{formatCurrency(sub.tax)}</span>
                          </span>
                        )}
                        <span className="text-sm font-bold text-[#007a99] bg-cyan-50 px-3 py-1 rounded-lg">
                          {formatCurrency(sub.total)}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* ④ Notes */}
          <section className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b bg-gray-50/70 flex items-center gap-2">
              <span className="text-sm font-semibold text-muted-foreground">Notes</span>
              <span className="ml-auto text-xs text-muted-foreground">Optional</span>
            </div>
            <div className="p-5">
              <textarea value={invoiceNotes} onChange={e => setInvoiceNotes(e.target.value)} rows={3}
                placeholder="Add any notes to appear on the invoice…"
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B4D8] resize-none" />
            </div>
          </section>
        </div>

        {/* ── Right column: Invoice Summary ── */}
        <div className="space-y-4 xl:sticky xl:top-[65px]">

          {/* Summary card */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 bg-[#0096b4] flex items-center gap-2">
              <FileText className="h-4 w-4 text-white/80" />
              <span className="text-sm font-semibold text-white">Invoice Summary</span>
            </div>

            {/* Member preview */}
            {selectedMember ? (
              <div className="px-5 py-4 border-b">
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide font-medium">Bill To</p>
                <div className="flex items-center gap-2.5">
                  <MemberAvatar name={`${selectedMember.user.first_name} ${selectedMember.user.last_name}`} />
                  <div>
                    <p className="text-sm font-semibold">{selectedMember.user.first_name} {selectedMember.user.last_name}</p>
                    <p className="text-xs text-muted-foreground">{selectedMember.user.email}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-5 py-4 border-b">
                <div className="flex items-center gap-2.5 text-muted-foreground">
                  <div className="h-10 w-10 rounded-full border-2 border-dashed border-gray-200 flex items-center justify-center">
                    <User className="h-4 w-4 text-gray-300" />
                  </div>
                  <span className="text-sm text-gray-400 italic">No member selected</span>
                </div>
              </div>
            )}

            {/* Line item previews */}
            {filledLines.length > 0 ? (
              <div className="px-5 py-3 border-b space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">Items</p>
                {filledLines.map((l, i) => {
                  const sub = lineSubtotals[lines.indexOf(l)]
                  return (
                    <div key={i} className="flex justify-between items-baseline text-sm">
                      <span className="text-muted-foreground truncate max-w-[180px]">{l.description}</span>
                      <span className="font-medium shrink-0 ml-2">{formatCurrency(sub?.total ?? 0)}</span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="px-5 py-4 border-b">
                <p className="text-sm text-gray-400 italic text-center">No items added yet</p>
              </div>
            )}

            {/* Totals */}
            <div className="px-5 py-4 space-y-2">
              {grandTotal.subtotal > 0 && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(grandTotal.subtotal)}</span>
                  </div>
                  {grandTotal.discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="text-emerald-600 font-medium">-{formatCurrency(grandTotal.discount)}</span>
                    </div>
                  )}
                  {grandTotal.tax > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">GST</span>
                      <span className="text-amber-600 font-medium">+{formatCurrency(grandTotal.tax)}</span>
                    </div>
                  )}
                  <div className="border-t pt-3 flex justify-between items-center">
                    <span className="font-bold text-base">Total</span>
                    <span className="text-xl font-bold text-[#007a99]">{formatCurrency(grandTotal.total)}</span>
                  </div>
                </>
              )}
              {grandTotal.subtotal === 0 && (
                <p className="text-sm text-gray-400 italic text-center py-2">Total will appear here</p>
              )}
            </div>
          </div>

          {/* Create button */}
          <Button
            className="w-full h-11 text-sm font-semibold bg-[#0096b4] hover:bg-indigo-700 text-white shadow-md"
            disabled={!canCreate || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            <FileText className="h-4 w-4" />
            {createMutation.isPending ? 'Creating Invoice…' : 'Create Invoice'}
          </Button>

          {!canCreate && (
            <p className="text-xs text-center text-muted-foreground">
              {!selectedMember ? 'Select a member to continue' : 'Add at least one line item with a price'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
