import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { billingApi, type Invoice } from '@/api/billing.api'
import { QUERY_KEYS } from '@/lib/constants'
import { Label } from '@/components/ui/label'
import { formatCurrency, formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'

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
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const qc = useQueryClient()

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
          <Button onClick={() => navigate('/billing/invoices/new')}>
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

      {/* Invoice Detail Dialog */}
      {selectedInvoice && !showCancelDialog && (
        <Dialog open onOpenChange={() => setSelectedInvoice(null)}>
          <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0">
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

function amountInWords(amount: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  const toWords = (n: number): string => {
    if (n === 0) return ''
    if (n < 20) return ones[n] + ' '
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '') + ' '
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred ' + toWords(n % 100)
    if (n < 100000) return toWords(Math.floor(n / 1000)) + 'Thousand ' + toWords(n % 1000)
    if (n < 10000000) return toWords(Math.floor(n / 100000)) + 'Lakh ' + toWords(n % 100000)
    return toWords(Math.floor(n / 10000000)) + 'Crore ' + toWords(n % 10000000)
  }
  const rupees = Math.floor(amount)
  const paise = Math.round((amount - rupees) * 100)
  let words = toWords(rupees).trim()
  if (paise > 0) words += ` and ${toWords(paise).trim()} Paise`
  return words + ' Only'
}

function InvoiceDetail({ invoice }: { invoice: Invoice }) {
  const totalCGST = (invoice.lines ?? []).reduce((s, l) => s + (l.cgst_amount ?? 0), 0)
  const totalSGST = (invoice.lines ?? []).reduce((s, l) => s + (l.sgst_amount ?? 0), 0)
  const totalIGST = (invoice.lines ?? []).reduce((s, l) => s + (l.igst_amount ?? 0), 0)
  const isCancelled = invoice.status === 'cancelled'

  return (
    <div className="bg-white text-gray-900 font-sans">
      {/* Cancelled watermark */}
      {isCancelled && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 rotate-[-35deg]">
          <span className="text-red-500/20 text-[80px] font-black uppercase tracking-widest select-none">CANCELLED</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-[#0f2d4a] text-white px-8 py-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-wide">{invoice.seller_name}</h1>
          {invoice.seller_gstin && (
            <p className="text-xs text-blue-200 mt-0.5">GSTIN: {invoice.seller_gstin}</p>
          )}
          {invoice.seller_address && (
            <p className="text-xs text-blue-100/70 mt-1 max-w-xs leading-snug">{invoice.seller_address}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold tracking-[0.2em] text-blue-200 uppercase">Tax Invoice</p>
          <p className="text-2xl font-black mt-0.5 font-mono">{invoice.invoice_number}</p>
          <p className="text-xs text-blue-200 mt-1">Date: {formatDate(invoice.issue_date)}</p>
          <span className={`inline-block mt-1.5 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
            isCancelled ? 'bg-red-500/80 text-white' : 'bg-emerald-400/90 text-emerald-900'
          }`}>
            {invoice.status}
          </span>
        </div>
      </div>

      {/* Parties */}
      <div className="grid grid-cols-2 gap-0 border-b border-gray-200">
        <div className="px-8 py-4 border-r border-gray-200">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Supplier (Seller)</p>
          <p className="font-semibold text-sm text-gray-900">{invoice.seller_name}</p>
          {invoice.seller_gstin && <p className="text-xs text-gray-600 mt-0.5">GSTIN: <span className="font-mono font-medium">{invoice.seller_gstin}</span></p>}
          {invoice.seller_address && <p className="text-xs text-gray-500 mt-1 leading-snug">{invoice.seller_address}</p>}
        </div>
        <div className="px-8 py-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Recipient (Bill To)</p>
          <p className="font-semibold text-sm text-gray-900">{invoice.buyer_name}</p>
          {invoice.buyer_phone && <p className="text-xs text-gray-600 mt-0.5">{invoice.buyer_phone}</p>}
          {invoice.buyer_email && <p className="text-xs text-gray-500">{invoice.buyer_email}</p>}
          {invoice.buyer_gstin && <p className="text-xs text-gray-600 mt-0.5">GSTIN: <span className="font-mono font-medium">{invoice.buyer_gstin}</span></p>}
          {invoice.buyer_address && <p className="text-xs text-gray-500 mt-1 leading-snug">{invoice.buyer_address}</p>}
        </div>
      </div>

      {/* Line Items */}
      {invoice.lines && invoice.lines.length > 0 && (
        <div className="px-8 py-4">
          <table className="w-full text-xs border border-gray-200 rounded">
            <thead>
              <tr className="bg-gray-50 text-gray-500 uppercase text-[10px] tracking-wide">
                <th className="text-left px-3 py-2 border-b border-gray-200 font-semibold">#</th>
                <th className="text-left px-3 py-2 border-b border-gray-200 font-semibold">Description</th>
                <th className="text-right px-3 py-2 border-b border-gray-200 font-semibold">Qty</th>
                <th className="text-right px-3 py-2 border-b border-gray-200 font-semibold">Rate</th>
                <th className="text-right px-3 py-2 border-b border-gray-200 font-semibold">Discount</th>
                <th className="text-right px-3 py-2 border-b border-gray-200 font-semibold">Taxable</th>
                <th className="text-right px-3 py-2 border-b border-gray-200 font-semibold">GST%</th>
                <th className="text-right px-3 py-2 border-b border-gray-200 font-semibold">CGST</th>
                <th className="text-right px-3 py-2 border-b border-gray-200 font-semibold">SGST</th>
                <th className="text-right px-3 py-2 border-b border-gray-200 font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((line, i) => (
                <tr key={line.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                  <td className="px-3 py-2 font-medium text-gray-800">{line.description}</td>
                  <td className="px-3 py-2 text-right">{line.quantity}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(line.unit_price)}</td>
                  <td className="px-3 py-2 text-right text-green-700">{line.discount_amount > 0 ? `-${formatCurrency(line.discount_amount)}` : '—'}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(line.taxable_amount)}</td>
                  <td className="px-3 py-2 text-right">{line.tax_rate_snapshot}%</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(line.cgst_amount)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(line.sgst_amount)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatCurrency(line.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tax summary + Totals */}
      <div className="px-8 pb-4 grid grid-cols-2 gap-6">
        {/* Tax breakdown */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Tax Summary</p>
          <table className="w-full text-xs border border-gray-200 rounded">
            <thead>
              <tr className="bg-gray-50 text-gray-500 uppercase text-[10px] tracking-wide">
                <th className="text-left px-3 py-1.5 border-b font-semibold">Tax Type</th>
                <th className="text-right px-3 py-1.5 border-b font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              {totalCGST > 0 && <tr className="border-b border-gray-100"><td className="px-3 py-1.5">CGST</td><td className="px-3 py-1.5 text-right">{formatCurrency(totalCGST)}</td></tr>}
              {totalSGST > 0 && <tr className="border-b border-gray-100"><td className="px-3 py-1.5">SGST</td><td className="px-3 py-1.5 text-right">{formatCurrency(totalSGST)}</td></tr>}
              {totalIGST > 0 && <tr className="border-b border-gray-100"><td className="px-3 py-1.5">IGST</td><td className="px-3 py-1.5 text-right">{formatCurrency(totalIGST)}</td></tr>}
              <tr className="font-semibold bg-gray-50"><td className="px-3 py-1.5">Total GST</td><td className="px-3 py-1.5 text-right">{formatCurrency(invoice.tax_amount)}</td></tr>
            </tbody>
          </table>
        </div>

        {/* Amount summary */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Amount Summary</p>
          <div className="border border-gray-200 rounded text-xs">
            <div className="flex justify-between px-3 py-1.5 border-b border-gray-100">
              <span className="text-gray-500">Subtotal</span>
              <span>{formatCurrency(invoice.subtotal)}</span>
            </div>
            {invoice.discount_amount > 0 && (
              <div className="flex justify-between px-3 py-1.5 border-b border-gray-100 text-green-700">
                <span>Discount</span>
                <span>-{formatCurrency(invoice.discount_amount)}</span>
              </div>
            )}
            <div className="flex justify-between px-3 py-1.5 border-b border-gray-100">
              <span className="text-gray-500">Taxable Amount</span>
              <span>{formatCurrency(invoice.taxable_amount)}</span>
            </div>
            <div className="flex justify-between px-3 py-1.5 border-b border-gray-100">
              <span className="text-gray-500">Total GST</span>
              <span>{formatCurrency(invoice.tax_amount)}</span>
            </div>
            <div className="flex justify-between px-3 py-2 bg-[#0f2d4a] text-white rounded-b font-bold text-sm">
              <span>Grand Total</span>
              <span>{formatCurrency(invoice.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Amount in words */}
      <div className="mx-8 mb-4 bg-gray-50 border border-gray-200 rounded px-4 py-2.5 text-xs">
        <span className="text-gray-400 font-semibold uppercase tracking-wide text-[10px]">Amount in Words: </span>
        <span className="text-gray-700 font-medium">INR {amountInWords(invoice.total)}</span>
      </div>

      {/* Notes */}
      {invoice.notes && (
        <div className="mx-8 mb-4 text-xs text-gray-500 border-t border-dashed border-gray-200 pt-3">
          <span className="font-semibold text-gray-600">Notes: </span>{invoice.notes}
        </div>
      )}

      {/* Cancelled reason */}
      {invoice.cancel_reason && (
        <div className="mx-8 mb-4 bg-red-50 border border-red-200 rounded px-4 py-2.5 text-xs text-red-700">
          <strong>Cancellation Reason:</strong> {invoice.cancel_reason}
        </div>
      )}

      {/* Footer */}
      <div className="mx-8 mb-6 mt-2 flex justify-between items-end">
        <p className="text-[10px] text-gray-400">This is a computer generated invoice and does not require a physical signature.</p>
        <div className="text-right">
          <div className="border-t border-gray-300 pt-1 text-xs text-gray-500 w-36">
            <p className="font-medium text-gray-700">{invoice.seller_name}</p>
            <p>Authorised Signatory</p>
          </div>
        </div>
      </div>
    </div>
  )
}
