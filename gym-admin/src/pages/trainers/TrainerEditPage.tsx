import { useEffect, useState, KeyboardEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { trainersApi } from '@/api/trainers.api'
import { facilitiesApi } from '@/api/facilities.api'
import { QUERY_KEYS } from '@/lib/constants'
import { getTrainerSalary, saveTrainerSalary, getTrainerDocs, saveTrainerDocs } from '@/lib/service-types'

// ── TimeSelect ────────────────────────────────────────────────────────────────

const HOURS   = Array.from({ length: 12 }, (_, i) => i + 1)
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5)

function parseTime(val: string): { h: number; m: number; period: 'AM' | 'PM' } {
  const [hStr, mStr] = (val || '').split(':')
  const h24 = parseInt(hStr || '0', 10)
  const m   = parseInt(mStr || '0', 10)
  if (isNaN(h24) || isNaN(m)) return { h: 6, m: 0, period: 'AM' }
  const period = h24 < 12 ? 'AM' : 'PM'
  const h = h24 % 12 === 0 ? 12 : h24 % 12
  return { h, m, period }
}

function formatTime(h: number, m: number, period: 'AM' | 'PM'): string {
  const h24 = period === 'AM' ? (h === 12 ? 0 : h) : (h === 12 ? 12 : h + 12)
  return `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parsed = parseTime(value)
  const [h, setH]           = useState(parsed.h)
  const [m, setM]           = useState(parsed.m)
  const [period, setPeriod] = useState<'AM' | 'PM'>(parsed.period)

  useEffect(() => {
    const p = parseTime(value)
    setH(p.h); setM(p.m); setPeriod(p.period)
  }, [value])

  const update = (nh: number, nm: number, np: 'AM' | 'PM') => {
    setH(nh); setM(nm); setPeriod(np)
    onChange(formatTime(nh, nm, np))
  }

  const selCls = 'h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

  return (
    <div className="flex items-center gap-1">
      <select value={h} onChange={e => update(Number(e.target.value), m, period)} className={`${selCls} w-14`}>
        {HOURS.map(hr => <option key={hr} value={hr}>{hr}</option>)}
      </select>
      <span className="text-muted-foreground font-medium">:</span>
      <select value={m} onChange={e => update(h, Number(e.target.value), period)} className={`${selCls} w-16`}>
        {MINUTES.map(mn => <option key={mn} value={mn}>{String(mn).padStart(2, '0')}</option>)}
      </select>
      <div className="flex rounded-md border border-input overflow-hidden text-xs font-medium">
        {(['AM', 'PM'] as const).map(p => (
          <button key={p} type="button" onClick={() => update(h, m, p)}
            className={`px-2.5 py-1.5 transition-colors ${period === p ? 'bg-[#0096b4] text-white' : 'bg-background text-muted-foreground hover:bg-muted'}`}>
            {p}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── DaySelector ───────────────────────────────────────────────────────────────

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function DaySelector({ value, onChange }: { value: number[]; onChange: (days: number[]) => void }) {
  const toggle = (d: number) => {
    if (value.includes(d)) onChange(value.filter(x => x !== d))
    else onChange([...value, d].sort((a, b) => a - b))
  }
  return (
    <div className="flex gap-1.5 flex-wrap">
      {DAY_LABELS.map((day, i) => (
        <button key={i} type="button" onClick={() => toggle(i)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
            value.includes(i)
              ? 'border-transparent bg-gradient-to-r from-[#00b09b] to-[#5b86e5] text-white shadow-sm'
              : 'border-border text-muted-foreground hover:border-[#0096b4]/50'
          }`}>
          {day}
        </button>
      ))}
    </div>
  )
}

// ── ShiftPreviewModal ─────────────────────────────────────────────────────────

function fmt12(val: string): { time: string; period: 'AM' | 'PM' } {
  const { h, m, period } = parseTime(val)
  return { time: `${h}:${String(m).padStart(2, '0')}`, period }
}

