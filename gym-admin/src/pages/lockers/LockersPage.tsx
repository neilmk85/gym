import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Lock, LockOpen, Plus, Search, Pencil, Trash2, IndianRupee,
  CheckCircle, XCircle, AlertTriangle, CalendarDays, User,
  MoreHorizontal, KeyRound, Package, ArrowRightLeft,
} from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDate } from '@/lib/utils'
import { lockersApi, type Locker, type LockerAllotment } from '@/api/lockers.api'
import { membersApi } from '@/api/members.api'
import type { Member } from '@/types/member.types'

// ─── constants ─────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  available:   { label: 'Available',    cls: 'bg-green-100 text-green-700 border-green-200',  icon: <LockOpen className="w-3 h-3" /> },
  occupied:    { label: 'Occupied',     cls: 'bg-blue-100 text-blue-700 border-blue-200',     icon: <Lock className="w-3 h-3" /> },
  maintenance: { label: 'Maintenance',  cls: 'bg-amber-100 text-amber-700 border-amber-200', icon: <AlertTriangle className="w-3 h-3" /> },
}

const ALLOT_STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active:   { label: 'Active',    cls: 'bg-green-100 text-green-700' },
  expired:  { label: 'Expired',   cls: 'bg-gray-100 text-gray-500' },
  released: { label: 'Released',  cls: 'bg-orange-100 text-orange-700' },
}

const today = () => new Date().toISOString().slice(0, 10)
const monthLater = (n = 1) => {
  const d = new Date(); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10)
}

// ─── helpers ───────────────────────────────────────────────────────────────

function memberName(m?: LockerAllotment['member']) {
  if (!m) return '—'
  return `${m.user.first_name} ${m.user.last_name}`
}

function daysLeft(endDate: string) {
  const diff = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000)
  return diff
}

// ─── Main Page ─────────────────────────────────────────────────────────────

type TabKey = 'lockers' | 'allotments'

