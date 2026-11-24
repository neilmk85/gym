import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, User, CalendarDays, Dumbbell, IndianRupee, FileText, Ticket } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { DatePickerField } from '@/components/shared/DatePickerField'
import { PhoneInput } from '@/components/shared/PhoneInput'
import { dayPassesApi } from '@/api/day-passes.api'
import { facilitiesApi } from '@/api/facilities.api'
import { classesApi } from '@/api/classes.api'
import { bookingsApi } from '@/api/bookings.api'
import { QUERY_KEYS } from '@/lib/constants'

const createSchema = z.object({
  guest_first_name: z.string().min(1, 'First name is required'),
  guest_last_name:  z.string().min(1, 'Last name is required'),
  guest_email:      z.string().email('Enter a valid email').or(z.literal('')).optional(),
  guest_phone:      z.string().optional(),
  facility_id:      z.coerce.number().int().min(1, 'Please select a facility'),
  pass_date:        z.string().min(1, 'Pass date is required'),
  price:            z.coerce.number().min(0, 'Price must be 0 or more'),
  payment_method:   z.enum(['cash', 'upi', 'card', 'complimentary']).optional(),
  purpose:          z.string().optional(),
  notes:            z.string().optional(),
})

const editSchema = z.object({
  guest_first_name: z.string().min(1, 'First name is required'),
  guest_last_name:  z.string().min(1, 'Last name is required'),
  guest_email:      z.string().email('Enter a valid email').or(z.literal('')).optional(),
  guest_phone:      z.string().optional(),
  price:            z.coerce.number().min(0, 'Price must be 0 or more'),
  notes:            z.string().optional(),
  status:           z.enum(['active', 'used', 'expired', 'cancelled']).optional(),
})

type CreateFormValues = z.infer<typeof createSchema>
type EditFormValues   = z.infer<typeof editSchema>

const SECTION_COLORS: Record<string, { icon: string; title: string; dot: string }> = {
  blue:    { icon: 'bg-blue-50 border border-blue-200 text-blue-600',    title: 'text-blue-700',    dot: 'bg-blue-500' },
  violet:  { icon: 'bg-violet-50 border border-violet-200 text-violet-600', title: 'text-violet-700', dot: 'bg-violet-500' },
  emerald: { icon: 'bg-emerald-50 border border-emerald-200 text-emerald-600', title: 'text-emerald-700', dot: 'bg-emerald-500' },
  amber:   { icon: 'bg-amber-50 border border-amber-200 text-amber-600',  title: 'text-amber-700',  dot: 'bg-amber-500' },
  slate:   { icon: 'bg-slate-100 border border-slate-200 text-slate-600', title: 'text-slate-700',  dot: 'bg-slate-400' },
}

