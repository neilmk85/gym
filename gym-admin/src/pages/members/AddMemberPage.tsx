import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
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
  UserPlus, ArrowLeft, User, Mail, Phone,
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

type ExtraMember = { first_name: string; last_name: string; phone: string; dob: string }

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
      <div className="h-6 w-6 rounded-full border-2 border-slate-300 flex items-center justify-center shrink-0 text-xs font-bold text-slate-500">
        {num}
      </div>
      <div className="h-8 w-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-slate-500">
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

  // Enrollment type
  const [enrollmentType, setEnrollmentType] = useState<'individual' | 'couple' | 'group'>('individual')
  const emptyMember = (): ExtraMember => ({ first_name: '', last_name: '', phone: '+91 ', dob: '' })
  const [partner, setPartner] = useState<ExtraMember & { anniversary: string }>(
    { first_name: '', last_name: '', phone: '+91 ', dob: '', anniversary: '' }
  )
  const [groupMembers, setGroupMembers] = useState<ExtraMember[]>([emptyMember()])

  // Weight unit state
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg')
  const [weightLbs, setWeightLbs]   = useState('')

  // ── Forms (must be declared before any .watch() calls in queries section) ─

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

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: facilitiesData } = useQuery({
    queryKey: QUERY_KEYS.facilities,
    queryFn: () => facilitiesApi.list(),
  })
  const facilities: Facility[] = (facilitiesData as { facilities?: Facility[] })?.facilities ?? []

  // Default facility_id to the first facility once loaded
  useEffect(() => {
    if (facilities.length > 0 && !memberForm.getValues('facility_id')) {
      memberForm.setValue('facility_id', facilities[0].id, { shouldValidate: false })
    }
  }, [facilities])

  const { data: plansData } = useQuery({
    queryKey: QUERY_KEYS.plans,
    queryFn: () => plansApi.list(true),
    enabled: mode === 'membership',
  })
  const allPlans: Plan[] = (plansData as { plans?: Plan[] })?.plans ?? []
  const memberGender = memberForm.watch('gender')
  const plans = allPlans.filter(p => {
    const cat = p.member_category ?? 'individual'
    if (cat !== enrollmentType) return false
    if (!p.gender || p.gender === 'any') return true
    if (memberGender === 'male' && p.gender === 'male') return true
    if (memberGender === 'female' && p.gender === 'female') return true
    if (!memberGender) return true
    return false
  })

  const { data: classesData } = useQuery({
    queryKey: ['classes-upcoming'],
    queryFn: () => classesApi.upcoming(),
    enabled: mode === 'membership',
  })
  const upcomingClasses: GymClass[] = Array.isArray(classesData) ? classesData : []

  // ── Mutations ─────────────────────────────────────────────────────────────

  const genPass = () => `Gym@${Math.random().toString(36).slice(2, 8)}${Math.floor(10 + Math.random() * 90)}`

  const memberMutation = useMutation({
    mutationFn: async (data: MemberFormValues) => {
      setApiStep('creating')
      const facilityId = Number(data.facility_id)
      const computedHeight = toHeightCm(heightUnit, String(data.height_cm ?? ''), heightIn, heightFt, heightFtIn)
      const computedWeight = weightUnit === 'lbs'
        ? (() => { const lbs = parseFloat(weightLbs); return (!isNaN(lbs) && lbs > 0) ? Math.round(lbs * 0.453592 * 10) / 10 : undefined })()
        : (data.weight_kg ? Number(data.weight_kg) : undefined)
      const genderMap: Record<string, string> = { male: 'M', female: 'F', other: 'Other' }

      // ── Create primary member ──────────────────────────────────────────────
      const primary = await membersApi.create({ ...data, facility_id: facilityId, password: genPass() })
      const primaryId = (primary as { id: number }).id

      const hasHealth = selectedConditions.length > 0 || injuries || medications || activityLevel
      const primaryUpdate: Record<string, unknown> = {}
      if (data.date_of_birth)                  primaryUpdate.date_of_birth = data.date_of_birth
      if (data.gender)                          primaryUpdate.gender = genderMap[data.gender] ?? data.gender
      if (computedHeight)                       primaryUpdate.height_cm = computedHeight
      if (computedWeight)                       primaryUpdate.weight_kg = computedWeight
      if (data.emergency_contact_name)          primaryUpdate.emergency_contact_name = data.emergency_contact_name
      if (data.emergency_contact_phone)         primaryUpdate.emergency_contact_phone = data.emergency_contact_phone
      if (data.emergency_contact_relationship)  primaryUpdate.emergency_contact_relationship = data.emergency_contact_relationship
      if (data.member_notes)                    primaryUpdate.member_notes = data.member_notes
      if (data.batch_time)                      primaryUpdate.batch_time = data.batch_time
      if (hasHealth) primaryUpdate.health_declaration = {
        conditions: selectedConditions, injuries: injuries || undefined,
        medications: medications || undefined, activity_level: activityLevel || undefined,
      }
      if (enrollmentType === 'couple' && partner.anniversary) {
        primaryUpdate.member_notes = [data.member_notes, `Anniversary: ${partner.anniversary}`].filter(Boolean).join(' | ')
      }
      if (Object.keys(primaryUpdate).length > 0) {
        try { await membersApi.update(primaryId, primaryUpdate) } catch { /* non-critical */ }
      }

      // ── Create extra members (couple / group) ─────────────────────────────
      const extraIds: number[] = []
      const extras: ExtraMember[] = enrollmentType === 'couple'
        ? [{ first_name: partner.first_name, last_name: partner.last_name, phone: partner.phone, dob: partner.dob }]
        : enrollmentType === 'group' ? groupMembers.filter(m => m.first_name.trim()) : []

      for (const m of extras) {
        try {
          const created = await membersApi.create({
            first_name: m.first_name, last_name: m.last_name,
            phone: m.phone, email: `member-${Date.now()}@placeholder.local`,
            facility_id: facilityId, password: genPass(),
          })
          const extraId = (created as { id: number }).id
          if (m.dob) {
            try { await membersApi.update(extraId, { date_of_birth: m.dob }) } catch { /* non-critical */ }
          }
          extraIds.push(extraId)
        } catch { toast.warning(`Could not create member: ${m.first_name} ${m.last_name}`) }
      }

      // ── Create subscriptions ──────────────────────────────────────────────
      if (selectedPlanId) {
        setApiStep('subscription')

        if (enrollmentType === 'individual') {
          try {
            await subscriptionsApi.create({ member_id: primaryId, plan_id: selectedPlanId, auto_renew: true })
          } catch { toast.warning('Member created but subscription failed') }

        } else if (enrollmentType === 'couple' && extraIds.length > 0) {
          const partnerId = extraIds[0]
          try {
            await subscriptionsApi.create({ member_id: primaryId, plan_id: selectedPlanId, auto_renew: true, partner_member_id: partnerId })
          } catch { toast.warning('Primary member subscription failed') }
          try {
            await subscriptionsApi.create({ member_id: partnerId, plan_id: selectedPlanId, auto_renew: true, partner_member_id: primaryId })
          } catch { toast.warning('Partner subscription failed') }

        } else if (enrollmentType === 'group') {
          let primarySubId: number | undefined
          try {
            const sub = await subscriptionsApi.create({ member_id: primaryId, plan_id: selectedPlanId, auto_renew: true, group_leader_sub: true })
            primarySubId = (sub as { id: number }).id
          } catch { toast.warning('Primary member subscription failed') }
          for (const extraId of extraIds) {
            try {
              await subscriptionsApi.create({ member_id: extraId, plan_id: selectedPlanId, auto_renew: true, group_sub_id: primarySubId })
            } catch { /* skip */ }
          }
        }
      }

      if (selectedClassIds.length > 0) {
        setApiStep('classes')
        for (const classId of selectedClassIds) {
          try { await bookingsApi.book(primaryId, classId) } catch { /* skip */ }
        }
      }

      setApiStep('done')
      return primary
    },
    onSuccess: () => {
      const label = enrollmentType === 'couple' ? 'Couple registered!' : enrollmentType === 'group' ? 'Group registered!' : 'Member created successfully!'
      toast.success(label)
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
    <div className="flex flex-col">

      {/* Header — edge-to-edge, breaks out of shell padding */}
      <div className="shrink-0 -mx-6 -mt-6 px-8 pt-8 pb-6"
        style={{ background: 'linear-gradient(to bottom, #ebe6fd 0%, #eef1ff 35%, #f4f6ff 60%, rgba(255,255,255,0) 100%)' }}>
        <button onClick={() => navigate('/members')}
          className="mb-3 flex items-center gap-1 text-sm font-medium text-indigo-500 hover:text-indigo-700 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Members
        </button>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-500 flex items-center justify-center text-white shadow-sm border border-indigo-400/30">
              {mode === 'membership' ? <UserPlus className="h-5 w-5" /> : <Ticket className="h-5 w-5" />}
            </div>
            <div>
              <h1 className="text-[1.75rem] font-black tracking-tight text-[#1a1a2e] leading-tight">
                {mode === 'membership' ? 'Add New Member' : 'Issue Day Pass'}
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {mode === 'membership'
                  ? 'Fill required fields — health and body details are optional'
                  : 'Grant a guest single-day access to the facility'}
              </p>
            </div>
          </div>
          {/* Mode toggle */}
          <div className="inline-flex items-center bg-white/60 border border-white/80 rounded-xl p-1 gap-1 shadow-sm">
            <button onClick={() => setMode('membership')}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${mode === 'membership' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <UserPlus className="h-4 w-4" /> Full Membership
            </button>
            <button onClick={() => setMode('daypass')}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${mode === 'daypass' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <Ticket className="h-4 w-4" /> Day Pass
            </button>
          </div>
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

                {/* Enrollment Type */}
                <div className="mb-5">
                  <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 block">Enrollment Type</Label>
                  <div className="inline-flex items-center bg-slate-100 rounded-xl p-1 gap-1">
                    {([
                      { value: 'individual', label: 'Individual', icon: <User className="h-3.5 w-3.5" /> },
                      { value: 'couple',     label: 'Couple',     icon: <Heart className="h-3.5 w-3.5" /> },
                      { value: 'group',      label: 'Group',      icon: <Users className="h-3.5 w-3.5" /> },
                    ] as const).map(opt => (
                      <button key={opt.value} type="button" onClick={() => setEnrollmentType(opt.value)}
                        className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${enrollmentType === opt.value ? 'bg-white text-indigo-600 shadow-sm border border-indigo-100' : 'text-slate-500 hover:text-slate-700'}`}>
                        {opt.icon} {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                  <Field label="First Name" required error={memberForm.formState.errors.first_name?.message}>
                    <Input {...memberForm.register('first_name')} placeholder="Jane" className="h-10" />
                  </Field>
                  <Field label="Last Name" required error={memberForm.formState.errors.last_name?.message}>
                    <Input {...memberForm.register('last_name')} placeholder="Doe" className="h-10" />
                  </Field>
                  <Field label={enrollmentType === 'individual' ? 'Date of Birth' : 'Member 1 Date of Birth'} required error={memberForm.formState.errors.date_of_birth?.message}>
                    <Input type="date" {...memberForm.register('date_of_birth')} className="h-10" />
                  </Field>
                  <Field label="Gender" required error={memberForm.formState.errors.gender?.message}>
                    <Select value={memberForm.watch('gender') ?? ''} onValueChange={v => memberForm.setValue('gender', v as 'male'|'female'|'other', { shouldValidate: true })}>
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue placeholder="Select…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Facility" required error={memberForm.formState.errors.facility_id?.message}>
                    <Select value={String(memberForm.watch('facility_id') ?? '')} onValueChange={v => memberForm.setValue('facility_id', Number(v), { shouldValidate: true })}>
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue placeholder="Select…" />
                      </SelectTrigger>
                      <SelectContent>
                        {facilities.map(f => <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>)}
                      </SelectContent>
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
                </div>

                {/* Couple — partner details */}
                {enrollmentType === 'couple' && (
                  <div className="mt-5 p-4 rounded-xl bg-rose-50 border border-rose-100">
                    <p className="text-xs font-bold text-rose-600 uppercase tracking-wide mb-4 flex items-center gap-1.5">
                      <Heart className="h-3.5 w-3.5" /> Partner Details
                    </p>
                    <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                      <Field label="First Name" required>
                        <Input value={partner.first_name} onChange={e => setPartner(p => ({ ...p, first_name: e.target.value }))} placeholder="Partner first name" className="h-10" />
                      </Field>
                      <Field label="Last Name" required>
                        <Input value={partner.last_name} onChange={e => setPartner(p => ({ ...p, last_name: e.target.value }))} placeholder="Partner last name" className="h-10" />
                      </Field>
                      <Field label="Phone" required>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input value={partner.phone} onChange={e => setPartner(p => ({ ...p, phone: e.target.value }))} placeholder="+91 98765 43210" className="h-10 pl-9" />
                        </div>
                      </Field>
                      <Field label="Date of Birth">
                        <Input type="date" value={partner.dob} onChange={e => setPartner(p => ({ ...p, dob: e.target.value }))} className="h-10" />
                      </Field>
                      <Field label="Wedding Anniversary">
                        <Input type="date" value={partner.anniversary} onChange={e => setPartner(p => ({ ...p, anniversary: e.target.value }))} className="h-10" />
                      </Field>
                    </div>
                  </div>
                )}

                {/* Group — additional member details */}
                {enrollmentType === 'group' && (
                  <div className="mt-5 p-4 rounded-xl bg-indigo-50 border border-indigo-100">
                    <p className="text-xs font-bold text-indigo-600 uppercase tracking-wide mb-4 flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" /> Additional Group Members
                    </p>
                    <div className="space-y-3">
                      {groupMembers.map((m, i) => (
                        <div key={i} className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 items-end">
                          <Field label={`Member ${i + 2} — First Name`} required>
                            <Input value={m.first_name} onChange={e => { const next = [...groupMembers]; next[i] = { ...next[i], first_name: e.target.value }; setGroupMembers(next) }} placeholder="First name" className="h-10" />
                          </Field>
                          <Field label="Last Name" required>
                            <Input value={m.last_name} onChange={e => { const next = [...groupMembers]; next[i] = { ...next[i], last_name: e.target.value }; setGroupMembers(next) }} placeholder="Last name" className="h-10" />
                          </Field>
                          <Field label="Phone" required>
                            <div className="relative">
                              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input value={m.phone} onChange={e => { const next = [...groupMembers]; next[i] = { ...next[i], phone: e.target.value }; setGroupMembers(next) }} placeholder="+91 98765 43210" className="h-10 pl-9" />
                            </div>
                          </Field>
                          <Field label="Date of Birth">
                            <Input type="date" value={m.dob} onChange={e => { const next = [...groupMembers]; next[i] = { ...next[i], dob: e.target.value }; setGroupMembers(next) }} className="h-10" />
                          </Field>
                          {groupMembers.length > 1 && (
                            <button type="button" onClick={() => setGroupMembers(groupMembers.filter((_, j) => j !== i))}
                              className="h-10 px-3 flex items-center justify-center rounded-lg border border-red-200 text-red-400 hover:bg-red-50 text-sm font-medium self-end">
                              Remove
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {groupMembers.length < 9 && (
                      <button type="button" onClick={() => setGroupMembers([...groupMembers, emptyMember()])}
                        className="mt-4 text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                        + Add another member
                      </button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Section 2: Body Stats ── */}
            <Card className="border-0 shadow-md mb-4">
              <CardContent className="p-6">
                <SectionHeader num={2} icon={<Activity className="h-4 w-4" />} title="Body Stats" subtitle="Optional — used for BMI and progress tracking" />
                <div className="flex flex-wrap gap-6">

                  {/* Height */}
                  <div className="space-y-2 min-w-[200px]">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Height</Label>
                      <div className="flex rounded-md border border-input overflow-hidden text-xs">
                        {(['cm', 'in', 'ft'] as const).map(u => (
                          <button key={u} type="button" onClick={() => setHeightUnit(u)}
                            className={`px-2.5 py-1 font-semibold transition-colors ${heightUnit === u ? 'bg-slate-700 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                            {u === 'ft' ? 'ft/in' : u}
                          </button>
                        ))}
                      </div>
                    </div>
                    {heightUnit === 'cm' && (
                      <Input type="number" {...memberForm.register('height_cm')} placeholder="170" className="h-10" />
                    )}
                    {heightUnit === 'in' && (
                      <Input type="number" value={heightIn} onChange={e => setHeightIn(e.target.value)} placeholder="67 in" className="h-10" />
                    )}
                    {heightUnit === 'ft' && (
                      <div className="flex items-center gap-2">
                        <Input type="number" value={heightFt} onChange={e => setHeightFt(e.target.value)} placeholder="5" className="h-10 w-20 text-center" />
                        <span className="text-sm text-slate-500 font-medium">ft</span>
                        <Input type="number" value={heightFtIn} onChange={e => setHeightFtIn(e.target.value)} placeholder="7" min="0" max="11" className="h-10 w-20 text-center" />
                        <span className="text-sm text-slate-500 font-medium">in</span>
                      </div>
                    )}
                    {heightUnit !== 'cm' && (() => {
                      const preview = toHeightCm(heightUnit, '', heightIn, heightFt, heightFtIn)
                      return preview ? <p className="text-xs text-slate-400">= {preview} cm</p> : null
                    })()}
                  </div>

                  {/* Weight */}
                  <div className="space-y-2 min-w-[180px]">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Weight</Label>
                      <div className="flex rounded-md border border-input overflow-hidden text-xs">
                        {(['kg', 'lbs'] as const).map(u => (
                          <button key={u} type="button" onClick={() => setWeightUnit(u)}
                            className={`px-2.5 py-1 font-semibold transition-colors ${weightUnit === u ? 'bg-slate-700 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                            {u}
                          </button>
                        ))}
                      </div>
                    </div>
                    {weightUnit === 'kg'
                      ? <Input type="number" step="0.1" {...memberForm.register('weight_kg')} placeholder="68.5" className="h-10" />
                      : <Input type="number" step="0.1" value={weightLbs} onChange={e => setWeightLbs(e.target.value)} placeholder="150 lbs" className="h-10" />
                    }
                    {weightUnit === 'lbs' && (() => {
                      const lbs = parseFloat(weightLbs)
                      const kg = (!isNaN(lbs) && lbs > 0) ? Math.round(lbs * 0.453592 * 10) / 10 : null
                      return kg ? <p className="text-xs text-slate-400">= {kg} kg</p> : null
                    })()}
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
                    <Select value={memberForm.watch('emergency_contact_relationship') ?? ''} onValueChange={v => memberForm.setValue('emergency_contact_relationship', v, { shouldValidate: true })}>
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue placeholder="Select…" />
                      </SelectTrigger>
                      <SelectContent>
                        {RELATIONSHIPS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </CardContent>
            </Card>

            {/* ── Section 5: Subscription Plan ── */}
            <Card id="plan-section" className={`border-0 shadow-md mb-4 ${!selectedPlanId ? 'ring-0' : ''}`}>
              <CardContent className="p-6">
                <SectionHeader num={5} icon={<CreditCard className="h-4 w-4" />} title="Subscription Plan"
                  subtitle={`Required — showing ${enrollmentType} plans`} />
                {plans.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active {enrollmentType} plans found. Create one or switch enrollment type.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {plans.map(plan => (
                      <button key={plan.id} type="button" onClick={() => setSelectedPlanId(plan.id)}
                        className={`relative text-left rounded-xl border-2 p-4 transition-all ${selectedPlanId === plan.id ? 'border-sky-500 bg-sky-50' : 'border-border hover:border-sky-200 bg-white'}`}>
                        {selectedPlanId === plan.id && (
                          <div className="absolute top-3 right-3 h-5 w-5 rounded-full bg-sky-500 flex items-center justify-center">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        )}
                        <div className="flex items-center gap-2 mb-2">
                          <Star className="h-3.5 w-3.5 text-sky-500" />
                          <p className="font-semibold text-sm truncate pr-6">{plan.name}</p>
                        </div>
                        <p className="text-lg font-bold text-sky-700">{formatCurrency(plan.price_amount)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Every {plan.billing_period_days} days</p>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {plan.group_class_access && <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">✓ Classes</span>}
                          {plan.gender === 'male' && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">♂ Male</span>}
                          {plan.gender === 'female' && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">♀ Female</span>}
                        </div>
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
                    <Select value={String(dayPassForm.watch('facility_id') ?? '')} onValueChange={v => dayPassForm.setValue('facility_id', Number(v), { shouldValidate: true })}>
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue placeholder="Select…" />
                      </SelectTrigger>
                      <SelectContent>
                        {facilities.map(f => <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
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
