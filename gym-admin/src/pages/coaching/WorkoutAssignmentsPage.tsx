import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Plus, Dumbbell, Eye, Pencil, Ban, Search, Users,
  CheckCircle2, Clock, XCircle, CalendarDays, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { coachingApi, type WorkoutAssignment } from '@/api/coaching.api'
import { trainersApi } from '@/api/trainers.api'
import { formatDate, formatDateTime } from '@/lib/utils'

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  active:    { label: 'Active',    cls: 'bg-green-100 text-green-700 border-green-200',  icon: <CheckCircle2 className="w-3 h-3" /> },
  completed: { label: 'Completed', cls: 'bg-blue-100 text-blue-700 border-blue-200',     icon: <Clock className="w-3 h-3" /> },
  revoked:   { label: 'Revoked',   cls: 'bg-red-100 text-red-600 border-red-200',        icon: <XCircle className="w-3 h-3" /> },
}

function StatusChip({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { label: status, cls: 'bg-gray-100 text-gray-500 border-gray-200', icon: null }
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.cls}`}>
      {cfg.icon} {cfg.label}
    </span>
  )
}

function mName(a: WorkoutAssignment) {
  const u = a.member?.user
  return u ? `${u.first_name} ${u.last_name}` : `Member #${a.member_id}`
}
function tName(a: WorkoutAssignment) {
  const u = a.trainer?.user
  return u ? `${u.first_name} ${u.last_name}` : `Trainer #${a.trainer_id}`
}
function durationLabel(a: WorkoutAssignment) {
  if (!a.end_date) return '—'
  const d1 = new Date(a.start_date), d2 = new Date(a.end_date)
  const days = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24))
  return days <= 0 ? '—' : `${days} days`
}

