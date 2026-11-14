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
import { dayPassesApi } from '@/api/day-passes.api'
import { facilitiesApi } from '@/api/facilities.api'
import { classesApi } from '@/api/classes.api'
import { bookingsApi } from '@/api/bookings.api'
import { QUERY_KEYS } from '@/lib/constants'

const createSchema = z.object({
  guest_name:      z.string().min(1, 'Guest name is required'),
  guest_email:     z.string().email('Enter a valid email').or(z.literal('')).optional(),
  guest_phone:     z.string().optional(),
  facility_id:     z.coerce.number().int().min(1, 'Please select a facility'),
  pass_date:       z.string().min(1, 'Pass date is required'),
  price:           z.coerce.number().min(0, 'Price must be 0 or more'),
  payment_method:  z.enum(['cash', 'upi', 'card', 'complimentary']).optional(),
  purpose:         z.string().optional(),
  notes:           z.string().optional(),
})

const editSchema = z.object({
  guest_name:  z.string().min(1, 'Guest name is required'),
  guest_email: z.string().email('Enter a valid email').or(z.literal('')).optional(),
  guest_phone: z.string().optional(),
  price:       z.coerce.number().min(0, 'Price must be 0 or more'),
  notes:       z.string().optional(),
  status:      z.enum(['active', 'used', 'expired', 'cancelled']).optional(),
})

type CreateFormValues = z.infer<typeof createSchema>
type EditFormValues   = z.infer<typeof editSchema>

function SectionHead({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 text-orange-600">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-700 leading-none">{title}</p>
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
    defaultValues: { facility_id: 1, price: 0, pass_date: today, payment_method: 'cash' },
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
    values: pass ? {
      guest_name:  pass.guest_name  ?? '',
      guest_email: pass.guest_email ?? '',
      guest_phone: pass.guest_phone ?? '',
      price:       pass.price       ?? 0,
      notes:       pass.notes       ?? '',
      status:      pass.status,
    } : undefined,
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateFormValues) => dayPassesApi.createPass(data),
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
    mutationFn: (data: EditFormValues) => dayPassesApi.updatePass(Number(id), data),
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
        <form onSubmit={createForm.handleSubmit(v => createMutation.mutate(v))} className="space-y-0 mt-6">

          {/* Guest Information */}
          <div className="bg-card border rounded-xl px-6 pt-6 pb-7 mb-4">
            <SectionHead icon={User} title="Guest Information" description="Who is visiting today?" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="col-span-2">
                <Field label="Full Name" required error={errs.guest_name?.message}>
                  <Input {...createForm.register('guest_name')} placeholder="e.g. Priya Sharma" />
                </Field>
              </div>
              <Field label="Email" error={errs.guest_email?.message}>
                <Input type="email" {...createForm.register('guest_email')} placeholder="guest@example.com" />
              </Field>
              <Field label="Phone">
                <Input type="tel" {...createForm.register('guest_phone')} placeholder="+91 98765 43210" />
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

          {/* Pass Details */}
          <div className="bg-card border rounded-xl px-6 pt-6 pb-7 mb-4">
            <SectionHead icon={CalendarDays} title="Pass Details" description="Facility and date for this visit" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="col-span-2 lg:col-span-1">
                <Field label="Facility" required error={errs.facility_id?.message}>
                  <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    {...createForm.register('facility_id')}>
                    {facilities.length === 0 && <option value="1">Loading…</option>}
                    {facilities.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Pass Date" required error={errs.pass_date?.message}>
                <Controller control={createForm.control} name="pass_date"
                  render={({ field }) => <DatePickerField value={field.value} onChange={field.onChange} />} />
              </Field>
            </div>
          </div>

          {/* Class Booking */}
          <div className="bg-card border rounded-xl px-6 pt-6 pb-7 mb-4">
            <SectionHead icon={Dumbbell} title="Class Booking" description="Optionally book a class for this guest on the pass date" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Field label="Book a Class">
                <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={selectedClassId ?? ''}
                  onChange={e => setSelectedClassId(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">— No class booking —</option>
                  {availableClasses.length === 0 && watchedPassDate && (
                    <option disabled>No scheduled classes on this date</option>
                  )}
                  {availableClasses.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {format(parseISO(c.start_time), 'hh:mm a')}
                      {c.current_enrollment != null && c.max_capacity != null
                        ? ` (${c.current_enrollment}/${c.max_capacity})`
                        : ''}
                    </option>
                  ))}
                </select>
              </Field>
              {selectedClassId && (
                <div className="flex items-start gap-2 self-end rounded-lg bg-orange-50 border border-orange-200 px-3 py-2.5 text-xs text-orange-800">
                  <Dumbbell className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>Guest will be booked into this class when the pass is issued. If the class is full, they'll be waitlisted.</span>
                </div>
              )}
            </div>
          </div>

          {/* Payment & Notes */}
          <div className="bg-card border rounded-xl px-6 pt-6 pb-7 mb-4">
            <SectionHead icon={IndianRupee} title="Payment & Notes" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Field label="Pass Price (₹)" error={errs.price?.message}>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                  <Input type="number" min="0" step="1" className="pl-7"
                    {...createForm.register('price')} placeholder="0" />
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
              {watchedPrice === 0 || String(watchedPrice) === '0' ? null : (
                <div className="col-span-2 flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 text-sm text-green-800 self-end">
                  <IndianRupee className="w-4 h-4 shrink-0" />
                  <span className="font-medium">₹{watchedPrice} collected</span>
                </div>
              )}
              <div className="col-span-2 lg:col-span-4">
                <Field label="Notes (optional)">
                  <Textarea {...createForm.register('notes')} placeholder="Any additional notes about this guest or visit…" rows={3} />
                </Field>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 py-2">
            <Button type="button" variant="outline" onClick={() => navigate('/day-passes')}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}
              className="bg-orange-500 hover:bg-orange-600 text-white min-w-40">
              {createMutation.isPending
                ? 'Issuing…'
                : selectedClassId
                  ? 'Issue Pass & Book Class'
                  : 'Issue Day Pass'}
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={editForm.handleSubmit(v => updateMutation.mutate(v))} className="space-y-0 mt-6">

          {/* Guest Information */}
          <div className="bg-card border rounded-xl px-6 pt-6 pb-7 mb-4">
            <SectionHead icon={User} title="Guest Information" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="col-span-2">
                <Field label="Full Name" required error={eErrs.guest_name?.message}>
                  <Input {...editForm.register('guest_name')} />
                </Field>
              </div>
              <Field label="Email" error={eErrs.guest_email?.message}>
                <Input type="email" {...editForm.register('guest_email')} />
              </Field>
              <Field label="Phone">
                <Input type="tel" {...editForm.register('guest_phone')} />
              </Field>
            </div>
          </div>

          {/* Status & Payment */}
          <div className="bg-card border rounded-xl px-6 pt-6 pb-7 mb-4">
            <SectionHead icon={IndianRupee} title="Status & Payment" />
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
          <div className="bg-card border rounded-xl px-6 pt-6 pb-7 mb-4">
            <SectionHead icon={FileText} title="Notes" />
            <Textarea {...editForm.register('notes')} rows={3} placeholder="Any additional notes…" />
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 py-2">
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
