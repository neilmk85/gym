import { useState } from 'react'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Wrench, Pencil, Trash2, CheckCircle2, Clock, XCircle, AlertTriangle,
  ChevronDown, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'
import {
  maintenanceApi,
  type MaintenanceTask,
  type MaintenanceStatus,
  type MaintenancePriority,
  type MaintenanceCategory,
  type CreateMaintenancePayload,
  type UpdateMaintenancePayload,
} from '@/api/maintenance.api'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<MaintenanceStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending:     { label: 'Pending',     color: 'bg-amber-100 text-amber-700 border-amber-200',  icon: <Clock className="w-3 h-3" /> },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700 border-blue-200',     icon: <Loader2 className="w-3 h-3" /> },
  done:        { label: 'Done',        color: 'bg-green-100 text-green-700 border-green-200',  icon: <CheckCircle2 className="w-3 h-3" /> },
  cancelled:   { label: 'Cancelled',   color: 'bg-gray-100 text-gray-500 border-gray-200',     icon: <XCircle className="w-3 h-3" /> },
}

const PRIORITY_CFG: Record<MaintenancePriority, { label: string; color: string; dot: string }> = {
  low:    { label: 'Low',    color: 'bg-gray-100 text-gray-600 border-gray-200',    dot: 'bg-gray-400' },
  medium: { label: 'Medium', color: 'bg-blue-50 text-blue-700 border-blue-200',     dot: 'bg-blue-500' },
  high:   { label: 'High',   color: 'bg-red-50 text-red-700 border-red-200',        dot: 'bg-red-500' },
}

const CATEGORY_LABELS: Record<MaintenanceCategory, string> = {
  equipment: 'Equipment', plumbing: 'Plumbing', electrical: 'Electrical',
  hvac: 'HVAC', flooring: 'Flooring', other: 'Other',
}

const ALL_STATUSES: MaintenanceStatus[] = ['pending', 'in_progress', 'done', 'cancelled']
const ALL_PRIORITIES: MaintenancePriority[] = ['low', 'medium', 'high']
const ALL_CATEGORIES: MaintenanceCategory[] = ['equipment', 'plumbing', 'electrical', 'hvac', 'flooring', 'other']

