import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, X, Package, Minus, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SearchInput } from '@/components/shared/SearchInput'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { equipmentApi, type Equipment } from '@/api/equipment.api'

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = ['Machine', 'Dumbbell', 'Plate', 'Barbell', 'Kettlebell', 'Bench', 'Cable & Attachment', 'Other'] as const
const CONDITIONS: Record<string, string> = { good: 'Good', fair: 'Fair', needs_repair: 'Needs Repair', retired: 'Retired' }

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  name:          z.string().min(1, 'Required'),
  brand:         z.string().min(1, 'Required'),
  category:      z.string().min(1, 'Required'),
  quantity:      z.coerce.number().min(1, 'At least 1'),
  weight_kg:     z.coerce.number().optional(),
  unit:          z.enum(['pcs', 'pairs', 'kg', 'sets']),
  condition:     z.string().min(1, 'Required'),
  location:      z.string().optional(),
  serial_number: z.string().optional(),
  purchased_at:  z.string().optional(),
  notes:         z.string().optional(),
})

type FormValues = z.infer<typeof schema>

const selectClass = 'w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

const CONDITION_CFG: Record<string, { color: string; icon: React.ReactNode }> = {
  good:         { color: 'bg-green-100 text-green-700 border-green-200',  icon: <CheckCircle2 className="w-3 h-3" /> },
  fair:         { color: 'bg-amber-100 text-amber-700 border-amber-200',  icon: <Minus className="w-3 h-3" /> },
  needs_repair: { color: 'bg-red-100 text-red-600 border-red-200',        icon: <AlertTriangle className="w-3 h-3" /> },
  retired:      { color: 'bg-gray-100 text-gray-500 border-gray-200',     icon: <X className="w-3 h-3" /> },
}

function needsWeight(cat: string) {
  return ['Dumbbell', 'Plate', 'Barbell', 'Kettlebell'].includes(cat)
}

// ── Form drawer ───────────────────────────────────────────────────────────────

