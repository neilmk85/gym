import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { crmApi } from '@/api/crm.api'
import { enquiriesApi } from '@/api/enquiries.api'
import { trainersApi } from '@/api/trainers.api'
import type { TrainerProfile } from '@/types/trainer.types'
import type { Enquiry } from '@/types/enquiry.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import { PageHeader } from '@/components/shared/PageHeader'
import {
  Calendar, CheckCircle, Clock, Plus, Dumbbell,
  AlertCircle, XCircle, User, Search, ChevronRight, Pencil,
} from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  completed:  'bg-green-100 text-green-700',
  cancelled:  'bg-gray-100 text-gray-600',
  no_show:    'bg-red-100 text-red-700',
}
const STATUS_ICONS: Record<string, React.ReactNode> = {
  scheduled: <Clock className="w-3.5 h-3.5" />,
  completed:  <CheckCircle className="w-3.5 h-3.5" />,
  cancelled:  <XCircle className="w-3.5 h-3.5" />,
  no_show:    <AlertCircle className="w-3.5 h-3.5" />,
}

const emptySchedule = {
  scheduled_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
  assigned_to_id: undefined as number | undefined,
  notes: '',
}

export default function TrialVisitsPage() {
  const qc = useQueryClient()
  const [searchParams] = useSearchParams()
  const preselectedId   = searchParams.get('lead') ? Number(searchParams.get('lead')) : null
  const preselectedName = searchParams.get('name') ?? ''

  // Tabs: upcoming | done
  const [tab, setTab] = useState<'upcoming' | 'done'>('upcoming')

  // Schedule modal state
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [scheduleForm, setScheduleForm] = useState({ ...emptySchedule })
  const [scheduleLead, setScheduleLead] = useState<Enquiry | null>(null)
  const [leadSearch, setLeadSearch] = useState('')
  const [leadDropOpen, setLeadDropOpen] = useState(false)
  const [trainerSearch, setTrainerSearch] = useState('')
  const [trainerDropOpen, setTrainerDropOpen] = useState(false)

  // Update outcome modal
  const [updateTarget, setUpdateTarget] = useState<number | null>(null)
  const [updateForm, setUpdateForm] = useState({ status: '', feedback: '' })

  // Edit trial modal
  const [editTarget, setEditTarget] = useState<any | null>(null)
  const [editForm, setEditForm] = useState({ scheduled_at: '', assigned_to_id: undefined as number | undefined, notes: '' })
  const [editTrainerSearch, setEditTrainerSearch] = useState('')
  const [editTrainerDropOpen, setEditTrainerDropOpen] = useState(false)

  // Past trials — search by lead
  const [pastLead, setPastLead] = useState<Enquiry | null>(null)
  const [pastLeadSearch, setPastLeadSearch] = useState('')
  const [pastLeadDropOpen, setPastLeadDropOpen] = useState(false)

  // Queries
  const { data: upcomingData, isLoading: loadingUpcoming } = useQuery({
    queryKey: ['upcoming-trials'],
    queryFn: () => crmApi.listUpcomingTrials(1, 50),
  })
  const upcoming: any[] = (upcomingData as any)?.data ?? []

  const { data: enquiriesRaw } = useQuery({
    queryKey: ['enquiries-crm', leadSearch],
    queryFn: () => enquiriesApi.list({ search: leadSearch, per_page: 30 }),
  })
  const allLeads: Enquiry[] = (enquiriesRaw as any)?.enquiries ?? []

  // All leads (no search) for enriching upcoming table with names
  const { data: allEnquiriesRaw } = useQuery({
    queryKey: ['enquiries-all'],
    queryFn: () => enquiriesApi.list({ per_page: 200 }),
  })
  const allLeadsMap: Record<number, Enquiry> = Object.fromEntries(
    ((allEnquiriesRaw as any)?.enquiries ?? []).map((l: Enquiry) => [l.id, l])
  )

  const { data: pastEnquiriesRaw } = useQuery({
    queryKey: ['enquiries-crm', pastLeadSearch],
    queryFn: () => enquiriesApi.list({ search: pastLeadSearch, per_page: 30 }),
    enabled: tab === 'done',
  })
  const pastLeads: Enquiry[] = (pastEnquiriesRaw as any)?.enquiries ?? []

  const { data: pastTrialsRaw, isLoading: loadingPast } = useQuery({
    queryKey: ['trials-by-lead', pastLead?.id],
    queryFn: () => crmApi.listTrials(pastLead!.id),
    enabled: !!pastLead,
  })
  const pastTrials: any[] = ((pastTrialsRaw as any) ?? []).filter((t: any) => t.status !== 'scheduled')

  const { data: trainersRaw } = useQuery({
    queryKey: ['trainers-list'],
    queryFn: () => trainersApi.list(true),
  })
  const trainers: TrainerProfile[] = (trainersRaw as any)?.trainers ?? []

  // Auto-open schedule modal when navigated from leads page
  useEffect(() => {
    if (preselectedId && allLeads.length > 0 && !scheduleLead) {
      const found = allLeads.find(l => l.id === preselectedId)
      if (found) { setScheduleLead(found); setShowScheduleModal(true) }
    }
  }, [preselectedId, allLeads, scheduleLead])

  const scheduleMutation = useMutation({
    mutationFn: () => crmApi.scheduleTrial(scheduleLead!.id, {
      scheduled_at: new Date(scheduleForm.scheduled_at).toISOString(),
      assigned_to_id: scheduleForm.assigned_to_id,
      notes: scheduleForm.notes,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['upcoming-trials'] })
      toast.success('Trial visit scheduled')
      setShowScheduleModal(false)
      setScheduleLead(null)
      setScheduleForm({ ...emptySchedule })
      setLeadSearch('')
    },
    onError: () => toast.error('Failed to schedule'),
  })

  const updateMutation = useMutation({
    mutationFn: () => crmApi.updateTrialStatus(updateTarget!, updateForm.status, updateForm.feedback),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['upcoming-trials'] })
      qc.invalidateQueries({ queryKey: ['trials-by-lead', pastLead?.id] })
      toast.success('Trial outcome saved')
      setUpdateTarget(null)
      setUpdateForm({ status: '', feedback: '' })
    },
    onError: () => toast.error('Failed to update'),
  })

  const editMutation = useMutation({
    mutationFn: () => crmApi.updateTrial(editTarget!.id, {
      scheduled_at: new Date(editForm.scheduled_at).toISOString(),
      assigned_to_id: editForm.assigned_to_id,
      notes: editForm.notes,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['upcoming-trials'] })
      toast.success('Trial updated')
      setEditTarget(null)
    },
    onError: () => toast.error('Failed to update trial'),
  })

  const openEdit = (t: any) => {
    setEditTarget(t)
    setEditForm({
      scheduled_at: new Date(t.scheduled_at).toISOString().slice(0, 16),
      assigned_to_id: t.assigned_to_id,
      notes: t.notes ?? '',
    })
    setEditTrainerSearch('')
  }

  const editTrainerName = (() => {
    const t = trainers.find(t => t.id === editForm.assigned_to_id)
    return t?.user ? `${t.user.first_name} ${t.user.last_name}` : ''
  })()

  const filteredEditTrainers = trainers.filter(t => {
    const name = t.user ? `${t.user.first_name} ${t.user.last_name}`.toLowerCase() : ''
    return name.includes(editTrainerSearch.toLowerCase())
  })

  const trainerName = (id?: number) => {
    if (!id) return null
    const t = trainers.find(t => t.id === id)
    return t?.user ? `${t.user.first_name} ${t.user.last_name}` : `Trainer #${id}`
  }

  const filteredTrainers = trainers.filter(t => {
    const name = t.user ? `${t.user.first_name} ${t.user.last_name}`.toLowerCase() : ''
    return name.includes(trainerSearch.toLowerCase())
  })

  const selectedTrainerName = (() => {
    const t = trainers.find(t => t.id === scheduleForm.assigned_to_id)
    return t?.user ? `${t.user.first_name} ${t.user.last_name}` : ''
  })()

  return (
    <div className="space-y-6">

      <PageHeader
        title="Trial Visits"
        subtitle="Schedule free trial sessions for prospects and track outcomes"
        icon={<Dumbbell className="h-5 w-5 text-white" />}
        actions={
          <Button
            onClick={() => { setShowScheduleModal(true); setScheduleLead(null); setScheduleForm({ ...emptySchedule }); setLeadSearch('') }}
          >
            <Plus className="w-4 h-4 mr-1.5" /> Schedule Trial
          </Button>
        }
        stats={loadingUpcoming ? undefined : [
          { label: 'Upcoming',  value: upcoming.length, icon: <Clock className="h-4 w-4 text-white" /> },
          { label: 'Completed', value: upcoming.filter((t: any) => t.status === 'completed').length, icon: <CheckCircle className="h-4 w-4 text-white" /> },
        ]}
      />

      {/* Tabs */}
      <div className="flex items-center gap-1">
        {(['upcoming', 'done'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-normal tracking-wide transition-all duration-150 ${
              tab === t ? 'border border-primary text-primary' : 'text-gray-500 hover:text-gray-800 hover:bg-black/5'
            }`}
          >
            {t === 'upcoming' ? 'Upcoming' : 'Past Trials'}
          </button>
        ))}
      </div>

      {/* ── UPCOMING TABLE ── */}
      {tab === 'upcoming' && (
        <Card className="overflow-hidden">
          {loadingUpcoming ? (
            <div className="p-10 text-center text-muted-foreground text-sm">Loading…</div>
          ) : upcoming.length === 0 ? (
            <div className="py-16 text-center">
              <Clock className="w-10 h-10 mx-auto mb-2 text-muted-foreground/25" />
              <p className="text-muted-foreground text-sm">No upcoming trials scheduled.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Use "+ Schedule Trial" to book one.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-blue-50">
                <tr>
                  {['Lead', 'Date & Time', 'Trainer', 'Notes', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-black uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {upcoming.map((t: any) => (
                  <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      {allLeadsMap[t.enquiry_id]?.name ?? `Lead #${t.enquiry_id}`}
                      {allLeadsMap[t.enquiry_id]?.phone && (
                        <p className="text-xs text-muted-foreground font-normal">{allLeadsMap[t.enquiry_id].phone}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(t.scheduled_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {t.assigned_to_id ? (
                        <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{trainerName(t.assigned_to_id)}</span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-48 truncate">{t.notes || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[t.status]}`}>
                        {STATUS_ICONS[t.status]}
                        <span className="capitalize">{t.status.replace('_', ' ')}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 gap-1"
                          onClick={() => openEdit(t)}
                        >
                          <Pencil className="w-3 h-3" /> Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7"
                          onClick={() => { setUpdateTarget(t.id); setUpdateForm({ status: '', feedback: '' }) }}
                        >
                          Mark Outcome
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* ── PAST TRIALS ── */}
      {tab === 'done' && (
        <div className="space-y-4">
          {/* Lead search */}
          <div className="relative max-w-sm">
            <Label className="text-xs text-muted-foreground mb-1.5 block">Search a lead to see their past trials</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Type name or phone…"
                className="pl-9"
                value={pastLeadDropOpen ? pastLeadSearch : (pastLead?.name ?? pastLeadSearch)}
                onChange={e => { setPastLeadSearch(e.target.value); setPastLeadDropOpen(true) }}
                onFocus={() => { setPastLeadSearch(''); setPastLeadDropOpen(true) }}
                onBlur={() => setTimeout(() => setPastLeadDropOpen(false), 150)}
              />
              {pastLead && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-lg"
                  onClick={() => { setPastLead(null); setPastLeadSearch('') }}
                >×</button>
              )}
              {pastLeadDropOpen && (
                <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {pastLeads.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No leads found</div>
                  ) : pastLeads.map(l => (
                    <button
                      key={l.id}
                      type="button"
                      onMouseDown={() => { setPastLead(l); setPastLeadDropOpen(false); setPastLeadSearch('') }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between"
                    >
                      <span className="font-medium">{l.name}</span>
                      <span className="text-xs text-muted-foreground">{l.phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {!pastLead ? (
            <div className="py-16 text-center border rounded-xl">
              <ChevronRight className="w-10 h-10 mx-auto mb-2 text-muted-foreground/25" />
              <p className="text-muted-foreground text-sm">Search for a lead above to view their past visits.</p>
            </div>
          ) : loadingPast ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
          ) : pastTrials.length === 0 ? (
            <div className="py-16 text-center border rounded-xl">
              <Dumbbell className="w-10 h-10 mx-auto mb-2 text-muted-foreground/25" />
              <p className="text-muted-foreground text-sm">No past visits for <strong>{pastLead.name}</strong>.</p>
            </div>
          ) : (
            <Card className="overflow-hidden">
              <div className="px-4 py-3 border-b bg-muted/40 flex items-center justify-between">
                <span className="text-sm font-medium">{pastLead.name}</span>
                <span className="text-xs text-muted-foreground">{pastTrials.length} past visit{pastTrials.length !== 1 ? 's' : ''}</span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-blue-50">
                  <tr>
                    {['Date', 'Trainer', 'Status', 'Feedback'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-black uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pastTrials.map((t: any) => (
                    <tr key={t.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{formatDate(t.scheduled_at)}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {t.assigned_to_id ? <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{trainerName(t.assigned_to_id)}</span> : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[t.status]}`}>
                          {STATUS_ICONS[t.status]}
                          <span className="capitalize">{t.status.replace('_', ' ')}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{t.feedback || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}

      {/* ── SCHEDULE MODAL ── */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-lg shadow-2xl">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-base">Schedule a Trial Visit</p>
                <button
                  onClick={() => { setShowScheduleModal(false); setScheduleLead(null); setScheduleForm({ ...emptySchedule }); setLeadSearch('') }}
                  className="text-muted-foreground hover:text-foreground text-xl leading-none"
                >×</button>
              </div>

              {/* Lead picker */}
              <div className="space-y-1.5">
                <Label>Lead / Prospect <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or phone…"
                    className="pl-9"
                    value={leadDropOpen ? leadSearch : (scheduleLead?.name ?? leadSearch)}
                    onChange={e => { setLeadSearch(e.target.value); setLeadDropOpen(true) }}
                    onFocus={() => { setLeadSearch(''); setLeadDropOpen(true) }}
                    onBlur={() => setTimeout(() => setLeadDropOpen(false), 150)}
                  />
                  {scheduleLead && (
                    <button
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-lg"
                      onClick={() => { setScheduleLead(null); setLeadSearch('') }}
                    >×</button>
                  )}
                  {leadDropOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {allLeads.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">No leads found</div>
                      ) : allLeads.map(l => (
                        <button
                          key={l.id}
                          type="button"
                          onMouseDown={() => { setScheduleLead(l); setLeadDropOpen(false); setLeadSearch('') }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between"
                        >
                          <span className="font-medium">{l.name}</span>
                          <span className="text-xs text-muted-foreground">{l.phone} · {l.plan_interest ?? ''}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {scheduleLead && (
                  <p className="text-xs text-[#007a99] bg-cyan-50 border border-cyan-200 rounded px-2 py-1">
                    {scheduleLead.name} · {scheduleLead.phone}{scheduleLead.plan_interest ? ` · ${scheduleLead.plan_interest}` : ''}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Date & Time */}
                <div className="space-y-1.5">
                  <Label>Date & Time <span className="text-destructive">*</span></Label>
                  <Input
                    type="datetime-local"
                    value={scheduleForm.scheduled_at}
                    onChange={e => setScheduleForm(f => ({ ...f, scheduled_at: e.target.value }))}
                  />
                </div>

                {/* Trainer picker */}
                <div className="space-y-1.5">
                  <Label>Assign Trainer <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <div className="relative">
                    <Input
                      placeholder="Search trainer…"
                      value={trainerDropOpen ? trainerSearch : selectedTrainerName}
                      onChange={e => { setTrainerSearch(e.target.value); setTrainerDropOpen(true) }}
                      onFocus={() => { setTrainerSearch(''); setTrainerDropOpen(true) }}
                      onBlur={() => setTimeout(() => setTrainerDropOpen(false), 150)}
                      className="pr-7"
                    />
                    {scheduleForm.assigned_to_id && !trainerDropOpen && (
                      <button
                        onClick={() => { setScheduleForm(f => ({ ...f, assigned_to_id: undefined })); setTrainerSearch('') }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-lg"
                      >×</button>
                    )}
                    {trainerDropOpen && (
                      <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {filteredTrainers.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-muted-foreground">No trainers found</div>
                        ) : filteredTrainers.map(t => {
                          const name = t.user ? `${t.user.first_name} ${t.user.last_name}` : `Trainer #${t.id}`
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onMouseDown={() => { setScheduleForm(f => ({ ...f, assigned_to_id: t.id })); setTrainerDropOpen(false); setTrainerSearch('') }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between"
                            >
                              <span>{name}</span>
                              {t.specialization && <span className="text-xs text-muted-foreground">{t.specialization}</span>}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  placeholder="e.g. Prospect wants to try the spinning class"
                  value={scheduleForm.notes}
                  onChange={e => setScheduleForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => { setShowScheduleModal(false); setScheduleLead(null); setScheduleForm({ ...emptySchedule }); setLeadSearch('') }}>
                  Cancel
                </Button>
                <Button
                  className="bg-[#0096b4] hover:bg-indigo-700 text-white"
                  onClick={() => scheduleMutation.mutate()}
                  disabled={scheduleMutation.isPending || !scheduleForm.scheduled_at || !scheduleLead}
                >
                  {scheduleMutation.isPending ? 'Scheduling…' : 'Schedule Trial'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── MARK OUTCOME MODAL ── */}
      {updateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md shadow-2xl">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold">Mark Trial Outcome</p>
                <button onClick={() => setUpdateTarget(null)} className="text-muted-foreground hover:text-foreground text-xl">×</button>
              </div>
              <div className="space-y-1.5">
                <Label>What happened?</Label>
                <Select value={updateForm.status} onValueChange={v => setUpdateForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select outcome" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed">✅ Completed — they showed up</SelectItem>
                    <SelectItem value="no_show">⚠️ No show — didn't come</SelectItem>
                    <SelectItem value="cancelled">❌ Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Feedback <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  placeholder="e.g. Loved the facility, likely to join"
                  value={updateForm.feedback}
                  onChange={e => setUpdateForm(f => ({ ...f, feedback: e.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setUpdateTarget(null)}>Cancel</Button>
                <Button
                  className="bg-[#0096b4] hover:bg-indigo-700 text-white"
                  onClick={() => updateMutation.mutate()}
                  disabled={updateMutation.isPending || !updateForm.status}
                >
                  {updateMutation.isPending ? 'Saving…' : 'Save Outcome'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      {/* ── EDIT TRIAL MODAL ── */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-lg shadow-2xl">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-base">Edit Trial Visit</p>
                <button onClick={() => setEditTarget(null)} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
              </div>

              <p className="text-sm text-muted-foreground -mt-2">
                Lead: <span className="font-medium text-foreground">{allLeadsMap[editTarget.enquiry_id]?.name ?? `Lead #${editTarget.enquiry_id}`}</span>
              </p>

              <div className="grid grid-cols-2 gap-4">
                {/* Date & Time */}
                <div className="space-y-1.5">
                  <Label>Date & Time <span className="text-destructive">*</span></Label>
                  <Input
                    type="datetime-local"
                    value={editForm.scheduled_at}
                    onChange={e => setEditForm(f => ({ ...f, scheduled_at: e.target.value }))}
                  />
                </div>

                {/* Trainer picker */}
                <div className="space-y-1.5">
                  <Label>Assign Trainer <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <div className="relative">
                    <Input
                      placeholder="Search trainer…"
                      value={editTrainerDropOpen ? editTrainerSearch : editTrainerName}
                      onChange={e => { setEditTrainerSearch(e.target.value); setEditTrainerDropOpen(true) }}
                      onFocus={() => { setEditTrainerSearch(''); setEditTrainerDropOpen(true) }}
                      onBlur={() => setTimeout(() => setEditTrainerDropOpen(false), 150)}
                      className="pr-7"
                    />
                    {editForm.assigned_to_id && !editTrainerDropOpen && (
                      <button
                        onClick={() => { setEditForm(f => ({ ...f, assigned_to_id: undefined })); setEditTrainerSearch('') }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-lg"
                      >×</button>
                    )}
                    {editTrainerDropOpen && (
                      <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {filteredEditTrainers.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-muted-foreground">No trainers found</div>
                        ) : filteredEditTrainers.map(t => {
                          const name = t.user ? `${t.user.first_name} ${t.user.last_name}` : `Trainer #${t.id}`
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onMouseDown={() => { setEditForm(f => ({ ...f, assigned_to_id: t.id })); setEditTrainerDropOpen(false); setEditTrainerSearch('') }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between"
                            >
                              <span>{name}</span>
                              {t.specialization && <span className="text-xs text-muted-foreground">{t.specialization}</span>}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  placeholder="e.g. Prospect wants to try the spinning class"
                  value={editForm.notes}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
                <Button
                  className="bg-[#0096b4] hover:bg-indigo-700 text-white"
                  onClick={() => editMutation.mutate()}
                  disabled={editMutation.isPending || !editForm.scheduled_at}
                >
                  {editMutation.isPending ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
