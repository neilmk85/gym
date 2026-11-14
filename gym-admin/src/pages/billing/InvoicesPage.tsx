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