type ViewMode = 'by_trainer' | 'by_member'
const PER_PAGE = 50

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WorkoutAssignmentsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [viewMode, setViewMode] = useState<ViewMode>('by_trainer')
  const [selectedTrainerId, setSelectedTrainerId] = useState<string>('')
  const [memberIdInput, setMemberIdInput] = useState('')
  const [activeMemberId, setActiveMemberId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // ── Trainers list ──────────────────────────────────────────────────────────
  const { data: trainersData, isLoading: trainersLoading } = useQuery({
    queryKey: ['trainers'],
    queryFn: () => trainersApi.list(),
  })
  const trainers: any[] = (trainersData as any)?.trainers ?? []

  // ── Assignments — by trainer ───────────────────────────────────────────────
  const { data: trainerAssignmentsData, isLoading: trainerLoading } = useQuery({
    queryKey: ['workout-assignments-trainer', selectedTrainerId],
    queryFn: () => coachingApi.listWorkoutAssignmentsByTrainer(parseInt(selectedTrainerId), { per_page: PER_PAGE }),
    enabled: viewMode === 'by_trainer' && !!selectedTrainerId,
  })

  // ── Assignments — by member ────────────────────────────────────────────────
  const { data: memberAssignmentsData, isLoading: memberLoading } = useQuery({
    queryKey: ['workout-assignments-member', activeMemberId],
    queryFn: () => coachingApi.listWorkoutAssignmentsByMember(activeMemberId!, { per_page: PER_PAGE }),
    enabled: viewMode === 'by_member' && !!activeMemberId,
  })

  const rawAssignments: WorkoutAssignment[] = viewMode === 'by_trainer'
    ? ((trainerAssignmentsData as any)?.workout_assignments ?? [])
    : ((memberAssignmentsData as any)?.workout_assignments ?? [])

  const isLoading = viewMode === 'by_trainer' ? trainerLoading : memberLoading

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => rawAssignments.filter(a => {
    const matchStatus = statusFilter === 'all' || a.status === statusFilter
    const q = search.toLowerCase()
    const matchSearch = !q ||
      mName(a).toLowerCase().includes(q) ||
      tName(a).toLowerCase().includes(q) ||
      a.title.toLowerCase().includes(q)
    return matchStatus && matchSearch
  }), [rawAssignments, search, statusFilter])

  // ── Stats ──────────────────────────────────────────────────────────────────
  const activeCount    = rawAssignments.filter(a => a.status === 'active').length
  const completedCount = rawAssignments.filter(a => a.status === 'completed').length
  const revokedCount   = rawAssignments.filter(a => a.status === 'revoked').length

  // ── Revoke ─────────────────────────────────────────────────────────────────
  const revokeMutation = useMutation({
    mutationFn: (id: number) => coachingApi.revokeWorkoutAssignment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workout-assignments-trainer'] })
      qc.invalidateQueries({ queryKey: ['workout-assignments-member'] })
      toast.success('Workout assignment revoked')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to revoke'),
  })

  const handleRevoke = (a: WorkoutAssignment) => {
    if (!confirm(`Revoke "${a.title}" for ${mName(a)}?`)) return
    revokeMutation.mutate(a.id)
  }

  const hasSelection = viewMode === 'by_trainer' ? !!selectedTrainerId : !!activeMemberId
  const selectedTrainer = trainers.find(t => String(t.id) === selectedTrainerId)

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="relative overflow-hidden -mx-6 -mt-6 bg-gradient-to-br from-violet-700 via-purple-700 to-fuchsia-700 text-white">
        <div className="relative px-6 py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold tracking-widest uppercase text-white/55 mb-1.5">Coaching</p>
              <div className="flex items-center gap-2.5 mb-1">
                <Dumbbell className="w-5 h-5 opacity-80" />
                <h1 className="text-2xl font-bold tracking-tight">Workout Assignments</h1>
              </div>
              <p className="text-sm text-white/65">Workout plans assigned to members by trainers</p>
            </div>
            <Button onClick={() => navigate('/coaching/workouts/new')}
              className="shrink-0 bg-white text-violet-800 hover:bg-white/90">
              <Plus className="w-4 h-4 mr-1.5" /> New Assignment
            </Button>
          </div>
        </div>

        {/* Stat strip — only when data loaded */}
        {hasSelection && (
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/15 border-t border-white/15">
            <div className="px-5 py-4">
              <p className="text-xl font-bold">{rawAssignments.length}</p>
              <p className="text-xs font-medium text-white/85 mt-1">Total Assignments</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-xl font-bold text-green-300">{activeCount}</p>
              <p className="text-xs font-medium text-white/85 mt-1">Active</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-xl font-bold text-blue-300">{completedCount}</p>
              <p className="text-xs font-medium text-white/85 mt-1">Completed</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-xl font-bold text-red-300">{revokedCount}</p>
              <p className="text-xs font-medium text-white/85 mt-1">Revoked</p>
            </div>
          </div>
        )}
        <div className="absolute -right-6 -top-6 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute right-20 -bottom-8 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />
      </div>

      {/* ── View mode toggle ── */}
      <div className="flex items-center gap-1 p-1 bg-muted rounded-lg w-fit">
        <button
          onClick={() => { setViewMode('by_trainer'); setSearch(''); setStatusFilter('all') }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            viewMode === 'by_trainer' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <CalendarDays className="w-3.5 h-3.5" /> By Trainer
        </button>
        <button
          onClick={() => { setViewMode('by_member'); setSearch(''); setStatusFilter('all') }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            viewMode === 'by_member' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users className="w-3.5 h-3.5" /> By Member
        </button>
      </div>

      {/* ── Selector + Filters ── */}
      <div className="flex flex-wrap gap-3 items-end">

        {viewMode === 'by_trainer' ? (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Select Trainer</p>
            <select
              value={selectedTrainerId}
              onChange={e => setSelectedTrainerId(e.target.value)}
              className="h-9 min-w-56 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— Choose a trainer —</option>
              {trainersLoading
                ? <option disabled>Loading…</option>
                : trainers.map(t => (
                  <option key={t.id} value={String(t.id)}>
                    {t.user?.first_name} {t.user?.last_name}
                  </option>
                ))
              }
            </select>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Member ID</p>
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                placeholder="Enter Member ID"
                value={memberIdInput}
                onChange={e => setMemberIdInput(e.target.value)}
                className="h-9 w-44"
                onKeyDown={e => e.key === 'Enter' && setActiveMemberId(parseInt(memberIdInput) || null)}
              />
              <Button size="sm" variant="outline"
                onClick={() => setActiveMemberId(parseInt(memberIdInput) || null)}
                disabled={!memberIdInput}>
                <Search className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}

        {hasSelection && (
          <>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Search</p>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search by member, title…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="h-9 w-56 pl-8"
                />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Status</p>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="revoked">Revoked</option>
              </select>
            </div>
          </>
        )}
      </div>

      {/* ── Table ── */}
      <Card>
        <CardContent className="p-0">
          {!hasSelection ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                <Dumbbell className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="font-semibold text-foreground">
                {viewMode === 'by_trainer' ? 'Select a trainer to view their assignments' : 'Enter a Member ID to view assignments'}
              </p>
              <p className="text-sm text-muted-foreground max-w-xs">
                {viewMode === 'by_trainer'
                  ? 'Choose a trainer from the dropdown above to see all workout assignments they have created.'
                  : 'Type a member ID and press Enter or click the search button.'}
              </p>
            </div>
          ) : isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-sidebar">
                  <tr>
                    {['#', 'Member', 'Trainer', 'Program Title', 'Start Date', 'End Date', 'Duration', 'Status', 'Created On', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-light text-sidebar-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-14 text-muted-foreground">
                        {rawAssignments.length === 0
                          ? (viewMode === 'by_trainer'
                            ? `${selectedTrainer ? (selectedTrainer.user?.first_name + ' ' + selectedTrainer.user?.last_name) : 'This trainer'} has no workout assignments yet.`
                            : 'No workout assignments found for this member.')
                          : 'No assignments match your filters.'}
                      </td>
                    </tr>
                  ) : filtered.map((a, idx) => (
                    <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground text-xs">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold">{mName(a)}</p>
                        <p className="text-xs text-muted-foreground">ID: {a.member_id}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{tName(a)}</p>
                        <p className="text-xs text-muted-foreground">ID: {a.trainer_id}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium max-w-[200px] truncate" title={a.title}>{a.title}</p>
                        {a.description && (
                          <p className="text-xs text-muted-foreground max-w-[200px] truncate" title={a.description}>
                            {a.description}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <CalendarDays className="w-3 h-3 shrink-0" />
                          {formatDate(a.start_date)}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {a.end_date ? formatDate(a.end_date) : <span className="text-muted-foreground/40">No end date</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{durationLabel(a)}</td>
                      <td className="px-4 py-3"><StatusChip status={a.status} /></td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground text-xs">
                        {formatDate(a.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            title="View"
                            onClick={() => navigate(`/coaching/workouts/${a.id}`)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            title="Edit"
                            onClick={() => navigate(`/coaching/workouts/${a.id}/edit`)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {a.status === 'active' && (
                            <button
                              title="Revoke"
                              onClick={() => handleRevoke(a)}
                              disabled={revokeMutation.isPending}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              <Ban className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {hasSelection && !isLoading && filtered.length > 0 && (
            <div className="px-4 py-3 border-t text-xs text-muted-foreground">
              Showing {filtered.length} of {rawAssignments.length} assignments
              {selectedTrainer && (
                <span className="ml-1">for <span className="font-medium text-foreground">{selectedTrainer.user?.first_name} {selectedTrainer.user?.last_name}</span></span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
