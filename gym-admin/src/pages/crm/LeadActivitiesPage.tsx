import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { crmApi, type LogActivityPayload } from '@/api/crm.api'
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
  Plus, ClipboardList, ChevronRight, ArrowLeft,
  User, Calendar
} from 'lucide-react'

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
  walk_in:      'Walk-in',
  phone_call:   'Phone Call',
  email:        'Email',
  social_media: 'Social Media',
  referral:     'Referral',
  website:      'Website',
  other:        'Other',
}

const emptyForm: LogActivityPayload = {
  activity_type: 'call',
  subject: '',
  notes: '',
  outcome: '',
  activity_date: new Date().toISOString().slice(0, 10),
}

export default function LeadActivitiesPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedLead, setSelectedLead] = useState<Enquiry | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<LogActivityPayload>(emptyForm)

  const { data: enquiriesRaw, isLoading: loadingLeads } = useQuery({
    queryKey: ['enquiries-crm', search],
    queryFn: () => enquiriesApi.list({ search, per_page: 50 }),
  })
  const enquiries: Enquiry[] = (enquiriesRaw as any)?.data ?? []

  const { data: activities = [], isLoading: loadingActivities } = useQuery({
    queryKey: ['lead-activities', selectedLead?.id],
    queryFn: () => crmApi.listActivities(selectedLead!.id),
    enabled: !!selectedLead,
  })

  const logMutation = useMutation({
    mutationFn: () => crmApi.logActivity(selectedLead!.id, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-activities', selectedLead?.id] })
      toast.success('Activity logged')
      setShowForm(false)
      setForm(emptyForm)
    },
    onError: () => toast.error('Failed to log activity'),
  })

  return (
    <div className="space-y-6">

      {/* Header — bleeds edge to edge by cancelling layout padding */}
      <div className="relative overflow-hidden -mx-6 -mt-6 bg-gradient-to-r from-teal-600 via-cyan-600 to-sky-600 px-6 py-6 text-white">
        <div className="relative">
          <div className="flex items-center gap-3 mb-1">
            <ClipboardList className="w-6 h-6 opacity-90" />
            <h1 className="text-xl font-bold">Lead Activities</h1>
          </div>
          <p className="text-sm text-white/80 max-w-2xl">
            Track every interaction with a prospective member — calls made, emails sent, walk-in visits — so nothing falls through the cracks and you always know where each lead stands.
          </p>
        </div>
        <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute -right-2 -bottom-8 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
      </div>

      {!selectedLead ? (
        /* ── LEADS TABLE ── */
        <Card className="shadow-lg shadow-gray-200/80 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b gap-4 bg-teal-50/60">
            <p className="font-medium text-sm text-teal-700 whitespace-nowrap">
              {loadingLeads ? 'Loading...' : `${enquiries.length} lead${enquiries.length !== 1 ? 's' : ''}`}
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
                  <th className="text-left px-4 py-3 font-semibold text-teal-700">Interest</th>
                  <th className="text-left px-4 py-3 font-semibold text-teal-700">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-teal-700">Follow-up</th>
                  <th className="text-left px-4 py-3 font-semibold text-teal-700">Created</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {loadingLeads && (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">Loading leads...</td></tr>
                )}
                {!loadingLeads && enquiries.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-14 text-center">
                      <User className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                      <p className="text-muted-foreground text-sm">No leads found{search ? ` for "${search}"` : ''}.</p>
                    </td>
                  </tr>
                )}
                {enquiries.map(e => (
                  <tr
                    key={e.id}
                    className="hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => { setSelectedLead(e); setShowForm(false) }}
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
                      {e.follow_up_date ? (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(e.follow_up_date)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(e.created_at)}</td>
                    <td className="px-4 py-3">
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

      ) : (
        /* ── LEAD DETAIL + ACTIVITIES ── */
        <div className="space-y-4">

          {/* Back + lead summary */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" title="Back to list" onClick={() => { setSelectedLead(null); setShowForm(false) }}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1 flex items-center justify-between bg-muted/40 border rounded-lg px-4 py-3">
              <div>
                <p className="font-semibold">{selectedLead.name}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedLead.phone}{selectedLead.email ? ` · ${selectedLead.email}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={`text-xs ${STATUS_COLORS[selectedLead.status] ?? ''}`}>
                  {selectedLead.status.replace('_', ' ')}
                </Badge>
                <Button size="sm" onClick={() => setShowForm(v => !v)} className="gap-1">
                  <Plus className="w-4 h-4" />
                  {showForm ? 'Cancel' : 'Log Activity'}
                </Button>
              </div>
            </div>
          </div>

          {/* Log activity form */}
          {showForm && (
            <Card className="border-teal-200 bg-teal-50/30">
              <CardContent className="p-5 space-y-4">
                <p className="font-medium text-sm">Log a new activity for {selectedLead.name}</p>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Activity Type</Label>
                    <Select value={form.activity_type} onValueChange={v => setForm(f => ({ ...f, activity_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="call">📞 Phone Call</SelectItem>
                        <SelectItem value="email">📧 Email</SelectItem>
                        <SelectItem value="visit">📍 In-person Visit</SelectItem>
                        <SelectItem value="message">💬 WhatsApp / Message</SelectItem>
                        <SelectItem value="other">📌 Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={form.activity_date}
                      onChange={e => setForm(f => ({ ...f, activity_date: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Subject <span className="text-muted-foreground font-normal">(brief headline)</span></Label>
                  <Input
                    placeholder="e.g. Called to discuss membership plans"
                    value={form.subject}
                    onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Notes <span className="text-muted-foreground font-normal">(what was discussed)</span></Label>
                  <textarea
                    className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="e.g. Lead is interested in the annual plan. Asked about personal training add-on."
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Outcome <span className="text-muted-foreground font-normal">(result of this interaction)</span></Label>
                  <Input
                    placeholder="e.g. Agreed to visit on Saturday for a trial session"
                    value={form.outcome}
                    onChange={e => setForm(f => ({ ...f, outcome: e.target.value }))}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setShowForm(false); setForm(emptyForm) }}>Cancel</Button>
                  <Button
                    className="bg-teal-600 hover:bg-teal-700 text-white"
                    onClick={() => logMutation.mutate()}
                    disabled={logMutation.isPending}
                  >
                    {logMutation.isPending ? 'Saving...' : 'Save Activity'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Activity timeline */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-3">
              Activity History {!loadingActivities && `(${(activities as any[]).length})`}
            </p>

            {loadingActivities && <p className="text-sm text-muted-foreground">Loading...</p>}

            {!loadingActivities && (activities as any[]).length === 0 && (
              <div className="text-center py-10 text-muted-foreground border rounded-lg">
                <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No activities logged yet for this lead.</p>
                <p className="text-xs mt-1">Use "Log Activity" above to record the first interaction.</p>
              </div>
            )}

            <div className="space-y-3">
              {(activities as any[]).map((a: any) => (
                <Card key={a.id}>
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
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
