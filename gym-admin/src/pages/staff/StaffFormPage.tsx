import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Dumbbell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { staffApi } from '@/api/staff.api'

const DEPARTMENTS = ['Reception', 'Accounts', 'HR', 'Housekeeping', 'Security', 'Maintenance', 'Marketing', 'IT', 'Management', 'Other']
const EMPLOYMENT_TYPES: Record<string, string> = { full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract', intern: 'Intern' }
const STAFF_STATUSES: Record<string, string> = { active: 'Active', inactive: 'Inactive', on_leave: 'On Leave', resigned: 'Resigned' }
const STAFF_ROLES: Record<string, string> = { trainer: 'Trainer', receptionist: 'Receptionist', manager: 'Manager', other: 'Other' }

const schema = z.object({
  role:                     z.enum(['trainer', 'receptionist', 'manager', 'other']).default('other'),
  first_name:               z.string().min(1, 'Required'),
  last_name:                z.string().min(1, 'Required'),
  email:                    z.string().email('Invalid email'),
  phone:                    z.string().min(10, 'Enter at least 10 digits'),
  secondary_phone:          z.string().optional(),
  date_of_birth:            z.string().optional(),
  gender:                   z.enum(['male', 'female', 'other', '']).optional(),
  address:                  z.string().optional(),
  emergency_contact_name:   z.string().optional(),
  emergency_contact_phone:  z.string().optional(),
  department:               z.string().min(1, 'Required'),
  designation:              z.string().min(1, 'Required'),
  employment_type:          z.enum(['full_time', 'part_time', 'contract', 'intern']),
  date_of_joining:          z.string().min(1, 'Required'),
  reporting_to:             z.string().optional(),
  salary:                   z.coerce.number().min(0, 'Required'),
  status:                   z.enum(['active', 'inactive', 'on_leave', 'resigned']).optional(),
  pan_number:               z.string().optional(),
  aadhar_number:            z.string().optional(),
  notes:                    z.string().optional(),
  // Trainer-specific fields
  trainer_bio:              z.string().optional(),
  trainer_experience_years: z.coerce.number().min(0).max(50).optional(),
  trainer_hourly_rate:      z.coerce.number().min(0).optional(),
  trainer_max_clients:      z.coerce.number().min(1).max(100).optional(),
  trainer_password:         z.string().optional(),
  // Manager/receptionist login account
  app_password:             z.string().optional(),
})

type FormValues = z.infer<typeof schema>

const selectClass = 'w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

export default function StaffFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const isEdit = !!id && id !== 'new'

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['staff', id],
    queryFn: () => staffApi.getById(Number(id)),
    enabled: isEdit,
  })

  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      role: 'other', first_name: '', last_name: '', email: '', phone: '', secondary_phone: '',
      date_of_birth: '', gender: '' as any, address: '',
      emergency_contact_name: '', emergency_contact_phone: '',
      department: '', designation: '', employment_type: 'full_time',
      date_of_joining: '', reporting_to: '', salary: 0,
      status: 'active', pan_number: '', aadhar_number: '', notes: '',
      trainer_bio: '', trainer_experience_years: 0, trainer_hourly_rate: 0,
      trainer_max_clients: 10, trainer_password: '', app_password: '',
    },
  })

  const watchedRole = useWatch({ control, name: 'role' })
  const isTrainer = watchedRole === 'trainer'
  const isManagerOrReception = watchedRole === 'manager' || watchedRole === 'receptionist'

  useEffect(() => {
    if (existing) {
      const tp = existing.trainer_profile
      reset({
        role:                    (existing.role ?? 'other') as FormValues['role'],
        first_name:              existing.first_name,
        last_name:               existing.last_name,
        email:                   existing.email,
        phone:                   existing.phone,
        secondary_phone:         existing.secondary_phone ?? '',
        date_of_birth:           existing.date_of_birth?.slice(0, 10) ?? '',
        gender:                  (existing.gender ?? '') as any,
        address:                 existing.address ?? '',
        emergency_contact_name:  existing.emergency_contact_name ?? '',
        emergency_contact_phone: existing.emergency_contact_phone ?? '',
        department:              existing.department,
        designation:             existing.designation,
        employment_type:         existing.employment_type as FormValues['employment_type'],
        date_of_joining:         existing.date_of_joining?.slice(0, 10),
        reporting_to:            existing.reporting_to ?? '',
        salary:                  existing.salary,
        status:                  existing.status as FormValues['status'],
        pan_number:              existing.pan_number ?? '',
        aadhar_number:           existing.aadhar_number ?? '',
        notes:                   existing.notes ?? '',
        trainer_bio:             tp?.bio ?? '',
        trainer_experience_years: tp?.experience_years ?? 0,
        trainer_hourly_rate:     tp?.hourly_rate ?? 0,
        trainer_max_clients:     tp?.max_clients_per_day ?? 10,
      })
    }
  }, [existing, reset])

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => staffApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] })
      toast.success('Staff member added')
      navigate('/staff')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => staffApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] })
      toast.success('Staff member updated')
      navigate('/staff')
    },
  })

  if (isEdit && loadingExisting) {
    return <div className="text-center py-14 text-muted-foreground">Loading…</div>
  }

  const onSubmit = (data: FormValues) => {
    const { trainer_bio, trainer_experience_years, trainer_hourly_rate, trainer_max_clients, trainer_password, app_password, ...rest } = data
    const payload: Record<string, unknown> = {
      ...rest,
      gender: data.gender || undefined,
      status: data.status ?? 'active',
    }

    if (data.role === 'trainer') {
      payload.trainer_profile = {
        bio: trainer_bio,
        experience_years: trainer_experience_years,
        hourly_rate: trainer_hourly_rate,
        max_clients_per_day: trainer_max_clients,
        ...((!isEdit && trainer_password) ? { password: trainer_password } : {}),
      }
    }

    if (!isEdit && (data.role === 'manager' || data.role === 'receptionist') && app_password) {
      payload.app_password = app_password
    }

    if (isEdit && id) {
      updateMutation.mutate({ id: Number(id), data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const name = existing ? `${existing.first_name} ${existing.last_name}` : ''

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" title="Back" onClick={() => navigate('/staff')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{isEdit ? 'Edit Staff Member' : 'Add Staff Member'}</h1>
          {isEdit && <p className="text-sm text-muted-foreground">{name}</p>}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

        {/* ── Personal Information ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Row 1: First Name | Last Name | Gender */}
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
                <Label>Gender</Label>
                <select {...register('gender')} className={selectClass}>
                  <option value="">Select…</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            {/* Row 2: Email | Primary Phone | Secondary Phone | Date of Birth */}
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label>Email <span className="text-destructive">*</span></Label>
                <Input {...register('email')} type="email" placeholder="staff@gym.com" />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Primary Phone <span className="text-destructive">*</span></Label>
                <Input {...register('phone')} placeholder="+91 98765 43210" />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Secondary Phone</Label>
                <Input {...register('secondary_phone')} placeholder="+91 98765 43210" />
              </div>
              <div className="space-y-1.5">
                <Label>Date of Birth</Label>
                <Input {...register('date_of_birth')} type="date" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Textarea {...register('address')} placeholder="Full address…" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Emergency Contact Name</Label>
                <Input {...register('emergency_contact_name')} placeholder="Contact name" />
              </div>
              <div className="space-y-1.5">
                <Label>Emergency Contact Phone</Label>
                <Input {...register('emergency_contact_phone')} placeholder="+91 98765 43210" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Employment Details ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Employment Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Role row */}
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label>Role <span className="text-destructive">*</span></Label>
                <select {...register('role')} className={selectClass}>
                  {Object.entries(STAFF_ROLES).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Department <span className="text-destructive">*</span></Label>
                <select {...register('department')} className={selectClass}>
                  <option value="">Select…</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                {errors.department && <p className="text-xs text-destructive">{errors.department.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Designation <span className="text-destructive">*</span></Label>
                <Input {...register('designation')} placeholder="e.g. Receptionist" />
                {errors.designation && <p className="text-xs text-destructive">{errors.designation.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Employment Type <span className="text-destructive">*</span></Label>
                <select {...register('employment_type')} className={selectClass}>
                  {Object.entries(EMPLOYMENT_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Date of Joining <span className="text-destructive">*</span></Label>
                <Input {...register('date_of_joining')} type="date" />
                {errors.date_of_joining && <p className="text-xs text-destructive">{errors.date_of_joining.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Reporting To</Label>
                <Input {...register('reporting_to')} placeholder="Manager name" />
              </div>
              <div className="space-y-1.5">
                <Label>Salary (₹/mo) <span className="text-destructive">*</span></Label>
                <Input {...register('salary')} type="number" min={0} step={500} placeholder="0" />
                {errors.salary && <p className="text-xs text-destructive">{errors.salary.message}</p>}
              </div>
            </div>
            {isEdit && (
              <div className="space-y-1.5 max-w-xs">
                <Label>Status</Label>
                <select {...register('status')} className={selectClass}>
                  {Object.entries(STAFF_STATUSES).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── ID & Documents ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              ID &amp; Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>PAN Number</Label>
                <Input {...register('pan_number')} placeholder="ABCDE1234F" className="uppercase" />
              </div>
              <div className="space-y-1.5">
                <Label>Aadhar Number</Label>
                <Input {...register('aadhar_number')} placeholder="XXXX XXXX XXXX" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea {...register('notes')} placeholder="Any additional notes…" rows={3} />
            </div>
          </CardContent>
        </Card>

        {/* ── System Login (manager / receptionist only, on create) ── */}
        {!isEdit && isManagerOrReception && (
          <Card className="border-cyan-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-[#007a99] uppercase tracking-wide">
                System Login (optional)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Set a password to give this {watchedRole === 'manager' ? 'manager' : 'receptionist'} access to the admin system.
                Leave blank if they won't need to log in.
              </p>
              <div className="space-y-1.5 max-w-sm">
                <Label>App Password</Label>
                <Input {...register('app_password')} type="password" placeholder="Min 4 characters" />
                <p className="text-xs text-muted-foreground">They will log in with their email + this password.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Trainer Profile (only shown when role=trainer) ── */}
        {isTrainer && (
          <Card className="border-violet-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-violet-700 uppercase tracking-wide flex items-center gap-2">
                <Dumbbell className="h-4 w-4" /> Trainer Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Bio</Label>
                <Textarea {...register('trainer_bio')} placeholder="Brief trainer bio…" rows={3} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Experience (years)</Label>
                  <Input {...register('trainer_experience_years')} type="number" min={0} max={50} placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label>Hourly Rate (₹)</Label>
                  <Input {...register('trainer_hourly_rate')} type="number" min={0} step={50} placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label>Max Clients / Day</Label>
                  <Input {...register('trainer_max_clients')} type="number" min={1} max={100} placeholder="10" />
                </div>
              </div>
              {!isEdit && (
                <div className="space-y-1.5 max-w-sm">
                  <Label>App Password <span className="text-destructive">*</span></Label>
                  <Input {...register('trainer_password')} type="password" placeholder="Min 8 chars, uppercase, number, special" />
                  <p className="text-xs text-muted-foreground">The trainer will use their email + this password to log in.</p>
                  {errors.trainer_password && <p className="text-xs text-destructive">{errors.trainer_password.message}</p>}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate('/staff')}>
            Cancel
          </Button>
          <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
            {isEdit ? 'Save Changes' : 'Add Staff Member'}
          </Button>
        </div>
      </form>
    </div>
  )
}
