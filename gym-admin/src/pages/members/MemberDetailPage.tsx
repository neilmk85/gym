import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { AvatarWithFallback } from '@/components/shared/AvatarWithFallback'
import { FormDrawer } from '@/components/shared/FormDrawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { membersApi } from '@/api/members.api'
import { trainersApi } from '@/api/trainers.api'
import { plansApi } from '@/api/plans.api'
import { subscriptionsApi } from '@/api/subscriptions.api'
import { paymentsApi } from '@/api/payments.api'
import { QUERY_KEYS } from '@/lib/constants'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { Member } from '@/types/member.types'
import type { TrainerProfile } from '@/types/trainer.types'
import type { Plan } from '@/types/plan.types'
import type { Subscription } from '@/types/subscription.types'
import {
  ArrowLeft, Pencil, Users, Ruler, Weight, Calendar, User,
  Dumbbell, UserCheck, CreditCard, Phone, Mail,
  AlertCircle, CheckCircle2, XCircle, Clock,
  Activity, HeartPulse, ShieldCheck, IndianRupee, Repeat,
  Camera, RotateCcw, FlipHorizontal,
  Target, TrendingUp, TrendingDown, Zap, BarChart2, Droplets, Star,
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

const RELATIONSHIPS = [
  'Spouse', 'Parent', 'Child', 'Sibling', 'Relative',
  'Friend', 'Colleague', 'Guardian', 'Other',
]

// ─── Edit form schema ─────────────────────────────────────────────────────────

const editSchema = z.object({
  first_name: z.string().min(1, 'Required'),
  last_name:  z.string().min(1, 'Required'),
  phone:      z.string().min(7, 'Required'),
  date_of_birth: z.string().optional(),
  gender:     z.enum(['male', 'female', 'other']).optional(),
  height_cm:  z.coerce.number().int().positive().optional().or(z.literal('')),
  weight_kg:  z.coerce.number().positive().optional().or(z.literal('')),
  emergency_contact_name:         z.string().optional(),
  emergency_contact_phone:        z.string().optional(),
  emergency_contact_relationship: z.string().optional(),
  member_notes: z.string().optional(),
})
type EditValues = z.infer<typeof editSchema>

function dbG(g?: string): 'male' | 'female' | 'other' | undefined {
  if (g === 'M') return 'male'
  if (g === 'F') return 'female'
  if (g === 'Other' || g === 'other') return 'other'
  return undefined
}
function toDb(g: string) { return g === 'male' ? 'M' : g === 'female' ? 'F' : 'Other' }
function toDateVal(iso?: string) { return iso ? iso.slice(0, 10) : '' }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcAge(dob?: string): number | null {
  if (!dob) return null
  const birth = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

// ─── BMR ─────────────────────────────────────────────────────────────────────

const TDEE_LEVELS = [
  { key: 'sedentary', label: 'Sedentary',  sub: 'little or no exercise',    multiplier: 1.2   },
  { key: 'light',     label: 'Light',      sub: '1–3 days/week',            multiplier: 1.375 },
  { key: 'moderate',  label: 'Moderate',   sub: '3–5 days/week',            multiplier: 1.55  },
  { key: 'active',    label: 'Active',     sub: '6–7 days/week',            multiplier: 1.725 },
]

function calcBMR(heightCm?: number, weightKg?: number, ageyrs?: number | null, gender?: string): number | null {
  if (!heightCm || !weightKg || !ageyrs) return null
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageyrs
  const sex = gender === 'M' || gender === 'male' ? 1 : gender === 'F' || gender === 'female' ? -1 : 0
  return Math.round(base + (sex === 1 ? 5 : sex === -1 ? -161 : -78)) // -78 = average of +5 and -161
}

const BMI_MIN = 15
const BMI_MAX = 40
const BMI_ZONES = [
  { label: 'Underweight', min: BMI_MIN, max: 18.5, color: '#60a5fa', bg: 'bg-blue-400',   text: 'text-blue-600'   },
  { label: 'Normal',      min: 18.5,   max: 25,   color: '#34d399', bg: 'bg-emerald-400', text: 'text-emerald-600' },
  { label: 'Overweight',  min: 25,     max: 30,   color: '#fbbf24', bg: 'bg-amber-400',   text: 'text-amber-600'  },
  { label: 'Obese',       min: 30,     max: BMI_MAX, color: '#f87171', bg: 'bg-red-400',  text: 'text-red-600'    },
]

function calcBMI(heightCm?: number, weightKg?: number): {
  value: number; label: string; color: string; textColor: string; zoneIdx: number
  idealMin: number; idealMax: number; gaugePercent: number
} | null {
  if (!heightCm || !weightKg) return null
  const h = heightCm / 100
  const raw = weightKg / (h * h)
  const value = Math.round(raw * 10) / 10
  const zoneIdx = raw < 18.5 ? 0 : raw < 25 ? 1 : raw < 30 ? 2 : 3
  const zone = BMI_ZONES[zoneIdx]
  const gaugePercent = Math.min(100, Math.max(0, ((raw - BMI_MIN) / (BMI_MAX - BMI_MIN)) * 100))
  const idealMin = Math.round(18.5 * h * h * 10) / 10
  const idealMax = Math.round(24.9 * h * h * 10) / 10
  return { value, label: zone.label, color: zone.color, textColor: zone.text, zoneIdx, idealMin, idealMax, gaugePercent }
}

function classTypeColor(type: string) {
  const map: Record<string, string> = {
    yoga:     'bg-purple-100 text-purple-700',
    cardio:   'bg-red-100 text-red-700',
    strength: 'bg-orange-100 text-orange-700',
    zumba:    'bg-pink-100 text-pink-700',
    pilates:  'bg-blue-100 text-blue-700',
    crossfit: 'bg-amber-100 text-amber-700',
    spin:     'bg-cyan-100 text-cyan-700',
    hiit:     'bg-rose-100 text-rose-700',
    other:    'bg-gray-100 text-gray-600',
  }
  return map[type?.toLowerCase()] ?? 'bg-gray-100 text-gray-600'
}

function bookingStatusIcon(status: string) {
  switch (status) {
    case 'attended':   return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
    case 'confirmed':  return <Clock className="h-4 w-4 text-sky-500" />
    case 'cancelled':  return <XCircle className="h-4 w-4 text-red-400" />
    case 'no_show':    return <AlertCircle className="h-4 w-4 text-amber-500" />
    case 'waitlisted': return <Clock className="h-4 w-4 text-gray-400" />
    default:           return <Clock className="h-4 w-4 text-gray-400" />
  }
}

// ─── Section header component ─────────────────────────────────────────────────

function SectionHeader({ icon, title, badge }: { icon: React.ReactNode; title: string; badge?: React.ReactNode }) {
  return (
    <div
      className="flex items-center gap-2.5 px-5 py-3 rounded-t-xl"
      style={{
        background: 'linear-gradient(to right, #eff6ff 0%, #eef2ff 100%)',
        borderBottom: '1px solid #dbeafe',
      }}
    >
      <div className="h-6 w-6 rounded-md bg-blue-100 border border-blue-200 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <h3 className="text-sm font-semibold tracking-wide flex-1" style={{ color: '#1f2937' }}>{title}</h3>
      {badge}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const memberId = Number(id)
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [editPlanId, setEditPlanId] = useState<number | null>(null)
  const [ptSetupOpen, setPtSetupOpen] = useState(false)
  const [pendingTrainerId, setPendingTrainerId] = useState<number | null>(null)
  const [ptTrainerName, setPtTrainerName] = useState('')
  const [ptSessions, setPtSessions] = useState('')
  const [ptFeeType, setPtFeeType] = useState<'per_session' | 'per_month'>('per_session')
  const [ptFee, setPtFee] = useState('')
  const [ptPeriodMonths, setPtPeriodMonths] = useState('1')
  const [ptStartDate, setPtStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [ptNotes, setPtNotes] = useState('')
  const [ptSaving, setPtSaving] = useState(false)
  const [ptPaymentInput, setPtPaymentInput] = useState('')
  const [ptPaymentSaving, setPtPaymentSaving] = useState(false)
  const [ptPayOpen, setPtPayOpen] = useState(false)
  const [ptPayMethod, setPtPayMethod] = useState('cash')
  const [recPayOpen, setRecPayOpen] = useState(false)
  const [recPayAmount, setRecPayAmount] = useState('')
  const [recPayMethod, setRecPayMethod] = useState('cash')
  const [recPayRef, setRecPayRef] = useState('')
  const [recPayNotes, setRecPayNotes] = useState('')
  const [recPaySaving, setRecPaySaving] = useState(false)

  // ── Webcam ──
  const [localPhotoUrl, setLocalPhotoUrl] = useState<string | null>(null)
  const [photoViewOpen, setPhotoViewOpen] = useState(false)
  const [camOpen, setCamOpen] = useState(false)
  const [camStream, setCamStream] = useState<MediaStream | null>(null)
  const [camCapture, setCamCapture] = useState<string | null>(null)
  const [camSaving, setCamSaving] = useState(false)
  const [camError, setCamError] = useState<string | null>(null)
  const [camMirrored, setCamMirrored] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const startCamera = useCallback(async () => {
    setCamError(null)
    setCamCapture(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 640, facingMode: 'user' } })
      setCamStream(stream)
    } catch {
      setCamError('Camera access denied or not available.')
    }
  }, [])

  const stopCamera = useCallback(() => {
    camStream?.getTracks().forEach(t => t.stop())
    setCamStream(null)
  }, [camStream])

  useEffect(() => {
    if (camStream && videoRef.current) {
      videoRef.current.srcObject = camStream
    }
  }, [camStream])

  useEffect(() => {
    if (camOpen) startCamera()
    else { stopCamera(); setCamCapture(null); setCamError(null) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camOpen])

  const capturePhoto = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    const size = Math.min(video.videoWidth, video.videoHeight)
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    if (camMirrored) {
      ctx.translate(size, 0)
      ctx.scale(-1, 1)
    }
    const offsetX = (video.videoWidth - size) / 2
    const offsetY = (video.videoHeight - size) / 2
    ctx.drawImage(video, offsetX, offsetY, size, size, 0, 0, size, size)
    setCamCapture(canvas.toDataURL('image/jpeg', 0.82))
  }

  const savePhoto = async () => {
    if (!camCapture) return
    setCamSaving(true)
    try {
      await membersApi.update(memberId, { profile_photo_url: camCapture })
      setLocalPhotoUrl(camCapture)
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.member(memberId) })
      toast.success('Photo saved')
      stopCamera()
      setCamOpen(false)
    } catch {
      toast.error('Failed to save photo')
    } finally {
      setCamSaving(false)
    }
  }

  // ── Body Composition modal ──
  const [bcOpen, setBcOpen] = useState(false)
  const [bcSaving, setBcSaving] = useState(false)
  const [bcFat, setBcFat] = useState('')
  const [bcVisceral, setBcVisceral] = useState('')
  const [bcWater, setBcWater] = useState('')
  const [bcSkeletal, setBcSkeletal] = useState('')
  const [bcMetabolicAge, setBcMetabolicAge] = useState('')
  const [bcWaist, setBcWaist] = useState('')
  const [bcChest, setBcChest] = useState('')
  const [bcArm, setBcArm] = useState('')
  const [bcThigh, setBcThigh] = useState('')
  const [bcNeck, setBcNeck] = useState('')

  // Progress log modal
  const [progressOpen, setProgressOpen] = useState(false)
  const [progressSaving, setProgressSaving] = useState(false)
  const [progressWeight, setProgressWeight] = useState('')
  const [progressFat, setProgressFat] = useState('')
  const [progressNotes, setProgressNotes] = useState('')

  // Goals modal
  const [goalsOpen, setGoalsOpen] = useState(false)
  const [goalsSaving, setGoalsSaving] = useState(false)
  const [goalTargetWeight, setGoalTargetWeight] = useState('')
  const [goalTargetFat, setGoalTargetFat] = useState('')

  // Strength log modal
  const [strengthOpen, setStrengthOpen] = useState(false)
  const [strengthSaving, setStrengthSaving] = useState(false)
  const [strengthBench, setStrengthBench] = useState('')
  const [strengthSquat, setStrengthSquat] = useState('')
  const [strengthDeadlift, setStrengthDeadlift] = useState('')
  const [strengthPullup, setStrengthPullup] = useState('')

  const { data: memberData, isLoading, isError } = useQuery({
    queryKey: QUERY_KEYS.member(memberId),
    queryFn: () => membersApi.getById(memberId),
    enabled: !!memberId,
  })

  const { data: subsData, isLoading: subsLoading } = useQuery({
    queryKey: QUERY_KEYS.memberSubscriptions(memberId),
    queryFn: () => membersApi.getSubscriptions(memberId),
    enabled: !!memberId,
  })

  const { data: paymentsData, isLoading: paymentsLoading, isError: paymentsError } = useQuery({
    queryKey: QUERY_KEYS.memberPayments(memberId),
    queryFn: () => membersApi.getPayments(memberId),
    enabled: !!memberId,
  })

  const { data: bookingsData, isLoading: bookingsLoading } = useQuery({
    queryKey: ['member-bookings', memberId],
    queryFn: () => membersApi.getBookings(memberId),
    enabled: !!memberId,
  })

  const { data: trainersData } = useQuery({
    queryKey: QUERY_KEYS.trainers,
    queryFn: () => trainersApi.list(true),
  })

  const { data: plansData } = useQuery({
    queryKey: QUERY_KEYS.plans,
    queryFn: () => plansApi.list(true),
  })
  const allPlans: Plan[] = (plansData as { plans?: Plan[] })?.plans ?? []

  const m = memberData as Member | undefined

  // Subscriptions
  const subscriptions = (subsData as { items?: unknown[] })?.items
    ?? (subsData as { subscriptions?: unknown[] })?.subscriptions
    ?? []
  const activeSub = ((subscriptions as Subscription[]).find(s => s.status === 'active')
    ?? subscriptions[0]) as (Subscription & {
        plan?: { name?: string; price_amount?: number; pt_access?: boolean; max_pt_sessions_per_month?: number; type?: string; group_class_access?: boolean; locker_access?: boolean }
      }) | undefined

  // Payments
  const payments = ((paymentsData as { items?: unknown[] })?.items
    ?? (paymentsData as { payments?: unknown[] })?.payments ?? []) as {
    id?: number
    amount?: number
    currency?: string
    status?: string
    payment_method?: string
    transaction_id?: string
    reference_number?: string
    notes?: string
    refund_amount?: number
    refund_reason?: string
    refunded_at?: string
    paid_at?: string
    created_at?: string
    subscription?: { id?: number; plan?: { name?: string; price_amount?: number } }
  }[]

  // Bookings / classes
  const bookings = (bookingsData as { items?: unknown[] })?.items
    ?? (bookingsData as { bookings?: unknown[] })?.bookings
    ?? (Array.isArray(bookingsData) ? bookingsData : []) as {
        id?: number; status?: string; booked_at?: string;
        class?: { id?: number; name?: string; class_type?: string; start_time?: string; end_time?: string; duration_mins?: number; trainer?: { user?: { first_name?: string; last_name?: string } } }
      }[]

  // Body stats
  const user = m?.user
  const bmi = calcBMI(user?.height_cm, user?.weight_kg)
  const age = calcAge(user?.date_of_birth)
  const bmr = calcBMR(user?.height_cm, user?.weight_kg, age, user?.gender)
  const healthDecl = m?.health_declaration as Record<string, unknown> | undefined
  const memberActivityLevel = (healthDecl?.activity_level as string) ?? ''
  const ptContract = healthDecl?.pt_contract as {
    trainer_name?: string; sessions_per_month?: number; fee_type?: string
    fee?: number; total_fee?: number; period_months?: number
    start_date?: string; notes?: string; paid_amount?: number
  } | undefined

  // ── Body composition ──
  const bodyComp = (healthDecl?.body_composition as {
    body_fat_pct?: number; visceral_fat?: number; water_pct?: number
    skeletal_muscle_pct?: number; metabolic_age?: number
    waist_cm?: number; chest_cm?: number; arm_cm?: number
    thigh_cm?: number; neck_cm?: number
  } | undefined) ?? {}

  const leanMass   = bodyComp.body_fat_pct != null && user?.weight_kg
    ? Math.round(user.weight_kg * (1 - bodyComp.body_fat_pct / 100) * 10) / 10 : null
  const fatMass    = bodyComp.body_fat_pct != null && user?.weight_kg
    ? Math.round(user.weight_kg * (bodyComp.body_fat_pct / 100) * 10) / 10 : null

  const activityCalories = bmr ? {
    sedentary: Math.round(bmr * 1.2),
    moderate:  Math.round(bmr * 1.55),
    active:    Math.round(bmr * 1.725),
  } : null

  const proteinMin = user?.weight_kg ? Math.round(user.weight_kg * 1.6) : null
  const proteinMax = user?.weight_kg ? Math.round(user.weight_kg * 2.0) : null
  const waterMin   = user?.weight_kg ? (user.weight_kg * 0.033).toFixed(1) : null
  const waterMax   = user?.weight_kg ? (user.weight_kg * 0.040).toFixed(1) : null
  const waistHtRatio = bodyComp.waist_cm && user?.height_cm
    ? (bodyComp.waist_cm / user.height_cm).toFixed(2) : null

  function bodyFatLabel(pct: number, gender?: string): { label: string; color: string } {
    const isMale = gender === 'M' || gender === 'male'
    if (isMale) {
      if (pct < 6)  return { label: 'Essential', color: '#60a5fa' }
      if (pct < 14) return { label: 'Athletic',  color: '#34d399' }
      if (pct < 18) return { label: 'Fitness',   color: '#4ade80' }
      if (pct < 25) return { label: 'Average',   color: '#fbbf24' }
      return          { label: 'Obese',          color: '#f87171' }
    } else {
      if (pct < 14) return { label: 'Essential', color: '#60a5fa' }
      if (pct < 21) return { label: 'Athletic',  color: '#34d399' }
      if (pct < 25) return { label: 'Fitness',   color: '#4ade80' }
      if (pct < 32) return { label: 'Average',   color: '#fbbf24' }
      return          { label: 'Obese',          color: '#f87171' }
    }
  }

  function visceralLabel(v: number): { label: string; color: string } {
    if (v <= 9)  return { label: 'Healthy',      color: '#34d399' }
    if (v <= 14) return { label: 'High',         color: '#fbbf24' }
    return        { label: 'Very High',          color: '#f87171' }
  }

  function waterLabel(pct: number, gender?: string): { label: string; color: string } {
    const isMale = gender === 'M' || gender === 'male'
    const ok = isMale ? pct >= 50 && pct <= 65 : pct >= 45 && pct <= 60
    const low = isMale ? pct < 50 : pct < 45
    if (ok)  return { label: 'Healthy',     color: '#34d399' }
    if (low) return { label: 'Dehydrated',  color: '#f87171' }
    return    { label: 'High',              color: '#60a5fa' }
  }

  function waistHtLabel(ratio: number): { label: string; color: string } {
    if (ratio < 0.43) return { label: 'Slim',            color: '#60a5fa' }
    if (ratio < 0.53) return { label: 'Healthy',         color: '#34d399' }
    if (ratio < 0.58) return { label: 'Overweight',      color: '#fbbf24' }
    return              { label: 'High Risk',             color: '#f87171' }
  }

  // ── Progress log ──
  const progressLog = (healthDecl?.progress_log as Array<{
    date: string; weight_kg?: number; body_fat_pct?: number; notes?: string
  }> | undefined) ?? []

  // ── Goals ──
  const goals = (healthDecl?.goals as {
    target_weight_kg?: number; target_body_fat_pct?: number
  } | undefined) ?? {}

  // ── Strength log ──
  type StrengthEntry = { date: string; bench_kg?: number; squat_kg?: number; deadlift_kg?: number; pullup_kg?: number }
  const strengthLog = (healthDecl?.strength_log as StrengthEntry[] | undefined) ?? []
  const latestStrength = strengthLog.length > 0 ? strengthLog[strengthLog.length - 1] : null
  const firstStrength  = strengthLog.length > 1 ? strengthLog[0] : null

  // ── Fitness Score (0–100) ──
  function calcFitnessScore(): { score: number; grade: string; color: string; breakdown: { label: string; pts: number; max: number }[] } | null {
    if (!bmi && bodyComp.body_fat_pct == null) return null
    let total = 0
    const breakdown: { label: string; pts: number; max: number }[] = []

    // BMI (20 pts)
    if (bmi) {
      const bmiPts = bmi.label === 'Normal' ? 20 : bmi.label === 'Overweight' ? 12 : bmi.label === 'Underweight' ? 10 : 5
      total += bmiPts; breakdown.push({ label: 'BMI', pts: bmiPts, max: 20 })
    }

    // Body Fat (25 pts)
    if (bodyComp.body_fat_pct != null) {
      const fl = bodyFatLabel(bodyComp.body_fat_pct, user?.gender)
      const fatPts = fl.label === 'Athletic' ? 25 : fl.label === 'Fitness' ? 20 : fl.label === 'Average' ? 12 : fl.label === 'Essential' ? 15 : 5
      total += fatPts; breakdown.push({ label: 'Body Fat', pts: fatPts, max: 25 })
    }

    // Visceral Fat (20 pts)
    if (bodyComp.visceral_fat != null) {
      const vl = visceralLabel(bodyComp.visceral_fat)
      const vPts = vl.label === 'Healthy' ? 20 : vl.label === 'High' ? 10 : 3
      total += vPts; breakdown.push({ label: 'Visceral Fat', pts: vPts, max: 20 })
    }

    // Hydration (15 pts)
    if (bodyComp.water_pct != null) {
      const wl = waterLabel(bodyComp.water_pct, user?.gender)
      const wPts = wl.label === 'Healthy' ? 15 : wl.label === 'Dehydrated' ? 5 : 10
      total += wPts; breakdown.push({ label: 'Hydration', pts: wPts, max: 15 })
    }

    // Skeletal Muscle (20 pts) — men ideal 40-44%, women 36-40%
    if (bodyComp.skeletal_muscle_pct != null) {
      const isMale = user?.gender === 'M' || user?.gender === 'male'
      const smIdeal = isMale ? bodyComp.skeletal_muscle_pct >= 40 : bodyComp.skeletal_muscle_pct >= 36
      const smPts = smIdeal ? 20 : bodyComp.skeletal_muscle_pct >= 33 ? 12 : 6
      total += smPts; breakdown.push({ label: 'Muscle Mass', pts: smPts, max: 20 })
    }

    // Normalise to 100 based on max possible with available data
    const maxPossible = breakdown.reduce((s, b) => s + b.max, 0)
    if (maxPossible === 0) return null
    const score = Math.round((total / maxPossible) * 100)
    const grade = score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 55 ? 'Average' : 'Needs Work'
    const color = score >= 85 ? '#34d399' : score >= 70 ? '#60a5fa' : score >= 55 ? '#fbbf24' : '#f87171'
    return { score, grade, color, breakdown }
  }
  const fitnessScore = calcFitnessScore()

  // ── Suggested workout split ──
  function suggestWorkoutSplit(): { split: string; cardio: string; reason: string } {
    const bf = bodyComp.body_fat_pct
    const isMale = user?.gender === 'M' || user?.gender === 'male'
    const highFat = bf != null && (isMale ? bf > 20 : bf > 28)
    const lowFat  = bf != null && (isMale ? bf < 15 : bf < 22)
    if (highFat)  return { split: '3-day full body + 3 cardio',    cardio: '3× cardio/week',      reason: 'Focus on fat loss through combined resistance + cardio' }
    if (lowFat)   return { split: '5-day hypertrophy split',       cardio: '1× light cardio/week', reason: 'Low fat — prioritise muscle gain with heavy compound lifts' }
    return          { split: '4-day upper/lower split',            cardio: '2× cardio/week',      reason: 'Balanced approach for body recomposition' }
  }
  const workoutSplit = (user?.height_cm || bodyComp.body_fat_pct != null) ? suggestWorkoutSplit() : null

  // ── Goal progress ──
  const goalWeightPct = goals.target_weight_kg != null && user?.weight_kg != null
    ? (() => {
        const current = user.weight_kg!
        const target  = goals.target_weight_kg!
        if (current === target) return 100
        // losing: bar = target/current; gaining: bar = current/target
        return current > target
          ? Math.min(100, Math.round((target / current) * 100))
          : Math.min(100, Math.round((current / target) * 100))
      })()
    : null

  const goalFatPct = goals.target_body_fat_pct != null && bodyComp.body_fat_pct != null
    ? (() => {
        const current = bodyComp.body_fat_pct!
        const target  = goals.target_body_fat_pct!
        if (current === target) return 100
        return current > target
          ? Math.min(100, Math.round((target / current) * 100))
          : Math.min(100, Math.round((current / target) * 100))
      })()
    : null

  // ── Chart data ──
  const weightChartData = progressLog
    .filter(p => p.weight_kg != null)
    .slice(-12)
    .map(p => ({ date: p.date.slice(5), weight: p.weight_kg }))

  const fatChartData = progressLog
    .filter(p => p.body_fat_pct != null)
    .slice(-12)
    .map(p => ({ date: p.date.slice(5), fat: p.body_fat_pct }))

  // ── Calorie goal recommendations ──
  const calorieGoals = bmr && user?.weight_kg ? {
    fatLoss:     Math.round(bmr * 1.375 * 0.8),
    maintenance: Math.round(bmr * 1.375),
    muscleGain:  Math.round(bmr * 1.375 * 1.15),
  } : null

  // ── Ideal weight ──
  const idealWeightMin = user?.height_cm ? Math.round(18.5 * (user.height_cm / 100) ** 2 * 10) / 10 : null
  const idealWeightMax = user?.height_cm ? Math.round(24.9 * (user.height_cm / 100) ** 2 * 10) / 10 : null

  // PT info from plan
  const plan = (activeSub as { plan?: { pt_access?: boolean; max_pt_sessions_per_month?: number; name?: string; type?: string } } | undefined)?.plan
  const hasPTAccess = plan?.pt_access === true

  // ── Edit form ─────────────────────────────────────────────────────────────
  const u = m?.user
  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      first_name: '', last_name: '', phone: '+91 ',
      date_of_birth: '', gender: undefined,
      height_cm: '', weight_kg: '',
      emergency_contact_name: '', emergency_contact_phone: '+91 ',
      emergency_contact_relationship: '', member_notes: '',
    },
  })

  // Reset the form with the latest member data every time the drawer opens
  useEffect(() => {
    if (editOpen && u) {
      reset({
        first_name:    u.first_name ?? '',
        last_name:     u.last_name  ?? '',
        phone:         u.phone      || '+91 ',
        date_of_birth: toDateVal(u.date_of_birth),
        gender:        dbG(u.gender),
        height_cm:     u.height_cm  ?? '',
        weight_kg:     u.weight_kg  ?? '',
        emergency_contact_name:         u.emergency_contact_name         ?? '',
        emergency_contact_phone:        u.emergency_contact_phone        || '+91 ',
        emergency_contact_relationship: u.emergency_contact_relationship ?? '',
        member_notes:  m?.member_notes ?? '',
      })
      setEditPlanId(activeSub?.plan_id ?? null)
    }
  // u?.id covers the case where member data loads AFTER the drawer was opened
  }, [editOpen, u?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (bcOpen) {
      setBcFat(bodyComp.body_fat_pct != null ? String(bodyComp.body_fat_pct) : '')
      setBcVisceral(bodyComp.visceral_fat != null ? String(bodyComp.visceral_fat) : '')
      setBcWater(bodyComp.water_pct != null ? String(bodyComp.water_pct) : '')
      setBcSkeletal(bodyComp.skeletal_muscle_pct != null ? String(bodyComp.skeletal_muscle_pct) : '')
      setBcMetabolicAge(bodyComp.metabolic_age != null ? String(bodyComp.metabolic_age) : '')
      setBcWaist(bodyComp.waist_cm != null ? String(bodyComp.waist_cm) : '')
      setBcChest(bodyComp.chest_cm != null ? String(bodyComp.chest_cm) : '')
      setBcArm(bodyComp.arm_cm != null ? String(bodyComp.arm_cm) : '')
      setBcThigh(bodyComp.thigh_cm != null ? String(bodyComp.thigh_cm) : '')
      setBcNeck(bodyComp.neck_cm != null ? String(bodyComp.neck_cm) : '')
    }
  }, [bcOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (goalsOpen) {
      setGoalTargetWeight(goals.target_weight_kg != null ? String(goals.target_weight_kg) : '')
      setGoalTargetFat(goals.target_body_fat_pct != null ? String(goals.target_body_fat_pct) : '')
    }
  }, [goalsOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (strengthOpen && latestStrength) {
      setStrengthBench(latestStrength.bench_kg != null ? String(latestStrength.bench_kg) : '')
      setStrengthSquat(latestStrength.squat_kg != null ? String(latestStrength.squat_kg) : '')
      setStrengthDeadlift(latestStrength.deadlift_kg != null ? String(latestStrength.deadlift_kg) : '')
      setStrengthPullup(latestStrength.pullup_kg != null ? String(latestStrength.pullup_kg) : '')
    }
  }, [strengthOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const editMutation = useMutation({
    mutationFn: async (data: EditValues) => {
      const payload: Record<string, unknown> = {
        first_name:    data.first_name,
        last_name:     data.last_name,
        phone:         data.phone,
        date_of_birth: data.date_of_birth ?? '',
        gender:        data.gender ? toDb(data.gender) : '',
      }
      if (data.height_cm !== '' && data.height_cm !== undefined) payload.height_cm = Number(data.height_cm)
      if (data.weight_kg !== '' && data.weight_kg !== undefined) payload.weight_kg = Number(data.weight_kg)
      if (data.emergency_contact_name)         payload.emergency_contact_name         = data.emergency_contact_name
      if (data.emergency_contact_phone)        payload.emergency_contact_phone        = data.emergency_contact_phone
      if (data.emergency_contact_relationship) payload.emergency_contact_relationship = data.emergency_contact_relationship
      if (data.member_notes !== undefined)     payload.member_notes                   = data.member_notes
      await membersApi.update(memberId, payload)

      // Handle plan change
      if (editPlanId !== null && editPlanId !== activeSub?.plan_id) {
        if (activeSub?.id) {
          await subscriptionsApi.upgrade(activeSub.id, editPlanId)
        } else {
          await subscriptionsApi.create({ member_id: memberId, plan_id: editPlanId, auto_renew: true })
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.member(memberId) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.memberSubscriptions(memberId) })
      toast.success('Member updated')
      setEditOpen(false)
    },
    onError: (err: Error) => {
      const apiErr = err as { details?: string; message?: string }
      toast.error(apiErr.details || apiErr.message || 'Failed to save changes')
    },
  })

  const assignTrainerMutation = useMutation({
    mutationFn: ({ trainerId, trainerName }: { trainerId: number | null; trainerName: string }) =>
      membersApi.assignTrainer(memberId, trainerId, trainerName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.member(memberId) })
      toast.success('Trainer unassigned')
    },
    onError: () => toast.error('Failed to update trainer assignment'),
  })

  function openPtModal(trainerId: number, trainerName: string) {
    setPendingTrainerId(trainerId)
    setPtTrainerName(trainerName)
    setPtSessions('')
    setPtFeeType('per_session')
    setPtFee('')
    setPtPeriodMonths('1')
    setPtStartDate(new Date().toISOString().slice(0, 10))
    setPtNotes('')
    setPtSetupOpen(true)
  }

  const allTrainers: TrainerProfile[] = (trainersData as { trainers?: TrainerProfile[] })?.trainers ?? []
  const assignedTrainerId = m?.assigned_trainer_id ?? null
  const assignedTrainer = allTrainers.find(t => t.id === assignedTrainerId)

  const SectionTitle = ({ label }: { label: string }) => (
    <div className="col-span-2">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 pb-1 border-b border-border/50">
        {label}
      </p>
    </div>
  )

  if (isError) {
    return (
      <div className="p-6">
        <Button variant="outline" onClick={() => navigate('/members')} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Members
        </Button>
        <p className="text-destructive">Failed to load member details.</p>
      </div>
    )
  }

  const fullName = isLoading ? 'Loading…' : `${m?.user?.first_name ?? ''} ${m?.user?.last_name ?? ''}`
  const photoUrl = localPhotoUrl ?? m?.user?.profile_photo_url

  return (
    <div className="space-y-6">
      <PageHeader
        onBack={() => navigate('/members')}
        backLabel="Members"
        title={fullName}
        subtitle={
          <>
            {m?.member_code && (
              <span className="font-mono text-xs font-bold bg-yellow-400 text-yellow-900 px-2.5 py-0.5 rounded-full border border-yellow-500/40">
                {m.member_code}
              </span>
            )}
            {m?.user?.email && (
              <span className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5 opacity-70" /> {m.user.email}
              </span>
            )}
            {m?.user?.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5 opacity-70" /> {m.user.phone}
              </span>
            )}
            {m?.joined_date && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 opacity-70" /> Joined {formatDate(m.joined_date)}
              </span>
            )}
            {m?.membership_status && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${
                m.membership_status === 'active'  ? 'bg-emerald-400/20 border-emerald-300/40 text-emerald-100' :
                m.membership_status === 'frozen'  ? 'bg-sky-400/20 border-sky-300/40 text-sky-100' :
                m.membership_status === 'expired' ? 'bg-amber-400/20 border-amber-300/40 text-amber-100' :
                'bg-white/15 border-white/20 text-white/80'
              }`}>
                {m.membership_status.charAt(0).toUpperCase() + m.membership_status.slice(1)}
              </span>
            )}
          </>
        }

        icon={
          <button
            onClick={() => setPhotoViewOpen(true)}
            className="relative group focus:outline-none"
            title="View / update photo"
          >
            <AvatarWithFallback
              src={photoUrl}
              firstName={m?.user?.first_name}
              lastName={m?.user?.last_name}
              className="h-10 w-10 text-sm border-2 border-white/30"
            />
            <span className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="h-4 w-4 text-white" />
            </span>
          </button>
        }
        stats={[
          {
            label: 'Status',
            value: m?.membership_status
              ? m.membership_status.charAt(0).toUpperCase() + m.membership_status.slice(1)
              : '—',
            sub: 'membership',
            icon: <ShieldCheck className="h-4 w-4 text-white" />,
          },
          {
            label: 'Plan',
            value: plan?.name ?? '—',
            sub: plan?.type ?? 'subscription',
            icon: <CreditCard className="h-4 w-4 text-white" />,
          },
          {
            label: 'Start Date',
            value: subsLoading ? '…' : activeSub?.start_date ? formatDate(activeSub.start_date) : '—',
            sub: 'plan start',
            icon: <Calendar className="h-4 w-4 text-white" />,
          },
          {
            label: 'End Date',
            value: (() => {
              if (subsLoading) return '…'
              if (!activeSub?.end_date) return '—'
              const daysLeft = Math.ceil((new Date(activeSub.end_date).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000)
              const cls = daysLeft < 0
                ? 'text-red-300'
                : daysLeft <= 7
                ? 'text-red-300'
                : daysLeft <= 30
                ? 'text-amber-300'
                : 'text-emerald-300'
              return <span className={cls}>{formatDate(activeSub.end_date)}</span>
            })(),
            sub: 'plan expiry',
            icon: <Calendar className="h-4 w-4 text-white" />,
          },
          {
            label: 'Fees Paid',
            value: subsLoading ? '…' : activeSub?.plan?.price_amount != null
              ? `₹${(activeSub.plan.price_amount as number).toLocaleString('en-IN')}`
              : '—',
            sub: 'membership fee',
            icon: <IndianRupee className="h-4 w-4 text-white" />,
          },
          {
            label: 'BMI',
            value: bmi ? bmi.value : '—',
            sub: bmi ? bmi.label : 'not recorded',
            icon: <Activity className="h-4 w-4 text-white" />,
          },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate(`/pt/enroll?member_id=${memberId}`)}>
              <Dumbbell className="h-4 w-4 mr-1" /> Sell PT Package
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4 mr-1" /> Edit
            </Button>
          </div>
        }
      />


      {/* ── Row 1: Body Stats + Personal Trainer ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Body Stats */}
        <Card className="border-0 shadow-md overflow-hidden">
          <SectionHeader icon={<HeartPulse className="h-3.5 w-3.5 text-blue-600" />} title="Body Stats" />
          <CardContent className="p-5">
            {isLoading ? (
              <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : (
              <div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      icon: <Ruler className="h-3.5 w-3.5 text-sky-500" />,
                      label: 'Height',
                      value: user?.height_cm ? `${user.height_cm} cm` : '—',
                      sub: user?.height_cm ? `${Math.floor(user.height_cm / 30.48)}′${Math.round((user.height_cm % 30.48) / 2.54)}″` : null,
                    },
                    {
                      icon: <Weight className="h-3.5 w-3.5 text-emerald-500" />,
                      label: 'Weight',
                      value: user?.weight_kg ? `${user.weight_kg} kg` : '—',
                      sub: user?.weight_kg ? `${Math.round(user.weight_kg * 2.20462)} lbs` : null,
                    },
                    {
                      icon: <Calendar className="h-3.5 w-3.5 text-blue-500" />,
                      label: 'Age',
                      value: age !== null ? `${age} yrs` : '—',
                      sub: user?.date_of_birth ? formatDate(user.date_of_birth) : null,
                    },
                    {
                      icon: <User className="h-3.5 w-3.5 text-amber-500" />,
                      label: 'Gender',
                      value: user?.gender === 'M' ? 'Male' : user?.gender === 'F' ? 'Female' : user?.gender ?? '—',
                      sub: null,
                    },
                    {
                      icon: <Activity className="h-3.5 w-3.5 shrink-0" style={{ color: bmi?.color ?? '#94a3b8' }} />,
                      label: 'BMI',
                      value: bmi ? bmi.value : '—',
                      sub: bmi ? bmi.label : null,
                      valueColor: bmi?.color,
                      subColor: bmi?.color,
                    },
                    {
                      icon: <HeartPulse className="h-3.5 w-3.5 text-blue-500" />,
                      label: 'BMR',
                      value: bmr ? bmr.toLocaleString() : '—',
                      sub: bmr ? 'kcal/day' : null,
                      valueColor: bmr ? '#1d4ed8' : undefined,
                    },
                  ].map((tile, i) => (
                    <div key={i} className="flex flex-col gap-1 rounded-xl px-3 py-2.5 border border-border/50">
                      <div className="flex items-center gap-1.5">
                        {tile.icon}
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{tile.label}</p>
                      </div>
                      <p className="text-sm font-bold leading-tight" style={{ color: (tile as any).valueColor ?? undefined }}>
                        {tile.value}
                      </p>
                      {tile.sub && (
                        <p className="text-[10px] text-muted-foreground leading-none" style={{ color: (tile as any).subColor ?? undefined }}>
                          {tile.sub}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                {!user?.height_cm && !user?.weight_kg && !user?.date_of_birth && (
                  <p className="text-sm text-muted-foreground text-center py-2 mt-2">No body stats recorded yet</p>
                )}

                {/* ── BMI & BMR Tips ── */}
                {(bmi || bmr) && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {/* BMI tip */}
                    {bmi && (() => {
                      const tips: Record<string, { head: string; lines: string[] }> = {
                        Underweight: {
                          head: 'Improve BMI',
                          lines: ['Increase calorie intake with protein-rich meals', 'Add strength training 3×/week to build mass'],
                        },
                        Normal: {
                          head: 'Maintain BMI',
                          lines: ['Keep balanced meals & 150 min cardio/week', 'Monitor weight monthly to stay in range'],
                        },
                        Overweight: {
                          head: 'Lower BMI',
                          lines: ['Create a 300–500 kcal daily deficit', 'Mix cardio + resistance training 4×/week'],
                        },
                        Obese: {
                          head: 'Reduce BMI',
                          lines: ['Structured fat-loss plan with a trainer', 'Low-impact cardio daily; avoid crash diets'],
                        },
                      }
                      const tip = tips[bmi.label] ?? tips['Normal']
                      return (
                        <div className="rounded-xl border border-border/50 px-3 py-2.5 flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <Activity className="h-3.5 w-3.5 shrink-0" style={{ color: bmi.color }} />
                            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: bmi.color }}>{tip.head}</p>
                          </div>
                          <ul className="space-y-1">
                            {tip.lines.map((l, i) => (
                              <li key={i} className="flex items-start gap-1.5">
                                <span className="mt-[4px] h-1.5 w-1.5 rounded-full shrink-0" style={{ background: bmi.color }} />
                                <p className="text-xs text-muted-foreground leading-snug">{l}</p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                    })()}

                    {/* BMR tip */}
                    {bmr && (
                      <div className="rounded-xl border border-border/50 px-3 py-2.5 flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <HeartPulse className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                          <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">Boost BMR</p>
                        </div>
                        <ul className="space-y-1">
                          {[
                            'Build muscle — every kg of muscle burns ~13 kcal/day at rest',
                            'Eat 1.6–2 g protein per kg body weight daily',
                            'Avoid skipping meals; keeps metabolism active',
                          ].map((l, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <span className="mt-[4px] h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
                              <p className="text-xs text-muted-foreground leading-snug">{l}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Personal Trainer */}
        <Card className="border-0 shadow-md overflow-hidden">
          <SectionHeader
            icon={<UserCheck className="h-3.5 w-3.5 text-blue-600" />}
            title="Personal Trainer"
            badge={
              <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${assignedTrainer ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                {assignedTrainer ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                {assignedTrainer ? 'Assigned' : 'Not Assigned'}
              </span>
            }
          />
          <CardContent className="p-5">
            {subsLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : (
              <div className="space-y-4">
                {/* Trainer row */}
                {assignedTrainer ? (
                  <div className="flex items-center gap-3 rounded-xl bg-white border border-border p-3.5">
                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0 font-bold text-slate-600 text-sm">
                      {assignedTrainer.user?.first_name?.[0] ?? '?'}{assignedTrainer.user?.last_name?.[0] ?? ''}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {assignedTrainer.user?.first_name} {assignedTrainer.user?.last_name}
                      </p>
                      {assignedTrainer.specializations && assignedTrainer.specializations.length > 0 && (
                        <p className="text-xs text-muted-foreground truncate capitalize">
                          {assignedTrainer.specializations.slice(0, 2).join(', ')}
                        </p>
                      )}
                    </div>
                    <Button size="sm" variant="ghost"
                      className="text-xs text-destructive hover:text-destructive hover:bg-red-50 shrink-0"
                      disabled={assignTrainerMutation.isPending}
                      onClick={() => assignTrainerMutation.mutate({ trainerId: null, trainerName: '' })}>
                      <XCircle className="h-3.5 w-3.5 mr-1" /> Unassign
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No trainer assigned yet</p>
                )}

                {/* PT Plan summary */}
                {ptContract && (() => {
                  const paid    = ptContract.paid_amount ?? 0
                  const total   = ptContract.total_fee ?? 0
                  const balance = Math.max(0, total - paid)
                  const pct     = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0
                  const fullyPaid = balance === 0 && total > 0
                  return (
                    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #e2e8f0', background: '#ffffff' }}>

                      {/* ── Header ── */}
                      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-blue-400 mb-0.5">Active PT Plan</p>
                            <p className="text-sm font-bold text-blue-900 leading-tight">
                              {ptContract.period_months
                                ? `${ptContract.period_months}-Month Programme`
                                : 'Personal Training'}
                            </p>
                          </div>
                          <button
                            title="Edit PT Plan"
                            className="mt-0.5 h-6 w-6 rounded-md flex items-center justify-center text-blue-400 hover:text-blue-700 hover:bg-blue-100 transition-colors shrink-0"
                            onClick={() => {
                              setPtSessions(String(ptContract.sessions_per_month ?? ''))
                              setPtFeeType((ptContract.fee_type as 'per_session' | 'per_month') ?? 'per_session')
                              setPtFee(String(ptContract.fee ?? ''))
                              setPtPeriodMonths(String(ptContract.period_months ?? '1'))
                              setPtStartDate(ptContract.start_date ?? new Date().toISOString().slice(0, 10))
                              setPtNotes(ptContract.notes ?? '')
                              setPtTrainerName(ptContract.trainer_name ?? '')
                              setPendingTrainerId(null)
                              setPtSetupOpen(true)
                            }}>
                            <Pencil className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          {fullyPaid && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-full">
                              <CheckCircle2 className="h-3 w-3" /> Fully Paid
                            </span>
                          )}
                          {ptContract.start_date && (
                            <div className="text-right">
                              <p className="text-xs font-semibold text-gray-800 leading-snug">
                                {formatDate(ptContract.start_date)}
                                {ptContract.period_months && (() => {
                                  const end = new Date(ptContract.start_date)
                                  end.setMonth(end.getMonth() + ptContract.period_months)
                                  return ` → ${formatDate(end.toISOString().slice(0,10))}`
                                })()}
                              </p>
                              <p className="text-[10px] text-gray-500">Programme dates</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ── 3-stat row ── */}
                      <div className="grid grid-cols-3 mx-4 mb-3 rounded-xl overflow-hidden border border-blue-100 bg-white/70">
                        {[
                          {
                            icon: <Repeat className="h-3.5 w-3.5 text-blue-400" />,
                            label: 'Sessions / mo',
                            value: ptContract.sessions_per_month ? String(ptContract.sessions_per_month) : '—',
                          },
                          {
                            icon: <IndianRupee className="h-3.5 w-3.5 text-blue-400" />,
                            label: ptContract.fee_type === 'per_month' ? 'Fee / month' : 'Fee / session',
                            value: ptContract.fee ? `₹${ptContract.fee.toLocaleString('en-IN')}` : '—',
                          },
                          {
                            icon: <IndianRupee className="h-3.5 w-3.5 text-blue-400" />,
                            label: 'Total value',
                            value: total > 0 ? `₹${total.toLocaleString('en-IN')}` : '—',
                          },
                        ].map((s, i) => (
                          <div key={s.label}
                            className={`px-3 py-2.5 text-center ${i < 2 ? 'border-r border-blue-100' : ''}`}>
                            <p className="text-sm font-bold text-gray-900">{s.value}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                          </div>
                        ))}
                      </div>

                      {/* ── Payment progress ── */}
                      {total > 0 && (
                        <div className="mx-4 mb-4 rounded-xl bg-white/70 border border-blue-100 px-4 py-3 space-y-2.5">
                          {/* Labels */}
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Paid</p>
                              <p className="text-base font-extrabold text-emerald-600 leading-tight">₹{paid.toLocaleString('en-IN')}</p>
                            </div>
                            <div className="text-center">
                              <span className={`text-lg font-black ${fullyPaid ? 'text-emerald-600' : 'text-blue-700'}`}>{pct}%</span>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Balance</p>
                              <p className={`text-base font-extrabold leading-tight ${fullyPaid ? 'text-emerald-600' : 'text-amber-500'}`}>
                                ₹{balance.toLocaleString('en-IN')}
                              </p>
                            </div>
                          </div>
                          {/* Bar */}
                          <div className="h-2.5 rounded-full bg-blue-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${fullyPaid ? 'bg-emerald-400' : 'bg-blue-400'}`}
                              style={{ width: `${pct}%` }} />
                          </div>
                          {/* Record payment */}
                          {!fullyPaid && (
                            <div className="pt-0.5">
                              <Button size="sm"
                                className="w-full h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                                onClick={() => {
                                  setPtPaymentInput('')
                                  setPtPaymentSaving(false)
                                  setPtPayOpen(true)
                                }}>
                                + Record Payment
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Notes */}
                      {ptContract.notes && (
                        <div className="mx-4 mb-4 px-3 py-2 rounded-lg bg-white/60 border border-blue-100">
                          <p className="text-[11px] text-blue-500 leading-relaxed">{ptContract.notes}</p>
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* Trainer selector */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                    {assignedTrainer ? 'Change Trainer' : 'Assign Trainer'}
                  </Label>
                  <Select
                    value={String(assignedTrainerId ?? '')}
                    onValueChange={(val) => {
                      if (!val) return
                      const tid = Number(val)
                      const trainer = allTrainers.find(t => t.id === tid)
                      const name = trainer ? `${trainer.user?.first_name ?? ''} ${trainer.user?.last_name ?? ''}`.trim() : ''
                      openPtModal(tid, name)
                    }}
                    disabled={assignTrainerMutation.isPending || ptSaving}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="— Select a trainer —" />
                    </SelectTrigger>
                    <SelectContent>
                      {allTrainers.map(t => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.user?.first_name} {t.user?.last_name}
                          {t.specializations?.length ? ` · ${t.specializations[0]}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {assignTrainerMutation.isPending && (
                    <p className="text-xs text-muted-foreground">Saving…</p>
                  )}
                </div>

              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Body Composition & Targets ── */}
      {(user?.height_cm || user?.weight_kg || Object.keys(bodyComp).length > 0) && (
        <div className="space-y-5">

          {/* ── Row A: Fitness Score + Goals + Workout Split ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Fitness Score */}
            {fitnessScore && (
              <Card className="border-0 shadow-md overflow-hidden">
                <SectionHeader icon={<Star className="h-3.5 w-3.5 text-yellow-500" />} title="Fitness Score" />
                <CardContent className="p-5">
                  <div className="flex items-center gap-4 mb-4">
                    {/* Ring */}
                    <div className="relative h-20 w-20 shrink-0">
                      <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
                        <circle cx="40" cy="40" r="32" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                        <circle cx="40" cy="40" r="32" fill="none" stroke={fitnessScore.color} strokeWidth="8"
                          strokeDasharray={`${2 * Math.PI * 32}`}
                          strokeDashoffset={`${2 * Math.PI * 32 * (1 - fitnessScore.score / 100)}`}
                          strokeLinecap="round" />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <p className="text-xl font-black leading-none" style={{ color: fitnessScore.color }}>{fitnessScore.score}</p>
                        <p className="text-[9px] text-muted-foreground">/100</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-lg font-bold leading-tight" style={{ color: fitnessScore.color }}>{fitnessScore.grade}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Based on {fitnessScore.breakdown.length} metrics</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {fitnessScore.breakdown.map((b, i) => (
                      <div key={i}>
                        <div className="flex justify-between mb-0.5">
                          <p className="text-[10px] text-muted-foreground">{b.label}</p>
                          <p className="text-[10px] font-semibold text-gray-700">{b.pts}/{b.max}</p>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${(b.pts / b.max) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Goal Progress */}
            <Card className="border-0 shadow-md overflow-hidden">
              <SectionHeader
                icon={<Target className="h-3.5 w-3.5 text-blue-600" />}
                title="Goal Progress"
                badge={
                  <button onClick={() => setGoalsOpen(true)}
                    className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 transition-colors">
                    <Pencil className="h-2.5 w-2.5" /> Set Goals
                  </button>
                }
              />
              <CardContent className="p-5">
                {(goals.target_weight_kg != null || goals.target_body_fat_pct != null) ? (
                  <div className="space-y-4">
                    {goals.target_weight_kg != null && (
                      <div>
                        <div className="flex justify-between mb-1">
                          <p className="text-xs font-medium text-gray-700">Weight Goal</p>
                          {goalWeightPct != null
                            ? <p className="text-xs font-bold text-blue-600">{goalWeightPct}% there</p>
                            : <p className="text-xs text-muted-foreground">Add current weight to track</p>
                          }
                        </div>
                        {goalWeightPct != null && (
                          <div className="h-2.5 rounded-full bg-muted overflow-hidden mb-1">
                            <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${goalWeightPct}%` }} />
                          </div>
                        )}
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-[10px] text-muted-foreground">Target: <span className="font-semibold text-gray-700">{goals.target_weight_kg} kg</span></p>
                          {user?.weight_kg && (
                            <p className="text-[10px] text-muted-foreground">
                              Current: <span className="font-semibold text-gray-700">{user.weight_kg} kg</span>
                              {' · '}
                              <span className={user.weight_kg > goals.target_weight_kg ? 'text-orange-500 font-semibold' : 'text-emerald-600 font-semibold'}>
                                {user.weight_kg > goals.target_weight_kg
                                  ? `${(user.weight_kg - goals.target_weight_kg).toFixed(1)} kg to go`
                                  : 'Goal reached!'}
                              </span>
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    {goals.target_body_fat_pct != null && (
                      <div>
                        <div className="flex justify-between mb-1">
                          <p className="text-xs font-medium text-gray-700">Body Fat Goal</p>
                          {goalFatPct != null
                            ? <p className="text-xs font-bold text-orange-500">{goalFatPct}% there</p>
                            : <p className="text-xs text-muted-foreground">Add body fat % to track</p>
                          }
                        </div>
                        {goalFatPct != null && (
                          <div className="h-2.5 rounded-full bg-muted overflow-hidden mb-1">
                            <div className="h-full rounded-full bg-orange-400 transition-all" style={{ width: `${goalFatPct}%` }} />
                          </div>
                        )}
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-[10px] text-muted-foreground">Target: <span className="font-semibold text-gray-700">{goals.target_body_fat_pct}%</span></p>
                          {bodyComp.body_fat_pct != null && (
                            <p className="text-[10px] text-muted-foreground">
                              Current: <span className="font-semibold text-gray-700">{bodyComp.body_fat_pct}%</span>
                              {' · '}
                              <span className={bodyComp.body_fat_pct > goals.target_body_fat_pct ? 'text-orange-500 font-semibold' : 'text-emerald-600 font-semibold'}>
                                {bodyComp.body_fat_pct > goals.target_body_fat_pct
                                  ? `${(bodyComp.body_fat_pct - goals.target_body_fat_pct).toFixed(1)}% to go`
                                  : 'Goal reached!'}
                              </span>
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-4 text-center">
                    <Target className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground">No goals set yet</p>
                    <button onClick={() => setGoalsOpen(true)} className="text-xs text-blue-600 font-medium hover:underline">Set a goal →</button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Workout Split */}
            {workoutSplit && (
              <Card className="border-0 shadow-md overflow-hidden">
                <SectionHeader icon={<Dumbbell className="h-3.5 w-3.5 text-blue-600" />} title="Suggested Workout" />
                <CardContent className="p-5">
                  <div className="space-y-3">
                    <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2.5">
                      <p className="text-[10px] text-blue-400 uppercase tracking-wide font-semibold mb-0.5">Split</p>
                      <p className="text-sm font-bold text-blue-800">{workoutSplit.split}</p>
                    </div>
                    <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5">
                      <p className="text-[10px] text-emerald-500 uppercase tracking-wide font-semibold mb-0.5">Cardio</p>
                      <p className="text-sm font-bold text-emerald-800">{workoutSplit.cardio}</p>
                    </div>
                    <p className="text-xs text-muted-foreground leading-snug">{workoutSplit.reason}</p>
                    <div className="rounded-xl border border-border/50 overflow-hidden">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide px-3 pt-2.5 pb-1">Calorie Targets</p>
                      {calorieGoals && [
                        { label: 'Fat Loss',    kcal: calorieGoals.fatLoss,     color: '#f87171' },
                        { label: 'Maintenance', kcal: calorieGoals.maintenance, color: '#60a5fa' },
                        { label: 'Muscle Gain', kcal: calorieGoals.muscleGain,  color: '#34d399' },
                      ].map((row, i) => (
                        <div key={i} className={`flex items-center justify-between px-3 py-2 ${i < 2 ? 'border-b border-border/30' : ''}`}>
                          <p className="text-xs text-muted-foreground">{row.label}</p>
                          <p className="text-sm font-bold" style={{ color: row.color }}>{row.kcal.toLocaleString()} kcal</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── Row B: Body Composition Details ── */}
          <Card className="border-0 shadow-md overflow-hidden">
            <SectionHeader
              icon={<Activity className="h-3.5 w-3.5 text-blue-600" />}
              title="Body Composition & Targets"
              badge={
                <button onClick={() => setBcOpen(true)}
                  className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 transition-colors">
                  <Pencil className="h-2.5 w-2.5" /> Update
                </button>
              }
            />
            <CardContent className="p-5">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                {/* Column 1: Composition */}
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Composition</p>

                  {bodyComp.body_fat_pct != null ? (
                    <div className="rounded-xl border border-border/50 px-3 py-2.5">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Body Fat</p>
                      <p className="text-lg font-black leading-tight" style={{ color: bodyFatLabel(bodyComp.body_fat_pct, user?.gender).color }}>{bodyComp.body_fat_pct}%</p>
                      <p className="text-xs font-medium" style={{ color: bodyFatLabel(bodyComp.body_fat_pct, user?.gender).color }}>{bodyFatLabel(bodyComp.body_fat_pct, user?.gender).label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Ideal: {(user?.gender === 'M' || user?.gender === 'male') ? '14–17%' : '21–24%'}</p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border/50 px-3 py-2.5 flex items-center gap-2 cursor-pointer hover:bg-muted/30" onClick={() => setBcOpen(true)}>
                      <Activity className="h-3.5 w-3.5 text-muted-foreground/50" />
                      <p className="text-xs text-muted-foreground">Add body fat %</p>
                    </div>
                  )}

                  {(leanMass != null || fatMass != null) && (
                    <div className="grid grid-cols-2 gap-2">
                      {leanMass != null && (
                        <div className="rounded-xl border border-border/50 px-3 py-2.5">
                          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Lean Mass</p>
                          <p className="text-sm font-bold text-emerald-600">{leanMass} kg</p>
                        </div>
                      )}
                      {fatMass != null && (
                        <div className="rounded-xl border border-border/50 px-3 py-2.5">
                          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Fat Mass</p>
                          <p className="text-sm font-bold text-orange-500">{fatMass} kg</p>
                        </div>
                      )}
                    </div>
                  )}

                  {bodyComp.visceral_fat != null && (
                    <div className="rounded-xl border border-border/50 px-3 py-2.5">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Visceral Fat</p>
                      <p className="text-lg font-black leading-tight" style={{ color: visceralLabel(bodyComp.visceral_fat).color }}>{bodyComp.visceral_fat}</p>
                      <p className="text-xs font-medium" style={{ color: visceralLabel(bodyComp.visceral_fat).color }}>{visceralLabel(bodyComp.visceral_fat).label}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    {bodyComp.water_pct != null && (
                      <div className="rounded-xl border border-border/50 px-3 py-2.5">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">Hydration</p>
                        <p className="text-sm font-bold" style={{ color: waterLabel(bodyComp.water_pct, user?.gender).color }}>{bodyComp.water_pct}%</p>
                        <p className="text-[10px]" style={{ color: waterLabel(bodyComp.water_pct, user?.gender).color }}>{waterLabel(bodyComp.water_pct, user?.gender).label}</p>
                      </div>
                    )}
                    {bodyComp.skeletal_muscle_pct != null && (
                      <div className="rounded-xl border border-border/50 px-3 py-2.5">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">Skeletal Muscle</p>
                        <p className="text-sm font-bold text-blue-600">{bodyComp.skeletal_muscle_pct}%</p>
                      </div>
                    )}
                  </div>

                  {bodyComp.metabolic_age != null && (
                    <div className="rounded-xl border border-border/50 px-3 py-2.5">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Metabolic Age</p>
                      <p className="text-lg font-black text-blue-600 leading-tight">{bodyComp.metabolic_age} yrs</p>
                      {age != null && (
                        <p className="text-[10px] text-muted-foreground">
                          {bodyComp.metabolic_age < age ? `${age - bodyComp.metabolic_age} yrs younger than actual` :
                           bodyComp.metabolic_age > age ? `${bodyComp.metabolic_age - age} yrs older than actual` : 'Same as actual age'}
                        </p>
                      )}
                    </div>
                  )}

                  {idealWeightMin && idealWeightMax && (
                    <div className="rounded-xl border border-border/50 px-3 py-2.5">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Ideal Weight Range</p>
                      <p className="text-sm font-bold text-emerald-600">{idealWeightMin} – {idealWeightMax} kg</p>
                      {user?.height_cm && <p className="text-[10px] text-muted-foreground">for {user.height_cm} cm height (BMI 18.5–24.9)</p>}
                    </div>
                  )}
                </div>

                {/* Column 2: Nutrition Targets */}
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Nutrition Targets</p>

                  {activityCalories ? (
                    <div className="rounded-xl border border-border/50 overflow-hidden">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide px-3 pt-2.5 pb-1">Daily Calories (by activity)</p>
                      {[
                        { label: 'Sedentary',         kcal: activityCalories.sedentary, color: '#94a3b8' },
                        { label: 'Moderate Activity',  kcal: activityCalories.moderate,  color: '#60a5fa' },
                        { label: 'Active',            kcal: activityCalories.active,    color: '#34d399' },
                      ].map((row, i) => (
                        <div key={i} className={`flex items-center justify-between px-3 py-2 ${i < 2 ? 'border-b border-border/30' : ''}`}>
                          <p className="text-xs text-muted-foreground">{row.label}</p>
                          <p className="text-sm font-bold" style={{ color: row.color }}>{row.kcal.toLocaleString()} kcal</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border/50 px-3 py-4 text-center">
                      <p className="text-xs text-muted-foreground">Add height & weight to see calorie targets</p>
                    </div>
                  )}

                  {proteinMin && proteinMax && (
                    <div className="rounded-xl border border-border/50 px-3 py-2.5">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Daily Protein</p>
                      <p className="text-lg font-black text-orange-500 leading-tight">{proteinMin}–{proteinMax} g</p>
                      <p className="text-[10px] text-muted-foreground">1.6–2.0 g per kg body weight</p>
                    </div>
                  )}

                  {waterMin && waterMax && (
                    <div className="rounded-xl border border-border/50 px-3 py-2.5">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Water Intake</p>
                      <p className="text-lg font-black text-blue-500 leading-tight">{waterMin}–{waterMax} L</p>
                      <p className="text-[10px] text-muted-foreground">33–40 ml per kg body weight</p>
                    </div>
                  )}
                </div>

                {/* Column 3: Measurements & Ratios */}
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Measurements & Ratios</p>

                  {waistHtRatio != null && (
                    <div className="rounded-xl border border-border/50 px-3 py-2.5">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Waist-to-Height Ratio</p>
                      <p className="text-lg font-black leading-tight" style={{ color: waistHtLabel(Number(waistHtRatio)).color }}>{waistHtRatio}</p>
                      <p className="text-xs font-medium" style={{ color: waistHtLabel(Number(waistHtRatio)).color }}>{waistHtLabel(Number(waistHtRatio)).label}</p>
                      <p className="text-[10px] text-muted-foreground">Ideal: &lt;0.5</p>
                    </div>
                  )}

                  {[
                    { label: 'Waist',  value: bodyComp.waist_cm  },
                    { label: 'Chest',  value: bodyComp.chest_cm  },
                    { label: 'Arms',   value: bodyComp.arm_cm    },
                    { label: 'Thighs', value: bodyComp.thigh_cm  },
                    { label: 'Neck',   value: bodyComp.neck_cm   },
                  ].filter(r => r.value != null).length > 0 ? (
                    <div className="rounded-xl border border-border/50 overflow-hidden">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide px-3 pt-2.5 pb-1">Circumference</p>
                      {[
                        { label: 'Waist',  value: bodyComp.waist_cm  },
                        { label: 'Chest',  value: bodyComp.chest_cm  },
                        { label: 'Arms',   value: bodyComp.arm_cm    },
                        { label: 'Thighs', value: bodyComp.thigh_cm  },
                        { label: 'Neck',   value: bodyComp.neck_cm   },
                      ].filter(r => r.value != null).map((row, i, arr) => (
                        <div key={i} className={`flex items-center justify-between px-3 py-2 ${i < arr.length - 1 ? 'border-b border-border/30' : ''}`}>
                          <p className="text-xs text-muted-foreground">{row.label}</p>
                          <p className="text-sm font-bold text-gray-800">{row.value} cm</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border/50 px-3 py-4 text-center cursor-pointer hover:bg-muted/30" onClick={() => setBcOpen(true)}>
                      <p className="text-xs text-muted-foreground">No measurements yet</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">Click Update to add</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Row C: Progress Charts + Strength Progress ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Progress Charts */}
            <Card className="border-0 shadow-md overflow-hidden">
              <SectionHeader
                icon={<TrendingUp className="h-3.5 w-3.5 text-blue-600" />}
                title="Monthly Progress"
                badge={
                  <button onClick={() => setProgressOpen(true)}
                    className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 transition-colors">
                    <Pencil className="h-2.5 w-2.5" /> Log Entry
                  </button>
                }
              />
              <CardContent className="p-5">
                {progressLog.length >= 2 ? (
                  <div className="space-y-5">
                    {weightChartData.length >= 2 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-gray-700">Weight (kg)</p>
                          {weightChartData.length >= 2 && (
                            <span className={`flex items-center gap-1 text-[10px] font-bold ${
                              weightChartData[weightChartData.length-1].weight! < weightChartData[0].weight! ? 'text-emerald-600' : 'text-red-500'}`}>
                              {weightChartData[weightChartData.length-1].weight! < weightChartData[0].weight!
                                ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                              {Math.abs((weightChartData[weightChartData.length-1].weight ?? 0) - (weightChartData[0].weight ?? 0)).toFixed(1)} kg
                            </span>
                          )}
                        </div>
                        <ResponsiveContainer width="100%" height={80}>
                          <LineChart data={weightChartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                            <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                            <YAxis tick={{ fontSize: 9 }} domain={['auto', 'auto']} />
                            <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v: number) => [`${v} kg`, 'Weight']} />
                            {goals.target_weight_kg && <ReferenceLine y={goals.target_weight_kg} stroke="#34d399" strokeDasharray="3 3" />}
                            <Line type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    {fatChartData.length >= 2 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-gray-700">Body Fat (%)</p>
                          {fatChartData.length >= 2 && (
                            <span className={`flex items-center gap-1 text-[10px] font-bold ${
                              fatChartData[fatChartData.length-1].fat! < fatChartData[0].fat! ? 'text-emerald-600' : 'text-red-500'}`}>
                              {fatChartData[fatChartData.length-1].fat! < fatChartData[0].fat!
                                ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                              {Math.abs((fatChartData[fatChartData.length-1].fat ?? 0) - (fatChartData[0].fat ?? 0)).toFixed(1)}%
                            </span>
                          )}
                        </div>
                        <ResponsiveContainer width="100%" height={80}>
                          <LineChart data={fatChartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                            <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                            <YAxis tick={{ fontSize: 9 }} domain={['auto', 'auto']} />
                            <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v: number) => [`${v}%`, 'Body Fat']} />
                            {goals.target_body_fat_pct && <ReferenceLine y={goals.target_body_fat_pct} stroke="#34d399" strokeDasharray="3 3" />}
                            <Line type="monotone" dataKey="fat" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground text-center">{progressLog.length} entries logged · green dashed line = goal</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-6 text-center">
                    <BarChart2 className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground">Log 2+ entries to see progress graphs</p>
                    <button onClick={() => setProgressOpen(true)} className="text-xs text-blue-600 font-medium hover:underline">Log first entry →</button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Strength Progress */}
            <Card className="border-0 shadow-md overflow-hidden">
              <SectionHeader
                icon={<Zap className="h-3.5 w-3.5 text-yellow-500" />}
                title="Strength Progress"
                badge={
                  <button onClick={() => setStrengthOpen(true)}
                    className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 transition-colors">
                    <Pencil className="h-2.5 w-2.5" /> Update
                  </button>
                }
              />
              <CardContent className="p-5">
                {latestStrength ? (
                  <div className="space-y-2">
                    {[
                      { label: 'Bench Press', cur: latestStrength.bench_kg,    prev: firstStrength?.bench_kg    },
                      { label: 'Squat',       cur: latestStrength.squat_kg,    prev: firstStrength?.squat_kg    },
                      { label: 'Deadlift',    cur: latestStrength.deadlift_kg, prev: firstStrength?.deadlift_kg },
                      { label: 'Pull-up (load)', cur: latestStrength.pullup_kg, prev: firstStrength?.pullup_kg  },
                    ].filter(r => r.cur != null).map((row, i) => {
                      const diff = row.prev != null && row.cur != null ? row.cur - row.prev : null
                      return (
                        <div key={i} className="flex items-center justify-between rounded-xl border border-border/50 px-3 py-2.5">
                          <p className="text-xs text-muted-foreground">{row.label}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-gray-800">{row.cur} kg</p>
                            {diff != null && diff !== 0 && (
                              <span className={`flex items-center gap-0.5 text-[10px] font-bold ${diff > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {diff > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                {diff > 0 ? '+' : ''}{diff} kg
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    {strengthLog.length >= 2 && (
                      <p className="text-[10px] text-muted-foreground text-center pt-1">
                        Showing latest vs first entry · {strengthLog.length} sessions logged
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-6 text-center">
                    <Dumbbell className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground">No strength data logged yet</p>
                    <button onClick={() => setStrengthOpen(true)} className="text-xs text-blue-600 font-medium hover:underline">Log first session →</button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── Health Metrics: BMI + BMR ── */}
      {(bmi || bmr) && (
        <Card className="border-0 shadow-md overflow-hidden">
          <SectionHeader icon={<Activity className="h-3.5 w-3.5 text-blue-600" />} title="Health Metrics" />
          <CardContent className="p-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* ── BMI ── */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                  Body Mass Index (BMI)
                </p>
                {bmi ? (
                  <div className="rounded-xl border border-border/50 overflow-hidden">
                    {/* Value + badge */}
                    <div className="flex items-center justify-between px-5 py-4 bg-muted/20">
                      <div>
                        <p className="text-4xl font-extrabold tracking-tight" style={{ color: bmi.color }}>{bmi.value}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">kg / m²</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-sm font-bold px-3 py-1 rounded-full border ${bmi.textColor}`}
                          style={{ borderColor: bmi.color, background: bmi.color + '18' }}>
                          {bmi.label}
                        </span>
                        <p className="text-[11px] text-muted-foreground mt-1.5">
                          {bmi.label === 'Normal' ? 'Healthy range' :
                           bmi.label === 'Underweight' ? 'Below healthy range' :
                           bmi.label === 'Overweight' ? 'Above healthy range' : 'Well above healthy range'}
                        </p>
                      </div>
                    </div>

                    {/* Gauge */}
                    <div className="px-5 pt-4 pb-2">
                      <div className="relative h-4 rounded-full overflow-hidden flex">
                        {BMI_ZONES.map((z, i) => (
                          <div key={i} className={z.bg}
                            style={{ width: `${((Math.min(z.max, BMI_MAX) - z.min) / (BMI_MAX - BMI_MIN)) * 100}%` }} />
                        ))}
                        <div className="absolute top-0 h-full w-0.5 bg-white/70 -translate-x-1/2"
                          style={{ left: `${bmi.gaugePercent}%` }} />
                        <div className="absolute -top-0.5 h-5 w-1.5 rounded-full bg-gray-800 -translate-x-1/2 shadow-md"
                          style={{ left: `${bmi.gaugePercent}%` }} />
                      </div>
                      <div className="flex justify-between mt-1 text-[9px] font-semibold text-muted-foreground">
                        <span>{BMI_MIN}</span>
                        <span>18.5</span>
                        <span>25</span>
                        <span>30</span>
                        <span>{BMI_MAX}</span>
                      </div>
                      <div className="flex mt-1 text-[10px] font-medium">
                        {BMI_ZONES.map((z, i) => (
                          <div key={i} className={`${z.text} ${bmi.zoneIdx === i ? 'font-bold' : 'opacity-50'} text-center`}
                            style={{ width: `${((Math.min(z.max, BMI_MAX) - z.min) / (BMI_MAX - BMI_MIN)) * 100}%` }}>
                            {z.label}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Ideal weight */}
                    <div className="flex items-center justify-between px-5 py-3 border-t border-border/40 bg-emerald-50/60">
                      <div>
                        <p className="text-xs font-semibold text-emerald-700">Ideal weight range</p>
                        <p className="text-[10px] text-muted-foreground">for {user?.height_cm} cm height (BMI 18.5–24.9)</p>
                      </div>
                      <span className="text-sm font-bold text-emerald-700">{bmi.idealMin} – {bmi.idealMax} kg</span>
                    </div>

                    {/* Weight to lose/gain */}
                    {user?.weight_kg && (
                      <div className="px-5 py-3 border-t border-border/40 bg-muted/10">
                        {user.weight_kg > bmi.idealMax ? (
                          <p className="text-xs text-amber-600">
                            <span className="font-bold">{Math.round((user.weight_kg - bmi.idealMax) * 10) / 10} kg</span> above ideal range
                          </p>
                        ) : user.weight_kg < bmi.idealMin ? (
                          <p className="text-xs text-blue-600">
                            <span className="font-bold">{Math.round((bmi.idealMin - user.weight_kg) * 10) / 10} kg</span> below ideal range
                          </p>
                        ) : (
                          <p className="text-xs text-emerald-600 font-medium">Within ideal weight range</p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border/60 px-5 py-8 text-center">
                    <Activity className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Requires height &amp; weight</p>
                  </div>
                )}
              </div>

              {/* ── BMR ── */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                  Basal Metabolic Rate (BMR)
                </p>
                {bmr ? (
                  <div className="rounded-xl border border-border/50 overflow-hidden">
                    {/* Value */}
                    <div className="flex items-center justify-between px-5 py-4 bg-blue-50/60">
                      <div>
                        <p className="text-4xl font-extrabold tracking-tight text-blue-700">{bmr.toLocaleString()}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">kcal / day at rest</p>
                      </div>
                      <div className="text-right">
                        <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center ml-auto">
                          <HeartPulse className="h-5 w-5 text-blue-600" />
                        </div>
                        {!user?.gender && (
                          <p className="text-[10px] text-amber-500 mt-1">avg formula</p>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    <p className="px-5 py-2.5 text-[11px] text-muted-foreground bg-muted/20 border-b border-border/40">
                      Minimum calories your body burns daily at complete rest. Eat below this and your body starts breaking down muscle.
                    </p>

                    {/* TDEE rows */}
                    <div className="divide-y divide-border/30">
                      {TDEE_LEVELS.map(lvl => {
                        const tdee = Math.round(bmr * lvl.multiplier)
                        const isActive = memberActivityLevel === lvl.key
                        return (
                          <div key={lvl.key}
                            className={`flex items-center justify-between px-5 py-3 ${isActive ? 'bg-blue-50' : 'hover:bg-muted/20'}`}>
                            <div className="flex items-center gap-3">
                              <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${isActive ? 'bg-blue-500' : 'bg-border'}`} />
                              <div>
                                <p className={`text-xs font-semibold ${isActive ? 'text-blue-700' : 'text-foreground'}`}>
                                  {lvl.label}
                                  {isActive && (
                                    <span className="ml-1.5 text-[10px] font-normal bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">
                                      current
                                    </span>
                                  )}
                                </p>
                                <p className="text-[10px] text-muted-foreground">{lvl.sub} · ×{lvl.multiplier}</p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className={`text-sm font-bold ${isActive ? 'text-blue-700' : 'text-foreground'}`}>
                                {tdee.toLocaleString()}
                              </span>
                              <span className="text-[10px] text-muted-foreground ml-1">kcal</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between px-5 py-2.5 bg-muted/20 border-t border-border/40">
                      <p className="text-[10px] text-muted-foreground">Mifflin-St Jeor · TDEE = BMR × multiplier</p>
                      {!memberActivityLevel && (
                        <p className="text-[10px] text-amber-500">Set activity level in health profile</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border/60 px-5 py-8 text-center">
                    <HeartPulse className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Requires height, weight &amp; age</p>
                  </div>
                )}
              </div>

            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Classes Joined ── */}
      <Card className="border-0 shadow-md overflow-hidden">
        <SectionHeader icon={<Dumbbell className="h-3.5 w-3.5 text-blue-600" />} title="Classes Joined" />
        <CardContent className="p-0">
          {bookingsLoading ? (
            <div className="p-5 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : bookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <Dumbbell className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No classes booked yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-sidebar">
                  <tr>
                    <th className="text-left px-5 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Class</th>
                    <th className="text-left px-5 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Type</th>
                    <th className="text-left px-5 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Date &amp; Time</th>
                    <th className="text-left px-5 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Duration</th>
                    <th className="text-left px-5 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Trainer</th>
                    <th className="text-left px-5 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {bookings.map((b, idx) => {
                    const cls = b.class
                    const trainer = cls?.trainer?.user
                    return (
                      <tr key={b.id ?? idx} className="hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-3 font-medium text-foreground">{cls?.name ?? '—'}</td>
                        <td className="px-5 py-3">
                          {cls?.class_type ? (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${classTypeColor(cls.class_type)}`}>
                              {cls.class_type}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">
                          {cls?.start_time ? (
                            <div>
                              <p>{formatDate(cls.start_time)}</p>
                              <p className="text-[11px]">
                                {new Date(cls.start_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          ) : b.booked_at ? formatDate(b.booked_at) : '—'}
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">
                          {cls?.duration_mins ? `${cls.duration_mins} min` : '—'}
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">
                          {trainer ? `${trainer.first_name} ${trainer.last_name}` : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-5 py-3">
                          <span className="flex items-center gap-1.5 capitalize text-sm">
                            {bookingStatusIcon(b.status ?? '')}
                            {b.status?.replace(/_/g, ' ') ?? '—'}
                          </span>
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

      {/* ── Row 2: Subscription + Recent Payments ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Subscription */}
        <Card className="border-0 shadow-md overflow-hidden">
          <SectionHeader icon={<CreditCard className="h-3.5 w-3.5 text-blue-600" />} title="Current Subscription" />
          <CardContent className="p-5">
            {subsLoading ? (
              <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : !activeSub ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No subscription found.</p>
            ) : (
              <div className="space-y-2.5 text-sm">
                {[
                  { label: 'Plan',       value: (activeSub as { plan?: { name?: string } })?.plan?.name ?? 'N/A' },
                  { label: 'Status',     value: (activeSub as { status?: string })?.status ? <StatusBadge status={(activeSub as { status?: string }).status!} /> : '—' },
                  { label: 'Start Date', value: (activeSub as { start_date?: string })?.start_date ? formatDate((activeSub as { start_date?: string }).start_date!) : '—' },
                  { label: 'End Date',   value: (activeSub as { end_date?: string })?.end_date   ? formatDate((activeSub as { end_date?: string }).end_date!)   : '—' },
                  { label: 'Auto-Renew', value: (activeSub as { auto_renew?: boolean })?.auto_renew ? <span className="text-emerald-600 font-medium">Enabled</span> : <span className="text-gray-400">Disabled</span> },
                  ...((activeSub as { plan?: { price_amount?: number } })?.plan?.price_amount !== undefined
                    ? [{ label: 'Price', value: formatCurrency((activeSub as { plan: { price_amount: number } }).plan.price_amount) }]
                    : [])
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment History */}
        <Card className="border-0 shadow-md overflow-hidden">
          <SectionHeader
            icon={<CreditCard className="h-3.5 w-3.5 text-blue-600" />}
            title="Payment History"
            badge={
              <div className="flex items-center gap-2">
                {!paymentsLoading && payments.length > 0 && (
                  <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    {payments.length} {payments.length === 1 ? 'record' : 'records'}
                  </span>
                )}
                <Button size="sm" variant="outline"
                  className="h-6 text-[10px] px-2 py-0 border-blue-200 text-blue-700 hover:bg-blue-50"
                  onClick={() => { setRecPayAmount(''); setRecPayMethod('cash'); setRecPayRef(''); setRecPayNotes(''); setRecPayOpen(true) }}>
                  + Record Payment
                </Button>
              </div>
            }
          />
          <CardContent className="p-0">
            {paymentsLoading ? (
              <div className="p-5 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : paymentsError ? (
              <p className="text-sm text-destructive py-8 text-center">Failed to load payment history.</p>
            ) : payments.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10">
                <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-slate-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">No payments recorded yet</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Use "Record Payment" to add the first entry</p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {payments.map((p, idx) => {
                  const isRefunded = p.status === 'refunded'
                  const isFailed   = p.status === 'failed'
                  const isPending  = p.status === 'pending'
                  const isPtPayment = p.notes?.startsWith('PT Plan')
                  return (
                    <div key={p.id ?? idx} className={`flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors ${isPtPayment ? 'bg-blue-50/40' : ''}`}>
                      <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                        isPtPayment ? 'bg-blue-100' :
                        isRefunded  ? 'bg-amber-100'  :
                        isFailed    ? 'bg-red-100'    :
                        isPending   ? 'bg-slate-100'  : 'bg-emerald-100'
                      }`}>
                        <IndianRupee className={`h-4 w-4 ${
                          isPtPayment ? 'text-blue-600' :
                          isRefunded  ? 'text-amber-600'  :
                          isFailed    ? 'text-red-500'    :
                          isPending   ? 'text-slate-400'  : 'text-emerald-600'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-foreground">
                            ₹{p.amount?.toLocaleString('en-IN') ?? '—'}
                          </p>
                          {isPtPayment && (
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-100 border border-blue-200 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                              <UserCheck className="h-2.5 w-2.5" /> PT Fee
                            </span>
                          )}
                          {isRefunded && p.refund_amount != null && (
                            <span className="text-[10px] text-amber-600 font-medium bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                              Refunded ₹{p.refund_amount.toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {isPtPayment ? (
                            <span className="text-[11px] text-blue-500 font-medium">{p.notes}</span>
                          ) : (
                            <>
                              {p.subscription?.plan?.name && (
                                <span className="text-[11px] text-muted-foreground font-medium truncate">
                                  {p.subscription.plan.name}
                                </span>
                              )}
                            </>
                          )}
                          {p.payment_method && (
                            <span className="text-[11px] text-muted-foreground capitalize flex items-center gap-1">
                              {(isPtPayment || p.subscription?.plan?.name) && <span className="text-border">·</span>}
                              {p.payment_method.replace(/_/g, ' ')}
                            </span>
                          )}
                          {(p.transaction_id || p.reference_number) && (
                            <span className="text-[11px] font-mono text-muted-foreground/70 flex items-center gap-1">
                              <span className="text-border">·</span>
                              {p.transaction_id ?? p.reference_number}
                            </span>
                          )}
                        </div>
                        {!isPtPayment && p.notes && (
                          <p className="text-[11px] text-muted-foreground/70 mt-0.5 italic truncate">{p.notes}</p>
                        )}
                        {isRefunded && p.refund_reason && (
                          <p className="text-[11px] text-amber-600/80 mt-0.5 italic">Reason: {p.refund_reason}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0 space-y-1">
                        {p.status && <StatusBadge status={p.status} />}
                        <p className="text-[11px] text-muted-foreground">
                          {p.paid_at ? formatDate(p.paid_at) : p.created_at ? formatDate(p.created_at) : '—'}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Record Payment modal */}
        <Dialog open={recPayOpen} onOpenChange={setRecPayOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
              <DialogDescription>Add a payment entry for {m?.user?.first_name} {m?.user?.last_name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Amount (₹) <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">₹</span>
                  <Input type="number" min="1" placeholder="0"
                    value={recPayAmount} onChange={e => setRecPayAmount(e.target.value)}
                    className="pl-7" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Payment Method <span className="text-destructive">*</span></Label>
                <select
                  value={recPayMethod} onChange={e => setRecPayMethod(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring capitalize">
                  {['cash','upi','card','bank_transfer','razorpay','other'].map(m => (
                    <option key={m} value={m}>{m.replace(/_/g,' ')}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Transaction / Reference ID</Label>
                <Input placeholder="Optional" value={recPayRef} onChange={e => setRecPayRef(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Notes</Label>
                <Input placeholder="Optional" value={recPayNotes} onChange={e => setRecPayNotes(e.target.value)} />
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setRecPayOpen(false)}>Cancel</Button>
                <Button className="flex-1"
                  disabled={!recPayAmount || recPaySaving}
                  onClick={async () => {
                    const amount = Number(recPayAmount)
                    if (!amount || amount <= 0) return
                    setRecPaySaving(true)
                    try {
                      await paymentsApi.record({
                        member_id: memberId,
                        amount,
                        payment_method: recPayMethod,
                        ...(activeSub?.id ? { subscription_id: activeSub.id } : {}),
                        ...(recPayRef   ? { transaction_id: recPayRef }    : {}),
                        ...(recPayNotes ? { notes: recPayNotes }           : {}),
                        status: 'completed',
                      })
                      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.memberPayments(memberId) })
                      setRecPayOpen(false)
                      toast.success(`₹${amount.toLocaleString('en-IN')} recorded`)
                    } catch {
                      toast.error('Failed to record payment')
                    } finally {
                      setRecPaySaving(false)
                    }
                  }}>
                  {recPaySaving ? 'Saving…' : 'Save Payment'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Photo Lightbox ── */}
        <Dialog open={photoViewOpen} onOpenChange={setPhotoViewOpen}>
          <DialogContent className="max-w-sm p-0 overflow-hidden rounded-2xl">
            {photoUrl ? (
              <div className="relative">
                <img
                  src={photoUrl}
                  alt={`${m?.user?.first_name} ${m?.user?.last_name}`}
                  className="w-full aspect-square object-cover"
                />
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-4 flex items-end justify-between">
                  <div>
                    <p className="text-white font-semibold text-sm leading-tight">{m?.user?.first_name} {m?.user?.last_name}</p>
                    {m?.member_code && <p className="text-white/70 text-xs font-mono">{m.member_code}</p>}
                  </div>
                  <Button
                    size="sm"
                    className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm"
                    onClick={() => { setPhotoViewOpen(false); setCamOpen(true) }}
                  >
                    <Camera className="h-3.5 w-3.5 mr-1.5" /> Retake
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 px-6 py-10">
                <AvatarWithFallback
                  firstName={m?.user?.first_name}
                  lastName={m?.user?.last_name}
                  className="h-24 w-24 text-2xl"
                />
                <div className="text-center">
                  <p className="font-semibold text-sm">{m?.user?.first_name} {m?.user?.last_name}</p>
                  {m?.member_code && <p className="text-xs text-muted-foreground font-mono">{m.member_code}</p>}
                  <p className="text-xs text-muted-foreground mt-2">No photo captured yet</p>
                </div>
                <Button
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => { setPhotoViewOpen(false); setCamOpen(true) }}
                >
                  <Camera className="h-4 w-4 mr-2" /> Take Photo
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ── Webcam Photo Modal ── */}
        <Dialog open={camOpen} onOpenChange={open => { if (!open) { stopCamera(); setCamOpen(false) } }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Camera className="h-4 w-4" /> Capture Member Photo
              </DialogTitle>
              <DialogDescription>
                Position the member's face in the frame, then click Capture.
              </DialogDescription>
            </DialogHeader>

            <canvas ref={canvasRef} className="hidden" />

            {camError ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <AlertCircle className="h-8 w-8 text-destructive" />
                <p className="text-sm text-destructive">{camError}</p>
                <Button variant="outline" size="sm" onClick={startCamera}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Retry
                </Button>
              </div>
            ) : camCapture ? (
              /* Preview */
              <div className="space-y-4">
                <div className="relative rounded-xl overflow-hidden aspect-square bg-black">
                  <img src={camCapture} alt="Captured" className="w-full h-full object-cover" />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => { setCamCapture(null); startCamera() }}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Retake
                  </Button>
                  <Button className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={camSaving} onClick={savePhoto}>
                    {camSaving ? 'Saving…' : 'Save Photo'}
                  </Button>
                </div>
              </div>
            ) : (
              /* Live viewfinder */
              <div className="space-y-4">
                <div className="relative rounded-xl overflow-hidden aspect-square bg-black">
                  {!camStream && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-6 w-6 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    </div>
                  )}
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ transform: camMirrored ? 'scaleX(-1)' : 'none' }}
                  />
                  {/* Face guide overlay */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="h-48 w-48 rounded-full border-2 border-white/40 border-dashed" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => setCamMirrored(v => !v)} title="Flip">
                    <FlipHorizontal className="h-4 w-4" />
                  </Button>
                  <Button className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={!camStream} onClick={capturePhoto}>
                    <Camera className="h-4 w-4 mr-1.5" /> Capture
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Goals Modal ── */}
      <Dialog open={goalsOpen} onOpenChange={setGoalsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Set Goals</DialogTitle>
            <DialogDescription>Set targets to track progress over time</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Target Weight (kg)</Label>
              <Input type="number" min="30" max="200" step="0.1" placeholder="e.g. 70" value={goalTargetWeight} onChange={e => setGoalTargetWeight(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Target Body Fat %</Label>
              <Input type="number" min="5" max="50" step="0.1" placeholder="e.g. 15" value={goalTargetFat} onChange={e => setGoalTargetFat(e.target.value)} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setGoalsOpen(false)}>Cancel</Button>
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={goalsSaving}
                onClick={async () => {
                  setGoalsSaving(true)
                  const toNum = (s: string) => s !== '' ? Number(s) : undefined
                  try {
                    await membersApi.update(memberId, {
                      health_declaration: {
                        ...healthDecl,
                        goals: {
                          ...(goals as object),
                          ...(toNum(goalTargetWeight) != null ? { target_weight_kg:      toNum(goalTargetWeight) } : {}),
                          ...(toNum(goalTargetFat)    != null ? { target_body_fat_pct:   toNum(goalTargetFat)    } : {}),
                        },
                      },
                    })
                    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.member(memberId) })
                    toast.success('Goals saved')
                    setGoalsOpen(false)
                  } catch { toast.error('Failed to save') }
                  finally { setGoalsSaving(false) }
                }}>
                {goalsSaving ? 'Saving…' : 'Save Goals'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Progress Log Modal ── */}
      <Dialog open={progressOpen} onOpenChange={setProgressOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Log Progress Entry</DialogTitle>
            <DialogDescription>Record today's measurements to track trends</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Weight (kg)</Label>
              <Input type="number" min="30" max="200" step="0.1" placeholder={user?.weight_kg ? String(user.weight_kg) : 'e.g. 75'} value={progressWeight} onChange={e => setProgressWeight(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Body Fat %</Label>
              <Input type="number" min="1" max="60" step="0.1" placeholder={bodyComp.body_fat_pct ? String(bodyComp.body_fat_pct) : 'e.g. 22'} value={progressFat} onChange={e => setProgressFat(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Notes (optional)</Label>
              <Input placeholder="e.g. After 4-week cut" value={progressNotes} onChange={e => setProgressNotes(e.target.value)} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setProgressOpen(false)}>Cancel</Button>
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={progressSaving || (!progressWeight && !progressFat)}
                onClick={async () => {
                  setProgressSaving(true)
                  const toNum = (s: string) => s !== '' ? Number(s) : undefined
                  const entry: Record<string, unknown> = { date: new Date().toISOString().slice(0,10) }
                  if (toNum(progressWeight) != null) entry.weight_kg     = toNum(progressWeight)
                  if (toNum(progressFat)    != null) entry.body_fat_pct  = toNum(progressFat)
                  if (progressNotes)                 entry.notes         = progressNotes
                  try {
                    await membersApi.update(memberId, {
                      health_declaration: {
                        ...healthDecl,
                        progress_log: [...progressLog, entry],
                      },
                    })
                    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.member(memberId) })
                    toast.success('Progress logged')
                    setProgressOpen(false)
                    setProgressWeight(''); setProgressFat(''); setProgressNotes('')
                  } catch { toast.error('Failed to save') }
                  finally { setProgressSaving(false) }
                }}>
                {progressSaving ? 'Saving…' : 'Save Entry'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Strength Log Modal ── */}
      <Dialog open={strengthOpen} onOpenChange={setStrengthOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Log Strength Entry</DialogTitle>
            <DialogDescription>Enter best lifts (1RM or working weight in kg)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Bench Press (kg)', val: strengthBench,    set: setStrengthBench    },
                { label: 'Squat (kg)',        val: strengthSquat,    set: setStrengthSquat    },
                { label: 'Deadlift (kg)',     val: strengthDeadlift, set: setStrengthDeadlift },
                { label: 'Pull-up load (kg)', val: strengthPullup,   set: setStrengthPullup   },
              ].map(({ label, val, set }) => (
                <div key={label} className="space-y-1.5">
                  <Label className="text-xs font-medium">{label}</Label>
                  <Input type="number" min="0" max="500" placeholder="kg" value={val} onChange={e => set(e.target.value)} />
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setStrengthOpen(false)}>Cancel</Button>
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={strengthSaving}
                onClick={async () => {
                  setStrengthSaving(true)
                  const toNum = (s: string) => s !== '' ? Number(s) : undefined
                  const entry: Record<string, unknown> = { date: new Date().toISOString().slice(0,10) }
                  if (toNum(strengthBench)    != null) entry.bench_kg    = toNum(strengthBench)
                  if (toNum(strengthSquat)    != null) entry.squat_kg    = toNum(strengthSquat)
                  if (toNum(strengthDeadlift) != null) entry.deadlift_kg = toNum(strengthDeadlift)
                  if (toNum(strengthPullup)   != null) entry.pullup_kg   = toNum(strengthPullup)
                  try {
                    await membersApi.update(memberId, {
                      health_declaration: {
                        ...healthDecl,
                        strength_log: [...strengthLog, entry],
                      },
                    })
                    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.member(memberId) })
                    toast.success('Strength logged')
                    setStrengthOpen(false)
                    setStrengthBench(''); setStrengthSquat(''); setStrengthDeadlift(''); setStrengthPullup('')
                  } catch { toast.error('Failed to save') }
                  finally { setStrengthSaving(false) }
                }}>
                {strengthSaving ? 'Saving…' : 'Log Session'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Body Composition Modal ── */}
      <Dialog open={bcOpen} onOpenChange={setBcOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Update Body Composition</DialogTitle>
            <DialogDescription>Enter values from a smart scale or fitness assessment</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Body Fat %</Label>
                <Input type="number" min="1" max="60" step="0.1" placeholder="e.g. 22" value={bcFat} onChange={e => setBcFat(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Visceral Fat (1–30)</Label>
                <Input type="number" min="1" max="30" placeholder="e.g. 8" value={bcVisceral} onChange={e => setBcVisceral(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Water %</Label>
                <Input type="number" min="1" max="80" step="0.1" placeholder="e.g. 58" value={bcWater} onChange={e => setBcWater(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Skeletal Muscle %</Label>
                <Input type="number" min="1" max="70" step="0.1" placeholder="e.g. 44" value={bcSkeletal} onChange={e => setBcSkeletal(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Metabolic Age (yrs)</Label>
                <Input type="number" min="10" max="100" placeholder="e.g. 29" value={bcMetabolicAge} onChange={e => setBcMetabolicAge(e.target.value)} />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Circumference Measurements (cm)</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Waist', val: bcWaist, set: setBcWaist },
                  { label: 'Chest', val: bcChest, set: setBcChest },
                  { label: 'Arms',  val: bcArm,   set: setBcArm   },
                  { label: 'Thighs',val: bcThigh, set: setBcThigh },
                  { label: 'Neck',  val: bcNeck,  set: setBcNeck  },
                ].map(({ label, val, set }) => (
                  <div key={label} className="space-y-1.5">
                    <Label className="text-xs font-medium">{label} (cm)</Label>
                    <Input type="number" min="1" max="200" placeholder="cm" value={val} onChange={e => set(e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setBcOpen(false)}>Cancel</Button>
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={bcSaving}
                onClick={async () => {
                  setBcSaving(true)
                  const toNum = (s: string) => s !== '' ? Number(s) : undefined
                  try {
                    await membersApi.update(memberId, {
                      health_declaration: {
                        ...healthDecl,
                        body_composition: {
                          ...(bodyComp as object),
                          ...(toNum(bcFat)          != null ? { body_fat_pct:         toNum(bcFat)          } : {}),
                          ...(toNum(bcVisceral)     != null ? { visceral_fat:         toNum(bcVisceral)     } : {}),
                          ...(toNum(bcWater)        != null ? { water_pct:            toNum(bcWater)        } : {}),
                          ...(toNum(bcSkeletal)     != null ? { skeletal_muscle_pct:  toNum(bcSkeletal)     } : {}),
                          ...(toNum(bcMetabolicAge) != null ? { metabolic_age:        toNum(bcMetabolicAge) } : {}),
                          ...(toNum(bcWaist)        != null ? { waist_cm:             toNum(bcWaist)        } : {}),
                          ...(toNum(bcChest)        != null ? { chest_cm:             toNum(bcChest)        } : {}),
                          ...(toNum(bcArm)          != null ? { arm_cm:               toNum(bcArm)          } : {}),
                          ...(toNum(bcThigh)        != null ? { thigh_cm:             toNum(bcThigh)        } : {}),
                          ...(toNum(bcNeck)         != null ? { neck_cm:              toNum(bcNeck)         } : {}),
                        },
                      },
                    })
                    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.member(memberId) })
                    toast.success('Body composition updated')
                    setBcOpen(false)
                  } catch {
                    toast.error('Failed to save')
                  } finally {
                    setBcSaving(false)
                  }
                }}
              >
                {bcSaving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit drawer ── */}
      <FormDrawer
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Member"
        description={`Editing ${m?.user?.first_name ?? ''} ${m?.user?.last_name ?? ''}`}
        wide
      >
        <form onSubmit={handleSubmit(d => editMutation.mutate(d))} className="space-y-5">

          <div className="grid grid-cols-2 gap-3">
            <SectionTitle label="Account" />
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Member Code</Label>
              <Input value={m?.member_code ?? ''} readOnly className="bg-muted/40 text-muted-foreground cursor-default" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Email</Label>
              <Input value={u?.email ?? ''} readOnly className="bg-muted/40 text-muted-foreground cursor-default" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SectionTitle label="Personal Information" />
            <div className="space-y-1">
              <Label>First Name <span className="text-destructive">*</span></Label>
              <Input {...register('first_name')} />
              {errors.first_name && <p className="text-xs text-destructive">{errors.first_name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Last Name <span className="text-destructive">*</span></Label>
              <Input {...register('last_name')} />
              {errors.last_name && <p className="text-xs text-destructive">{errors.last_name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Phone <span className="text-destructive">*</span></Label>
              <div className="flex items-stretch h-10 rounded-md border border-input overflow-hidden focus-within:ring-2 focus-within:ring-ring">
                <span className="flex items-center px-2.5 text-xs font-medium bg-muted text-muted-foreground border-r border-input shrink-0">+91</span>
                <Input {...register('phone')} placeholder="+91 98765 43210"
                  className="h-full border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0" />
              </div>
              {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Date of Birth</Label>
              <Input type="date" {...register('date_of_birth')} />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Gender</Label>
              <Select
                value={watch('gender') ?? ''}
                onValueChange={v => setValue('gender', v as 'male' | 'female' | 'other')}
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SectionTitle label="Body Stats" />
            <div className="space-y-1">
              <Label>Height (cm)</Label>
              <Input type="number" placeholder="e.g. 170" {...register('height_cm')} />
            </div>
            <div className="space-y-1">
              <Label>Weight (kg)</Label>
              <Input type="number" step="0.1" placeholder="e.g. 68.5" {...register('weight_kg')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SectionTitle label="Emergency Contact" />
            <div className="space-y-1 col-span-2">
              <Label>Contact Name</Label>
              <Input placeholder="Full name" {...register('emergency_contact_name')} />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <div className="flex items-stretch h-10 rounded-md border border-input overflow-hidden focus-within:ring-2 focus-within:ring-ring">
                <span className="flex items-center px-2.5 text-xs font-medium bg-muted text-muted-foreground border-r border-input shrink-0">+91</span>
                <Input placeholder="+91 98765 43210" {...register('emergency_contact_phone')}
                  className="h-full border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Relationship</Label>
              <Select value={watch('emergency_contact_relationship') ?? ''} onValueChange={v => setValue('emergency_contact_relationship', v)}>
                <option value="">Select…</option>
                {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <SectionTitle label="Subscription Plan" />
            {allPlans.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active plans found.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEditPlanId(null)}
                  className={`text-left rounded-lg border-2 p-3 transition-all text-sm ${editPlanId === null ? 'border-sky-500 bg-sky-50' : 'border-border hover:border-sky-200 bg-white'}`}
                >
                  <p className="font-semibold text-muted-foreground">No Plan</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Remove subscription</p>
                </button>
                {allPlans.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setEditPlanId(p.id)}
                    className={`text-left rounded-lg border-2 p-3 transition-all text-sm ${editPlanId === p.id ? 'border-sky-500 bg-sky-50' : 'border-border hover:border-sky-200 bg-white'}`}
                  >
                    <p className="font-semibold truncate">{p.name}</p>
                    <p className="text-xs font-bold text-sky-700 mt-0.5">{formatCurrency(p.price_amount)}</p>
                    <p className="text-xs text-muted-foreground">Every {p.billing_period_days} days</p>
                  </button>
                ))}
              </div>
            )}
            {activeSub?.plan_id && editPlanId !== activeSub.plan_id && editPlanId !== null && (
              <p className="text-xs text-amber-600 font-medium">
                Plan will be upgraded from {activeSub.plan?.name ?? 'current plan'} to {allPlans.find(p => p.id === editPlanId)?.name}
              </p>
            )}
            {!activeSub && editPlanId !== null && (
              <p className="text-xs text-sky-600 font-medium">
                A new subscription will be created with {allPlans.find(p => p.id === editPlanId)?.name}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SectionTitle label="Notes" />
            <div className="space-y-1 col-span-2">
              <Label>Member Notes</Label>
              <Textarea rows={3} placeholder="Any notes..." {...register('member_notes')} />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={editMutation.isPending}>
            {editMutation.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </form>
      </FormDrawer>

      {/* ── PT Setup Modal ── */}
      <Dialog open={ptSetupOpen} onOpenChange={open => { if (!open && !ptSaving) setPtSetupOpen(false) }}>
        <DialogContent className="max-w-[480px] p-0 overflow-hidden gap-0">

          {/* Header */}
          <div className="px-7 pt-6 pb-5"
            style={{ background: 'linear-gradient(to right, #eff6ff 0%, #eef2ff 100%)', borderBottom: '1px solid #dbeafe' }}>
            <div className="flex items-start gap-4">
              <div className="h-11 w-11 rounded-2xl bg-white border border-blue-200 shadow-sm flex items-center justify-center shrink-0">
                <UserCheck className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-gray-900 leading-snug">
                  Personal Training Plan
                </DialogTitle>
                <DialogDescription className="text-sm text-slate-500 mt-0.5 leading-relaxed">
                  {ptTrainerName
                    ? <><span className="font-semibold text-slate-700">{ptTrainerName}</span> will be assigned once the plan is saved.</>
                    : 'Trainer is assigned only after the plan is confirmed.'}
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-7 py-6 space-y-7 max-h-[62vh] overflow-y-auto">

            {/* Sessions per month */}
            <div className="space-y-3">
              <div>
                <p className="text-sm font-bold text-slate-800">Sessions per Month</p>
                <p className="text-xs text-slate-400 mt-0.5">How many PT sessions each month?</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {['4', '8', '12', '16', '20'].map(n => (
                  <button key={n} type="button" onClick={() => setPtSessions(n)}
                    className="w-12 h-10 rounded-xl border-2 text-sm font-bold transition-all"
                    style={ptSessions === n
                      ? { background: 'linear-gradient(135deg,#042B59,#027DFD)', color: 'white', borderColor: 'transparent', boxShadow: '0 2px 8px rgba(2,125,253,0.35)' }
                      : { background: '#f8fafc', color: '#475569', borderColor: '#e2e8f0' }}>
                    {n}
                  </button>
                ))}
                <div className="relative">
                  <Input type="number" min="1" placeholder="Other"
                    value={!['4','8','12','16','20'].includes(ptSessions) ? ptSessions : ''}
                    onChange={e => setPtSessions(e.target.value)}
                    className="w-20 h-10 text-sm text-center font-semibold border-2 border-dashed" />
                </div>
              </div>
            </div>

            {/* Fee */}
            <div className="space-y-3">
              <div>
                <p className="text-sm font-bold text-slate-800">Fee</p>
                <p className="text-xs text-slate-400 mt-0.5">Choose how the fee is charged</p>
              </div>
              {/* Fee type toggle */}
              <div className="flex rounded-xl border-2 border-slate-200 overflow-hidden bg-slate-50 p-1 gap-1">
                {(['per_session', 'per_month'] as const).map(type => (
                  <button key={type} type="button" onClick={() => setPtFeeType(type)}
                    className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
                    style={ptFeeType === type
                      ? { background: 'linear-gradient(135deg,#042B59,#027DFD)', color: 'white', boxShadow: '0 2px 8px rgba(2,125,253,0.3)' }
                      : { color: '#64748b' }}>
                    {type === 'per_session' ? 'Per Session' : 'Per Month'}
                  </button>
                ))}
              </div>
              {/* Amount */}
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-slate-400 pointer-events-none">
                  <IndianRupee className="h-4 w-4" />
                </div>
                <Input type="number" min="0" step="50"
                  placeholder={ptFeeType === 'per_session' ? '500' : '3000'}
                  value={ptFee} onChange={e => setPtFee(e.target.value)}
                  className="pl-9 h-11 text-base font-semibold" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
                  {ptFeeType === 'per_session' ? '/ session' : '/ month'}
                </span>
              </div>
            </div>

            {/* Period */}
            <div className="space-y-3">
              <div>
                <p className="text-sm font-bold text-slate-800">Duration</p>
                <p className="text-xs text-slate-400 mt-0.5">How long is this PT arrangement?</p>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[['1','1 Month'],['3','3 Months'],['6','6 Months'],['12','1 Year']].map(([v, label]) => (
                  <button key={v} type="button" onClick={() => setPtPeriodMonths(v)}
                    className="py-2.5 rounded-xl border-2 text-xs font-bold transition-all leading-tight"
                    style={ptPeriodMonths === v
                      ? { background: 'linear-gradient(135deg,#042B59,#027DFD)', color: 'white', borderColor: 'transparent', boxShadow: '0 2px 8px rgba(2,125,253,0.35)' }
                      : { background: '#f8fafc', color: '#475569', borderColor: '#e2e8f0' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Total summary — shown when fee + period are set */}
            {ptFee && (
              <div className="rounded-2xl overflow-hidden border border-blue-100"
                style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #eef2ff 100%)' }}>
                <div className="px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide">Total Payable</p>
                    <p className="text-2xl font-extrabold text-blue-800 mt-0.5">
                      ₹{(ptFeeType === 'per_session'
                        ? Number(ptSessions || 0) * Number(ptFee) * Number(ptPeriodMonths)
                        : Number(ptFee) * Number(ptPeriodMonths)
                      ).toLocaleString('en-IN')}
                    </p>
                    <p className="text-xs text-blue-400 mt-0.5">
                      for {ptPeriodMonths} month{Number(ptPeriodMonths) > 1 ? 's' : ''}
                      {ptFeeType === 'per_session' && ptSessions ? ` · ${Number(ptSessions) * Number(ptPeriodMonths)} sessions` : ''}
                    </p>
                  </div>
                  <div className="text-right text-xs text-blue-500 space-y-1">
                    <p>₹{Number(ptFee).toLocaleString('en-IN')} {ptFeeType === 'per_session' ? '/ session' : '/ month'}</p>
                    {ptSessions && <p>{ptSessions} sessions / month</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Start date */}
            <div className="space-y-3">
              <div>
                <p className="text-sm font-bold text-slate-800">Start Date</p>
                <p className="text-xs text-slate-400 mt-0.5">When does training begin?</p>
              </div>
              <Input type="date" value={ptStartDate} onChange={e => setPtStartDate(e.target.value)} className="h-10" />
            </div>

            {/* Notes */}
            <div className="space-y-3">
              <div>
                <p className="text-sm font-bold text-slate-800">Notes <span className="text-slate-400 font-normal">(optional)</span></p>
                <p className="text-xs text-slate-400 mt-0.5">Goals, focus areas, special instructions</p>
              </div>
              <textarea value={ptNotes} onChange={e => setPtNotes(e.target.value)} rows={2}
                placeholder="e.g. Weight loss focus, avoid high-impact on left knee…"
                className="w-full rounded-xl border-2 border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
            </div>
          </div>

          {/* Footer */}
          <div className="px-7 py-4 border-t border-slate-100 bg-slate-50/80 flex gap-3">
            <Button variant="outline" className="flex-1 h-10" disabled={ptSaving}
              onClick={() => setPtSetupOpen(false)}>
              Cancel
            </Button>
            <Button className="flex-1 h-10 font-semibold" disabled={ptSaving || !ptFee || !ptSessions}
              style={(!ptSaving && ptFee && ptSessions) ? { background: 'linear-gradient(135deg,#042B59,#027DFD)' } : {}}
              onClick={async () => {
                setPtSaving(true)
                try {
                  const totalFee = ptFeeType === 'per_session'
                    ? Number(ptSessions) * Number(ptFee) * Number(ptPeriodMonths)
                    : Number(ptFee) * Number(ptPeriodMonths)
                  const existing = (m?.health_declaration ?? {}) as Record<string, unknown>
                  const isEdit = pendingTrainerId === null
                  if (!isEdit) {
                    // Sequential — update runs after assign so db.Save() doesn't race-overwrite assigned_trainer_id
                    await membersApi.assignTrainer(memberId, pendingTrainerId, ptTrainerName)
                  }
                  await membersApi.update(memberId, {
                    health_declaration: {
                      ...existing,
                      pt_contract: {
                        ...(isEdit ? (existing.pt_contract as object ?? {}) : {}),
                        trainer_name:       ptTrainerName || (ptContract?.trainer_name ?? ''),
                        sessions_per_month: Number(ptSessions),
                        fee_type:           ptFeeType,
                        fee:                Number(ptFee),
                        total_fee:          totalFee,
                        period_months:      Number(ptPeriodMonths),
                        start_date:         ptStartDate,
                        notes:              ptNotes || undefined,
                        ...(isEdit ? {} : { created_at: new Date().toISOString() }),
                      },
                    },
                  })
                  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.member(memberId) })
                  toast.success(isEdit ? 'PT plan updated' : `${ptTrainerName} assigned with PT plan`)
                  setPtSetupOpen(false)
                } catch {
                  toast.error('Failed to save PT plan')
                } finally {
                  setPtSaving(false)
                }
              }}>
              {ptSaving
                ? <><span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin mr-2" />Saving…</>
                : pendingTrainerId === null ? 'Save Changes' : 'Assign & Save Plan'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* PT Payment modal */}
      {ptContract && (() => {
        const paid    = (ptContract.paid_amount ?? 0)
        const total   = ptContract.total_fee ?? 0
        const balance = Math.max(0, total - paid)
        return (
          <Dialog open={ptPayOpen} onOpenChange={open => { if (!ptPaymentSaving) setPtPayOpen(open) }}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Record PT Payment</DialogTitle>
                <DialogDescription>
                  {ptContract.trainer_name ? `${ptContract.trainer_name} · ` : ''}
                  Balance ₹{balance.toLocaleString('en-IN')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-1">
                {/* Amount */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Amount (₹) <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">₹</span>
                    <Input
                      type="number" min="1" max={balance}
                      placeholder={`Max ₹${balance.toLocaleString('en-IN')}`}
                      value={ptPaymentInput}
                      onChange={e => setPtPaymentInput(e.target.value)}
                      className="pl-7"
                      autoFocus />
                  </div>
                </div>

                {/* Payment method */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Payment Mode <span className="text-destructive">*</span></Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'cash',         label: 'Cash' },
                      { value: 'upi',          label: 'UPI' },
                      { value: 'card',         label: 'Card' },
                      { value: 'bank_transfer',label: 'Bank' },
                      { value: 'razorpay',     label: 'Razorpay' },
                      { value: 'other',        label: 'Other' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPtPayMethod(opt.value)}
                        className={`py-2 rounded-lg text-xs font-semibold border transition-colors ${
                          ptPayMethod === opt.value
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'bg-white border-border text-muted-foreground hover:border-blue-300 hover:text-blue-700'
                        }`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" className="flex-1" disabled={ptPaymentSaving}
                    onClick={() => setPtPayOpen(false)}>
                    Cancel
                  </Button>
                  <Button className="flex-1 bg-blue-600 hover:bg-blue-700"
                    disabled={!ptPaymentInput || ptPaymentSaving}
                    onClick={async () => {
                      const amount = Number(ptPaymentInput)
                      if (!amount || amount <= 0) return
                      setPtPaymentSaving(true)
                      try {
                        const newPaid = Math.min(total, paid + amount)
                        const trainerLabel = ptContract.trainer_name ? ` · ${ptContract.trainer_name}` : ''
                        await Promise.all([
                          membersApi.update(memberId, {
                            health_declaration: {
                              ...((m?.health_declaration ?? {}) as Record<string, unknown>),
                              pt_contract: { ...ptContract, paid_amount: newPaid },
                            },
                          }),
                          paymentsApi.record({
                            member_id: memberId,
                            amount,
                            payment_method: ptPayMethod,
                            status: 'completed',
                            notes: `PT Plan${trainerLabel}`,
                          }),
                        ])
                        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.member(memberId) })
                        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.memberPayments(memberId) })
                        setPtPaymentInput('')
                        setPtPayOpen(false)
                        toast.success(`₹${amount.toLocaleString('en-IN')} recorded`)
                      } catch {
                        toast.error('Failed to record payment')
                      } finally {
                        setPtPaymentSaving(false)
                      }
                    }}>
                    {ptPaymentSaving
                      ? <><span className="h-3.5 w-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin mr-1.5" />Saving…</>
                      : 'Save Payment'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )
      })()}
    </div>
  )
}