export default function LockersPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<TabKey>('allotments')

  // locker form
  const [showLockerModal, setShowLockerModal] = useState(false)
  const [editLocker, setEditLocker] = useState<Locker | null>(null)
  const [lockerForm, setLockerForm] = useState({ number: '', location: '', status: 'available', notes: '' })

  // allotment form
  const [showAllocModal, setShowAllocModal] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const [memberDropOpen, setMemberDropOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [lockerSearch, setLockerSearch] = useState('')
  const [lockerDropOpen, setLockerDropOpen] = useState(false)
  const [selectedLocker, setSelectedLocker] = useState<Locker | null>(null)
  const [allocForm, setAllocForm] = useState({
    start_date: today(),
    end_date: monthLater(1),
    fee_amount: '',
    notes: '',
  })

  // confirm release / delete
  const [releaseTarget, setReleaseTarget] = useState<LockerAllotment | null>(null)
  const [deleteLockerTarget, setDeleteLockerTarget] = useState<Locker | null>(null)

  // locker filter
  const [lockerStatusFilter, setLockerStatusFilter] = useState('')

  // ── Queries ────────────────────────────────────────────────────────────

  const { data: lockersRaw, isLoading: loadingLockers } = useQuery({
    queryKey: ['lockers', lockerStatusFilter],
    queryFn: () => lockersApi.listLockers(lockerStatusFilter || undefined),
  })
  const lockers: Locker[] = (lockersRaw as any)?.lockers ?? []

  const { data: allotmentsRaw, isLoading: loadingAllotments } = useQuery({
    queryKey: ['locker-allotments'],
    queryFn: () => lockersApi.listActiveAllotments(),
  })
  const allotments: LockerAllotment[] = (allotmentsRaw as any)?.allotments ?? []

  const { data: membersRaw } = useQuery({
    queryKey: ['members-locker-search', memberSearch],
    queryFn: () => membersApi.list({ search: memberSearch, per_page: 30 } as any),
    enabled: showAllocModal,
  })
  const memberResults: Member[] = (membersRaw as any)?.members ?? []

  // available lockers for allocation dropdown
  const availableLockers = lockers.filter(l => l.status === 'available')

  // ── Mutations ──────────────────────────────────────────────────────────

  const createLockerMutation = useMutation({
    mutationFn: () => lockersApi.createLocker({ number: lockerForm.number, location: lockerForm.location, notes: lockerForm.notes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lockers'] }); toast.success('Locker added'); closeLockerModal() },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to add locker'),
  })

  const updateLockerMutation = useMutation({
    mutationFn: () => lockersApi.updateLocker(editLocker!.id, { number: lockerForm.number, location: lockerForm.location, status: lockerForm.status, notes: lockerForm.notes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lockers'] }); toast.success('Locker updated'); closeLockerModal() },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to update locker'),
  })

  const deleteLockerMutation = useMutation({
    mutationFn: (id: number) => lockersApi.deleteLocker(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lockers'] }); toast.success('Locker deleted'); setDeleteLockerTarget(null) },
    onError: (e: any) => toast.error(e?.message ?? 'Cannot delete — locker may have an active allotment'),
  })

  const allocateMutation = useMutation({
    mutationFn: () => lockersApi.allocate({
      locker_id: selectedLocker!.id,
      member_id: selectedMember!.id,
      start_date: allocForm.start_date,
      end_date: allocForm.end_date,
      fee_amount: parseFloat(allocForm.fee_amount) || 0,
      notes: allocForm.notes,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['locker-allotments'] })
      qc.invalidateQueries({ queryKey: ['lockers'] })
      toast.success('Locker allotted successfully')
      closeAllocModal()
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to allot locker'),
  })

  const markPaidMutation = useMutation({
    mutationFn: (id: number) => lockersApi.markFeePaid(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['locker-allotments'] }); toast.success('Fee marked as paid') },
    onError: () => toast.error('Failed to mark fee paid'),
  })

  const releaseMutation = useMutation({
    mutationFn: (id: number) => lockersApi.release(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['locker-allotments'] })
      qc.invalidateQueries({ queryKey: ['lockers'] })
      toast.success('Locker released')
      setReleaseTarget(null)
    },
    onError: () => toast.error('Failed to release locker'),
  })

  // ── Helpers ────────────────────────────────────────────────────────────

  const openAddLocker = () => {
    setEditLocker(null)
    setLockerForm({ number: '', location: '', status: 'available', notes: '' })
    setShowLockerModal(true)
  }

  const openEditLocker = (l: Locker) => {
    setEditLocker(l)
    setLockerForm({ number: l.number, location: l.location, status: l.status, notes: l.notes })
    setShowLockerModal(true)
  }

  const closeLockerModal = () => { setShowLockerModal(false); setEditLocker(null) }

  const closeAllocModal = () => {
    setShowAllocModal(false)
    setSelectedMember(null)
    setSelectedLocker(null)
    setMemberSearch('')
    setLockerSearch('')
    setAllocForm({ start_date: today(), end_date: monthLater(1), fee_amount: '', notes: '' })
  }

  // derived stats
  const totalLockers = lockers.length
  const availableCount = lockers.filter(l => l.status === 'available').length
  const occupiedCount = lockers.filter(l => l.status === 'occupied').length
  const maintenanceCount = lockers.filter(l => l.status === 'maintenance').length
  const pendingFees = allotments.filter(a => !a.fee_paid && a.status === 'active').length
  const expiringSoon = allotments.filter(a => a.status === 'active' && daysLeft(a.end_date) <= 7 && daysLeft(a.end_date) >= 0).length

  const filteredLockerDrop = availableLockers.filter(l =>
    l.number.toLowerCase().includes(lockerSearch.toLowerCase()) ||
    l.location.toLowerCase().includes(lockerSearch.toLowerCase())
  )

  return (
    <div className="space-y-6">

      <PageHeader
        title="Locker Management"
        subtitle="Allot lockers to members, track fees and renewals."
        icon={<KeyRound className="h-5 w-5" />}
        stats={[
          { label: 'Total',        value: totalLockers   },
          { label: 'Available',    value: availableCount },
          { label: 'Occupied',     value: occupiedCount  },
          { label: 'Expiring ≤7d', value: expiringSoon   },
        ]}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={openAddLocker} className="gap-1.5">
              <Plus className="w-4 h-4" /> Add Locker
            </Button>
            <Button size="sm" onClick={() => setShowAllocModal(true)} className="gap-1.5">
              <ArrowRightLeft className="w-4 h-4" /> Allot Locker
            </Button>
          </>
        }
      />

      {/* ── Tabs ── */}
      <div className="flex border-b border-border">
        {(['allotments', 'lockers'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'border-[#00B4D8] text-[#007a99]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'allotments' ? 'Active Allotments' : 'Locker Inventory'}
          </button>
        ))}
      </div>

      {/* ── ALLOTMENTS TAB ── */}
      {tab === 'allotments' && (
        <Card className="overflow-hidden">
          {loadingAllotments ? (
            <div className="p-10 text-center text-muted-foreground text-sm">Loading…</div>
          ) : allotments.length === 0 ? (
            <div className="py-20 text-center">
              <Lock className="w-10 h-10 mx-auto mb-3 text-muted-foreground/25" />
              <p className="text-muted-foreground">No active allotments.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Use "Allot Locker" to assign a locker to a member.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-sidebar">
                <tr>
                  {['Locker', 'Member', 'Period', 'Fee', 'Status', 'Days Left', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-sidebar-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {allotments.map(a => {
                  const dl = daysLeft(a.end_date)
                  const expiring = dl <= 7 && dl >= 0
                  const badge = ALLOT_STATUS_BADGE[a.status]
                  return (
                    <tr key={a.id} className={`hover:bg-muted/30 transition-colors ${expiring ? 'bg-amber-50/40' : ''}`}>
                      <td className="px-4 py-3 font-semibold">
                        #{a.locker?.number ?? a.locker_id}
                        {a.locker?.location && <p className="text-xs text-muted-foreground font-normal">{a.locker.location}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 font-medium">
                          <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          {memberName(a.member)}
                        </span>
                        <p className="text-xs text-muted-foreground">{a.member?.member_code}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                        <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{a.start_date?.slice(0, 10)}</span>
                        <span className="flex items-center gap-1 mt-0.5 text-muted-foreground/70">to {a.end_date?.slice(0, 10)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold">₹{a.fee_amount.toLocaleString()}</span>
                        {a.fee_paid ? (
                          <span className="ml-2 inline-flex items-center gap-0.5 text-xs text-green-600 font-medium">
                            <CheckCircle className="w-3 h-3" /> Paid
                          </span>
                        ) : (
                          <button
                            onClick={() => markPaidMutation.mutate(a.id)}
                            disabled={markPaidMutation.isPending}
                            className="ml-2 inline-flex items-center gap-0.5 text-xs text-orange-600 font-medium hover:underline"
                          >
                            <XCircle className="w-3 h-3" /> Pending
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {a.status === 'active' ? (
                          dl < 0
                            ? <span className="text-xs text-red-600 font-semibold">Overdue</span>
                            : <span className={`text-xs font-semibold ${expiring ? 'text-amber-600' : 'text-foreground'}`}>{dl}d</span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {a.status === 'active' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => setReleaseTarget(a)}
                          >
                            Release
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* ── LOCKER INVENTORY TAB ── */}
      {tab === 'lockers' && (
        <div className="space-y-4">
          {/* Filter bar */}
          <div className="flex items-center gap-2">
            <Select value={lockerStatusFilter || 'all'} onValueChange={v => setLockerStatusFilter(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-40 h-9 text-sm">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="occupied">Occupied</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">{lockers.length} lockers</span>
          </div>

          {loadingLockers ? (
            <div className="p-10 text-center text-muted-foreground text-sm">Loading…</div>
          ) : lockers.length === 0 ? (
            <div className="py-20 text-center border rounded-xl">
              <Package className="w-10 h-10 mx-auto mb-3 text-muted-foreground/25" />
              <p className="text-muted-foreground">No lockers found.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Use "Add Locker" to register your locker units.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {lockers.map(l => {
                const badge = STATUS_BADGE[l.status]
                return (
                  <Card key={l.id} className={`relative overflow-hidden transition-shadow hover:shadow-md ${l.status === 'available' ? 'border-green-200' : l.status === 'maintenance' ? 'border-amber-200' : ''}`}>
                    <CardContent className="p-4 flex flex-col gap-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-lg font-bold leading-none">#{l.number}</p>
                          {l.location && <p className="text-xs text-muted-foreground mt-0.5">{l.location}</p>}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="text-muted-foreground hover:text-foreground p-0.5 rounded">
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="text-sm">
                            <DropdownMenuItem onClick={() => openEditLocker(l)}>
                              <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteLockerTarget(l)}
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border w-fit ${badge.cls}`}>
                        {badge.icon} {badge.label}
                      </span>
                      {l.notes && <p className="text-xs text-muted-foreground line-clamp-2">{l.notes}</p>}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ADD / EDIT LOCKER MODAL ── */}
      {showLockerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md shadow-2xl">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-base">{editLocker ? 'Edit Locker' : 'Add Locker'}</p>
                <button onClick={closeLockerModal} className="text-muted-foreground hover:text-foreground text-xl">×</button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Locker Number <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="e.g. A-01"
                    value={lockerForm.number}
                    onChange={e => setLockerForm(f => ({ ...f, number: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Location</Label>
                  <Input
                    placeholder="e.g. Male Changing Room"
                    value={lockerForm.location}
                    onChange={e => setLockerForm(f => ({ ...f, location: e.target.value }))}
                  />
                </div>
              </div>

              {editLocker && (
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={lockerForm.status} onValueChange={v => setLockerForm(f => ({ ...f, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="occupied">Occupied</SelectItem>
                      <SelectItem value="maintenance">Under Maintenance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Input
                  placeholder="Optional notes"
                  value={lockerForm.notes}
                  onChange={e => setLockerForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={closeLockerModal}>Cancel</Button>
                <Button
                  onClick={() => editLocker ? updateLockerMutation.mutate() : createLockerMutation.mutate()}
                  disabled={!lockerForm.number || createLockerMutation.isPending || updateLockerMutation.isPending}
                >
                  {editLocker ? 'Save Changes' : 'Add Locker'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── ALLOT LOCKER MODAL ── */}
      {showAllocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-lg shadow-2xl">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-base">Allot Locker to Member</p>
                <button onClick={closeAllocModal} className="text-muted-foreground hover:text-foreground text-xl">×</button>
              </div>

              {/* Member picker */}
              <div className="space-y-1.5">
                <Label>Member <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email or member code…"
                    className="pl-9"
                    value={memberDropOpen ? memberSearch : (selectedMember ? `${selectedMember.user.first_name} ${selectedMember.user.last_name}` : memberSearch)}
                    onChange={e => { setMemberSearch(e.target.value); setMemberDropOpen(true) }}
                    onFocus={() => { setMemberSearch(''); setMemberDropOpen(true) }}
                    onBlur={() => setTimeout(() => setMemberDropOpen(false), 150)}
                  />
                  {selectedMember && !memberDropOpen && (
                    <button onClick={() => setSelectedMember(null)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-lg">×</button>
                  )}
                  {memberDropOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {memberResults.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">No members found</div>
                      ) : memberResults.map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onMouseDown={() => { setSelectedMember(m); setMemberDropOpen(false); setMemberSearch('') }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between"
                        >
                          <span className="font-medium">{m.user.first_name} {m.user.last_name}</span>
                          <span className="text-xs text-muted-foreground">{m.member_code} · {m.user.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedMember && (
                  <p className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-700">
                    {selectedMember.user.first_name} {selectedMember.user.last_name} · {selectedMember.member_code} · {selectedMember.user.email}
                  </p>
                )}
              </div>

              {/* Locker picker */}
              <div className="space-y-1.5">
                <Label>Locker <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Input
                    placeholder="Search available lockers…"
                    value={lockerDropOpen ? lockerSearch : (selectedLocker ? `#${selectedLocker.number}${selectedLocker.location ? ` — ${selectedLocker.location}` : ''}` : lockerSearch)}
                    onChange={e => { setLockerSearch(e.target.value); setLockerDropOpen(true) }}
                    onFocus={() => { setLockerSearch(''); setLockerDropOpen(true) }}
                    onBlur={() => setTimeout(() => setLockerDropOpen(false), 150)}
                  />
                  {selectedLocker && !lockerDropOpen && (
                    <button onClick={() => setSelectedLocker(null)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-lg">×</button>
                  )}
                  {lockerDropOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {filteredLockerDrop.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">No available lockers</div>
                      ) : filteredLockerDrop.map(l => (
                        <button
                          key={l.id}
                          type="button"
                          onMouseDown={() => { setSelectedLocker(l); setLockerDropOpen(false); setLockerSearch('') }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between"
                        >
                          <span className="font-medium">#{l.number}</span>
                          <span className="text-xs text-muted-foreground">{l.location}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {availableLockers.length === 0 && (
                  <p className="text-xs text-amber-600">No available lockers. Add lockers or release occupied ones first.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Start Date <span className="text-destructive">*</span></Label>
                  <Input
                    type="date"
                    value={allocForm.start_date}
                    onChange={e => setAllocForm(f => ({ ...f, start_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>End Date <span className="text-destructive">*</span></Label>
                  <Input
                    type="date"
                    value={allocForm.end_date}
                    onChange={e => setAllocForm(f => ({ ...f, end_date: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Fee Amount (₹) <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="e.g. 500"
                    className="pl-9"
                    value={allocForm.fee_amount}
                    onChange={e => setAllocForm(f => ({ ...f, fee_amount: e.target.value }))}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Total fee for the allotment period.</p>
              </div>

              <div className="space-y-1.5">
                <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  placeholder="e.g. Key handed over"
                  value={allocForm.notes}
                  onChange={e => setAllocForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={closeAllocModal}>Cancel</Button>
                <Button
                  className="bg-slate-700 hover:bg-slate-800 text-white"
                  onClick={() => allocateMutation.mutate()}
                  disabled={
                    allocateMutation.isPending ||
                    !selectedMember ||
                    !selectedLocker ||
                    !allocForm.start_date ||
                    !allocForm.end_date ||
                    allocForm.fee_amount === ''
                  }
                >
                  {allocateMutation.isPending ? 'Allotting…' : 'Allot Locker'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── RELEASE CONFIRM ── */}
      {releaseTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-sm shadow-2xl">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-red-100 shrink-0">
                  <LockOpen className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="font-semibold">Release Locker #{releaseTarget.locker?.number}?</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This will free the locker and mark the allotment for <strong>{memberName(releaseTarget.member)}</strong> as released.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setReleaseTarget(null)}>Cancel</Button>
                <Button
                  variant="destructive"
                  onClick={() => releaseMutation.mutate(releaseTarget.id)}
                  disabled={releaseMutation.isPending}
                >
                  {releaseMutation.isPending ? 'Releasing…' : 'Yes, Release'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── DELETE LOCKER CONFIRM ── */}
      {deleteLockerTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-sm shadow-2xl">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-red-100 shrink-0">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="font-semibold">Delete Locker #{deleteLockerTarget.number}?</p>
                  <p className="text-sm text-muted-foreground mt-1">This action cannot be undone. Lockers with active allotments cannot be deleted.</p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeleteLockerTarget(null)}>Cancel</Button>
                <Button
                  variant="destructive"
                  onClick={() => deleteLockerMutation.mutate(deleteLockerTarget.id)}
                  disabled={deleteLockerMutation.isPending}
                >
                  {deleteLockerMutation.isPending ? 'Deleting…' : 'Delete'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
