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
import { Plus, Printer } from 'lucide-react'

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

function printInvoice(invoice: Invoice) {
  const fmtC = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n)
  const fmtD = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const totalCGST = (invoice.lines ?? []).reduce((s, l) => s + (l.cgst_amount ?? 0), 0)
  const totalSGST = (invoice.lines ?? []).reduce((s, l) => s + (l.sgst_amount ?? 0), 0)
  const totalIGST = (invoice.lines ?? []).reduce((s, l) => s + (l.igst_amount ?? 0), 0)
  const isCancelled = invoice.status === 'cancelled'

  const lineRows = (invoice.lines ?? []).map((l, i) => `
    <tr>
      <td>${i + 1}</td><td>${l.description}</td><td style="text-align:right">${l.quantity}</td>
      <td style="text-align:right">${fmtC(l.unit_price)}</td>
      <td style="text-align:right;color:#15803d">${l.discount_amount > 0 ? `-${fmtC(l.discount_amount)}` : '—'}</td>
      <td style="text-align:right">${fmtC(l.taxable_amount)}</td>
      <td style="text-align:right">${l.tax_rate_snapshot}%</td>
      <td style="text-align:right">${fmtC(l.cgst_amount)}</td>
      <td style="text-align:right">${fmtC(l.sgst_amount)}</td>
      <td style="text-align:right;font-weight:600">${fmtC(l.line_total)}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>${invoice.invoice_number}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; background: #fff; }
    .header { background: #0f2d4a; color: #fff; padding: 20px 32px; display: flex; justify-content: space-between; align-items: flex-start; }
    .header h1 { font-size: 18px; font-weight: 700; }
    .header .meta { text-align: right; }
    .header .inv-num { font-size: 20px; font-weight: 900; font-family: monospace; }
    .header .label { font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; color: #93c5fd; }
    .header .sub { font-size: 10px; color: #bfdbfe; margin-top: 2px; }
    .status { display: inline-block; margin-top: 6px; padding: 2px 8px; border-radius: 999px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; background: ${isCancelled ? '#ef4444' : '#34d399'}; color: ${isCancelled ? '#fff' : '#064e3b'}; }
    .parties { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #e5e7eb; }
    .party { padding: 16px 32px; }
    .party:first-child { border-right: 1px solid #e5e7eb; }
    .party-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #9ca3af; margin-bottom: 6px; }
    .party p { margin-bottom: 2px; color: #374151; font-size: 11px; }
    .party .name { font-weight: 600; font-size: 13px; color: #111; }
    section { padding: 16px 32px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #f9fafb; color: #6b7280; font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; padding: 6px 8px; border: 1px solid #e5e7eb; }
    td { padding: 6px 8px; border: 1px solid #e5e7eb; color: #374151; }
    .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; padding: 0 32px 16px; }
    .summary-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #9ca3af; margin-bottom: 8px; }
    .total-row { display: flex; justify-content: space-between; padding: 5px 10px; border-bottom: 1px solid #f3f4f6; }
    .total-row.grand { background: #0f2d4a; color: #fff; font-weight: 700; font-size: 13px; padding: 8px 10px; border-radius: 0 0 4px 4px; }
    .words-box { margin: 0 32px 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; padding: 8px 12px; font-size: 11px; }
    .footer { margin: 0 32px 24px; display: flex; justify-content: space-between; align-items: flex-end; }
    .footer .note { font-size: 9px; color: #9ca3af; max-width: 300px; }
    .sig-block { text-align: right; border-top: 1px solid #9ca3af; padding-top: 4px; min-width: 140px; font-size: 10px; color: #6b7280; }
    .sig-block strong { display: block; color: #374151; }
    .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-35deg); font-size: 90px; font-weight: 900; color: rgba(239,68,68,0.12); text-transform: uppercase; letter-spacing: 0.1em; pointer-events: none; }
    @media print { @page { margin: 0.5cm; size: A4; } }
  </style></head><body>
  ${isCancelled ? '<div class="watermark">CANCELLED</div>' : ''}
  <div class="header">
    <div>
      <h1>${invoice.seller_name}</h1>
      ${invoice.seller_gstin ? `<div class="sub">GSTIN: ${invoice.seller_gstin}</div>` : ''}
      ${invoice.seller_address ? `<div class="sub">${invoice.seller_address}</div>` : ''}
    </div>
    <div class="meta">
      <div class="label">Tax Invoice</div>
      <div class="inv-num">${invoice.invoice_number}</div>
      <div class="sub">Date: ${fmtD(invoice.issue_date)}</div>
      <div class="status">${invoice.status}</div>
    </div>
  </div>
  <div class="parties">
    <div class="party">
      <div class="party-label">Supplier (Seller)</div>
      <p class="name">${invoice.seller_name}</p>
      ${invoice.seller_gstin ? `<p>GSTIN: ${invoice.seller_gstin}</p>` : ''}
      ${invoice.seller_address ? `<p>${invoice.seller_address}</p>` : ''}
    </div>
    <div class="party">
      <div class="party-label">Recipient (Bill To)</div>
      <p class="name">${invoice.buyer_name}</p>
      ${invoice.buyer_phone ? `<p>${invoice.buyer_phone}</p>` : ''}
      ${invoice.buyer_email ? `<p>${invoice.buyer_email}</p>` : ''}
      ${invoice.buyer_gstin ? `<p>GSTIN: ${invoice.buyer_gstin}</p>` : ''}
      ${invoice.buyer_address ? `<p>${invoice.buyer_address}</p>` : ''}
    </div>
  </div>
  ${(invoice.lines ?? []).length > 0 ? `
  <section>
    <table>
      <thead><tr>
        <th>#</th><th style="text-align:left">Description</th><th style="text-align:right">Qty</th>
        <th style="text-align:right">Rate</th><th style="text-align:right">Discount</th>
        <th style="text-align:right">Taxable</th><th style="text-align:right">GST%</th>
        <th style="text-align:right">CGST</th><th style="text-align:right">SGST</th>
        <th style="text-align:right">Total</th>
      </tr></thead>
      <tbody>${lineRows}</tbody>
    </table>
  </section>` : ''}
  <div class="summary-grid">
    <div>
      <div class="summary-label">Tax Summary</div>
      <table>
        <thead><tr><th style="text-align:left">Tax Type</th><th style="text-align:right">Amount</th></tr></thead>
        <tbody>
          ${totalCGST > 0 ? `<tr><td>CGST</td><td style="text-align:right">${fmtC(totalCGST)}</td></tr>` : ''}
          ${totalSGST > 0 ? `<tr><td>SGST</td><td style="text-align:right">${fmtC(totalSGST)}</td></tr>` : ''}
          ${totalIGST > 0 ? `<tr><td>IGST</td><td style="text-align:right">${fmtC(totalIGST)}</td></tr>` : ''}
          <tr style="font-weight:600;background:#f9fafb"><td>Total GST</td><td style="text-align:right">${fmtC(invoice.tax_amount)}</td></tr>
        </tbody>
      </table>
    </div>
    <div>
      <div class="summary-label">Amount Summary</div>
      <div style="border:1px solid #e5e7eb;border-radius:4px;overflow:hidden">
        <div class="total-row"><span style="color:#6b7280">Subtotal</span><span>${fmtC(invoice.subtotal)}</span></div>
        ${invoice.discount_amount > 0 ? `<div class="total-row" style="color:#15803d"><span>Discount</span><span>-${fmtC(invoice.discount_amount)}</span></div>` : ''}
        <div class="total-row"><span style="color:#6b7280">Taxable Amount</span><span>${fmtC(invoice.taxable_amount)}</span></div>
        <div class="total-row"><span style="color:#6b7280">Total GST</span><span>${fmtC(invoice.tax_amount)}</span></div>
        <div class="total-row grand"><span>Grand Total</span><span>${fmtC(invoice.total)}</span></div>
      </div>
    </div>
  </div>
  <div class="words-box"><span style="color:#9ca3af;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em">Amount in Words: </span><strong style="color:#374151">INR ${amountInWords(invoice.total)}</strong></div>
  ${invoice.notes ? `<div style="margin:0 32px 12px;font-size:11px;color:#6b7280"><strong>Notes:</strong> ${invoice.notes}</div>` : ''}
  ${isCancelled && invoice.cancel_reason ? `<div style="margin:0 32px 12px;background:#fef2f2;border:1px solid #fecaca;border-radius:4px;padding:8px 12px;font-size:11px;color:#b91c1c"><strong>Cancellation Reason:</strong> ${invoice.cancel_reason}</div>` : ''}
  <div class="footer">
    <div class="note">This is a computer generated invoice and does not require a physical signature.</div>
    <div class="sig-block"><strong>${invoice.seller_name}</strong>Authorised Signatory</div>
  </div>
  <script>window.onload = () => { window.print() }<\/script>
  </body></html>`

  const win = window.open('', '_blank', 'width=900,height=700')
  if (win) { win.document.write(html); win.document.close() }
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
        <div className="text-right flex flex-col items-end gap-1">
          <p className="text-xs font-semibold tracking-[0.2em] text-blue-200 uppercase">Tax Invoice</p>
          <p className="text-2xl font-black font-mono">{invoice.invoice_number}</p>
          <p className="text-xs text-blue-200">Date: {formatDate(invoice.issue_date)}</p>
          <span className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
            isCancelled ? 'bg-red-500/80 text-white' : 'bg-emerald-400/90 text-emerald-900'
          }`}>
            {invoice.status}
          </span>
          <button
            onClick={() => printInvoice(invoice)}
            className="mt-2 flex items-center gap-1.5 bg-white/15 hover:bg-white/25 transition-colors text-white text-xs font-medium px-3 py-1.5 rounded-md"
          >
            <Printer className="h-3.5 w-3.5" />
            Print / Download PDF
          </button>
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