function SectionHead({ icon: Icon, title, description, color = 'slate' }: {
  icon: React.ElementType; title: string; description?: string; color?: string
}) {
  const c = SECTION_COLORS[color] ?? SECTION_COLORS.slate
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className={`flex items-center justify-center w-9 h-9 rounded-xl ${c.icon}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className={`text-sm font-bold leading-none ${c.title}`}>{title}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </div>
  )
}

function Field({ label, required, children, error }: {
  label: string; required?: boolean; children: React.ReactNode; error?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

export default function DayPassFormPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)

  const { data: passData, isLoading } = useQuery({
    queryKey: [QUERY_KEYS.dayPasses, id],
    queryFn: () => dayPassesApi.getPass(Number(id)),
    enabled: isEdit,
  })
  const pass = (passData as any)?.day_pass

  const { data: facilitiesData } = useQuery({
    queryKey: [QUERY_KEYS.facilities],
    queryFn: () => facilitiesApi.list(),
    enabled: !isEdit,
  })
  const facilities: { id: number; name: string }[] = (facilitiesData as any)?.facilities ?? []

  const today = format(new Date(), 'yyyy-MM-dd')
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null)

  const createForm = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { guest_first_name: '', guest_last_name: '', facility_id: 1, price: 0, pass_date: today, payment_method: 'cash' },
  })
  const watchedPassDate = createForm.watch('pass_date')
  const watchedPrice    = createForm.watch('price')

  const { data: classesData } = useQuery({
    queryKey: [QUERY_KEYS.classes, watchedPassDate],
    queryFn: () => classesApi.list({ date: watchedPassDate, status: 'scheduled', per_page: 100 }),
    enabled: !isEdit && !!watchedPassDate,
  })
  const availableClasses = (classesData as any)?.classes ?? []

  const editForm = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    values: pass ? (() => {
      const parts = (pass.guest_name ?? '').trim().split(' ')
      const first = parts[0] ?? ''
      const last  = parts.slice(1).join(' ')
      return {
        guest_first_name: first,
        guest_last_name:  last,
        guest_email:      pass.guest_email ?? '',
        guest_phone:      pass.guest_phone ?? '',
        price:            pass.price       ?? 0,
        notes:            pass.notes       ?? '',
        status:           pass.status,
      }
    })() : undefined,
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateFormValues) => {
      const { guest_first_name, guest_last_name, ...rest } = data
      return dayPassesApi.createPass({ ...rest, guest_name: `${guest_first_name} ${guest_last_name}`.trim() })
    },
    onSuccess: async (res: any) => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.dayPasses] })
      const newPass = res?.day_pass ?? res
      if (selectedClassId && newPass?.id) {
        try {
          const booking = await bookingsApi.bookClass({ day_pass_id: newPass.id, class_id: selectedClassId }) as any
          const status = booking?.status ?? 'confirmed'
          if (status === 'waitlisted') {
            toast.success(`Day pass issued — added to waitlist (position ${booking?.waitlist_position ?? '?'})`)
          } else {
            toast.success('Day pass issued and class booked!')
          }
        } catch (err: any) {
          toast.warning(`Day pass issued (ID: ${newPass.id}), but class booking failed: ${err?.response?.data?.error ?? 'unknown error'}`)
        }
      } else {
        toast.success('Day pass issued successfully')
      }
      navigate('/day-passes')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to issue pass'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: EditFormValues) => {
      const { guest_first_name, guest_last_name, ...rest } = data
      return dayPassesApi.updatePass(Number(id), { ...rest, guest_name: `${guest_first_name} ${guest_last_name}`.trim() })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.dayPasses] })
      toast.success('Day pass updated')
      navigate('/day-passes')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to update pass'),
  })

  if (isEdit && isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-96 w-full" />
    </div>
  )

  const errs = createForm.formState.errors
  const eErrs = editForm.formState.errors

  return (
    <div className="flex flex-col">

      {/* ── Header ── */}
      <div className="shrink-0 -mx-6 -mt-6 px-8 pt-8 pb-6"
        style={{ background: 'linear-gradient(to bottom, #fff7ed 0%, #fff3e0 35%, #fef9f0 60%, rgba(255,255,255,0) 100%)' }}>
        <button onClick={() => navigate('/day-passes')}
          className="mb-3 flex items-center gap-1 text-sm font-medium text-orange-500 hover:text-orange-700 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Day Passes
        </button>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-orange-500 flex items-center justify-center text-white shadow-sm">
            <Ticket className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-[1.75rem] font-black tracking-tight text-[#1a1a2e] leading-tight">
              {isEdit ? 'Edit Day Pass' : 'Issue Day Pass'}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {isEdit ? 'Update guest pass details' : 'Walk-in guest pass · valid for one day · ID assigned automatically'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Form body ── */}
      {!isEdit ? (
        <form onSubmit={createForm.handleSubmit(v => createMutation.mutate(v))} className="mt-5">
          <div className="bg-card rounded-xl overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>

            {/* Guest Information */}
            <div className="px-6 py-5 border-b border-border/60">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 text-blue-600"><User className="w-3.5 h-3.5" /></div>
                <span className="text-sm font-semibold text-blue-700">Guest Information</span>
                <span className="text-xs text-muted-foreground ml-1">— Who is visiting today?</span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Field label="First Name" required error={errs.guest_first_name?.message}>
                  <Input {...createForm.register('guest_first_name')} placeholder="Priya" />
                </Field>
                <Field label="Last Name" required error={errs.guest_last_name?.message}>
                  <Input {...createForm.register('guest_last_name')} placeholder="Sharma" />
                </Field>
                <Field label="Email" error={errs.guest_email?.message}>
                  <Input type="email" {...createForm.register('guest_email')} placeholder="guest@example.com" />
                </Field>
                <Field label="Phone">
                  <PhoneInput {...createForm.register('guest_phone')} />
                </Field>
                <Field label="Purpose of Visit">
                  <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    {...createForm.register('purpose')}>
                    <option value="">— Select —</option>
                    <option value="trial">Trial / First visit</option>
                    <option value="guest_of_member">Guest of a member</option>
                    <option value="event">Event / Workshop</option>
                    <option value="facility_use">Facility use only</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
              </div>
            </div>

            {/* Pass Details + Class Booking */}
            <div className="px-6 py-5 border-b border-border/60">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-50 border border-violet-200 text-violet-600"><CalendarDays className="w-3.5 h-3.5" /></div>
                <span className="text-sm font-semibold text-violet-700">Pass Details</span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Field label="Facility" required error={errs.facility_id?.message}>
                  <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    {...createForm.register('facility_id')}>
                    {facilities.length === 0 && <option value="1">Loading…</option>}
                    {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </Field>
                <Field label="Pass Date" required error={errs.pass_date?.message}>
                  <Controller control={createForm.control} name="pass_date"
                    render={({ field }) => <DatePickerField value={field.value} onChange={field.onChange} />} />
                </Field>
                <div className="col-span-2">
                  <Field label="Book a Class (optional)">
                    <div className="flex gap-2 items-center">
                      <select className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        value={selectedClassId ?? ''}
                        onChange={e => setSelectedClassId(e.target.value ? Number(e.target.value) : null)}>
                        <option value="">— No class booking —</option>
                        {availableClasses.length === 0 && watchedPassDate && <option disabled>No scheduled classes on this date</option>}
                        {availableClasses.map((c: any) => (
                          <option key={c.id} value={c.id}>
                            {c.name} — {format(parseISO(c.start_time), 'hh:mm a')}
                            {c.current_enrollment != null && c.max_capacity != null ? ` (${c.current_enrollment}/${c.max_capacity})` : ''}
                          </option>
                        ))}
                      </select>
                      {selectedClassId && (
                        <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1.5 whitespace-nowrap">
                          <Dumbbell className="w-3 h-3" /> Will be booked
                        </span>
                      )}
                    </div>
                  </Field>
                </div>
              </div>
            </div>

            {/* Payment & Notes */}
            <div className="px-6 py-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 text-amber-600"><IndianRupee className="w-3.5 h-3.5" /></div>
                <span className="text-sm font-semibold text-amber-700">Payment & Notes</span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Field label="Pass Price (₹)" error={errs.price?.message}>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                    <Input type="number" min="0" step="1" className="pl-7" {...createForm.register('price')} placeholder="0" />
                  </div>
                </Field>
                <Field label="Payment Method">
                  <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    {...createForm.register('payment_method')}>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="complimentary">Complimentary</option>
                  </select>
                </Field>
                {!(watchedPrice === 0 || String(watchedPrice) === '0') && (
                  <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800 self-end">
                    <IndianRupee className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-medium">₹{watchedPrice} collected</span>
                  </div>
                )}
                <div className="col-span-2 lg:col-span-4">
                  <Field label="Notes (optional)">
                    <Textarea {...createForm.register('notes')} placeholder="Any additional notes about this guest or visit…" rows={2} />
                  </Field>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4 pb-2">
            <Button type="button" variant="outline" onClick={() => navigate('/day-passes')}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}
              className="bg-orange-500 hover:bg-orange-600 text-white min-w-40">
              {createMutation.isPending ? 'Issuing…' : selectedClassId ? 'Issue Pass & Book Class' : 'Issue Day Pass'}
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={editForm.handleSubmit(v => updateMutation.mutate(v))} className="mt-5">
          <div className="bg-card rounded-xl overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>

            {/* Guest Information */}
            <div className="px-6 py-5 border-b border-border/60">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 text-blue-600"><User className="w-3.5 h-3.5" /></div>
                <span className="text-sm font-semibold text-blue-700">Guest Information</span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Field label="First Name" required error={eErrs.guest_first_name?.message}>
                  <Input {...editForm.register('guest_first_name')} />
                </Field>
                <Field label="Last Name" required error={eErrs.guest_last_name?.message}>
                  <Input {...editForm.register('guest_last_name')} />
                </Field>
                <Field label="Email" error={eErrs.guest_email?.message}>
                  <Input type="email" {...editForm.register('guest_email')} />
                </Field>
                <Field label="Phone">
                  <PhoneInput {...editForm.register('guest_phone')} />
                </Field>
              </div>
            </div>

            {/* Status & Payment */}
            <div className="px-6 py-5 border-b border-border/60">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 text-amber-600"><IndianRupee className="w-3.5 h-3.5" /></div>
                <span className="text-sm font-semibold text-amber-700">Status & Payment</span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Field label="Status">
                  <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    {...editForm.register('status')}>
                    <option value="active">Active</option>
                    <option value="used">Used</option>
                    <option value="expired">Expired</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </Field>
                <Field label="Price (₹)" error={eErrs.price?.message}>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                    <Input type="number" min="0" step="1" className="pl-7" {...editForm.register('price')} />
                  </div>
                </Field>
              </div>
            </div>

            {/* Notes */}
            <div className="px-6 py-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 text-slate-600"><FileText className="w-3.5 h-3.5" /></div>
                <span className="text-sm font-semibold text-slate-700">Notes</span>
              </div>
              <Textarea {...editForm.register('notes')} rows={2} placeholder="Any additional notes…" />
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4 pb-2">
            <Button type="button" variant="outline" onClick={() => navigate('/day-passes')}>Cancel</Button>
            <Button type="submit" disabled={updateMutation.isPending} className="min-w-32">
              {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
