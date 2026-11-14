import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, User, Phone, Mail, Target, Calendar, CreditCard, Users, MessageSquare, UserCheck, Dumbbell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { enquiriesApi } from '@/api/enquiries.api'
import { QUERY_KEYS } from '@/lib/constants'

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  name:                z.string().min(1, 'Name is required'),
  phone:               z.string().min(7, 'Phone is required'),
  email:               z.string().email('Invalid email').or(z.literal('')).optional(),
  source:              z.string().optional(),
  referred_by:         z.string().optional(),
  membership_type:     z.string().optional(),
  plan_interest:       z.string().optional(),
  budget_range:        z.string().optional(),
  fitness_goal:        z.string().optional(),
  follow_up_date:      z.string().optional(),
  likely_joining_date: z.string().optional(),
  trial_visit_date:    z.string().optional(),
  status:              z.string().optional(),
  notes:               z.string().optional(),
  remarks:             z.string().optional(),
})

type FormValues = z.infer<typeof schema>

// ─── Constants ────────────────────────────────────────────────────────────────

const SOURCES = [
  { value: 'walk_in',      label: 'Walk-in' },
  { value: 'phone_call',   label: 'Phone Call' },
  { value: 'email',        label: 'Email' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'whatsapp',     label: 'WhatsApp' },
  { value: 'google',       label: 'Google Search' },
  { value: 'referral',     label: 'Referral' },
  { value: 'website',      label: 'Website' },
  { value: 'other',        label: 'Other' },
]

const STATUSES = [
  { value: 'new',              label: 'New',              color: 'bg-slate-100 text-slate-700' },
  { value: 'contacted',        label: 'Contacted',        color: 'bg-blue-100 text-blue-700' },
  { value: 'visit_scheduled',  label: 'Visit Scheduled',  color: 'bg-amber-100 text-amber-700' },
  { value: 'converted',        label: 'Converted',        color: 'bg-green-100 text-green-700' },
  { value: 'closed',           label: 'Closed / Lost',    color: 'bg-red-100 text-red-700' },
]

const MEMBERSHIP_TYPES = [
  { value: 'individual', label: 'Individual' },
  { value: 'couple',     label: 'Couple' },
  { value: 'group',      label: 'Group / Family' },
]

const BUDGET_RANGES = [
  { value: 'below_1000',    label: 'Below ₹1,000/mo' },
  { value: '1000_2000',     label: '₹1,000 – ₹2,000/mo' },
  { value: '2000_3000',     label: '₹2,000 – ₹3,000/mo' },
  { value: '3000_5000',     label: '₹3,000 – ₹5,000/mo' },
  { value: 'above_5000',    label: 'Above ₹5,000/mo' },
  { value: 'flexible',      label: 'Flexible' },
]

const FITNESS_GOALS = [
  'Weight Loss', 'Muscle Gain', 'General Fitness', 'Stress Relief',
  'Flexibility', 'Rehabilitation', 'Sports Performance', 'Weight Management',
  'Lifestyle Change', 'Post-Pregnancy', 'Other',
]

const PLAN_TYPES = [
  { value: 'monthly',    label: 'Monthly' },
  { value: 'quarterly',  label: 'Quarterly (3 months)' },
  { value: 'half_year',  label: 'Half-Year (6 months)' },
  { value: 'annual',     label: 'Annual' },
  { value: 'trial',      label: 'Trial / Short-term' },
]

// ─── UI helpers ───────────────────────────────────────────────────────────────

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

