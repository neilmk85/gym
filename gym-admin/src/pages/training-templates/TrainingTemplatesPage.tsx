import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, Star, Clock, Zap, Dumbbell, Flame } from 'lucide-react'

import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/shared/SearchInput'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'

import { trainingTemplatesApi } from '@/api/training-templates.api'
import { useAuthStore } from '@/store/auth.store'

// ─── Types ─────────────────────────────────────────────────────────────────

interface TrainingTemplate {
  id: number
  name: string
  category: string
  difficulty: string
  description: string
  duration_weeks: number
  sessions_per_week: number
  workout_plan: string
  equipment: string[]
  tags: string[]
  is_default: boolean
  is_active: boolean
  created_at: string
}

// ─── Constants ─────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'strength', label: 'Strength' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'hiit', label: 'HIIT' },
  { value: 'yoga', label: 'Yoga' },
  { value: 'flexibility', label: 'Flexibility' },
  { value: 'sports', label: 'Sports' },
] as const

const DIFFICULTIES = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
] as const

const CATEGORY_GRADIENTS: Record<string, string> = {
  strength:    'linear-gradient(135deg, #0f2057 0%, #1e40af 45%, #3b82f6 100%)',
  cardio:      'linear-gradient(135deg, #7c2d12 0%, #ea580c 50%, #fb923c 100%)',
  hiit:        'linear-gradient(135deg, #450a0a 0%, #b91c1c 45%, #ef4444 100%)',
  yoga:        'linear-gradient(135deg, #2e1065 0%, #7c3aed 50%, #a78bfa 100%)',
  flexibility: 'linear-gradient(135deg, #042f2e 0%, #0f766e 50%, #14b8a6 100%)',
  sports:      'linear-gradient(135deg, #0c0a3e 0%, #3730a3 50%, #818cf8 100%)',
}

const CATEGORY_ACCENT: Record<string, string> = {
  strength:    'rgba(59,130,246,0.25)',
  cardio:      'rgba(251,146,60,0.25)',
  hiit:        'rgba(239,68,68,0.25)',
  yoga:        'rgba(167,139,250,0.25)',
  flexibility: 'rgba(20,184,166,0.25)',
  sports:      'rgba(129,140,248,0.25)',
}

const CATEGORY_EMOJI: Record<string, string> = {
  strength:    '🏋️',
  cardio:      '🏃',
  hiit:        '⚡',
  yoga:        '🧘',
  flexibility: '🤸',
  sports:      '⚽',
}

const DIFFICULTY_DOTS: Record<string, number> = {
  beginner: 1, intermediate: 2, advanced: 3,
}
const DIFFICULTY_DOT_COLOR: Record<string, string> = {
  beginner:     '#22c55e',
  intermediate: '#f59e0b',
  advanced:     '#ef4444',
}

// ─── Template Card ─────────────────────────────────────────────────────────

interface TemplateCardProps {
  template: TrainingTemplate
  canEdit: boolean
  canDelete: boolean
  onEdit: (t: TrainingTemplate) => void
  onDelete: (t: TrainingTemplate) => void
}

