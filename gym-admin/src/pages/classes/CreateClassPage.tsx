import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { classesApi } from '@/api/classes.api'
import { trainersApi } from '@/api/trainers.api'
import { facilitiesApi } from '@/api/facilities.api'
import { QUERY_KEYS } from '@/lib/constants'
import type { GymClass } from '@/types/class.types'
import type { Facility } from '@/types/facility.types'
import type { TrainerProfile } from '@/types/trainer.types'
import {
  CalendarPlus, ArrowLeft, Building2, User, Clock,
  Users, DollarSign, Repeat, Tag, FileText, Dumbbell,
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const CLASS_TYPES = [
  'yoga', 'pilates', 'crossfit', 'cycling', 'boxing',
  'swimming', 'hiit', 'other',
] as const

const DAYS_OF_WEEK = [
  'monday', 'tuesday', 'wednesday', 'thursday',
  'friday', 'saturday', 'sunday',
] as const

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  facility_id:     z.string().min(1, 'Facility is required'),
  trainer_id:      z.string().optional(),
  name:            z.string().min(1, 'Class name is required'),
  description:     z.string().optional(),
  class_type:      z.enum(CLASS_TYPES, { required_error: 'Class type is required' }),
  start_time:      z.string().min(1, 'Start time is required'),
  duration_mins:   z.coerce.number().int().min(1, 'Duration must be at least 1 minute'),
  max_capacity:    z.coerce.number().int().min(1, 'Capacity must be at least 1'),
  is_free:         z.boolean(),
  price:           z.coerce.number().min(0).optional(),
  is_recurring:    z.boolean(),
  recurring_days:  z.array(z.enum(DAYS_OF_WEEK)).optional(),
  recurring_until: z.string().optional(),
})
  .refine((d) => d.is_free || (d.price !== undefined && d.price >= 0), {
    message: 'Price is required when class is not free',
    path: ['price'],
  })
  .refine((d) => !d.is_recurring || (d.recurring_days && d.recurring_days.length > 0), {
    message: 'Select at least one recurring day',
    path: ['recurring_days'],
  })
  .refine((d) => !d.is_recurring || (d.recurring_until && d.recurring_until.length > 0), {
    message: 'Recurring until date is required',
    path: ['recurring_until'],
  })

type FormValues = z.infer<typeof schema>

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-0">
        <div
          className="flex items-center gap-3 px-6 py-3 rounded-t-xl"
          style={{ background: 'linear-gradient(135deg, #042B59 0%, #0553B1 60%, #027DFD 100%)' }}
        >
          <div className="h-7 w-7 rounded-lg bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
            {icon}
          </div>
          <h3 className="text-sm font-semibold text-white tracking-wide">{title}</h3>
        </div>
        <div className="p-6">{children}</div>
      </CardContent>
    </Card>
  )
}

