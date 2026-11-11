import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { billingApi, type Invoice, type TaxRate } from '@/api/billing.api'
import { membersApi } from '@/api/members.api'
import { QUERY_KEYS } from '@/lib/constants'
import { formatCurrency, formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import { Plus, Trash2, Search } from 'lucide-react'
import type { Member } from '@/types/member.types'

const PER_PAGE = 20

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

export default function InvoicesPage() {
  const [page, setPage] = useState(1)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const qc = useQueryClient()

  // ── Create invoice state ──────────────────────────────────────────────────
  const [memberSearch, setMemberSearch]       = useState('')
  const [selectedMember, setSelectedMember]   = useState<Member | null>(null)
  const [lines, setLines]                     = useState<LineItem[]>([emptyLine()])
  const [buyerGstin, setBuyerGstin]           = useState('')
  const [buyerAddress, setBuyerAddress]       = useState('')
  const [invoiceNotes, setInvoiceNotes]       = useState('')

  const { data: membersData } = useQuery({
    queryKey: ['invoice-member-search', memberSearch],
    queryFn: () => membersApi.list({ search: memberSearch, per_page: 10 }),
    enabled: showCreateDialog && !selectedMember,
  })
  const { data: taxRatesData } = useQuery({
    queryKey: ['tax-rates'],
    queryFn: () => billingApi.listTaxRates(),
    enabled: showCreateDialog,
  })

  const searchMembers: Member[] = (membersData as any)?.members ?? []
  const taxRates: TaxRate[]     = (taxRatesData as any)?.tax_rates ?? []

  function updateLine(i: number, field: keyof LineItem, value: string) {
    setLines(ls => ls.map((l, idx) => idx === i ? { ...l, [field]: value } : l))
  }

  const lineSubtotals = useMemo(() => lines.map(l => {
    const base     = Number(l.quantity || 0) * Number(l.unit_price || 0)
    const disc     = Number(l.discount_amount || 0)
    const taxable  = Math.max(0, base - disc)
    const rate     = taxRates.find(r => String(r.id) === l.tax_rate_id)
    const taxPct   = rate ? (rate.cgst_rate + rate.sgst_rate + rate.igst_rate) : 0
    const tax      = taxable * (taxPct / 100)
    return { base, disc, taxable, tax, total: taxable + tax }
  }), [lines, taxRates])

  const grandTotal = lineSubtotals.reduce((s, l) => ({ taxable: s.taxable + l.taxable, tax: s.tax + l.tax, total: s.total + l.total }), { taxable: 0, tax: 0, total: 0 })

  function resetCreate() {
    setSelectedMember(null); setMemberSearch('')
    setLines([emptyLine()]); setBuyerGstin(''); setBuyerAddress(''); setInvoiceNotes('')
  }

  const createMutation = useMutation({
    mutationFn: () => billingApi.createInvoice({
      member_id:    selectedMember!.id,
      facility_id:  1,
      buyer_gstin:  buyerGstin,
      buyer_address: buyerAddress,
      notes:        invoiceNotes,
      lines: lines.map(l => ({
        description:    l.description,
        quantity:       Number(l.quantity),
        unit_price:     Number(l.unit_price),
        discount_amount: Number(l.discount_amount),
        tax_rate_id:    l.tax_rate_id ? Number(l.tax_rate_id) : undefined,
      })),
    }),
    onSuccess: () => {
      toast.success('Invoice created')
      qc.invalidateQueries({ queryKey: ['billing', 'invoices'] })
      setShowCreateDialog(false)
      resetCreate()
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to create invoice'),
  })

  const canCreate = selectedMember && lines.every(l => l.description && Number(l.unit_price) > 0)

  // ── List data ─────────────────────────────────────────────────────────────
  const { data, isLoading, isError } = useQuery({
    queryKey: QUERY_KEYS.invoices({ page, per_page: PER_PAGE }),
    queryFn: () => billingApi.listInvoices({ page, per_page: PER_PAGE }),
  })

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      billingApi.cancelInvoice(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing', 'invoices'] })
      setShowCancelDialog(false)
      setSelectedInvoice(null)
      setCancelReason('')
    },
  })

  const invoices: Invoice[] = (data as { invoices?: Invoice[] })?.invoices ?? []
  const meta = (data as { meta?: { total?: number } })?.meta
  const total = meta?.total ?? 0
  const statusColor = (s: string) => s === 'issued' ? 'green' : s === 'cancelled' ? 'red' : 'yellow'

  return (
    <div>
      <PageHeader
        title="GST Invoices"
        subtitle="Tax invoices issued to members"
        actions={
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-1" /> Create Invoice
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {isError && <div className="p-6 text-sm text-destructive">Failed to load invoices.</div>}
          {isLoading ? (
            <div className="p-6 space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : !isError && invoices.length === 0 ? (
            <EmptyState title="No invoices found" description="Create an invoice using the button above." />
          ) : (
            <div className="rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-sidebar">
                  <tr>
                    {['Invoice #', 'Member', 'Date', 'Total', 'Tax', 'Status', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium text-primary">{inv.invoice_number}</td>
                      <td className="px-4 py-3">{inv.buyer_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(inv.issue_date)}</td>
                      <td className="px-4 py-3 font-medium">{formatCurrency(inv.total)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatCurrency(inv.tax_amount)}</td>
                      <td className="px-4 py-3"><StatusBadge status={inv.status} color={statusColor(inv.status)} /></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => setSelectedInvoice(inv)}>View</Button>
                          {inv.status === 'issued' && (
                            <Button size="sm" variant="destructive"
                              onClick={() => { setSelectedInvoice(inv); setShowCancelDialog(true) }}>
                              Cancel
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {total > PER_PAGE && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-sm text-muted-foreground">
                Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} of {total}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                <Button size="sm" variant="outline" disabled={page * PER_PAGE >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Create Invoice Dialog ── */}
      <Dialog open={showCreateDialog} onOpenChange={open => { if (!open) { setShowCreateDialog(false); resetCreate() } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">

            {/* Member search */}
            <div className="space-y-2">
              <Label>Member *</Label>
              {selectedMember ? (
                <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-teal-50 border border-teal-200">
                  <div>
                    <p className="text-sm font-semibold">{selectedMember.user.first_name} {selectedMember.user.last_name}</p>
                    <p className="text-xs text-muted-foreground">{selectedMember.user.email} · {selectedMember.member_code}</p>
                  </div>
                  <button onClick={() => setSelectedMember(null)} className="text-xs text-teal-600 hover:underline">Change</button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search by name or email…" value={memberSearch}
                      onChange={e => setMemberSearch(e.target.value)} className="pl-9" />
                  </div>
                  {searchMembers.length > 0 && (
                    <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
                      {searchMembers.map(m => (
                        <button key={m.id} onClick={() => setSelectedMember(m)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted/40 transition-colors">
                          <span className="font-medium">{m.user.first_name} {m.user.last_name}</span>
                          <span className="text-muted-foreground ml-2">{m.user.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* GSTIN + Address */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Buyer GSTIN <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input value={buyerGstin} onChange={e => setBuyerGstin(e.target.value)} placeholder="22AAAAA0000A1Z5" />
              </div>
              <div className="space-y-1.5">
                <Label>Buyer Address <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input value={buyerAddress} onChange={e => setBuyerAddress(e.target.value)} placeholder="City, State" />
              </div>
            </div>

            {/* Line items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Line Items *</Label>
                <Button size="sm" variant="outline" onClick={() => setLines(ls => [...ls, emptyLine()])}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Line
                </Button>
              </div>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">Description</th>
                      <th className="text-right px-3 py-2 font-medium text-xs text-muted-foreground w-16">Qty</th>
                      <th className="text-right px-3 py-2 font-medium text-xs text-muted-foreground w-24">Unit Price</th>
                      <th className="text-right px-3 py-2 font-medium text-xs text-muted-foreground w-20">Discount</th>
                      <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground w-32">Tax Rate</th>
                      <th className="text-right px-3 py-2 font-medium text-xs text-muted-foreground w-24">Total</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {lines.map((line, i) => (
                      <tr key={i}>
                        <td className="px-2 py-1.5">
                          <Input value={line.description} onChange={e => updateLine(i, 'description', e.target.value)}
                            placeholder="e.g. Monthly membership" className="h-8 text-xs" />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input type="number" min="1" value={line.quantity} onChange={e => updateLine(i, 'quantity', e.target.value)}
                            className="h-8 text-xs text-right w-16" />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input type="number" min="0" value={line.unit_price} onChange={e => updateLine(i, 'unit_price', e.target.value)}
                            placeholder="0" className="h-8 text-xs text-right w-24" />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input type="number" min="0" value={line.discount_amount} onChange={e => updateLine(i, 'discount_amount', e.target.value)}
                            className="h-8 text-xs text-right w-20" />
                        </td>
                        <td className="px-2 py-1.5">
                          <select value={line.tax_rate_id} onChange={e => updateLine(i, 'tax_rate_id', e.target.value)}
                            className="h-8 w-32 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-teal-400">
                            <option value="">No tax</option>
                            {taxRates.map(r => (
                              <option key={r.id} value={r.id}>
                                {r.name} ({r.cgst_rate + r.sgst_rate}%)
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1.5 text-right font-medium text-xs">
                          {formatCurrency(lineSubtotals[i]?.total ?? 0)}
                        </td>
                        <td className="px-2 py-1.5">
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
                    <tr className="bg-muted/20 border-t font-semibold text-xs">
                      <td colSpan={5} className="px-3 py-2 text-right text-muted-foreground">
                        Taxable {formatCurrency(grandTotal.taxable)} · Tax {formatCurrency(grandTotal.tax)}
                      </td>
                      <td className="px-3 py-2 text-right">{formatCurrency(grandTotal.total)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <textarea value={invoiceNotes} onChange={e => setInvoiceNotes(e.target.value)} rows={2}
                placeholder="Additional notes on the invoice…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetCreate() }}>Cancel</Button>
              <Button disabled={!canCreate || createMutation.isPending} onClick={() => createMutation.mutate()}>
                {createMutation.isPending ? 'Creating…' : 'Create Invoice'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invoice Detail Dialog */}
      {selectedInvoice && !showCancelDialog && (
        <Dialog open onOpenChange={() => setSelectedInvoice(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Invoice {selectedInvoice.invoice_number}</DialogTitle>
            </DialogHeader>
            <InvoiceDetail invoice={selectedInvoice} />
          </DialogContent>
        </Dialog>
      )}

      {/* Cancel Invoice Dialog */}
      {showCancelDialog && selectedInvoice && (
        <Dialog open onOpenChange={() => { setShowCancelDialog(false); setSelectedInvoice(null) }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel Invoice {selectedInvoice.invoice_number}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                This action is irreversible. The invoice will be marked as cancelled.
              </p>
              <div className="space-y-2">
                <Label htmlFor="cancel-reason">Reason *</Label>
                <Input id="cancel-reason" value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)} placeholder="Enter cancellation reason" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setShowCancelDialog(false); setSelectedInvoice(null) }}>Back</Button>
                <Button variant="destructive" disabled={!cancelReason || cancelMutation.isPending}
                  onClick={() => cancelMutation.mutate({ id: selectedInvoice.id, reason: cancelReason })}>
                  {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Invoice'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function InvoiceDetail({ invoice }: { invoice: Invoice }) {
  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Seller</p>
          <p className="font-medium">{invoice.seller_name}</p>
          {invoice.seller_gstin && <p className="text-muted-foreground">GSTIN: {invoice.seller_gstin}</p>}
          <p className="text-muted-foreground text-xs">{invoice.seller_address}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Bill To</p>
          <p className="font-medium">{invoice.buyer_name}</p>
          <p className="text-muted-foreground">{invoice.buyer_email}</p>
          {invoice.buyer_phone && <p className="text-muted-foreground">{invoice.buyer_phone}</p>}
          {invoice.buyer_gstin && <p className="text-muted-foreground">GSTIN: {invoice.buyer_gstin}</p>}
        </div>
      </div>

      {invoice.lines && invoice.lines.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Line Items</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="text-left py-1">Description</th>
                <th className="text-right py-1">Qty</th>
                <th className="text-right py-1">Rate</th>
                <th className="text-right py-1">Tax%</th>
                <th className="text-right py-1">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((line) => (
                <tr key={line.id} className="border-b border-dashed">
                  <td className="py-1">{line.description}</td>
                  <td className="py-1 text-right">{line.quantity}</td>
                  <td className="py-1 text-right">{formatCurrency(line.unit_price)}</td>
                  <td className="py-1 text-right">{line.tax_rate_snapshot}%</td>
                  <td className="py-1 text-right font-medium">{formatCurrency(line.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-t pt-3 space-y-1 text-right">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatCurrency(invoice.subtotal)}</span>
        </div>
        {invoice.discount_amount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Discount</span>
            <span>-{formatCurrency(invoice.discount_amount)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Tax (GST)</span>
          <span>{formatCurrency(invoice.tax_amount)}</span>
        </div>
        <div className="flex justify-between font-semibold text-base border-t pt-1">
          <span>Total</span>
          <span>{formatCurrency(invoice.total)}</span>
        </div>
      </div>

      {invoice.cancel_reason && (
        <div className="bg-destructive/10 text-destructive rounded p-3 text-xs">
          <strong>Cancelled:</strong> {invoice.cancel_reason}
        </div>
      )}
    </div>
  )
}
