import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/shared/SearchInput'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { bookingsApi } from '@/api/bookings.api'
import { useAuthStore } from '@/store/auth.store'
import { formatDateTime } from '@/lib/utils'
import {
  BookOpen, Users, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, Clock, Ban, UserCheck, UserX,
  CalendarDays, Ticket, AlertCircle,
} from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'

const PER_PAGE = 20

interface BookingRow {
  id: number
  member_id?: number
  day_pass_id?: number
  class_id: number
  status: string
  booked_at?: string
  cancelled_at?: string
  cancel_reason?: string
  created_at: string
  waitlist_position?: number
  member?: { user?: { first_name?: string; last_name?: string; email?: string } }
  day_pass?: { guest_name?: string; guest_phone?: string; guest_email?: string }
  class?: { id: number; name?: string; start_time?: string }
  // also handle legacy key
  class_info?: { name?: string; start_time?: string }
}

const STATUS_CFG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  confirmed:  { label: 'Confirmed',  cls: 'bg-blue-50 text-blue-700 border border-blue-200',   icon: <CheckCircle2 className="w-3 h-3" /> },
  waitlisted: { label: 'Waitlisted', cls: 'bg-amber-50 text-amber-700 border border-amber-200', icon: <Clock className="w-3 h-3" /> },
  cancelled:  { label: 'Cancelled',  cls: 'bg-red-50 text-red-600 border border-red-200',       icon: <XCircle className="w-3 h-3" /> },
  attended:   { label: 'Attended',   cls: 'bg-green-50 text-green-700 border border-green-200', icon: <UserCheck className="w-3 h-3" /> },
  no_show:    { label: 'No Show',    cls: 'bg-gray-100 text-gray-500 border border-gray-200',   icon: <UserX className="w-3 h-3" /> },
}

function getPersonDisplay(b: BookingRow) {
  if (b.day_pass_id) return b.day_pass?.guest_name ?? `Day Pass #${b.day_pass_id}`
  const u = b.member?.user
  if (u?.first_name || u?.last_name) return `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim()
  return b.member_id ? `Member #${b.member_id}` : '—'
}

function getEmail(b: BookingRow) {
  if (b.day_pass_id) return b.day_pass?.guest_email
  return b.member?.user?.email
}

function getClassName(b: BookingRow) {
  return b.class?.name ?? (b as any).class_info?.name ?? null
}

function getClassTime(b: BookingRow) {
  return b.class?.start_time ?? (b as any).class_info?.start_time ?? null
}

