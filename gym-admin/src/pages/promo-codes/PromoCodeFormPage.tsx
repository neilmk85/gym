import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { promoCodesApi } from '@/api/promo-codes.api'
import { QUERY_KEYS } from '@/lib/constants'

const baseSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  discount_type: z.enum(['percentage', 'fixed']),
  discount_value: z.coerce.number().min(0, 'Value must be ≥ 0'),
  max_uses: z.preprocess(v => (v === '' || v === null || v === undefined ? null : Number(v)), z.number().int().min(0).nullable()),
  max_uses_per_member: z.preprocess(v => (v === '' || v === null || v === undefined ? null : Number(v)), z.number().int().min(0).nullable()),
  valid_from: z.string().optional(),
  valid_until: z.string().optional(),
  applicable_plans: z.array(z.string()).optional().default([]),
})

type FormValues = z.infer<typeof baseSchema>

function TagInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [inputVal, setInputVal] = useState('')
  const addTag = (raw: string) => {
    const tag = raw.trim()
    if (tag && !value.includes(tag)) onChange([...value, tag])
    setInputVal('')
  }
  return (
    <div className="flex flex-wrap gap-1.5 min-h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
      {value.map(tag => (
        <Badge key={tag} variant="secondary" className="flex items-center gap-1 pr-1">
          {tag}
          <button type="button" onClick={() => onChange(value.filter(t => t !== tag))} className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5">
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <input
        className="flex-1 min-w-[120px] bg-transparent outline-none placeholder:text-muted-foreground"
        value={inputVal}
        onChange={e => setInputVal(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(inputVal) }
          else if (e.key === 'Backspace' && inputVal === '' && value.length > 0) onChange(value.slice(0, -1))
        }}
        onBlur={() => { if (inputVal.trim()) addTag(inputVal) }}
        placeholder={value.length === 0 ? 'Type plan ID/name and press Enter' : ''}
      />
    </div>
  )
}

export default function PromoCodeFormPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)

  const { data, isLoading } = useQuery({
    queryKey: [QUERY_KEYS.promoCodes, id],
    queryFn: () => promoCodesApi.getPromoCode(Number(id)),
    enabled: isEdit,
  })
  const promo = (data as any)?.promo_code

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(baseSchema),
    defaultValues: {
      code: '',
      discount_type: 'percentage',
      discount_value: 0,
      max_uses: null,
      max_uses_per_member: null,
      valid_from: '',
      valid_until: '',
      applicable_plans: [],
    },
    values: promo ? {
      code: promo.code ?? '',
      discount_type: promo.discount_type ?? 'percentage',
      discount_value: promo.discount_value ?? 0,
      max_uses: promo.max_uses ?? null,
      max_uses_per_member: promo.max_uses_per_member ?? null,
      valid_from: promo.valid_from ?? '',
      valid_until: promo.valid_until ?? '',
      applicable_plans: promo.applicable_plans ?? [],
    } : undefined,
  })

  const applicablePlans = watch('applicable_plans') ?? []

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => promoCodesApi.createPromoCode({ ...data, code: data.code.toUpperCase() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.promoCodes] })
      toast.success('Promo code created')
      navigate('/promo-codes')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to create promo code'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) => promoCodesApi.updatePromoCode(Number(id), data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.promoCodes] })
      toast.success('Promo code updated')
      navigate('/promo-codes')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to update promo code'),
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
        <Button variant="ghost" size="icon" title="Back" onClick={() => navigate('/promo-codes')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{isEdit ? 'Edit Promo Code' : 'New Promo Code'}</h1>
          <p className="text-sm text-muted-foreground">
            {isEdit ? 'Update promo code details' : 'Create a new promotional discount code'}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit(v => activeMutation.mutate(v))} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Code <span className="text-destructive">*</span></Label>
              <Input {...register('code')} placeholder="SAVE10" className="uppercase" />
              {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Discount Type <span className="text-destructive">*</span></Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" {...register('discount_type')}>
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed (₹)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Discount Value <span className="text-destructive">*</span></Label>
                <Input type="number" min="0" step="0.01" {...register('discount_value')} placeholder="10" />
                {errors.discount_value && <p className="text-xs text-destructive">{errors.discount_value.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Max Uses</Label>
                <Input type="number" min="0" {...register('max_uses')} placeholder="Unlimited" />
              </div>
              <div className="space-y-1.5">
                <Label>Max Uses Per Member</Label>
                <Input type="number" min="0" {...register('max_uses_per_member')} placeholder="Unlimited" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Valid From</Label>
                <Input type="date" {...register('valid_from')} />
              </div>
              <div className="space-y-1.5">
                <Label>Valid Until</Label>
                <Input type="date" {...register('valid_until')} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Applicable Plans</Label>
              <TagInput value={applicablePlans} onChange={v => setValue('applicable_plans', v)} />
              <p className="text-xs text-muted-foreground">Leave empty to apply to all plans</p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate('/promo-codes')}>Cancel</Button>
              <Button type="submit" disabled={activeMutation.isPending}>
                {activeMutation.isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Code'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