// ── Chip helpers ───────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: MaintenanceStatus }) {
  const cfg = STATUS_CFG[status]
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.color}`}>
      {cfg.icon} {cfg.label}
    </span>
  )
}

function PriorityChip({ priority }: { priority: MaintenancePriority }) {
  const cfg = PRIORITY_CFG[priority]
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

// ── Drawer form ────────────────────────────────────────────────────────────────

interface DrawerProps {
  open: boolean
  onClose: () => void
  editing?: MaintenanceTask | null
  onSaved: () => void
}

function MaintenanceDrawer({ open, onClose, editing, onSaved }: DrawerProps) {
  const [title, setTitle] = useState(editing?.title ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [category, setCategory] = useState<MaintenanceCategory>(editing?.category ?? 'other')
  const [priority, setPriority] = useState<MaintenancePriority>(editing?.priority ?? 'medium')
  const [status, setStatus] = useState<MaintenanceStatus>(editing?.status ?? 'pending')
  const [assignedTo, setAssignedTo] = useState(editing?.assigned_to ?? '')
  const [estimateCost, setEstimateCost] = useState(editing?.estimate_cost?.toString() ?? '')
  const [actualCost, setActualCost] = useState(editing?.actual_cost?.toString() ?? '')
  const [scheduledAt, setScheduledAt] = useState(
    editing?.scheduled_at ? editing.scheduled_at.substring(0, 10) : ''
  )
  const [notes, setNotes] = useState(editing?.notes ?? '')

  const qc = useQueryClient()

  const createMutation = useMutation({
    mutationFn: (data: CreateMaintenancePayload) => maintenanceApi.create(data),
    onSuccess: () => { toast.success('Task created'); qc.invalidateQueries({ queryKey: ['maintenance'] }); onSaved() },
    onError: () => toast.error('Failed to create task'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: UpdateMaintenancePayload) => maintenanceApi.update(editing!.id, data),
    onSuccess: () => { toast.success('Task updated'); qc.invalidateQueries({ queryKey: ['maintenance'] }); onSaved() },
    onError: () => toast.error('Failed to update task'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { toast.error('Title is required'); return }
    const payload = {
      title: title.trim(),
      description,
      category,
      priority,
      status,
      assigned_to: assignedTo,
      estimate_cost: estimateCost ? parseFloat(estimateCost) : undefined,
      actual_cost: actualCost ? parseFloat(actualCost) : undefined,
      scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      notes,
    }
    if (editing) {
      updateMutation.mutate(payload)
    } else {
      createMutation.mutate(payload)
    }
  }

  const busy = createMutation.isPending || updateMutation.isPending

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{editing ? 'Edit Task' : 'New Maintenance Task'}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label>Title <span className="text-red-500">*</span></Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Replace treadmill belt" />
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Details about the issue..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as MaintenanceCategory)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {ALL_CATEGORIES.map(c => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Priority</Label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as MaintenancePriority)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {ALL_PRIORITIES.map(p => (
                  <option key={p} value={p}>{PRIORITY_CFG[p].label}</option>
                ))}
              </select>
            </div>
          </div>

          {editing && (
            <div className="space-y-1.5">
              <Label>Status</Label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as MaintenanceStatus)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {ALL_STATUSES.map(s => (
                  <option key={s} value={s}>{STATUS_CFG[s].label}</option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Assigned To</Label>
            <Input value={assignedTo} onChange={e => setAssignedTo(e.target.value)} placeholder="Name or vendor" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Estimate Cost (₹)</Label>
              <Input type="number" min="0" step="0.01" value={estimateCost} onChange={e => setEstimateCost(e.target.value)} placeholder="0" />
            </div>
            {editing && (
              <div className="space-y-1.5">
                <Label>Actual Cost (₹)</Label>
                <Input type="number" min="0" step="0.01" value={actualCost} onChange={e => setActualCost(e.target.value)} placeholder="0" />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Scheduled Date</Label>
            <Input type="date" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Additional notes..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              {editing ? 'Save Changes' : 'Create Task'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function MaintenancePage() {
  const qc = useQueryClient()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<MaintenanceTask | null>(null)
  const [statusFilter, setStatusFilter] = useState<MaintenanceStatus | ''>('')
  const [priorityFilter, setPriorityFilter] = useState<MaintenancePriority | ''>('')
  const [categoryFilter, setCategoryFilter] = useState<MaintenanceCategory | ''>('')
  const [filterOpen, setFilterOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['maintenance', statusFilter, priorityFilter, categoryFilter],
    queryFn: () => maintenanceApi.list({
      per_page: 100,
      status: statusFilter || undefined,
      priority: priorityFilter || undefined,
      category: categoryFilter || undefined,
    }),
  })

  const tasks: MaintenanceTask[] = data?.data?.tasks ?? []

  const deleteMutation = useMutation({
    mutationFn: (id: number) => maintenanceApi.delete(id),
    onSuccess: () => { toast.success('Task deleted'); qc.invalidateQueries({ queryKey: ['maintenance'] }) },
    onError: () => toast.error('Failed to delete task'),
  })

  function handleDelete(t: MaintenanceTask) {
    if (!confirm(`Delete "${t.title}"?`)) return
    deleteMutation.mutate(t.id)
  }

  function openCreate() { setEditing(null); setDrawerOpen(true) }
  function openEdit(t: MaintenanceTask) { setEditing(t); setDrawerOpen(true) }
  function closeDrawer() { setDrawerOpen(false); setEditing(null) }

  // Stats
  const pending     = tasks.filter(t => t.status === 'pending').length
  const inProgress  = tasks.filter(t => t.status === 'in_progress').length
  const done        = tasks.filter(t => t.status === 'done').length
  const highPriority = tasks.filter(t => t.priority === 'high' && t.status !== 'done').length

  const hasFilters = statusFilter || priorityFilter || categoryFilter

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="relative overflow-hidden -mx-6 -mt-6 bg-gradient-to-br from-slate-700 via-gray-700 to-zinc-700 text-white">
        <div className="relative px-6 py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold tracking-widest uppercase text-white/55 mb-1.5">Purchases</p>
              <div className="flex items-center gap-2.5 mb-1">
                <Wrench className="w-5 h-5 opacity-80" />
                <h1 className="text-2xl font-bold tracking-tight">Maintenance</h1>
              </div>
              <p className="text-sm text-white/65">Track repairs, equipment servicing, and facility upkeep</p>
            </div>
            <Button onClick={openCreate} className="shrink-0 bg-white text-slate-800 hover:bg-white/90">
              <Plus className="w-4 h-4 mr-1.5" /> New Task
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/15 border-t border-white/15">
          <div className="px-5 py-4">
            <p className="text-xl font-bold">{tasks.length}</p>
            <p className="text-xs font-medium text-white/85 mt-1">Total Tasks</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xl font-bold text-amber-300">{pending}</p>
            <p className="text-xs font-medium text-white/85 mt-1">Pending</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xl font-bold text-blue-300">{inProgress}</p>
            <p className="text-xs font-medium text-white/85 mt-1">In Progress</p>
          </div>
          <div className="px-5 py-4">
            <p className={`text-xl font-bold ${highPriority > 0 ? 'text-red-300' : 'text-white'}`}>{highPriority}</p>
            <p className="text-xs font-medium text-white/85 mt-1">High Priority Open</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Button variant="outline" size="sm" onClick={() => setFilterOpen(v => !v)} className="gap-1.5">
            Filters {hasFilters ? <span className="text-xs bg-primary text-primary-foreground rounded-full px-1.5">{[statusFilter, priorityFilter, categoryFilter].filter(Boolean).length}</span> : null}
            <ChevronDown className="w-3.5 h-3.5 opacity-60" />
          </Button>
          {filterOpen && (
            <div className="absolute top-full left-0 mt-1 z-20 bg-background border rounded-lg shadow-lg p-4 space-y-3 min-w-[260px]">
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as MaintenanceStatus | '')}
                  className="flex h-8 w-full rounded border border-input bg-background px-2 text-sm"
                >
                  <option value="">All Statuses</option>
                  {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_CFG[s].label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Priority</Label>
                <select
                  value={priorityFilter}
                  onChange={e => setPriorityFilter(e.target.value as MaintenancePriority | '')}
                  className="flex h-8 w-full rounded border border-input bg-background px-2 text-sm"
                >
                  <option value="">All Priorities</option>
                  {ALL_PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_CFG[p].label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <select
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value as MaintenanceCategory | '')}
                  className="flex h-8 w-full rounded border border-input bg-background px-2 text-sm"
                >
                  <option value="">All Categories</option>
                  {ALL_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                </select>
              </div>
              {hasFilters && (
                <Button variant="ghost" size="sm" className="w-full"
                  onClick={() => { setStatusFilter(''); setPriorityFilter(''); setCategoryFilter('') }}>
                  Clear filters
                </Button>
              )}
            </div>
          )}
        </div>

        {statusFilter && (
          <span className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-full">
            {STATUS_CFG[statusFilter].label}
            <button onClick={() => setStatusFilter('')} className="text-muted-foreground hover:text-foreground ml-0.5">×</button>
          </span>
        )}
        {priorityFilter && (
          <span className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-full">
            {PRIORITY_CFG[priorityFilter].label} priority
            <button onClick={() => setPriorityFilter('')} className="text-muted-foreground hover:text-foreground ml-0.5">×</button>
          </span>
        )}
        {categoryFilter && (
          <span className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-full">
            {CATEGORY_LABELS[categoryFilter]}
            <button onClick={() => setCategoryFilter('')} className="text-muted-foreground hover:text-foreground ml-0.5">×</button>
          </span>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading tasks…
        </div>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <Wrench className="w-10 h-10 opacity-30" />
            <p className="font-medium">No maintenance tasks</p>
            <p className="text-sm">Create a task to track repairs and upkeep</p>
            <Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1.5" /> New Task</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Category</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Priority</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Assigned To</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Est. Cost</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actual Cost</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Scheduled</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {tasks.map(t => (
                    <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium">{t.title}</div>
                        {t.description && (
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">{t.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground capitalize">{CATEGORY_LABELS[t.category] ?? t.category}</td>
                      <td className="px-4 py-3"><PriorityChip priority={t.priority} /></td>
                      <td className="px-4 py-3"><StatusChip status={t.status} /></td>
                      <td className="px-4 py-3 text-muted-foreground">{t.assigned_to || '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {t.estimate_cost > 0 ? `₹${t.estimate_cost.toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {t.actual_cost > 0 ? `₹${t.actual_cost.toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {t.scheduled_at ? formatDate(t.scheduled_at) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(t)}
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(t)}
                            className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <MaintenanceDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        editing={editing}
        onSaved={closeDrawer}
      />
    </div>
  )
}