function SectionHead({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="h-7 w-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
        {icon}
      </div>
      <h3 className="text-sm font-bold text-slate-700 tracking-wide">{title}</h3>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EnquiryFormPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)

  const { data, isLoading } = useQuery({
    queryKey: [QUERY_KEYS.enquiries, id],
    queryFn: () => enquiriesApi.getById(Number(id)),
    enabled: isEdit,
  })
  const enquiry = (data as any)?.enquiry ?? (data as any)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '', phone: '+91 ', email: '', source: 'walk_in',
      referred_by: '', membership_type: '', plan_interest: '',
      budget_range: '', fitness_goal: '', follow_up_date: '',
      likely_joining_date: '', trial_visit_date: '', status: 'new',
      notes: '', remarks: '',
    },
    values: enquiry ? {
      name:                enquiry.name ?? '',
      phone:               enquiry.phone ?? '',
      email:               enquiry.email ?? '',
      source:              enquiry.source ?? 'walk_in',
      referred_by:         enquiry.referred_by ?? '',
      membership_type:     enquiry.membership_type ?? '',
      plan_interest:       enquiry.plan_interest ?? '',
      budget_range:        enquiry.budget_range ?? '',
      fitness_goal:        enquiry.fitness_goal ?? '',
      follow_up_date:      enquiry.follow_up_date?.slice(0, 10) ?? '',
      likely_joining_date: enquiry.likely_joining_date?.slice(0, 10) ?? '',
      trial_visit_date:    enquiry.trial_visit_date?.slice(0, 10) ?? '',
      status:              enquiry.status ?? 'new',
      notes:               enquiry.notes ?? '',
      remarks:             enquiry.remarks ?? '',
    } : undefined,
  })

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload: Record<string, unknown> = { ...values }
      if (!isEdit) delete payload.status
      return isEdit
        ? enquiriesApi.update(Number(id), payload)
        : enquiriesApi.create(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.enquiries] })
      toast.success(isEdit ? 'Enquiry updated' : 'Enquiry created')
      navigate('/enquiries')
    },
    onError: (err: any) => toast.error(err?.details ?? err?.message ?? 'Failed to save enquiry'),
  })

  const source = form.watch('source')

  if (isEdit && isLoading) return (
    <div className="max-w-4xl space-y-4">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-96 w-full" />
    </div>
  )

  return (
    <div className="flex flex-col">

      {/* Header */}
      <div className="shrink-0 -mx-6 -mt-6 px-8 pt-8 pb-6"
        style={{ background: 'linear-gradient(to bottom, #ebe6fd 0%, #eef1ff 35%, #f4f6ff 60%, rgba(255,255,255,0) 100%)' }}>
        <button onClick={() => navigate('/enquiries')}
          className="mb-3 flex items-center gap-1 text-sm font-medium text-indigo-500 hover:text-indigo-700 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Enquiries
        </button>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-indigo-500 flex items-center justify-center text-white shadow-sm">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-[1.75rem] font-black tracking-tight text-[#1a1a2e] leading-tight">
              {isEdit ? 'Edit Enquiry' : 'New Enquiry'}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {isEdit ? 'Update lead details and follow-up info' : 'Record a new lead — capture everything needed to convert'}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(v => mutation.mutate(v))} className="mt-6 space-y-4">

        {/* ── Contact Info ── */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <SectionHead icon={<User className="h-4 w-4" />} title="Contact Information" />
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <Field label="Full Name" required error={form.formState.errors.name?.message}>
                <Input {...form.register('name')} placeholder="e.g. Priya Sharma" className="h-10" />
              </Field>
              <Field label="Phone" required error={form.formState.errors.phone?.message}>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input {...form.register('phone')} placeholder="+91 98765 43210" className="h-10 pl-9" />
                </div>
              </Field>
              <Field label="Email" error={form.formState.errors.email?.message}>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="email" {...form.register('email')} placeholder="priya@example.com" className="h-10 pl-9" />
                </div>
              </Field>
            </div>
          </CardContent>
        </Card>

        {/* ── Lead Source ── */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <SectionHead icon={<Target className="h-4 w-4" />} title="Lead Source" />
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <Field label="Source">
                <Select value={form.watch('source') ?? ''} onValueChange={v => form.setValue('source', v)}>
                  <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {SOURCES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              {source === 'referral' && (
                <Field label="Referred By">
                  <Input {...form.register('referred_by')} placeholder="Name of referring member" className="h-10" />
                </Field>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Membership Interest ── */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <SectionHead icon={<CreditCard className="h-4 w-4" />} title="Membership Interest" />
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <Field label="Membership Type">
                <Select value={form.watch('membership_type') ?? ''} onValueChange={v => form.setValue('membership_type', v)}>
                  <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {MEMBERSHIP_TYPES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Plan Duration">
                <Select value={form.watch('plan_interest') ?? ''} onValueChange={v => form.setValue('plan_interest', v)}>
                  <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {PLAN_TYPES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Budget Range">
                <Select value={form.watch('budget_range') ?? ''} onValueChange={v => form.setValue('budget_range', v)}>
                  <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {BUDGET_RANGES.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="mt-4">
              <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3 block">Fitness Goal</Label>
              <div className="flex flex-wrap gap-2">
                {FITNESS_GOALS.map(g => {
                  const active = form.watch('fitness_goal') === g
                  return (
                    <button key={g} type="button" onClick={() => form.setValue('fitness_goal', active ? '' : g)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${active ? 'bg-indigo-500 text-white border-transparent' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'}`}>
                      {g}
                    </button>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Follow-up & Timeline ── */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <SectionHead icon={<Calendar className="h-4 w-4" />} title="Follow-up & Timeline" />
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <Field label="Follow-up Date">
                <Input type="date" {...form.register('follow_up_date')} className="h-10" />
              </Field>
              <Field label="Likely Joining Date">
                <Input type="date" {...form.register('likely_joining_date')} className="h-10" />
              </Field>
              <Field label="Trial Visit Date">
                <Input type="date" {...form.register('trial_visit_date')} className="h-10" />
              </Field>
              {isEdit && (
                <Field label="Status">
                  <Select value={form.watch('status') ?? 'new'} onValueChange={v => form.setValue('status', v)}>
                    <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Notes & Remarks ── */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-6">
            <SectionHead icon={<MessageSquare className="h-4 w-4" />} title="Notes & Remarks" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Field label="Notes">
                <textarea {...form.register('notes')} rows={3} placeholder="What did they ask about? Any key information from the conversation…"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
              </Field>
              <Field label="Remarks / Internal">
                <textarea {...form.register('remarks')} rows={3} placeholder="Internal notes, pricing discussed, objections, next steps…"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
              </Field>
            </div>
          </CardContent>
        </Card>

        {/* Submit bar */}
        <div className="flex items-center justify-between p-5 rounded-2xl border bg-white shadow-sm sticky bottom-4">
          <div>
            <p className="text-sm font-semibold">{isEdit ? 'Save changes to this enquiry?' : 'Save this new enquiry?'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isEdit ? 'Updates will be reflected in the enquiry pipeline.' : 'You can add follow-up details and update status later.'}
            </p>
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => navigate('/enquiries')} disabled={mutation.isPending}>
              <ArrowLeft className="h-4 w-4" /> Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending} className="px-8 bg-indigo-600 hover:bg-indigo-700">
              {isEdit ? 'Save Changes' : 'Create Enquiry'}
            </Button>
          </div>
        </div>

      </form>
    </div>
  )
}