function EquipmentForm({
  item,
  onSave,
  onClose,
}: {
  item: Equipment | null
  onSave: () => void
  onClose: () => void
}) {
  const qc = useQueryClient()
  const isEdit = !!item

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: item ? {
      name: item.name, brand: item.brand, category: item.category,
      quantity: item.quantity, weight_kg: item.weight_kg, unit: item.unit as FormValues['unit'],
      condition: item.condition, location: item.location ?? '',
      serial_number: item.serial_number ?? '', purchased_at: item.purchased_at?.slice(0, 10) ?? '',
      notes: item.notes ?? '',
    } : {
      name: '', brand: '', category: 'Machine', quantity: 1, unit: 'pcs',
      condition: 'good', location: '', serial_number: '', purchased_at: '', notes: '',
    },
  })

  const category = watch('category')

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => equipmentApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['equipment'] }); toast.success('Equipment added'); onSave() },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => equipmentApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['equipment'] }); toast.success('Equipment updated'); onSave() },
  })

  const onSubmit = (data: FormValues) => {
    const payload: Record<string, unknown> = {
      ...data,
      weight_kg: data.weight_kg || null,
    }
    if (isEdit && item) {
      updateMutation.mutate({ id: item.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold">{isEdit ? 'Edit Equipment' : 'Add Equipment'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input {...register('name')} placeholder="e.g. Hex Dumbbell 10 kg" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Brand <span className="text-destructive">*</span></Label>
              <Input {...register('brand')} placeholder="e.g. Kore, Rogue" />
              {errors.brand && <p className="text-xs text-destructive">{errors.brand.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category <span className="text-destructive">*</span></Label>
              <select {...register('category')} className={selectClass}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Condition <span className="text-destructive">*</span></Label>
              <select {...register('condition')} className={selectClass}>
                {Object.entries(CONDITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Quantity <span className="text-destructive">*</span></Label>
              <Input type="number" min={1} {...register('quantity')} />
              {errors.quantity && <p className="text-xs text-destructive">{errors.quantity.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <select {...register('unit')} className={selectClass}>
                {(['pcs', 'pairs', 'kg', 'sets'] as const).map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            {needsWeight(category) && (
              <div className="space-y-1.5">
                <Label>Weight (kg)</Label>
                <Input type="number" step="0.5" {...register('weight_kg')} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input {...register('location')} placeholder="e.g. Ground Floor, Zone A" />
            </div>
            <div className="space-y-1.5">
              <Label>Purchase Date</Label>
              <Input type="date" {...register('purchased_at')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Serial / Asset Number</Label>
            <Input {...register('serial_number')} placeholder="Optional serial or asset tag" />
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea {...register('notes')} placeholder="Any maintenance notes or remarks…" rows={2} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={isSubmitting || createMutation.isPending || updateMutation.isPending}>
              {isEdit ? 'Save Changes' : 'Add Equipment'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const qc = useQueryClient()
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [conditionFilter, setConditionFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [formItem, setFormItem] = useState<Equipment | 'new' | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['equipment'],
    queryFn: () => equipmentApi.list({ per_page: 500 }),
  })

  const items = data?.data ?? []

  const deleteMutation = useMutation({
    mutationFn: (id: number) => equipmentApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['equipment'] }); toast.success('Equipment removed') },
  })

  const filtered = useMemo(() => {
    return items.filter(i => {
      const matchCat = categoryFilter === 'all' || i.category === categoryFilter
      const matchCond = conditionFilter === 'all' || i.condition === conditionFilter
      const q = search.toLowerCase()
      const matchSearch = !q || i.name.toLowerCase().includes(q) || i.brand.toLowerCase().includes(q) || (i.location ?? '').toLowerCase().includes(q)
      return matchCat && matchCond && matchSearch
    })
  }, [items, categoryFilter, conditionFilter, search])

  const totalUnits = items.reduce((s, i) => s + i.quantity, 0)
  const needsRepair = items.filter(i => i.condition === 'needs_repair').length
  const categoryCount = new Set(items.map(i => i.category)).size

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return
    deleteMutation.mutate(id)
  }

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="relative overflow-hidden -mx-6 -mt-6 bg-gradient-to-br from-slate-700 via-gray-700 to-zinc-800 text-white">
        <div className="relative px-6 py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold tracking-widest uppercase text-white/55 mb-1.5">Admin</p>
              <div className="flex items-center gap-2.5 mb-1">
                <Package className="w-5 h-5 opacity-80" />
                <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
              </div>
              <p className="text-sm text-white/65">Gym equipment — machines, weights, benches &amp; accessories</p>
            </div>
            <Button onClick={() => setFormItem('new')} className="shrink-0 bg-white text-slate-800 hover:bg-white/90">
              <Plus className="w-4 h-4 mr-1.5" /> Add Equipment
            </Button>
          </div>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/15 border-t border-white/15">
          <div className="px-5 py-4">
            <p className="text-xl font-bold">{items.length}</p>
            <p className="text-xs font-medium text-white/85 mt-1">Equipment Types</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xl font-bold text-emerald-300">{totalUnits}</p>
            <p className="text-xs font-medium text-white/85 mt-1">Total Units</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xl font-bold text-sky-300">{categoryCount}</p>
            <p className="text-xs font-medium text-white/85 mt-1">Categories</p>
          </div>
          <div className="px-5 py-4">
            <p className={`text-xl font-bold ${needsRepair > 0 ? 'text-red-300' : 'text-white'}`}>{needsRepair}</p>
            <p className="text-xs font-medium text-white/85 mt-1">Needs Repair</p>
          </div>
        </div>

        <div className="absolute -right-6 -top-6 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute right-20 -bottom-8 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3">
        <SearchInput
          placeholder="Search by name, brand, location…"
          value={search}
          onChange={setSearch}
          className="w-64"
        />
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={conditionFilter}
          onChange={e => setConditionFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All Conditions</option>
          {Object.entries(CONDITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* ── Table ── */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-sidebar">
                <tr>
                  {['Equipment', 'Brand', 'Category', 'Weight', 'Qty', 'Condition', 'Location', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-light text-sidebar-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-14 text-muted-foreground">Loading…</td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-14 text-muted-foreground">
                      {search || categoryFilter !== 'all' || conditionFilter !== 'all'
                        ? 'No equipment matches your filters.'
                        : 'No equipment added yet. Click "Add Equipment" to get started.'}
                    </td>
                  </tr>
                ) : filtered.map(item => {
                  const condCfg = CONDITION_CFG[item.condition] ?? CONDITION_CFG.good
                  return (
                    <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{item.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.brand}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs">{item.category}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {item.weight_kg ? `${item.weight_kg} kg` : '—'}
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {item.quantity} <span className="text-xs font-normal text-muted-foreground">{item.unit}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${condCfg.color}`}>
                          {condCfg.icon} {CONDITIONS[item.condition] ?? item.condition}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{item.location ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            title="Edit"
                            onClick={() => setFormItem(item)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            title="Delete"
                            onClick={() => handleDelete(item.id, item.name)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="px-4 py-3 border-t text-xs text-muted-foreground">
              Showing {filtered.length} of {items.length} items
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Form modal ── */}
      {formItem !== null && (
        <EquipmentForm
          item={formItem === 'new' ? null : formItem}
          onSave={() => setFormItem(null)}
          onClose={() => setFormItem(null)}
        />
      )}
    </div>
  )
}
