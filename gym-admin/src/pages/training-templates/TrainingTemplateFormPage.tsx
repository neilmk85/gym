import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { trainingTemplatesApi } from '@/api/training-templates.api'
import { QUERY_KEYS } from '@/lib/constants'

const CATEGORIES = ['strength', 'cardio', 'hiit', 'yoga', 'flexibility', 'sports'] as const
const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  category: z.enum(CATEGORIES),
  difficulty: z.enum(DIFFICULTIES),
  description: z.string().optional(),
  duration_weeks: z.coerce.number().int().min(1).optional().or(z.literal('')),
  sessions_per_week: z.coerce.number().int().min(1).max(7).optional().or(z.literal('')),
  workout_plan: z.string().optional(),
  equipment: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
})

type FormValues = z.infer<typeof schema>

function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [input, setInput] = useState('')
  const add = () => {
    const v = input.trim()
    if (v && !value.includes(v)) onChange([...value, v])
    setInput('')
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input value={input} onChange={e => setInput(e.target.value)} placeholder={placeholder}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }} />
        <Button type="button" variant="outline" size="sm" onClick={add}>Add</Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map(tag => (
            <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs">
              {tag}
              <button type="button" onClick={() => onChange(value.filter(t => t !== tag))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function TrainingTemplateFormPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)

  const { data, isLoading } = useQuery({
    queryKey: [QUERY_KEYS.trainingTemplates, id],
    queryFn: () => trainingTemplatesApi.getTemplate(Number(id)),
    enabled: isEdit,
  })
  const template = (data as any)?.training_template

  const { register, handleSubmit, control, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { category: 'strength', difficulty: 'beginner', equipment: [], tags: [] },
    values: template ? {
      name: template.name ?? '',
      category: template.category ?? 'strength',
      difficulty: template.difficulty ?? 'beginner',
      description: template.description ?? '',
      duration_weeks: template.duration_weeks ?? '',
      sessions_per_week: template.sessions_per_week ?? '',
      workout_plan: template.workout_plan ?? '',
      equipment: template.equipment ?? [],
      tags: template.tags ?? [],
    } : undefined,
  })

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => trainingTemplatesApi.createTemplate(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.trainingTemplates] })
      toast.success('Training template created')
      navigate('/training-templates')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to create template'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) => trainingTemplatesApi.updateTemplate(Number(id), data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.trainingTemplates] })
      toast.success('Training template updated')
      navigate('/training-templates')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to update template'),
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
        <Button variant="ghost" size="icon" title="Back" onClick={() => navigate('/training-templates')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{isEdit ? 'Edit Training Template' : 'New Training Template'}</h1>
          <p className="text-sm text-muted-foreground">
            {isEdit ? 'Update training template' : 'Create a reusable training program template'}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit(v => activeMutation.mutate(v))} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Template Name <span className="text-destructive">*</span></Label>
              <Input {...register('name')} placeholder="e.g. 12-Week Strength Builder" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Category <span className="text-destructive">*</span></Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" {...register('category')}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Difficulty <span className="text-destructive">*</span></Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" {...register('difficulty')}>
                  {DIFFICULTIES.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Duration (weeks)</Label>
                <Input type="number" min="1" {...register('duration_weeks')} placeholder="12" />
              </div>
              <div className="space-y-1.5">
                <Label>Sessions per Week</Label>
                <Input type="number" min="1" max="7" {...register('sessions_per_week')} placeholder="4" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea {...register('description')} rows={3} placeholder="Overview of this training program…" />
            </div>

            <div className="space-y-1.5">
              <Label>Workout Plan</Label>
              <Textarea {...register('workout_plan')} rows={4} placeholder="Describe the workout schedule, exercises per day/week…" />
            </div>

            <div className="space-y-1.5">
              <Label>Equipment Required</Label>
              <Controller
                name="equipment"
                control={control}
                render={({ field }) => (
                  <TagInput
                    value={field.value ?? []}
                    onChange={field.onChange}
                    placeholder="Barbell, Dumbbells, Resistance bands…"
                  />
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Tags</Label>
              <Controller
                name="tags"
                control={control}
                render={({ field }) => (
                  <TagInput
                    value={field.value ?? []}
                    onChange={field.onChange}
                    placeholder="fat loss, hypertrophy…"
                  />
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate('/training-templates')}>Cancel</Button>
              <Button type="submit" disabled={activeMutation.isPending}>
                {activeMutation.isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Template'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
