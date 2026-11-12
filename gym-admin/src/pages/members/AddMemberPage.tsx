import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { membersApi } from '@/api/members.api'
import { facilitiesApi } from '@/api/facilities.api'
import { plansApi } from '@/api/plans.api'
import { classesApi } from '@/api/classes.api'
import { subscriptionsApi } from '@/api/subscriptions.api'
import { bookingsApi } from '@/api/bookings.api'
import { dayPassesApi } from '@/api/day-passes.api'
import { QUERY_KEYS } from '@/lib/constants'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Facility } from '@/types/facility.types'
import type { Plan } from '@/types/plan.types'
import type { GymClass } from '@/types/class.types'
import {
  UserPlus, ArrowLeft, User, Mail, Phone, Lock,
  Calendar, Users, Building2, Shield, Ticket,
  CreditCard, Dumbbell, Check, ChevronRight,
  Clock, Star, Activity, Heart,
} from 'lucide-react'

// ─── Schema ───────────────────────────────────────────────────────────────────

const memberSchema = z.object({
  first_name:    z.string().min(1, 'First name is required'),
  last_name:     z.string().min(1, 'Last name is required'),
  email:         z.string().email('Invalid email address'),
  phone:         z.string().min(7, 'Phone is required'),
  password:      z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  date_of_birth: z.string().optional(),
  gender:        z.enum(['male', 'female', 'other']).optional(),
  facility_id:   z.coerce.number().min(1, 'Facility is required'),
  height_cm:     z.coerce.number().int().positive().optional().or(z.literal('')),
  weight_kg:     z.coerce.number().positive().optional().or(z.literal('')),
  emergency_contact_name:         z.string().optional(),
  emergency_contact_phone:        z.string().optional(),
  emergency_contact_relationship: z.string().optional(),
  member_notes:  z.string().optional(),
  batch_time:    z.string().optional(),
})

const dayPassSchema = z.object({
  guest_name:    z.string().min(1, 'Guest name is required'),
  guest_email:   z.string().email('Invalid email').or(z.literal('')).optional(),
  guest_phone:   z.string().min(7, 'Phone is required'),
  guest_city:    z.string().optional(),
  guest_dob:     z.string().optional(),
  facility_id:   z.coerce.number().min(1, 'Facility is required'),
  activity_type: z.string().min(1, 'Activity is required'),
  pass_date:     z.string().min(1, 'Pass date is required'),
  price:         z.coerce.number().min(0),
  notes:         z.string().optional(),
})

type MemberFormValues  = z.infer<typeof memberSchema>
type DayPassFormValues = z.infer<typeof dayPassSchema>

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTIVITY_OPTIONS = [
  { value: 'gym',      label: 'Gym',      emoji: '🏋️' },
  { value: 'yoga',     label: 'Yoga',     emoji: '🧘' },
  { value: 'zumba',    label: 'Zumba',    emoji: '💃' },
  { value: 'swimming', label: 'Swimming', emoji: '🏊' },
  { value: 'crossfit', label: 'CrossFit', emoji: '⚡' },
  { value: 'cycling',  label: 'Cycling',  emoji: '🚴' },
  { value: 'aerobics', label: 'Aerobics', emoji: '🤸' },
  { value: 'pilates',  label: 'Pilates',  emoji: '🧗' },
  { value: 'boxing',   label: 'Boxing',   emoji: '🥊' },
  { value: 'other',    label: 'Other',    emoji: '🎯' },
] as const

const MEDICAL_CONDITIONS = [
  'Diabetes T2', 'Pre-diabetes', 'Hypertension', 'Thyroid (Hypo)',
  'Thyroid (Hyper)', 'PCOS/PCOD', 'Heart Disease', 'High Cholesterol',
  'Asthma', 'Fatty Liver', 'Osteoporosis', 'Sleep Apnea',
  'Depression/Anxiety', 'Recent Surgery',
]

const RELATIONSHIPS = [
  'Spouse', 'Parent', 'Child', 'Sibling', 'Relative',
  'Friend', 'Colleague', 'Guardian', 'Other',
]

const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Sedentary',  sub: 'Desk job, little movement' },
  { value: 'light',     label: 'Light',      sub: 'Light exercise 1–2×/week' },
  { value: 'moderate',  label: 'Moderate',   sub: 'Active 3–4×/week' },
  { value: 'active',    label: 'Active',     sub: 'Daily exercise or physical job' },
]

// ─── UI helpers ───────────────────────────────────────────────────────────────

