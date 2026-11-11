import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { trainersApi } from '@/api/trainers.api'
import { facilitiesApi } from '@/api/facilities.api'
import { QUERY_KEYS } from '@/lib/constants'
import { getTrainerSalary, saveTrainerSalary, getTrainerDocs, saveTrainerDocs } from '@/lib/service-types'
import { useState, KeyboardEvent } from 'react'

const schema = z.object({
  first_name: z.string().min(1, 'Required'),
  last_name: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email'),
  phone: z.string().optional(),
  facility_id: z.coerce.number().min(1, 'Required').optional(),
  bio: z.string().optional(),
  experience_years: z.coerce.number().min(0).max(50),
  hourly_rate: z.coerce.number().min(0),
  max_clients_per_day: z.coerce.number().min(1).max(100),
  specializations: z.array(z.string()),
  certifications: z.array(z.string()),
  pan_number: z.string().optional(),
  aadhar_number: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

function TagInput({ value, onChange, placeholder }: {
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
}) {
  const [inputVal, setInputVal] = useState('')

  const addTag = () => {
    const tag = inputVal.trim()
    if (tag && !value.includes(tag)) onChange([...value, tag])
    setInputVal('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() }
    else if (e.key === 'Backspace' && !inputVal && value.length > 0) onChange(value.slice(0, -1))
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input value={inputVal} onChange={e => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown} onBlur={addTag}
          placeholder={placeholder ?? 'Type and press Enter'} className="flex-1" />
        <Button type="button" variant="outline" size="sm" onClick={addTag}>Add</Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map(tag => (
            <Badge key={tag} variant="secondary" className="text-xs gap-1">
              {tag}
              <button type="button" onClick={() => onChange(value.filter(t => t !== tag))}
                className="ml-0.5 hover:text-destructive">
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

export default function TrainerEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const trainerId = Number(id)

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.trainer(trainerId),
    queryFn: () => trainersApi.getById(trainerId),
    enabled: !!trainerId,
  })

  const { data: facilitiesData } = useQuery({
    queryKey: QUERY_KEYS.facilities,
    queryFn: () => facilitiesApi.list(),
  })
  const facilities = facilitiesData?.facilities ?? []

  const trainer = (data as any)?.trainer ?? data

  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: '', last_name: '', email: '', phone: '',
      bio: '', experience_years: 0, hourly_rate: 0,
      max_clients_per_day: 10, specializations: [], certifications: [],
      pan_number: '', aadhar_number: '',
    },
  })

  useEffect(() => {
    if (trainer) {
      reset({
        first_name: trainer.user?.first_name ?? '',
        last_name: trainer.user?.last_name ?? '',
        email: trainer.user?.email ?? '',
        phone: trainer.user?.phone ?? '',
        facility_id: trainer.facility_id,
        bio: trainer.bio ?? '',
        experience_years: trainer.experience_years ?? 0,
        hourly_rate: getTrainerSalary(trainerId, trainer.hourly_rate ?? 0),
        max_clients_per_day: trainer.max_clients_per_day ?? 10,
        specializations: trainer.specializations ?? [],
        certifications: trainer.certifications ?? [],
        pan_number: getTrainerDocs(trainerId).pan_number ?? '',
        aadhar_number: getTrainerDocs(trainerId).aadhar_number ?? '',
      })
    }
  }, [trainer, reset, trainerId])

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) => {
      saveTrainerSalary(trainerId, data.hourly_rate)
      saveTrainerDocs(trainerId, { pan_number: data.pan_number, aadhar_number: data.aadhar_number })
      return trainersApi.update(trainerId, data as Record<string, unknown>)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.trainers })
      qc.invalidateQueries({ queryKey: QUERY_KEYS.trainer(trainerId) })
      toast.success('Trainer updated successfully')
      navigate(`/trainers/${trainerId}`)
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to update trainer'),
  })

  const firstName = trainer?.user?.first_name ?? ''
  const lastName  = trainer?.user?.last_name ?? ''

  if (isLoading) {
    return <div className="py-10 text-sm text-muted-foreground">Loading trainer…</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" title="Back" onClick={() => navigate(`/trainers/${trainerId}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Edit Trainer</h1>
          <p className="text-sm text-muted-foreground">{firstName} {lastName}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(d => updateMutation.mutate(d))} className="space-y-5">

        {/* Personal Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>First Name <span className="text-destructive">*</span></Label>
              <Input {...register('first_name')} placeholder="First name" />
              {errors.first_name && <p className="text-xs text-destructive">{errors.first_name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Last Name <span className="text-destructive">*</span></Label>
              <Input {...register('last_name')} placeholder="Last name" />
              {errors.last_name && <p className="text-xs text-destructive">{errors.last_name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Email <span className="text-destructive">*</span></Label>
              <Input {...register('email')} type="email" placeholder="trainer@gym.com" />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input {...register('phone')} placeholder="+91 98765 43210" />
            </div>
          </CardContent>
        </Card>

        {/* Professional Details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Professional Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label>Experience (yrs)</Label>
                <Input {...register('experience_years')} type="number" min={0} />
                {errors.experience_years && <p className="text-xs text-destructive">{errors.experience_years.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Salary (₹/mo)</Label>
                <Input {...register('hourly_rate')} type="number" min={0} step="500" />
                {errors.hourly_rate && <p className="text-xs text-destructive">{errors.hourly_rate.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Max Clients/Day</Label>
                <Input {...register('max_clients_per_day')} type="number" min={1} />
                {errors.max_clients_per_day && <p className="text-xs text-destructive">{errors.max_clients_per_day.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Facility</Label>
                <select {...register('facility_id')}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="">Select…</option>
                  {facilities.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                {errors.facility_id && <p className="text-xs text-destructive">{errors.facility_id.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Bio</Label>
              <Textarea {...register('bio')} placeholder="Short trainer bio…" rows={3} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Specializations</Label>
                <Controller control={control} name="specializations"
                  render={({ field }) => (
                    <TagInput value={field.value} onChange={field.onChange} placeholder="e.g. Yoga, CrossFit…" />
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Certifications</Label>
                <Controller control={control} name="certifications"
                  render={({ field }) => (
                    <TagInput value={field.value} onChange={field.onChange} placeholder="e.g. ACE CPT, NASM…" />
                  )}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ID Documents */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">ID Documents</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>PAN Number</Label>
              <Input {...register('pan_number')} placeholder="ABCDE1234F" className="uppercase" />
            </div>
            <div className="space-y-1.5">
              <Label>Aadhar Number</Label>
              <Input {...register('aadhar_number')} placeholder="XXXX XXXX XXXX" />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate(`/trainers/${trainerId}`)}>
            Cancel
          </Button>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  )
}
