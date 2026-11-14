import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SearchInput } from '@/components/shared/SearchInput'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader } from '@/components/shared/PageHeader'
import { ptApi, type PTSession } from '@/api/pt.api'
import { trainersApi } from '@/api/trainers.api'
import { formatDateTime } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import {
  Dumbbell, CheckCircle2, XCircle, Clock,
  UserCheck, UserX, Ban, ChevronLeft, ChevronRight, CalendarDays,
  LayoutGrid, User,
} from 'lucide-react'

const PER_PAGE = 20

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  scheduled: { label: 'Scheduled', cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
  completed: { label: 'Completed', cls: 'bg-green-50 text-green-700 border border-green-200' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-50 text-red-600 border border-red-200' },
  no_show:   { label: 'No Show',   cls: 'bg-gray-100 text-gray-500 border border-gray-200' },
}

function mName(s: PTSession) {
  const u = s.member?.user
  return u ? `${u.first_name} ${u.last_name}` : `Member #${s.member_id}`
}
function tName(s: PTSession) {
  const u = s.trainer?.user
  return u ? `${u.first_name} ${u.last_name}` : `Trainer #${s.trainer_id}`
}
function sessionEnd(s: PTSession) {
  const d = new Date(s.scheduled_at)
  d.setMinutes(d.getMinutes() + s.duration_minutes)
  return d
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}
function fmtDate(d: Date) {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

type ViewMode = 'admin' | 'by_trainer'

export default function PTSessionsPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()

  const isAdmin = user?.role === 'admin' || user?.role === 'manager'
  const [viewMode, setViewMode] = useState<ViewMode>('admin')

  const [page, setPage]           = useState(1)
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatus] = useState('all')
  const [trainerFilter, setTrainerFilter] = useState('')

  const [completeId, setCompleteId]     = useState<number | null>(null)
  const [cancelId, setCancelId]         = useState<number | null>(null)
  const [trainerNotes, setTrainerNotes] = useState('')
  const [cancelReason, setCancelReason] = useState('')

  const trainerId = user?.id ?? 0

  // ── Trainers list (for filter dropdown, admin only) ───────────────────────
  const { data: trainersData } = useQuery({
    queryKey: ['trainers'],
    queryFn: () => trainersApi.list(),
    enabled: isAdmin,
  })
  const trainers: any[] = (trainersData as any)?.trainers ?? []

  // ── All sessions (used for both admin and by_trainer views) ──────────────
  // by_trainer uses a large per_page so grouping is useful client-side
  const adminQKey = ['pt-sessions-all', page, statusFilter, trainerFilter, viewMode]
  const { data: adminData, isLoading, isError } = useQuery({
    queryKey: adminQKey,
    queryFn: () => ptApi.listAllSessions({
      page,
      per_page: viewMode === 'by_trainer' ? 200 : PER_PAGE,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      trainer_id: trainerFilter ? Number(trainerFilter) : undefined,
    }),
    enabled: isAdmin,
  })

  const rawData = adminData

  const rawSessions: PTSession[] = (rawData as { pt_sessions?: PTSession[] })?.pt_sessions ?? []
  const meta     = (rawData as { meta?: { total?: number; per_page?: number } })?.meta
  const total    = meta?.total ?? 0
  const perPage  = (meta as any)?.per_page ?? PER_PAGE

  // Client-side text search (member name / id)
  const sessions = rawSessions.filter(s => {
    if (!search.trim()) return true
    return mName(s).toLowerCase().includes(search.toLowerCase()) ||
           String(s.member_id).includes(search) ||
           tName(s).toLowerCase().includes(search.toLowerCase())
  })

  // Status counts from loaded page
  const counts = {
    scheduled: rawSessions.filter(s => s.status === 'scheduled').length,
    completed: rawSessions.filter(s => s.status === 'completed').length,
    no_show:   rawSessions.filter(s => s.status === 'no_show').length,
    cancelled: rawSessions.filter(s => s.status === 'cancelled').length,
  }

  // Group sessions by trainer for the by_trainer view
  const sessionsByTrainer = useMemo(() => {
    if (viewMode !== 'by_trainer') return []
    const map = new Map<number, { name: string; sessions: PTSession[] }>()
    sessions.forEach(s => {
      if (!map.has(s.trainer_id)) map.set(s.trainer_id, { name: tName(s), sessions: [] })
      map.get(s.trainer_id)!.sessions.push(s)
    })
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [sessions, viewMode])

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['pt-sessions-all'] })
  }

  const completeMutation = useMutation({
    mutationFn: (id: number) => ptApi.completeSession(id, trainerNotes),
    onSuccess: () => { toast.success('Session marked complete'); invalidateAll(); setCompleteId(null); setTrainerNotes('') },
    onError: () => toast.error('Failed to complete session'),
  })
  const cancelMutation = useMutation({
    mutationFn: (id: number) => ptApi.cancelSession(id, cancelReason),
    onSuccess: () => { toast.success('Session cancelled'); invalidateAll(); setCancelId(null); setCancelReason('') },
    onError: () => toast.error('Failed to cancel session'),
  })
  const noShowMutation = useMutation({
    mutationFn: (id: number) => ptApi.markNoShow(id),
    onSuccess: () => { toast.success('Marked as no-show'); invalidateAll() },
    onError: () => toast.error('Failed to mark no-show'),
  })

  const switchMode = (mode: ViewMode) => { setViewMode(mode); setPage(1); setSearch(''); setStatus('all'); setTrainerFilter('') }

  return (
    <div className="space-y-6">

      <PageHeader
        title="PT Sessions"
        subtitle="Personal training sessions — scheduling, completion tracking, trainer notes, and cancellation history."
        icon={<Dumbbell className="h-5 w-5" />}
        stats={[
          { label: 'Total',            value: total },
          { label: 'Scheduled',        value: counts.scheduled },
          { label: 'Completed',        value: counts.completed },
          { label: 'No-show / Cancel', value: counts.no_show + counts.cancelled },
        ]}
      />

      {isError && <p className="text-sm text-destructive">Failed to load sessions. Please try again.</p>}

      {/* ── View tabs (admin only) ──────────────────────────────────────────── */}
      {isAdmin && (
        <div className="flex border-b">
          <button
            onClick={() => switchMode('admin')}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              viewMode === 'admin'
                ? 'border-[#00B4D8] text-[#007a99]'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutGrid className="w-4 h-4" /> All Sessions
          </button>
          <button
            onClick={() => switchMode('by_trainer')}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              viewMode === 'by_trainer'
                ? 'border-[#00B4D8] text-[#007a99]'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <User className="w-4 h-4" /> Sessions By Trainer
          </button>
        </div>
      )}

      {/* ── Table card ─────────────────────────────────────────────────────── */}
      <Card className="shadow-lg shadow-gray-200/80 rounded-xl overflow-hidden">

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b bg-cyan-50/40">
          <p className="font-medium text-sm text-[#007a99] whitespace-nowrap flex items-center gap-1.5 mr-auto">
            <Dumbbell className="w-4 h-4" />
            {isLoading ? 'Loading…' : `${sessions.length} session${sessions.length !== 1 ? 's' : ''}`}
          </p>

          {/* Trainer filter (admin view only) */}
          {viewMode === 'admin' && (
            <select value={trainerFilter} onChange={e => { setTrainerFilter(e.target.value); setPage(1) }}
              className="h-9 w-44 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">All trainers</option>
              {trainers.map(t => (
                <option key={t.id} value={t.id}>
                  {t.user?.first_name} {t.user?.last_name}
                </option>
              ))}
            </select>
          )}

          <select value={statusFilter} onChange={e => { setStatus(e.target.value); setPage(1) }}
            className="h-9 w-40 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="all">All statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="no_show">No Show</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <SearchInput
            placeholder="Search member or trainer…"
            value={search}
            onChange={setSearch}
            className="w-56"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sidebar">
                <th className="text-left px-4 py-3 text-xs font-medium text-sidebar-foreground uppercase tracking-wide w-12">#</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-sidebar-foreground uppercase tracking-wide">Member</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-sidebar-foreground uppercase tracking-wide">Trainer</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-sidebar-foreground uppercase tracking-wide">Start</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-sidebar-foreground uppercase tracking-wide">End</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-sidebar-foreground uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-sidebar-foreground uppercase tracking-wide">Notes</th>
                <th className="px-4 py-3 w-28" />
              </tr>
            </thead>
            <tbody className="divide-y">

              {isLoading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {[1,2,3,4,5,6,7,8].map(c => (
                    <td key={c} className="px-4 py-3">
                      <div className="h-4 bg-gray-100 rounded animate-pulse w-20" />
                    </td>
                  ))}
                </tr>
              ))}

              {!isLoading && sessions.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-14 text-center">
                    <Dumbbell className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-muted-foreground text-sm font-medium">No sessions found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {search || statusFilter !== 'all' || trainerFilter ? 'Try adjusting your filters.' : 'No PT sessions in this facility yet.'}
                    </p>
                  </td>
                </tr>
              )}

              {/* ── By Trainer: grouped rows ── */}
              {!isLoading && viewMode === 'by_trainer' && sessionsByTrainer.map(group => {
                const completed  = group.sessions.filter(s => s.status === 'completed').length
                const scheduled  = group.sessions.filter(s => s.status === 'scheduled').length
                const noshow     = group.sessions.filter(s => s.status === 'no_show').length
                const cancelled  = group.sessions.filter(s => s.status === 'cancelled').length
                return (
                  <>
                    {/* Trainer header row */}
                    <tr key={`hdr-${group.name}`} className="bg-cyan-50 border-y border-cyan-100">
                      <td colSpan={8} className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <UserCheck className="w-4 h-4 text-[#00B4D8] shrink-0" />
                          <span className="font-semibold text-[#007a99] text-sm">{group.name}</span>
                          <span className="text-xs text-muted-foreground">{group.sessions.length} session{group.sessions.length !== 1 ? 's' : ''}</span>
                          <div className="flex gap-2 ml-2">
                            {scheduled > 0  && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">{scheduled} scheduled</span>}
                            {completed > 0  && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">{completed} completed</span>}
                            {noshow > 0     && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">{noshow} no-show</span>}
                            {cancelled > 0  && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">{cancelled} cancelled</span>}
                          </div>
                        </div>
                      </td>
                    </tr>
                    {/* Session rows for this trainer */}
                    {group.sessions.map(s => {
                      const sCfg = STATUS_CFG[s.status] ?? { label: s.status, cls: 'bg-gray-100 text-gray-600' }
                      return (
                        <tr key={s.id}>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground pl-10">#{s.id}</td>
                          <td className="px-4 py-3">
                            <p className="font-medium leading-tight">{mName(s)}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">ID {s.member_id}</p>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">—</td>
                          <td className="px-4 py-3">
                            <div className="flex items-start gap-1.5">
                              <CalendarDays className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                              <div>
                                <p className="text-sm font-medium">{fmtDate(new Date(s.scheduled_at))}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{fmtTime(new Date(s.scheduled_at))}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-start gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                              <div>
                                <p className="text-sm font-medium">{fmtDate(sessionEnd(s))}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{fmtTime(sessionEnd(s))} · {s.duration_minutes} min</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${sCfg.cls}`}>{sCfg.label}</span>
                          </td>
                          <td className="px-4 py-3 max-w-[160px]">
                            {s.trainer_notes ? <p className="text-xs text-muted-foreground truncate">{s.trainer_notes}</p> : <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {s.status === 'scheduled' && (
                              <div className="flex items-center gap-1 justify-end">
                                <button title="Complete" className="p-1.5 rounded-md text-muted-foreground hover:text-green-600 hover:bg-green-50 transition-colors" onClick={() => { setCompleteId(s.id); setTrainerNotes('') }}><UserCheck className="w-3.5 h-3.5" /></button>
                                <button title="No-show" className="p-1.5 rounded-md text-muted-foreground hover:text-gray-700 hover:bg-gray-100 transition-colors" onClick={() => noShowMutation.mutate(s.id)}><UserX className="w-3.5 h-3.5" /></button>
                                <button title="Cancel" className="p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors" onClick={() => { setCancelId(s.id); setCancelReason('') }}><Ban className="w-3.5 h-3.5" /></button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </>
                )
              })}

              {/* ── All Sessions: flat rows ── */}
              {!isLoading && viewMode === 'admin' && sessions.map(s => {
                const sCfg = STATUS_CFG[s.status] ?? { label: s.status, cls: 'bg-gray-100 text-gray-600' }
                return (
                  <tr key={s.id}>

                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">#{s.id}</td>

                    <td className="px-4 py-3">
                      <p className="font-medium leading-tight">{mName(s)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">ID {s.member_id}</p>
                    </td>

                    <td className="px-4 py-3">
                      <p className="text-sm font-medium">{tName(s)}</p>
                      {s.member_pt_package_id && (
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">pkg #{s.member_pt_package_id}</p>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-start gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-medium">{fmtDate(new Date(s.scheduled_at))}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{fmtTime(new Date(s.scheduled_at))}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-start gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-medium">{fmtDate(sessionEnd(s))}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{fmtTime(sessionEnd(s))} · {s.duration_minutes} min</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${sCfg.cls}`}>
                        {sCfg.label}
                      </span>
                      {s.completed_at && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">{formatDateTime(s.completed_at)}</p>
                      )}
                    </td>

                    <td className="px-4 py-3 max-w-[160px]">
                      {s.trainer_notes
                        ? <p className="text-xs text-muted-foreground truncate" title={s.trainer_notes}>{s.trainer_notes}</p>
                        : <span className="text-muted-foreground text-xs">—</span>}
                      {s.cancel_reason && (
                        <p className="text-[10px] text-red-500 mt-0.5 italic truncate" title={s.cancel_reason}>"{s.cancel_reason}"</p>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {s.status === 'scheduled' && (
                        <div className="flex items-center gap-1 justify-end">
                          <button title="Mark complete"
                            className="p-1.5 rounded-md text-muted-foreground hover:text-green-600 hover:bg-green-50 transition-colors"
                            onClick={() => { setCompleteId(s.id); setTrainerNotes('') }}>
                            <UserCheck className="w-3.5 h-3.5" />
                          </button>
                          <button title="Mark no-show"
                            className="p-1.5 rounded-md text-muted-foreground hover:text-gray-700 hover:bg-gray-100 transition-colors"
                            onClick={() => noShowMutation.mutate(s.id)}>
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                          <button title="Cancel session"
                            className="p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                            onClick={() => { setCancelId(s.id); setCancelReason('') }}>
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
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
              Showing {Math.min((page - 1) * perPage + 1, total)}–{Math.min(page * perPage, total)} of {total} sessions
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

      {/* Complete Session Dialog */}
      <Dialog open={!!completeId} onOpenChange={() => { setCompleteId(null); setTrainerNotes('') }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark Session Complete</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label>Trainer Notes (optional)</Label>
              <Textarea value={trainerNotes} onChange={e => setTrainerNotes(e.target.value)}
                placeholder="Session notes, exercises performed, etc." rows={3} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setCompleteId(null); setTrainerNotes('') }}>Back</Button>
              <Button className="bg-green-600 hover:bg-green-700 text-white"
                disabled={completeMutation.isPending}
                onClick={() => completeId && completeMutation.mutate(completeId)}>
                {completeMutation.isPending ? 'Saving…' : 'Complete Session'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Session Dialog */}
      <Dialog open={!!cancelId} onOpenChange={() => { setCancelId(null); setCancelReason('') }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancel Session</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label>Reason <span className="text-destructive">*</span></Label>
              <Input value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                placeholder="Member requested cancellation" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setCancelId(null); setCancelReason('') }}>Back</Button>
              <Button variant="destructive"
                disabled={!cancelReason.trim() || cancelMutation.isPending}
                onClick={() => cancelId && cancelMutation.mutate(cancelId)}>
                {cancelMutation.isPending ? 'Cancelling…' : 'Cancel Session'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}