function ShiftBlock({ label, start, end }: { label: string; start: string; end: string }) {
  const s = fmt12(start)
  const e = fmt12(end)
  return (
    <div className="flex-1 rounded-2xl border border-border bg-muted/40 px-6 py-5 flex flex-col gap-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{label}</p>
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col items-center gap-1">
          <span className="text-4xl font-bold tracking-tight leading-none">{s.time}</span>
          <span className={`text-sm font-bold px-3 py-0.5 rounded-full ${s.period === 'AM' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>
            {s.period}
          </span>
        </div>
        <div className="flex flex-col items-center gap-1 text-muted-foreground">
          <div className="h-px w-10 bg-border" />
          <span className="text-[10px] font-medium">TO</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-4xl font-bold tracking-tight leading-none">{e.time}</span>
          <span className={`text-sm font-bold px-3 py-0.5 rounded-full ${e.period === 'AM' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>
            {e.period}
          </span>
        </div>
      </div>
    </div>
  )
}

function ShiftPreviewModal({
  open, onClose, shiftType, shift1Start, shift1End, shift2Start, shift2End,
}: {
  open: boolean; onClose: () => void
  shiftType: 'single' | 'double'
  shift1Start: string; shift1End: string
  shift2Start: string; shift2End: string
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-xl rounded-2xl border border-border bg-background shadow-2xl p-6 space-y-5"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">Shift Timings</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {shiftType === 'double' ? 'Double shift — two sessions per day' : 'Single shift — one session per day'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors mt-0.5">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className={`flex gap-4 ${shiftType === 'double' ? 'flex-col sm:flex-row' : ''}`}>
          <ShiftBlock label={shiftType === 'double' ? 'Shift 1' : 'Shift'} start={shift1Start} end={shift1End} />
          {shiftType === 'double' && (
            <ShiftBlock label="Shift 2" start={shift2Start} end={shift2End} />
          )}
        </div>
        <div className="flex justify-end pt-1">
          <Button onClick={onClose} className="bg-[#0096b4] hover:bg-[#007a94] text-white px-6">Looks Good</Button>
        </div>
      </div>
    </div>
  )
}

// ── TagInput ──────────────────────────────────────────────────────────────────

function TagInput({ value, onChange, placeholder }: {
  value: string[]; onChange: (tags: string[]) => void; placeholder?: string
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
        <Input value={inputVal} onChange={e => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown} onBlur={addTag}
          placeholder={placeholder ?? 'Type and press Enter'} className="flex-1" />
        <Button type="button" variant="outline" size="sm" onClick={addTag}>Add</Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map(tag => (
            <Badge key={tag} variant="secondary" className="text-xs gap-1">
              {tag}
              <button type="button" onClick={() => onChange(value.filter(t => t !== tag))}
                className="ml-0.5 hover:text-destructive"><X className="h-2.5 w-2.5" /></button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  first_name:      z.string().min(1, 'Required'),
  last_name:       z.string().min(1, 'Required'),
  phone:           z.string().min(1, 'Required'),
  email:           z.union([z.string().email('Invalid email'), z.literal('')]).optional(),
  secondary_phone: z.string().optional(),
  date_of_birth:   z.string().optional(),
  city:            z.string().optional(),
  address:         z.string().optional(),
  shift_type:      z.enum(['single', 'double']).default('single'),
  working_days:    z.array(z.number()).min(1, 'Select at least one working day'),
  shift1_start:    z.string().min(1, 'Required'),
  shift1_end:      z.string().min(1, 'Required'),
  shift2_start:    z.string().optional(),
  shift2_end:      z.string().optional(),
  facility_id:     z.coerce.number().optional(),
  bio:             z.string().optional(),
  experience_years:    z.coerce.number().min(0).max(50),
  hourly_rate:         z.coerce.number().min(0),
  max_clients_per_day: z.coerce.number().min(1).max(100),
  specializations: z.array(z.string()),
  certifications:  z.array(z.string()),
  pan_number:      z.string().optional(),
  aadhar_number:   z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.shift_type === 'double') {
    if (!data.shift2_start) ctx.addIssue({ path: ['shift2_start'], code: 'custom', message: 'Required' })
    if (!data.shift2_end)   ctx.addIssue({ path: ['shift2_end'],   code: 'custom', message: 'Required' })
  }
})

type FormValues = z.infer<typeof schema>

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TrainerEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const trainerId = Number(id)

  const [showShiftPreview, setShowShiftPreview] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.trainer(trainerId),
    queryFn: () => trainersApi.getById(trainerId),
    enabled: !!trainerId,
  })

  const { data: facilitiesData } = useQuery({
    queryKey: QUERY_KEYS.facilities,
    queryFn: () => facilitiesApi.list(),
  })
  const facilities = facilitiesData?.facilities ?? []

  const { data: scheduleData } = useQuery({
    queryKey: ['trainers', trainerId, 'schedule'],
    queryFn: () => trainersApi.getSchedule(trainerId),
    enabled: !!trainerId,
  })

  const trainer = (data as any)?.trainer ?? data

  const { register, control, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: '', last_name: '', phone: '', email: '',
      secondary_phone: '', date_of_birth: '', city: '', address: '',
      shift_type: 'single', working_days: [0, 1, 2, 3, 4, 5],
      shift1_start: '06:00', shift1_end: '14:00',
      shift2_start: '14:00', shift2_end: '22:00',
      bio: '', experience_years: 0, hourly_rate: 0,
      max_clients_per_day: 10, specializations: [], certifications: [],
      pan_number: '', aadhar_number: '',
    },
  })

  useEffect(() => {
    if (!trainer) return

    // Derive shift type/times from schedule: collect unique start+end pairs
    const shifts = (scheduleData as any)?.shifts ?? []
    const unique = Array.from(
      new Map(shifts.map((s: any) => [`${s.start_time}-${s.end_time}`, s])).values()
    ) as any[]

    const shiftType   = unique.length >= 2 ? 'double' : 'single'
    const shift1Start = unique[0]?.start_time ?? '06:00'
    const shift1End   = unique[0]?.end_time   ?? '14:00'
    const shift2Start = unique[1]?.start_time ?? '14:00'
    const shift2End   = unique[1]?.end_time   ?? '22:00'
    const workingDays = shifts.length > 0
      ? [...new Set(shifts.map((s: any) => s.day_of_week as number))].sort((a, b) => a - b)
      : [0, 1, 2, 3, 4, 5]

    const stripPrefix = (p: string) => p?.startsWith('+91') ? p.slice(3).trim() : p ?? ''
    reset({
      first_name:      trainer.user?.first_name ?? '',
      last_name:       trainer.user?.last_name ?? '',
      phone:           stripPrefix(trainer.user?.phone ?? ''),
      email:           trainer.user?.email ?? '',
      secondary_phone: stripPrefix(trainer.user?.secondary_phone ?? ''),
      date_of_birth:   trainer.user?.date_of_birth ?? '',
      city:            trainer.user?.city ?? '',
      address:         trainer.user?.address ?? '',
      shift_type:      shiftType,
      working_days:    workingDays,
      shift1_start:    shift1Start,
      shift1_end:      shift1End,
      shift2_start:    shift2Start,
      shift2_end:      shift2End,
      facility_id:     trainer.facility_id,
      bio:             trainer.bio ?? '',
      experience_years:    trainer.experience_years ?? 0,
      hourly_rate:         getTrainerSalary(trainerId, trainer.hourly_rate ?? 0),
      max_clients_per_day: trainer.max_clients_per_day ?? 10,
      specializations: trainer.specializations ?? [],
      certifications:  trainer.certifications ?? [],
      pan_number:      getTrainerDocs(trainerId).pan_number ?? '',
      aadhar_number:   getTrainerDocs(trainerId).aadhar_number ?? '',
    })
  }, [trainer, scheduleData, reset, trainerId])

  // Auto-select single facility
  useEffect(() => {
    if (facilities.length > 0 && !trainer?.facility_id) {
      setValue('facility_id', facilities[0].id)
    }
  }, [facilities.length])

  const shiftType   = watch('shift_type')
  const workingDays = watch('working_days') ?? [0, 1, 2, 3, 4, 5]
  const shift1Start = watch('shift1_start') ?? '06:00'
  const shift1End   = watch('shift1_end')   ?? '14:00'
  const shift2Start = watch('shift2_start') ?? '14:00'
  const shift2End   = watch('shift2_end')   ?? '22:00'

  const updateMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const prefix = '+91'
      const phone = data.phone && !data.phone.startsWith('+') ? prefix + data.phone : data.phone
      const secondaryPhone = data.secondary_phone && !data.secondary_phone.startsWith('+')
        ? prefix + data.secondary_phone : data.secondary_phone
      saveTrainerSalary(trainerId, data.hourly_rate)
      saveTrainerDocs(trainerId, { pan_number: data.pan_number, aadhar_number: data.aadhar_number })

      // Save shift timings to schedule (delete old, create new for all 7 days)
      const existingShifts = (scheduleData as any)?.shifts ?? []
      await Promise.all(existingShifts.map((s: any) =>
        trainersApi.deleteShift(trainerId, s.id).catch(() => null)
      ))
      const days = data.working_days
      const shiftEntries = data.shift_type === 'double'
        ? [
            { start_time: data.shift1_start, end_time: data.shift1_end },
            { start_time: data.shift2_start!, end_time: data.shift2_end! },
          ]
        : [{ start_time: data.shift1_start, end_time: data.shift1_end }]
      for (const entry of shiftEntries) {
        for (const day of days) {
          await trainersApi.createShift(trainerId, { day_of_week: day, ...entry, breaks: [], notes: '' })
        }
      }

      return trainersApi.update(trainerId, {
        ...data,
        phone,
        secondary_phone: secondaryPhone,
      } as Record<string, unknown>)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.trainers })
      qc.invalidateQueries({ queryKey: QUERY_KEYS.trainer(trainerId) })
      toast.success('Trainer updated successfully')
      navigate(`/trainers/${trainerId}`)
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to update trainer'),
  })

  const firstName = trainer?.user?.first_name ?? ''
  const lastName  = trainer?.user?.last_name ?? ''

  const selectClass = 'w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

  if (isLoading) {
    return <div className="py-10 text-sm text-muted-foreground">Loading trainer…</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" title="Back" onClick={() => navigate(`/trainers/${trainerId}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Edit Trainer</h1>
          <p className="text-sm text-muted-foreground">{firstName} {lastName}</p>
        </div>
      </div>

      <form id="trainer-edit-form" onSubmit={handleSubmit(d => updateMutation.mutate(d))} className="space-y-5">

        {/* Personal Information */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Row 1: First Name | Last Name | Phone */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>First Name <span className="text-destructive">*</span></Label>
                <Input {...register('first_name')} placeholder="First name" />
                {errors.first_name && <p className="text-xs text-destructive">{errors.first_name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Last Name <span className="text-destructive">*</span></Label>
                <Input {...register('last_name')} placeholder="Last name" />
                {errors.last_name && <p className="text-xs text-destructive">{errors.last_name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Phone <span className="text-destructive">*</span></Label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground text-sm">+91</span>
                  <Input {...register('phone')} placeholder="98765 43210" className="rounded-l-none" />
                </div>
                {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
              </div>
            </div>

            {/* Row 2: Email | Password (blank, change not supported here) */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input {...register('email')} type="email" placeholder="trainer@gym.com" />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
            </div>

            {/* Row 3: DOB | City | Secondary Phone */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Date of Birth</Label>
                <Input {...register('date_of_birth')} type="date" />
              </div>
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input {...register('city')} placeholder="Mumbai" />
              </div>
              <div className="space-y-1.5">
                <Label>Secondary Phone</Label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground text-sm">+91</span>
                  <Input {...register('secondary_phone')} placeholder="98765 43210" className="rounded-l-none" />
                </div>
              </div>
            </div>

            {/* Row 4: Address */}
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Textarea {...register('address')} placeholder="Street, area, landmark…" rows={2} />
            </div>

          </CardContent>
        </Card>

        {/* Shift Timings */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Shift Timings</CardTitle>
            <button type="button" onClick={() => setShowShiftPreview(true)}
              className="text-xs font-medium text-[#0096b4] hover:underline">
              Preview timings
            </button>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Working days */}
            <div className="space-y-1.5">
              <Label>Working Days</Label>
              <Controller control={control} name="working_days"
                render={({ field }) => <DaySelector value={field.value} onChange={field.onChange} />} />
              {errors.working_days && <p className="text-xs text-destructive">{errors.working_days.message as string}</p>}
            </div>

            <div className="flex gap-2">
              {(['single', 'double'] as const).map(type => (
                <label key={type} className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer text-sm font-medium transition-colors ${
                  shiftType === type
                    ? 'border-[#0096b4] bg-[#0096b4]/5 text-[#0096b4]'
                    : 'border-border text-muted-foreground hover:border-[#0096b4]/50'
                }`}>
                  <input type="radio" {...register('shift_type')} value={type} className="sr-only" />
                  {type === 'single' ? 'Single Shift' : 'Double Shift'}
                </label>
              ))}
            </div>

            <div className={`grid gap-x-6 gap-y-4 ${shiftType === 'double' ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 max-w-lg'}`}>
              <div className="space-y-1.5">
                <Label>{shiftType === 'double' ? 'Shift 1 From' : 'From'} <span className="text-destructive">*</span></Label>
                <Controller control={control} name="shift1_start"
                  render={({ field }) => <TimeSelect value={field.value ?? ''} onChange={field.onChange} />} />
                {errors.shift1_start && <p className="text-xs text-destructive">{errors.shift1_start.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>{shiftType === 'double' ? 'Shift 1 To' : 'To'} <span className="text-destructive">*</span></Label>
                <Controller control={control} name="shift1_end"
                  render={({ field }) => <TimeSelect value={field.value ?? ''} onChange={field.onChange} />} />
                {errors.shift1_end && <p className="text-xs text-destructive">{errors.shift1_end.message}</p>}
              </div>
              {shiftType === 'double' && (
                <>
                  <div className="space-y-1.5">
                    <Label>Shift 2 From <span className="text-destructive">*</span></Label>
                    <Controller control={control} name="shift2_start"
                      render={({ field }) => <TimeSelect value={field.value ?? ''} onChange={field.onChange} />} />
                    {errors.shift2_start && <p className="text-xs text-destructive">{errors.shift2_start.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Shift 2 To <span className="text-destructive">*</span></Label>
                    <Controller control={control} name="shift2_end"
                      render={({ field }) => <TimeSelect value={field.value ?? ''} onChange={field.onChange} />} />
                    {errors.shift2_end && <p className="text-xs text-destructive">{errors.shift2_end.message}</p>}
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Professional Details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Professional Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label>Experience (yrs)</Label>
                <Input {...register('experience_years')} type="number" min={0} />
                {errors.experience_years && <p className="text-xs text-destructive">{errors.experience_years.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Salary (₹/mo)</Label>
                <Input {...register('hourly_rate')} type="number" min={0} step="500" />
                {errors.hourly_rate && <p className="text-xs text-destructive">{errors.hourly_rate.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Max Clients/Day</Label>
                <Input {...register('max_clients_per_day')} type="number" min={1} />
                {errors.max_clients_per_day && <p className="text-xs text-destructive">{errors.max_clients_per_day.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Facility</Label>
                <select {...register('facility_id')} className={selectClass}>
                  <option value="">Select…</option>
                  {facilities.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                {errors.facility_id && <p className="text-xs text-destructive">{errors.facility_id.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Bio</Label>
              <Textarea {...register('bio')} placeholder="Short trainer bio…" rows={3} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Specializations</Label>
                <Controller control={control} name="specializations"
                  render={({ field }) => (
                    <TagInput value={field.value} onChange={field.onChange} placeholder="e.g. Yoga, CrossFit…" />
                  )} />
              </div>
              <div className="space-y-1.5">
                <Label>Certifications</Label>
                <Controller control={control} name="certifications"
                  render={({ field }) => (
                    <TagInput value={field.value} onChange={field.onChange} placeholder="e.g. ACE CPT, NASM…" />
                  )} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ID Documents */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">ID Documents</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>PAN Number</Label>
              <Input {...register('pan_number')} placeholder="ABCDE1234F" className="uppercase" />
            </div>
            <div className="space-y-1.5">
              <Label>Aadhar Number</Label>
              <Input {...register('aadhar_number')} placeholder="XXXX XXXX XXXX" />
            </div>
          </CardContent>
        </Card>

        <div className="h-20" />
      </form>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-end gap-2 border-t border-border bg-background/95 backdrop-blur px-6 py-3">
        <Button type="button" variant="outline" onClick={() => navigate(`/trainers/${trainerId}`)}>
          Cancel
        </Button>
        <Button type="submit" form="trainer-edit-form" disabled={updateMutation.isPending}>
          {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>

      {/* Shift preview modal */}
      <ShiftPreviewModal
        open={showShiftPreview}
        onClose={() => setShowShiftPreview(false)}
        shiftType={shiftType}
        shift1Start={shift1Start}
        shift1End={shift1End}
        shift2Start={shift2Start}
        shift2End={shift2End}
      />
    </div>
  )
}
