import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { PageHeader } from '@/components/shared/PageHeader'
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
import { QUERY_KEYS } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import type { Member } from '@/types/member.types'
import type { Facility } from '@/types/facility.types'
import { subscriptionsApi } from '@/api/subscriptions.api'
import type { Subscription } from '@/types/subscription.types'
import { Plus, Pencil, Trash2, Snowflake, Sun, Eye, Users, UserCheck, UserX, Clock, Bell, CheckCircle2, Download } from 'lucide-react'
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
        <Input id="cf_phone" {...register('phone')} placeholder="+91 98765 43210" />
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
          <Input id="ef_phone" {...register('phone')} />
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
          <Input id="ef_ec_phone" {...register('emergency_contact_phone')} placeholder="Phone number" />
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

// ─── Main Page ───────────────────────────────────────────────────────────────

type DrawerMode = 'create' | 'edit'

export default function MembersListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState('')
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

  // Tab state
  const [activeTab, setActiveTab] = useState<'members' | 'expiry'>('members')

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
    queryKey: QUERY_KEYS.members({ page, per_page: PER_PAGE, search: debouncedSearch, status }),
    queryFn: () =>
      membersApi.list({ page, per_page: PER_PAGE, search: debouncedSearch || undefined, status: status || undefined }),
  })

  const { data: facilitiesData } = useQuery({
    queryKey: QUERY_KEYS.facilities,
    queryFn: () => facilitiesApi.list(),
    staleTime: 5 * 60 * 1000,
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
    try {
      // Fetch all members (up to 10000)
      const result = await membersApi.list({ page: 1, per_page: 10000, search: debouncedSearch || undefined, status: status || undefined })
      const all: Member[] = (result as { members?: Member[] })?.members ?? []

      const rows = all.map((m) => ({
        'Member Code': m.member_code ?? '',
        'First Name': m.user?.first_name ?? '',
        'Last Name': m.user?.last_name ?? '',
        'Email': m.user?.email ?? '',
        'Phone': m.user?.phone ?? '',
        'Status': m.membership_status ?? '',
        'Joined Date': m.joined_date ? m.joined_date.slice(0, 10) : '',
      }))

      const ws = XLSX.utils.json_to_sheet(rows)
      ws['!cols'] = [14, 14, 14, 28, 16, 10, 14].map(w => ({ wch: w }))
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Members')
      XLSX.writeFile(wb, `members-${new Date().toISOString().slice(0, 10)}.xlsx`)
      toast.success('Excel downloaded')
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
        subtitle="Manage your gym members"

        icon={<Users className="h-6 w-6 text-white" />}
        stats={[
          { label: 'Total Members',  value: statTotal,   sub: 'all time',          icon: <Users     className="h-4 w-4 text-white" /> },
          { label: 'Active',         value: statActive,  sub: 'currently active',  icon: <UserCheck className="h-4 w-4 text-white" /> },
          { label: 'Frozen',         value: statFrozen,  sub: 'on hold',           icon: <Snowflake className="h-4 w-4 text-white" /> },
          { label: 'Expired',        value: statExpired, sub: 'needs renewal',     icon: <Clock     className="h-4 w-4 text-white" /> },
          { label: 'New This Month', value: '—',         sub: 'recent sign-ups',   icon: <UserX     className="h-4 w-4 text-white" /> },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleDownloadExcel} disabled={isDownloading} title="Download Excel">
              <Download className="h-4 w-4" />
              {isDownloading ? 'Downloading...' : 'Export'}
            </Button>
            <Button onClick={() => navigate('/members/new')}>
              <Plus className="h-4 w-4" />
              Add Member
            </Button>
          </div>
        }
      />


      {/* ── Tab switcher ── */}
      <div className="flex border-b-2 border-border mb-5">
        <button
          onClick={() => setActiveTab('members')}
          className={`relative flex items-center gap-2.5 px-8 py-4 text-sm font-semibold transition-all duration-150 focus:outline-none ${
            activeTab === 'members'
              ? 'text-primary'
              : 'text-muted-foreground hover:text-gray-800'
          }`}
        >
          <Users className="h-4 w-4" />
          All Members
          {total > 0 && (
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
              activeTab === 'members' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
            }`}>
              {total}
            </span>
          )}
          {activeTab === 'members' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('expiry')}
          className={`relative flex items-center gap-2.5 px-8 py-4 text-sm font-semibold transition-all duration-150 focus:outline-none ${
            activeTab === 'expiry'
              ? criticalSubs.length > 0 ? 'text-red-600' : 'text-amber-600'
              : 'text-muted-foreground hover:text-gray-800'
          }`}
        >
          <Bell className={`h-4 w-4 ${criticalSubs.length > 0 && activeTab === 'expiry' ? 'animate-[wiggle_1s_ease-in-out_infinite]' : ''}`} />
          Membership Expiry Alerts
          {expiringSubs.length > 0 && (
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
              activeTab === 'expiry'
                ? criticalSubs.length > 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                : criticalSubs.length > 0 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
            }`}>
              {expiringSubs.length}
            </span>
          )}
          {activeTab === 'expiry' && (
            <span className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full ${criticalSubs.length > 0 ? 'bg-red-500' : 'bg-amber-500'}`} />
          )}
        </button>
      </div>

      {/* ── Tab: All Members ── */}
      <div className={activeTab === 'members' ? '' : 'hidden'}>
          <Card className="border-0 shadow-md">
            <CardContent className="p-0">
              {/* ── Toolbar ── */}
              <div className="flex items-center gap-4 px-4 py-3 border-b border-border/60">
                {/* Status tabs */}
                <div className="flex items-center gap-1">
                  {([
                    { value: '',        label: 'All Statuses', count: statTotal   },
                    { value: 'active',  label: 'Active',       count: statActive  },
                    { value: 'frozen',  label: 'Frozen',       count: statFrozen  },
                    { value: 'expired', label: 'Expired',      count: statExpired },
                  ] as const).map(tab => {
                    const isActive = status === tab.value
                    return (
                      <button
                        key={tab.value}
                        onClick={() => { setStatus(tab.value); setPage(1) }}
                        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-normal tracking-wide transition-all duration-150 ${
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-gray-500 hover:text-gray-800 hover:bg-black/5'
                        }`}
                      >
                        {tab.label}
                        <span className={`min-w-[20px] text-center rounded-full text-[11px] font-semibold px-1.5 py-0.5 ${
                          isActive ? 'bg-primary/15 text-primary' : 'bg-black/8 text-gray-500'
                        }`}>
                          {tab.count}
                        </span>
                      </button>
                    )
                  })}
                </div>
                {/* Search */}
                <Input
                  placeholder="Search by name, email or mobile..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="max-w-xs h-8 text-sm border-0 shadow-[0_2px_12px_rgba(0,0,0,0.12)] focus-visible:ring-1 ml-auto"
                />
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
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary"
                                title="View member" onClick={(e) => { e.stopPropagation(); navigate(`/members/${member.id}`) }}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-blue-500"
                                title="Edit member" onClick={(e) => { e.stopPropagation(); openEditDrawer(member) }}>
                                <Pencil className="h-4 w-4" />
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
                            {phone && (
                              <a href={whatsappUrl(phone, name, days, sub.plan?.name ?? 'gym')}
                                target="_blank" rel="noopener noreferrer"
                                title="Send WhatsApp renewal reminder"
                                className="flex items-center justify-center h-7 w-7 rounded-full bg-green-50 hover:bg-green-100 transition-colors border border-green-200">
                                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-green-600" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                </svg>
                              </a>
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
    </div>
  )
}
