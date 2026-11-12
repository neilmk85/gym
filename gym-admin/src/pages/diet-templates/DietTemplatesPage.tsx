import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Star } from 'lucide-react'

import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/shared/SearchInput'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'

import { dietTemplatesApi } from '@/api/diet-templates.api'
import { useAuthStore } from '@/store/auth.store'

// ─── Types ─────────────────────────────────────────────────────────────────

interface DietTemplate {
  id: number
  name: string
  category: string
  description: string
  total_calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  meal_plan: string
  meal_sections?: string
  tags: string[]
  is_default: boolean
  is_active: boolean
  created_by_id?: number
  created_at: string
}

// ─── Constants ─────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'weight_loss', label: 'Weight Loss' },
  { value: 'muscle_gain', label: 'Muscle Gain' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'keto', label: 'Keto' },
  { value: 'paleo', label: 'Paleo' },
  { value: 'custom', label: 'Custom' },
] as const

const CATEGORY_COLORS: Record<string, string> = {
  weight_loss: 'bg-red-100 text-red-700 border-red-200',
  muscle_gain: 'bg-blue-100 text-blue-700 border-blue-200',
  maintenance: 'bg-green-100 text-green-700 border-green-200',
  vegetarian: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  vegan: 'bg-lime-100 text-lime-700 border-lime-200',
  keto: 'bg-orange-100 text-orange-700 border-orange-200',
  paleo: 'bg-amber-100 text-amber-700 border-amber-200',
  custom: 'bg-purple-100 text-purple-700 border-purple-200',
}

// ─── Template Card ─────────────────────────────────────────────────────────

interface MealSection {
  key: string
  entries: unknown[]
}

interface TemplateCardProps {
  template: DietTemplate
  canEdit: boolean
  canDelete: boolean
  onEdit: (t: DietTemplate) => void
  onDelete: (t: DietTemplate) => void
}

function TemplateCard({ template, canEdit, canDelete, onEdit, onDelete }: TemplateCardProps) {
  const categoryColorClass = CATEGORY_COLORS[template.category] ?? 'bg-gray-100 text-gray-700 border-gray-200'
  const categoryLabel = CATEGORIES.find((c) => c.value === template.category)?.label ?? template.category

  const mealSectionsInfo = useMemo(() => {
    if (!template.meal_sections) return null
    try {
      const parsed = JSON.parse(template.meal_sections) as MealSection[]
      if (!Array.isArray(parsed)) return null
      const planned = parsed.filter((s) => s.entries.length > 0).length
      return { planned, total: parsed.length }
    } catch {
      return null
    }
  }, [template.meal_sections])

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${categoryColorClass}`}>
                {categoryLabel}
              </span>
              {template.is_default && (
                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200 px-2 py-0.5 text-xs font-medium">
                  <Star className="h-3 w-3" />
                  Default
                </span>
              )}
              {!template.is_active && (
                <Badge variant="outline" className="text-xs">Inactive</Badge>
              )}
            </div>
            <CardTitle className="text-base leading-snug">{template.name}</CardTitle>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-3 pt-0">
        {/* Calories */}
        <div className="text-2xl font-bold text-foreground">
          {template.total_calories.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">kcal</span>
        </div>

        {/* Macro pills */}
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
            {template.protein_g}g protein
          </Badge>
          <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
            {template.carbs_g}g carbs
          </Badge>
          <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
            {template.fat_g}g fat
          </Badge>
        </div>

        {/* Meal sections info */}
        {mealSectionsInfo && (
          <div className="text-xs text-muted-foreground">
            {mealSectionsInfo.planned} of {mealSectionsInfo.total} meals planned
          </div>
        )}

        {/* Description */}
        {template.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{template.description}</p>
        )}

        {/* Tags */}
        {template.tags && template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {template.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs capitalize">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex-1" />
        <Separator />

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 pt-1">
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => onEdit(template)}>
              <Pencil className="h-3.5 w-3.5 mr-1" />
              Edit
            </Button>
          )}
          {canDelete && !template.is_default && (
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive"
              onClick={() => onDelete(template)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Delete
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function DietTemplatesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'admin'
  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager'

  const [deleteTarget, setDeleteTarget] = useState<DietTemplate | null>(null)

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'active'>('active')

  // ── Query ──────────────────────────────────────────────────────────────

  const { data, isLoading, isError } = useQuery({
    queryKey: ['diet-templates', { category: categoryFilter, active_only: activeFilter === 'active' }],
    queryFn: () =>
      dietTemplatesApi.list({
        category: categoryFilter || undefined,
        active_only: activeFilter === 'active',
      }),
  })

  const templates: DietTemplate[] = (
    (data as { diet_templates?: unknown[] })?.diet_templates ?? []
  ) as DietTemplate[]

  const filtered = templates.filter((t) =>
    search === '' || t.name.toLowerCase().includes(search.toLowerCase())
  )

  // ── Mutations ──────────────────────────────────────────────────────────

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['diet-templates'] })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => dietTemplatesApi.delete(id),
    onSuccess: () => {
      toast.success('Diet template deleted')
      setDeleteTarget(null)
      invalidate()
    },
    onError: () => toast.error('Failed to delete diet template'),
  })

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Diet Templates"
        subtitle="Manage reusable diet and nutrition plans"
        actions={
          isAdminOrManager ? (
            <Button onClick={() => navigate('/diet-templates/new')}>
              <Plus className="h-4 w-4" />
              New Template
            </Button>
          ) : undefined
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <SearchInput
          placeholder="Search by name…"
          value={search}
          onChange={setSearch}
          className="w-56"
        />
        <Select
          value={categoryFilter}
          onValueChange={setCategoryFilter}
          className="w-44"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </Select>
        <Select
          value={activeFilter}
          onValueChange={(v) => setActiveFilter(v as 'all' | 'active')}
          className="w-32"
        >
          <option value="active">Active Only</option>
          <option value="all">All</option>
        </Select>
      </div>

      {/* Content */}
      {isError && (
        <div className="p-6 text-sm text-destructive">Failed to load diet templates. Please try again.</div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !isError && filtered.length === 0 ? (
        <EmptyState
          title="No diet templates found"
          description="Create your first diet template to help members achieve their nutrition goals."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              canEdit={isAdminOrManager}
              canDelete={isAdmin}
              onEdit={(t) => navigate(`/diet-templates/${t.id}/edit`)}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {/* Delete Modal */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id) }}
        title="Delete Diet Template"
        description={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
