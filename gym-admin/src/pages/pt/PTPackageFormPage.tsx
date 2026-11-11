import { useEffect } from 'react'
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
import { Card, CardContent } from '@/components/ui/card'
import { ptApi } from '@/api/pt.api'
import { getPackageDuration, savePackageDuration } from '@/lib/service-types'

const PT_CATEGORIES = ['Personal Training', 'Pilates', 'Yoga', 'Nutrition', 'HIIT', 'Dance', 'CrossFit', 'Zumba', 'Other']

const schema = z.object({
  name: z.string().min(1, 'Package name is required'),
  description: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  sessions: z.coerce.number().int().min(1, 'Sessions must be at least 1'),
  validity_days: z.coerce.number().int().min(1, 'Validity must be at least 1 day'),
  duration_minutes: z.coerce.number().int().min(1, 'Duration must be at least 1 min'),
  price: z.coerce.number().min(0, 'Price must be ≥ 0'),
  gym_pct: z.coerce.number().min(0).max(100),
})

type FormValues = z.infer<typeof schema>

export default function PTPackageFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const pkgId = id ? Number(id) : undefined
  const isEdit = !!pkgId
  const qc = useQueryClient()

  const { data: pkgsData, isLoading } = useQuery({
    queryKey: ['billing', 'pt-packages'],
    queryFn: () => ptApi.listPackages(),
    enabled: isEdit,
  })

  const pkg = isEdit
    ? (pkgsData as any)?.pt_packages?.find((p: any) => p.id === pkgId)
    : undefined

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { validity_days: 90, duration_minutes: 60, price: 0, category: 'Personal Training', gym_pct: 60 },
  })

  useEffect(() => {
    if (pkg) {
      reset({
        name: pkg.name ?? '',
        description: pkg.description ?? '',
        category: pkg.category ?? 'Personal Training',
        sessions: pkg.sessions,
        validity_days: pkg.validity_days,
        duration_minutes: getPackageDuration(pkgId!),
        price: pkg.price,
        gym_pct: pkg.gym_pct ?? 60,
      })
    }
  }, [pkg, reset, pkgId])

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => ptApi.createPackage(data),
    onSuccess: (res: any, data) => {
      const newId = (res as any)?.id ?? (res as any)?.data?.id
      if (newId) savePackageDuration(newId, data.duration_minutes)
      qc.invalidateQueries({ queryKey: ['billing', 'pt-packages'] })
      toast.success('PT package created')
      navigate('/pt/packages')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to create package'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) => ptApi.updatePackage(pkgId!, data),
    onSuccess: (_res, data) => {
      savePackageDuration(pkgId!, data.duration_minutes)
      qc.invalidateQueries({ queryKey: ['billing', 'pt-packages'] })
      toast.success('PT package updated')
      navigate('/pt/packages')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to update package'),
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  const onSubmit = (data: FormValues) => {
    if (isEdit) updateMutation.mutate(data)
    else createMutation.mutate(data)
  }

  if (isEdit && isLoading) {
    return <div className="max-w-lg mx-auto py-10 text-sm text-muted-foreground">Loading package…</div>
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" title="Back" onClick={() => navigate('/pt/packages')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{isEdit ? 'Edit PT Package' : 'Create PT Package'}</h1>
          <p className="text-sm text-muted-foreground">
            {isEdit ? 'Update package details' : 'Add a new personal training session package'}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Package Name <span className="text-destructive">*</span></Label>
              <Input {...register('name')} placeholder="10 Session Pack" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input {...register('description')} placeholder="Includes goal-setting consultation" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Category <span className="text-destructive">*</span></Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...register('category')}
                >
                  {PT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Gym Revenue % <span className="text-destructive">*</span></Label>
                <Input type="number" min="0" max="100" step="1" {...register('gym_pct')} placeholder="60" />
                <p className="text-xs text-muted-foreground">Gym keeps this %, trainer earns the rest</p>
                {errors.gym_pct && <p className="text-xs text-destructive">{errors.gym_pct.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Sessions <span className="text-destructive">*</span></Label>
                <Input type="number" min="1" {...register('sessions')} placeholder="10" />
                {errors.sessions && <p className="text-xs text-destructive">{errors.sessions.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Price (₹) <span className="text-destructive">*</span></Label>
                <Input type="number" min="0" step="0.01" {...register('price')} placeholder="5000" />
                {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Validity (days)</Label>
                <Input type="number" min="1" {...register('validity_days')} placeholder="90" />
                {errors.validity_days && <p className="text-xs text-destructive">{errors.validity_days.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Session Duration (min) <span className="text-destructive">*</span></Label>
                <Input type="number" min="1" {...register('duration_minutes')} placeholder="60" />
                {errors.duration_minutes && <p className="text-xs text-destructive">{errors.duration_minutes.message}</p>}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate('/pt/packages')}>Cancel</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save Changes' : 'Create Package')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
