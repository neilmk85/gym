import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { crmApi } from '@/api/crm.api'
import type { MemberWaiver } from '@/api/crm.api'
import { membersApi } from '@/api/members.api'
import { FormDrawer } from '@/components/shared/FormDrawer'
import { AvatarWithFallback } from '@/components/shared/AvatarWithFallback'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/utils'
import type { Member } from '@/types/member.types'
import {
  Shield,
  Search,
  Plus,
  FileCheck,
  FileWarning,
  FileClock,
  FileText,
  User,
  Calendar,
  Clock,
  MapPin,
  ChevronDown,
  X,
  CheckCircle2,
  AlertCircle,
  Info,
} from 'lucide-react'

// ─── Types & Config ───────────────────────────────────────────────────────────

type WaiverStatus = 'signed' | 'pending' | 'expired'
type WaiverType   = 'liability' | 'parq' | 'medical'

const STATUS_CONFIG: Record<WaiverStatus, {
  label: string
  icon: React.ReactNode
  bg: string
  text: string
  border: string
}> = {
  signed:  {
    label: 'Signed',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200',
  },
  pending: {
    label: 'Pending',
    icon: <Clock className="w-3.5 h-3.5" />,
    bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200',
  },
  expired: {
    label: 'Expired',
    icon: <AlertCircle className="w-3.5 h-3.5" />,
    bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200',
  },
}

const TYPE_CONFIG: Record<WaiverType, { label: string; description: string; color: string }> = {
  liability: {
    label: 'Liability Waiver',
    description: 'General liability release and injury acknowledgement',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  parq: {
    label: 'PAR-Q',
    description: 'Physical Activity Readiness Questionnaire',
    color: 'bg-violet-50 text-violet-700 border-violet-200',
  },
  medical: {
    label: 'Medical',
    description: 'Medical history and health declaration form',
    color: 'bg-rose-50 text-rose-700 border-rose-200',
  },
}

// ─── Create Waiver Form ───────────────────────────────────────────────────────

const createSchema = z.object({
  waiver_type: z.enum(['liability', 'parq', 'medical']),
  content: z.string().optional(),
  answers: z.string().optional(),
  expires_at: z.string().optional(),
  notes: z.string().optional(),
})
type CreateFormValues = z.infer<typeof createSchema>

function CreateWaiverDrawer({
  memberId,
  memberName,
  isOpen,
  onClose,
}: {
  memberId: number
  memberName: string
  isOpen: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { waiver_type: 'liability' },
  })
  const waiverType = watch('waiver_type')

  const mutation = useMutation({
    mutationFn: (data: CreateFormValues) =>
      crmApi.createWaiver({ ...data, member_id: memberId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['waivers', memberId] })
      toast.success('Waiver created successfully')
      reset()
      onClose()
    },
    onError: () => toast.error('Failed to create waiver'),
  })

  return (
    <FormDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Create Waiver"
      description={`New waiver for ${memberName}`}
      size="lg"
      footer={
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSubmit(v => mutation.mutate(v))}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Creating…' : 'Create Waiver'}
          </Button>
        </div>
      }
    >
      <form className="space-y-5">
        {/* Waiver type */}
        <div className="space-y-1.5">
          <Label>Waiver Type <span className="text-destructive">*</span></Label>
          <select
            className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            {...register('waiver_type')}
          >
            <option value="liability">Liability Waiver</option>
            <option value="parq">PAR-Q (Physical Activity Readiness)</option>
            <option value="medical">Medical Declaration</option>
          </select>
          {waiverType && (
            <p className="text-xs text-muted-foreground">
              {TYPE_CONFIG[waiverType as WaiverType]?.description}
            </p>
          )}
        </div>

        {/* Content */}
        <div className="space-y-1.5">
          <Label>Waiver Content</Label>
          <Textarea
            {...register('content')}
            rows={5}
            placeholder={
              waiverType === 'liability'
                ? 'I acknowledge that physical exercise involves risk of injury…'
                : waiverType === 'parq'
                  ? 'I confirm that I have answered all PAR-Q questions truthfully…'
                  : 'I declare that all medical information provided is accurate…'
            }
          />
        </div>

        {/* PAR-Q answers */}
        {waiverType === 'parq' && (
          <div className="space-y-1.5">
            <Label>PAR-Q Answers (JSON)</Label>
            <Textarea
              {...register('answers')}
              rows={4}
              className="font-mono text-xs"
              placeholder={'{\n  "heart_condition": false,\n  "chest_pain": false,\n  "dizziness": false,\n  "bone_joint_problem": false\n}'}
            />
            <p className="text-xs text-muted-foreground">Record the member's yes/no answers as JSON</p>
          </div>
        )}

        {/* Expiry date */}
        <div className="space-y-1.5">
          <Label>Expiry Date</Label>
          <Input type="date" {...register('expires_at')} />
          <p className="text-xs text-muted-foreground">Leave blank for no expiry</p>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Input {...register('notes')} placeholder="Any additional notes…" />
        </div>
      </form>
    </FormDrawer>
  )
}

