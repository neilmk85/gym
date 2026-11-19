import { useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { facilitiesApi } from '@/api/facilities.api'
import { formatDate } from '@/lib/utils'
import { Printer, X } from 'lucide-react'
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

function InvoiceDocument({ payment, facility }: { payment: Payment; facility: any }) {
  const member   = payment.member
  const memberName = member?.user
    ? `${member.user.first_name} ${member.user.last_name}`
    : `Member #${payment.member_id}`
  const plan = payment.subscription?.plan
  const invoiceNo = `INV-${String(payment.id).padStart(6, '0')}`
  const paidDate  = payment.paid_at || payment.created_at
  const isRefund  = payment.status === 'refunded'

  return (
    <div id="invoice-print" className="bg-white text-gray-900 font-sans" style={{ minWidth: 640 }}>
      {/* ── Header ── */}
      <div style={{ background: '#0ea5e9', padding: '28px 36px 20px' }} className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img src={logoUrl} alt="StayFit" style={{ height: 56, width: 56, objectFit: 'contain', borderRadius: 8, background: '#fff', padding: 4 }} />
          <div>
            <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px' }}>
              {facility?.name || 'StayFit Gym'}
            </div>
            {facility?.address && (
              <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 }}>
                {[facility.address, facility.city, facility.state].filter(Boolean).join(', ')}
              </div>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#fff', fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px' }}>INVOICE</div>
          <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 2 }}>{invoiceNo}</div>
        </div>
      </div>

      {/* ── Meta row ── */}
      <div style={{ background: '#f0f9ff', padding: '14px 36px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e0f2fe' }}>
        <div style={{ display: 'flex', gap: 36 }}>
          <div>
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>Invoice Date</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{formatDate(paidDate)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>Payment Method</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{METHOD_LABELS[payment.payment_method] ?? payment.payment_method}</div>
          </div>
          {payment.transaction_id && (
            <div>
              <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>Transaction ID</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2, fontFamily: 'monospace' }}>{payment.transaction_id}</div>
            </div>
          )}
          {payment.reference_number && (
            <div>
              <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>Reference No.</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2, fontFamily: 'monospace' }}>{payment.reference_number}</div>
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>Status</div>
          <div style={{
            display: 'inline-block', marginTop: 4, padding: '2px 10px', borderRadius: 20,
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
            background: payment.status === 'completed' ? '#dcfce7' : payment.status === 'refunded' ? '#fef3c7' : '#fee2e2',
            color: payment.status === 'completed' ? '#16a34a' : payment.status === 'refunded' ? '#b45309' : '#dc2626',
          }}>
            {payment.status}
          </div>
        </div>
      </div>

      {/* ── Bill To ── */}
      <div style={{ padding: '24px 36px 0' }}>
        <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Bill To</div>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{memberName}</div>
        {member?.user?.email && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{member.user.email}</div>}
        {member?.user?.phone && <div style={{ fontSize: 12, color: '#64748b' }}>{member.user.phone}</div>}
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Member ID: #{payment.member_id}</div>
      </div>

      {/* ── Line items ── */}
      <div style={{ padding: '20px 36px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600, color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Description</th>
              <th style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 600, color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Qty</th>
              <th style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 600, color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '14px 12px' }}>
                <div style={{ fontWeight: 600 }}>
                  {plan?.name ?? 'Membership Plan'}
                </div>
                {payment.subscription?.id && (
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Subscription #{payment.subscription.id}</div>
                )}
              </td>
              <td style={{ padding: '14px 12px', textAlign: 'center', color: '#64748b' }}>1</td>
              <td style={{ padding: '14px 12px', textAlign: 'right', fontWeight: 600 }}>{fmt(payment.amount)}</td>
            </tr>
            {isRefund && payment.refund_amount && (
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 12px', color: '#dc2626' }}>
                  Refund
                  {payment.refund_reason && <span style={{ color: '#94a3b8', fontSize: 11 }}> — {payment.refund_reason}</span>}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>1</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>−{fmt(payment.refund_amount)}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* ── Totals ── */}
        <div style={{ marginTop: 0, borderTop: '2px solid #e2e8f0', paddingTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ minWidth: 240 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 12px', fontSize: 13, color: '#64748b' }}>
                <span>Subtotal</span><span>{fmt(payment.amount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 12px', fontSize: 13, color: '#64748b' }}>
                <span>Tax (GST)</span><span>Incl.</span>
              </div>
              {isRefund && payment.refund_amount && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 12px', fontSize: 13, color: '#dc2626' }}>
                  <span>Refund</span><span>−{fmt(payment.refund_amount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', fontSize: 15, fontWeight: 800, background: '#0ea5e9', color: '#fff', borderRadius: 6, marginTop: 6 }}>
                <span>Total Paid</span>
                <span>{fmt(isRefund && payment.refund_amount ? payment.amount - payment.refund_amount : payment.amount)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Notes ── */}
      {payment.notes && (
        <div style={{ padding: '0 36px 20px' }}>
          <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#64748b' }}>
            <strong>Notes: </strong>{payment.notes}
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div style={{ background: '#0f172a', padding: '18px 36px', marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{facility?.name || 'StayFit Gym'}</div>
          {facility?.address && <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>{[facility.address, facility.city].filter(Boolean).join(', ')}</div>}
          <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
            {facility?.phone && <span style={{ color: '#94a3b8', fontSize: 11 }}>📞 {facility.phone}</span>}
            {facility?.email && <span style={{ color: '#94a3b8', fontSize: 11 }}>✉ {facility.email}</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#64748b', fontSize: 11 }}>This is a computer-generated invoice.</div>
          <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>No signature required.</div>
          <div style={{ color: '#475569', fontSize: 11, marginTop: 4, fontWeight: 600 }}>{invoiceNo}</div>
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

  const handlePrint = () => {
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
      <DialogContent className="max-w-3xl p-0 overflow-hidden" aria-describedby={undefined}>
        <DialogHeader className="flex-row items-center justify-between px-5 py-3 border-b bg-muted/30">
          <DialogTitle className="text-sm font-semibold">
            Invoice — INV-{String(payment.id).padStart(6, '0')}
          </DialogTitle>
          <div className="flex gap-2">
            <Button size="sm" onClick={handlePrint}>
              <Printer className="h-3.5 w-3.5 mr-1.5" />Print / Download
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
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
