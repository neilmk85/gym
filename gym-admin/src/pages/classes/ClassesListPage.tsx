import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { FormDrawer } from '@/components/shared/FormDrawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SearchInput } from '@/components/shared/SearchInput'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { classesApi } from '@/api/classes.api'
import { trainersApi } from '@/api/trainers.api'
import { facilitiesApi } from '@/api/facilities.api'
import { QUERY_KEYS } from '@/lib/constants'
import { formatDateTime, formatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import {
  Plus, Pencil, X, CalendarDays, Users, Clock,
  CheckCircle2, XCircle, ChevronLeft, ChevronRight,
  Zap, Ban, ToggleRight, ToggleLeft,
} from 'lucide-react'
import type { GymClass } from '@/types/class.types'
import type { TrainerProfile } from '@/types/trainer.types'
import type { Facility } from '@/types/facility.types'

const PER_PAGE = 20

const CLASS_TYPES = ['yoga', 'pilates', 'crossfit', 'cycling', 'boxing', 'swimming', 'hiit', 'other'] as const
const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

// ─── Zod schemas ────────────────────────────────────────────────────────────

const createSchema = z.object({
  facility_id: z.string().min(1, 'Facility is required'),
  trainer_id: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  class_type: z.enum(CLASS_TYPES, { required_error: 'Class type is required' }),
  start_time: z.string().min(1, 'Start time is required'),
  duration_mins: z.coerce.number().int().positive('Must be a positive number'),
  max_capacity: z.coerce.number().int().positive('Must be a positive number'),
  is_free: z.boolean(),
  price: z.coerce.number().min(0).optional(),
  is_recurring: z.boolean(),
  recurring_days: z.array(z.enum(DAYS_OF_WEEK)).optional(),
  recurring_until: z.string().optional(),
}).refine((d) => d.is_free || (d.price !== undefined && d.price >= 0), {
  message: 'Price is required when class is not free',
  path: ['price'],
}).refine((d) => !d.is_recurring || (d.recurring_days && d.recurring_days.length > 0), {
  message: 'Select at least one recurring day',
  path: ['recurring_days'],
}).refine((d) => !d.is_recurring || (d.recurring_until && d.recurring_until.length > 0), {
  message: 'Recurring until date is required',
  path: ['recurring_until'],
})

const editSchema = z.object({
  trainer_id: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  class_type: z.enum(CLASS_TYPES, { required_error: 'Class type is required' }),
  start_time: z.string().min(1, 'Start time is required'),
  duration_mins: z.coerce.number().int().positive('Must be a positive number'),
  max_capacity: z.coerce.number().int().positive('Must be a positive number'),
  is_free: z.boolean(),
  price: z.coerce.number().min(0).optional(),
}).refine((d) => d.is_free || (d.price !== undefined && d.price >= 0), {
  message: 'Price is required when class is not free',
  path: ['price'],
})

type CreateFormValues = z.infer<typeof createSchema>
type EditFormValues = z.infer<typeof editSchema>

// ─── Helpers ────────────────────────────────────────────────────────────────

function isoToDatetimeLocal(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ─── Create Form ─────────────────────────────────────────────────────────────

interface CreateFormProps {
  trainers: TrainerProfile[]
  facilities: Facility[]
  onSubmit: (values: CreateFormValues) => void
  isLoading: boolean
  onClose: () => void
}

function CreateClassForm({ trainers, facilities, onSubmit, isLoading, onClose }: CreateFormProps) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      is_free: false,
      is_recurring: false,
      recurring_days: [],
    },
  })

  const isFree = watch('is_free')
  const isRecurring = watch('is_recurring')
  const recurringDays = watch('recurring_days') ?? []

  return (
    <form id="create-class-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Facility */}
      <div className="space-y-1.5">
        <Label>Facility *</Label>
        <Controller
          name="facility_id"
          control={control}
          render={({ field }) => (
            <select value={field.value} onChange={e => field.onChange(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-teal-400">
              <option value="">Select facility…</option>
              {facilities.map((f) => (
                <option key={f.id} value={String(f.id)}>{f.name}</option>
              ))}
            </select>
          )}
        />
        {errors.facility_id && <p className="text-xs text-destructive">{errors.facility_id.message}</p>}
      </div>

      {/* Trainer */}
      <div className="space-y-1.5">
        <Label>Trainer</Label>
        <Controller
          name="trainer_id"
          control={control}
          render={({ field }) => (
            <select value={field.value ?? ''} onChange={e => field.onChange(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-teal-400">
              <option value="none">No trainer (optional)</option>
              {trainers.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.user ? `${t.user.first_name} ${t.user.last_name}` : `Trainer ${t.id}`} ({t.id})
                </option>
              ))}
            </select>
          )}
        />
      </div>

      {/* Name */}
      <div className="space-y-1.5">
        <Label>Name *</Label>
        <Input {...register('name')} placeholder="e.g. Morning Yoga" />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea {...register('description')} placeholder="Brief description…" rows={3} />
      </div>

      {/* Class type */}
      <div className="space-y-1.5">
        <Label>Class Type *</Label>
        <Controller
          name="class_type"
          control={control}
          render={({ field }) => (
            <select value={field.value} onChange={e => field.onChange(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-teal-400">
              <option value="">Select type…</option>
              {CLASS_TYPES.map((t) => (
                <option key={t} value={t} className="capitalize">{t}</option>
              ))}
            </select>
          )}
        />
        {errors.class_type && <p className="text-xs text-destructive">{errors.class_type.message}</p>}
      </div>

      {/* Start time */}
      <div className="space-y-1.5">
        <Label>Start Time *</Label>
        <Input type="datetime-local" {...register('start_time')} />
        {errors.start_time && <p className="text-xs text-destructive">{errors.start_time.message}</p>}
      </div>

      {/* Duration & capacity */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Duration (mins) *</Label>
          <Input type="number" {...register('duration_mins')} placeholder="60" min={1} />
          {errors.duration_mins && <p className="text-xs text-destructive">{errors.duration_mins.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Max Capacity *</Label>
          <Input type="number" {...register('max_capacity')} placeholder="20" min={1} />
          {errors.max_capacity && <p className="text-xs text-destructive">{errors.max_capacity.message}</p>}
        </div>
      </div>

      {/* Is free */}
      <div className="flex items-center gap-2">
        <input type="checkbox" id="create-is-free" {...register('is_free')} className="h-4 w-4 rounded border" />
        <Label htmlFor="create-is-free">Free class</Label>
      </div>

      {/* Price (when not free) */}
      {!isFree && (
        <div className="space-y-1.5">
          <Label>Price *</Label>
          <Input type="number" step="0.01" {...register('price')} placeholder="0.00" min={0} />
          {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
        </div>
      )}

      {/* Is recurring */}
      <div className="flex items-center gap-2">
        <input type="checkbox" id="create-is-recurring" {...register('is_recurring')} className="h-4 w-4 rounded border" />
        <Label htmlFor="create-is-recurring">Recurring class</Label>
      </div>

      {/* Recurring options */}
      {isRecurring && (
        <div className="space-y-3 pl-2 border-l-2 border-muted ml-1">
          <div className="space-y-1.5">
            <Label>Recurring Days *</Label>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map((day) => (
                <label key={day} className="flex items-center gap-1.5 text-sm cursor-pointer capitalize">
                  <Controller
                    name="recurring_days"
                    control={control}
                    render={({ field }) => (
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border"
                        checked={(field.value ?? []).includes(day)}
                        onChange={(e) => {
                          const current = field.value ?? []
                          field.onChange(
                            e.target.checked ? [...current, day] : current.filter((d) => d !== day)
                          )
                        }}
                      />
                    )}
                  />
                  {day}
                </label>
              ))}
            </div>
            {errors.recurring_days && <p className="text-xs text-destructive">{errors.recurring_days.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Recurring Until *</Label>
            <Input type="date" {...register('recurring_until')} />
            {errors.recurring_until && <p className="text-xs text-destructive">{errors.recurring_until.message}</p>}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
        <Button type="submit" loading={isLoading}>Create Class</Button>
      </div>
    </form>
  )
}

// ─── Edit Form ────────────────────────────────────────────────────────────────

interface EditFormProps {
  gymClass: GymClass
  trainers: TrainerProfile[]
  onSubmit: (values: EditFormValues) => void
  isLoading: boolean
  onClose: () => void
}

function EditClassForm({ gymClass, trainers, onSubmit, isLoading, onClose }: EditFormProps) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      trainer_id: gymClass.trainer_id ? String(gymClass.trainer_id) : 'none',
      name: gymClass.name,
      description: '',
      class_type: gymClass.class_type as typeof CLASS_TYPES[number],
      start_time: isoToDatetimeLocal(gymClass.start_time),
      duration_mins: gymClass.duration_mins,
      max_capacity: gymClass.max_capacity,
      is_free: gymClass.is_free,
      price: 0,
    },
  })

  const isFree = watch('is_free')

  return (
    <form id="edit-class-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Trainer */}
      <div className="space-y-1.5">
        <Label>Trainer</Label>
        <Controller
          name="trainer_id"
          control={control}
          render={({ field }) => (
            <select value={field.value ?? ''} onChange={e => field.onChange(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-teal-400">
              <option value="none">No trainer (optional)</option>
              {trainers.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.user ? `${t.user.first_name} ${t.user.last_name}` : `Trainer ${t.id}`} ({t.id})
                </option>
              ))}
            </select>
          )}
        />
      </div>

      {/* Name */}
      <div className="space-y-1.5">
        <Label>Name *</Label>
        <Input {...register('name')} />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea {...register('description')} rows={3} />
      </div>

      {/* Class type */}
      <div className="space-y-1.5">
        <Label>Class Type *</Label>
        <Controller
          name="class_type"
          control={control}
          render={({ field }) => (
            <select value={field.value} onChange={e => field.onChange(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-teal-400">
              <option value="">Select type…</option>
              {CLASS_TYPES.map((t) => (
                <option key={t} value={t} className="capitalize">{t}</option>
              ))}
            </select>
          )}
        />
        {errors.class_type && <p className="text-xs text-destructive">{errors.class_type.message}</p>}
      </div>

      {/* Start time */}
      <div className="space-y-1.5">
        <Label>Start Time *</Label>
        <Input type="datetime-local" {...register('start_time')} />
        {errors.start_time && <p className="text-xs text-destructive">{errors.start_time.message}</p>}
      </div>

      {/* Duration & capacity */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Duration (mins) *</Label>
          <Input type="number" {...register('duration_mins')} min={1} />
          {errors.duration_mins && <p className="text-xs text-destructive">{errors.duration_mins.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Max Capacity *</Label>
          <Input type="number" {...register('max_capacity')} min={1} />
          {errors.max_capacity && <p className="text-xs text-destructive">{errors.max_capacity.message}</p>}
        </div>
      </div>

      {/* Is free */}
      <div className="flex items-center gap-2">
        <input type="checkbox" id="edit-is-free" {...register('is_free')} className="h-4 w-4 rounded border" />
        <Label htmlFor="edit-is-free">Free class</Label>
      </div>

      {!isFree && (
        <div className="space-y-1.5">
          <Label>Price *</Label>
          <Input type="number" step="0.01" {...register('price')} placeholder="0.00" min={0} />
          {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
        <Button type="submit" loading={isLoading}>Save Changes</Button>
      </div>
    </form>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ClassesListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const canManage = user?.role === 'admin' || user?.role === 'manager'

  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [nameSearch, setNameSearch] = useState('')

  // Drawer / modal state
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<GymClass | null>(null)
  const [cancelTarget, setCancelTarget] = useState<GymClass | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  // ── Queries ────────────────────────────────────────────────────────────────

  const queryParams = {
    page,
    per_page: PER_PAGE,
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    ...(nameSearch.trim() ? { name: nameSearch.trim() } : {}),
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: QUERY_KEYS.classes(queryParams),
    queryFn: () => classesApi.list(queryParams),
  })

  const { data: trainersData } = useQuery({
    queryKey: QUERY_KEYS.trainers,
    queryFn: () => trainersApi.list(true),
  })

  const { data: facilitiesData } = useQuery({
    queryKey: QUERY_KEYS.facilities,
    queryFn: () => facilitiesApi.list(),
  })

  const classes = (data as { classes?: GymClass[] })?.classes
    ?? (data as { items?: GymClass[] })?.items
    ?? []
  const meta = (data as { meta?: { total?: number; per_page?: number } })?.meta
  const total = meta?.total ?? 0
  const perPage = meta?.per_page ?? PER_PAGE

  const trainers: TrainerProfile[] =
    (trainersData as { trainers?: TrainerProfile[] })?.trainers ?? []
  const activeTrainers = trainers.filter((t) => t.is_active)

  const facilities: Facility[] =
    (facilitiesData as { facilities?: Facility[] })?.facilities ?? []

  // Build a Map<trainerId, displayName> for the table
  const trainerMap = new Map<number, string>(
    trainers.map((t) => [
      t.id,
      t.user ? `${t.user.first_name} ${t.user.last_name}` : `Trainer ${t.id}`,
    ])
  )

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => classesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] })
      toast.success('Class created successfully')
      setCreateOpen(false)
    },
    onError: () => toast.error('Failed to create class'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) =>
      classesApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] })
      toast.success('Class updated successfully')
      setEditTarget(null)
    },
    onError: () => toast.error('Failed to update class'),
  })

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      classesApi.cancel(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] })
      toast.success('Class cancelled')
      setCancelTarget(null)
      setCancelReason('')
    },
    onError: () => toast.error('Failed to cancel class'),
  })

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleCreate(values: CreateFormValues) {
    const trainerId =
      values.trainer_id && values.trainer_id !== 'none'
        ? Number(values.trainer_id)
        : null

    const payload: Record<string, unknown> = {
      facility_id: Number(values.facility_id),
      trainer_id: trainerId,
      name: values.name,
      description: values.description ?? '',
      class_type: values.class_type,
      duration_mins: values.duration_mins,
      max_capacity: values.max_capacity,
      start_time: new Date(values.start_time).toISOString(),
      is_free: values.is_free,
      price: values.is_free ? 0 : (values.price ?? 0),
      is_recurring: values.is_recurring,
    }

    if (values.is_recurring) {
      payload.recurring_days = values.recurring_days
      payload.recurring_until = values.recurring_until
    }

    createMutation.mutate(payload)
  }

  function handleEdit(values: EditFormValues) {
    if (!editTarget) return

    const trainerId =
      values.trainer_id && values.trainer_id !== 'none'
        ? Number(values.trainer_id)
        : null

    const payload: Record<string, unknown> = {
      trainer_id: trainerId,
      name: values.name,
      description: values.description ?? '',
      class_type: values.class_type,
      duration_mins: values.duration_mins,
      max_capacity: values.max_capacity,
      start_time: new Date(values.start_time).toISOString(),
      is_free: values.is_free,
      price: values.is_free ? 0 : (values.price ?? 0),
    }

    updateMutation.mutate({ id: editTarget.id, payload })
  }

  function handleCancelConfirm() {
    if (!cancelTarget) return
    cancelMutation.mutate({ id: cancelTarget.id, reason: cancelReason })
  }

  // ── Filter reset on search change ──────────────────────────────────────────

  function handleSearchChange(v: string) {
    setNameSearch(v)
    setPage(1)
  }

  function handleStatusChange(v: string) {
    setStatusFilter(v)
    setPage(1)
  }

  // ── Derived stats ──────────────────────────────────────────────────────────

  const totalEnrolled  = classes.reduce((s, c) => s + (c.current_bookings ?? 0), 0)
  const totalCapacity  = classes.reduce((s, c) => s + (c.max_capacity ?? 0), 0)
  const countScheduled = classes.filter(c => c.status === 'scheduled').length
  const countOngoing   = classes.filter(c => c.status === 'ongoing').length
  const countDone      = classes.filter(c => c.status === 'completed').length
  const countCancelled = classes.filter(c => c.status === 'cancelled').length

  const STATUS_CFG: Record<string, { label: string; cls: string }> = {
    scheduled:  { label: 'Scheduled',  cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
    ongoing:    { label: 'Ongoing',    cls: 'bg-green-50 text-green-700 border border-green-200' },
    completed:  { label: 'Completed',  cls: 'bg-gray-100 text-gray-600 border border-gray-200' },
    cancelled:  { label: 'Cancelled',  cls: 'bg-red-50 text-red-600 border border-red-200' },
  }

  const TYPE_COLORS: Record<string, string> = {
    yoga:     'bg-purple-100 text-purple-700',
    pilates:  'bg-pink-100 text-pink-700',
    crossfit: 'bg-orange-100 text-orange-700',
    cycling:  'bg-blue-100 text-blue-700',
    boxing:   'bg-red-100 text-red-700',
    swimming: 'bg-cyan-100 text-cyan-700',
    hiit:     'bg-yellow-100 text-yellow-700',
    other:    'bg-gray-100 text-gray-600',
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Edge-to-edge header ── */}
      <div className="relative overflow-hidden -mx-6 -mt-6 bg-gradient-to-r from-teal-600 via-cyan-600 to-sky-600 px-6 py-6 text-white">
        <div className="relative">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <CalendarDays className="w-6 h-6 opacity-90" />
                <h1 className="text-xl font-bold">Classes</h1>
              </div>
              <p className="text-sm text-white/80 max-w-2xl">
                All gym classes in one place — scheduled sessions, recurring programs, trainer assignments, and live enrollment counts.
              </p>
            </div>
            {canManage && (
              <Button size="sm"
                className="shrink-0 bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm"
                onClick={() => navigate('/classes/new')}>
                <Plus className="h-4 w-4 mr-1" /> New Class
              </Button>
            )}
          </div>

          {/* ── Stat chips ── */}
          {!isLoading && (
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1 text-xs font-medium">
                <CalendarDays className="w-3.5 h-3.5" /> {total} total
              </div>
              <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1 text-xs font-medium">
                <Zap className="w-3.5 h-3.5 text-yellow-200" />
                <span>{countScheduled} scheduled</span>
              </div>
              {countOngoing > 0 && (
                <div className="flex items-center gap-1.5 bg-green-400/30 backdrop-blur-sm border border-green-300/40 rounded-full px-3 py-1 text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
                  {countOngoing} ongoing now
                </div>
              )}
              <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1 text-xs font-medium">
                <Users className="w-3.5 h-3.5" /> {totalEnrolled}/{totalCapacity} seats filled
              </div>
              <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1 text-xs font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-200" /> {countDone} completed
              </div>
              {countCancelled > 0 && (
                <div className="flex items-center gap-1.5 bg-red-400/20 backdrop-blur-sm border border-red-300/30 rounded-full px-3 py-1 text-xs font-medium">
                  <XCircle className="w-3.5 h-3.5 text-red-200" /> {countCancelled} cancelled
                </div>
              )}
            </div>
          )}
        </div>
        <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute -right-2 -bottom-8 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
      </div>

      {isError && <p className="text-sm text-destructive">Failed to load classes. Please try again.</p>}

      {/* ── Table card ── */}
      <Card className="shadow-lg shadow-gray-200/80 rounded-xl overflow-hidden">

        {/* Search + filter bar */}
        <div className="flex items-center justify-between gap-4 px-4 py-3 border-b bg-teal-50/60">
          <p className="font-medium text-sm text-teal-700 whitespace-nowrap flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4" />
            {isLoading ? 'Loading…' : `${classes.length} class${classes.length !== 1 ? 'es' : ''}`}
          </p>
          <div className="flex items-center gap-2 flex-1 justify-end">
            <SearchInput
              placeholder="Search by name…"
              value={nameSearch}
              onChange={handleSearchChange}
              className="w-56"
            />
            <select value={statusFilter} onChange={e => handleStatusChange(e.target.value)}
              className="h-9 w-40 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-teal-400">
              <option value="all">All statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gradient-to-r from-teal-50 via-cyan-50 to-sky-50">
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Class</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700">ID</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Trainer</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Timing</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Enrolled</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Price</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Status</th>
                {canManage && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {[1,2,3,4,5,6,7,8].map(c => (
                    <td key={c} className="px-4 py-3">
                      <div className="h-4 bg-gray-100 rounded animate-pulse w-20" />
                    </td>
                  ))}
                </tr>
              ))}

              {!isLoading && classes.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 8 : 7} className="px-4 py-14 text-center">
                    <CalendarDays className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-muted-foreground text-sm font-medium">No classes found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {nameSearch || statusFilter !== 'all' ? 'Try adjusting your search or filter.' : 'Click "New Class" to schedule the first one.'}
                    </p>
                  </td>
                </tr>
              )}

              {!isLoading && classes.map((cls) => {
                const trainerName = cls.trainer_id
                  ? (trainerMap.get(cls.trainer_id) ?? `Trainer ${cls.trainer_id}`)
                  : '—'
                const enrolled   = cls.current_bookings ?? 0
                const capacity   = cls.max_capacity ?? 0
                const fillPct    = capacity > 0 ? Math.min(100, Math.round((enrolled / capacity) * 100)) : 0
                const isFull     = fillPct >= 100
                const desc       = (cls as any).description as string | undefined
                const price      = (cls as any).price as number | undefined
                const statusCfg  = STATUS_CFG[cls.status] ?? { label: cls.status, cls: 'bg-gray-100 text-gray-600' }

                return (
                  <tr key={cls.id}
                    className="hover:bg-teal-50/40 cursor-pointer transition-colors"
                    onClick={() => navigate(`/classes/${cls.id}`)}>

                    {/* Class name + type */}
                    <td className="px-4 py-3">
                      <p className="font-medium leading-tight">{cls.name}</p>
                      {desc && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 max-w-[200px]">{desc}</p>}
                      <Badge className={`mt-1 text-[10px] capitalize px-1.5 py-0 ${TYPE_COLORS[cls.class_type] ?? TYPE_COLORS.other}`}>
                        {cls.class_type}
                      </Badge>
                    </td>

                    {/* ID */}
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">#{cls.id}</td>

                    {/* Trainer */}
                    <td className="px-4 py-3 text-muted-foreground">{trainerName}</td>

                    {/* Timing */}
                    <td className="px-4 py-3">
                      <p className="text-sm">{cls.start_time ? formatDateTime(cls.start_time) : '—'}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" /> {cls.duration_mins} min
                      </p>
                    </td>

                    {/* Enrolled + fill bar */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium text-sm ${isFull ? 'text-red-600' : ''}`}>
                          {enrolled}/{capacity}
                        </span>
                        <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isFull ? 'bg-red-500' : fillPct >= 75 ? 'bg-orange-400' : 'bg-teal-500'}`}
                            style={{ width: `${fillPct}%` }}
                          />
                        </div>
                      </div>
                      {isFull && <p className="text-[10px] text-red-500 font-medium mt-0.5">Full</p>}
                    </td>

                    {/* Price */}
                    <td className="px-4 py-3">
                      {cls.is_free
                        ? <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">Free</span>
                        : <span className="font-medium">{formatCurrency(price ?? 0)}</span>
                      }
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${statusCfg.cls}`}>
                        {statusCfg.label}
                      </span>
                      {cls.is_active === false && (
                        <p className="text-[10px] text-gray-400 mt-0.5">Inactive</p>
                      )}
                    </td>

                    {/* Actions */}
                    {canManage && (
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-end">
                          {/* Edit */}
                          {cls.status !== 'cancelled' && cls.status !== 'completed' && (
                            <button title="Edit"
                              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              onClick={() => setEditTarget(cls)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {/* Activate / Deactivate */}
                          {cls.status !== 'cancelled' && cls.status !== 'completed' && (
                            cls.is_active !== false
                              ? <button title="Deactivate"
                                  className="p-1.5 rounded-md text-muted-foreground hover:text-orange-600 hover:bg-orange-50 transition-colors"
                                  onClick={() => updateMutation.mutate({ id: cls.id, payload: { is_active: false } })}>
                                  <ToggleLeft className="w-4 h-4" />
                                </button>
                              : <button title="Activate"
                                  className="p-1.5 rounded-md text-muted-foreground hover:text-teal-600 hover:bg-teal-50 transition-colors"
                                  onClick={() => updateMutation.mutate({ id: cls.id, payload: { is_active: true } })}>
                                  <ToggleRight className="w-4 h-4" />
                                </button>
                          )}
                          {/* Cancel */}
                          {cls.status === 'scheduled' && (
                            <button title="Cancel class"
                              className="p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                              onClick={() => { setCancelTarget(cls); setCancelReason('') }}>
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {!isLoading && total > 0 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t bg-muted/20 text-xs text-muted-foreground">
            <span>
              Showing {Math.min((page - 1) * perPage + 1, total)}–{Math.min(page * perPage, total)} of {total} classes
            </span>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7" title="Previous page"
                onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <span className="flex items-center px-2 font-medium">Page {page}</span>
              <Button variant="outline" size="icon" className="h-7 w-7" title="Next page"
                onClick={() => setPage(p => p + 1)} disabled={page * perPage >= total}>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Create drawer */}
      <FormDrawer
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Class"
        description="Fill in the details to schedule a new gym class."
      >
        <CreateClassForm
          trainers={activeTrainers}
          facilities={facilities}
          onSubmit={handleCreate}
          isLoading={createMutation.isPending}
          onClose={() => setCreateOpen(false)}
        />
      </FormDrawer>

      {/* Edit drawer */}
      <FormDrawer
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit Class"
        description="Update the class details."
      >
        {editTarget && (
          <EditClassForm
            gymClass={editTarget}
            trainers={activeTrainers}
            onSubmit={handleEdit}
            isLoading={updateMutation.isPending}
            onClose={() => setEditTarget(null)}
          />
        )}
      </FormDrawer>

      {/* Cancel dialog with reason input */}
      {cancelTarget && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
          onClick={() => {
            setCancelTarget(null)
            setCancelReason('')
          }}
        >
          <div
            className="bg-background rounded-lg shadow-lg p-6 w-full max-w-md space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h2 className="text-lg font-semibold">Cancel Class</h2>
              <p className="text-sm text-muted-foreground mt-1">
                You are about to cancel <span className="font-medium">{cancelTarget.name}</span>.
                This action cannot be undone.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cancel-reason">Reason</Label>
              <Textarea
                id="cancel-reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Provide a reason for cancellation…"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCancelTarget(null)
                  setCancelReason('')
                }}
                disabled={cancelMutation.isPending}
              >
                Keep Class
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancelConfirm}
                disabled={cancelMutation.isPending || !cancelReason.trim()}
              >
                {cancelMutation.isPending ? 'Cancelling…' : 'Cancel Class'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
