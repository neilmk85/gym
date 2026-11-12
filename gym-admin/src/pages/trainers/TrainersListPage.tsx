import { useState, useEffect, useRef, KeyboardEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SearchInput } from '@/components/shared/SearchInput'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { trainersApi } from '@/api/trainers.api'
import { facilitiesApi } from '@/api/facilities.api'
import { QUERY_KEYS } from '@/lib/constants'
import { formatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import type { TrainerProfile } from '@/types/trainer.types'
import { Plus, Pencil, UserX, X, Users2 } from 'lucide-react'
import { loadTrainerSalaries } from '@/lib/service-types'

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const createSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email'),
  phone: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  facility_id: z.coerce.number().min(1, 'Facility is required'),
  bio: z.string().optional(),
  experience_years: z.coerce.number().min(0).max(50),
  hourly_rate: z.coerce.number().min(0), // stored as hourly_rate in backend, displayed as salary
  max_clients_per_day: z.coerce.number().min(1).max(100),
  specializations: z.array(z.string()),
  certifications: z.array(z.string()),
})

const editSchema = z.object({
  facility_id: z.coerce.number().min(1, 'Facility is required').optional(),
  bio: z.string().optional(),
  experience_years: z.coerce.number().min(0).max(50).optional(),
  hourly_rate: z.coerce.number().min(0).optional(),
  max_clients_per_day: z.coerce.number().min(1).max(100).optional(),
  specializations: z.array(z.string()),
  certifications: z.array(z.string()),
})

type CreateFormValues = z.infer<typeof createSchema>
type EditFormValues = z.infer<typeof editSchema>

// ─── TagInput Component ──────────────────────────────────────────────────────

function TagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
}) {
  const [inputVal, setInputVal] = useState('')

  const addTag = () => {
    const tag = inputVal.trim()
    if (tag && !value.includes(tag)) {
      onChange([...value, tag])
    }
    setInputVal('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag()
    } else if (e.key === 'Backspace' && !inputVal && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addTag}
          placeholder={placeholder ?? 'Type and press Enter'}
          className="flex-1"
        />
        <Button type="button" variant="outline" size="sm" onClick={addTag}>
          Add
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs gap-1">
              {tag}
              <button
                type="button"
                onClick={() => onChange(value.filter((t) => t !== tag))}
                className="ml-0.5 hover:text-destructive"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Trainer Form ────────────────────────────────────────────────────────────

function TrainerForm({
  mode,
  trainer,
  onSuccess,
}: {
  mode: 'create' | 'edit'
  trainer?: TrainerProfile
  onSuccess: () => void
}) {
  const queryClient = useQueryClient()

  const { data: facilitiesData } = useQuery({
    queryKey: QUERY_KEYS.facilities,
    queryFn: () => facilitiesApi.list(),
  })
  const facilities = facilitiesData?.facilities ?? []

  // Create form
  const createForm = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      password: '',
      facility_id: facilities[0]?.id ?? 0,
      bio: '',
      experience_years: 0,
      hourly_rate: 0,
      max_clients_per_day: 10,
      specializations: [],
      certifications: [],
    },
  })

  // Edit form
  const editForm = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      facility_id: trainer?.facility_id,
      bio: trainer?.bio ?? '',
      experience_years: trainer?.experience_years ?? 0,
      hourly_rate: trainer?.hourly_rate ?? 0,
      max_clients_per_day: trainer?.max_clients_per_day ?? 10,
      specializations: trainer?.specializations ?? [],
      certifications: trainer?.certifications ?? [],
    },
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateFormValues) => trainersApi.create(data as Record<string, unknown>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.trainers })
      toast.success('Trainer created successfully')
      onSuccess()
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to create trainer'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: EditFormValues) =>
      trainersApi.update(trainer!.id, data as Record<string, unknown>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.trainers })
      if (trainer) queryClient.invalidateQueries({ queryKey: QUERY_KEYS.trainer(trainer.id) })
      toast.success('Trainer updated successfully')
      onSuccess()
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to update trainer'),
  })

  if (mode === 'create') {
    const { register, control, handleSubmit, formState: { errors } } = createForm
    return (
      <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>First Name *</Label>
            <Input {...register('first_name')} placeholder="John" />
            {errors.first_name && <p className="text-xs text-destructive">{errors.first_name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Last Name *</Label>
            <Input {...register('last_name')} placeholder="Doe" />
            {errors.last_name && <p className="text-xs text-destructive">{errors.last_name.message}</p>}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Email *</Label>
          <Input {...register('email')} type="email" placeholder="trainer@gym.com" />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input {...register('phone')} placeholder="+1 555 0100" />
          </div>
          <div className="space-y-1.5">
            <Label>Password *</Label>
            <Input {...register('password')} type="password" placeholder="Min 8 chars" />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Facility *</Label>
          <Select {...register('facility_id')} className="w-full">
            <option value="">Select facility…</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </Select>
          {errors.facility_id && <p className="text-xs text-destructive">{errors.facility_id.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label>Bio</Label>
          <Textarea {...register('bio')} placeholder="Short trainer bio…" rows={3} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Experience (yrs)</Label>
            <Input {...register('experience_years')} type="number" min={0} />
            {errors.experience_years && <p className="text-xs text-destructive">{errors.experience_years.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Salary (₹)</Label>
            <Input {...register('hourly_rate')} type="number" min={0} step="1" />
            {errors.hourly_rate && <p className="text-xs text-destructive">{errors.hourly_rate.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Max Clients/Day</Label>
            <Input {...register('max_clients_per_day')} type="number" min={1} />
            {errors.max_clients_per_day && <p className="text-xs text-destructive">{errors.max_clients_per_day.message}</p>}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Specializations</Label>
          <Controller
            control={control}
            name="specializations"
            render={({ field }) => (
              <TagInput
                value={field.value}
                onChange={field.onChange}
                placeholder="e.g. Yoga, CrossFit…"
              />
            )}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Certifications</Label>
          <Controller
            control={control}
            name="certifications"
            render={({ field }) => (
              <TagInput
                value={field.value}
                onChange={field.onChange}
                placeholder="e.g. ACE CPT, NASM…"
              />
            )}
          />
        </div>

        <Button type="submit" className="w-full" loading={createMutation.isPending}>
          Create Trainer
        </Button>
      </form>
    )
  }

  // Edit mode
  const { register, control, handleSubmit, formState: { errors } } = editForm
  return (
    <form onSubmit={handleSubmit((d) => updateMutation.mutate(d))} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Facility</Label>
        <Select {...register('facility_id')} className="w-full">
          <option value="">Select facility…</option>
          {facilities.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </Select>
        {errors.facility_id && <p className="text-xs text-destructive">{errors.facility_id.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label>Bio</Label>
        <Textarea {...register('bio')} placeholder="Short trainer bio…" rows={3} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Experience (yrs)</Label>
          <Input {...register('experience_years')} type="number" min={0} />
          {errors.experience_years && <p className="text-xs text-destructive">{errors.experience_years.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Salary (₹)</Label>
          <Input {...register('hourly_rate')} type="number" min={0} step="1" />
          {errors.hourly_rate && <p className="text-xs text-destructive">{errors.hourly_rate.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Max Clients/Day</Label>
          <Input {...register('max_clients_per_day')} type="number" min={1} />
          {errors.max_clients_per_day && <p className="text-xs text-destructive">{errors.max_clients_per_day.message}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Specializations</Label>
        <Controller
          control={control}
          name="specializations"
          render={({ field }) => (
            <TagInput
              value={field.value}
              onChange={field.onChange}
              placeholder="e.g. Yoga, CrossFit…"
            />
          )}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Certifications</Label>
        <Controller
          control={control}
          name="certifications"
          render={({ field }) => (
            <TagInput
              value={field.value}
              onChange={field.onChange}
              placeholder="e.g. ACE CPT, NASM…"
            />
          )}
        />
      </div>

      <Button type="submit" className="w-full" loading={updateMutation.isPending}>
        Save Changes
      </Button>
    </form>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function TrainersListPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const isAdmin = user?.role === 'admin'
  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager'

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [deactivateTarget, setDeactivateTarget] = useState<TrainerProfile | null>(null)
  const [trainerSalaries, setTrainerSalaries] = useState<Record<string, number>>({})
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setTrainerSalaries(loadTrainerSalaries())
  }, [])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setDebouncedSearch(search), 350)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [search])

  const { data, isLoading, isError } = useQuery({
    queryKey: QUERY_KEYS.trainers,
    queryFn: () => trainersApi.list(),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => trainersApi.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.trainers })
      toast.success('Trainer deactivated')
      setDeactivateTarget(null)
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to deactivate trainer'),
  })

  const allTrainers: TrainerProfile[] = data?.trainers ?? []

  // Client-side filter
  const trainers = allTrainers.filter((t) => {
    const fullName = `${t.user?.first_name ?? ''} ${t.user?.last_name ?? ''}`.toLowerCase()
    const email = (t.user?.email ?? '').toLowerCase()
    const q = debouncedSearch.toLowerCase()
    const matchesSearch = !q || fullName.includes(q) || email.includes(q)
    const matchesStatus =
      activeFilter === 'all' ||
      (activeFilter === 'active' && t.is_active) ||
      (activeFilter === 'inactive' && !t.is_active)
    return matchesSearch && matchesStatus
  })

  const openCreate = () => navigate('/trainers/new')

  const openEdit = (t: TrainerProfile, e: React.MouseEvent) => {
    e.stopPropagation()
    navigate(`/trainers/${t.id}/edit`)
  }

  const openDeactivate = (t: TrainerProfile, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeactivateTarget(t)
  }

  return (
    <div className="space-y-6">

      {/* ── Edge-to-edge header ── */}
      <div className="relative overflow-hidden -mx-6 -mt-6 bg-gradient-to-r from-teal-600 via-cyan-600 to-sky-600 px-6 py-6 text-white">
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Users2 className="w-6 h-6 opacity-90" />
              <h1 className="text-xl font-bold">Trainers</h1>
            </div>
            <p className="text-sm text-white/80 max-w-2xl">
              Manage your gym's trainers — their specializations, salary, and availability.
            </p>
          </div>
          {isAdminOrManager && (
            <Button
              size="sm"
              className="shrink-0 bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm"
              onClick={openCreate}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Trainer
            </Button>
          )}
        </div>
        <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute -right-2 -bottom-8 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
      </div>

      {isError && (
        <p className="text-sm text-destructive">Failed to load trainers. Please try again.</p>
      )}

      {/* ── Table card ── */}
      <Card className="shadow-lg shadow-gray-200/80 rounded-xl overflow-hidden">
        {/* Search + filter bar */}
        <div className="flex items-center justify-between gap-4 px-4 py-3 border-b bg-teal-50/60">
          <p className="font-medium text-sm text-teal-700 whitespace-nowrap flex items-center gap-1.5">
            <Users2 className="w-4 h-4" />
            {isLoading ? 'Loading…' : `${trainers.length} trainer${trainers.length !== 1 ? 's' : ''}`}
          </p>
          <div className="flex items-center gap-2 flex-1 justify-end">
            <SearchInput
              placeholder="Search by name or email…"
              value={search}
              onChange={setSearch}
              className="w-64"
            />
            <div className="flex gap-1">
              {(['all', 'active', 'inactive'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all ${
                    activeFilter === f
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'bg-white text-muted-foreground border border-gray-200 hover:border-teal-300'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gradient-to-r from-teal-50 via-cyan-50 to-sky-50">
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Trainer</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Specializations</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Experience</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Salary</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Max / Day</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Status</th>
                {isAdminOrManager && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {[1,2,3,4,5,6,7].map(c => (
                      <td key={c} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              )}
              {!isLoading && trainers.length === 0 && (
                <tr>
                  <td colSpan={isAdminOrManager ? 7 : 6} className="px-4 py-14 text-center">
                    <Users2 className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-muted-foreground text-sm font-medium">
                      {debouncedSearch || activeFilter !== 'all' ? 'No trainers match your filters' : 'No trainers yet'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {debouncedSearch || activeFilter !== 'all' ? 'Try adjusting your search or filter.' : 'Click "Add Trainer" to get started.'}
                    </p>
                  </td>
                </tr>
              )}
              {!isLoading && trainers.map((t) => {
                const firstName = t.user?.first_name ?? '?'
                const lastName  = t.user?.last_name  ?? '?'
                const initials  = `${firstName[0]}${lastName[0]}`
                return (
                  <tr
                    key={t.id}
                    className="hover:bg-teal-50/40 cursor-pointer transition-colors"
                    onClick={() => navigate(`/trainers/${t.id}`)}
                  >
                    {/* Name + email */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br from-teal-500 to-cyan-600">
                          {initials}
                        </div>
                        <div>
                          <p className="font-medium leading-tight">{firstName} {lastName}</p>
                          {t.user?.phone && <p className="text-xs text-muted-foreground">{t.user.phone}</p>}
                        </div>
                      </div>
                    </td>

                    {/* Specializations */}
                    <td className="px-4 py-3">
                      {t.specializations && t.specializations.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {t.specializations.slice(0, 3).map(s => (
                            <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                          ))}
                          {t.specializations.length > 3 && (
                            <Badge variant="outline" className="text-xs">+{t.specializations.length - 3}</Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Experience */}
                    <td className="px-4 py-3 text-muted-foreground">
                      {t.experience_years ?? 0} yr{(t.experience_years ?? 0) !== 1 ? 's' : ''}
                    </td>

                    {/* Salary */}
                    <td className="px-4 py-3 font-medium">
                      {formatCurrency(trainerSalaries[String(t.id)] ?? t.hourly_rate ?? 0)}
                      <span className="text-xs text-muted-foreground font-normal">/mo</span>
                    </td>

                    {/* Max clients/day */}
                    <td className="px-4 py-3 text-muted-foreground">
                      {t.max_clients_per_day ?? '—'}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${
                        t.is_active
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'bg-gray-100 text-gray-500 border border-gray-200'
                      }`}>
                        {t.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {/* Actions */}
                    {isAdminOrManager && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="Edit trainer"
                            onClick={(e) => openEdit(t, e)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {isAdmin && t.is_active && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              title="Deactivate trainer"
                              onClick={(e) => openDeactivate(t, e)}>
                              <UserX className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer count */}
        {!isLoading && allTrainers.length > 0 && (
          <div className="px-4 py-2.5 border-t bg-muted/20 text-xs text-muted-foreground">
            Showing {trainers.length} of {allTrainers.length} trainers
            {' · '}
            {allTrainers.filter(t => t.is_active).length} active
          </div>
        )}
      </Card>

      {/* Deactivate Confirm Modal */}
      <ConfirmModal
        isOpen={deactivateTarget !== null}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={() => deactivateTarget && deactivateMutation.mutate(deactivateTarget.id)}
        title="Deactivate Trainer"
        description={`Are you sure you want to deactivate ${deactivateTarget?.user?.first_name ?? ''} ${deactivateTarget?.user?.last_name ?? ''}? They will no longer be able to take new clients or classes.`}
        confirmLabel="Deactivate"
        variant="destructive"
        isLoading={deactivateMutation.isPending}
      />
    </div>
  )
}