function SectionHeader({ num, icon, title, subtitle }: {
  num: number; icon: React.ReactNode; title: string; subtitle?: string
}) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 text-white text-xs font-bold"
        className="bg-sky-500">
        {num}
      </div>
      <div className="h-8 w-8 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center shrink-0 text-sky-600">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-bold text-slate-800 tracking-wide">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

function Field({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-6">
      <div className="flex-1 h-px bg-slate-200" />
      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest px-1">{label}</span>
      <div className="flex-1 h-px bg-slate-200" />
    </div>
  )
}

function toHeightCm(unit: 'cm' | 'in' | 'ft', cm: string, inches: string, ft: string, ftIn: string): number | undefined {
  if (unit === 'cm') {
    const v = parseFloat(cm)
    return isNaN(v) || v <= 0 ? undefined : Math.round(v)
  }
  if (unit === 'in') {
    const v = parseFloat(inches)
    return isNaN(v) || v <= 0 ? undefined : Math.round(v * 2.54)
  }
  if (unit === 'ft') {
    const f = parseFloat(ft) || 0
    const i = parseFloat(ftIn) || 0
    const totalIn = f * 12 + i
    return totalIn <= 0 ? undefined : Math.round(totalIn * 2.54)
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AddMemberPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const prefill = (location.state as { from_enquiry?: { name?: string; phone?: string; email?: string } } | null)?.from_enquiry
  const [showPassword, setShowPassword] = useState(false)
  const [mode, setMode] = useState<'membership' | 'daypass'>('membership')
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null)
  const [selectedClassIds, setSelectedClassIds] = useState<number[]>([])
  const [apiStep, setApiStep] = useState<'creating' | 'subscription' | 'classes' | 'done'>('creating')

  // Health profile state
  const [selectedConditions, setSelectedConditions] = useState<string[]>([])
  const [injuries, setInjuries] = useState('')
  const [medications, setMedications] = useState('')
  const [activityLevel, setActivityLevel] = useState('')

  // Height unit state
  const [heightUnit, setHeightUnit] = useState<'cm' | 'in' | 'ft'>('cm')
  const [heightIn, setHeightIn]     = useState('')
  const [heightFt, setHeightFt]     = useState('')
  const [heightFtIn, setHeightFtIn] = useState('')

  // Weight unit state
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg')
  const [weightLbs, setWeightLbs]   = useState('')

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: facilitiesData } = useQuery({
    queryKey: QUERY_KEYS.facilities,
    queryFn: () => facilitiesApi.list(),
  })
  const facilities: Facility[] = (facilitiesData as { facilities?: Facility[] })?.facilities ?? []

  const { data: plansData } = useQuery({
    queryKey: QUERY_KEYS.plans,
    queryFn: () => plansApi.list(true),
    enabled: mode === 'membership',
  })
  const allPlans: Plan[] = (plansData as { plans?: Plan[] })?.plans ?? []
  // Filter plans by member gender — show only unisex or matching gender plans
  const memberGender = memberForm.watch('gender')
  const plans = allPlans.filter(p => {
    if (!p.member_category || p.member_category === 'individual') {
      if (!p.gender || p.gender === 'any') return true
      if (memberGender === 'male' && p.gender === 'male') return true
      if (memberGender === 'female' && p.gender === 'female') return true
      if (!memberGender) return true // no gender set yet — show all
      return false
    }
    return false // couple/group plans not shown in individual member enrollment
  })

  const { data: classesData } = useQuery({
    queryKey: ['classes-upcoming'],
    queryFn: () => classesApi.upcoming(),
    enabled: mode === 'membership',
  })
  const upcomingClasses: GymClass[] = Array.isArray(classesData) ? classesData : []

  // ── Forms ─────────────────────────────────────────────────────────────────

  const [prefillFirst, prefillLast] = prefill?.name
    ? prefill.name.trim().split(/\s+(.+)/)
    : ['', '']

  const memberForm = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      phone: prefill?.phone ?? '+91 ',
      email: prefill?.email ?? '',
      first_name: prefillFirst ?? '',
      last_name: prefillLast ?? '',
      emergency_contact_phone: '+91 ',
    },
  })
  const dayPassForm = useForm<DayPassFormValues>({
    resolver: zodResolver(dayPassSchema),
    defaultValues: { price: 0, pass_date: new Date().toISOString().slice(0, 10), activity_type: '', guest_phone: '+91 ' },
  })

  // ── Mutations ─────────────────────────────────────────────────────────────

  const memberMutation = useMutation({
    mutationFn: async (data: MemberFormValues) => {
      setApiStep('creating')
      const payload: Record<string, unknown> = { ...data, facility_id: Number(data.facility_id) }
      const computedHeight = toHeightCm(heightUnit, String(data.height_cm ?? ''), heightIn, heightFt, heightFtIn)
      if (computedHeight) payload.height_cm = computedHeight
      else delete payload.height_cm
      if (weightUnit === 'lbs') {
        const lbs = parseFloat(weightLbs)
        payload.weight_kg = (!isNaN(lbs) && lbs > 0) ? Math.round(lbs * 0.453592 * 10) / 10 : undefined
      }
      if (!payload.weight_kg && !data.weight_kg) delete payload.weight_kg

      // Attach health declaration if anything was filled
      const hasHealth = selectedConditions.length > 0 || injuries || medications || activityLevel
      if (hasHealth) {
        payload.health_declaration = {
          conditions:     selectedConditions,
          injuries:       injuries || undefined,
          medications:    medications || undefined,
          activity_level: activityLevel || undefined,
        }
      }

      const member = await membersApi.create(payload)
      const memberId = (member as { id: number }).id

      // Backend Create only saves auth fields — persist everything else via Update
      const genderMap: Record<string, string> = { male: 'M', female: 'F', other: 'Other' }
      const updatePayload: Record<string, unknown> = {}
      if (data.date_of_birth)                  updatePayload.date_of_birth = data.date_of_birth
      if (data.gender)                          updatePayload.gender = genderMap[data.gender] ?? data.gender
      if (computedHeight)                       updatePayload.height_cm = computedHeight
      if (payload.weight_kg)                    updatePayload.weight_kg = payload.weight_kg
      if (data.emergency_contact_name)          updatePayload.emergency_contact_name = data.emergency_contact_name
      if (data.emergency_contact_phone)         updatePayload.emergency_contact_phone = data.emergency_contact_phone
      if (data.emergency_contact_relationship)  updatePayload.emergency_contact_relationship = data.emergency_contact_relationship
      if (data.member_notes)                    updatePayload.member_notes = data.member_notes
      if (data.batch_time)                      updatePayload.batch_time = data.batch_time
      if (payload.health_declaration)           updatePayload.health_declaration = payload.health_declaration
      if (Object.keys(updatePayload).length > 0) {
        try { await membersApi.update(memberId, updatePayload) } catch { /* non-critical */ }
      }

      if (selectedPlanId) {
        setApiStep('subscription')
        try {
          await subscriptionsApi.create({ member_id: memberId, plan_id: selectedPlanId, auto_renew: true })
        } catch { toast.warning('Member created but subscription failed') }
      }

      if (selectedClassIds.length > 0) {
        setApiStep('classes')
        for (const classId of selectedClassIds) {
          try { await bookingsApi.book(memberId, classId) } catch { /* skip */ }
        }
      }

      setApiStep('done')
      return member
    },
    onSuccess: () => {
      toast.success('Member created successfully!')
      navigate('/members')
    },
    onError: (err: Error) => {
      const apiErr = err as { details?: string; message?: string }
      toast.error(apiErr.details || apiErr.message || 'Failed to register member')
    },
  })

  const dayPassMutation = useMutation({
    mutationFn: (data: DayPassFormValues) => {
      const passDate  = data.pass_date
      const extraInfo = [
        data.activity_type ? `Activity: ${ACTIVITY_OPTIONS.find(a => a.value === data.activity_type)?.label ?? data.activity_type}` : '',
        data.guest_dob  ? `DOB: ${data.guest_dob}` : '',
        data.guest_city ? `City: ${data.guest_city}` : '',
        data.notes ?? '',
      ].filter(Boolean).join(' | ')

      return dayPassesApi.create({
        facility_id: Number(data.facility_id),
        guest_name:  data.guest_name,
        guest_email: data.guest_email || undefined,
        guest_phone: data.guest_phone || undefined,
        pass_date:   passDate,
        valid_from:  `${passDate}T00:00:00Z`,
        valid_until: `${passDate}T23:59:59Z`,
        price:       Number(data.price),
        notes:       extraInfo || undefined,
      })
    },
    onSuccess: () => {
      toast.success('Day pass issued successfully!')
      navigate('/day-passes')
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to issue day pass'),
  })

  const toggleClass     = (id: number) =>
    setSelectedClassIds(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  const toggleCondition = (c: string) =>
    setSelectedConditions(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])

  const isLoading = memberMutation.isPending || dayPassMutation.isPending

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">

      {/* Header */}
      <div className="border-b border-border/40 bg-background px-8 py-6 shrink-0">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 bg-muted text-muted-foreground">
              {mode === 'membership' ? <UserPlus className="h-6 w-6" /> : <Ticket className="h-6 w-6" />}
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Members Management</p>
              <h1 className="text-2xl font-bold text-foreground">
                {mode === 'membership' ? 'Add New Member' : 'Issue Day Pass'}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {mode === 'membership'
                  ? 'Fill required fields — health and body details are optional'
                  : 'Grant a guest single-day access to the facility'}
              </p>
            </div>
          </div>
          <button onClick={() => navigate('/members')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground border border-border hover:text-foreground transition-colors shrink-0">
            <ArrowLeft className="h-4 w-4" /> Back to Members
          </button>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="px-8 py-4 bg-white border-b border-slate-200">
        <div className="inline-flex items-center bg-slate-100 rounded-xl p-1 gap-1">
          <button onClick={() => setMode('membership')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${mode === 'membership' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-500'}`}>
            <UserPlus className="h-4 w-4" /> Full Membership
          </button>
          <button onClick={() => setMode('daypass')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${mode === 'daypass' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-500'}`}>
            <Ticket className="h-4 w-4" /> Day Pass
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 px-8 py-6 w-full">

        {/* ════════ MEMBERSHIP FORM ════════ */}
        {mode === 'membership' && (
          <form onSubmit={memberForm.handleSubmit((d) => {
            if (!selectedPlanId) {
              toast.error('Please select a subscription plan before registering')
              document.getElementById('plan-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              return
            }
            memberMutation.mutate(d)
          })}>

            {/* ── Section 1: Personal & Account ── */}
            <Card className="border-0 shadow-md mb-4">
              <CardContent className="p-6">
                <SectionHeader num={1} icon={<User className="h-4 w-4" />} title="Personal & Account" subtitle="Required to create the member account" />
                <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                  <Field label="First Name" required error={memberForm.formState.errors.first_name?.message}>
                    <Input {...memberForm.register('first_name')} placeholder="Jane" className="h-10" />
                  </Field>
                  <Field label="Last Name" required error={memberForm.formState.errors.last_name?.message}>
                    <Input {...memberForm.register('last_name')} placeholder="Doe" className="h-10" />
                  </Field>
                  <Field label="Date of Birth" required error={memberForm.formState.errors.date_of_birth?.message}>
                    <Input type="date" {...memberForm.register('date_of_birth')} className="h-10" />
                  </Field>
                  <Field label="Gender" required error={memberForm.formState.errors.gender?.message}>
                    <Select value={memberForm.watch('gender') ?? ''} onValueChange={v => memberForm.setValue('gender', v as 'male'|'female'|'other', { shouldValidate: true })} className="w-full h-10">
                      <option value="">Select…</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </Select>
                  </Field>
                  <Field label="Facility" required error={memberForm.formState.errors.facility_id?.message}>
                    <Select value={String(memberForm.watch('facility_id') ?? '')} onValueChange={v => memberForm.setValue('facility_id', Number(v), { shouldValidate: true })} className="w-full h-10">
                      <option value="">Select…</option>
                      {facilities.map(f => <option key={f.id} value={String(f.id)}>{f.name}</option>)}
                    </Select>
                  </Field>
                  <div /> {/* spacer on 6-col */}

                  <Field label="Email" required error={memberForm.formState.errors.email?.message}>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input type="email" {...memberForm.register('email')} placeholder="jane@example.com" className="h-10 pl-9" />
                    </div>
                  </Field>
                  <Field label="Phone" required error={memberForm.formState.errors.phone?.message}>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input {...memberForm.register('phone')} placeholder="+91 98765 43210" className="h-10 pl-9" />
                    </div>
                  </Field>
                  <Field label="Password" required error={memberForm.formState.errors.password?.message}>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input type={showPassword ? 'text' : 'password'} {...memberForm.register('password')} placeholder="Min. 8 characters" className="h-10 pl-9 pr-10" />
                      <button type="button" tabIndex={-1} onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPassword
                          ? <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" /></svg>
                          : <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        }
                      </button>
                    </div>
                  </Field>
                </div>
              </CardContent>
            </Card>

            {/* ── Section 2: Body Stats ── */}
            <Card className="border-0 shadow-md mb-4">
              <CardContent className="p-6">
                <SectionHeader num={2} icon={<Activity className="h-4 w-4" />} title="Body Stats" subtitle="Optional — used for BMI and progress tracking" />
                <div className="flex flex-wrap items-end gap-4">

                  {/* Height with unit toggle */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Height</Label>
                    <div className="flex items-stretch gap-0 rounded-lg border border-input overflow-hidden focus-within:ring-2 focus-within:ring-ring">
                      {/* Input first */}
                      {heightUnit === 'cm' && (
                        <Input type="number" {...memberForm.register('height_cm')}
                          placeholder="170" className="h-10 w-24 border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0" />
                      )}
                      {heightUnit === 'in' && (
                        <Input type="number" value={heightIn} onChange={e => setHeightIn(e.target.value)}
                          placeholder="67" className="h-10 w-24 border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0" />
                      )}
                      {heightUnit === 'ft' && (
                        <div className="flex items-center gap-1 px-2">
                          <Input type="number" value={heightFt} onChange={e => setHeightFt(e.target.value)}
                            placeholder="5" className="h-10 w-14 border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 p-1 text-center" />
                          <span className="text-xs text-muted-foreground font-medium">ft</span>
                          <Input type="number" value={heightFtIn} onChange={e => setHeightFtIn(e.target.value)}
                            placeholder="7" min="0" max="11" className="h-10 w-14 border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 p-1 text-center" />
                          <span className="text-xs text-muted-foreground font-medium">in</span>
                        </div>
                      )}
                      {/* Unit tabs on the right */}
                      {(['cm', 'in', 'ft'] as const).map(u => (
                        <button key={u} type="button" onClick={() => setHeightUnit(u)}
                          className={`px-3 text-xs font-semibold border-l border-input transition-all shrink-0 ${heightUnit === u ? 'bg-sky-600 text-white border-transparent' : 'bg-slate-50 text-slate-500'}`}>
                          {u === 'ft' ? 'ft+in' : u}
                        </button>
                      ))}
                    </div>
                    {/* live cm preview for non-cm units */}
                    {heightUnit !== 'cm' && (() => {
                      const preview = toHeightCm(heightUnit, '', heightIn, heightFt, heightFtIn)
                      return preview ? <p className="text-xs text-sky-600 font-medium">≈ {preview} cm</p> : null
                    })()}
                    {memberForm.formState.errors.height_cm && (
                      <p className="text-xs text-destructive">{memberForm.formState.errors.height_cm.message}</p>
                    )}
                  </div>

                  {/* Weight with unit toggle */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Weight</Label>
                    <div className="flex items-stretch gap-0 rounded-lg border border-input overflow-hidden focus-within:ring-2 focus-within:ring-ring">
                      {weightUnit === 'kg' && (
                        <Input type="number" step="0.1" {...memberForm.register('weight_kg')}
                          placeholder="68.5" className="h-10 w-24 border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0" />
                      )}
                      {weightUnit === 'lbs' && (
                        <Input type="number" step="0.1" value={weightLbs} onChange={e => setWeightLbs(e.target.value)}
                          placeholder="150" className="h-10 w-24 border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0" />
                      )}
                      {(['kg', 'lbs'] as const).map(u => (
                        <button key={u} type="button" onClick={() => setWeightUnit(u)}
                          className={`px-3 text-xs font-semibold border-l border-input transition-all shrink-0 ${weightUnit === u ? 'bg-sky-600 text-white border-transparent' : 'bg-slate-50 text-slate-500'}`}>
                          {u}
                        </button>
                      ))}
                    </div>
                    {weightUnit === 'lbs' && (() => {
                      const lbs = parseFloat(weightLbs)
                      const kg = (!isNaN(lbs) && lbs > 0) ? Math.round(lbs * 0.453592 * 10) / 10 : null
                      return kg ? <p className="text-xs text-sky-600 font-medium">≈ {kg} kg</p> : null
                    })()}
                    {memberForm.formState.errors.weight_kg && (
                      <p className="text-xs text-destructive">{memberForm.formState.errors.weight_kg.message}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Section 3: Health Profile ── */}
            <Card className="border-0 shadow-md mb-4">
              <CardContent className="p-6">
                <SectionHeader num={3} icon={<Heart className="h-4 w-4" />} title="Health Profile" subtitle="Optional — helps trainers plan safe programs" />

                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Medical Conditions</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7 gap-2">
                  {MEDICAL_CONDITIONS.map(c => {
                    const active = selectedConditions.includes(c)
                    return (
                      <button key={c} type="button" onClick={() => toggleCondition(c)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium text-left transition-all"
                        style={active
                          ? { background: 'rgba(2,125,253,0.08)', borderColor: '#027DFD', color: '#0553B1' }
                          : { background: 'white', borderColor: '#e2e8f0', color: '#64748b' }}>
                        <div className={`h-3.5 w-3.5 rounded-sm border flex items-center justify-center shrink-0 transition-all ${active ? 'bg-sky-500 border-sky-500' : 'border-slate-300'}`}>
                          {active && <Check className="h-2.5 w-2.5 text-white" />}
                        </div>
                        {c}
                      </button>
                    )
                  })}
                </div>

                <Divider label="Details" />

                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Known Injuries / Pain Areas</Label>
                    <textarea value={injuries} onChange={e => setInjuries(e.target.value)} rows={3}
                      placeholder="e.g. Left knee pain, lower back stiffness…"
                      className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Current Medications</Label>
                    <textarea value={medications} onChange={e => setMedications(e.target.value)} rows={3}
                      placeholder="e.g. Metformin 500mg, Thyronorm 50mcg…"
                      className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Trainer / Internal Notes</Label>
                    <textarea {...memberForm.register('member_notes')} rows={3}
                      placeholder="Observations, preferences, goals…"
                      className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Preferred Batch Time</Label>
                    <select {...memberForm.register('batch_time')}
                      className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <option value="">— No preference —</option>
                      {['06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'].map(t => {
                        const h = parseInt(t)
                        const label = h === 0 ? '12:00 AM' : h < 12 ? `${h}:00 AM` : h === 12 ? '12:00 PM' : `${h-12}:00 PM`
                        return <option key={t} value={t}>{label}</option>
                      })}
                    </select>
                  </div>
                </div>

                <Divider label="Activity Level" />

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl">
                  {ACTIVITY_LEVELS.map(a => (
                    <button key={a.value} type="button" onClick={() => setActivityLevel(a.value)}
                      className={`relative text-left rounded-xl border-2 p-3 transition-all ${activityLevel === a.value ? 'border-sky-500 bg-sky-50' : 'border-border hover:border-sky-200 bg-white'}`}>
                      {activityLevel === a.value && (
                        <div className="absolute top-2 right-2 h-4 w-4 rounded-full flex items-center justify-center" className="bg-sky-500">
                          <Check className="h-2.5 w-2.5 text-white" />
                        </div>
                      )}
                      <p className={`text-sm font-semibold ${activityLevel === a.value ? 'text-sky-700' : ''}`}>{a.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{a.sub}</p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* ── Section 4: Emergency Contact ── */}
            <Card className="border-0 shadow-md mb-4">
              <CardContent className="p-6">
                <SectionHeader num={4} icon={<Shield className="h-4 w-4" />} title="Emergency Contact" subtitle="Optional but recommended" />
                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                  <Field label="Contact Name" error={memberForm.formState.errors.emergency_contact_name?.message}>
                    <Input {...memberForm.register('emergency_contact_name')} placeholder="Full name" className="h-10" />
                  </Field>
                  <Field label="Phone" error={memberForm.formState.errors.emergency_contact_phone?.message}>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input {...memberForm.register('emergency_contact_phone')} placeholder="+91 98765 43210" className="h-10 pl-9" />
                    </div>
                  </Field>
                  <Field label="Relationship" error={memberForm.formState.errors.emergency_contact_relationship?.message}>
                    <Select {...memberForm.register('emergency_contact_relationship')} className="h-10">
                      <option value="">Select…</option>
                      {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                    </Select>
                  </Field>
                </div>
              </CardContent>
            </Card>

            {/* ── Section 5: Subscription Plan ── */}
            <Card id="plan-section" className={`border-0 shadow-md mb-4 ${!selectedPlanId ? 'ring-0' : ''}`}>
              <CardContent className="p-6">
                <SectionHeader num={5} icon={<CreditCard className="h-4 w-4" />} title="Subscription Plan" subtitle="Required — select a plan to continue" />
                {plans.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active plans found. Please create a plan first.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {plans.map(plan => (
                      <button key={plan.id} type="button" onClick={() => setSelectedPlanId(plan.id)}
                        className={`relative text-left rounded-xl border-2 p-4 transition-all ${selectedPlanId === plan.id ? 'border-sky-500 bg-sky-50' : 'border-border hover:border-sky-200 bg-white'}`}>
                        {selectedPlanId === plan.id && (
                          <div className="absolute top-3 right-3 h-5 w-5 rounded-full flex items-center justify-center" className="bg-sky-500">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        )}
                        <div className="flex items-center gap-2 mb-2">
                          <Star className="h-3.5 w-3.5 text-sky-500" />
                          <p className="font-semibold text-sm truncate pr-6">{plan.name}</p>
                        </div>
                        <p className="text-lg font-bold text-sky-700">{formatCurrency(plan.price_amount)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Every {plan.billing_period_days} days
                          {plan.group_class_access && <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">Classes</Badge>}
                          {plan.gender === 'male' && <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700">♂ Male</Badge>}
                          {plan.gender === 'female' && <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 bg-rose-50 text-rose-700">♀ Female</Badge>}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Section 6: Assign Classes ── */}
            <Card className="border-0 shadow-md mb-6">
              <CardContent className="p-6">
                <SectionHeader num={6} icon={<Dumbbell className="h-4 w-4" />} title="Assign Classes"
                  subtitle={selectedClassIds.length > 0 ? `${selectedClassIds.length} class${selectedClassIds.length > 1 ? 'es' : ''} selected` : 'Optional — upcoming classes'} />
                {upcomingClasses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No upcoming classes available.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {upcomingClasses.map(cls => {
                      const selected = selectedClassIds.includes(cls.id)
                      return (
                        <button key={cls.id} type="button" onClick={() => toggleClass(cls.id)}
                          className={`relative text-left rounded-xl border-2 p-4 transition-all ${selected ? 'border-sky-500 bg-sky-50' : 'border-border hover:border-sky-200 bg-white'}`}>
                          {selected && (
                            <div className="absolute top-3 right-3 h-5 w-5 rounded-full flex items-center justify-center" className="bg-sky-500">
                              <Check className="h-3 w-3 text-white" />
                            </div>
                          )}
                          <p className="font-semibold text-sm pr-6 truncate">{cls.name}</p>
                          <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-100 text-sky-700 capitalize">{cls.class_type}</span>
                          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3 shrink-0" />
                            <span className="truncate">{formatDate(cls.start_time)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                            <Users className="h-3 w-3 shrink-0" />
                            <span>{cls.max_capacity} spots</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Submit bar */}
            <div className="flex items-center justify-between p-5 rounded-2xl border bg-white sticky bottom-4"
              style={{ boxShadow: '0 4px 24px rgba(2,125,253,0.25), 0 1px 4px rgba(2,125,253,0.15)' }}>
              <div>
                <p className="text-sm font-semibold">Ready to register member?</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1"><ChevronRight className="h-3 w-3 text-sky-500" /> Create account</span>
                  {selectedPlanId
                    ? <span className="flex items-center gap-1"><ChevronRight className="h-3 w-3 text-sky-500" /> Assign {plans.find(p => p.id === selectedPlanId)?.name}</span>
                    : <span className="flex items-center gap-1 text-destructive font-medium"><ChevronRight className="h-3 w-3" /> No plan selected</span>
                  }
                  {selectedClassIds.length > 0 && <span className="flex items-center gap-1"><ChevronRight className="h-3 w-3 text-sky-500" /> Book {selectedClassIds.length} class{selectedClassIds.length > 1 ? 'es' : ''}</span>}
                </div>
                {isLoading && apiStep !== 'creating' && (
                  <p className="text-xs text-sky-600 mt-1 font-medium animate-pulse">
                    {apiStep === 'subscription' ? 'Creating subscription…' : apiStep === 'classes' ? 'Booking classes…' : 'Finishing…'}
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => navigate('/members')} disabled={isLoading}>
                  <ArrowLeft className="h-4 w-4" /> Cancel
                </Button>
                <div className="relative p-[2px] rounded-xl overflow-hidden"
                  style={{ isolation: 'isolate' }}>
                  <style>{`
                    @keyframes grad-spin {
                      from { transform: rotate(0deg); }
                      to   { transform: rotate(360deg); }
                    }
                    .grad-border-spin { animation: grad-spin 3s linear infinite; }
                  `}</style>
                  {/* Animated gradient ring */}
                  <div className="grad-border-spin absolute inset-[-150%] w-[400%] h-[400%] pointer-events-none"
                    style={{ background: 'conic-gradient(from 0deg, #60a5fa, #818cf8, #a78bfa, #c084fc, #e879f9, #f472b6, #60a5fa)' }} />
                  {/* Button — glassmorphic, unchanged */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="relative flex items-center gap-2 px-7 py-2.5 rounded-[10px] text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: 'white',
                      color: 'black',
                      boxShadow: '0 8px 24px rgba(99,102,241,0.35), 0 2px 8px rgba(168,85,247,0.25)',
                    }}
                  >
                    {isLoading
                      ? <span className="h-4 w-4 border-2 border-current/40 border-t-current rounded-full animate-spin" />
                      : <UserPlus className="h-4 w-4" />
                    }
                    Register Member
                  </button>
                </div>
              </div>
            </div>

          </form>
        )}

        {/* ════════ DAY PASS FORM ════════ */}
        {mode === 'daypass' && (
          <form onSubmit={dayPassForm.handleSubmit((d) => dayPassMutation.mutate(d))}>

            <Card className="border-0 shadow-md mb-4">
              <CardContent className="p-6">
                <SectionHeader num={1} icon={<User className="h-4 w-4" />} title="Guest Information" />
                <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                  <Field label="Guest Name" required error={dayPassForm.formState.errors.guest_name?.message}>
                    <Input {...dayPassForm.register('guest_name')} placeholder="e.g. Rahul Sharma" className="h-10" />
                  </Field>
                  <Field label="Phone" required error={dayPassForm.formState.errors.guest_phone?.message}>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input {...dayPassForm.register('guest_phone')} placeholder="+91 98765 43210" className="h-10 pl-9" />
                    </div>
                  </Field>
                  <Field label="Email" error={dayPassForm.formState.errors.guest_email?.message}>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input type="email" {...dayPassForm.register('guest_email')} placeholder="guest@example.com" className="h-10 pl-9" />
                    </div>
                  </Field>
                  <Field label="Date of Birth" error={dayPassForm.formState.errors.guest_dob?.message}>
                    <Input type="date" {...dayPassForm.register('guest_dob')} className="h-10" />
                  </Field>
                  <Field label="City" error={dayPassForm.formState.errors.guest_city?.message}>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input {...dayPassForm.register('guest_city')} placeholder="e.g. Mumbai" className="h-10 pl-9" />
                    </div>
                  </Field>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md mb-4">
              <CardContent className="p-6">
                <SectionHeader num={2} icon={<Calendar className="h-4 w-4" />} title="Pass Details" />
                <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-4">
                  <Field label="Facility" required error={dayPassForm.formState.errors.facility_id?.message}>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Select value={String(dayPassForm.watch('facility_id') ?? '')} onValueChange={v => dayPassForm.setValue('facility_id', Number(v), { shouldValidate: true })} className="w-full h-10 pl-9">
                        <option value="">Select…</option>
                        {facilities.map(f => <option key={f.id} value={String(f.id)}>{f.name}</option>)}
                      </Select>
                    </div>
                  </Field>
                  <Field label="Pass Date" required error={dayPassForm.formState.errors.pass_date?.message}>
                    <Input type="date" {...dayPassForm.register('pass_date')} className="h-10" />
                  </Field>
                  <Field label="Price (₹)" error={dayPassForm.formState.errors.price?.message}>
                    <Input type="number" min="0" step="0.01" {...dayPassForm.register('price')} placeholder="0" className="h-10" />
                  </Field>
                  <div className="lg:col-span-2">
                    <Field label="Notes">
                      <Input {...dayPassForm.register('notes')} placeholder="Any notes about this guest…" className="h-10" />
                    </Field>
                  </div>
                </div>

                <Field label="Activity" required error={dayPassForm.formState.errors.activity_type?.message}>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {ACTIVITY_OPTIONS.map(a => {
                      const selected = dayPassForm.watch('activity_type') === a.value
                      return (
                        <button key={a.value} type="button" onClick={() => dayPassForm.setValue('activity_type', a.value, { shouldValidate: true })}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${selected ? 'bg-sky-600 text-white border-transparent shadow-sm' : 'bg-white text-slate-500 border-slate-200'}`}>
                          <span>{a.emoji}</span><span>{a.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </Field>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between p-5 rounded-2xl border bg-white shadow-sm sticky bottom-4">
              <div>
                <p className="text-sm font-semibold">Issue a day pass for this guest?</p>
                <p className="text-xs text-muted-foreground mt-0.5">Pass will be valid for the selected date only.</p>
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => navigate('/members')} disabled={isLoading}>
                  <ArrowLeft className="h-4 w-4" /> Cancel
                </Button>
                <Button type="submit" loading={isLoading} className="px-8">
                  <Ticket className="h-4 w-4" /> Issue Day Pass
                </Button>
              </div>
            </div>

          </form>
        )}
      </div>
    </div>
  )
}
