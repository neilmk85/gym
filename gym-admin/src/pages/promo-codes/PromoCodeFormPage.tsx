import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, X, Tag, Percent, CalendarDays, Users, Layers, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { promoCodesApi } from '@/api/promo-codes.api'
import { QUERY_KEYS } from '@/lib/constants'

const baseSchema = z.object({
  code:                 z.string().min(1, 'Code is required'),
  discount_type:        z.enum(['percentage', 'fixed']),
  discount_value:       z.coerce.number().min(0, 'Value must be ≥ 0'),
  max_uses:             z.preprocess(v => (v === '' || v === null || v === undefined ? null : Number(v)), z.number().int().min(0).nullable()),
  max_uses_per_member:  z.preprocess(v => (v === '' || v === null || v === undefined ? null : Number(v)), z.number().int().min(0).nullable()),
  valid_from:           z.string().optional(),
  valid_until:          z.string().optional(),
  applicable_plans:     z.array(z.string()).optional().default([]),
})

type FormValues = z.infer<typeof baseSchema>

function SectionHead({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-50 border border-purple-200 text-purple-600">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-700 leading-none">{title}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </div>
  )
}

function Field({ label, required, hint, children, error }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode; error?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

function TagInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [inputVal, setInputVal] = useState('')
  const addTag = (raw: string) => {
    const tag = raw.trim()
    if (tag && !value.includes(tag)) onChange([...value, tag])
    setInputVal('')
  }
  return (
    <div className="flex flex-wrap gap-1.5 min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-within:ring-1 focus-within:ring-ring">
      {value.map(tag => (
        <Badge key={tag} variant="secondary" className="flex items-center gap-1 pr-1 bg-purple-100 text-purple-700 hover:bg-purple-100">
          {tag}
          <button type="button" onClick={() => onChange(value.filter(t => t !== tag))}
            className="ml-0.5 rounded-full hover:bg-purple-200 p-0.5">
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
        placeholder={value.length === 0 ? 'Type a plan ID or name and press Enter…' : ''}
      />
    </div>
  )
}

function generateCode(): string {
  const words = ['SAVE', 'GET', 'DEAL', 'FIT', 'GYM', 'OFFER', 'WIN']
  const word = words[Math.floor(Math.random() * words.length)]
  const num = Math.floor(Math.random() * 90 + 10)
  return `${word}${num}`
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
      code:                promo.code                ?? '',
      discount_type:       promo.discount_type       ?? 'percentage',
      discount_value:      promo.discount_value      ?? 0,
      max_uses:            promo.max_uses             ?? null,
      max_uses_per_member: promo.max_uses_per_member ?? null,
      valid_from:          promo.valid_from           ?? '',
      valid_until:         promo.valid_until          ?? '',
      applicable_plans:    promo.applicable_plans    ?? [],
    } : undefined,
  })

  const applicablePlans  = watch('applicable_plans') ?? []
  const discountType     = watch('discount_type')
  const discountValue    = watch('discount_value')
  const activeMutation   = isEdit
    ? useMutation({
        mutationFn: (data: FormValues) => promoCodesApi.updatePromoCode(Number(id), data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: [QUERY_KEYS.promoCodes] }); toast.success('Promo code updated'); navigate('/promo-codes') },
        onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to update promo code'),
      })
    : useMutation({
        mutationFn: (data: FormValues) => promoCodesApi.createPromoCode({ ...data, code: data.code.toUpperCase() }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: [QUERY_KEYS.promoCodes] }); toast.success('Promo code created'); navigate('/promo-codes') },
        onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to create promo code'),
      })

  if (isEdit && isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-96 w-full" />
    </div>
  )

  return (
    <div className="flex flex-col">

      {/* ── Header ── */}
      <div className="shrink-0 -mx-6 -mt-6 px-8 pt-8 pb-6"
        style={{ background: 'linear-gradient(to bottom, #f5f3ff 0%, #ede9fe 35%, #f8f7ff 60%, rgba(255,255,255,0) 100%)' }}>
        <button onClick={() => navigate('/promo-codes')}
          className="mb-3 flex items-center gap-1 text-sm font-medium text-purple-500 hover:text-purple-700 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Promo Codes
        </button>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-purple-500 flex items-center justify-center text-white shadow-sm">
            <Tag className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-[1.75rem] font-black tracking-tight text-[#1a1a2e] leading-tight">
              {isEdit ? 'Edit Promo Code' : 'New Promo Code'}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {isEdit ? 'Update promotional discount code details' : 'Create a discount code for plans and memberships'}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(v => activeMutation.mutate(v))} className="space-y-4 mt-6">

        {/* ── Code & Discount ── */}
        <div className="bg-card border rounded-xl px-6 pt-6 pb-7">
          <SectionHead icon={Percent} title="Code & Discount" description="The promo code and discount it applies" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="col-span-2">
              <Field label="Promo Code" required error={errors.code?.message}
                hint="Will be stored in uppercase — e.g. SAVE20, FIT50">
                <div className="flex gap-2">
                  <Input {...register('code')}
                    placeholder="e.g. SAVE20"
                    className="uppercase font-mono tracking-widest"
                    onChange={e => setValue('code', e.target.value.toUpperCase())} />
                  {!isEdit && (
                    <button type="button" title="Generate random code"
                      onClick={() => setValue('code', generateCode())}
                      className="shrink-0 h-9 w-9 rounded-md border border-input bg-background flex items-center justify-center text-muted-foreground hover:text-purple-600 hover:border-purple-300 transition-colors">
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </Field>
            </div>
            <Field label="Discount Type" required>
              <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                {...register('discount_type')}>
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed (₹)</option>
              </select>
            </Field>
            <Field label={discountType === 'percentage' ? 'Discount (%)' : 'Discount (₹)'}
              required error={errors.discount_value?.message}>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                  {discountType === 'percentage' ? '%' : '₹'}
                </span>
                <Input type="number" min="0" step="0.01" className="pl-7"
                  {...register('discount_value')} placeholder="0" />
              </div>
              {discountType === 'percentage' && Number(discountValue) > 0 && Number(discountValue) <= 100 && (
                <p className="text-xs text-purple-600 font-medium mt-1">{discountValue}% off the plan price</p>
              )}
            </Field>
          </div>
        </div>

        {/* ── Usage Limits ── */}
        <div className="bg-card border rounded-xl px-6 pt-6 pb-7">
          <SectionHead icon={Users} title="Usage Limits" description="How many times can this code be used?" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="col-span-1">
              <Field label="Total Max Uses" hint="Leave blank for unlimited">
                <Input type="number" min="0" {...register('max_uses')} placeholder="Unlimited" />
              </Field>
            </div>
            <div className="col-span-1">
              <Field label="Max Uses Per Member" hint="Leave blank for unlimited">
                <Input type="number" min="0" {...register('max_uses_per_member')} placeholder="Unlimited" />
              </Field>
            </div>
          </div>
        </div>

        {/* ── Validity Period ── */}
        <div className="bg-card border rounded-xl px-6 pt-6 pb-7">
          <SectionHead icon={CalendarDays} title="Validity Period" description="When is this promo code active?" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label="Valid From" hint="Leave blank to start immediately">
              <Input type="date" {...register('valid_from')} />
            </Field>
            <Field label="Valid Until" hint="Leave blank for no expiry">
              <Input type="date" {...register('valid_until')} />
            </Field>
          </div>
        </div>

        {/* ── Applicable Plans ── */}
        <div className="bg-card border rounded-xl px-6 pt-6 pb-7">
          <SectionHead icon={Layers} title="Applicable Plans"
            description="Restrict to specific plans, or leave empty to apply to all plans" />
          <TagInput value={applicablePlans} onChange={v => setValue('applicable_plans', v)} />
          {applicablePlans.length === 0 && (
            <p className="text-xs text-muted-foreground mt-2">No restrictions — applies to all plans</p>
          )}
          {applicablePlans.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Restricted to {applicablePlans.length} plan{applicablePlans.length > 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex justify-end gap-3 py-2">
          <Button type="button" variant="outline" onClick={() => navigate('/promo-codes')}>Cancel</Button>
          <Button type="submit" disabled={activeMutation.isPending}
            className="bg-purple-600 hover:bg-purple-700 text-white min-w-36">
            {activeMutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Code'}
          </Button>
        </div>
      </form>
    </div>
  )
}
