import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { PageHeader } from '@/components/shared/PageHeader'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { SearchInput } from '@/components/shared/SearchInput'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { enquiriesApi } from '@/api/enquiries.api'
import { crmApi, type LogActivityPayload, type CreateFollowUpPayload } from '@/api/crm.api'
import { formatDate } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import type { Enquiry, EnquiryStatus, EnquirySource } from '@/types/enquiry.types'
import {
  Plus, Trash2, Calendar, Phone, Mail, UserPlus, TrendingUp, Users, Clock, Target, Flame,
  ArrowLeft, MapPin, MessageSquare, MoreHorizontal, CheckCircle, ClipboardList, Dumbbell,
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const SOURCES: { value: EnquirySource; label: string }[] = [
  { value: 'walk_in',      label: 'Walk-in' },
  { value: 'phone_call',   label: 'Phone Call' },
  { value: 'email',        label: 'Email' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'referral',     label: 'Referral' },
  { value: 'website',      label: 'Website' },
  { value: 'other',        label: 'Other' },
]

const STATUSES: { value: EnquiryStatus; label: string; color: string }[] = [
  { value: 'new',             label: 'New',             color: 'bg-sky-100 text-sky-700 border-sky-200' },
  { value: 'contacted',       label: 'Contacted',       color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'visit_scheduled', label: 'Visit Scheduled', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  { value: 'converted',       label: 'Converted',       color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'closed',          label: 'Closed',          color: 'bg-gray-100 text-gray-500 border-gray-200' },
]

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  call:    <Phone className="w-4 h-4" />,
  email:   <Mail className="w-4 h-4" />,
  visit:   <MapPin className="w-4 h-4" />,
  message: <MessageSquare className="w-4 h-4" />,
  other:   <MoreHorizontal className="w-4 h-4" />,
}
const ACTIVITY_COLORS: Record<string, string> = {
  call:    'bg-blue-100 text-blue-700',
  email:   'bg-purple-100 text-purple-700',
  visit:   'bg-green-100 text-green-700',
  message: 'bg-yellow-100 text-yellow-700',
  other:   'bg-gray-100 text-gray-700',
}

function statusStyle(s: string) { return STATUSES.find(x => x.value === s)?.color ?? 'bg-gray-100 text-gray-500' }
function statusLabel(s: string) { return STATUSES.find(x => x.value === s)?.label ?? s }
function sourceLabel(s: string) { return SOURCES.find(x => x.value === s)?.label ?? s }

const emptyActivity: LogActivityPayload = {
  activity_type: 'call', subject: '', notes: '', outcome: '',
  activity_date: new Date().toISOString().slice(0, 10),
}
const emptyFollowUp: CreateFollowUpPayload = {
  assigned_to_id: 1,
  due_date: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
  subject: '', notes: '',
}

type DetailModal = 'activity' | 'followup' | null
type DetailTab   = 'history' | 'followups'

const PER_PAGE = 200

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EnquiriesPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager'
  const qc = useQueryClient()

  // List state
  const [search, setSearch]       = useState('')
  const [activeTab, setActiveTab] = useState<EnquiryStatus | ''>('')
  const [deleteTarget, setDeleteTarget] = useState<Enquiry | null>(null)

  // Detail-panel state
  const [selected, setSelected]   = useState<Enquiry | null>(null)
  const [detailTab, setDetailTab] = useState<DetailTab>('history')
  const [modal, setModal]         = useState<DetailModal>(null)
  const [activityForm, setActivityForm] = useState<LogActivityPayload>(emptyActivity)
  const [followUpForm, setFollowUpForm] = useState<CreateFollowUpPayload>(emptyFollowUp)

  // ── Queries ──
  const { data, isLoading } = useQuery({
    queryKey: ['enquiries', { search }],
    queryFn: () => enquiriesApi.list({ per_page: PER_PAGE, search: search || undefined }),
  })
  const allEnquiries = ((data as any)?.enquiries ?? []) as Enquiry[]
  const enquiries = activeTab ? allEnquiries.filter(e => e.status === activeTab) : allEnquiries
  const countByStatus = (s: string) => allEnquiries.filter(e => e.status === s).length

  const { data: activities = [] } = useQuery({
    queryKey: ['lead-activities', selected?.id],
    queryFn: () => crmApi.listActivities(selected!.id),
    enabled: !!selected,
  })
  const { data: followUps = [] } = useQuery({
    queryKey: ['lead-followups', selected?.id],
    queryFn: () => crmApi.listFollowUps(selected!.id),
    enabled: !!selected,
  })
  const { data: upcomingTrials = [] } = useQuery({
    queryKey: ['upcoming-trials-badge'],
    queryFn: () => crmApi.listUpcomingTrials(),
  })
  const trialLeadIds = new Set(
    ((upcomingTrials as any)?.data ?? upcomingTrials as any[]).map((t: any) => t.enquiry_id)
  )

  const pendingFollowUps = (followUps as any[]).filter(f => !f.is_completed)
  const doneFollowUps    = (followUps as any[]).filter(f => f.is_completed)

  // ── Mutations ──
  const convertMutation = useMutation({
    mutationFn: (id: number) => enquiriesApi.update(id, { status: 'converted' }),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['enquiries'] })
      const e = allEnquiries.find(x => x.id === id)
      navigate('/members/new', { state: { from_enquiry: { name: e?.name, phone: e?.phone, email: e?.email } } })
    },
    onError: (err: Error) => toast.error(err.message),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => enquiriesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enquiries'] })
      toast.success('Enquiry deleted')
      setDeleteTarget(null)
      if (selected?.id === deleteTarget?.id) setSelected(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const logActivity = useMutation({
    mutationFn: () => crmApi.logActivity(selected!.id, activityForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-activities', selected?.id] })
      toast.success('Activity logged')
      setModal(null); setActivityForm(emptyActivity)
    },
    onError: () => toast.error('Failed to save'),
  })
  const scheduleFollowUp = useMutation({
    mutationFn: () => crmApi.createFollowUp(selected!.id, followUpForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-followups', selected?.id] })
      toast.success('Follow-up scheduled')
      setModal(null); setFollowUpForm(emptyFollowUp)
    },
    onError: () => toast.error('Failed to save'),
  })
  const markDone = useMutation({
    mutationFn: (id: number) => crmApi.completeFollowUp(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-followups', selected?.id] })
      toast.success('Marked as done')
    },
  })

  // ── Stats ──
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const newThisMonth       = allEnquiries.filter(e => new Date(e.created_at) >= startOfMonth).length
  const convertedThisMonth = allEnquiries.filter(e => e.status === 'converted' && new Date(e.created_at) >= startOfMonth).length
  const totalConverted     = allEnquiries.filter(e => e.status === 'converted').length
  const conversionRate     = allEnquiries.length > 0 ? Math.round((totalConverted / allEnquiries.length) * 100) : 0
  const followUpsDue       = allEnquiries.filter(e => e.follow_up_date && new Date(e.follow_up_date) <= now && !['converted', 'closed'].includes(e.status)).length
  const activePipeline     = allEnquiries.filter(e => ['new', 'contacted', 'visit_scheduled'].includes(e.status)).length

  const headerStats = [
    { label: 'New This Month',       value: newThisMonth,         icon: Flame },
    { label: 'Converted This Month', value: convertedThisMonth,   icon: TrendingUp },
    { label: 'Conversion Rate',      value: `${conversionRate}%`, icon: Target },
    { label: 'Active Pipeline',      value: activePipeline,       icon: Users },
    { label: 'Follow-ups Due',       value: followUpsDue,         icon: Clock },
  ]

  const tabs = [
    { value: '' as EnquiryStatus | '', label: 'All' },
    ...STATUSES.map(s => ({ value: s.value as EnquiryStatus | '', label: s.label })),
  ]

  function openDetail(e: Enquiry) {
    setSelected(e); setDetailTab('history'); setModal(null)
  }

  // ── Render ──
  return (
    <div className="space-y-6">
      <PageHeader
        title="Enquiries"
        subtitle="Track leads and prospective members"
        icon={<MessageSquare className="h-5 w-5 text-white" />}
        actions={
          isAdminOrManager ? (
            <Button onClick={() => navigate('/enquiries/new')}>
              <Plus className="h-4 w-4 mr-1.5" /> New Enquiry
            </Button>
          ) : undefined
        }
        stats={isLoading ? undefined : headerStats.map(s => ({
          label: s.label,
          value: s.value,
          icon: <s.icon className="h-4 w-4 text-white" />,
        }))}
      />

      {selected ? (
        /* ── DETAIL PANEL ── */
        <div className="space-y-5">
          {/* Back + summary bar */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" title="Back to list" onClick={() => { setSelected(null); setModal(null) }}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1 flex items-center justify-between bg-muted/40 border rounded-xl px-4 py-3 gap-4 flex-wrap">
              <div>
                <p className="font-semibold">{selected.name}</p>
                <p className="text-sm text-muted-foreground">
                  {selected.phone}{selected.email ? ` · ${selected.email}` : ''}
                  {selected.plan_interest ? ` · interested in ${selected.plan_interest}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusStyle(selected.status)}`}>
                  {statusLabel(selected.status)}
                </span>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => setModal('activity')}>
                  <Phone className="w-3.5 h-3.5" /> Log Call / Visit
                </Button>
                <Button size="sm" className="gap-1 bg-[#0096b4] hover:bg-indigo-700 text-white" onClick={() => setModal('followup')}>
                  <Clock className="w-3.5 h-3.5" /> Schedule Follow-Up
                </Button>
                <Button size="sm" variant="outline" className="gap-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                  onClick={() => navigate(`/crm/trials?lead=${selected.id}&name=${encodeURIComponent(selected.name)}`)}>
                  <Dumbbell className="w-3.5 h-3.5" /> Trial Visits →
                </Button>
                {isAdminOrManager && selected.status !== 'converted' && (
                  <button
                    onClick={() => convertMutation.mutate(selected.id)}
                    disabled={convertMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors disabled:opacity-50"
                  >
                    <UserPlus className="h-3.5 w-3.5" /> Convert
                  </button>
                )}
                <Button size="sm" variant="outline" onClick={() => navigate(`/enquiries/${selected.id}/edit`)}>
                  Edit
                </Button>
                {isAdminOrManager && (
                  <button onClick={() => setDeleteTarget(selected)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Log activity form */}
          {modal === 'activity' && (
            <Card className="border-blue-200 bg-blue-50/30 shadow-sm">
              <CardContent className="p-5 space-y-4">
                <p className="font-semibold text-sm">Log a call, visit or message with {selected.name}</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>What type of contact?</Label>
                    <Select value={activityForm.activity_type} onValueChange={v => setActivityForm(f => ({ ...f, activity_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="call">📞 Phone Call</SelectItem>
                        <SelectItem value="email">📧 Email</SelectItem>
                        <SelectItem value="visit">📍 Came in person</SelectItem>
                        <SelectItem value="message">💬 WhatsApp / Message</SelectItem>
                        <SelectItem value="other">📌 Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>When did this happen?</Label>
                    <Input type="date" value={activityForm.activity_date}
                      onChange={e => setActivityForm(f => ({ ...f, activity_date: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>What was discussed? <span className="text-muted-foreground font-normal">(brief summary)</span></Label>
                  <Input placeholder="e.g. Called to discuss annual membership pricing"
                    value={activityForm.subject}
                    onChange={e => setActivityForm(f => ({ ...f, subject: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Details <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <textarea className="w-full min-h-[70px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="e.g. He asked about personal training. Seemed interested but wants to check with family."
                    value={activityForm.notes}
                    onChange={e => setActivityForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>What was the outcome?</Label>
                  <Input placeholder="e.g. Will visit Saturday for a trial session"
                    value={activityForm.outcome}
                    onChange={e => setActivityForm(f => ({ ...f, outcome: e.target.value }))} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setModal(null); setActivityForm(emptyActivity) }}>Cancel</Button>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => logActivity.mutate()} disabled={logActivity.isPending}>
                    {logActivity.isPending ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Schedule follow-up form */}
          {modal === 'followup' && (
            <Card className="border-cyan-200 bg-cyan-50/30 shadow-sm">
              <CardContent className="p-5 space-y-4">
                <p className="font-semibold text-sm">Schedule a reminder to follow up with {selected.name}</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>What to do?</Label>
                    <Input placeholder="e.g. Call back to confirm trial visit"
                      value={followUpForm.subject}
                      onChange={e => setFollowUpForm(f => ({ ...f, subject: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>By when?</Label>
                    <Input type="date" value={followUpForm.due_date}
                      onChange={e => setFollowUpForm(f => ({ ...f, due_date: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Extra notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input placeholder="e.g. He said to call after 6pm"
                    value={followUpForm.notes}
                    onChange={e => setFollowUpForm(f => ({ ...f, notes: e.target.value ?? '' }))} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setModal(null); setFollowUpForm(emptyFollowUp) }}>Cancel</Button>
                  <Button className="bg-[#0096b4] hover:bg-indigo-700 text-white"
                    onClick={() => scheduleFollowUp.mutate()} disabled={scheduleFollowUp.isPending}>
                    {scheduleFollowUp.isPending ? 'Saving…' : 'Schedule'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detail tabs */}
          <div className="flex border-b">
            <button
              onClick={() => setDetailTab('history')}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${detailTab === 'history' ? 'border-indigo-600 text-[#007a99]' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              <span className="flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Call & Visit History</span>
            </button>
            <button
              onClick={() => setDetailTab('followups')}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${detailTab === 'followups' ? 'border-indigo-600 text-[#007a99]' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              <Clock className="w-4 h-4" /> Follow-Ups
              {pendingFollowUps.length > 0 && (
                <span className="bg-orange-100 text-orange-700 text-xs rounded-full px-1.5 py-0.5">{pendingFollowUps.length}</span>
              )}
            </button>
          </div>

          {/* History tab */}
          {detailTab === 'history' && (
            <div className="space-y-3">
              {(activities as any[]).length === 0 ? (
                <div className="text-center py-12 border rounded-xl text-muted-foreground">
                  <Phone className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No calls or visits logged yet.</p>
                  <p className="text-xs mt-1">Use "Log Call / Visit" above to record your first interaction.</p>
                </div>
              ) : (
                (activities as any[]).map((a: any) => (
                  <Card key={a.id} className="shadow-sm">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-full flex-shrink-0 ${ACTIVITY_COLORS[a.activity_type] ?? 'bg-gray-100'}`}>
                          {ACTIVITY_ICONS[a.activity_type] ?? <MoreHorizontal className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="capitalize text-xs">{a.activity_type}</Badge>
                            <span className="text-xs text-muted-foreground">{formatDate(a.activity_date)}</span>
                          </div>
                          {a.subject && <p className="font-medium text-sm mt-1">{a.subject}</p>}
                          {a.notes && <p className="text-sm text-muted-foreground mt-1">{a.notes}</p>}
                          {a.outcome && (
                            <p className="text-sm mt-1.5 bg-muted/50 rounded px-2 py-1">
                              <span className="font-medium">Outcome: </span>{a.outcome}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* Follow-ups tab */}
          {detailTab === 'followups' && (
            <div className="space-y-5">
              {pendingFollowUps.length === 0 && doneFollowUps.length === 0 && (
                <div className="text-center py-12 border rounded-xl text-muted-foreground">
                  <Clock className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No follow-ups scheduled yet.</p>
                  <p className="text-xs mt-1">Use "Schedule Follow-Up" above to set a reminder.</p>
                </div>
              )}
              {pendingFollowUps.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-orange-600 flex items-center gap-1.5">
                    <Clock className="w-4 h-4" /> Pending ({pendingFollowUps.length})
                  </p>
                  {pendingFollowUps.map((f: any) => (
                    <Card key={f.id} className="shadow-sm border-orange-100">
                      <CardContent className="pt-4 pb-4 flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs text-orange-600 border-orange-200">
                              Due {formatDate(f.due_date)}
                            </Badge>
                          </div>
                          {f.subject && <p className="font-medium text-sm">{f.subject}</p>}
                          {f.notes && <p className="text-sm text-muted-foreground mt-1">{f.notes}</p>}
                        </div>
                        <Button size="sm" variant="outline" className="shrink-0 text-green-700 border-green-200 hover:bg-green-50"
                          onClick={() => markDone.mutate(f.id)} disabled={markDone.isPending}>
                          <CheckCircle className="w-4 h-4 mr-1" /> Done
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              {doneFollowUps.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-green-500" /> Completed ({doneFollowUps.length})
                  </p>
                  {doneFollowUps.map((f: any) => (
                    <Card key={f.id} className="opacity-50 shadow-sm">
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary" className="text-xs">Done {f.completed_at ? formatDate(f.completed_at) : ''}</Badge>
                        </div>
                        {f.subject && <p className="text-sm">{f.subject}</p>}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      ) : (
        /* ── LIST VIEW ── */
        <Card className="border-0 shadow-md overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white">
                    <td colSpan={9} className="px-4 pt-2.5 pb-4">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1 flex-wrap flex-1">
                          {tabs.map(tab => {
                            const count = tab.value === '' ? allEnquiries.length : countByStatus(tab.value)
                            const isActive = activeTab === tab.value
                            return (
                              <button
                                key={tab.value}
                                onClick={() => setActiveTab(tab.value)}
                                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-normal tracking-wide transition-all duration-150 ${
                                  isActive ? 'border border-primary text-primary' : 'text-gray-500 hover:text-gray-800 hover:bg-black/5'
                                }`}
                              >
                                {tab.label}
                                {!isLoading && (
                                  <span className={`min-w-[20px] text-center rounded-full text-[11px] font-semibold px-1.5 py-0.5 ${
                                    isActive ? 'bg-primary/15 text-primary' : 'bg-black/8 text-gray-500'
                                  }`}>
                                    {count}
                                  </span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                        <SearchInput
                          placeholder="Search name, phone, email…"
                          value={search}
                          onChange={setSearch}
                          className="shrink-0 w-80"
                        />
                      </div>
                    </td>
                  </tr>
                  <tr className="bg-blue-50">
                    {['Name', 'Phone', 'Email', 'Source', 'Plan Interest', 'Status', 'Follow-up', 'Trial', 'Date', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-semibold text-black text-xs uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 10 }).map((_, j) => (
                          <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                        ))}
                      </tr>
                    ))
                  ) : enquiries.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-16 text-muted-foreground text-sm">
                        No enquiries found
                      </td>
                    </tr>
                  ) : (
                    enquiries.map(e => (
                      <tr
                        key={e.id}
                        className="hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => openDetail(e)}
                      >
                        <td className="px-4 py-3 font-medium">{e.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <span className="flex items-center gap-1"><Phone className="h-3 w-3 shrink-0" />{e.phone}</span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {e.email
                            ? <span className="flex items-center gap-1"><Mail className="h-3 w-3 shrink-0" />{e.email}</span>
                            : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-xs">{sourceLabel(e.source)}</Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {e.plan_interest || <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusStyle(e.status)}`}>
                            {statusLabel(e.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                          {e.follow_up_date
                            ? <span className="flex items-center gap-1 text-amber-600"><Calendar className="h-3 w-3" />{formatDate(e.follow_up_date)}</span>
                            : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {trialLeadIds.has(e.id)
                            ? <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full"><Dumbbell className="w-3 h-3" /> Scheduled</span>
                            : <span className="text-muted-foreground/40 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                          {formatDate(e.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2" onClick={ev => ev.stopPropagation()}>
                            {isAdminOrManager && e.status !== 'converted' && (
                              <button
                                onClick={() => convertMutation.mutate(e.id)}
                                disabled={convertMutation.isPending}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors whitespace-nowrap disabled:opacity-50"
                              >
                                <UserPlus className="h-3.5 w-3.5" /> Convert
                              </button>
                            )}
                            {isAdminOrManager && (
                              <button onClick={() => setDeleteTarget(e)} className="text-muted-foreground hover:text-destructive transition-colors">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete Enquiry"
        description={`Delete enquiry from ${deleteTarget?.name}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
