import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, User, Building2, CalendarDays, Dumbbell, IndianRupee, FileText } from 'lucide-react'
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
  guest_name:   z.string().min(1, 'Guest name is required'),
  guest_email:  z.string().email('Enter a valid email').or(z.literal('')).optional(),
  guest_phone:  z.string().optional(),
  facility_id:  z.coerce.number().int().min(1, 'Please select a facility'),
  pass_date:    z.string().min(1, 'Pass date is required'),
  price:        z.coerce.number().min(0, 'Price must be 0 or more'),
  notes:        z.string().optional(),
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

function SectionHeader({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description?: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/10 text-primary">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-sm font-semibold leading-none">{title}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
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
    defaultValues: { facility_id: 1, price: 0, pass_date: today },
  })

  const watchedPassDate = createForm.watch('pass_date')

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
    <div className="max-w-2xl mx-auto space-y-4">
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-0">
      {/* Hero header */}
      <div className="relative rounded-t-xl overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-orange-600 px-6 py-7 text-white shadow-sm">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative flex items-start gap-4">
          <button
            type="button"
            onClick={() => navigate('/day-passes')}
            className="mt-0.5 flex items-center justify-center w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isEdit ? 'Edit Day Pass' : 'Issue Day Pass'}
            </h1>
            <p className="mt-1 text-sm text-orange-100">
              {isEdit
                ? 'Update guest pass details'
                : 'Walk-in guest pass · valid for one day · ID assigned automatically'}
            </p>
          </div>
        </div>
      </div>

      {/* Form body */}
      <div className="bg-card border border-t-0 rounded-b-xl shadow-sm">
        {!isEdit ? (
          <form onSubmit={createForm.handleSubmit(v => createMutation.mutate(v))}>

            {/* ── Section 1: Guest Info ── */}
            <div className="px-6 pt-6 pb-5 border-b">
              <SectionHeader icon={User} title="Guest Information" description="Who is visiting today?" />
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="guest_name">Full Name <span className="text-destructive">*</span></Label>
                  <Input id="guest_name" {...createForm.register('guest_name')} placeholder="e.g. Priya Sharma" />
                  {createForm.formState.errors.guest_name && (
                    <p className="text-xs text-destructive">{createForm.formState.errors.guest_name.message}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input type="email" {...createForm.register('guest_email')} placeholder="guest@example.com" />
                    {createForm.formState.errors.guest_email && (
                      <p className="text-xs text-destructive">{createForm.formState.errors.guest_email.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone</Label>
                    <Input type="tel" {...createForm.register('guest_phone')} placeholder="+91 98765 43210" />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Section 2: Pass Details ── */}
            <div className="px-6 pt-6 pb-5 border-b">
              <SectionHeader icon={CalendarDays} title="Pass Details" description="Facility and date for this visit" />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Facility <span className="text-destructive">*</span></Label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    {...createForm.register('facility_id')}
                  >
                    {facilities.length === 0 && <option value="1">Loading…</option>}
                    {facilities.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                  {createForm.formState.errors.facility_id && (
                    <p className="text-xs text-destructive">{createForm.formState.errors.facility_id.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Pass Date <span className="text-destructive">*</span></Label>
                  <Controller
                    control={createForm.control}
                    name="pass_date"
                    render={({ field }) => (
                      <DatePickerField value={field.value} onChange={field.onChange} />
                    )}
                  />
                  {createForm.formState.errors.pass_date && (
                    <p className="text-xs text-destructive">{createForm.formState.errors.pass_date.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* ── Section 3: Class Booking ── */}
            <div className="px-6 pt-6 pb-5 border-b bg-muted/30">
              <SectionHeader icon={Dumbbell} title="Class Booking" description="Optionally book a class for this guest on the pass date" />
              <div className="space-y-3">
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={selectedClassId ?? ''}
                  onChange={e => setSelectedClassId(e.target.value ? Number(e.target.value) : null)}
                >
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
                {selectedClassId && (
                  <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300">
                    <Dumbbell className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>Guest will be booked into this class when the pass is issued. If the class is full, they'll be waitlisted.</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Section 4: Payment & Notes ── */}
            <div className="px-6 pt-6 pb-5">
              <SectionHeader icon={IndianRupee} title="Payment & Notes" />
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Pass Price (₹)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                    <Input type="number" min="0" step="1" className="pl-7" {...createForm.register('price')} placeholder="0" />
                  </div>
                  {createForm.formState.errors.price && (
                    <p className="text-xs text-destructive">{createForm.formState.errors.price.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Notes <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                  <Textarea {...createForm.register('notes')} placeholder="Any additional notes about this guest or visit…" rows={3} />
                </div>
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-muted/20 rounded-b-xl">
              <Button type="button" variant="outline" onClick={() => navigate('/day-passes')}>Cancel</Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="bg-orange-500 hover:bg-orange-600 text-white min-w-36"
              >
                {createMutation.isPending
                  ? 'Issuing…'
                  : selectedClassId
                    ? 'Issue Pass & Book Class'
                    : 'Issue Day Pass'}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={editForm.handleSubmit(v => updateMutation.mutate(v))}>

            {/* ── Guest Info ── */}
            <div className="px-6 pt-6 pb-5 border-b">
              <SectionHeader icon={User} title="Guest Information" />
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Full Name <span className="text-destructive">*</span></Label>
                  <Input {...editForm.register('guest_name')} />
                  {editForm.formState.errors.guest_name && (
                    <p className="text-xs text-destructive">{editForm.formState.errors.guest_name.message}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input type="email" {...editForm.register('guest_email')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone</Label>
                    <Input type="tel" {...editForm.register('guest_phone')} />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Status & Payment ── */}
            <div className="px-6 pt-6 pb-5 border-b">
              <SectionHeader icon={IndianRupee} title="Status & Payment" />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    {...editForm.register('status')}
                  >
                    <option value="active">Active</option>
                    <option value="used">Used</option>
                    <option value="expired">Expired</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Price (₹)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                    <Input type="number" min="0" step="1" className="pl-7" {...editForm.register('price')} />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Notes ── */}
            <div className="px-6 pt-6 pb-5">
              <SectionHeader icon={FileText} title="Notes" />
              <Textarea {...editForm.register('notes')} rows={3} placeholder="Any additional notes…" />
            </div>

            {/* ── Footer ── */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-muted/20 rounded-b-xl">
              <Button type="button" variant="outline" onClick={() => navigate('/day-passes')}>Cancel</Button>
              <Button type="submit" disabled={updateMutation.isPending} className="min-w-28">
                {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
