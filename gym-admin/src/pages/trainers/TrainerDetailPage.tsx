import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { FormDrawer } from '@/components/shared/FormDrawer'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { AvatarWithFallback } from '@/components/shared/AvatarWithFallback'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { trainersApi } from '@/api/trainers.api'
import { facilitiesApi } from '@/api/facilities.api'
import { QUERY_KEYS } from '@/lib/constants'
import { formatCurrency, formatDate } from '@/lib/utils'
import { getTrainerSalary } from '@/lib/service-types'
import { useAuthStore } from '@/store/auth.store'
import type { TrainerProfile, TrainerSchedule } from '@/types/trainer.types'
import {
  ArrowLeft,
  Pencil,
  UserX,
  Clock,
  DollarSign,
  Users,
  Award,
  BookOpen,
  Mail,
  Phone,
  Building,
  X,
  CalendarDays,
  Plus,
  Trash2,
  Coffee,
  CalendarClock,
  Moon,
} from 'lucide-react'
import { KeyboardEvent } from 'react'

// ─── Zod Schema ──────────────────────────────────────────────────────────────

const editSchema = z.object({
  facility_id: z.coerce.number().min(1, 'Facility is required').optional(),
  bio: z.string().optional(),
  experience_years: z.coerce.number().min(0).max(50).optional(),
  hourly_rate: z.coerce.number().min(0).optional(),
  max_clients_per_day: z.coerce.number().min(1).max(100).optional(),
  specializations: z.array(z.string()),
  certifications: z.array(z.string()),
})
type EditFormValues = z.infer<typeof editSchema>

// ─── TagInput ────────────────────────────────────────────────────────────────

function TagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
}) {
  const [inputVal, setInputVal] = useState('')

  const addTag = () => {
    const tag = inputVal.trim()
    if (tag && !value.includes(tag)) onChange([...value, tag])
    setInputVal('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() }
    else if (e.key === 'Backspace' && !inputVal && value.length > 0) onChange(value.slice(0, -1))
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addTag}
          placeholder={placeholder ?? 'Type and press Enter'}
          className="flex-1"
        />
        <Button type="button" variant="outline" size="sm" onClick={addTag}>Add</Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs gap-1">
              {tag}
              <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))} className="ml-0.5 hover:text-destructive">
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Edit Form ────────────────────────────────────────────────────────────────

