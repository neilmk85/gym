import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, FlaskConical, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { foodsApi } from '@/api/foods.api'
import { QUERY_KEYS } from '@/lib/constants'

const CATEGORIES = ['beverages', 'fats', 'fruits', 'nuts', 'dairy', 'grains', 'protein', 'pulses', 'snacks', 'supplements', 'vegetables'] as const
const UNITS = ['g', 'ml', 'pcs', 'slice', 'tbsp'] as const

const optNum = z.preprocess(
  (v) => { if (v === '' || v === null || v === undefined) return undefined; const n = Number(v); return isNaN(n) ? undefined : n },
  z.number().min(0).optional(),
)

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  category: z.enum(CATEGORIES),
  unit: z.enum(UNITS),
  per_unit: z.coerce.number().positive('Must be a positive number'),
  cal_per: optNum,
  protein_per: optNum,
  carbs_per: optNum,
  fat_per: optNum,
  default_qty: optNum,
})

type FormValues = z.infer<typeof schema>

const OFF_UA = 'GymAdmin/1.0 (admin@gymapp.com)'

async function fetchNutritionFromOFF(name: string): Promise<Partial<FormValues> | null> {
  try {
    const fields = 'product_name,nutriments'
    const url = `https://world.openfoodfacts.org/api/v2/search?search_terms=${encodeURIComponent(name)}&fields=${fields}&page_size=1&sort_by=unique_scans_n`
    const res = await fetch(url, { headers: { 'User-Agent': OFF_UA } })
    if (!res.ok) return null
    const json = await res.json()
    const p = json.products?.[0]
    if (!p) return null
    const nut = p.nutriments ?? {}
    const cal = nut['energy-kcal_100g'] ?? nut['energy_kcal_100g'] ?? 0
    return {
      cal_per: Math.round(cal * 10) / 10,
      protein_per: Math.round(((nut['proteins_100g'] ?? 0) as number) * 10) / 10,
      carbs_per: Math.round(((nut['carbohydrates_100g'] ?? 0) as number) * 10) / 10,
      fat_per: Math.round(((nut['fat_100g'] ?? 0) as number) * 10) / 10,
    }
  } catch {
    return null
  }
}

export default function FoodFormPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const [lookingUp, setLookingUp] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: [QUERY_KEYS.foods, id],
    queryFn: () => foodsApi.getFood(Number(id)),
    enabled: isEdit,
  })
  const food = (data as any)?.food_item

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { category: 'grains', unit: 'g', per_unit: 100, default_qty: 100 },
    values: food ? {
      name: food.name ?? '',
      category: food.category ?? 'grains',
      unit: food.unit ?? 'g',
      per_unit: food.per_unit ?? 100,
      cal_per: food.cal_per,
      protein_per: food.protein_per,
      carbs_per: food.carbs_per,
      fat_per: food.fat_per,
      default_qty: food.default_qty,
    } : undefined,
  })

  const foodName = watch('name')

  const handleLookup = async () => {
    if (!foodName) return
    setLookingUp(true)
    try {
      const result = await fetchNutritionFromOFF(foodName)
      if (result) {
        if (result.cal_per !== undefined) setValue('cal_per', result.cal_per)
        if (result.protein_per !== undefined) setValue('protein_per', result.protein_per)
        if (result.carbs_per !== undefined) setValue('carbs_per', result.carbs_per)
        if (result.fat_per !== undefined) setValue('fat_per', result.fat_per)
        toast.success('Nutrition data fetched from Open Food Facts')
      } else {
        toast.warning('No nutrition data found — enter manually')
      }
    } finally {
      setLookingUp(false)
    }
  }

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => foodsApi.createFood(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.foods] })
      toast.success('Food item added')
      navigate('/foods')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to add food'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) => foodsApi.updateFood(Number(id), data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.foods] })
      toast.success('Food item updated')
      navigate('/foods')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to update food'),
  })

  const activeMutation = isEdit ? updateMutation : createMutation

  if (isEdit && isLoading) return (
    <div className="max-w-lg mx-auto space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  )

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" title="Back" onClick={() => navigate('/foods')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{isEdit ? 'Edit Food Item' : 'Add Food Item'}</h1>
          <p className="text-sm text-muted-foreground">
            {isEdit ? 'Update food item details' : 'Add a food item to the nutrition database'}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit(v => activeMutation.mutate(v))} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name <span className="text-destructive">*</span></Label>
              <div className="flex gap-2">
                <Input {...register('name')} placeholder="e.g. Oats" className="flex-1" />
                {!isEdit && (
                  <Button type="button" variant="outline" size="sm" onClick={handleLookup} disabled={!foodName || lookingUp}>
                    {lookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
                    <span className="ml-1 text-xs">Lookup</span>
                  </Button>
                )}
              </div>
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Category <span className="text-destructive">*</span></Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" {...register('category')}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Unit <span className="text-destructive">*</span></Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" {...register('unit')}>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Per Unit <span className="text-destructive">*</span></Label>
                <Input type="number" min="0.1" step="0.1" {...register('per_unit')} placeholder="100" />
                {errors.per_unit && <p className="text-xs text-destructive">{errors.per_unit.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Calories (per unit)</Label>
                <Input type="number" min="0" step="0.1" {...register('cal_per')} placeholder="389" />
              </div>
              <div className="space-y-1.5">
                <Label>Protein (g)</Label>
                <Input type="number" min="0" step="0.1" {...register('protein_per')} placeholder="17" />
              </div>
              <div className="space-y-1.5">
                <Label>Carbs (g)</Label>
                <Input type="number" min="0" step="0.1" {...register('carbs_per')} placeholder="66" />
              </div>
              <div className="space-y-1.5">
                <Label>Fat (g)</Label>
                <Input type="number" min="0" step="0.1" {...register('fat_per')} placeholder="7" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Default Quantity</Label>
              <Input type="number" min="0" step="0.1" {...register('default_qty')} placeholder="80" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate('/foods')}>Cancel</Button>
              <Button type="submit" disabled={activeMutation.isPending}>
                {activeMutation.isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Food'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
