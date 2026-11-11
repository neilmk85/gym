import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { retentionApi, type RetentionRisk, type RetentionAction } from '@/api/retention.api'
import { membersApi } from '@/api/members.api'
import { reportsApi, type InactiveMember } from '@/api/reports.api'
import type { Member } from '@/types/member.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import {
  ShieldAlert, AlertTriangle, CheckCircle, ChevronDown, ChevronUp,
  Phone, MessageSquare, MapPin, MoreHorizontal, Plus, Search,
  UserX, TrendingDown, Clock, Flag, X, Zap,
} from 'lucide-react'

// ── constants ──────────────────────────────────────────────────────────────

const RISK_CONFIG = {
  high:   { color: 'bg-red-100 text-red-700 border-red-200',    dot: 'bg-red-500',    label: 'High Risk',   desc: 'Likely to leave soon' },
  medium: { color: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-400', label: 'Medium Risk', desc: 'Needs attention' },
  low:    { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', dot: 'bg-yellow-400', label: 'Low Risk',    desc: 'Worth monitoring' },
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  call:    <Phone className="w-3.5 h-3.5" />,
  message: <MessageSquare className="w-3.5 h-3.5" />,
  visit:   <MapPin className="w-3.5 h-3.5" />,
  other:   <MoreHorizontal className="w-3.5 h-3.5" />,
}

const WHAT_TO_WATCH = [
  { icon: <TrendingDown className="w-5 h-5 text-red-500" />, bg: 'bg-red-50', title: 'Missing workouts', desc: 'Member hasn\'t checked in for 2+ weeks' },
  { icon: <Clock className="w-5 h-5 text-orange-500" />,     bg: 'bg-orange-50', title: 'Expiry approaching', desc: 'Membership ends soon and no renewal yet' },
  { icon: <UserX className="w-5 h-5 text-yellow-600" />,     bg: 'bg-yellow-50', title: 'No engagement', desc: 'Not using any classes or PT sessions' },
  { icon: <AlertTriangle className="w-5 h-5 text-purple-500" />, bg: 'bg-purple-50', title: 'Flagged by staff', desc: 'Trainer or front desk raised a concern' },
]

const emptyFlag = { member_id: '', risk_level: 'medium', reason: '', notes: '' }
const emptyAction = { action_type: 'call', due_date: new Date().toISOString().slice(0, 10), notes: '' }

// ── component ──────────────────────────────────────────────────────────────

export default function RetentionWorkspacePage() {
  const qc = useQueryClient()
  const [expandRisk, setExpandRisk] = useState<number | null>(null)
  const [actionTarget, setActionTarget] = useState<RetentionRisk | null>(null)
  const [showFlagForm, setShowFlagForm] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const [flagForm, setFlagForm] = useState({ ...emptyFlag })
  const [actionForm, setActionForm] = useState({ ...emptyAction })
  const [dismissedAutoFlags, setDismissedAutoFlags] = useState<number[]>([])

  // Auto-detected: members inactive >14 days
  const { data: inactiveRaw } = useQuery({
    queryKey: ['inactive-members-14'],
    queryFn: () => reportsApi.inactive(14),
    staleTime: 5 * 60 * 1000,
  })
  const inactiveMembers: InactiveMember[] = (inactiveRaw as any)?.members ?? []

  // All open risks
  const { data: risksRaw, isLoading } = useQuery({
    queryKey: ['retention-risks'],
    queryFn: () => retentionApi.listOpenRisks({ per_page: 50 }),
  })
  const risks: RetentionRisk[] = (risksRaw as any)?.retention_risks ?? []
  const high   = risks.filter(r => r.risk_level === 'high')
  const medium = risks.filter(r => r.risk_level === 'medium')
  const low    = risks.filter(r => r.risk_level === 'low')

  // Members already flagged — don't show them in auto-detect again
  const alreadyFlaggedIds = new Set(risks.map(r => r.member_id))
  const pendingAutoFlags = inactiveMembers.filter(
    m => !alreadyFlaggedIds.has(m.member_id) && !dismissedAutoFlags.includes(m.member_id),
  )

  // Actions for expanded risk
  const { data: actionsRaw } = useQuery({
    queryKey: ['retention-actions', expandRisk],
    queryFn: () => retentionApi.listActionsByRisk(expandRisk!),
    enabled: !!expandRisk,
  })
  const actions: RetentionAction[] = (actionsRaw as any)?.retention_actions ?? []

  // Member search for flag form
  const { data: membersRaw } = useQuery({
    queryKey: ['members-retention-search', memberSearch],
    queryFn: () => membersApi.list({ search: memberSearch, per_page: 10 }),
    enabled: memberSearch.length > 1,
  })
  const memberResults: Member[] = (membersRaw as any)?.data ?? []

  const resolveMutation = useMutation({
    mutationFn: (id: number) => retentionApi.resolveRisk(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['retention-risks'] }); toast.success('Marked as resolved') },
  })

  const flagMutation = useMutation({
    mutationFn: () => retentionApi.raiseRisk({
      member_id: Number(flagForm.member_id),
      risk_level: flagForm.risk_level,
      reason: flagForm.reason,
      notes: flagForm.notes,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['retention-risks'] })
      toast.success('Member flagged')
      setShowFlagForm(false); setFlagForm({ ...emptyFlag }); setMemberSearch('')
    },
    onError: () => toast.error('Failed to flag member'),
  })

  const createActionMutation = useMutation({
    mutationFn: () => retentionApi.createAction({
      retention_risk_id: actionTarget!.id,
      member_id: actionTarget!.member_id,
      assigned_to_id: 1, // default; can be extended later
      action_type: actionForm.action_type,
      due_date: actionForm.due_date,
      notes: actionForm.notes,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['retention-actions', actionTarget?.id] })
      toast.success('Action added')
      setActionTarget(null); setActionForm({ ...emptyAction })
    },
    onError: () => toast.error('Failed to add action'),
  })

  const completeActionMutation = useMutation({
    mutationFn: (id: number) => retentionApi.completeAction(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['retention-actions', expandRisk] }); toast.success('Action marked done') },
  })

  const memberName = (r: RetentionRisk) =>
    r.member?.user ? `${r.member.user.first_name} ${r.member.user.last_name}` : `Member #${r.member_id}`

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden -mx-6 -mt-6 bg-gradient-to-r from-rose-600 via-red-500 to-orange-500 px-6 py-6 text-white">
        <div className="relative flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <ShieldAlert className="w-6 h-6 opacity-90" />
              <h1 className="text-xl font-bold">Retention Workspace</h1>
            </div>
            <p className="text-sm text-white/85 max-w-2xl">
              Identify members who might be about to leave — and act before it's too late. Flag at-risk members, assign follow-up tasks to staff, and mark them resolved once they're back on track.
            </p>
          </div>
          <Button
            onClick={() => setShowFlagForm(v => !v)}
            className="shrink-0 bg-white/20 hover:bg-white/30 text-white border border-white/30 gap-2"
          >
            <Flag className="w-4 h-4" /> Flag a Member
          </Button>
        </div>
        <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute -right-2 -bottom-8 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
      </div>

      {/* ── Flag member form ───────────────────────────────────────────── */}
      {showFlagForm && (
        <Card className="border-red-200 bg-red-50/30 shadow-sm">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm">Flag a member as at-risk</p>
              <button onClick={() => { setShowFlagForm(false); setFlagForm({ ...emptyFlag }); setMemberSearch('') }}>
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Search Member</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Type name or phone..."
                    value={memberSearch}
                    onChange={e => { setMemberSearch(e.target.value); setFlagForm(f => ({ ...f, member_id: '' })) }}
                  />
                </div>
                {memberSearch.length > 1 && memberResults.length > 0 && !flagForm.member_id && (
                  <div className="border rounded-lg divide-y max-h-40 overflow-y-auto bg-white shadow-sm">
                    {memberResults.map(m => (
                      <button
                        key={m.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted/40 transition-colors"
                        onClick={() => { setFlagForm(f => ({ ...f, member_id: String(m.id) })); setMemberSearch(`${m.user.first_name} ${m.user.last_name}`) }}
                      >
                        <span className="font-medium">{m.user.first_name} {m.user.last_name}</span>
                        <span className="text-muted-foreground ml-2 text-xs">{m.user.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Risk Level</Label>
                <Select value={flagForm.risk_level} onValueChange={v => setFlagForm(f => ({ ...f, risk_level: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">🔴 High — likely to leave soon</SelectItem>
                    <SelectItem value="medium">🟠 Medium — needs attention</SelectItem>
                    <SelectItem value="low">🟡 Low — worth monitoring</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Why are they at risk? <span className="text-muted-foreground font-normal">(brief reason)</span></Label>
              <Input
                placeholder="e.g. Hasn't visited in 3 weeks, membership expiring next week"
                value={flagForm.reason}
                onChange={e => setFlagForm(f => ({ ...f, reason: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Extra notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                placeholder="e.g. Was very active before, worth saving"
                value={flagForm.notes}
                onChange={e => setFlagForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowFlagForm(false); setFlagForm({ ...emptyFlag }); setMemberSearch('') }}>Cancel</Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => flagMutation.mutate()}
                disabled={flagMutation.isPending || !flagForm.member_id || !flagForm.reason}
              >
                {flagMutation.isPending ? 'Flagging...' : 'Flag Member'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Auto-detected: inactive >14 days ─────────────────────────── */}
      {pendingAutoFlags.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/30 shadow-sm">
          <CardContent className="p-0">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-orange-200/70">
              <Zap className="w-4 h-4 text-orange-500" />
              <p className="font-semibold text-sm text-orange-700">
                {pendingAutoFlags.length} member{pendingAutoFlags.length !== 1 ? 's' : ''} auto-detected as at-risk
              </p>
              <span className="ml-auto text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full border border-orange-200">
                Inactive &gt;14 days
              </span>
            </div>
            <div className="divide-y divide-orange-100">
              {pendingAutoFlags.map(m => (
                <div key={m.member_id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold shrink-0">
                    {m.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{m.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {m.phone}
                      {m.days_since_visit != null
                        ? ` · Last visit ${m.days_since_visit} day${m.days_since_visit !== 1 ? 's' : ''} ago`
                        : ' · Never visited'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-orange-600 hover:bg-orange-700 text-white gap-1"
                      onClick={() => {
                        setMemberSearch(m.name)
                        setFlagForm({
                          member_id: String(m.member_id),
                          risk_level: 'high',
                          reason: m.days_since_visit != null
                            ? `No gym visit in ${m.days_since_visit} days`
                            : 'Never visited the gym',
                          notes: '',
                        })
                        setShowFlagForm(true)
                      }}
                    >
                      <Flag className="w-3 h-3" /> Flag
                    </Button>
                    <button
                      className="p-1 text-muted-foreground hover:text-foreground"
                      title="Dismiss"
                      onClick={() => setDismissedAutoFlags(d => [...d, m.member_id])}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── What to watch for ─────────────────────────────────────────── */}
      {risks.length === 0 && !isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {WHAT_TO_WATCH.map((w, i) => (
            <div key={i} className={`rounded-xl p-4 border ${w.bg}`}>
              <div className="mb-2">{w.icon}</div>
              <p className="font-semibold text-sm mb-1">{w.title}</p>
              <p className="text-xs text-muted-foreground">{w.desc}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Risk summary cards ─────────────────────────────────────────── */}
      {risks.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { level: 'high',   count: high.length,   gradient: 'from-red-500 to-rose-600',       shadow: 'shadow-red-200' },
            { level: 'medium', count: medium.length, gradient: 'from-orange-400 to-amber-500',   shadow: 'shadow-orange-200' },
            { level: 'low',    count: low.length,    gradient: 'from-yellow-400 to-amber-400',   shadow: 'shadow-yellow-200' },
          ].map(({ level, count, gradient, shadow }) => (
            <div key={level} className={`rounded-xl bg-gradient-to-br ${gradient} p-5 text-white shadow-lg ${shadow}`}>
              <p className="text-sm font-medium opacity-90 capitalize mb-2">{level} Risk</p>
              <p className="text-4xl font-bold">{count}</p>
              <p className="text-xs opacity-75 mt-1">{RISK_CONFIG[level as keyof typeof RISK_CONFIG].desc}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── At-risk members list ───────────────────────────────────────── */}
      {isLoading && (
        <div className="text-center py-16 text-muted-foreground">Loading...</div>
      )}

      {!isLoading && risks.length === 0 && (
        <div className="text-center py-16 border rounded-xl text-muted-foreground">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
          <p className="font-semibold">All clear — no at-risk members</p>
          <p className="text-sm mt-1">Use "Flag a Member" to track someone who might be about to leave.</p>
        </div>
      )}

      {risks.length > 0 && (
        <Card className="shadow-lg shadow-gray-200/80 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b bg-red-50/50 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <p className="font-medium text-sm text-red-700">{risks.length} member{risks.length !== 1 ? 's' : ''} need attention</p>
          </div>

          <div className="divide-y">
            {/* High first, then medium, then low */}
            {[...high, ...medium, ...low].map(risk => {
              const cfg = RISK_CONFIG[risk.risk_level]
              const isExpanded = expandRisk === risk.id
              const name = memberName(risk)

              return (
                <div key={risk.id} className="px-4 py-4">
                  <div className="flex items-start gap-3">

                    {/* Risk dot */}
                    <div className={`w-2.5 h-2.5 rounded-full mt-2 shrink-0 ${cfg.dot}`} />

                    <div className="flex-1 min-w-0">
                      {/* Top row */}
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold">{name}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        <span className="text-xs text-muted-foreground">Flagged {formatDate(risk.created_at)}</span>
                      </div>

                      {/* Reason */}
                      <p className="text-sm text-muted-foreground mb-2">{risk.reason}</p>

                      {/* Actions when expanded */}
                      {isExpanded && (
                        <div className="mt-3 space-y-3">
                          {/* Existing actions */}
                          {actions.length > 0 && (
                            <div className="space-y-2">
                              {actions.map(a => (
                                <div key={a.id} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <span className={`p-1.5 rounded-full ${a.status === 'done' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                                      {ACTION_ICONS[a.action_type]}
                                    </span>
                                    <div>
                                      <span className="text-sm font-medium capitalize">{a.action_type}</span>
                                      <span className="text-xs text-muted-foreground ml-2">due {formatDate(a.due_date)}</span>
                                      {a.notes && <p className="text-xs text-muted-foreground">{a.notes}</p>}
                                    </div>
                                  </div>
                                  {a.status === 'open' ? (
                                    <Button
                                      size="sm" variant="outline"
                                      className="text-green-700 border-green-200 hover:bg-green-50 text-xs"
                                      onClick={() => completeActionMutation.mutate(a.id)}
                                    >
                                      <CheckCircle className="w-3.5 h-3.5 mr-1" /> Done
                                    </Button>
                                  ) : (
                                    <Badge className="bg-green-100 text-green-700 text-xs">Done</Badge>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add action form */}
                          {actionTarget?.id === risk.id ? (
                            <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 space-y-3">
                              <p className="text-sm font-medium">Add a follow-up task</p>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                  <Label>What to do?</Label>
                                  <Select value={actionForm.action_type} onValueChange={v => setActionForm(f => ({ ...f, action_type: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="call">📞 Call them</SelectItem>
                                      <SelectItem value="message">💬 Send a message</SelectItem>
                                      <SelectItem value="visit">📍 Check in person</SelectItem>
                                      <SelectItem value="other">📌 Other</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1.5">
                                  <Label>By when?</Label>
                                  <Input type="date" value={actionForm.due_date} onChange={e => setActionForm(f => ({ ...f, due_date: e.target.value }))} />
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
                                <Input placeholder="e.g. Remind them about the new yoga class" value={actionForm.notes} onChange={e => setActionForm(f => ({ ...f, notes: e.target.value }))} />
                              </div>
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => { setActionTarget(null); setActionForm({ ...emptyAction }) }}>Cancel</Button>
                                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white"
                                  onClick={() => createActionMutation.mutate()}
                                  disabled={createActionMutation.isPending}>
                                  {createActionMutation.isPending ? 'Saving...' : 'Add Task'}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="gap-1"
                                onClick={() => { setActionTarget(risk); setActionForm({ ...emptyAction }) }}>
                                <Plus className="w-3.5 h-3.5" /> Add Task
                              </Button>
                              <Button size="sm" variant="outline" className="text-green-700 border-green-200 hover:bg-green-50 gap-1"
                                onClick={() => resolveMutation.mutate(risk.id)}
                                disabled={resolveMutation.isPending}>
                                <CheckCircle className="w-3.5 h-3.5" /> Mark Resolved
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Expand toggle */}
                    <button
                      className="p-1 rounded hover:bg-muted/50 text-muted-foreground shrink-0"
                      onClick={() => setExpandRisk(isExpanded ? null : risk.id)}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
