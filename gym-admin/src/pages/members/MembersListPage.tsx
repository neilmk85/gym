import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { PageHeader } from '@/components/shared/PageHeader'
import { PhoneInput } from '@/components/shared/PhoneInput'
import { SearchInput } from '@/components/shared/SearchInput'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { FormDrawer } from '@/components/shared/FormDrawer'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { membersApi } from '@/api/members.api'
import { facilitiesApi } from '@/api/facilities.api'
import { plansApi } from '@/api/plans.api'
import type { Plan } from '@/types/plan.types'
import { QUERY_KEYS } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import type { Member } from '@/types/member.types'
import type { Facility } from '@/types/facility.types'
import { subscriptionsApi } from '@/api/subscriptions.api'
import type { Subscription } from '@/types/subscription.types'
import { Plus, Pencil, Trash2, Snowflake, Sun, Eye, Users, UserCheck, UserX, Clock, Bell, CheckCircle2, Download, Fingerprint, Link, Unlink, BarChart3, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { AttendanceStats } from '@/api/members.api'
import * as XLSX from 'xlsx'

const PER_PAGE = 20

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const createMemberSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(7, 'Phone is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  date_of_birth: z.string().min(1, 'Date of birth is required'),
  gender: z.enum(['male', 'female', 'other'], { required_error: 'Gender is required' }),
  facility_id: z.coerce.number().min(1, 'Facility is required'),
})

const editMemberSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  phone: z.string().min(7, 'Phone is required'),
  date_of_birth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  height_cm: z.coerce.number().int().positive().optional().or(z.literal('')),
  weight_kg: z.coerce.number().positive().optional().or(z.literal('')),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  emergency_contact_relationship: z.string().optional(),
  member_notes: z.string().optional(),
})

type CreateMemberValues = z.infer<typeof createMemberSchema>
type EditMemberValues = z.infer<typeof editMemberSchema>

// ─── CreateMemberForm ────────────────────────────────────────────────────────

interface CreateMemberFormProps {
  facilities: Facility[]
  onSuccess: () => void
}