// ─── Waiver Detail Drawer ─────────────────────────────────────────────────────

function WaiverDetailDrawer({
  waiver,
  onClose,
  onSign,
  isSigning,
}: {
  waiver: MemberWaiver | null
  onClose: () => void
  onSign: (id: number) => void
  isSigning: boolean
}) {
  if (!waiver) return null
  const statusCfg = STATUS_CONFIG[waiver.status as WaiverStatus] ?? STATUS_CONFIG.pending
  const typeCfg = TYPE_CONFIG[waiver.waiver_type as WaiverType]

  let parsedAnswers: Record<string, unknown> | null = null
  if (waiver.answers) {
    try { parsedAnswers = JSON.parse(waiver.answers) } catch { /* ignore */ }
  }

  return (
    <FormDrawer
      isOpen={!!waiver}
      onClose={onClose}
      title="Waiver Details"
      description={`#${waiver.id} · ${typeCfg?.label ?? waiver.waiver_type}`}
      size="lg"
      footer={
        waiver.status === 'pending' ? (
          <div className="flex justify-end">
            <Button onClick={() => onSign(waiver.id)} disabled={isSigning}>
              <FileCheck className="h-4 w-4 mr-2" />
              {isSigning ? 'Signing…' : 'Mark as Signed'}
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-6">
        {/* Status + type badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
            {statusCfg.icon} {statusCfg.label}
          </span>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${typeCfg?.color ?? ''}`}>
            <Shield className="w-3.5 h-3.5" /> {typeCfg?.label ?? waiver.waiver_type}
          </span>
        </div>

        {/* Key dates */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Calendar className="h-3 w-3" /> Created</p>
            <p className="text-sm font-medium">{formatDate(waiver.created_at)}</p>
          </div>
          {waiver.signed_at && (
            <div className="rounded-xl bg-green-50 border border-green-100 p-3">
              <p className="text-xs text-green-600 mb-1 flex items-center gap-1"><FileCheck className="h-3 w-3" /> Signed</p>
              <p className="text-sm font-medium text-green-800">{formatDate(waiver.signed_at)}</p>
            </div>
          )}
          {waiver.expires_at && (
            <div className={`rounded-xl p-3 border ${new Date(waiver.expires_at) < new Date() ? 'bg-red-50 border-red-100' : 'bg-muted/40'}`}>
              <p className={`text-xs mb-1 flex items-center gap-1 ${new Date(waiver.expires_at) < new Date() ? 'text-red-500' : 'text-muted-foreground'}`}>
                <Clock className="h-3 w-3" /> Expires
              </p>
              <p className="text-sm font-medium">{formatDate(waiver.expires_at)}</p>
            </div>
          )}
          {waiver.ip_address && (
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><MapPin className="h-3 w-3" /> IP Address</p>
              <p className="text-sm font-mono">{waiver.ip_address}</p>
            </div>
          )}
        </div>

        {/* Waiver content */}
        {waiver.content && (
          <div className="space-y-1.5">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-primary" /> Waiver Content
            </h3>
            <div className="rounded-lg bg-muted/30 border p-4 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
              {waiver.content}
            </div>
          </div>
        )}

        {/* PAR-Q answers */}
        {parsedAnswers && (
          <div className="space-y-1.5">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Info className="h-4 w-4 text-primary" /> PAR-Q Answers
            </h3>
            <div className="rounded-lg border divide-y overflow-hidden">
              {Object.entries(parsedAnswers).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="capitalize text-muted-foreground">{key.replace(/_/g, ' ')}</span>
                  <Badge variant={val ? 'destructive' : 'secondary'} className="text-[10px]">
                    {val ? 'Yes' : 'No'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {waiver.notes && (
          <div className="space-y-1.5">
            <h3 className="text-sm font-semibold">Notes</h3>
            <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg px-4 py-3">{waiver.notes}</p>
          </div>
        )}

        {/* Pending warning */}
        {waiver.status === 'pending' && (
          <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-700">
              This waiver is awaiting the member's signature. Click <strong>Mark as Signed</strong> once the member has reviewed and agreed.
            </p>
          </div>
        )}
      </div>
    </FormDrawer>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WaiversPage() {
  const qc = useQueryClient()

  const [memberSearch, setMemberSearch] = useState('')
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [showMemberDropdown, setShowMemberDropdown] = useState(false)
  const [showCreateDrawer, setShowCreateDrawer] = useState(false)
  const [selectedWaiver, setSelectedWaiver] = useState<MemberWaiver | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // ── Members search ────────────────────────────────────────────────────────

  const { data: membersData } = useQuery({
    queryKey: ['members-for-waivers'],
    queryFn: () => membersApi.list({ per_page: 500 }),
    staleTime: 60_000,
  })

  const allMembers = useMemo(() => {
    return (membersData as { members?: Member[] })?.members ?? []
  }, [membersData])

  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return allMembers.slice(0, 8)
    const q = memberSearch.toLowerCase()
    return allMembers.filter(m => {
      const name = `${m.user.first_name} ${m.user.last_name}`.toLowerCase()
      return name.includes(q) || m.user.email.toLowerCase().includes(q) || (m.member_code ?? '').toLowerCase().includes(q)
    }).slice(0, 8)
  }, [allMembers, memberSearch])

  // ── Waivers for selected member ───────────────────────────────────────────

  const { data: waivers = [], isLoading: waiversLoading } = useQuery({
    queryKey: ['waivers', selectedMember?.id],
    queryFn: () => crmApi.listWaiversByMember(selectedMember!.id),
    enabled: !!selectedMember,
  })

  const waiverList = Array.isArray(waivers) ? waivers as MemberWaiver[] : []

  const signMutation = useMutation({
    mutationFn: (id: number) => crmApi.signWaiver(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['waivers', selectedMember?.id] })
      toast.success('Waiver marked as signed')
      setSelectedWaiver(null)
    },
    onError: () => toast.error('Failed to sign waiver'),
  })

  // ── Stats ─────────────────────────────────────────────────────────────────

  const stats = useMemo(() => ({
    total:   waiverList.length,
    signed:  waiverList.filter(w => w.status === 'signed').length,
    pending: waiverList.filter(w => w.status === 'pending').length,
    expired: waiverList.filter(w => w.status === 'expired').length,
  }), [waiverList])

  const filteredWaivers = useMemo(() => {
    if (statusFilter === 'all') return waiverList
    return waiverList.filter(w => w.status === statusFilter)
  }, [waiverList, statusFilter])

  // ── Member select ─────────────────────────────────────────────────────────

  function selectMember(m: Member) {
    setSelectedMember(m)
    setMemberSearch(`${m.user.first_name} ${m.user.last_name}`)
    setShowMemberDropdown(false)
    setStatusFilter('all')
  }

  function clearMember() {
    setSelectedMember(null)
    setMemberSearch('')
    setStatusFilter('all')
  }

  const memberName = selectedMember
    ? `${selectedMember.user.first_name} ${selectedMember.user.last_name}`
    : ''

  return (
    <div className="space-y-6">

      {/* ── Gradient header ── */}
      <div className="relative overflow-hidden -mx-6 -mt-6 bg-gradient-to-br from-teal-700 via-emerald-700 to-cyan-800 text-white">
        <div className="relative px-6 pt-6 pb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold tracking-widest uppercase text-white/55 mb-1.5">
                Compliance
              </p>
              <div className="flex items-center gap-2.5 mb-1">
                <Shield className="w-5 h-5 opacity-80" />
                <h1 className="text-2xl font-bold tracking-tight">Waivers &amp; PAR-Q</h1>
              </div>
              <p className="text-sm text-white/65">
                Manage member liability waivers, PAR-Q forms and medical declarations
              </p>
            </div>
            {selectedMember && (
              <Button
                onClick={() => setShowCreateDrawer(true)}
                className="shrink-0 bg-white text-teal-700 hover:bg-white/90 font-semibold shadow-sm"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                New Waiver
              </Button>
            )}
          </div>

          {/* Stats strip — only when member selected and waivers loaded */}
          {selectedMember && !waiversLoading && waiverList.length > 0 && (
            <div className="mt-5 grid grid-cols-4 divide-x divide-white/15 border-t border-white/15 -mx-6 px-0">
              {[
                { label: 'Total', value: stats.total, color: 'text-white' },
                { label: 'Signed', value: stats.signed, color: 'text-green-300' },
                { label: 'Pending', value: stats.pending, color: 'text-amber-300' },
                { label: 'Expired', value: stats.expired, color: 'text-red-300' },
              ].map(s => (
                <div key={s.label} className="px-5 py-3">
                  <p className={`text-xl font-bold leading-none ${s.color}`}>{s.value}</p>
                  <p className="text-xs font-medium text-white/80 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="absolute -right-6 -top-6 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute right-20 -bottom-8 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />
      </div>

      {/* ── Member search ── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search member by name, email or code…"
                className="pl-9 pr-9"
                value={memberSearch}
                onChange={e => {
                  setMemberSearch(e.target.value)
                  setShowMemberDropdown(true)
                  if (!e.target.value) clearMember()
                }}
                onFocus={() => setShowMemberDropdown(true)}
              />
              {memberSearch && (
                <button
                  onClick={clearMember}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}

              {/* Dropdown */}
              {showMemberDropdown && !selectedMember && filteredMembers.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg overflow-hidden">
                  {filteredMembers.map(m => (
                    <button
                      key={m.id}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
                      onMouseDown={() => selectMember(m)}
                    >
                      <AvatarWithFallback
                        firstName={m.user.first_name}
                        lastName={m.user.last_name}
                        className="h-8 w-8 text-xs shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {m.user.first_name} {m.user.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {m.member_code} · {m.user.email}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-[10px] shrink-0 capitalize">
                        {m.membership_status}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected member chip */}
            {selectedMember && (
              <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2 shrink-0">
                <AvatarWithFallback
                  firstName={selectedMember.user.first_name}
                  lastName={selectedMember.user.last_name}
                  className="h-6 w-6 text-[10px] shrink-0"
                />
                <span className="text-sm font-medium text-teal-800">{memberName}</span>
                <span className="text-xs text-teal-500">#{selectedMember.id}</span>
                <button onClick={clearMember} className="text-teal-500 hover:text-teal-700 ml-1">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Empty state: no member selected ── */}
      {!selectedMember && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-teal-50 flex items-center justify-center mb-4">
            <Shield className="h-8 w-8 text-teal-500" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Select a Member</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Search for a member above to view and manage their waivers, PAR-Q forms and medical declarations.
          </p>
        </div>
      )}

      {/* ── Waivers section ── */}
      {selectedMember && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                {memberName}'s Waivers
              </CardTitle>

              {/* Status filter tabs */}
              <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                {['all', 'signed', 'pending', 'expired'].map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize ${
                      statusFilter === s
                        ? 'bg-background shadow-sm text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {s === 'all' ? `All (${stats.total})` : `${s} (${stats[s as WaiverStatus]})`}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {waiversLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
              </div>
            ) : filteredWaivers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  {waiverList.length === 0 ? 'No waivers on file' : `No ${statusFilter} waivers`}
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  {waiverList.length === 0
                    ? `${memberName} has no waivers recorded yet.`
                    : `No waivers match the "${statusFilter}" filter.`}
                </p>
                {waiverList.length === 0 && (
                  <Button size="sm" onClick={() => setShowCreateDrawer(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Create First Waiver
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y">
                {filteredWaivers.map(w => {
                  const statusCfg = STATUS_CONFIG[w.status as WaiverStatus] ?? STATUS_CONFIG.pending
                  const typeCfg = TYPE_CONFIG[w.waiver_type as WaiverType]
                  const isExpiringSoon = w.expires_at && w.status === 'signed' &&
                    new Date(w.expires_at) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) &&
                    new Date(w.expires_at) > new Date()

                  return (
                    <div
                      key={w.id}
                      className="flex items-start gap-4 px-5 py-4 hover:bg-muted/30 transition-colors cursor-pointer group"
                      onClick={() => setSelectedWaiver(w)}
                    >
                      {/* Type icon */}
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${typeCfg?.color ?? 'bg-muted text-muted-foreground'} border`}>
                        <Shield className="h-4 w-4" />
                      </div>

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-semibold">{typeCfg?.label ?? w.waiver_type}</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                            {statusCfg.icon} {statusCfg.label}
                          </span>
                          {isExpiringSoon && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-orange-50 text-orange-700 border border-orange-200">
                              <AlertCircle className="h-3 w-3" /> Expiring soon
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{typeCfg?.description}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> Created {formatDate(w.created_at)}
                          </span>
                          {w.signed_at && (
                            <span className="text-xs text-green-600 flex items-center gap-1">
                              <FileCheck className="h-3 w-3" /> Signed {formatDate(w.signed_at)}
                            </span>
                          )}
                          {w.expires_at && (
                            <span className={`text-xs flex items-center gap-1 ${new Date(w.expires_at) < new Date() ? 'text-red-500' : 'text-muted-foreground'}`}>
                              <Clock className="h-3 w-3" /> Expires {formatDate(w.expires_at)}
                            </span>
                          )}
                        </div>
                        {w.notes && (
                          <p className="text-xs text-muted-foreground mt-1 truncate max-w-sm italic">"{w.notes}"</p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {w.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-green-200 text-green-700 hover:bg-green-50"
                            onClick={e => {
                              e.stopPropagation()
                              signMutation.mutate(w.id)
                            }}
                            disabled={signMutation.isPending}
                          >
                            <FileCheck className="h-3 w-3 mr-1" />
                            Sign
                          </Button>
                        )}
                        <ChevronDown className="h-4 w-4 text-muted-foreground rotate-[-90deg] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Type guide ── */}
      {selectedMember && waiverList.length === 0 && !waiversLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
            <div key={key} className={`rounded-xl border p-4 ${cfg.color}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <Shield className="h-4 w-4" />
                <span className="text-sm font-semibold">{cfg.label}</span>
              </div>
              <p className="text-xs opacity-80">{cfg.description}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Drawers ── */}
      {selectedMember && (
        <CreateWaiverDrawer
          memberId={selectedMember.id}
          memberName={memberName}
          isOpen={showCreateDrawer}
          onClose={() => setShowCreateDrawer(false)}
        />
      )}

      <WaiverDetailDrawer
        waiver={selectedWaiver}
        onClose={() => setSelectedWaiver(null)}
        onSign={id => signMutation.mutate(id)}
        isSigning={signMutation.isPending}
      />
    </div>
  )
}