function TemplateCard({ template, canEdit, canDelete, onEdit, onDelete }: TemplateCardProps) {
  const [expanded, setExpanded] = useState(false)

  const gradient   = CATEGORY_GRADIENTS[template.category]  ?? CATEGORY_GRADIENTS.strength
  const accent     = CATEGORY_ACCENT[template.category]     ?? 'rgba(99,102,241,0.25)'
  const emoji      = CATEGORY_EMOJI[template.category]      ?? '💪'
  const filled     = DIFFICULTY_DOTS[template.difficulty]   ?? 1
  const dotColor   = DIFFICULTY_DOT_COLOR[template.difficulty] ?? '#6366f1'
  const categoryLabel   = CATEGORIES.find((c) => c.value === template.category)?.label   ?? template.category
  const difficultyLabel = DIFFICULTIES.find((d) => d.value === template.difficulty)?.label ?? template.difficulty

  const visibleEquipment = template.equipment?.slice(0, 4) ?? []
  const extraEquipment   = (template.equipment?.length ?? 0) - visibleEquipment.length

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.13), 0 1px 6px rgba(0,0,0,0.08)' }}
    >
      {/* ── Gradient header ── */}
      <div className="relative overflow-hidden px-5 pt-5 pb-4" style={{ background: gradient }}>
        {/* diagonal stripe texture */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, #fff 0px, #fff 1px, transparent 1px, transparent 12px)',
          }}
        />
        {/* glow blob */}
        <div
          className="absolute -right-6 -top-6 h-28 w-28 rounded-full blur-2xl"
          style={{ background: accent }}
        />

        <div className="relative flex items-start justify-between gap-3">
          {/* emoji + name inline */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <span className="text-4xl leading-none select-none shrink-0">{emoji}</span>
            <div className="min-w-0">
              <h3 className="text-base font-black text-white leading-tight tracking-tight line-clamp-2">
                {template.name}
              </h3>
              {/* category + badges */}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span
                  className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.9)' }}
                >
                  {categoryLabel}
                </span>
                {template.is_default && (
                  <span
                    className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(250,204,21,0.25)', color: '#fde047' }}
                  >
                    <Star className="h-2.5 w-2.5" /> Default
                  </span>
                )}
                {!template.is_active && (
                  <span
                    className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(0,0,0,0.25)', color: 'rgba(255,255,255,0.55)' }}
                  >
                    Inactive
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Difficulty dots */}
          <div className="shrink-0 flex flex-col items-end gap-1.5 pt-1">
            <span className="text-[9px] font-bold uppercase tracking-widest text-white/50">
              Level
            </span>
            <div className="flex gap-1">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-2.5 w-2.5 rounded-full transition-all"
                  style={{
                    background: n <= filled ? dotColor : 'rgba(255,255,255,0.2)',
                    boxShadow: n <= filled ? `0 0 6px ${dotColor}` : 'none',
                  }}
                />
              ))}
            </div>
            <span className="text-[10px] font-semibold text-white/70">{difficultyLabel}</span>
          </div>
        </div>

        {/* ── Stats strip inside header ── */}
        <div
          className="mt-4 flex items-center gap-4 pt-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}
        >
          <div className="flex items-center gap-2">
            <div
              className="h-7 w-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.15)' }}
            >
              <Clock className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <p className="text-xl font-black text-white leading-none">{template.duration_weeks}</p>
              <p className="text-[10px] text-white/60 font-medium uppercase tracking-wide">Weeks</p>
            </div>
          </div>
          <div className="h-8 w-px" style={{ background: 'rgba(255,255,255,0.15)' }} />
          <div className="flex items-center gap-2">
            <div
              className="h-7 w-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.15)' }}
            >
              <Flame className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <p className="text-xl font-black text-white leading-none">{template.sessions_per_week}</p>
              <p className="text-[10px] text-white/60 font-medium uppercase tracking-wide">Sessions/wk</p>
            </div>
          </div>
          <div className="h-8 w-px" style={{ background: 'rgba(255,255,255,0.15)' }} />
          <div className="flex items-center gap-2">
            <div
              className="h-7 w-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.15)' }}
            >
              <Zap className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <p className="text-xl font-black text-white leading-none">
                {template.duration_weeks * template.sessions_per_week}
              </p>
              <p className="text-[10px] text-white/60 font-medium uppercase tracking-wide">Total sessions</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── White body ── */}
      <div className="flex-1 flex flex-col bg-white px-5 pt-4 pb-4 gap-3">

        {/* Description */}
        {template.description && (
          <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">{template.description}</p>
        )}

        {/* Workout plan expand */}
        {template.workout_plan && (
          <div>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-700 transition-colors"
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {expanded ? 'Hide Plan' : 'View Full Plan'}
            </button>
            {expanded && (
              <pre className="mt-2 whitespace-pre-wrap text-xs text-gray-500 bg-gray-50 rounded-xl p-3 max-h-48 overflow-y-auto border border-gray-100">
                {template.workout_plan}
              </pre>
            )}
          </div>
        )}

        {/* Equipment */}
        {visibleEquipment.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 flex items-center gap-1">
              <Dumbbell className="h-3 w-3" /> Equipment
            </p>
            <div className="flex flex-wrap gap-1.5">
              {visibleEquipment.map((eq) => (
                <span
                  key={eq}
                  className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize"
                  style={{ background: '#f1f5f9', color: '#475569' }}
                >
                  {eq}
                </span>
              ))}
              {extraEquipment > 0 && (
                <span
                  className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                  style={{ background: '#f1f5f9', color: '#94a3b8' }}
                >
                  +{extraEquipment} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Tags */}
        {template.tags && template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {template.tags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize"
                style={{ background: '#eff6ff', color: '#3b82f6' }}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex-1" />

        {/* Footer action buttons */}
        {(canEdit || canDelete) && (
          <div
            className="flex items-center justify-end gap-1.5 pt-3"
            style={{ borderTop: '1px solid #f1f5f9' }}
          >
            {canEdit && (
              <button
                title="Edit template"
                onClick={() => onEdit(template)}
                className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-all"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
            {canDelete && !template.is_default && (
              <button
                title="Delete template"
                onClick={() => onDelete(template)}
                className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function TrainingTemplatesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'admin'
  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager'

  const [deleteTarget, setDeleteTarget] = useState<TrainingTemplate | null>(null)

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'active'>('active')

  // ── Query ──────────────────────────────────────────────────────────────

  const { data, isLoading, isError } = useQuery({
    queryKey: ['training-templates', { category: categoryFilter, difficulty: difficultyFilter, active_only: activeFilter === 'active' }],
    queryFn: () =>
      trainingTemplatesApi.list({
        category: categoryFilter || undefined,
        difficulty: difficultyFilter || undefined,
        active_only: activeFilter === 'active',
      }),
  })

  const templates: TrainingTemplate[] = (
    (data as { training_templates?: unknown[] })?.training_templates ?? []
  ) as TrainingTemplate[]

  const filtered = templates.filter((t) =>
    search === '' || t.name.toLowerCase().includes(search.toLowerCase())
  )

  // ── Mutations ──────────────────────────────────────────────────────────

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['training-templates'] })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => trainingTemplatesApi.delete(id),
    onSuccess: () => {
      toast.success('Training template deleted')
      setDeleteTarget(null)
      invalidate()
    },
    onError: () => toast.error('Failed to delete training template'),
  })

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return
    deleteMutation.mutate(deleteTarget.id)
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Training Templates"
        subtitle="Manage reusable workout and training programs"
        actions={
          isAdminOrManager ? (
            <Button onClick={() => navigate('/training-templates/new')}>
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
          className="w-40"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </Select>
        <Select
          value={difficultyFilter}
          onValueChange={setDifficultyFilter}
          className="w-40"
        >
          <option value="">All Levels</option>
          {DIFFICULTIES.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
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
        <div className="p-6 text-sm text-destructive">Failed to load training templates. Please try again.</div>
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
          title="No training templates found"
          description="Create your first training template to help members reach their fitness goals."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              canEdit={isAdminOrManager}
              canDelete={isAdmin}
              onEdit={(t) => navigate(`/training-templates/${t.id}/edit`)}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {/* Delete Modal */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Training Template"
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
