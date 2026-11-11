import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, Ticket, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { bookingsApi } from '@/api/bookings.api'
import { QUERY_KEYS } from '@/lib/constants'

const memberSchema = z.object({
  member_id: z.coerce.number().int().positive('Member ID must be a positive number'),
  class_id: z.coerce.number().int().positive('Class ID must be a positive number'),
})

const dayPassSchema = z.object({
  day_pass_id: z.coerce.number().int().positive('Day Pass ID must be a positive number'),
  class_id: z.coerce.number().int().positive('Class ID must be a positive number'),
})

type MemberFormValues = z.infer<typeof memberSchema>
type DayPassFormValues = z.infer<typeof dayPassSchema>

export default function BookingFormPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [mode, setMode] = useState<'member' | 'day_pass'>('member')

  const memberForm = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: { member_id: undefined as any, class_id: undefined as any },
  })

  const dayPassForm = useForm<DayPassFormValues>({
    resolver: zodResolver(dayPassSchema),
    defaultValues: { day_pass_id: undefined as any, class_id: undefined as any },
  })

  const mutation = useMutation({
    mutationFn: (data: MemberFormValues | DayPassFormValues) => bookingsApi.bookClass(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.bookings] })
      toast.success('Booking created')
      navigate('/bookings')
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error ?? 'Failed to create booking')
    },
  })

  const onMemberSubmit = (values: MemberFormValues) => mutation.mutate(values)
  const onDayPassSubmit = (values: DayPassFormValues) => mutation.mutate(values)

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" title="Back" onClick={() => navigate('/bookings')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Book a Class</h1>
          <p className="text-sm text-muted-foreground">Create a class booking</p>
        </div>
      </div>

      {/* Toggle between member / walk-in */}
      <div className="flex gap-2 p-1 bg-muted rounded-lg">
        <button
          type="button"
          onClick={() => setMode('member')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === 'member' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users className="h-4 w-4" /> Member
        </button>
        <button
          type="button"
          onClick={() => setMode('day_pass')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === 'day_pass' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Ticket className="h-4 w-4" /> Walk-in (Day Pass)
        </button>
      </div>

      {mode === 'member' ? (
        <Card>
          <CardContent className="p-6">
            <form onSubmit={memberForm.handleSubmit(onMemberSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="member_id">Member ID <span className="text-destructive">*</span></Label>
                <Input
                  id="member_id"
                  type="number"
                  min="1"
                  placeholder="e.g. 42"
                  {...memberForm.register('member_id')}
                />
                {memberForm.formState.errors.member_id && (
                  <p className="text-xs text-destructive">{memberForm.formState.errors.member_id.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="class_id">Class ID <span className="text-destructive">*</span></Label>
                <Input
                  id="class_id"
                  type="number"
                  min="1"
                  placeholder="e.g. 7"
                  {...memberForm.register('class_id')}
                />
                {memberForm.formState.errors.class_id && (
                  <p className="text-xs text-destructive">{memberForm.formState.errors.class_id.message}</p>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => navigate('/bookings')}>
                  Cancel
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? 'Booking...' : 'Book Class'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
              Walk-in guests must first receive a Day Pass from the{' '}
              <button
                type="button"
                className="underline font-medium"
                onClick={() => navigate('/day-passes/new')}
              >
                Day Passes page
              </button>
              . Enter the Day Pass ID shown on their pass below.
            </div>
            <form onSubmit={dayPassForm.handleSubmit(onDayPassSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="day_pass_id">Day Pass ID <span className="text-destructive">*</span></Label>
                <Input
                  id="day_pass_id"
                  type="number"
                  min="1"
                  placeholder="Day Pass ID from their pass"
                  {...dayPassForm.register('day_pass_id')}
                />
                {dayPassForm.formState.errors.day_pass_id && (
                  <p className="text-xs text-destructive">{dayPassForm.formState.errors.day_pass_id.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dp_class_id">Class ID <span className="text-destructive">*</span></Label>
                <Input
                  id="dp_class_id"
                  type="number"
                  min="1"
                  placeholder="e.g. 7"
                  {...dayPassForm.register('class_id')}
                />
                {dayPassForm.formState.errors.class_id && (
                  <p className="text-xs text-destructive">{dayPassForm.formState.errors.class_id.message}</p>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => navigate('/bookings')}>
                  Cancel
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? 'Booking...' : 'Book Class'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
