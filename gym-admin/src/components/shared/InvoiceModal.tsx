import { useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { facilitiesApi } from '@/api/facilities.api'
import { formatDate } from '@/lib/utils'
import { Printer, Download, X } from 'lucide-react'
import type { Payment } from '@/types/payment.types'
import logoUrl from '@/assets/stayfit-logo.jpg'

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash', upi: 'UPI', card: 'Card / POS',
  bank_transfer: 'Bank Transfer', razorpay: 'Razorpay', other: 'Other',
}

function fmt(n?: number) {
  return n !== undefined
    ? `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '—'
}

function MetaCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{value}</div>
    </div>
  )
}

function InvoiceDocument({ payment, facility }: { payment: Payment; facility: any }) {
  const member   = payment.member
  const memberName = member?.user
    ? `${member.user.first_name} ${member.user.last_name}`
    : `Member #${payment.member_id}`
  const plan = payment.subscription?.plan
  const sub  = payment.subscription
  const invoiceNo = `INV-${String(payment.id).padStart(6, '0')}`
  const paidDate  = payment.paid_at || payment.created_at
  const isRefund  = payment.status === 'refunded'

  const originalAmt = sub?.original_amount ?? payment.amount
  const discountAmt = sub?.discount_amount ?? 0
  const totalPaid   = isRefund && payment.refund_amount
    ? payment.amount - payment.refund_amount
    : payment.amount

  const statusColor = payment.status === 'completed'
    ? { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7' }
    : payment.status === 'refunded'
    ? { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' }
    : { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' }

  return (
    <div id="invoice-print" style={{ background: '#fff', color: '#111827', fontFamily: 'system-ui, -apple-system, sans-serif', minWidth: 640 }}>

      {/* ── Header band ── */}
      <div style={{ background: '#1e293b', padding: '28px 40px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {/* Logo + gym name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src={logoUrl} alt="StayFit" style={{ height: 52, width: 52, objectFit: 'contain', borderRadius: 8, background: '#fff', padding: 4 }} />
          <div>
            <div style={{ color: '#fff', fontSize: 18, fontWeight: 700, letterSpacing: '-0.2px', lineHeight: 1.2 }}>
              {facility?.name || 'StayFit Health Club'}
            </div>
            {facility?.address && (
              <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 4, lineHeight: 1.6 }}>
                <div>{facility.address}</div>
                <div>{[facility.city, facility.state].filter(Boolean).join(', ')}</div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 14, marginTop: 4 }}>
              {facility?.phone && <span style={{ color: '#94a3b8', fontSize: 10 }}>{facility.phone}</span>}
              {facility?.email && <span style={{ color: '#94a3b8', fontSize: 10 }}>{facility.email}</span>}
            </div>
          </div>
        </div>
        {/* Invoice title */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#f1f5f9', fontSize: 28, fontWeight: 800, letterSpacing: '0.05em', lineHeight: 1 }}>INVOICE</div>
          <div style={{ color: '#fff', fontSize: 12, marginTop: 6, fontFamily: 'monospace', letterSpacing: '0.03em' }}>{invoiceNo}</div>
          <div style={{
            display: 'inline-flex', marginTop: 10, padding: '3px 10px', borderRadius: 4,
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
            background: statusColor.bg, color: statusColor.text, border: `1px solid ${statusColor.border}`,
          }}>
            {payment.status}
          </div>
        </div>
      </div>

      {/* ── Meta row ── */}
      <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '16px 40px', display: 'flex', gap: 36 }}>
        <MetaCell label="Invoice Date" value={formatDate(paidDate)} />
        <MetaCell label="Payment Method" value={METHOD_LABELS[payment.payment_method] ?? payment.payment_method} />
        {payment.transaction_id && (
          <MetaCell label="Transaction ID" value={<span style={{ fontFamily: 'monospace', fontSize: 11 }}>{payment.transaction_id}</span>} />
        )}
        {payment.reference_number && (
          <MetaCell label="Reference No." value={<span style={{ fontFamily: 'monospace', fontSize: 11 }}>{payment.reference_number}</span>} />
        )}
      </div>

      {/* ── Bill To + Membership Period ── */}
      <div style={{ padding: '24px 40px', display: 'flex', justifyContent: 'space-between', gap: 24, borderBottom: '1px solid #f1f5f9' }}>
        {/* Bill To */}
        <div>
          <div style={{ fontSize: 9, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 8 }}>Bill To</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{memberName}</div>
          {member?.user?.email && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>{member.user.email}</div>}
          {member?.user?.phone && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>{member.user.phone}</div>}
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Member ID: #{payment.member_id}</div>
        </div>

        {/* Membership Period */}
        {sub && (sub.start_date || sub.end_date || sub.next_renewal_date) && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '14px 20px', minWidth: 240 }}>
            <div style={{ fontSize: 9, color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 10 }}>Membership Period</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px' }}>
              {sub.start_date && (
                <div>
                  <div style={{ fontSize: 9, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginBottom: 2 }}>Start Date</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{formatDate(sub.start_date)}</div>
                </div>
              )}
              {sub.end_date && (
                <div>
                  <div style={{ fontSize: 9, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginBottom: 2 }}>End Date</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{formatDate(sub.end_date)}</div>
                </div>
              )}
              {sub.next_renewal_date && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 9, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginBottom: 2 }}>Renewal Date</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#059669' }}>{formatDate(sub.next_renewal_date)}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Line items ── */}
      <div style={{ padding: '20px 40px 0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #1e293b' }}>
              <th style={{ textAlign: 'left', padding: '8px 0 10px', fontWeight: 700, color: '#1e293b', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Description</th>
              <th style={{ textAlign: 'center', padding: '8px 0 10px', fontWeight: 700, color: '#1e293b', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', width: 60 }}>Qty</th>
              <th style={{ textAlign: 'right', padding: '8px 0 10px', fontWeight: 700, color: '#1e293b', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', width: 120 }}>Unit Price</th>
              <th style={{ textAlign: 'right', padding: '8px 0 10px', fontWeight: 700, color: '#1e293b', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', width: 120 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '14px 0' }}>
                <div style={{ fontWeight: 600, color: '#111827' }}>{plan?.name ?? 'Membership Plan'}</div>
                {sub?.id && (
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>Subscription #{sub.id}</div>
                )}
              </td>
              <td style={{ padding: '14px 0', textAlign: 'center', color: '#6b7280' }}>1</td>
              <td style={{ padding: '14px 0', textAlign: 'right', color: '#374151' }}>{fmt(originalAmt)}</td>
              <td style={{ padding: '14px 0', textAlign: 'right', fontWeight: 600, color: '#111827' }}>{fmt(originalAmt)}</td>
            </tr>
            {discountAmt > 0 && (
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 0', color: '#059669', fontStyle: 'italic', fontSize: 12 }}>Discount Applied</td>
                <td style={{ padding: '10px 0', textAlign: 'center' }}>—</td>
                <td style={{ padding: '10px 0', textAlign: 'right' }}>—</td>
                <td style={{ padding: '10px 0', textAlign: 'right', color: '#059669', fontWeight: 600 }}>−{fmt(discountAmt)}</td>
              </tr>
            )}
            {isRefund && payment.refund_amount && (
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 0', color: '#dc2626', fontSize: 12 }}>
                  Refund{payment.refund_reason && <span style={{ color: '#9ca3af', fontSize: 11 }}> — {payment.refund_reason}</span>}
                </td>
                <td style={{ padding: '10px 0', textAlign: 'center' }}>—</td>
                <td style={{ padding: '10px 0', textAlign: 'right' }}>—</td>
                <td style={{ padding: '10px 0', textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>−{fmt(payment.refund_amount)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Totals ── */}
      <div style={{ padding: '0 40px 24px', display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ minWidth: 260 }}>
          <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 0, paddingTop: 12 }}>
            {discountAmt > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, color: '#6b7280' }}>
                <span>Subtotal</span><span>{fmt(originalAmt)}</span>
              </div>
            )}
            {discountAmt > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, color: '#059669' }}>
                <span>Discount</span><span>−{fmt(discountAmt)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, color: '#6b7280' }}>
              <span>Tax (GST)</span><span>Included</span>
            </div>
            {isRefund && payment.refund_amount && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, color: '#dc2626' }}>
                <span>Refund</span><span>−{fmt(payment.refund_amount)}</span>
              </div>
            )}
          </div>
          <div style={{ borderTop: '2px solid #1e293b', marginTop: 8, paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Total Paid</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#1e293b' }}>{fmt(totalPaid)}</span>
          </div>
        </div>
      </div>

      {/* ── Notes ── */}
      {payment.notes && (
        <div style={{ padding: '0 40px 20px' }}>
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '10px 14px', fontSize: 12, color: '#6b7280' }}>
            <strong style={{ color: '#374151' }}>Notes: </strong>{payment.notes}
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '16px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 10, color: '#9ca3af' }}>
          <div style={{ fontWeight: 600, color: '#6b7280', marginBottom: 2 }}>{facility?.name || 'StayFit Health Club'}</div>
          {facility?.address && <div>{[facility.address, facility.city].filter(Boolean).join(', ')}</div>}
        </div>
        <div style={{ textAlign: 'right', fontSize: 10, color: '#9ca3af' }}>
          <div>This is a computer-generated invoice. No signature required.</div>
          <div style={{ marginTop: 2, fontFamily: 'monospace', color: '#6b7280', fontWeight: 600 }}>{invoiceNo}</div>
        </div>
      </div>
    </div>
  )
}

export function InvoiceModal({ payment, open, onClose }: {
  payment: Payment | null
  open: boolean
  onClose: () => void
}) {
  const printRef = useRef<HTMLDivElement>(null)

  const { data: facilityRaw } = useQuery({
    queryKey: ['facility', 1],
    queryFn: () => facilitiesApi.getById(1),
    staleTime: 10 * 60 * 1000,
    enabled: open,
  })
  const facility = facilityRaw as any

  const openPrintWindow = (autoDownload: boolean) => {
    const el = document.getElementById('invoice-print')
    if (!el) return
    const w = window.open('', '_blank', 'width=800,height=900')
    if (!w) return
    w.document.write(`
      <!DOCTYPE html><html><head>
      <meta charset="utf-8">
      <title>Invoice</title>
      <style>
        body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
        @media print { @page { margin: 0; size: A4; } }
      </style>
      </head><body>
      ${el.outerHTML}
      <script>window.onload=()=>{window.print();}<\/script>
      </body></html>
    `)
    w.document.close()
  }

  if (!payment) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      {/* [&>button]:hidden suppresses the auto-generated DialogClose X from shadcn */}
      <DialogContent className="max-w-3xl p-0 overflow-hidden [&>button]:hidden" aria-describedby={undefined}>
        <DialogHeader className="flex-row items-center justify-between px-5 py-3 border-b bg-muted/30">
          <DialogTitle className="sr-only">
            Invoice INV-{String(payment.id).padStart(6, '0')}
          </DialogTitle>
          <div className="flex gap-1.5 ml-auto">
            <Button size="icon" variant="outline" className="h-8 w-8" title="Print" onClick={() => openPrintWindow(false)}>
              <Printer className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="outline" className="h-8 w-8" title="Download PDF" onClick={() => openPrintWindow(true)}>
              <Download className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <div ref={printRef} className="overflow-auto max-h-[80vh]">
          <InvoiceDocument payment={payment} facility={facility} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
