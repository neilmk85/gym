import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, X, Eye, EyeOff } from 'lucide-react'
import { useState, KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { trainersApi } from '@/api/trainers.api'
import { facilitiesApi } from '@/api/facilities.api'
import { QUERY_KEYS } from '@/lib/constants'
import { saveTrainerSalary, saveTrainerDocs } from '@/lib/service-types'

const schema = z.object({
  first_name:      z.string().min(1, 'Required'),
  last_name:       z.string().min(1, 'Required'),
  phone:           z.string().optional(),
  email:           z.string().email('Invalid email'),
  password:        z.string().min(8, 'Minimum 8 characters'),
  date_of_birth:   z.string().optional(),
  city:            z.string().optional(),
  secondary_phone: z.string().optional(),
  address:         z.string().optional(),
  facility_id:     z.coerce.number().min(1, 'Required'),
  bio:             z.string().optional(),
  experience_years:    z.coerce.number().min(0).max(50),
  hourly_rate:         z.coerce.number().min(0),
  max_clients_per_day: z.coerce.number().min(1).max(100),
  specializations: z.array(z.string()),
  certifications:  z.array(z.string()),
  pan_number:      z.string().optional(),
  aadhar_number:   z.string().optional(),
})

type FormValues = z.infer<typeof schema>

// ── Password strength ─────────────────────────────────────────────────────────

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: '', color: '' }
  let score = 0
  if (pw.length >= 8)  score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 1) return { score, label: 'Weak',   color: 'bg-red-500' }
  if (score <= 2) return { score, label: 'Fair',   color: 'bg-orange-400' }
  if (score <= 3) return { score, label: 'Good',   color: 'bg-yellow-400' }
  if (score <= 4) return { score, label: 'Strong', color: 'bg-green-500' }
  return { score, label: 'Very strong', color: 'bg-emerald-500' }
}

// ── TagInput ──────────────────────────────────────────────────────────────────

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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TrainerNewPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showPassword, setShowPassword] = useState(false)

  const { data: facilitiesData } = useQuery({
    queryKey: QUERY_KEYS.facilities,
    queryFn: () => facilitiesApi.list(),
  })
  const facilities = facilitiesData?.facilities ?? []

  const { register, control, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: '', last_name: '', phone: '', email: '', password: '',
      date_of_birth: '', city: '', secondary_phone: '', address: '',
      facility_id: 0, bio: '', experience_years: 0, hourly_rate: 0,
      max_clients_per_day: 10, specializations: [], certifications: [],
      pan_number: '', aadhar_number: '',
    },
  })

  const passwordValue = watch('password')
  const strength = passwordStrength(passwordValue ?? '')

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const result = await trainersApi.create(data as Record<string, unknown>)
      const newId = (result as any)?.trainer?.id ?? (result as any)?.id
      if (newId) {
        saveTrainerSalary(newId, data.hourly_rate)
        saveTrainerDocs(newId, { pan_number: data.pan_number, aadhar_number: data.aadhar_number })
      }
      return result
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.trainers })
      toast.success('Trainer created successfully')
      navigate('/trainers')
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to create trainer'),
  })

  const selectClass = 'w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" title="Back" onClick={() => navigate('/trainers')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Add New Trainer</h1>
          <p className="text-sm text-muted-foreground">Fill in the details to create a new trainer account</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="space-y-5">

        {/* Personal Information */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Row 1: First Name | Last Name | Phone */}
            <div className="grid grid-cols-3 gap-4">
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
                <Label>Phone</Label>
                <Input {...register('phone')} placeholder="+91 98765 43210" />
              </div>
            </div>

            {/* Row 2: Email | Password */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Email <span className="text-destructive">*</span></Label>
                <Input {...register('email')} type="email" placeholder="trainer@gym.com" />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Password <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Input {...register('password')} type={showPassword ? 'text' : 'password'}
                    placeholder="Minimum 8 characters" className="pr-10" />
                  <button type="button" tabIndex={-1}
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {/* Strength bar */}
                {passwordValue && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= strength.score ? strength.color : 'bg-muted'}`} />
                      ))}
                    </div>
                    <p className={`text-xs font-medium ${strength.score <= 1 ? 'text-red-500' : strength.score <= 2 ? 'text-orange-500' : strength.score <= 3 ? 'text-yellow-600' : 'text-green-600'}`}>
                      {strength.label}
                    </p>
                  </div>
                )}
                {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
              </div>
            </div>

            {/* Row 3: DOB | City | Secondary Phone */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Date of Birth</Label>
                <Input {...register('date_of_birth')} type="date" />
              </div>
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input {...register('city')} placeholder="Mumbai" />
              </div>
              <div className="space-y-1.5">
                <Label>Secondary Phone</Label>
                <Input {...register('secondary_phone')} placeholder="+91 98765 43210" />
              </div>
            </div>

            {/* Row 4: Address */}
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Textarea {...register('address')} placeholder="Street, area, landmark…" rows={2} />
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
                <Label>Facility <span className="text-destructive">*</span></Label>
                <select {...register('facility_id')} className={selectClass}>
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
          <Button type="button" variant="outline" onClick={() => navigate('/trainers')}>
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating…' : 'Create Trainer'}
          </Button>
        </div>
      </form>
    </div>
  )
}