export default function BookingsListPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const canManage = user?.role === 'admin' || user?.role === 'manager'

  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')

  const [cancelTarget, setCancelTarget] = useState<BookingRow | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  const queryParams = {
    page,
    per_page: PER_PAGE,
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['bookings', queryParams],
    queryFn: () => bookingsApi.list(queryParams),
  })

  const rawBookings = ((data as any)?.bookings ?? []) as BookingRow[]
  const meta  = (data as any)?.meta
  const total = meta?.total ?? 0
  const perPage = meta?.per_page ?? PER_PAGE

  // Client-side name/email search
  const bookings = search.trim()
    ? rawBookings.filter(b => {
        const q = search.toLowerCase()
        return (
          getPersonDisplay(b).toLowerCase().includes(q) ||
          (getEmail(b) ?? '').toLowerCase().includes(q) ||
          (getClassName(b) ?? '').toLowerCase().includes(q) ||
          String(b.id).includes(q) ||
          String(b.class_id).includes(q)
        )
      })
    : rawBookings

  // Stat chips derived from loaded page
  const countConfirmed  = rawBookings.filter(b => b.status === 'confirmed').length
  const countWaitlisted = rawBookings.filter(b => b.status === 'waitlisted').length
  const countAttended   = rawBookings.filter(b => b.status === 'attended').length
  const countNoShow     = rawBookings.filter(b => b.status === 'no_show').length
  const countCancelled  = rawBookings.filter(b => b.status === 'cancelled').length
  const memberCount     = rawBookings.filter(b => !b.day_pass_id).length
  const dayPassCount    = rawBookings.filter(b => !!b.day_pass_id).length

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      bookingsApi.cancel(id, reason),
    onSuccess: () => {
      toast.success('Booking cancelled')
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      setCancelTarget(null)
      setCancelReason('')
    },
    onError: () => toast.error('Failed to cancel booking'),
  })

  const attendMutation = useMutation({
    mutationFn: (id: number) => bookingsApi.markAttended(id),
    onSuccess: () => {
      toast.success('Marked as attended')
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
    },
    onError: () => toast.error('Failed to mark attended'),
  })

  const noShowMutation = useMutation({
    mutationFn: (id: number) => bookingsApi.markNoShow(id),
    onSuccess: () => {
      toast.success('Marked as no-show')
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
    },
    onError: () => toast.error('Failed to mark no-show'),
  })

  return (
    <div className="space-y-6">

      <PageHeader
        title="Bookings"
        subtitle="All class bookings — member reservations, day-pass guests, waitlist positions, and attendance tracking."
        icon={<BookOpen className="h-5 w-5" />}
        stats={[
          { label: 'Total',     value: total          },
          { label: 'Confirmed', value: countConfirmed  },
          { label: 'Attended',  value: countAttended   },
          { label: 'Cancelled', value: countCancelled  },
        ]}
        actions={canManage ? (
          <Button size="sm" onClick={() => navigate('/bookings/new')}>+ Book a Class</Button>
        ) : undefined}
      />

      {isError && <p className="text-sm text-destructive">Failed to load bookings. Please try again.</p>}

      {/* ── Table card ── */}
      <Card className="shadow-lg shadow-gray-200/80 rounded-xl overflow-hidden">

        {/* Search + filter bar */}
        <div className="flex items-center justify-between gap-4 px-4 py-3 border-b bg-teal-50/60">
          <p className="font-medium text-sm text-teal-700 whitespace-nowrap flex items-center gap-1.5">
            <BookOpen className="w-4 h-4" />
            {isLoading ? 'Loading…' : `${bookings.length} booking${bookings.length !== 1 ? 's' : ''}`}
          </p>
          <div className="flex items-center gap-2 flex-1 justify-end">
            <SearchInput
              placeholder="Name, email, class…"
              value={search}
              onChange={v => { setSearch(v); setPage(1) }}
              className="w-60"
            />
            <select value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
              className="h-9 w-40 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-teal-400">
              <option value="all">All statuses</option>
              <option value="confirmed">Confirmed</option>
              <option value="waitlisted">Waitlisted</option>
              <option value="attended">Attended</option>
              <option value="no_show">No Show</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gradient-to-r from-teal-50 via-cyan-50 to-sky-50">
                <th className="text-left px-4 py-3 font-semibold text-teal-700">ID</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Person</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Class</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Class Time</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Booked At</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Status</th>
                {canManage && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y">

              {isLoading && Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {[1,2,3,4,5,6,7,8].map(c => (
                    <td key={c} className="px-4 py-3">
                      <div className="h-4 bg-gray-100 rounded animate-pulse w-24" />
                    </td>
                  ))}
                </tr>
              ))}

              {!isLoading && bookings.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 8 : 7} className="px-4 py-14 text-center">
                    <BookOpen className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-muted-foreground text-sm font-medium">No bookings found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {search || statusFilter !== 'all'
                        ? 'Try adjusting your search or filter.'
                        : 'Click "Book a Class" to create the first booking.'}
                    </p>
                  </td>
                </tr>
              )}

              {!isLoading && bookings.map((b, idx) => {
                const name      = getPersonDisplay(b)
                const email     = getEmail(b)
                const className = getClassName(b)
                const classTime = getClassTime(b)
                const isDay     = !!b.day_pass_id
                const sCfg      = STATUS_CFG[b.status] ?? { label: b.status, cls: 'bg-gray-100 text-gray-600', icon: null }
                const isActive  = b.status === 'confirmed' || b.status === 'waitlisted'

                return (
                  <tr key={b.id ?? idx} className="hover:bg-teal-50/40 transition-colors">

                    {/* ID */}
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      #{b.id}
                    </td>

                    {/* Person */}
                    <td className="px-4 py-3">
                      <p className="font-medium leading-tight">{name}</p>
                      {email && <p className="text-xs text-muted-foreground mt-0.5">{email}</p>}
                      {b.day_pass?.guest_phone && (
                        <p className="text-xs text-muted-foreground">{b.day_pass.guest_phone}</p>
                      )}
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3">
                      {isDay ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          <Ticket className="w-3 h-3" /> Day Pass
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          <Users className="w-3 h-3" /> Member
                        </span>
                      )}
                    </td>

                    {/* Class */}
                    <td className="px-4 py-3">
                      {className
                        ? <p className="font-medium">{className}</p>
                        : <p className="text-muted-foreground">Class #{b.class_id}</p>}
                      <p className="text-xs text-muted-foreground font-mono">ID {b.class_id}</p>
                      {b.status === 'waitlisted' && b.waitlist_position != null && (
                        <p className="text-[10px] text-amber-600 font-medium flex items-center gap-0.5 mt-0.5">
                          <AlertCircle className="w-3 h-3" /> Position #{b.waitlist_position}
                        </p>
                      )}
                    </td>

                    {/* Class time */}
                    <td className="px-4 py-3">
                      {classTime ? (
                        <div className="flex items-start gap-1.5">
                          <CalendarDays className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                          <span className="text-sm">{formatDateTime(classTime)}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Booked at */}
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {b.booked_at
                        ? formatDateTime(b.booked_at)
                        : formatDateTime(b.created_at)}
                      {b.cancelled_at && (
                        <p className="text-red-500 mt-0.5">
                          Cancelled {formatDateTime(b.cancelled_at)}
                        </p>
                      )}
                      {b.cancel_reason && (
                        <p className="text-muted-foreground/70 italic mt-0.5 max-w-[160px] truncate">
                          "{b.cancel_reason}"
                        </p>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${sCfg.cls}`}>
                        {sCfg.icon} {sCfg.label}
                      </span>
                    </td>

                    {/* Actions */}
                    {canManage && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          {/* Mark attended */}
                          {b.status === 'confirmed' && (
                            <button title="Mark attended"
                              className="p-1.5 rounded-md text-muted-foreground hover:text-green-600 hover:bg-green-50 transition-colors"
                              onClick={() => attendMutation.mutate(b.id)}>
                              <UserCheck className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {/* Mark no-show */}
                          {b.status === 'confirmed' && (
                            <button title="Mark no-show"
                              className="p-1.5 rounded-md text-muted-foreground hover:text-gray-700 hover:bg-gray-100 transition-colors"
                              onClick={() => noShowMutation.mutate(b.id)}>
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {/* Cancel */}
                          {isActive && (
                            <button title="Cancel booking"
                              className="p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                              onClick={() => { setCancelTarget(b); setCancelReason('') }}>
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!isLoading && total > 0 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t bg-muted/20 text-xs text-muted-foreground">
            <span>
              Showing {Math.min((page - 1) * perPage + 1, total)}–{Math.min(page * perPage, total)} of {total} bookings
            </span>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7" title="Previous page"
                onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <span className="flex items-center px-2 font-medium">Page {page}</span>
              <Button variant="outline" size="icon" className="h-7 w-7" title="Next page"
                onClick={() => setPage(p => p + 1)} disabled={page * perPage >= total}>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Cancel modal */}
      <ConfirmModal
        isOpen={!!cancelTarget}
        onClose={() => { if (!cancelMutation.isPending) { setCancelTarget(null); setCancelReason('') } }}
        onConfirm={() => { if (cancelTarget) cancelMutation.mutate({ id: cancelTarget.id, reason: cancelReason || undefined }) }}
        title="Cancel Booking"
        description={cancelTarget ? `Cancel booking #${cancelTarget.id} for ${getPersonDisplay(cancelTarget)}?` : ''}
        confirmLabel="Cancel Booking"
        variant="destructive"
        isLoading={cancelMutation.isPending}
      >
        <div className="mt-3 space-y-1.5">
          <Label htmlFor="cancel-reason">Reason (optional)</Label>
          <textarea
            id="cancel-reason"
            value={cancelReason}
            onChange={e => setCancelReason(e.target.value)}
            placeholder="Enter a reason for cancellation…"
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          />
        </div>
      </ConfirmModal>

    </div>
  )
}