function EditTrainerForm({ trainer, onSuccess }: { trainer: TrainerProfile; onSuccess: () => void }) {
  const queryClient = useQueryClient()

  const { data: facilitiesData } = useQuery({
    queryKey: QUERY_KEYS.facilities,
    queryFn: () => facilitiesApi.list(),
  })
  const facilities = facilitiesData?.facilities ?? []

  const { register, control, handleSubmit, formState: { errors } } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      facility_id: trainer.facility_id,
      bio: trainer.bio ?? '',
      experience_years: trainer.experience_years ?? 0,
      hourly_rate: trainer.hourly_rate ?? 0,
      max_clients_per_day: trainer.max_clients_per_day ?? 10,
      specializations: trainer.specializations ?? [],
      certifications: trainer.certifications ?? [],
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: EditFormValues) => trainersApi.update(trainer.id, data as Record<string, unknown>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.trainers })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.trainer(trainer.id) })
      toast.success('Trainer updated successfully')
      onSuccess()
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to update trainer'),
  })

  return (
    <form onSubmit={handleSubmit((d) => updateMutation.mutate(d))} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Facility</Label>
        <Select {...register('facility_id')} className="w-full">
          <option value="">Select facility…</option>
          {facilities.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </Select>
        {errors.facility_id && <p className="text-xs text-destructive">{errors.facility_id.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label>Bio</Label>
        <Textarea {...register('bio')} placeholder="Short trainer bio…" rows={4} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Experience (yrs)</Label>
          <Input {...register('experience_years')} type="number" min={0} />
          {errors.experience_years && <p className="text-xs text-destructive">{errors.experience_years.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Salary (₹)</Label>
          <Input {...register('hourly_rate')} type="number" min={0} step="1" />
          {errors.hourly_rate && <p className="text-xs text-destructive">{errors.hourly_rate.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Max Clients/Day</Label>
          <Input {...register('max_clients_per_day')} type="number" min={1} />
          {errors.max_clients_per_day && <p className="text-xs text-destructive">{errors.max_clients_per_day.message}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Specializations</Label>
        <Controller
          control={control}
          name="specializations"
          render={({ field }) => (
            <TagInput value={field.value} onChange={field.onChange} placeholder="e.g. Yoga, CrossFit…" />
          )}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Certifications</Label>
        <Controller
          control={control}
          name="certifications"
          render={({ field }) => (
            <TagInput value={field.value} onChange={field.onChange} placeholder="e.g. ACE CPT, NASM…" />
          )}
        />
      </div>

      <Button type="submit" className="w-full" loading={updateMutation.isPending}>
        Save Changes
      </Button>
    </form>
  )
}

// ─── Schedule ────────────────────────────────────────────────────────────────

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const shiftSchema = z.object({
  day_of_week: z.coerce.number().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format'),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format'),
  notes: z.string().optional(),
  breaks: z.array(z.object({
    start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format'),
    end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format'),
    label: z.string().optional(),
  })),
})
type ShiftFormValues = z.infer<typeof shiftSchema>

function fmt12(t: string) {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${((h % 12) || 12)}:${String(m).padStart(2, '0')} ${ampm}`
}

function ShiftForm({
  trainerId,
  shift,
  defaultDay,
  onClose,
}: {
  trainerId: number
  shift?: TrainerSchedule
  defaultDay?: number
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const { register, control, handleSubmit, formState: { errors } } = useForm<ShiftFormValues>({
    resolver: zodResolver(shiftSchema),
    defaultValues: shift
      ? { day_of_week: shift.day_of_week, start_time: shift.start_time, end_time: shift.end_time, notes: shift.notes ?? '', breaks: shift.breaks ?? [] }
      : { day_of_week: defaultDay ?? 0, start_time: '09:00', end_time: '18:00', notes: '', breaks: [] },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'breaks' })

  const createMutation = useMutation({
    mutationFn: (d: ShiftFormValues) => trainersApi.createShift(trainerId, d as Record<string, unknown>),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['trainer-schedule', trainerId] }); toast.success('Shift added'); onClose() },
    onError: (e: Error) => toast.error(e.message),
  })
  const updateMutation = useMutation({
    mutationFn: (d: ShiftFormValues) => trainersApi.updateShift(trainerId, shift!.id, d as Record<string, unknown>),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['trainer-schedule', trainerId] }); toast.success('Shift updated'); onClose() },
    onError: (e: Error) => toast.error(e.message),
  })
  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <form onSubmit={handleSubmit((d) => shift ? updateMutation.mutate(d) : createMutation.mutate(d))} className="space-y-5">
      {/* Day */}
      <div className="space-y-1.5">
        <Label>Day of Week <span className="text-destructive">*</span></Label>
        <Select {...register('day_of_week')} className="w-full">
          {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
        </Select>
      </div>

      {/* Shift times */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Start Time <span className="text-destructive">*</span></Label>
          <Input type="time" {...register('start_time')} />
          {errors.start_time && <p className="text-xs text-destructive">{errors.start_time.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>End Time <span className="text-destructive">*</span></Label>
          <Input type="time" {...register('end_time')} />
          {errors.end_time && <p className="text-xs text-destructive">{errors.end_time.message}</p>}
        </div>
      </div>

      {/* Breaks */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5"><Coffee className="h-3.5 w-3.5" /> Breaks</Label>
          <Button type="button" variant="outline" size="sm" onClick={() => append({ start_time: '13:00', end_time: '14:00', label: 'Lunch' })}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Break
          </Button>
        </div>
        {fields.length === 0 && (
          <p className="text-xs text-muted-foreground py-1">No breaks added. Click "Add Break" to include rest periods.</p>
        )}
        {fields.map((field, idx) => (
          <div key={field.id} className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Break {idx + 1}</span>
              <button type="button" onClick={() => remove(idx)} className="text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Start</Label>
                <Input type="time" {...register(`breaks.${idx}.start_time`)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">End</Label>
                <Input type="time" {...register(`breaks.${idx}.end_time`)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Label</Label>
                <Input {...register(`breaks.${idx}.label`)} placeholder="Lunch…" className="h-8 text-sm" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
        <Textarea {...register('notes')} placeholder="Any additional notes about this shift…" rows={2} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
        <Button type="submit" loading={isPending}>{shift ? 'Save Changes' : 'Add Shift'}</Button>
      </div>
    </form>
  )
}

// ─── Bulk Shift Form ──────────────────────────────────────────────────────────

const bulkShiftSchema = z.object({
  start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format'),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format'),
  notes: z.string().optional(),
  breaks: z.array(z.object({
    start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format'),
    end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format'),
    label: z.string().optional(),
  })),
})
type BulkShiftFormValues = z.infer<typeof bulkShiftSchema>

function BulkShiftForm({ trainerId, onClose }: { trainerId: number; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4]) // Mon–Fri default

  const { register, control, handleSubmit, formState: { errors } } = useForm<BulkShiftFormValues>({
    resolver: zodResolver(bulkShiftSchema),
    defaultValues: { start_time: '09:00', end_time: '18:00', notes: '', breaks: [] },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'breaks' })

  const toggleDay = (d: number) =>
    setSelectedDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])

  const selectAll = () => setSelectedDays([0, 1, 2, 3, 4, 5, 6])
  const selectWeekdays = () => setSelectedDays([0, 1, 2, 3, 4])
  const selectWeekends = () => setSelectedDays([5, 6])
  const clearAll = () => setSelectedDays([])

  const [progress, setProgress] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const onSubmit = async (data: BulkShiftFormValues) => {
    if (selectedDays.length === 0) { toast.error('Select at least one day'); return }
    setIsSubmitting(true)
    let done = 0
    for (const day of selectedDays.sort()) {
      try {
        await trainersApi.createShift(trainerId, { ...data, day_of_week: day })
        done++
        setProgress(Math.round((done / selectedDays.length) * 100))
      } catch {
        toast.error(`Failed to add shift for ${DAYS[day]}`)
      }
    }
    queryClient.invalidateQueries({ queryKey: ['trainer-schedule', trainerId] })
    toast.success(`Added shifts for ${done} day${done !== 1 ? 's' : ''}`)
    setIsSubmitting(false)
    onClose()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Day selector */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">Select Days <span className="text-destructive">*</span></Label>
          <div className="flex gap-1.5">
            <button type="button" onClick={selectAll}
              className="text-[11px] px-2 py-0.5 rounded border border-sky-300 text-sky-700 bg-sky-50 hover:bg-sky-100 transition-colors font-medium">
              All
            </button>
            <button type="button" onClick={selectWeekdays}
              className="text-[11px] px-2 py-0.5 rounded border border-border/60 text-muted-foreground hover:border-sky-300 hover:text-sky-700 hover:bg-sky-50 transition-colors font-medium">
              Weekdays
            </button>
            <button type="button" onClick={selectWeekends}
              className="text-[11px] px-2 py-0.5 rounded border border-border/60 text-muted-foreground hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 transition-colors font-medium">
              Weekends
            </button>
            <button type="button" onClick={clearAll}
              className="text-[11px] px-2 py-0.5 rounded border border-border/60 text-muted-foreground hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition-colors font-medium">
              Clear
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {DAYS.map((day, i) => {
            const isSelected = selectedDays.includes(i)
            const isWeekend = i >= 5
            return (
              <button
                key={i}
                type="button"
                onClick={() => toggleDay(i)}
                className={`flex flex-col items-center py-2.5 rounded-xl border-2 text-xs font-semibold transition-all select-none ${
                  isSelected
                    ? isWeekend
                      ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                      : 'bg-sky-600 border-sky-600 text-white shadow-sm'
                    : isWeekend
                      ? 'bg-amber-50 border-amber-200 text-amber-700 hover:border-amber-400'
                      : 'bg-gray-50 border-border/60 text-muted-foreground hover:border-sky-400 hover:bg-sky-50 hover:text-sky-700'
                }`}
              >
                <span className="text-[11px] font-bold">{DAYS_SHORT[i]}</span>
                {isSelected && <span className="text-[9px] mt-0.5 opacity-80">✓</span>}
              </button>
            )
          })}
        </div>

        {selectedDays.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Shift will be added to: <span className="font-medium text-foreground">
              {selectedDays.sort().map(d => DAYS_SHORT[d]).join(', ')}
            </span>
          </p>
        )}
      </div>

      {/* Shift times */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Start Time <span className="text-destructive">*</span></Label>
          <Input type="time" {...register('start_time')} />
          {errors.start_time && <p className="text-xs text-destructive">{errors.start_time.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>End Time <span className="text-destructive">*</span></Label>
          <Input type="time" {...register('end_time')} />
          {errors.end_time && <p className="text-xs text-destructive">{errors.end_time.message}</p>}
        </div>
      </div>

      {/* Breaks */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5"><Coffee className="h-3.5 w-3.5" /> Breaks</Label>
          <Button type="button" variant="outline" size="sm" onClick={() => append({ start_time: '13:00', end_time: '14:00', label: 'Lunch' })}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Break
          </Button>
        </div>
        {fields.length === 0 && (
          <p className="text-xs text-muted-foreground py-1">No breaks added.</p>
        )}
        {fields.map((field, idx) => (
          <div key={field.id} className="rounded-lg border border-border/60 bg-muted/30 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Break {idx + 1}</span>
              <button type="button" onClick={() => remove(idx)} className="text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Start</Label>
                <Input type="time" {...register(`breaks.${idx}.start_time`)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">End</Label>
                <Input type="time" {...register(`breaks.${idx}.end_time`)} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Label</Label>
                <Input {...register(`breaks.${idx}.label`)} placeholder="Lunch…" className="h-8 text-sm" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
        <Textarea {...register('notes')} placeholder="Any additional notes…" rows={2} />
      </div>

      {/* Progress bar while submitting */}
      {isSubmitting && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Adding shifts…</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-sky-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
        <Button type="submit" loading={isSubmitting} disabled={selectedDays.length === 0}>
          Add to {selectedDays.length} Day{selectedDays.length !== 1 ? 's' : ''}
        </Button>
      </div>
    </form>
  )
}

// ─── Schedule Section ─────────────────────────────────────────────────────────

function ScheduleSection({ trainerId, trainer, canManage }: { trainerId: number; trainer: TrainerProfile; canManage: boolean }) {
  const queryClient = useQueryClient()
  const [drawerDay, setDrawerDay] = useState<number | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [editShift, setEditShift] = useState<TrainerSchedule | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TrainerSchedule | null>(null)

  const offDays: number[] = trainer.weekly_off_days ?? []

  const offDayMutation = useMutation({
    mutationFn: (days: number[]) =>
      trainersApi.update(trainerId, { set_weekly_off_days: true, weekly_off_days: days }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.trainer(trainerId) })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const toggleOffDay = (day: number) => {
    const next = offDays.includes(day)
      ? offDays.filter(d => d !== day)
      : [...offDays, day]
    offDayMutation.mutate(next)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['trainer-schedule', trainerId],
    queryFn: () => trainersApi.getSchedule(trainerId),
  })
  const shifts = data?.shifts ?? []

  const deleteMutation = useMutation({
    mutationFn: (shiftId: number) => trainersApi.deleteShift(trainerId, shiftId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['trainer-schedule', trainerId] }); toast.success('Shift removed'); setDeleteTarget(null) },
    onError: (e: Error) => toast.error(e.message),
  })

  const shiftsByDay = Array.from({ length: 7 }, (_, d) => shifts.filter((s) => s.day_of_week === d))

  // Total hours per week
  const totalHours = shifts.filter(s => s.is_active).reduce((sum, s) => {
    const [sh, sm] = s.start_time.split(':').map(Number)
    const [eh, em] = s.end_time.split(':').map(Number)
    const breakMins = (s.breaks ?? []).reduce((b, br) => {
      const [bsh, bsm] = br.start_time.split(':').map(Number)
      const [beh, bem] = br.end_time.split(':').map(Number)
      return b + ((beh * 60 + bem) - (bsh * 60 + bsm))
    }, 0)
    return sum + ((eh * 60 + em) - (sh * 60 + sm) - breakMins)
  }, 0)
  const workDays = new Set(shifts.filter(s => s.is_active).map(s => s.day_of_week)).size

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              Weekly Schedule
            </CardTitle>
            <div className="flex items-center gap-3">
              {!isLoading && shifts.length > 0 && (
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{Math.floor(totalHours / 60)}h {totalHours % 60}m / week</span>
                  <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{workDays} day{workDays !== 1 ? 's' : ''}</span>
                </div>
              )}
              {canManage && (
                <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}
                  className="h-7 text-xs gap-1.5 border-sky-300 text-sky-700 bg-sky-50 hover:bg-sky-100">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Add for Multiple Days
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 pb-4">
          {/* Weekly Off Days row */}
          {canManage && (
            <div className="px-4 pt-3 pb-3 border-b border-border/40">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap flex items-center gap-1.5">
                  <Moon className="h-3.5 w-3.5" /> Weekly Off Days
                </span>
                <div className="flex gap-1.5 flex-wrap">
                  {DAYS_SHORT.map((d, i) => {
                    const isOff = offDays.includes(i)
                    const isWeekend = i >= 5
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleOffDay(i)}
                        disabled={offDayMutation.isPending}
                        title={isOff ? `${DAYS[i]}: click to mark as work day` : `${DAYS[i]}: click to mark as day off`}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                          isOff
                            ? 'bg-red-100 border-red-300 text-red-600 hover:bg-red-200'
                            : isWeekend
                              ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                              : 'bg-muted/60 border-border/60 text-muted-foreground hover:border-red-300 hover:text-red-500 hover:bg-red-50'
                        }`}
                      >
                        {isOff && <span className="mr-0.5">✕</span>}{d}
                      </button>
                    )
                  })}
                </div>
                {offDays.length > 0 && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    {offDays.length} day{offDays.length !== 1 ? 's' : ''} off
                  </span>
                )}
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="px-6 grid grid-cols-7 gap-2 mt-3">
              {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
            </div>
          ) : (
            <div className="px-4 pt-3">
              {/* Day columns */}
              <div className="grid grid-cols-7 gap-2">
                {DAYS_SHORT.map((day, dayIdx) => {
                  const dayShifts = shiftsByDay[dayIdx]
                  const isWeekend = dayIdx >= 5
                  const isOffDay = offDays.includes(dayIdx)
                  return (
                    <div key={dayIdx} className={`min-h-[120px] rounded-b-lg ${isOffDay ? 'bg-red-50/40' : ''}`}>
                      {/* Day header */}
                      <div className={`text-center py-1.5 rounded-t-lg mb-1 ${
                        isOffDay
                          ? 'bg-red-100 text-red-600'
                          : isWeekend
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-sky-50 text-sky-700'
                      }`}>
                        <p className="text-[11px] font-bold uppercase tracking-wider">{day}</p>
                        {isOffDay
                          ? <p className="text-[10px] font-semibold text-red-500">Day Off</p>
                          : <p className="text-[10px] text-muted-foreground">{dayShifts.length} shift{dayShifts.length !== 1 ? 's' : ''}</p>
                        }
                      </div>

                      {/* Off day placeholder */}
                      {isOffDay ? (
                        <div className="flex flex-col items-center justify-center py-4 text-red-300 select-none">
                          <Moon className="h-5 w-5 mb-1" />
                          <p className="text-[10px] font-medium text-red-400">Rest day</p>
                        </div>
                      ) : (
                        /* Shift cards */
                        <div className="space-y-1.5">
                          {dayShifts.map((s) => (
                            <div
                              key={s.id}
                              className={`rounded-lg px-2 py-1.5 text-xs border cursor-pointer transition-all group relative ${
                                s.is_active
                                  ? 'bg-sky-50 border-sky-200 hover:border-sky-400 hover:bg-sky-100'
                                  : 'bg-gray-50 border-gray-200 opacity-60 hover:opacity-80'
                              }`}
                              onClick={() => canManage && setEditShift(s)}
                            >
                              <p className="font-semibold text-sky-800 leading-tight">{fmt12(s.start_time)}</p>
                              <p className="text-sky-600 leading-tight">— {fmt12(s.end_time)}</p>
                              {(s.breaks ?? []).length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-0.5">
                                  {s.breaks.map((b, i) => (
                                    <span key={i} className="inline-flex items-center gap-0.5 text-[9px] bg-amber-100 text-amber-700 rounded px-1 py-0.5">
                                      <Coffee className="h-2 w-2" />{b.label || `${fmt12(b.start_time)}`}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {s.notes && (
                                <p className="mt-1 text-[10px] text-muted-foreground truncate">{s.notes}</p>
                              )}
                              {canManage && (
                                <button
                                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(s) }}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          ))}

                          {/* Add shift button */}
                          {canManage && (
                            <button
                              onClick={() => setDrawerDay(dayIdx)}
                              className="w-full rounded-lg border border-dashed border-border/60 py-1.5 text-[11px] text-muted-foreground hover:border-sky-400 hover:text-sky-600 hover:bg-sky-50/50 transition-all flex items-center justify-center gap-1"
                            >
                              <Plus className="h-3 w-3" /> Add
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Legend */}
              {shifts.length > 0 && (
                <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground border-t pt-3">
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-sky-200 inline-block" /> Active shift</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-gray-200 inline-block" /> Inactive shift</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-200 inline-block" /> Weekend</span>
                  <span className="flex items-center gap-1.5"><Coffee className="h-3 w-3 text-amber-500" /> Break</span>
                  <span className="flex items-center gap-1.5"><Moon className="h-3 w-3 text-red-400" /> Day off</span>
                </div>
              )}

              {shifts.length === 0 && !isLoading && (
                <div className="text-center py-10 text-sm text-muted-foreground">
                  <CalendarClock className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="font-medium">No shifts scheduled yet.</p>
                  {canManage && (
                    <div className="flex items-center justify-center gap-2 mt-3">
                      <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}
                        className="gap-1.5 border-sky-300 text-sky-700 bg-sky-50 hover:bg-sky-100">
                        <CalendarDays className="h-3.5 w-3.5" />
                        Add for Multiple Days
                      </Button>
                      <span className="text-xs text-muted-foreground">or click "+ Add" under any day</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk add drawer */}
      <FormDrawer
        isOpen={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Add Shifts for Multiple Days"
        description="Select days and set the same shift timing across all of them at once."
        wide
      >
        <BulkShiftForm trainerId={trainerId} onClose={() => setBulkOpen(false)} />
      </FormDrawer>

      {/* Add shift drawer */}
      <FormDrawer
        isOpen={drawerDay !== null}
        onClose={() => setDrawerDay(null)}
        title="Add Shift"
        description={drawerDay !== null ? `Add a shift for ${DAYS[drawerDay]}` : ''}
      >
        {drawerDay !== null && (
          <ShiftForm trainerId={trainerId} defaultDay={drawerDay} onClose={() => setDrawerDay(null)} />
        )}
      </FormDrawer>

      {/* Edit shift drawer */}
      <FormDrawer
        isOpen={editShift !== null}
        onClose={() => setEditShift(null)}
        title="Edit Shift"
        description={editShift ? `${DAYS[editShift.day_of_week]} · ${fmt12(editShift.start_time)} – ${fmt12(editShift.end_time)}` : ''}
      >
        {editShift && (
          <ShiftForm trainerId={trainerId} shift={editShift} onClose={() => setEditShift(null)} />
        )}
      </FormDrawer>

      {/* Delete confirm */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Remove Shift"
        description={deleteTarget ? `Remove ${DAYS[deleteTarget.day_of_week]} shift (${fmt12(deleteTarget.start_time)} – ${fmt12(deleteTarget.end_time)})?` : ''}
        confirmLabel="Remove"
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />
    </>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  accent?: boolean
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg ${accent ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`text-lg font-bold ${accent ? 'text-primary' : ''}`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TrainerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const trainerId = Number(id)
  const isAdmin = user?.role === 'admin'
  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager'

  const [deactivateOpen, setDeactivateOpen] = useState(false)

  const { data: trainer, isLoading, isError } = useQuery({
    queryKey: QUERY_KEYS.trainer(trainerId),
    queryFn: () => trainersApi.getById(trainerId),
    enabled: !isNaN(trainerId),
  })

  const { data: classesData, isLoading: classesLoading } = useQuery({
    queryKey: QUERY_KEYS.trainerClasses(trainerId),
    queryFn: () => trainersApi.getClasses(trainerId),
    enabled: !isNaN(trainerId),
  })

  const deactivateMutation = useMutation({
    mutationFn: () => trainersApi.deactivate(trainerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.trainers })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.trainer(trainerId) })
      toast.success('Trainer deactivated')
      setDeactivateOpen(false)
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to deactivate trainer'),
  })

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Trainer" subtitle="Loading…" />
        <div className="space-y-4">
          <Card>
            <CardContent className="p-6 flex gap-4">
              <Skeleton className="h-20 w-20 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-4 w-32" />
              </div>
            </CardContent>
          </Card>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
          </div>
        </div>
      </div>
    )
  }

  if (isError || !trainer) {
    return (
      <div>
        <PageHeader title="Trainer" subtitle="Not found" />
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <p>Could not load trainer details.</p>
            <Button variant="outline" className="mt-3" onClick={() => navigate('/trainers')}>
              Back to Trainers
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const firstName = trainer.user?.first_name ?? '?'
  const lastName = trainer.user?.last_name ?? '?'
  const classes = (
    Array.isArray(classesData) ? classesData :
    (classesData as { classes?: unknown[] })?.classes ??
    (classesData as { items?: unknown[] })?.items ??
    []
  ) as Array<Record<string, unknown>>

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2 text-muted-foreground"
          onClick={() => navigate('/trainers')}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Trainers
        </Button>
        <PageHeader
          title={`${firstName} ${lastName}`}
          subtitle="Trainer profile"
          actions={
            isAdminOrManager ? (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => navigate(`/trainers/${trainerId}/edit`)}>
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
                {isAdmin && trainer.is_active && (
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setDeactivateOpen(true)}
                  >
                    <UserX className="h-4 w-4" />
                    Deactivate
                  </Button>
                )}
              </div>
            ) : undefined
          }
        />
      </div>

      {/* Profile Header Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <AvatarWithFallback
              firstName={firstName}
              lastName={lastName}
              className="h-20 w-20 text-2xl shrink-0"
            />
            <div className="flex-1 space-y-2">
              <div className="flex items-center flex-wrap gap-2">
                <h2 className="text-xl font-bold">{firstName} {lastName}</h2>
                <StatusBadge status={trainer.is_active ? 'active' : 'inactive'} />
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-sm text-muted-foreground">
                {trainer.user?.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    {trainer.user.email}
                  </span>
                )}
                {trainer.user?.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    {trainer.user.phone}
                  </span>
                )}
                {trainer.facility && (
                  <span className="flex items-center gap-1.5">
                    <Building className="h-3.5 w-3.5" />
                    {trainer.facility.name}
                  </span>
                )}
              </div>
              {trainer.bio && (
                <p className="text-sm text-muted-foreground leading-relaxed mt-1">{trainer.bio}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Clock}
          label="Experience"
          value={`${trainer.experience_years ?? 0} yr${(trainer.experience_years ?? 0) !== 1 ? 's' : ''}`}
        />
        <StatCard
          icon={DollarSign}
          label="Salary"
          value={formatCurrency(getTrainerSalary(trainer.id, trainer.hourly_rate ?? 0)) + '/mo'}
          accent
        />
        <StatCard
          icon={Users}
          label="Max Clients / Day"
          value={trainer.max_clients_per_day ?? 0}
        />
        <StatCard
          icon={BookOpen}
          label="Classes"
          value={classes.length}
        />
      </div>

      {/* Specializations & Certifications */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-4 w-4 text-primary" />
              Specializations
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {trainer.specializations && trainer.specializations.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {trainer.specializations.map((spec) => (
                  <Badge key={spec} variant="secondary">{spec}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No specializations listed.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-4 w-4 text-primary" />
              Certifications
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {trainer.certifications && trainer.certifications.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {trainer.certifications.map((cert) => (
                  <Badge key={cert} variant="outline">{cert}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No certifications listed.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Weekly Schedule */}
      <ScheduleSection trainerId={trainerId} trainer={trainer} canManage={isAdminOrManager} />

      {/* Assigned Classes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            Assigned Classes
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {classesLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : classes.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">No classes assigned yet.</p>
          ) : (
            <div className="rounded-b-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-sidebar">
                  <tr>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Class Name</th>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Schedule</th>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Capacity</th>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {classes.map((cls, idx) => {
                    const c = cls as {
                      id?: number
                      name?: string
                      scheduled_at?: string
                      capacity?: number
                      enrolled_count?: number
                      is_active?: boolean
                      status?: string
                    }
                    return (
                      <tr
                        key={c.id ?? idx}
                        className="hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => c.id && navigate(`/classes/${c.id}`)}
                      >
                        <td className="px-4 py-3 font-medium">{c.name ?? '-'}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {c.scheduled_at ? formatDate(c.scheduled_at) : '-'}
                        </td>
                        <td className="px-4 py-3">
                          {c.enrolled_count ?? '-'} / {c.capacity ?? '-'}
                        </td>
                        <td className="px-4 py-3">
                          {c.status ? (
                            <StatusBadge status={c.status} />
                          ) : c.is_active !== undefined ? (
                            <StatusBadge status={c.is_active ? 'active' : 'inactive'} />
                          ) : '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deactivate Confirm */}
      <ConfirmModal
        isOpen={deactivateOpen}
        onClose={() => setDeactivateOpen(false)}
        onConfirm={() => deactivateMutation.mutate()}
        title="Deactivate Trainer"
        description={`Are you sure you want to deactivate ${firstName} ${lastName}? They will no longer be able to take new clients or classes.`}
        confirmLabel="Deactivate"
        variant="destructive"
        isLoading={deactivateMutation.isPending}
      />
    </div>
  )
}
