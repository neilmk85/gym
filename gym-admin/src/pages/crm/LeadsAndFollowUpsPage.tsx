import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { crmApi, type LogActivityPayload, type CreateFollowUpPayload } from '@/api/crm.api'
import { enquiriesApi } from '@/api/enquiries.api'
import type { Enquiry } from '@/types/enquiry.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SearchInput } from '@/components/shared/SearchInput'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Phone, Mail, MapPin, MessageSquare, MoreHorizontal,
  ArrowLeft, User, Calendar, CheckCircle,
  Clock, ClipboardList, Plus, Users, Dumbbell, X
} from 'lucide-react'

// ── constants ──────────────────────────────────────────────────────────────

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
const STATUS_COLORS: Record<string, string> = {
  new:              'bg-blue-100 text-blue-700',
  contacted:        'bg-yellow-100 text-yellow-700',
  visit_scheduled:  'bg-purple-100 text-purple-700',
  converted:        'bg-green-100 text-green-700',
  closed:           'bg-gray-100 text-gray-600',
}
const SOURCE_LABELS: Record<string, string> = {
  walk_in: 'Walk-in', phone_call: 'Phone Call', email: 'Email',
  social_media: 'Social Media', referral: 'Referral', website: 'Website', other: 'Other',
}

const emptyActivity: LogActivityPayload = {
  activity_type: 'call', subject: '', notes: '', outcome: '',
  activity_date: new Date().toISOString().slice(0, 10),
}
const emptyFollowUp: CreateFollowUpPayload = {
  assigned_to_id: 1,
  due_date: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
  subject: '', notes: '',
}
const emptyNewLead = { name: '', phone: '', email: '', source: 'walk_in', plan_interest: '', notes: '' }

type Tab = 'history' | 'followups'
type Modal = 'activity' | 'followup' | null

// ── component ──────────────────────────────────────────────────────────────

export default function LeadsAndFollowUpsPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [lead, setLead] = useState<Enquiry | null>(null)
  const [tab, setTab] = useState<Tab>('history')
  const [modal, setModal] = useState<Modal>(null)
  const [activityForm, setActivityForm] = useState<LogActivityPayload>(emptyActivity)
  const [followUpForm, setFollowUpForm] = useState<CreateFollowUpPayload>(emptyFollowUp)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newLeadForm, setNewLeadForm] = useState({ ...emptyNewLead })

  const { data: enquiriesRaw, isLoading: loadingLeads } = useQuery({
    queryKey: ['enquiries-crm', search],
    queryFn: () => enquiriesApi.list({ search, per_page: 50 }),
  })
  const leads: Enquiry[] = (enquiriesRaw as any)?.enquiries ?? (enquiriesRaw as any)?.data ?? []

  const { data: activities = [] } = useQuery({
    queryKey: ['lead-activities', lead?.id],
    queryFn: () => crmApi.listActivities(lead!.id),
    enabled: !!lead,
  })

  const { data: followUps = [] } = useQuery({
    queryKey: ['lead-followups', lead?.id],
    queryFn: () => crmApi.listFollowUps(lead!.id),
    enabled: !!lead,
  })

  const logActivity = useMutation({
    mutationFn: () => crmApi.logActivity(lead!.id, activityForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-activities', lead?.id] })
      toast.success('Call / visit logged')
      setModal(null); setActivityForm(emptyActivity)
    },
    onError: () => toast.error('Failed to save'),
  })

  const scheduleFollowUp = useMutation({
    mutationFn: () => crmApi.createFollowUp(lead!.id, followUpForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-followups', lead?.id] })
      toast.success('Follow-up scheduled')
      setModal(null); setFollowUpForm(emptyFollowUp)
    },
    onError: () => toast.error('Failed to save'),
  })

  const markDone = useMutation({
    mutationFn: (id: number) => crmApi.completeFollowUp(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-followups', lead?.id] })
      toast.success('Marked as done')
    },
  })

  const createLead = useMutation({
    mutationFn: () => enquiriesApi.create({
      name: newLeadForm.name,
      phone: newLeadForm.phone,
      email: newLeadForm.email || undefined,
      source: newLeadForm.source,
      plan_interest: newLeadForm.plan_interest || undefined,
      notes: newLeadForm.notes || undefined,
      status: 'new',
    }),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['enquiries-crm'] })
      toast.success(`${newLeadForm.name} added as a new inquiry`)
      setShowNewForm(false)
      setNewLeadForm({ ...emptyNewLead })
      setLead(created as unknown as Enquiry)
      setTab('history')
      setModal(null)
    },
    onError: () => toast.error('Failed to add inquiry'),
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

  return (
    <div className="space-y-6">

      {/* ── Page header — edge to edge ── */}
      <div className="relative overflow-hidden -mx-6 -mt-6 bg-gradient-to-r from-teal-600 via-cyan-600 to-sky-600 px-6 py-6 text-white">
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Users className="w-6 h-6 opacity-90" />
              <h1 className="text-xl font-bold">Inquiries / Leads</h1>
            </div>
            <p className="text-sm text-white/80 max-w-2xl">
              Everyone who has shown interest in joining — walk-ins, phone calls, referrals. Log your follow-ups and schedule trial visits so no one slips through.
            </p>
          </div>
          {!lead && (
            <Button
              size="sm"
              className="shrink-0 bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm"
              onClick={() => setShowNewForm(v => !v)}
            >
              <Plus className="w-4 h-4 mr-1" />
              New Inquiry
            </Button>
          )}
        </div>
        <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute -right-2 -bottom-8 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
      </div>

      {/* ── New inquiry inline form ── */}
      {showNewForm && !lead && (
        <Card className="border-teal-200 shadow-sm">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm">Add New Inquiry / Lead</p>
              <button onClick={() => { setShowNewForm(false); setNewLeadForm({ ...emptyNewLead }) }} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Name <span className="text-red-500">*</span></Label>
                <Input placeholder="e.g. Ravi Sharma" value={newLeadForm.name}
                  onChange={e => setNewLeadForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone <span className="text-red-500">*</span></Label>
                <Input placeholder="e.g. 9876543210" value={newLeadForm.phone}
                  onChange={e => setNewLeadForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Email <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input placeholder="e.g. ravi@email.com" value={newLeadForm.email}
                  onChange={e => setNewLeadForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>How did they hear about us?</Label>
                <Select value={newLeadForm.source} onValueChange={v => setNewLeadForm(f => ({ ...f, source: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="walk_in">Walk-in</SelectItem>
                    <SelectItem value="phone_call">Phone Call</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                    <SelectItem value="social_media">Social Media</SelectItem>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Interested in which plan? <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input placeholder="e.g. Monthly, Annual, PT" value={newLeadForm.plan_interest}
                  onChange={e => setNewLeadForm(f => ({ ...f, plan_interest: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Quick note <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input placeholder="e.g. Came in asking about evening batches" value={newLeadForm.notes}
                  onChange={e => setNewLeadForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowNewForm(false); setNewLeadForm({ ...emptyNewLead }) }}>Cancel</Button>
              <Button className="bg-teal-600 hover:bg-teal-700 text-white"
                onClick={() => createLead.mutate()}
                disabled={createLead.isPending || !newLeadForm.name || !newLeadForm.phone}>
                {createLead.isPending ? 'Adding...' : 'Add Inquiry'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!lead ? (
        /* ── LEADS TABLE ── */
        <Card className="shadow-lg shadow-gray-200/80 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b gap-4 bg-teal-50/60">
            <p className="font-medium text-sm text-teal-700 whitespace-nowrap">
              {loadingLeads ? 'Loading...' : `${leads.length} lead${leads.length !== 1 ? 's' : ''}`}
            </p>
            <SearchInput
              placeholder="Search by name or phone..."
              value={search}
              onChange={setSearch}
              className="w-72"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gradient-to-r from-teal-50 via-cyan-50 to-sky-50">
                  <th className="text-left px-4 py-3 font-semibold text-teal-700">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-teal-700">Phone</th>
                  <th className="text-left px-4 py-3 font-semibold text-teal-700">Source</th>
                  <th className="text-left px-4 py-3 font-semibold text-teal-700">Plan Interest</th>
                  <th className="text-left px-4 py-3 font-semibold text-teal-700">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-teal-700">Follow-up Due</th>
                  <th className="text-left px-4 py-3 font-semibold text-teal-700">Trial</th>
                  <th className="text-left px-4 py-3 font-semibold text-teal-700">Added On</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loadingLeads && (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">Loading...</td></tr>
                )}
                {!loadingLeads && leads.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-14 text-center">
                      <User className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                      <p className="text-muted-foreground text-sm">No leads found{search ? ` for "${search}"` : ''}.</p>
                    </td>
                  </tr>
                )}
                {leads.map(e => (
                  <tr
                    key={e.id}
                    className="hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => { setLead(e); setTab('history'); setModal(null) }}
                  >
                    <td className="px-4 py-3 font-medium">{e.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{e.phone}</td>
                    <td className="px-4 py-3 text-muted-foreground">{SOURCE_LABELS[e.source] ?? e.source}</td>
                    <td className="px-4 py-3 text-muted-foreground">{e.plan_interest ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge className={`text-xs capitalize ${STATUS_COLORS[e.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {e.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {e.follow_up_date
                        ? <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(e.follow_up_date)}</span>
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {trialLeadIds.has(e.id)
                        ? <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full"><Dumbbell className="w-3 h-3" /> Scheduled</span>
                        : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(e.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

      ) : (
        /* ── LEAD DETAIL ── */
        <div className="space-y-5">

          {/* Back + lead summary */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" title="Back to list" onClick={() => { setLead(null); setModal(null) }}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1 flex items-center justify-between bg-muted/40 border rounded-xl px-4 py-3">
              <div>
                <p className="font-semibold">{lead.name}</p>
                <p className="text-sm text-muted-foreground">
                  {lead.phone}{lead.email ? ` · ${lead.email}` : ''}
                  {lead.plan_interest ? ` · interested in ${lead.plan_interest}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={`text-xs ${STATUS_COLORS[lead.status] ?? ''}`}>
                  {lead.status.replace('_', ' ')}
                </Badge>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => setModal('activity')}>
                  <Phone className="w-3.5 h-3.5" /> Log Call / Visit
                </Button>
                <Button size="sm" className="gap-1 bg-teal-600 hover:bg-teal-700 text-white" onClick={() => setModal('followup')}>
                  <Clock className="w-3.5 h-3.5" /> Schedule Follow-Up
                </Button>
                <Button size="sm" variant="outline" className="gap-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                  onClick={() => navigate(`/crm/trials?lead=${lead.id}&name=${encodeURIComponent(lead.name)}`)}>
                  <Dumbbell className="w-3.5 h-3.5" /> Trial Visits →
                </Button>
              </div>
            </div>
          </div>

          {/* Inline form */}
          {modal === 'activity' && (
            <Card className="border-blue-200 bg-blue-50/30 shadow-sm">
              <CardContent className="p-5 space-y-4">
                <p className="font-semibold text-sm">Log a call, visit or message with {lead.name}</p>
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
                    placeholder="e.g. He asked about the personal training add-on. Seemed interested but wants to check with family."
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
                    {logActivity.isPending ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {modal === 'followup' && (
            <Card className="border-teal-200 bg-teal-50/30 shadow-sm">
              <CardContent className="p-5 space-y-4">
                <p className="font-semibold text-sm">Schedule a reminder to follow up with {lead.name}</p>
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
                  <Button className="bg-teal-600 hover:bg-teal-700 text-white"
                    onClick={() => scheduleFollowUp.mutate()} disabled={scheduleFollowUp.isPending}>
                    {scheduleFollowUp.isPending ? 'Saving...' : 'Schedule'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabs */}
          <div className="flex border-b">
            <button
              onClick={() => setTab('history')}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'history' ? 'border-teal-600 text-teal-700' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              <span className="flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Call & Visit History</span>
            </button>
            <button
              onClick={() => setTab('followups')}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${tab === 'followups' ? 'border-teal-600 text-teal-700' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              <Clock className="w-4 h-4" /> Follow-Ups
              {pendingFollowUps.length > 0 && (
                <span className="bg-orange-100 text-orange-700 text-xs rounded-full px-1.5 py-0.5">{pendingFollowUps.length}</span>
              )}
            </button>
          </div>

          {/* Tab: History */}
          {tab === 'history' && (
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

          {/* Tab: Follow-Ups */}
          {tab === 'followups' && (
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
                          <Badge variant="secondary" className="text-xs">
                            Done {f.completed_at ? formatDate(f.completed_at) : ''}
                          </Badge>
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
      )}
    </div>
  )
}
