import { useState, useMemo } from 'react'
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
import { TimePicker } from '@/components/ui/time-picker'
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
  ChevronLeft,
  ChevronRight,
  Fingerprint,
  Timer,
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

const breakSchema = z.object({
  start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format'),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format'),
  label: z.string().optional(),
})

const shiftBlockSchema = z.object({
  start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format'),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format'),
  breaks: z.array(breakSchema),
})

const shiftSchema = z.object({
  day_of_week: z.coerce.number().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format'),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format'),
  notes: z.string().optional(),
  breaks: z.array(breakSchema),
})
type ShiftFormValues = z.infer<typeof shiftSchema>

const addShiftsSchema = z.object({
  shifts: z.array(shiftBlockSchema).min(1),
  notes: z.string().optional(),
})
type AddShiftsFormValues = z.infer<typeof addShiftsSchema>

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
      {/* Day — only shown when editing (day is known from context when adding) */}
      {shift && (
        <div className="space-y-1.5">
          <Label>Day of Week <span className="text-destructive">*</span></Label>
          <Select {...register('day_of_week')} className="w-full">
            {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </Select>
        </div>
      )}

      {/* Shift times */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Start Time <span className="text-destructive">*</span></Label>
          <Controller control={control} name="start_time" render={({ field }) => <TimePicker value={field.value} onChange={field.onChange} />} />
          {errors.start_time && <p className="text-xs text-destructive">{errors.start_time.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>End Time <span className="text-destructive">*</span></Label>
          <Controller control={control} name="end_time" render={({ field }) => <TimePicker value={field.value} onChange={field.onChange} />} />
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
                <Controller control={control} name={`breaks.${idx}.start_time`} render={({ field }) => <TimePicker value={field.value} onChange={field.onChange} />} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">End</Label>
                <Controller control={control} name={`breaks.${idx}.end_time`} render={({ field }) => <TimePicker value={field.value} onChange={field.onChange} />} />
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

// ─── Multi-Shift Add Form ─────────────────────────────────────────────────────

function ShiftBlockInput({
  control, register, index, onRemove, canRemove,
}: {
  control: ReturnType<typeof useForm<AddShiftsFormValues>>['control']
  register: ReturnType<typeof useForm<AddShiftsFormValues>>['register']
  index: number
  onRemove: () => void
  canRemove: boolean
}) {
  const { fields, append, remove } = useFieldArray({ control, name: `shifts.${index}.breaks` as const })
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Shift {index + 1}</span>
        {canRemove && (
          <button type="button" onClick={onRemove} className="text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Start Time <span className="text-destructive">*</span></Label>
          <Controller control={control} name={`shifts.${index}.start_time`} render={({ field }) => <TimePicker value={field.value} onChange={field.onChange} />} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">End Time <span className="text-destructive">*</span></Label>
          <Controller control={control} name={`shifts.${index}.end_time`} render={({ field }) => <TimePicker value={field.value} onChange={field.onChange} />} />
        </div>
      </div>
      {/* Breaks */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Coffee className="h-3 w-3" /> Breaks</span>
          <button
            type="button"
            onClick={() => append({ start_time: '13:00', end_time: '14:00', label: 'Lunch' })}
            className="text-xs text-sky-600 hover:text-sky-700 flex items-center gap-0.5 font-medium"
          >
            <Plus className="h-3 w-3" /> Add Break
          </button>
        </div>
        {fields.map((f, bi) => (
          <div key={f.id} className="rounded border border-border/50 bg-background p-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Break {bi + 1}</span>
              <button type="button" onClick={() => remove(bi)} className="text-muted-foreground hover:text-destructive transition-colors">
                <X className="h-3 w-3" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <div className="space-y-0.5">
                <Label className="text-[10px]">Start</Label>
                <Controller control={control} name={`shifts.${index}.breaks.${bi}.start_time`} render={({ field }) => <TimePicker value={field.value} onChange={field.onChange} />} />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px]">End</Label>
                <Controller control={control} name={`shifts.${index}.breaks.${bi}.end_time`} render={({ field }) => <TimePicker value={field.value} onChange={field.onChange} />} />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px]">Label</Label>
                <Input {...register(`shifts.${index}.breaks.${bi}.label`)} placeholder="Lunch…" className="h-7 text-xs" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AddShiftsForm({ trainerId, defaultDay, onClose }: { trainerId: number; defaultDay: number; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { register, control, handleSubmit } = useForm<AddShiftsFormValues>({
    resolver: zodResolver(addShiftsSchema),
    defaultValues: { shifts: [{ start_time: '09:00', end_time: '18:00', breaks: [] }], notes: '' },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'shifts' })

  const mutation = useMutation({
    mutationFn: async (d: AddShiftsFormValues) => {
      for (const s of d.shifts) {
        await trainersApi.createShift(trainerId, { ...s, day_of_week: defaultDay, notes: d.notes })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainer-schedule', trainerId] })
      toast.success(fields.length > 1 ? `${fields.length} shifts added` : 'Shift added')
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
      {fields.map((f, i) => (
        <ShiftBlockInput
          key={f.id}
          control={control}
          register={register}
          index={i}
          onRemove={() => remove(i)}
          canRemove={fields.length > 1}
        />
      ))}

      <button
        type="button"
        onClick={() => append({ start_time: '16:00', end_time: '21:00', breaks: [] })}
        className="w-full rounded-lg border border-dashed border-sky-300 py-2 text-sm text-sky-600 hover:border-sky-500 hover:bg-sky-50/50 transition-all flex items-center justify-center gap-1.5 font-medium"
      >
        <Plus className="h-4 w-4" /> Add Another Shift
      </button>

      <div className="space-y-1.5">
        <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
        <Textarea {...register('notes')} placeholder="Any additional notes…" rows={2} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
        <Button type="submit" loading={mutation.isPending}>
          {fields.length > 1 ? `Add ${fields.length} Shifts` : 'Add Shift'}
        </Button>
      </div>
    </form>
  )
}

// ─── Bulk Shift Form ──────────────────────────────────────────────────────────

const bulkShiftSchema = z.object({
  shifts: z.array(z.object({
    start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format'),
    end_time:   z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format'),
  })).min(1).max(2),
  notes: z.string().optional(),
})
type BulkShiftFormValues = z.infer<typeof bulkShiftSchema>

function BulkShiftForm({ trainerId, onClose }: { trainerId: number; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4])

  const { register, control, handleSubmit, formState: { errors } } = useForm<BulkShiftFormValues>({
    resolver: zodResolver(bulkShiftSchema),
    defaultValues: { shifts: [{ start_time: '09:00', end_time: '18:00' }], notes: '' },
  })
  const { fields: shiftFields, append: appendShift, remove: removeShift } = useFieldArray({ control, name: 'shifts' })

  const toggleDay = (d: number) =>
    setSelectedDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])

  const selectAll      = () => setSelectedDays([0, 1, 2, 3, 4, 5, 6])
  const selectWeekdays = () => setSelectedDays([0, 1, 2, 3, 4])
  const selectWeekends = () => setSelectedDays([5, 6])
  const clearAll       = () => setSelectedDays([])

  const [progress, setProgress]       = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const onSubmit = async (data: BulkShiftFormValues) => {
    if (selectedDays.length === 0) { toast.error('Select at least one day'); return }
    setIsSubmitting(true)
    let done = 0
    const total = selectedDays.length * data.shifts.length
    for (const day of selectedDays.sort()) {
      for (const shift of data.shifts) {
        try {
          await trainersApi.createShift(trainerId, { ...shift, day_of_week: day, notes: data.notes, breaks: [] })
          done++
          setProgress(Math.round((done / total) * 100))
        } catch {
          toast.error(`Failed to add shift for ${DAYS[day]}`)
        }
      }
    }
    queryClient.invalidateQueries({ queryKey: ['trainer-schedule', trainerId] })
    const shiftWord = data.shifts.length > 1 ? 'double shifts' : 'shifts'
    toast.success(`Added ${shiftWord} for ${selectedDays.length} day${selectedDays.length !== 1 ? 's' : ''}`)
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
              className="text-[11px] px-2 py-0.5 rounded border border-sky-300 text-sky-700 bg-sky-50 hover:bg-sky-100 transition-colors font-medium">All</button>
            <button type="button" onClick={selectWeekdays}
              className="text-[11px] px-2 py-0.5 rounded border border-border/60 text-muted-foreground hover:border-sky-300 hover:text-sky-700 hover:bg-sky-50 transition-colors font-medium">Weekdays</button>
            <button type="button" onClick={selectWeekends}
              className="text-[11px] px-2 py-0.5 rounded border border-border/60 text-muted-foreground hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 transition-colors font-medium">Weekends</button>
            <button type="button" onClick={clearAll}
              className="text-[11px] px-2 py-0.5 rounded border border-border/60 text-muted-foreground hover:border-red-300 hover:text-red-600 hover:bg-red-50 transition-colors font-medium">Clear</button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {DAYS.map((_, i) => {
            const isSelected = selectedDays.includes(i)
            const isWeekend  = i >= 5
            return (
              <button key={i} type="button" onClick={() => toggleDay(i)}
                className={`flex flex-col items-center py-2.5 rounded-xl border-2 text-xs font-semibold transition-all select-none ${
                  isSelected
                    ? isWeekend ? 'bg-amber-500 border-amber-500 text-white shadow-sm' : 'bg-sky-600 border-sky-600 text-white shadow-sm'
                    : isWeekend ? 'bg-amber-50 border-amber-200 text-amber-700 hover:border-amber-400'
                               : 'bg-gray-50 border-border/60 text-muted-foreground hover:border-sky-400 hover:bg-sky-50 hover:text-sky-700'
                }`}>
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

      {/* Shift slots */}
      <div className="space-y-3">
        {shiftFields.map((f, i) => {
          const errs = (errors.shifts as any)?.[i]
          return (
            <div key={f.id} className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {shiftFields.length > 1 ? `Shift ${i + 1}` : 'Shift'}
                </span>
                {i > 0 && (
                  <button type="button" onClick={() => removeShift(i)}
                    className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Start Time <span className="text-destructive">*</span></Label>
                  <Controller control={control} name={`shifts.${i}.start_time`}
                    render={({ field }) => <TimePicker value={field.value} onChange={field.onChange} />} />
                  {errs?.start_time && <p className="text-xs text-destructive">{errs.start_time.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">End Time <span className="text-destructive">*</span></Label>
                  <Controller control={control} name={`shifts.${i}.end_time`}
                    render={({ field }) => <TimePicker value={field.value} onChange={field.onChange} />} />
                  {errs?.end_time && <p className="text-xs text-destructive">{errs.end_time.message}</p>}
                </div>
              </div>
            </div>
          )
        })}

        {shiftFields.length < 2 && (
          <button type="button"
            onClick={() => appendShift({ start_time: '17:00', end_time: '21:00' })}
            className="w-full rounded-lg border border-dashed border-sky-300 py-2 text-sm text-sky-600 hover:border-sky-500 hover:bg-sky-50/50 transition-all flex items-center justify-center gap-1.5 font-medium">
            <Plus className="h-4 w-4" /> Add Second Shift (Double Shift)
          </button>
        )}
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
            <span>Adding shifts…</span><span>{progress}%</span>
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
                      <div className={`text-center py-1.5 rounded-t-lg mb-1 relative ${
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
                        {canManage && !isOffDay && (
                          <button
                            onClick={() => setDrawerDay(dayIdx)}
                            className="absolute top-1 right-1 rounded p-0.5 text-sky-500 hover:text-sky-700 hover:bg-sky-100 transition-colors"
                            title={`Add shift for ${DAYS[dayIdx]}`}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        )}
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

                          {/* Empty state prompt */}
                          {canManage && dayShifts.length === 0 && (
                            <button
                              onClick={() => setDrawerDay(dayIdx)}
                              className="w-full rounded-lg border border-dashed border-border/40 py-3 text-[11px] text-muted-foreground/60 hover:border-sky-300 hover:text-sky-500 hover:bg-sky-50/30 transition-all flex items-center justify-center gap-1"
                            >
                              <Plus className="h-3 w-3" /> Add shift
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
        title="Add Shifts"
        description={drawerDay !== null ? `${DAYS[drawerDay]}` : ''}
        descriptionClassName="text-base font-semibold text-foreground"
      >
        {drawerDay !== null && (
          <AddShiftsForm trainerId={trainerId} defaultDay={drawerDay} onClose={() => setDrawerDay(null)} />
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

// ─── Attendance Section ───────────────────────────────────────────────────────

function AttendanceSection({ trainerId }: { trainerId: number }) {
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const { data: days = [], isLoading } = useQuery({
    queryKey: ['trainer-punches', trainerId, month],
    queryFn: () => trainersApi.getPunches(trainerId, month),
    enabled: trainerId > 0,
  })

  const monthLabel = useMemo(() => {
    const [y, m] = month.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  }, [month])

  function changeMonth(delta: number) {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const totalHours  = days.reduce((s, d) => s + (d.duty_hours ?? 0), 0)
  const presentDays = days.filter(d => d.punches.length > 0).length

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Fingerprint className="h-4 w-4 text-primary" />
            Biometric Attendance
          </CardTitle>
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => changeMonth(-1)}
              className="p-1 rounded hover:bg-muted transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-medium w-36 text-center">{monthLabel}</span>
            <button
              onClick={() => changeMonth(1)}
              className="p-1 rounded hover:bg-muted transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        {!isLoading && days.length > 0 && (
          <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {presentDays} day{presentDays !== 1 ? 's' : ''} present
            </span>
            <span className="flex items-center gap-1">
              <Timer className="h-3.5 w-3.5" />
              {Math.floor(totalHours)}h {Math.round((totalHours % 1) * 60)}m total
            </span>
            <span className="text-xs opacity-60">Scan time = server clock (accurate)</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : days.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">
            No attendance records for this month.
          </p>
        ) : (
          <div className="divide-y">
            {days.map((day) => {
              const dateObj = new Date(day.date + 'T00:00:00')
              const dayLabel = dateObj.toLocaleDateString('en-IN', {
                weekday: 'short', day: 'numeric', month: 'short',
              })
              const fmt = (iso: string) =>
                new Date(iso).toLocaleTimeString('en-IN', {
                  hour: '2-digit', minute: '2-digit', hour12: false,
                })
              return (
                <div key={day.date} className="px-4 py-3 flex flex-col sm:flex-row sm:items-start gap-2 hover:bg-muted/30 transition-colors">
                  {/* Date + duty hours */}
                  <div className="flex sm:flex-col items-baseline sm:items-start gap-2 sm:gap-0.5 shrink-0 sm:w-28">
                    <span className="text-sm font-semibold">{dayLabel}</span>
                    {day.duty_hours > 0 && (
                      <span className="text-xs text-primary font-medium tabular-nums">
                        {Math.floor(day.duty_hours)}h {Math.round((day.duty_hours % 1) * 60)}m
                      </span>
                    )}
                  </div>
                  {/* Scan chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {day.punches.map((p, i) => {
                      const scanTime = p.server_received_at ? fmt(p.server_received_at) : fmt(p.punched_at)
                      const deviceTime = fmt(p.punched_at)
                      const hasDeviceDiff = !!p.server_received_at && deviceTime !== scanTime
                      return (
                        <span
                          key={i}
                          title={hasDeviceDiff ? `Device: ${deviceTime}` : undefined}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 bg-primary/10 text-primary text-xs font-mono font-medium"
                        >
                          <Clock className="h-3 w-3 shrink-0" />
                          {scanTime}
                        </span>
                      )
                    })}
                    <span className="text-[11px] text-muted-foreground/50 self-center ml-1">
                      {day.punches.length} scan{day.punches.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Salary Breakdown Section ────────────────────────────────────────────────

const GRACE_MINUTES = 15 // minutes late before deduction kicks in

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function fmtMins(mins: number): string {
  if (mins <= 0) return '0m'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function SalaryBreakdownSection({ trainerId, trainer, monthlySalary }: {
  trainerId: number
  trainer: TrainerProfile
  monthlySalary: number
}) {
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const monthLabel = useMemo(() => {
    const [y, m] = month.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  }, [month])

  function changeMonth(delta: number) {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const { data: punchDays = [], isLoading: punchLoading } = useQuery({
    queryKey: ['trainer-punches', trainerId, month],
    queryFn: () => trainersApi.getPunches(trainerId, month),
    enabled: trainerId > 0,
  })

  const { data: scheduleData } = useQuery({
    queryKey: ['trainer-schedule', trainerId],
    queryFn: () => trainersApi.getSchedule(trainerId),
  })
  const shifts = scheduleData?.shifts ?? []

  const offDays: number[] = trainer.weekly_off_days ?? []

  // Build a lookup: weekday (0=Mon…6=Sun) → earliest active shift
  const shiftByWeekday = useMemo(() => {
    const map: Record<number, TrainerSchedule> = {}
    for (const s of shifts) {
      if (!s.is_active) continue
      const existing = map[s.day_of_week]
      if (!existing || timeToMinutes(s.start_time) < timeToMinutes(existing.start_time)) {
        map[s.day_of_week] = s
      }
    }
    return map
  }, [shifts])

  // Build lookup: punch date string → first server punch time in minutes
  const punchMap = useMemo(() => {
    const map: Record<string, { firstMinute: number; count: number }> = {}
    for (const day of punchDays) {
      const times = day.punches.map(p => {
        const iso = p.server_received_at ?? p.punched_at
        const d = new Date(iso)
        return d.getHours() * 60 + d.getMinutes()
      })
      if (times.length > 0) {
        map[day.date] = { firstMinute: Math.min(...times), count: times.length }
      }
    }
    return map
  }, [punchDays])

  // Calendar days analysis
  const rows = useMemo(() => {
    const [y, m] = month.split('-').map(Number)
    const daysInMonth = new Date(y, m, 0).getDate()
    const today = new Date()
    const isCurrentMonth = today.getFullYear() === y && today.getMonth() + 1 === m
    const lastDay = isCurrentMonth ? today.getDate() : daysInMonth

    // Count working days in full month (for daily rate calc)
    let workingDaysTotal = 0
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(y, m - 1, d)
      const weekday = (date.getDay() + 6) % 7 // Mon=0
      if (!offDays.includes(weekday) && shiftByWeekday[weekday]) workingDaysTotal++
    }
    const dailyRate = workingDaysTotal > 0 ? monthlySalary / workingDaysTotal : 0

    const result: Array<{
      date: string
      label: string
      weekday: number
      isOff: boolean
      isFuture: boolean
      shift: TrainerSchedule | null
      status: 'present' | 'late' | 'absent' | 'off' | 'future'
      lateMinutes: number
      deduction: number
      earned: number
    }> = []

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(y, m - 1, d)
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const weekday = (date.getDay() + 6) % 7
      const label = date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
      const isOff = offDays.includes(weekday) || !shiftByWeekday[weekday]
      const isFuture = d > lastDay

      if (isOff) {
        result.push({ date: dateStr, label, weekday, isOff: true, isFuture: false, shift: null, status: 'off', lateMinutes: 0, deduction: 0, earned: 0 })
        continue
      }
      if (isFuture) {
        result.push({ date: dateStr, label, weekday, isOff: false, isFuture: true, shift: shiftByWeekday[weekday] ?? null, status: 'future', lateMinutes: 0, deduction: 0, earned: 0 })
        continue
      }

      const shift = shiftByWeekday[weekday]
      const punch = punchMap[dateStr]

      if (!punch) {
        result.push({ date: dateStr, label, weekday, isOff: false, isFuture: false, shift, status: 'absent', lateMinutes: 0, deduction: dailyRate, earned: 0 })
        continue
      }

      const scheduledStart = timeToMinutes(shift.start_time)
      const scheduledEnd = timeToMinutes(shift.end_time)
      const shiftDuration = Math.max(1, scheduledEnd - scheduledStart)
      const lateBy = Math.max(0, punch.firstMinute - scheduledStart - GRACE_MINUTES)
      const deduction = lateBy > 0 ? (lateBy / shiftDuration) * dailyRate : 0
      const status: 'present' | 'late' = lateBy > 0 ? 'late' : 'present'

      result.push({
        date: dateStr, label, weekday, isOff: false, isFuture: false, shift,
        status, lateMinutes: lateBy, deduction, earned: dailyRate - deduction,
      })
    }
    return { rows: result, dailyRate, workingDaysTotal }
  }, [month, offDays, shiftByWeekday, punchMap, monthlySalary])

  const workedRows = rows.rows.filter(r => r.status === 'present' || r.status === 'late')
  const totalEarned = workedRows.reduce((s, r) => s + r.earned, 0)
  const totalDeductions = rows.rows.reduce((s, r) => s + r.deduction, 0)
  const absentDays = rows.rows.filter(r => r.status === 'absent').length
  const lateDays = rows.rows.filter(r => r.status === 'late').length

  const netEarned = totalEarned - totalDeductions

  return (
    <Card>
      <CardContent className="px-5 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Monthly Salary</span>
          </div>
          <div className="flex items-center gap-1 text-sm">
            <button onClick={() => changeMonth(-1)} className="p-1 rounded hover:bg-muted transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-medium w-36 text-center text-sm">{monthLabel}</span>
            <button onClick={() => changeMonth(1)} className="p-1 rounded hover:bg-muted transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {punchLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="rounded-lg bg-green-50 border border-green-100 px-3 py-2.5">
              <p className="text-[10px] text-green-700 font-semibold uppercase tracking-wide mb-0.5">Earned so far</p>
              <p className="text-lg font-bold text-green-800 tabular-nums">{formatCurrency(netEarned)}</p>
            </div>
            <div className="rounded-lg bg-muted/50 border border-border/40 px-3 py-2.5">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">Monthly target</p>
              <p className="text-lg font-bold tabular-nums">{formatCurrency(monthlySalary)}</p>
            </div>
            <div className="rounded-lg bg-muted/50 border border-border/40 px-3 py-2.5">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">Days worked</p>
              <p className="text-lg font-bold tabular-nums">
                {workedRows.length}
                <span className="text-xs font-normal text-muted-foreground ml-1">/ {rows.workingDaysTotal}</span>
              </p>
            </div>
            <div className={`rounded-lg px-3 py-2.5 ${totalDeductions > 0 ? 'bg-amber-50 border border-amber-100' : 'bg-muted/50 border border-border/40'}`}>
              <p className={`text-[10px] font-semibold uppercase tracking-wide mb-0.5 ${totalDeductions > 0 ? 'text-amber-700' : 'text-muted-foreground'}`}>Late deductions</p>
              <p className={`text-lg font-bold tabular-nums ${totalDeductions > 0 ? 'text-amber-800' : 'text-muted-foreground'}`}>
                {totalDeductions > 0 ? `−${formatCurrency(totalDeductions)}` : '—'}
              </p>
            </div>
            <div className={`rounded-lg px-3 py-2.5 ${absentDays > 0 ? 'bg-red-50 border border-red-100' : 'bg-muted/50 border border-border/40'}`}>
              <p className={`text-[10px] font-semibold uppercase tracking-wide mb-0.5 ${absentDays > 0 ? 'text-red-700' : 'text-muted-foreground'}`}>Absent · Late</p>
              <p className={`text-sm font-bold tabular-nums mt-1 ${absentDays > 0 || lateDays > 0 ? 'text-red-700' : 'text-muted-foreground'}`}>
                {absentDays} absent · {lateDays} late
              </p>
            </div>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground/50 mt-3">
          Daily rate {formatCurrency(rows.dailyRate)} · {GRACE_MINUTES} min grace period for late arrivals
        </p>
      </CardContent>
    </Card>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TrainerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, hasRole } = useAuthStore()
  const queryClient = useQueryClient()
  const trainerId = Number(id)
  const isAdmin = hasRole(['owner'])
  const isAdminOrManager = hasRole(['owner', 'reception', 'manager'])

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
      <PageHeader
        title={`${firstName} ${lastName}`}
        titleBadge={<StatusBadge status={trainer.is_active ? 'active' : 'inactive'} />}
        subtitle="Trainer profile"
        icon={<AvatarWithFallback firstName={firstName} lastName={lastName} className="h-10 w-10 text-sm" />}
        onBack={() => navigate('/trainers')}
        backLabel="Back to Trainers"
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

      {/* Profile contact strip */}
      <Card>
        <CardContent className="px-6 py-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-foreground/65">
            {trainer.user?.phone && (
              <span className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" />
                {trainer.user.phone}
              </span>
            )}
            {trainer.user?.email && (
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {trainer.user.email}
              </span>
            )}
            {trainer.facility && (
              <span className="flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5" />
                {trainer.facility.name}
              </span>
            )}
            {trainer.bio && (
              <span className="text-muted-foreground leading-relaxed">{trainer.bio}</span>
            )}
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

      {/* Biometric Attendance */}
      <AttendanceSection trainerId={trainerId} />

      {/* Salary Breakdown */}
      <SalaryBreakdownSection
        trainerId={trainerId}
        trainer={trainer}
        monthlySalary={getTrainerSalary(trainer.id, trainer.hourly_rate ?? 0)}
      />

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
