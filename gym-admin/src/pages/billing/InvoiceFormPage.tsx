import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { billingApi, type TaxRate } from '@/api/billing.api'
import { membersApi } from '@/api/members.api'
import { plansApi } from '@/api/plans.api'
import { QUERY_KEYS } from '@/lib/constants'
import type { Plan } from '@/types/plan.types'
import type { Member } from '@/types/member.types'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import { Plus, Trash2, Search, FileText } from 'lucide-react'

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
    queryFn: () => membersApi.list({ search: memberSearch, per_page: 10 }),
    enabled: !selectedMember,
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
    return { base, disc, taxable, tax, total: taxable + tax }
  }), [lines, taxRates])

  const grandTotal = lineSubtotals.reduce(
    (s, l) => ({ taxable: s.taxable + l.taxable, tax: s.tax + l.tax, total: s.total + l.total }),
    { taxable: 0, tax: 0, total: 0 },
  )

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
      toast.success('Invoice created')
      qc.invalidateQueries({ queryKey: ['billing', 'invoices'] })
      navigate('/billing/invoices')
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to create invoice'),
  })

  const canCreate = selectedMember && lines.every(l => l.description && Number(l.unit_price) > 0)

  return (
    <div>
      <PageHeader
        title="New Invoice"
        subtitle="Create a GST tax invoice for a member"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/billing/invoices')}>
              Cancel
            </Button>
            <Button
              disabled={!canCreate || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              <FileText className="h-4 w-4" />
              {createMutation.isPending ? 'Creating…' : 'Create Invoice'}
            </Button>
          </div>
        }
      />

      <div className="max-w-4xl space-y-5">

        {/* Member */}
        <Card>
          <CardContent className="p-5 space-y-3">
            <h2 className="text-sm font-semibold">Member *</h2>
            {selectedMember ? (
              <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-teal-50 border border-teal-200">
                <div>
                  <p className="text-sm font-semibold">
                    {selectedMember.user.first_name} {selectedMember.user.last_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedMember.user.email} · {selectedMember.member_code}
                  </p>
                </div>
                <button onClick={() => setSelectedMember(null)} className="text-xs text-teal-600 hover:underline">
                  Change
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email…"
                    value={memberSearch}
                    onChange={e => setMemberSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {searchMembers.length > 0 && (
                  <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                    {searchMembers.map(m => (
                      <button
                        key={m.id}
                        onClick={() => setSelectedMember(m)}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted/40 transition-colors"
                      >
                        <span className="font-medium">
                          {m.user.first_name} {m.user.last_name}
                        </span>
                        <span className="text-muted-foreground ml-2">{m.user.email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Buyer details */}
        <Card>
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold mb-3">Buyer Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Buyer GSTIN <span className="font-normal">(optional)</span>
                </Label>
                <Input value={buyerGstin} onChange={e => setBuyerGstin(e.target.value)} placeholder="22AAAAA0000A1Z5" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Buyer Address <span className="font-normal">(optional)</span>
                </Label>
                <Input value={buyerAddress} onChange={e => setBuyerAddress(e.target.value)} placeholder="City, State" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Line items */}
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Line Items *</h2>
              <Button size="sm" variant="outline" onClick={() => setLines(ls => [...ls, emptyLine()])}>
                <Plus className="h-3.5 w-3.5" /> Add Line
              </Button>
            </div>
            <div className="rounded-lg border overflow-visible">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">Description</th>
                    <th className="text-right px-3 py-2 font-medium text-xs text-muted-foreground w-16">Qty</th>
                    <th className="text-right px-3 py-2 font-medium text-xs text-muted-foreground w-28">Unit Price</th>
                    <th className="text-right px-3 py-2 font-medium text-xs text-muted-foreground w-24">Discount</th>
                    <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground w-36">Tax Rate</th>
                    <th className="text-right px-3 py-2 font-medium text-xs text-muted-foreground w-24">Total</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lines.map((line, i) => (
                    <tr key={i}>
                      <td className="px-2 py-2">
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
                          placeholder="e.g. Monthly membership"
                          className="h-8 text-xs"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Input type="number" min="1" value={line.quantity}
                          onChange={e => updateLine(i, 'quantity', e.target.value)}
                          className="h-8 text-xs text-right w-16" />
                      </td>
                      <td className="px-2 py-2">
                        <Input type="number" min="0" value={line.unit_price}
                          onChange={e => updateLine(i, 'unit_price', e.target.value)}
                          placeholder="0" className="h-8 text-xs text-right w-28" />
                      </td>
                      <td className="px-2 py-2">
                        <Input type="number" min="0" value={line.discount_amount}
                          onChange={e => updateLine(i, 'discount_amount', e.target.value)}
                          className="h-8 text-xs text-right w-24" />
                      </td>
                      <td className="px-2 py-2">
                        <select
                          value={line.tax_rate_id}
                          onChange={e => updateLine(i, 'tax_rate_id', e.target.value)}
                          className="h-8 w-36 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                        >
                          <option value="">No tax</option>
                          {taxRates.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2 text-right font-medium text-xs">
                        {formatCurrency(lineSubtotals[i]?.total ?? 0)}
                      </td>
                      <td className="px-2 py-2">
                        {lines.length > 1 && (
                          <button onClick={() => setLines(ls => ls.filter((_, idx) => idx !== i))}
                            className="text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/20 border-t text-xs font-semibold">
                    <td colSpan={5} className="px-3 py-2.5 text-right text-muted-foreground">
                      Taxable {formatCurrency(grandTotal.taxable)} · Tax {formatCurrency(grandTotal.tax)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-base">{formatCurrency(grandTotal.total)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardContent className="p-5 space-y-2">
            <Label className="text-sm font-semibold">
              Notes <span className="text-muted-foreground font-normal text-xs">(optional)</span>
            </Label>
            <textarea
              value={invoiceNotes}
              onChange={e => setInvoiceNotes(e.target.value)}
              rows={3}
              placeholder="Additional notes on the invoice…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </CardContent>
        </Card>

        {/* Footer actions */}
        <div className="flex justify-end gap-3 pb-6">
          <Button variant="outline" onClick={() => navigate('/billing/invoices')}>Cancel</Button>
          <Button
            disabled={!canCreate || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            <FileText className="h-4 w-4" />
            {createMutation.isPending ? 'Creating…' : 'Create Invoice'}
          </Button>
        </div>
      </div>
    </div>
  )
}