function CreateMemberForm({ facilities, onSuccess }: CreateMemberFormProps) {
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateMemberValues>({
    resolver: zodResolver(createMemberSchema),
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateMemberValues) =>
      membersApi.create({
        ...data,
        facility_id: Number(data.facility_id),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      toast.success('Member created successfully')
      reset()
      onSuccess()
    },
    onError: () => {
      toast.error('Failed to create member')
    },
  })

  const onSubmit = handleSubmit((data) => createMutation.mutate(data))

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="cf_first_name">First Name</Label>
          <Input id="cf_first_name" {...register('first_name')} placeholder="Jane" />
          {errors.first_name && <p className="text-xs text-destructive">{errors.first_name.message}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="cf_last_name">Last Name</Label>
          <Input id="cf_last_name" {...register('last_name')} placeholder="Doe" />
          {errors.last_name && <p className="text-xs text-destructive">{errors.last_name.message}</p>}
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="cf_email">Email</Label>
        <Input id="cf_email" type="email" {...register('email')} placeholder="jane@example.com" />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor="cf_phone">Phone</Label>
        <PhoneInput id="cf_phone" {...register('phone')} />
        {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor="cf_password">Password</Label>
        <Input id="cf_password" type="password" {...register('password')} placeholder="Min. 8 characters" />
        {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor="cf_dob">Date of Birth</Label>
        <Input id="cf_dob" type="date" {...register('date_of_birth')} />
        {errors.date_of_birth && <p className="text-xs text-destructive">{errors.date_of_birth.message}</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor="cf_gender">Gender</Label>
        <Select
          value={watch('gender') ?? ''}
          onValueChange={(val) => setValue('gender', val as 'male' | 'female' | 'other', { shouldValidate: true })}
        >
          <option value="">Select gender</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </Select>
        {errors.gender && <p className="text-xs text-destructive">{errors.gender.message}</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor="cf_facility">Facility</Label>
        <Select
          value={String(watch('facility_id') ?? '')}
          onValueChange={(val) => setValue('facility_id', Number(val), { shouldValidate: true })}
        >
          <option value="">Select facility</option>
          {facilities.map((f) => (
            <option key={f.id} value={String(f.id)}>
              {f.name}
            </option>
          ))}
        </Select>
        {errors.facility_id && <p className="text-xs text-destructive">{errors.facility_id.message}</p>}
      </div>

      <div className="pt-2">
        <Button type="submit" className="w-full" disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Creating...' : 'Create Member'}
        </Button>
      </div>
    </form>
  )
}

// ─── EditMemberForm ──────────────────────────────────────────────────────────

interface EditMemberFormProps {
  member: Member
  onSuccess: () => void
}

// DB stores 'M'/'F'/'Other' — form uses 'male'/'female'/'other'
function dbGenderToForm(g?: string): 'male' | 'female' | 'other' | undefined {
  if (g === 'M') return 'male'
  if (g === 'F') return 'female'
  if (g === 'Other' || g === 'other') return 'other'
  return undefined
}
function formGenderToDb(g: string): string {
  if (g === 'male') return 'M'
  if (g === 'female') return 'F'
  return 'Other'
}
// ISO datetime → YYYY-MM-DD for <input type="date">
function toDateInput(iso?: string): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

function EditMemberForm({ member, onSuccess }: EditMemberFormProps) {
  const queryClient = useQueryClient()
  const u = member.user as typeof member.user & {
    date_of_birth?: string; gender?: string; height_cm?: number; weight_kg?: number;
    emergency_contact_name?: string; emergency_contact_phone?: string; emergency_contact_relationship?: string;
  }

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EditMemberValues>({
    resolver: zodResolver(editMemberSchema),
    defaultValues: {
      first_name: u.first_name ?? '',
      last_name:  u.last_name  ?? '',
      phone:      u.phone      ?? '',
      date_of_birth: toDateInput(u.date_of_birth),
      gender:     dbGenderToForm(u.gender),
      height_cm:  u.height_cm  ?? '',
      weight_kg:  u.weight_kg  ?? '',
      emergency_contact_name:         u.emergency_contact_name         ?? '',
      emergency_contact_phone:        u.emergency_contact_phone        ?? '',
      emergency_contact_relationship: u.emergency_contact_relationship ?? '',
      member_notes: (member as Member & { member_notes?: string }).member_notes ?? '',
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: EditMemberValues) => {
      const payload: Record<string, unknown> = {
        first_name:   data.first_name,
        last_name:    data.last_name,
        phone:        data.phone,
        date_of_birth: data.date_of_birth,
        gender:       formGenderToDb(data.gender),   // 'male' → 'M' etc.
      }
      if (data.height_cm !== '' && data.height_cm !== undefined) {
        payload.height_cm = Number(data.height_cm)
      }
      if (data.weight_kg !== '' && data.weight_kg !== undefined) {
        payload.weight_kg = Number(data.weight_kg)
      }
      if (data.emergency_contact_name) payload.emergency_contact_name = data.emergency_contact_name
      if (data.emergency_contact_phone) payload.emergency_contact_phone = data.emergency_contact_phone
      if (data.emergency_contact_relationship) payload.emergency_contact_relationship = data.emergency_contact_relationship
      if (data.member_notes !== undefined) payload.member_notes = data.member_notes
      return membersApi.update(member.id, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      toast.success('Member updated successfully')
      onSuccess()
    },
    onError: () => {
      toast.error('Failed to update member')
    },
  })

  const onSubmit = handleSubmit((data) => updateMutation.mutate(data))

  // Section header helper
  const SectionTitle = ({ label }: { label: string }) => (
    <div className="col-span-2 -mx-1">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 pb-1 border-b border-border/50">
        {label}
      </p>
    </div>
  )

  return (
    <form onSubmit={onSubmit} className="space-y-5">

      {/* ── Account Info (read-only) ── */}
      <div className="grid grid-cols-2 gap-3">
        <SectionTitle label="Account" />
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Member Code</Label>
          <Input value={member.member_code} readOnly className="bg-muted/40 text-muted-foreground cursor-default" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Email</Label>
          <Input value={u.email} readOnly className="bg-muted/40 text-muted-foreground cursor-default" />
        </div>
      </div>

      {/* ── Personal Info ── */}
      <div className="grid grid-cols-2 gap-3">
        <SectionTitle label="Personal Information" />
        <div className="space-y-1">
          <Label htmlFor="ef_first_name">First Name <span className="text-destructive">*</span></Label>
          <Input id="ef_first_name" {...register('first_name')} />
          {errors.first_name && <p className="text-xs text-destructive">{errors.first_name.message}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="ef_last_name">Last Name <span className="text-destructive">*</span></Label>
          <Input id="ef_last_name" {...register('last_name')} />
          {errors.last_name && <p className="text-xs text-destructive">{errors.last_name.message}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="ef_phone">Phone <span className="text-destructive">*</span></Label>
          <PhoneInput id="ef_phone" {...register('phone')} />
          {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="ef_dob">Date of Birth</Label>
          <Input id="ef_dob" type="date" {...register('date_of_birth')} />
        </div>
        <div className="space-y-1 col-span-2">
          <Label htmlFor="ef_gender">Gender</Label>
          <Select
            value={watch('gender') ?? ''}
            onValueChange={(val) => setValue('gender', val as 'male' | 'female' | 'other', { shouldValidate: true })}
          >
            <option value="">Select gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </Select>
        </div>
      </div>

      {/* ── Body Stats ── */}
      <div className="grid grid-cols-2 gap-3">
        <SectionTitle label="Body Stats" />
        <div className="space-y-1">
          <Label htmlFor="ef_height">Height (cm)</Label>
          <Input id="ef_height" type="number" {...register('height_cm')} placeholder="e.g. 170" />
          {errors.height_cm && <p className="text-xs text-destructive">{errors.height_cm.message}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="ef_weight">Weight (kg)</Label>
          <Input id="ef_weight" type="number" step="0.1" {...register('weight_kg')} placeholder="e.g. 68.5" />
          {errors.weight_kg && <p className="text-xs text-destructive">{errors.weight_kg.message}</p>}
        </div>
      </div>

      {/* ── Emergency Contact ── */}
      <div className="grid grid-cols-2 gap-3">
        <SectionTitle label="Emergency Contact" />
        <div className="space-y-1 col-span-2">
          <Label htmlFor="ef_ec_name">Contact Name</Label>
          <Input id="ef_ec_name" {...register('emergency_contact_name')} placeholder="Full name" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ef_ec_phone">Phone</Label>
          <PhoneInput id="ef_ec_phone" {...register('emergency_contact_phone')} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ef_ec_rel">Relationship</Label>
          <Input id="ef_ec_rel" {...register('emergency_contact_relationship')} placeholder="e.g. Spouse" />
        </div>
      </div>

      {/* ── Notes ── */}
      <div className="grid grid-cols-2 gap-3">
        <SectionTitle label="Notes" />
        <div className="space-y-1 col-span-2">
          <Label htmlFor="ef_notes">Member Notes</Label>
          <Textarea id="ef_notes" {...register('member_notes')} placeholder="Any notes about this member..." rows={3} />
        </div>
      </div>

      <div className="pt-2">
        <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
          {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  )
}

// ─── Attendance helpers ───────────────────────────────────────────────────────

import type { AttendancePeriod } from '@/api/members.api'

function AttendanceCell({ period }: { period: AttendancePeriod }) {
  const pct = period.days_in_period > 0 ? (period.present / period.days_in_period) * 100 : 0
  const color = pct >= 60 ? 'bg-green-500' : pct >= 30 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <td className="px-3 py-3 text-center">
      <div className="text-xs font-semibold text-slate-700">{period.present}/{period.days_in_period}</div>
      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden mx-auto mt-1">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </td>
  )
}

function RiskBadge({ risk }: { risk: 'regular' | 'irregular' | 'at_risk' }) {
  if (risk === 'regular') return <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700"><TrendingUp className="h-3 w-3" />Regular</span>
  if (risk === 'irregular') return <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"><Minus className="h-3 w-3" />Irregular</span>
  return <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700"><TrendingDown className="h-3 w-3" />At Risk</span>
}

// ─── Main Page ───────────────────────────────────────────────────────────────

type DrawerMode = 'create' | 'edit'

export default function MembersListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, hasRole } = useAuthStore()
  const isAdmin = hasRole(['owner'])

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState('')
  const [planId, setPlanId] = useState<number | undefined>(undefined)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('create')
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null)
  const [deleteReason, setDeleteReason] = useState('')

  // Freeze modal state
  const [freezeModalOpen, setFreezeModalOpen] = useState(false)
  const [memberToFreeze, setMemberToFreeze] = useState<Member | null>(null)
  const [freezeReason, setFreezeReason] = useState('')
  const [freezeMonths, setFreezeMonths] = useState(1)

  // Unfreeze modal state
  const [unfreezeModalOpen, setUnfreezeModalOpen] = useState(false)
  const [memberToUnfreeze, setMemberToUnfreeze] = useState<Member | null>(null)

  // Link device modal state
  const [linkDeviceOpen, setLinkDeviceOpen] = useState(false)
  const [memberToLink, setMemberToLink] = useState<Member | null>(null)
  const [linkDeviceInput, setLinkDeviceInput] = useState('')
  const [baselineScanAt, setBaselineScanAt] = useState<string | null>(null)
  const [scannedName, setScannedName] = useState<string | null>(null)

  // Enrollment state (first-time fingerprint registration)
  const [enrollPending, setEnrollPending] = useState(false)
  const [enrollDeviceId, setEnrollDeviceId] = useState<string | null>(null)

  // Unlink confirmation state
  const [unlinkConfirmOpen, setUnlinkConfirmOpen] = useState(false)

  const [activeTab, setActiveTab] = useState<'members' | 'expiry' | 'batch' | 'attendance'>('members')
  const [attendanceRiskFilter, setAttendanceRiskFilter] = useState<'all' | 'at_risk' | 'irregular' | 'regular'>('all')
  const [attendanceSearch, setAttendanceSearch] = useState('')

  // Expiry alerts state
  const [expiryWindow, setExpiryWindow]   = useState<7 | 15 | 30 | 60 | 'custom'>(30)
  const [customFrom, setCustomFrom]       = useState('')
  const [customTo, setCustomTo]           = useState('')

  // Debounced search
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 400)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [search])

  // Queries
  const { data, isLoading, isError } = useQuery({
    queryKey: QUERY_KEYS.members({ page, per_page: PER_PAGE, search: debouncedSearch, status, plan_id: planId }),
    queryFn: () =>
      membersApi.list({ page, per_page: PER_PAGE, search: debouncedSearch || undefined, status: status || undefined, plan_id: planId }),
  })

  const { data: facilitiesData } = useQuery({
    queryKey: QUERY_KEYS.facilities,
    queryFn: () => facilitiesApi.list(),
    staleTime: 5 * 60 * 1000,
  })

  const { data: plansData } = useQuery({
    queryKey: ['plans', 'active'],
    queryFn: () => plansApi.list(true),
    staleTime: 10 * 60 * 1000,
  })

  // Stats queries — lightweight (per_page:1), only meta.total matters
  const { data: statsTotalData }   = useQuery({ queryKey: ['members', 'stats', 'all'],     queryFn: () => membersApi.list({ page: 1, per_page: 1 }),                    staleTime: 30000 })
  const { data: statsActiveData }  = useQuery({ queryKey: ['members', 'stats', 'active'],  queryFn: () => membersApi.list({ page: 1, per_page: 1, status: 'active' }),  staleTime: 30000 })
  const { data: statsFrozenData }  = useQuery({ queryKey: ['members', 'stats', 'frozen'],  queryFn: () => membersApi.list({ page: 1, per_page: 1, status: 'frozen' }),  staleTime: 30000 })
  const { data: statsExpiredData } = useQuery({ queryKey: ['members', 'stats', 'expired'], queryFn: () => membersApi.list({ page: 1, per_page: 1, status: 'expired' }), staleTime: 30000 })

  // Expiring soon query — active subs ending within the selected window
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const expiryToDate = expiryWindow === 'custom'
    ? customTo
    : (() => { const d = new Date(today); d.setDate(today.getDate() + expiryWindow); return d.toISOString().slice(0, 10) })()
  const expiryFromDate = expiryWindow === 'custom' ? customFrom : todayStr
  const { data: expiringData } = useQuery({
    queryKey: ['subscriptions', 'expiring', expiryWindow, expiryFromDate, expiryToDate],
    queryFn: () => subscriptionsApi.list({
      status: 'active',
      from: expiryFromDate || todayStr,
      to:   expiryToDate || todayStr,
      per_page: 100,
    }),
    enabled: expiryWindow !== 'custom' || (!!customFrom && !!customTo),
    staleTime: 60000,
  })
  const expiringSubs = ((expiringData as { subscriptions?: Subscription[] })?.subscriptions
    ?? (expiringData as { items?: Subscription[] })?.items
    ?? (Array.isArray(expiringData) ? expiringData : [])) as Subscription[]

  function daysUntil(dateStr: string): number {
    return Math.ceil((new Date(dateStr).getTime() - today.setHours(0,0,0,0)) / 86400000)
  }

  const criticalSubs = expiringSubs.filter(s => daysUntil(s.end_date) <= 7)
  const warningSubs  = expiringSubs.filter(s => { const d = daysUntil(s.end_date); return d > 7 && d <= 15 })
  const noticeSubs   = expiringSubs.filter(s => { const d = daysUntil(s.end_date); return d > 15 && d <= 30 })

  const visibleSubs = expiryWindow === 7  ? criticalSubs
                    : expiryWindow === 15 ? [...criticalSubs, ...warningSubs]
                    : expiringSubs  // 30, 60, custom — all returned by the filtered query

  const statTotal   = (statsTotalData   as { meta?: { total?: number } })?.meta?.total ?? 0
  const statActive  = (statsActiveData  as { meta?: { total?: number } })?.meta?.total ?? 0
  const statFrozen  = (statsFrozenData  as { meta?: { total?: number } })?.meta?.total ?? 0
  const statExpired = (statsExpiredData as { meta?: { total?: number } })?.meta?.total ?? 0

  const members = (data as { members?: Member[] })?.members ?? []
  const meta = (data as { meta?: { total?: number; per_page?: number } })?.meta
  const total = meta?.total ?? 0
  const perPage = meta?.per_page ?? PER_PAGE
  const facilities = (facilitiesData as { facilities?: Facility[] })?.facilities ?? []
  const plans = ((plansData as { plans?: Plan[] })?.plans ?? (Array.isArray(plansData) ? plansData : [])) as Plan[]

  // Batch-grouped data (fetched only when batch tab is active)
  const { data: allMembersData } = useQuery({
    queryKey: ['members', 'all-for-batch'],
    queryFn: () => membersApi.list({ page: 1, per_page: 10000, status: 'active' }),
    enabled: activeTab === 'batch',
    staleTime: 60000,
  })
  const allMembersForBatch = ((allMembersData as { members?: (Member & { batch_time?: string })[] })?.members ?? [])
  const BATCH_SLOTS = ['06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00']
  function batchLabel(t: string) { const h = parseInt(t); return h < 12 ? `${h}:00 AM` : h === 12 ? '12:00 PM' : `${h-12}:00 PM` }
  const batchGroups = BATCH_SLOTS.map(slot => ({
    slot,
    label: batchLabel(slot),
    members: allMembersForBatch.filter(m => m.batch_time === slot),
  })).filter(g => g.members.length > 0)
  const unassigned = allMembersForBatch.filter(m => !m.batch_time)

  // Attendance summary (fetched only when attendance tab is active)
  const { data: attendanceSummaryData, isLoading: attendanceSummaryLoading } = useQuery({
    queryKey: ['members', 'attendance-summary'],
    queryFn: () => membersApi.getAttendanceSummary(),
    enabled: activeTab === 'attendance',
    staleTime: 2 * 60 * 1000,
  })
  const rawAttendanceStats: AttendanceStats[] = (attendanceSummaryData as { stats?: AttendanceStats[] })?.stats ?? []
  const attendanceStats = rawAttendanceStats
    .filter(s => attendanceRiskFilter === 'all' || s.risk === attendanceRiskFilter)
    .filter(s => !attendanceSearch || s.member_name.toLowerCase().includes(attendanceSearch.toLowerCase()) || s.member_code.toLowerCase().includes(attendanceSearch.toLowerCase()))
    .sort((a, b) => {
      // Sort: at_risk first, then irregular, then regular; within same risk sort by month present asc
      const riskOrder = { at_risk: 0, irregular: 1, regular: 2 }
      const diff = riskOrder[a.risk] - riskOrder[b.risk]
      if (diff !== 0) return diff
      return a.month.present - b.month.present
    })

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => membersApi.delete(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      toast.success('Member deleted successfully')
      setDeleteModalOpen(false)
      setMemberToDelete(null)
      setDeleteReason('')
    },
    onError: () => {
      toast.error('Failed to delete member')
    },
  })

  const freezeMutation = useMutation({
    mutationFn: ({ id, reason, months }: { id: number; reason: string; months: number }) =>
      membersApi.freeze(id, reason, months),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      toast.success('Member frozen successfully')
      setFreezeModalOpen(false)
      setMemberToFreeze(null)
      setFreezeReason('')
      setFreezeMonths(1)
    },
    onError: () => {
      toast.error('Failed to freeze member')
    },
  })

  const unfreezeMutation = useMutation({
    mutationFn: (id: number) => membersApi.unfreeze(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      toast.success('Member unfrozen successfully')
      setUnfreezeModalOpen(false)
      setMemberToUnfreeze(null)
    },
    onError: () => {
      toast.error('Failed to unfreeze member')
    },
  })

  const linkDeviceMutation = useMutation({
    mutationFn: ({ id, deviceUserId }: { id: number; deviceUserId: string }) =>
      membersApi.linkDevice(id, deviceUserId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      toast.success(variables.deviceUserId ? 'Device linked successfully' : 'Device unlinked')
      setLinkDeviceOpen(false)
      setMemberToLink(null)
      setLinkDeviceInput('')
      setScannedName(null)
      setUnlinkConfirmOpen(false)
    },
    onError: () => {
      toast.error('Failed to link device')
    },
  })

  // Poll device online/offline status every 30s.
  const { data: deviceStatus } = useQuery({
    queryKey: ['biometric-device-status'],
    queryFn: () => membersApi.getDeviceStatus(),
    refetchInterval: 30000,
  })

  // Poll for new biometric scans while link device modal is open.
  const { data: lastScan } = useQuery({
    queryKey: ['biometric-last-scan'],
    queryFn: () => membersApi.getLastScan(),
    refetchInterval: linkDeviceOpen ? 2000 : false,
    enabled: linkDeviceOpen,
  })

  useEffect(() => {
    if (!linkDeviceOpen || !lastScan || !baselineScanAt) return
    if (enrollPending) return  // don't clobber device ID while enrollment is in progress
    // Compare two server-side timestamps — no browser↔VPS clock drift.
    if (lastScan.scanned_at > baselineScanAt && lastScan.device_user_id !== linkDeviceInput) {
      setLinkDeviceInput(lastScan.device_user_id)
      setScannedName(lastScan.name || null)
    }
  }, [lastScan, linkDeviceOpen, baselineScanAt, enrollPending])

  // Poll enroll status while enrollment is in progress.
  const { data: enrollStatus } = useQuery({
    queryKey: ['biometric-enroll-status'],
    queryFn: () => membersApi.getEnrollStatus(),
    refetchInterval: enrollPending ? 2000 : false,
    enabled: enrollPending,
  })

  useEffect(() => {
    if (!enrollPending || !enrollStatus || enrollStatus.status !== 'done') return
    if (enrollStatus.success && enrollStatus.device_user_id && memberToLink) {
      setEnrollPending(false)
      setLinkDeviceInput(enrollStatus.device_user_id)
      setScannedName('Enrolled successfully')
      toast.success('Fingerprint registered! Click Link to save.')
    } else if (enrollStatus.status === 'done' && !enrollStatus.success) {
      setEnrollPending(false)
      toast.error('Enrollment failed — please try again')
    }
  }, [enrollStatus, enrollPending, memberToLink])

  // Handlers
  const openCreateDrawer = () => {
    setDrawerMode('create')
    setSelectedMember(null)
    setDrawerOpen(true)
  }

  const openEditDrawer = (member: Member) => {
    setDrawerMode('edit')
    setSelectedMember(member)
    setDrawerOpen(true)
  }

  const openLinkDeviceModal = (member: Member) => {
    setMemberToLink(member)
    setLinkDeviceInput(member.device_user_id ?? '')
    setScannedName(null)
    // Capture server-side baseline so we only accept scans that arrive AFTER modal opens.
    // Using server timestamp avoids browser↔VPS clock drift.
    membersApi.getLastScan().then(scan => {
      setBaselineScanAt(scan?.scanned_at ?? new Date(0).toISOString())
    }).catch(() => {
      setBaselineScanAt(new Date(0).toISOString())
    })
    setLinkDeviceOpen(true)
    membersApi.requestScan().catch(() => {})
  }

  const openDeleteModal = (member: Member) => {
    setMemberToDelete(member)
    setDeleteReason('')
    setDeleteModalOpen(true)
  }

  const openFreezeModal = (member: Member) => {
    setMemberToFreeze(member)
    setFreezeReason('')
    setFreezeMonths(1)
    setFreezeModalOpen(true)
  }

  const openUnfreezeModal = (member: Member) => {
    setMemberToUnfreeze(member)
    setUnfreezeModalOpen(true)
  }

  const handleDelete = () => {
    if (!memberToDelete) return
    deleteMutation.mutate({ id: memberToDelete.id, reason: deleteReason })
  }

  const handleFreeze = () => {
    if (!memberToFreeze) return
    freezeMutation.mutate({ id: memberToFreeze.id, reason: freezeReason, months: freezeMonths })
  }

  const handleUnfreeze = () => {
    if (!memberToUnfreeze) return
    unfreezeMutation.mutate(memberToUnfreeze.id)
  }

  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownloadExcel = async () => {
    setIsDownloading(true)
    const dateStr = new Date().toISOString().slice(0, 10)
    try {
      if (activeTab === 'expiry') {
        const rows = visibleSubs
          .slice()
          .sort((a, b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime())
          .map(sub => {
            const days = daysUntil(sub.end_date)
            const member = sub.member
            return {
              'Name': member ? `${member.user.first_name} ${member.user.last_name}` : '—',
              'Phone': member?.user?.phone ?? '',
              'Member Code': member?.member_code ?? '',
              'Plan': sub.plan?.name ?? '—',
              'Expires': sub.end_date.slice(0, 10),
              'Days Left': days,
            }
          })
        const ws = XLSX.utils.json_to_sheet(rows)
        ws['!cols'] = [22, 14, 14, 20, 12, 10].map(w => ({ wch: w }))
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Expiry Alerts')
        XLSX.writeFile(wb, `membership-expiry-alerts-${dateStr}.xlsx`)
        toast.success('Expiry alerts downloaded')

      } else if (activeTab === 'batch') {
        const rows: Record<string, string>[] = []
        batchGroups.forEach(group => {
          group.members.forEach(m => {
            rows.push({
              'Batch Time': group.label,
              'Member Code': m.member_code ?? '',
              'Name': `${(m.user as any)?.first_name ?? ''} ${(m.user as any)?.last_name ?? ''}`.trim(),
              'Phone': (m.user as any)?.phone ?? '',
              'Status': m.membership_status ?? '',
            })
          })
        })
        if (unassigned.length > 0) {
          unassigned.forEach(m => {
            rows.push({
              'Batch Time': 'Unassigned',
              'Member Code': m.member_code ?? '',
              'Name': `${(m.user as any)?.first_name ?? ''} ${(m.user as any)?.last_name ?? ''}`.trim(),
              'Phone': (m.user as any)?.phone ?? '',
              'Status': m.membership_status ?? '',
            })
          })
        }
        const ws = XLSX.utils.json_to_sheet(rows)
        ws['!cols'] = [14, 14, 22, 14, 10].map(w => ({ wch: w }))
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'By Batch Time')
        XLSX.writeFile(wb, `members-by-batch-time-${dateStr}.xlsx`)
        toast.success('Batch time list downloaded')

      } else if (activeTab === 'attendance') {
        const rows = attendanceStats.map(s => ({
          'Member Code': s.member_code,
          'Name': s.member_name,
          'Last Visit': s.last_visit_at ? s.last_visit_at.slice(0, 10) : '',
          'This Week': `${s.week.present}/${s.week.days_in_period}`,
          'This Month': `${s.month.present}/${s.month.days_in_period}`,
          'Quarter': `${s.quarter.present}/${s.quarter.days_in_period}`,
          '6 Months': `${s.half_year.present}/${s.half_year.days_in_period}`,
          'Year': `${s.year.present}/${s.year.days_in_period}`,
          'Streak (days)': s.streak,
          'Risk': s.risk === 'at_risk' ? 'At Risk' : s.risk === 'irregular' ? 'Irregular' : 'Regular',
        }))
        const ws = XLSX.utils.json_to_sheet(rows)
        ws['!cols'] = [14, 22, 12, 12, 14, 10, 10, 10, 14, 10].map(w => ({ wch: w }))
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Attendance Analysis')
        XLSX.writeFile(wb, `members-attendance-analysis-${dateStr}.xlsx`)
        toast.success('Attendance analysis downloaded')

      } else {
        // All Members tab — fetch all matching current filters
        const result = await membersApi.list({ page: 1, per_page: 10000, search: debouncedSearch || undefined, status: status || undefined, plan_id: planId })
        const all: Member[] = (result as { members?: Member[] })?.members ?? []
        const rows = all.map((m) => ({
          'Member Code': m.member_code ?? '',
          'First Name': m.user?.first_name ?? '',
          'Last Name': m.user?.last_name ?? '',
          'Email': m.user?.email ?? '',
          'Phone': m.user?.phone ?? '',
          'Plan': m.current_subscription?.plan?.name ?? '',
          'Status': m.membership_status ?? '',
          'Joined Date': m.joined_date ? m.joined_date.slice(0, 10) : '',
          'Expiry Date': m.current_subscription?.end_date ? m.current_subscription.end_date.slice(0, 10) : '',
        }))
        const ws = XLSX.utils.json_to_sheet(rows)
        ws['!cols'] = [14, 14, 14, 28, 16, 20, 10, 14, 14].map(w => ({ wch: w }))
        const wb = XLSX.utils.book_new()
        const sheetLabel = status ? `${status.charAt(0).toUpperCase() + status.slice(1)} Members` : 'All Members'
        XLSX.utils.book_append_sheet(wb, ws, sheetLabel)
        const statusPrefix = status ? `${status}-members` : 'all-members'
        XLSX.writeFile(wb, `${statusPrefix}-${dateStr}.xlsx`)
        toast.success('Excel downloaded')
      }
    } catch {
      toast.error('Failed to download Excel')
    } finally {
      setIsDownloading(false)
    }
  }

  const totalPages = Math.ceil(total / perPage)

  const whatsappUrl = (phone: string, name: string, days: number, planName: string) => {
    const cleaned = phone.replace(/\D/g, '')
    const withCountry = cleaned.startsWith('91') && cleaned.length === 12 ? cleaned : `91${cleaned}`
    const msg = encodeURIComponent(
      `Hi ${name}, your ${planName} membership is expiring in ${days} day${days === 1 ? '' : 's'}. Please renew to continue enjoying our services. 🏋️`
    )
    return `https://wa.me/${withCountry}?text=${msg}`
  }

  return (
    <div>
      <PageHeader
        title="Members"
        section="Stayfit Gym"
        subtitle="Manage your gym members"
        icon={<Users className="h-5 w-5" />}
        statLayout="inline"
        stats={[
          { label: 'Total Members',  value: statTotal,   sub: 'all time'         },
          { label: 'Active',         value: statActive,  sub: 'currently active' },
          { label: 'Frozen',         value: statFrozen,  sub: 'on hold'          },
          { label: 'Expired',        value: statExpired, sub: 'needs renewal'    },
          { label: 'New This Month', value: '—',         sub: 'recent sign-ups'  },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handleDownloadExcel} disabled={isDownloading} title="Export" className="h-8 w-8" style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', boxShadow: '0 2px 12px rgba(0,180,216,0.18), inset 0 1px 0 rgba(255,255,255,0.4)', color: '#007a99', border: '1px solid rgba(255,255,255,0.35)' }}>
              <Download className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => navigate('/members/new')}
              className="border-0 text-white"
              style={{
                background: 'linear-gradient(135deg, #0096b4 0%, #007a99 100%)',
                boxShadow: '0 2px 8px rgba(0,150,180,0.35)',
              }}
            >
              <Plus className="h-4 w-4" />
              Add Member
            </Button>
          </div>
        }
      />


      {/* ── Device offline banner ── */}
      {deviceStatus && !deviceStatus.online && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 px-4 py-2.5 mb-2">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
          <p className="text-sm text-red-700 dark:text-red-400">
            <span className="font-medium">Biometric device is offline.</span> Attendance scans are not being recorded.
            {deviceStatus.last_seen_at && (
              <span className="ml-1 text-red-500">Last seen: {new Date(deviceStatus.last_seen_at).toLocaleTimeString()}</span>
            )}
          </p>
        </div>
      )}

      {/* ── View selector ── */}
      <div className="rounded-xl bg-teal-50/60 border border-teal-100 p-1.5 flex items-center gap-1 mb-5">
        {([
          { key: 'members',    icon: <Users className="h-4 w-4" />,    label: 'All Members',            count: total > 0 ? total : null,           activeColor: 'bg-white text-[#007a99] shadow-sm border border-teal-200' },
          { key: 'expiry',     icon: <Bell  className={`h-4 w-4 ${criticalSubs.length > 0 && activeTab === 'expiry' ? 'animate-[wiggle_1s_ease-in-out_infinite]' : ''}`} />, label: 'Expiry Alerts', count: expiringSubs.length > 0 ? expiringSubs.length : null, countColor: criticalSubs.length > 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700', activeColor: criticalSubs.length > 0 ? 'bg-white text-red-600 shadow-sm border border-red-200' : 'bg-white text-amber-600 shadow-sm border border-amber-200' },
          { key: 'batch',      icon: <Clock    className="h-4 w-4" />, label: 'By Batch Time',          count: null,                               activeColor: 'bg-white text-cyan-700 shadow-sm border border-cyan-200'  },
          { key: 'attendance', icon: <BarChart3 className="h-4 w-4" />,label: 'Attendance Analysis',    count: null,                               activeColor: 'bg-white text-violet-700 shadow-sm border border-violet-200' },
        ] as const).map(t => {
          const isActive = activeTab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 focus:outline-none flex-1 justify-center ${
                isActive ? t.activeColor : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
              }`}
            >
              {t.icon}
              {t.label}
              {t.count !== null && (
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  isActive ? (t.countColor ?? 'bg-teal-100 text-teal-700') : 'bg-slate-200 text-slate-500'
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Tab: All Members ── */}
      <div className={activeTab === 'members' ? '' : 'hidden'}>
          <Card className="border-0 shadow-md">
            <CardContent className="p-0">
              {/* ── Toolbar ── */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/60">
                {([
                  { value: '',        label: 'All',     count: statTotal,   dot: 'bg-slate-400',   chip: 'bg-slate-100 text-slate-700 border-slate-200',       chipOn: 'bg-slate-800 text-white border-slate-800'    },
                  { value: 'active',  label: 'Active',  count: statActive,  dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',   chipOn: 'bg-emerald-600 text-white border-emerald-600' },
                  { value: 'frozen',  label: 'Frozen',  count: statFrozen,  dot: 'bg-sky-400',     chip: 'bg-sky-50 text-sky-700 border-sky-200',              chipOn: 'bg-sky-600 text-white border-sky-600'         },
                  { value: 'expired', label: 'Expired', count: statExpired, dot: 'bg-red-400',     chip: 'bg-red-50 text-red-700 border-red-200',              chipOn: 'bg-red-600 text-white border-red-600'         },
                ] as const).map(tab => {
                  const isSelected = status === tab.value
                  return (
                    <button
                      key={tab.value}
                      onClick={() => { setStatus(tab.value); setPage(1); setPlanId(undefined) }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 ${
                        isSelected ? tab.chipOn : tab.chip + ' hover:opacity-80'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-white' : tab.dot}`} />
                      {tab.label}
                      <span className={`font-bold ${isSelected ? 'opacity-90' : 'opacity-70'}`}>
                        {tab.count}
                      </span>
                    </button>
                  )
                })}
                <div className="ml-auto flex items-center gap-3 pl-4">
                  <select
                    value={planId ?? ''}
                    onChange={e => { setPlanId(e.target.value ? Number(e.target.value) : undefined); setPage(1) }}
                    className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-400 min-w-[160px]"
                  >
                    <option value="">All Plans</option>
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  {planId !== undefined && (
                    <button
                      onClick={() => { setPlanId(undefined); setPage(1) }}
                      className="text-xs text-slate-400 hover:text-slate-600 underline"
                    >
                      Clear
                    </button>
                  )}
                  <div className="border-l border-slate-200 pl-3">
                    <SearchInput
                      value={search}
                      onChange={setSearch}
                      placeholder="Search members..."
                      className="w-72"
                    />
                  </div>
                </div>
              </div>
              {isError && (
                <div className="p-6 text-sm text-destructive">Failed to load members. Please try again.</div>
              )}
              {isLoading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : !isError && members.length === 0 ? (
                <EmptyState title="No members found" description="Try adjusting your search or filters." />
              ) : (
                <div className="rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-sidebar">
                      <tr>
                        <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Member Code</th>
                        <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Name</th>
                        <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Package</th>
                        <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Status</th>
                        <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Joined</th>
                        <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Expiry Date</th>
                        <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Biometric</th>
                        <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {members.map((member) => (
                        <tr
                          key={member.id}
                          className="hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => navigate(`/members/${member.id}`)}
                        >
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{member.member_code ?? '-'}</td>
                          <td className="px-4 py-3">
                            {member.user?.first_name} {member.user?.last_name}
                          </td>
                          <td className="px-4 py-3 text-sm">{member.current_subscription?.plan?.name ?? <span className="text-muted-foreground">—</span>}</td>
                          <td className="px-4 py-3">
                            {member.membership_status ? <StatusBadge status={member.membership_status} /> : '-'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {member.joined_date ? formatDate(member.joined_date) : '-'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {member.current_subscription?.end_date ? formatDate(member.current_subscription.end_date) : <span className="text-muted-foreground/40">—</span>}
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            {member.device_user_id ? (
                              <span className="inline-flex items-center gap-1 text-xs text-teal-600 dark:text-teal-400 font-mono" title={`Registered · ID ${member.device_user_id}`}>
                                <Fingerprint className="h-3.5 w-3.5 text-teal-500" />
                                {member.device_user_id}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-amber-500 dark:text-amber-400 font-medium cursor-pointer" title="Not registered — click the fingerprint icon to enroll" onClick={(e) => { e.stopPropagation(); openLinkDeviceModal(member) }}>
                                <Fingerprint className="h-3.5 w-3.5" />
                                Not registered
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary"
                                title="View member" onClick={(e) => { e.stopPropagation(); navigate(`/members/${member.id}`) }}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-blue-500"
                                title="Edit member" onClick={(e) => { e.stopPropagation(); openEditDrawer(member) }}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className={`h-8 w-8 ${member.device_user_id ? 'text-teal-500 hover:text-teal-700' : 'text-muted-foreground hover:text-teal-500'}`}
                                title={member.device_user_id ? 'Change/unlink device' : 'Link biometric device'}
                                onClick={(e) => { e.stopPropagation(); openLinkDeviceModal(member) }}>
                                {member.device_user_id ? <Unlink className="h-4 w-4" /> : <Link className="h-4 w-4" />}
                              </Button>
                              {member.membership_status === 'active' && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-cyan-500"
                                  title="Freeze membership" onClick={(e) => { e.stopPropagation(); openFreezeModal(member) }}>
                                  <Snowflake className="h-4 w-4" />
                                </Button>
                              )}
                              {member.membership_status === 'frozen' && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-amber-500"
                                  title="Unfreeze membership" onClick={(e) => { e.stopPropagation(); openUnfreezeModal(member) }}>
                                  <Sun className="h-4 w-4" />
                                </Button>
                              )}
                              {isAdmin && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  title="Delete member" onClick={(e) => { e.stopPropagation(); openDeleteModal(member) }}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {!isLoading && total > 0 && (
            <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
              <span>
                Showing {Math.min((page - 1) * perPage + 1, total)}–{Math.min(page * perPage, total)} of {total} members
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={page === 1} className="h-8 w-8 p-0">«</Button>
                  <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 1} className="h-8 px-3">Previous</Button>
                  {(() => {
                    const pages: (number | '...')[] = []
                    if (totalPages <= 7) {
                      for (let i = 1; i <= totalPages; i++) pages.push(i)
                    } else {
                      pages.push(1)
                      if (page > 3) pages.push('...')
                      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
                      if (page < totalPages - 2) pages.push('...')
                      pages.push(totalPages)
                    }
                    return pages.map((p, i) =>
                      p === '...'
                        ? <span key={`ellipsis-${i}`} className="px-1 text-muted-foreground">…</span>
                        : <Button key={p} variant={p === page ? 'default' : 'outline'} size="sm"
                            onClick={() => setPage(p)} className="h-8 w-8 p-0 text-xs">{p}</Button>
                    )
                  })()}
                  <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages} className="h-8 px-3">Next</Button>
                  <Button variant="outline" size="sm" onClick={() => setPage(totalPages)} disabled={page >= totalPages} className="h-8 w-8 p-0">»</Button>
                </div>
              )}
            </div>
          )}
      </div>

      {/* ── Tab: Membership Expiry Alerts ── */}
      <div className={activeTab === 'expiry' ? '' : 'hidden'}>
        <Card className="border-0 shadow-md overflow-hidden">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${criticalSubs.length > 0 ? 'bg-red-100' : expiringSubs.length > 0 ? 'bg-amber-100' : 'bg-emerald-100'}`}>
                <Bell className={`h-4 w-4 ${criticalSubs.length > 0 ? 'text-red-600' : expiringSubs.length > 0 ? 'text-amber-600' : 'text-emerald-600'}`} />
              </div>
              <span className="text-sm font-semibold text-gray-700 dark:text-foreground">Expiry</span>
              <div className="w-px h-5 bg-border shrink-0" />
              {expiringSubs.length === 0 ? (
                <span className="text-sm text-emerald-600 font-medium">
                  {expiryWindow === 'custom' ? 'No memberships expiring in selected range' : `All healthy — none expiring within ${expiryWindow} days`}
                </span>
              ) : (
                <div className="flex items-center gap-3">
                  {criticalSubs.length > 0 && (
                    <span className="text-sm font-semibold" style={{ color: '#8B0000' }}>
                      <span className="text-base font-bold">{criticalSubs.length}</span> expiry within 7 days
                    </span>
                  )}
                  {criticalSubs.length > 0 && warningSubs.length > 0 && (
                    <div className="w-px h-4 shrink-0" style={{ backgroundColor: '#C4000033' }} />
                  )}
                  {warningSubs.length > 0 && (
                    <span className="text-sm font-semibold" style={{ color: '#C41E3A' }}>
                      <span className="text-base font-bold">{warningSubs.length}</span> expiry within 15 days
                    </span>
                  )}
                  {(criticalSubs.length > 0 || warningSubs.length > 0) && noticeSubs.length > 0 && (
                    <div className="w-px h-4 shrink-0" style={{ backgroundColor: '#C4000033' }} />
                  )}
                  {noticeSubs.length > 0 && (
                    <span className="text-sm font-medium" style={{ color: '#E05C6E' }}>
                      <span className="text-base font-bold">{noticeSubs.length}</span> expiry within 30 days
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <div className="flex items-center rounded-full bg-white dark:bg-muted shadow-[0_4px_20px_rgba(0,0,0,0.18)] p-0.5 gap-0.5">
                {([{ value: 7, label: '7d' }, { value: 15, label: '15d' }, { value: 30, label: '30d' }, { value: 60, label: '2mo' }] as const).map(({ value: w, label }) => (
                  <button key={w} onClick={() => setExpiryWindow(w)}
                    className={`text-[11px] font-semibold px-3 py-1 rounded-full transition-all duration-150 ${expiryWindow === w ? 'bg-blue-600 text-white shadow-sm' : 'text-muted-foreground hover:text-gray-700'}`}>
                    {label}
                  </button>
                ))}
                <button onClick={() => setExpiryWindow('custom')}
                  className={`text-[11px] font-semibold px-3 py-1 rounded-full transition-all duration-150 ${expiryWindow === 'custom' ? 'bg-blue-600 text-white shadow-sm' : 'text-muted-foreground hover:text-gray-700'}`}>
                  Custom
                </button>
              </div>
              {expiryWindow === 'custom' && (
                <div className="flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1">
                  <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                    className="text-[11px] bg-transparent text-blue-700 focus:outline-none w-[96px]" />
                  <span className="text-blue-400 text-xs font-medium">→</span>
                  <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                    className="text-[11px] bg-transparent text-blue-700 focus:outline-none w-[96px]" />
                </div>
              )}
            </div>
          </div>

          {/* Table */}
          {expiringSubs.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-10 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              <p className="text-sm font-medium">
                {expiryWindow === 'custom' && customFrom && customTo
                  ? `No memberships expiring between ${customFrom} and ${customTo}`
                  : expiryWindow === 'custom' ? 'Select a date range to search'
                  : `No memberships expiring in the next ${expiryWindow} days`}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-sidebar">
                <tr>
                  <th className="text-left px-5 py-2.5 text-xs font-light text-sidebar-foreground uppercase tracking-wide">Member</th>
                  <th className="text-left px-5 py-2.5 text-xs font-light text-sidebar-foreground uppercase tracking-wide">Plan</th>
                  <th className="text-left px-5 py-2.5 text-xs font-light text-sidebar-foreground uppercase tracking-wide">Expires</th>
                  <th className="text-left px-5 py-2.5 text-xs font-light text-sidebar-foreground uppercase tracking-wide">Days Left</th>
                  <th className="text-left px-5 py-2.5 text-xs font-light text-sidebar-foreground uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {visibleSubs
                  .sort((a, b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime())
                  .map(sub => {
                    const days = daysUntil(sub.end_date)
                    const { bg, dot } = days <= 7
                      ? { bg: 'bg-red-50 dark:bg-red-950/20',    dot: 'bg-red-500' }
                      : days <= 15
                      ? { bg: 'bg-orange-50 dark:bg-orange-950/20', dot: 'bg-orange-500' }
                      : { bg: '',                                  dot: 'bg-yellow-400' }
                    const member = sub.member
                    const name = member ? `${member.user.first_name} ${member.user.last_name}` : '—'
                    const phone = member?.user?.phone ?? ''
                    return (
                      <tr key={sub.id} className={`${bg} hover:brightness-95 transition-all cursor-pointer`}
                        onClick={() => member && navigate(`/members/${member.id}`)}>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full shrink-0 ${dot}`} />
                            <span className="font-medium text-gray-800 dark:text-foreground">{name}</span>
                            {phone && <span className="text-xs text-muted-foreground">{phone}</span>}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-gray-700 dark:text-foreground/80">{sub.plan?.name ?? '—'}</td>
                        <td className="px-5 py-3 text-gray-600 dark:text-foreground/70">{formatDate(sub.end_date)}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${
                            days <= 7  ? 'text-red-700 bg-red-100 border-red-200'
                            : days <= 15 ? 'text-orange-600 bg-orange-100 border-orange-200'
                            : 'text-yellow-700 bg-yellow-100 border-yellow-200'}`}>
                            {days === 0 ? 'Today' : days === 1 ? '1 day' : `${days} days`}
                          </span>
                        </td>
                        <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <button onClick={() => member && navigate(`/members/${member.id}`)}
                              className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1" title="View member profile">
                              <Eye className="h-3.5 w-3.5" /> View
                            </button>
                            {phone ? (
                              <a href={whatsappUrl(phone, name, days, sub.plan?.name ?? 'gym')}
                                target="_blank" rel="noopener noreferrer"
                                title="Send WhatsApp renewal reminder"
                                className="flex items-center justify-center h-7 w-7 rounded-full bg-green-50 hover:bg-green-100 transition-colors border border-green-200">
                                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-green-600" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                </svg>
                              </a>
                            ) : (
                              <span title="No phone number on file"
                                className="flex items-center justify-center h-7 w-7 rounded-full bg-slate-50 border border-slate-200 cursor-not-allowed opacity-40">
                                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-slate-400" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                </svg>
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {/* Create / Edit Drawer */}
      <FormDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={drawerMode === 'create' ? 'Add Member' : 'Edit Member'}
        description={
          drawerMode === 'create'
            ? 'Fill in the details to add a new gym member.'
            : `Editing ${selectedMember?.user?.first_name ?? ''} ${selectedMember?.user?.last_name ?? ''}`
        }
        wide={drawerMode === 'edit'}
      >
        {drawerMode === 'create' ? (
          <CreateMemberForm facilities={facilities} onSuccess={() => setDrawerOpen(false)} />
        ) : selectedMember ? (
          <EditMemberForm member={selectedMember} onSuccess={() => setDrawerOpen(false)} />
        ) : null}
      </FormDrawer>

      {/* ── Tab: By Batch Time ── */}
      <div className={activeTab === 'batch' ? '' : 'hidden'}>
        <div className="space-y-4">
          {batchGroups.length === 0 && allMembersForBatch.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">Loading batch data…</div>
          ) : batchGroups.length === 0 && allMembersForBatch.length > 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              No members have a batch time assigned yet. Edit a member to set their preferred batch time.
            </div>
          ) : (
            batchGroups.map(group => (
              <div key={group.slot} className="rounded-xl border border-border/60 overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3 bg-cyan-50 dark:bg-indigo-900/20 border-b border-border/40">
                  <Clock className="h-4 w-4 text-[#007a99]" />
                  <span className="font-semibold text-sm text-[#005f7a] dark:text-indigo-300">{group.label}</span>
                  <span className="ml-auto text-xs font-medium px-2.5 py-0.5 rounded-full bg-cyan-100 text-[#007a99] dark:bg-indigo-800 dark:text-indigo-200">
                    {group.members.length} member{group.members.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="divide-y divide-border/40">
                  {group.members.map(m => (
                    <div key={m.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => { setSelectedMember(m); setDrawerOpen(true) }}>
                      <div className="h-8 w-8 rounded-full bg-cyan-100 flex items-center justify-center shrink-0 text-[#007a99] text-xs font-bold">
                        {(m.user as any)?.first_name?.[0] ?? '?'}{(m.user as any)?.last_name?.[0] ?? ''}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{(m.user as any)?.first_name} {(m.user as any)?.last_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{m.member_code}</p>
                      </div>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                        m.membership_status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                      }`}>{m.membership_status}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
          {unassigned.length > 0 && (
            <div className="rounded-xl border border-border/40 overflow-hidden opacity-60">
              <div className="flex items-center gap-3 px-5 py-3 bg-muted/40 border-b border-border/40">
                <span className="text-sm text-muted-foreground font-medium">No batch assigned</span>
                <span className="ml-auto text-xs font-medium px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {unassigned.length} members
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Tab: Attendance Analysis ── */}
      <div className={activeTab === 'attendance' ? '' : 'hidden'}>
        <Card className="border-0 shadow-md overflow-hidden">
          <CardContent className="p-0">
            {/* Toolbar */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60 flex-wrap">
              {(['all', 'at_risk', 'irregular', 'regular'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setAttendanceRiskFilter(r)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    attendanceRiskFilter === r
                      ? r === 'at_risk' ? 'bg-red-100 text-red-700' : r === 'irregular' ? 'bg-amber-100 text-amber-700' : r === 'regular' ? 'bg-green-100 text-green-700' : 'bg-violet-100 text-violet-700'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {r === 'all' ? 'All Members' : r === 'at_risk' ? '🔴 At Risk' : r === 'irregular' ? '🟡 Irregular' : '🟢 Regular'}
                  {r !== 'all' && (
                    <span className="ml-1.5">
                      ({rawAttendanceStats.filter(s => s.risk === r).length})
                    </span>
                  )}
                </button>
              ))}
              <div className="ml-auto">
                <SearchInput value={attendanceSearch} onChange={setAttendanceSearch} placeholder="Search member..." className="w-64" />
              </div>
            </div>

            {attendanceSummaryLoading ? (
              <div className="p-6 space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : attendanceStats.length === 0 ? (
              <EmptyState title="No attendance data" description="Data will appear once members start checking in via biometric or QR." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-sidebar">
                    <tr>
                      <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Member</th>
                      <th className="text-center px-3 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Last Visit</th>
                      <th className="text-center px-3 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">This Week</th>
                      <th className="text-center px-3 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">This Month</th>
                      <th className="text-center px-3 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Quarter</th>
                      <th className="text-center px-3 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">6 Months</th>
                      <th className="text-center px-3 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Year</th>
                      <th className="text-center px-3 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Streak</th>
                      <th className="text-center px-3 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Risk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {attendanceStats.map(s => (
                      <tr key={s.member_id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800">{s.member_name || '—'}</div>
                          <div className="text-xs text-slate-400">{s.member_code}</div>
                        </td>
                        <td className="px-3 py-3 text-center text-xs text-slate-500">
                          {s.last_visit_at ? formatDate(s.last_visit_at) : <span className="text-slate-300">Never</span>}
                        </td>
                        <AttendanceCell period={s.week} />
                        <AttendanceCell period={s.month} />
                        <AttendanceCell period={s.quarter} />
                        <AttendanceCell period={s.half_year} />
                        <AttendanceCell period={s.year} />
                        <td className="px-3 py-3 text-center">
                          {s.streak > 0 ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600">
                              <TrendingUp className="h-3 w-3" />{s.streak}d
                            </span>
                          ) : <Minus className="h-3 w-3 text-slate-300 mx-auto" />}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <RiskBadge risk={s.risk} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setMemberToDelete(null); setDeleteReason('') }}
        onConfirm={handleDelete}
        title="Delete Member"
        description={`This will permanently delete ${memberToDelete?.user?.first_name ?? 'this member'}. This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />

      {/* Delete reason input rendered inside a portal-like wrapper below the modal — using a separate small dialog overlay isn't ideal with ConfirmModal's current API, so we show it as a floating field above the modal trigger */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center pb-[200px] pointer-events-none">
          <div className="bg-background border rounded-lg shadow-lg p-4 w-full max-w-sm pointer-events-auto mx-4">
            <Label htmlFor="delete_reason" className="text-sm font-medium">
              Reason for deletion <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="delete_reason"
              className="mt-1"
              placeholder="Enter reason..."
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Freeze Modal */}
      <ConfirmModal
        isOpen={freezeModalOpen}
        onClose={() => { setFreezeModalOpen(false); setMemberToFreeze(null); setFreezeReason(''); setFreezeMonths(1) }}
        onConfirm={handleFreeze}
        title="Freeze Member"
        description={`Freeze ${memberToFreeze?.user?.first_name ?? 'this member'}'s membership.`}
        confirmLabel="Freeze"
        variant="default"
        isLoading={freezeMutation.isPending}
      />

      {freezeModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center pb-[200px] pointer-events-none">
          <div className="bg-background border rounded-lg shadow-lg p-4 w-full max-w-sm pointer-events-auto mx-4 space-y-3">
            <div className="space-y-1">
              <Label htmlFor="freeze_reason" className="text-sm font-medium">
                Reason <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="freeze_reason"
                placeholder="e.g. Travelling abroad"
                value={freezeReason}
                onChange={(e) => setFreezeReason(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="freeze_months" className="text-sm font-medium">
                Freeze for (months)
              </Label>
              <Select
                value={String(freezeMonths)}
                onValueChange={(val) => setFreezeMonths(Number(val))}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={String(m)}>
                    {m} {m === 1 ? 'month' : 'months'}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Unfreeze Modal */}
      <ConfirmModal
        isOpen={unfreezeModalOpen}
        onClose={() => { setUnfreezeModalOpen(false); setMemberToUnfreeze(null) }}
        onConfirm={handleUnfreeze}
        title="Unfreeze Member"
        description={`Are you sure you want to unfreeze ${memberToUnfreeze?.user?.first_name ?? 'this member'}'s membership? Their membership will become active again.`}
        confirmLabel="Unfreeze"
        variant="default"
        isLoading={unfreezeMutation.isPending}
      />

      {/* Link Device Modal */}
      {linkDeviceOpen && memberToLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setLinkDeviceOpen(false); setMemberToLink(null); setEnrollPending(false); setEnrollDeviceId(null); setUnlinkConfirmOpen(false) }}>
          <div className="bg-background rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-teal-100 dark:bg-teal-900/30">
                <Fingerprint className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <h2 className="font-semibold text-base">Link Biometric Device</h2>
                <p className="text-sm text-muted-foreground">{memberToLink.user.first_name} {memberToLink.user.last_name}</p>
              </div>
            </div>

            {/* Enrollment in progress */}
            {enrollPending && (
              <div className="mb-4 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 px-3 py-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
                  </span>
                  <p className="text-sm font-medium text-violet-700 dark:text-violet-300">Fingerprint enrollment in progress</p>
                </div>
                <p className="text-xs text-violet-600 dark:text-violet-400 pl-4">
                  The biometric machine will now ask the member to place their finger multiple times. Please wait…
                </p>
                {enrollDeviceId && (
                  <p className="text-xs text-muted-foreground pl-4 font-mono">Device ID: {enrollDeviceId}</p>
                )}
              </div>
            )}

            {/* Auto-detect scan status */}
            {!enrollPending && scannedName ? (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 px-3 py-2.5">
                <CheckCircle2 className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0" />
                <p className="text-sm text-teal-700 dark:text-teal-300">
                  Scan detected: <span className="font-medium">{scannedName}</span>
                </p>
              </div>
            ) : !enrollPending ? (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 px-3 py-2.5">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500" />
                </span>
                <p className="text-sm text-muted-foreground">Waiting for scan… ask the member to scan their finger</p>
              </div>
            ) : null}

            {/* Register new fingerprint — only for members with no existing biometric */}
            {!memberToLink.device_user_id && !enrollPending && (
              <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <p className="text-xs text-amber-700 dark:text-amber-400 mb-2">
                  This member has no registered fingerprint. You can enroll them directly from the biometric machine.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full border-amber-400 text-amber-700 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-400"
                  onClick={() => {
                    membersApi.requestEnroll('member', memberToLink.id).then(res => {
                      setEnrollDeviceId(res.device_user_id)
                      setEnrollPending(true)
                    }).catch(() => toast.error('Failed to start enrollment'))
                  }}
                >
                  <Fingerprint className="h-4 w-4 mr-2" /> Register New Fingerprint
                </Button>
              </div>
            )}

            <div className="mb-4">
              <Label htmlFor="device-user-id" className="text-sm font-medium mb-1.5 block">Device User ID</Label>
              <Input
                id="device-user-id"
                value={linkDeviceInput}
                onChange={e => { setLinkDeviceInput(e.target.value); setScannedName(null) }}
                placeholder="e.g. 1638"
                className="font-mono"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') linkDeviceMutation.mutate({ id: memberToLink.id, deviceUserId: linkDeviceInput.trim() }) }}
              />
              {memberToLink.device_user_id && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  Currently linked to: <span className="font-mono text-teal-600 dark:text-teal-400">{memberToLink.device_user_id}</span>
                </p>
              )}
            </div>
            {unlinkConfirmOpen && (
              <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-2">
                <p className="text-sm font-medium text-destructive">How do you want to unlink?</p>
                <p className="text-xs text-muted-foreground">Removes from StayFit only, or also removes the user slot from the device. The fingerprint itself must be manually deleted from the device if needed.</p>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" className="flex-1 text-xs"
                    disabled={linkDeviceMutation.isPending}
                    onClick={() => { setUnlinkConfirmOpen(false); linkDeviceMutation.mutate({ id: memberToLink.id, deviceUserId: '' }) }}>
                    StayFit only
                  </Button>
                  <Button size="sm" variant="destructive" className="flex-1 text-xs"
                    disabled={linkDeviceMutation.isPending}
                    onClick={() => { setUnlinkConfirmOpen(false); membersApi.deleteDeviceUser(memberToLink.device_user_id!).catch(() => {}); linkDeviceMutation.mutate({ id: memberToLink.id, deviceUserId: '' }) }}>
                    StayFit + Device slot
                  </Button>
                  <Button size="sm" variant="ghost" className="text-xs px-2"
                    onClick={() => setUnlinkConfirmOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setLinkDeviceOpen(false); setMemberToLink(null); setEnrollPending(false); setEnrollDeviceId(null); setUnlinkConfirmOpen(false) }}>
                Cancel
              </Button>
              {memberToLink.device_user_id && !unlinkConfirmOpen && (
                <Button variant="ghost" className="text-destructive hover:text-destructive"
                  disabled={linkDeviceMutation.isPending}
                  onClick={() => setUnlinkConfirmOpen(true)}>
                  <Unlink className="h-4 w-4 mr-1" /> Unlink
                </Button>
              )}
              <Button className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
                disabled={linkDeviceMutation.isPending || !linkDeviceInput.trim()}
                onClick={() => linkDeviceMutation.mutate({ id: memberToLink.id, deviceUserId: linkDeviceInput.trim() })}>
                {linkDeviceMutation.isPending ? 'Saving…' : <><Link className="h-4 w-4 mr-1" /> Link</>}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
