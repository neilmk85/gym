import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { enquiriesApi } from '@/api/enquiries.api'
import { QUERY_KEYS } from '@/lib/constants'

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(7, 'Phone is required'),
  email: z.string().email('Invalid email').or(z.literal('')).optional(),
  source: z.string().optional(),
  plan_interest: z.string().optional(),
  notes: z.string().optional(),
  follow_up_date: z.string().optional(),
})

const editSchema = createSchema.extend({
  status: z.enum(['new', 'contacted', 'interested', 'converted', 'lost']).optional(),
})

type CreateValues = z.infer<typeof createSchema>
type EditValues = z.infer<typeof editSchema>

export default function EnquiryFormPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)

  const { data, isLoading } = useQuery({
    queryKey: [QUERY_KEYS.enquiries, id],
    queryFn: () => enquiriesApi.getEnquiry(Number(id)),
    enabled: isEdit,
  })
  const enquiry = (data as any)?.enquiry

  const createForm = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: '', phone: '', email: '', source: '', plan_interest: '', notes: '', follow_up_date: '' },
  })

  const editForm = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    values: enquiry ? {
      name: enquiry.name ?? '',
      phone: enquiry.phone ?? '',
      email: enquiry.email ?? '',
      source: enquiry.source ?? '',
      plan_interest: enquiry.plan_interest ?? '',
      notes: enquiry.notes ?? '',
      follow_up_date: enquiry.follow_up_date ?? '',
      status: enquiry.status,
    } : undefined,
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateValues) => enquiriesApi.createEnquiry(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.enquiries] })
      toast.success('Enquiry created')
      navigate('/enquiries')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to create enquiry'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: EditValues) => enquiriesApi.updateEnquiry(Number(id), data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.enquiries] })
      toast.success('Enquiry updated')
      navigate('/enquiries')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to update enquiry'),
  })

  if (isEdit && isLoading) return (
    <div className="max-w-lg mx-auto space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  )

  const activeForm = isEdit ? editForm : createForm
  const activeMutation = isEdit ? updateMutation : createMutation

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" title="Back" onClick={() => navigate('/enquiries')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{isEdit ? 'Edit Enquiry' : 'New Enquiry'}</h1>
          <p className="text-sm text-muted-foreground">
            {isEdit ? 'Update lead/enquiry details' : 'Record a new lead or enquiry'}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <form
            onSubmit={
              isEdit
                ? editForm.handleSubmit(v => updateMutation.mutate(v))
                : createForm.handleSubmit(v => createMutation.mutate(v))
            }
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input {...activeForm.register('name')} placeholder="Full name" />
              {activeForm.formState.errors.name && (
                <p className="text-xs text-destructive">{activeForm.formState.errors.name.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Phone <span className="text-destructive">*</span></Label>
                <Input type="tel" {...activeForm.register('phone')} placeholder="+91 98765 43210" />
                {activeForm.formState.errors.phone && (
                  <p className="text-xs text-destructive">{activeForm.formState.errors.phone.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" {...activeForm.register('email')} placeholder="lead@example.com" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Source</Label>
                <Input {...activeForm.register('source')} placeholder="Walk-in, Instagram, Referral…" />
              </div>
              <div className="space-y-1.5">
                <Label>Plan Interest</Label>
                <Input {...activeForm.register('plan_interest')} placeholder="Monthly, Annual…" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Follow-Up Date</Label>
              <Input type="date" {...activeForm.register('follow_up_date')} />
            </div>

            {isEdit && (
              <div className="space-y-1.5">
                <Label>Status</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" {...editForm.register('status')}>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="interested">Interested</option>
                  <option value="converted">Converted</option>
                  <option value="lost">Lost</option>
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea {...activeForm.register('notes')} rows={3} placeholder="Any notes about this lead…" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate('/enquiries')}>Cancel</Button>
              <Button type="submit" disabled={activeMutation.isPending}>
                {activeMutation.isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Enquiry'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
