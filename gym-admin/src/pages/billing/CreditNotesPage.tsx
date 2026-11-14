import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { billingApi, type CreditNote } from '@/api/billing.api'
import { membersApi } from '@/api/members.api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import { Plus, Search, FileX, ChevronRight, IndianRupee } from 'lucide-react'
import type { Member } from '@/types/member.types'

const PER_PAGE = 20

function MemberAvatar({ name }: { name: string }) {
  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className="h-8 w-8 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-xs font-bold shrink-0">
      {initials}
    </div>
  )
}

export default function CreditNotesPage() {
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['billing', 'credit-notes', page],
    queryFn: () => billingApi.listCreditNotes({ page, per_page: PER_PAGE }),
  })

  const creditNotes: CreditNote[] = (data as any)?.credit_notes ?? []
  const total = (data as any)?.meta?.total ?? 0

  return (
    <div className="space-y-5">
      <PageHeader
        title="Credit Notes"
        subtitle="Issued against cancelled or corrected GST invoices"
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" /> Issue Credit Note
          </Button>
        }
      />

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {isError && <div className="p-6 text-sm text-destructive">Failed to load credit notes.</div>}
        {isLoading ? (
          <div className="divide-y">
            {[1,2,3,4].map(i => (
              <div key={i} className="px-5 py-4 flex items-center gap-4">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-2"><Skeleton className="h-3 w-28" /><Skeleton className="h-3 w-44" /></div>
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-5 w-24" />
              </div>
            ))}
          </div>
        ) : creditNotes.length === 0 ? (
          <EmptyState
            title="No credit notes yet"
            description="Issue a credit note when cancelling or correcting a GST invoice."
          />
        ) : (
          <>
            <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr] gap-4 px-5 py-2.5 bg-gray-50/70 border-b text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              <span>Credit Note</span>
              <span>Against Invoice</span>
              <span>Amount</span>
              <span>Status</span>
              <span>Date</span>
            </div>
            <div className="divide-y">
              {creditNotes.map(cn => (
                <div key={cn.id} className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr] gap-4 px-5 py-3.5 items-center hover:bg-gray-50/60 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
                      <FileX className="h-4 w-4 text-rose-600" />
                    </div>
                    <div>
                      <p className="font-mono font-semibold text-sm text-primary">{cn.credit_note_number}</p>
                      <p className="text-xs text-muted-foreground">Member #{cn.member_id}</p>
                    </div>
                  </div>
                  <div>
                    {cn.original_invoice_id
                      ? <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">Inv #{cn.original_invoice_id}</span>
                      : <span className="text-xs text-muted-foreground">—</span>
                    }
                  </div>
                  <div>
                    <p className="font-bold text-rose-600">{formatCurrency(cn.amount)}</p>
                    {cn.tax_amount > 0 && <p className="text-xs text-muted-foreground">Tax: {formatCurrency(cn.tax_amount)}</p>}
                  </div>
                  <div>
                    <StatusBadge status={cn.status} color={cn.status === 'issued' ? 'green' : 'yellow'} />
                  </div>
                  <div className="text-sm text-muted-foreground">{formatDate(cn.issued_at || cn.created_at)}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {total > PER_PAGE && (
          <div className="flex items-center justify-between px-5 py-3 border-t bg-gray-50/50">
            <span className="text-sm text-muted-foreground">{(page-1)*PER_PAGE+1}–{Math.min(page*PER_PAGE, total)} of {total}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page===1} onClick={() => setPage(p=>p-1)}>Previous</Button>
              <Button size="sm" variant="outline" disabled={page*PER_PAGE>=total} onClick={() => setPage(p=>p+1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateCreditNoteDialog
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false)
            qc.invalidateQueries({ queryKey: ['billing', 'credit-notes'] })
          }}
        />
      )}
    </div>
  )
}

function CreateCreditNoteDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [memberSearch, setMemberSearch] = useState('')
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [invoiceId, setInvoiceId]   = useState('')
  const [reason, setReason]         = useState('')
  const [amount, setAmount]         = useState('')
  const [taxAmount, setTaxAmount]   = useState('')

  const { data: membersData } = useQuery({
    queryKey: ['cn-member-search', memberSearch],
    queryFn: () => membersApi.list({ search: memberSearch, per_page: 8 }),
    enabled: !selectedMember && memberSearch.length > 0,
  })
  const searchMembers: Member[] = (membersData as any)?.members ?? []

  const { data: invoicesData } = useQuery({
    queryKey: ['cn-member-invoices', selectedMember?.id],
    queryFn: () => billingApi.listInvoices({ member_id: selectedMember!.id, per_page: 50 }),
    enabled: !!selectedMember,
  })
  const invoices = (invoicesData as any)?.invoices ?? []

  const mutation = useMutation({
    mutationFn: () => billingApi.createCreditNote({
      member_id:          selectedMember!.id,
      facility_id:        1,
      original_invoice_id: invoiceId ? Number(invoiceId) : undefined,
      reason,
      amount:             Number(amount),
      tax_amount:         Number(taxAmount || 0),
    }),
    onSuccess: () => { toast.success('Credit note issued'); onSuccess() },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to create credit note'),
  })

  const canSubmit = !!selectedMember && reason && Number(amount) > 0

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileX className="h-5 w-5 text-rose-600" /> Issue Credit Note
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Member */}
          <div className="space-y-2">
            <Label>Member *</Label>
            {selectedMember ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-rose-50 border border-rose-100">
                <MemberAvatar name={`${selectedMember.user.first_name} ${selectedMember.user.last_name}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{selectedMember.user.first_name} {selectedMember.user.last_name}</p>
                  <p className="text-xs text-muted-foreground">{selectedMember.member_code}</p>
                </div>
                <button onClick={() => setSelectedMember(null)} className="text-xs text-rose-600 font-medium">Change</button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search member…" value={memberSearch} onChange={e => setMemberSearch(e.target.value)} className="pl-9" />
                </div>
                {searchMembers.length > 0 && (
                  <div className="border rounded-lg divide-y">
                    {searchMembers.map(m => (
                      <button key={m.id} onClick={() => setSelectedMember(m)}
                        className="w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-rose-50 transition-colors">
                        <MemberAvatar name={`${m.user.first_name} ${m.user.last_name}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{m.user.first_name} {m.user.last_name}</p>
                          <p className="text-xs text-muted-foreground">{m.user.email}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Original Invoice */}
          {selectedMember && (
            <div className="space-y-1.5">
              <Label>Original Invoice (optional)</Label>
              <select value={invoiceId} onChange={e => setInvoiceId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">— No linked invoice —</option>
                {invoices.map((inv: any) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoice_number} · {formatCurrency(inv.total)} · {formatDate(inv.issue_date)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-1.5">
            <Label>Reason *</Label>
            <Input value={reason} onChange={e => setReason(e.target.value)}
              placeholder="e.g. Member cancelled plan after 2 months" />
          </div>

          {/* Amount + Tax */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Credit Amount (₹) *</Label>
              <div className="relative">
                <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="pl-7" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Tax Amount (₹)</Label>
              <div className="relative">
                <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input type="number" min="0" value={taxAmount} onChange={e => setTaxAmount(e.target.value)} placeholder="0" className="pl-7" />
              </div>
            </div>
          </div>

          {Number(amount) > 0 && (
            <div className="bg-rose-50 rounded-lg p-3 text-sm flex justify-between items-center border border-rose-100">
              <span className="text-muted-foreground">Total credit value</span>
              <span className="font-bold text-rose-700 text-base">{formatCurrency(Number(amount) + Number(taxAmount || 0))}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={!canSubmit || mutation.isPending}
              onClick={() => mutation.mutate()}
              className="bg-rose-600 hover:bg-rose-700 text-white">
              <FileX className="h-4 w-4" />
              {mutation.isPending ? 'Issuing…' : 'Issue Credit Note'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