function Field({ label, required, error, hint, children }: {
  label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreateClassPage() {
  const navigate   = useNavigate()
  const queryClient = useQueryClient()

  // Data fetches
  const { data: facilitiesData } = useQuery({
    queryKey: QUERY_KEYS.facilities,
    queryFn:  () => facilitiesApi.list(),
    staleTime: 5 * 60 * 1000,
  })
  const { data: trainersData } = useQuery({
    queryKey: QUERY_KEYS.trainers,
    queryFn:  () => trainersApi.list(true),
    staleTime: 5 * 60 * 1000,
  })

  const facilities: Facility[]       = (facilitiesData as { facilities?: Facility[] })?.facilities ?? []
  const trainers:   TrainerProfile[] = (trainersData   as { trainers?: TrainerProfile[] })?.trainers ?? []

  // Form
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      is_free:        false,
      is_recurring:   false,
      recurring_days: [],
      duration_mins:  60,
      max_capacity:   20,
    },
  })

  const isFree      = watch('is_free')
  const isRecurring = watch('is_recurring')
  const recurringDays = watch('recurring_days') ?? []

  // Mutation
  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      const payload: Record<string, unknown> = {
        facility_id:   Number(data.facility_id),
        trainer_id:    data.trainer_id && data.trainer_id !== 'none' ? Number(data.trainer_id) : undefined,
        name:          data.name,
        description:   data.description ?? '',
        class_type:    data.class_type,
        start_time:    new Date(data.start_time).toISOString(),
        duration_mins: data.duration_mins,
        max_capacity:  data.max_capacity,
        is_free:       data.is_free,
        price:         data.is_free ? 0 : (data.price ?? 0),
        is_recurring:  data.is_recurring,
      }
      if (data.is_recurring) {
        payload.recurring_days  = data.recurring_days
        payload.recurring_until = data.recurring_until ? new Date(data.recurring_until).toISOString() : undefined
      }
      return classesApi.create(payload)
    },
    onSuccess: (res: GymClass) => {
      queryClient.invalidateQueries({ queryKey: ['classes'] })
      toast.success('Class created successfully!')
      navigate(res?.id ? `/classes/${res.id}` : '/classes')
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create class'),
  })

  return (
    <div className="min-h-screen flex flex-col">

      {/* ── Header ── */}
      <div className="relative overflow-hidden shrink-0" style={{ minHeight: 160 }}>
        {/* Gradient */}
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg, #021d3d 0%, #042B59 30%, #0553B1 60%, #027DFD 85%, #60a5fa 100%)' }} />
        {/* Glow */}
        <div className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at 85% 50%, rgba(186,230,253,0.4) 0%, transparent 55%)' }} />
        {/* Dot pattern */}
        <div className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
        {/* Vignette */}
        <div className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at 0% 0%, rgba(0,0,0,0.3) 0%, transparent 50%)' }} />

        {/* Content row */}
        <div className="relative px-8 py-8 flex items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div
              className="h-16 w-16 rounded-2xl flex items-center justify-center shrink-0 border border-white/20 shadow-lg"
              style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}
            >
              <CalendarPlus className="h-8 w-8 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-light tracking-[0.25em] text-white/60 uppercase mb-1">
                Classes Management
              </p>
              <h1 className="text-3xl font-bold text-white tracking-tight drop-shadow">
                Create New Class
              </h1>
              <p className="text-sm text-white/70 mt-1 font-light">
                Schedule a new fitness class, assign a trainer and set capacity
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate('/classes')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all"
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', backdropFilter: 'blur(4px)' }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Classes
          </button>
        </div>

        {/* Stats strip */}
        <div
          className="relative grid grid-cols-4 px-8 pb-6 gap-4"
          style={{ borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: 14 }}
        >
          {[
            { label: 'Required Fields',  value: '6',           sub: 'facility, name, type…' },
            { label: 'Optional Fields',  value: '4',           sub: 'trainer, price, notes…' },
            { label: 'Class Types',      value: CLASS_TYPES.length, sub: 'yoga, hiit, boxing…' },
            { label: 'Recurring Support', value: 'Yes',        sub: 'set days & end date' },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-3"
              style={{ borderRight: i < 3 ? '1px solid rgba(255,255,255,0.15)' : 'none', paddingRight: i < 3 ? 16 : 0 }}>
              <div>
                <span className="text-xl font-bold text-white block">{s.value}</span>
                <span className="text-xs text-white/70 font-light">{s.label}</span>
                <span className="text-[10px] text-white/50 block">{s.sub}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Form body ── */}
      <div className="flex-1 p-8 max-w-6xl w-full mx-auto">
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* ── Basic Info ── */}
            <Section icon={<Dumbbell className="h-4 w-4 text-white" />} title="Basic Information">
              <div className="space-y-4">
                <Field label="Class Name" required error={errors.name?.message}>
                  <Input {...register('name')} placeholder="e.g. Morning HIIT Blast" className="h-10" />
                </Field>

                <Field label="Class Type" required error={errors.class_type?.message}>
                  <Controller
                    name="class_type"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value ?? ''} onValueChange={field.onChange} className="w-full h-10">
                        <option value="">Select type…</option>
                        {CLASS_TYPES.map((t) => (
                          <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                        ))}
                      </Select>
                    )}
                  />
                </Field>

                <Field label="Description" error={errors.description?.message}>
                  <Textarea {...register('description')} placeholder="Brief description of the class…" rows={3} />
                </Field>
              </div>
            </Section>

            {/* ── Facility & Trainer ── */}
            <Section icon={<Building2 className="h-4 w-4 text-white" />} title="Facility & Trainer">
              <div className="space-y-4">
                <Field label="Facility" required error={errors.facility_id?.message}>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Controller
                      name="facility_id"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value ?? ''} onValueChange={field.onChange} className="w-full h-10 pl-9">
                          <option value="">Select facility…</option>
                          {facilities.map((f) => (
                            <option key={f.id} value={String(f.id)}>{f.name}</option>
                          ))}
                        </Select>
                      )}
                    />
                  </div>
                </Field>

                <Field label="Trainer" hint="Optional — leave blank for no assigned trainer">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Controller
                      name="trainer_id"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value ?? 'none'} onValueChange={field.onChange} className="w-full h-10 pl-9">
                          <option value="none">No trainer (optional)</option>
                          {trainers.map((t) => (
                            <option key={t.id} value={String(t.id)}>
                              {t.user ? `${t.user.first_name} ${t.user.last_name}` : `Trainer #${t.id}`}
                            </option>
                          ))}
                        </Select>
                      )}
                    />
                  </div>
                </Field>
              </div>
            </Section>

            {/* ── Schedule ── */}
            <Section icon={<Clock className="h-4 w-4 text-white" />} title="Schedule">
              <div className="space-y-4">
                <Field label="Start Date & Time" required error={errors.start_time?.message}>
                  <Input type="datetime-local" {...register('start_time')} className="h-10" />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Duration (mins)" required error={errors.duration_mins?.message}>
                    <Input type="number" {...register('duration_mins')} placeholder="60" min={1} className="h-10" />
                  </Field>
                  <Field label="Max Capacity" required error={errors.max_capacity?.message}>
                    <Input type="number" {...register('max_capacity')} placeholder="20" min={1} className="h-10" />
                  </Field>
                </div>
              </div>
            </Section>

            {/* ── Pricing ── */}
            <Section icon={<DollarSign className="h-4 w-4 text-white" />} title="Capacity & Pricing">
              <div className="space-y-4">
                {/* Free toggle */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                  <input
                    type="checkbox"
                    id="is_free"
                    {...register('is_free')}
                    className="h-4 w-4 rounded border-emerald-400 accent-emerald-600"
                  />
                  <div>
                    <Label htmlFor="is_free" className="text-sm font-medium text-emerald-800 cursor-pointer">
                      Free Class
                    </Label>
                    <p className="text-xs text-emerald-600 mt-0.5">Members can book without payment</p>
                  </div>
                </div>

                {/* Price field — shown only when not free */}
                {!isFree && (
                  <Field label="Price" required error={errors.price?.message} hint="Price per booking in your currency">
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        {...register('price')}
                        placeholder="0.00"
                        className="h-10 pl-9"
                      />
                    </div>
                  </Field>
                )}

                {isFree && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">
                    <DollarSign className="h-3.5 w-3.5 shrink-0" />
                    Price will be set to ₹0 automatically for free classes.
                  </div>
                )}
              </div>
            </Section>

            {/* ── Recurring ── */}
            <Section icon={<Repeat className="h-4 w-4 text-white" />} title="Recurring Schedule">
              <div className="space-y-4">
                {/* Recurring toggle */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-violet-50 border border-violet-200">
                  <input
                    type="checkbox"
                    id="is_recurring"
                    {...register('is_recurring')}
                    className="h-4 w-4 rounded border-violet-400 accent-violet-600"
                  />
                  <div>
                    <Label htmlFor="is_recurring" className="text-sm font-medium text-violet-800 cursor-pointer">
                      Recurring Class
                    </Label>
                    <p className="text-xs text-violet-600 mt-0.5">Repeat this class on selected days each week</p>
                  </div>
                </div>

                {isRecurring && (
                  <>
                    {/* Days of week */}
                    <Field label="Repeat on Days" required error={errors.recurring_days?.message}>
                      <div className="grid grid-cols-4 gap-2 mt-1">
                        {DAYS_OF_WEEK.map((day) => {
                          const isSelected = recurringDays.includes(day)
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => {
                                const current = recurringDays
                                const updated = isSelected
                                  ? current.filter((d) => d !== day)
                                  : [...current, day]
                                setValue('recurring_days', updated, { shouldValidate: true })
                              }}
                              className={`py-1.5 px-2 rounded-lg text-xs font-medium capitalize border transition-all ${
                                isSelected
                                  ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                                  : 'bg-white text-muted-foreground border-border hover:border-violet-400 hover:text-violet-700'
                              }`}
                            >
                              {day.slice(0, 3)}
                            </button>
                          )
                        })}
                      </div>
                    </Field>

                    <Field label="Recurring Until" required error={errors.recurring_until?.message}
                      hint="Last date for the recurring series">
                      <Input type="date" {...register('recurring_until')} className="h-10" />
                    </Field>
                  </>
                )}

                {!isRecurring && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">
                    <Repeat className="h-3.5 w-3.5 shrink-0" />
                    Enable recurring to repeat this class weekly on chosen days.
                  </div>
                )}
              </div>
            </Section>

            {/* ── Summary card ── */}
            <Section icon={<FileText className="h-4 w-4 text-white" />} title="Quick Summary">
              <div className="space-y-3">
                <SummaryRow label="Class Name"  value={watch('name') || '—'} />
                <SummaryRow label="Type"        value={watch('class_type') || '—'} capitalize />
                <SummaryRow label="Duration"    value={watch('duration_mins') ? `${watch('duration_mins')} mins` : '—'} />
                <SummaryRow label="Capacity"    value={watch('max_capacity') ? `${watch('max_capacity')} spots` : '—'} />
                <SummaryRow label="Pricing"     value={isFree ? 'Free' : watch('price') != null ? `₹${watch('price')}` : '—'} />
                <SummaryRow label="Recurring"   value={isRecurring ? `Yes — ${recurringDays.length} day(s)/week` : 'No (one-time)'} />
              </div>
              <div className="mt-4 p-3 rounded-lg bg-sky-50 border border-sky-200 text-xs text-sky-700">
                <strong>Note:</strong> After creating the class, members can book their spots from the class detail page.
              </div>
            </Section>

          </div>

          {/* ── Submit bar ── */}
          <div className="mt-8 flex items-center justify-between p-5 rounded-2xl border bg-card shadow-md">
            <div>
              <p className="text-sm font-medium">Ready to schedule this class?</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isRecurring
                  ? 'A recurring series will be created based on the selected days and end date.'
                  : 'A one-time class will be created. You can make it recurring later.'}
              </p>
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => navigate('/classes')} disabled={mutation.isPending}>
                <ArrowLeft className="h-4 w-4" />
                Cancel
              </Button>
              <Button type="submit" loading={mutation.isPending} className="px-8">
                <CalendarPlus className="h-4 w-4" />
                Create Class
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Summary row helper ────────────────────────────────────────────────────────

function SummaryRow({ label, value, capitalize }: { label: string; value: string | number; capitalize?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-muted last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-xs font-medium ${capitalize ? 'capitalize' : ''}`}>{value}</span>
    </div>
  )
}
