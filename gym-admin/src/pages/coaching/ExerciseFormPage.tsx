import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  ArrowLeft, Dumbbell, Plus, X, ImageIcon, Link2, ChevronDown, Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { coachingApi } from '@/api/coaching.api'
import {
  EXERCISE_CATEGORIES, MUSCLE_GROUPS, EQUIPMENT_LIST,
  DIFFICULTY_LEVELS, PRIMARY_FUNCTIONS,
  loadExercisePhotos, saveExercisePhotos,
} from '@/lib/exercise-meta'

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  name:              z.string().min(1, 'Exercise name is required'),
  category:          z.string().min(1, 'Category is required'),
  muscle_groups:     z.string().optional(),
  equipment:         z.string().optional(),
  instructions:      z.string().optional(),
  video_url:         z.string().url('Must be a valid URL').or(z.literal('')).optional(),
  is_active:         z.boolean(),
  // Extra fields (stored separately / passed as notes fields since backend doesn't have dedicated columns)
  difficulty:        z.string().optional(),
  primary_function:  z.string().optional(),
  tips:              z.string().optional(),
})

type FormValues = z.infer<typeof schema>

const selectClass = 'w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

// ── Muscle group chip multi-select ────────────────────────────────────────────

function MuscleGroupPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const selected = new Set(value ? value.split(',').map(s => s.trim()).filter(Boolean) : [])

  const toggle = (mg: string) => {
    const next = new Set(selected)
    if (next.has(mg)) next.delete(mg)
    else next.add(mg)
    onChange([...next].join(', '))
  }

  return (
    <div className="flex flex-wrap gap-2">
      {MUSCLE_GROUPS.map(mg => (
        <button
          key={mg}
          type="button"
          onClick={() => toggle(mg)}
          className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
            selected.has(mg)
              ? 'bg-violet-600 text-white border-violet-600'
              : 'bg-background text-muted-foreground border-input hover:border-violet-400 hover:text-violet-600'
          }`}
        >
          {mg}
        </button>
      ))}
    </div>
  )
}

// ── Photo slot ────────────────────────────────────────────────────────────────

function PhotoSlot({
  index, url, onChange, onRemove,
}: { index: number; url: string; onChange: (v: string) => void; onRemove: () => void }) {
  const [focused, setFocused] = useState(false)
  const isValid = url && (url.startsWith('http://') || url.startsWith('https://'))

  return (
    <div className="space-y-2">
      <div className={`relative rounded-lg border-2 overflow-hidden transition-colors ${
        focused ? 'border-violet-400' : 'border-dashed border-muted-foreground/30 hover:border-muted-foreground/50'
      }`}
        style={{ aspectRatio: '4/3' }}
      >
        {isValid ? (
          <>
            <img src={url} alt={`Photo ${index + 1}`}
              className="absolute inset-0 w-full h-full object-cover"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            <button type="button" onClick={onRemove}
              className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors z-10">
              <X className="w-3 h-3" />
            </button>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/40 gap-1">
            <ImageIcon className="w-6 h-6" />
            <span className="text-[10px]">Photo {index + 1}</span>
          </div>
        )}
      </div>
      <Input
        value={url}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Paste image URL…"
        className="h-7 text-xs"
      />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ExerciseFormPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)

  const [photos, setPhotos] = useState<string[]>(['', '', '', '', ''])
  const [showTips, setShowTips] = useState(false)

  // Load existing exercise for edit
  const { data, isLoading } = useQuery({
    queryKey: ['coaching', 'exercises', id],
    queryFn: () => coachingApi.getExercise(Number(id)),
    enabled: isEdit,
  })
  const exercise = (data as any)?.exercise

  // Load saved photos on edit
  useEffect(() => {
    if (isEdit && id) {
      const saved = loadExercisePhotos(Number(id))
      if (saved.length) {
        const padded = [...saved, ...Array(5 - saved.length).fill('')]
        setPhotos(padded.slice(0, 5))
      }
    }
  }, [isEdit, id])

  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '', category: '', muscle_groups: '', equipment: '',
      instructions: '', video_url: '', is_active: true,
      difficulty: 'Beginner', primary_function: 'Strength', tips: '',
    },
    values: exercise ? {
      name:             exercise.name ?? '',
      category:         exercise.category ?? '',
      muscle_groups:    exercise.muscle_groups ?? '',
      equipment:        exercise.equipment ?? '',
      instructions:     exercise.instructions ?? '',
      video_url:        exercise.video_url ?? '',
      is_active:        exercise.is_active ?? true,
      difficulty:       'Intermediate',
      primary_function: 'Strength',
      tips:             '',
    } : undefined,
  })

  const selectedCategory = watch('category')

  const savePhotosAndNavigate = (exerciseId: number) => {
    const filled = photos.filter(p => p.trim())
    if (filled.length) saveExercisePhotos(exerciseId, filled)
    qc.invalidateQueries({ queryKey: ['coaching', 'exercises'] })
    navigate('/coaching/exercises')
  }

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => {
      const { difficulty, primary_function, tips, ...rest } = data
      const payload = {
        ...rest,
        // Pack extra fields into instructions as a structured block if not already there
        instructions: [
          rest.instructions,
          difficulty ? `\n[Difficulty: ${difficulty}]` : '',
          primary_function ? `[Function: ${primary_function}]` : '',
          tips ? `[Tips: ${tips}]` : '',
        ].filter(Boolean).join(''),
      }
      return coachingApi.createExercise(payload)
    },
    onSuccess: (resp: any) => {
      const exId = resp?.exercise?.id ?? resp?.id
      toast.success('Exercise added to library')
      if (exId) {
        savePhotosAndNavigate(exId)
      } else {
        qc.invalidateQueries({ queryKey: ['coaching', 'exercises'] })
        navigate('/coaching/exercises')
      }
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to create exercise'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) => {
      const { difficulty, primary_function, tips, ...rest } = data
      const payload = {
        ...rest,
        instructions: [
          rest.instructions,
          difficulty ? `\n[Difficulty: ${difficulty}]` : '',
          primary_function ? `[Function: ${primary_function}]` : '',
          tips ? `[Tips: ${tips}]` : '',
        ].filter(Boolean).join(''),
      }
      return coachingApi.updateExercise(Number(id), payload)
    },
    onSuccess: () => {
      const filled = photos.filter(p => p.trim())
      if (filled.length) saveExercisePhotos(Number(id), filled)
      toast.success('Exercise updated')
      qc.invalidateQueries({ queryKey: ['coaching', 'exercises'] })
      navigate('/coaching/exercises')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to update exercise'),
  })

  const activeMutation = isEdit ? updateMutation : createMutation
  const isPending = activeMutation.isPending

  const updatePhoto = (idx: number, val: string) => {
    setPhotos(prev => prev.map((p, i) => i === idx ? val : p))
  }
  const removePhoto = (idx: number) => {
    setPhotos(prev => prev.map((p, i) => i === idx ? '' : p))
  }

  if (isEdit && isLoading) return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-96 w-full" />
    </div>
  )

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="relative overflow-hidden -mx-6 -mt-6 bg-gradient-to-br from-violet-700 via-purple-700 to-fuchsia-700 text-white">
        <div className="relative px-6 py-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/coaching/exercises')}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <p className="text-[11px] font-semibold tracking-widest uppercase text-white/55 mb-0.5">Coaching › Exercise Library</p>
              <div className="flex items-center gap-2.5">
                <Dumbbell className="w-5 h-5 opacity-80" />
                <h1 className="text-2xl font-bold tracking-tight">
                  {isEdit ? 'Edit Exercise' : 'Add New Exercise'}
                </h1>
              </div>
              <p className="text-sm text-white/65 mt-0.5">
                {isEdit ? 'Update exercise details and photos' : 'Fill in the details to add an exercise to the library'}
              </p>
            </div>
          </div>
        </div>
        <div className="absolute -right-6 -top-6 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute right-20 -bottom-8 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />
      </div>

      <form onSubmit={handleSubmit(v => activeMutation.mutate(v))} className="space-y-5">

        {/* ── Basic Info ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Exercise Name <span className="text-destructive">*</span></Label>
                <Input {...register('name')} placeholder="e.g. Barbell Bench Press" className="text-base" />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Category <span className="text-destructive">*</span></Label>
                <select {...register('category')} className={selectClass}>
                  <option value="">— Select category —</option>
                  {EXERCISE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Difficulty Level</Label>
                <select {...register('difficulty')} className={selectClass}>
                  {DIFFICULTY_LEVELS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Primary Function</Label>
                <select {...register('primary_function')} className={selectClass}>
                  {PRIMARY_FUNCTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Equipment Required</Label>
                <select {...register('equipment')} className={selectClass}>
                  <option value="">— Select equipment —</option>
                  {EQUIPMENT_LIST.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <div className="flex items-center gap-3 h-9">
                  <Controller control={control} name="is_active" render={({ field }) => (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={field.value}
                      onClick={() => field.onChange(!field.value)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${field.value ? 'bg-violet-600' : 'bg-muted'}`}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${field.value ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  )} />
                  <span className="text-sm text-muted-foreground">{watch('is_active') ? 'Active (visible in library)' : 'Inactive (hidden)'}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Muscle Groups ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Muscle Groups Targeted</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">Select all muscles this exercise targets. Click to toggle.</p>
            <Controller
              control={control}
              name="muscle_groups"
              render={({ field }) => (
                <MuscleGroupPicker value={field.value ?? ''} onChange={field.onChange} />
              )}
            />
            {watch('muscle_groups') && (
              <p className="text-xs text-muted-foreground">
                Selected: <span className="font-medium text-foreground">{watch('muscle_groups')}</span>
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Instructions ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Instructions & Technique</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Step-by-step Instructions</Label>
              <Textarea
                {...register('instructions')}
                rows={6}
                placeholder={`1. Set up the barbell on the rack at chest height.\n2. Grip the bar slightly wider than shoulder-width.\n3. Unrack and lower the bar to your mid-chest with control.\n4. Press explosively back to the starting position.\n5. Repeat for the desired reps.`}
              />
            </div>

            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setShowTips(v => !v)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Info className="w-3.5 h-3.5" />
                <span>{showTips ? 'Hide' : 'Add'} Coaching Tips & Common Mistakes</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showTips ? 'rotate-180' : ''}`} />
              </button>
              {showTips && (
                <Textarea
                  {...register('tips')}
                  rows={3}
                  placeholder="e.g. Keep your back flat, don't flare elbows too wide, control the descent…"
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Exercise Photos ── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Exercise Photos</CardTitle>
              <span className="text-xs text-muted-foreground">Up to 5 photos (paste image URLs)</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" />
              Paste direct image URLs from Google, Unsplash, or your image hosting. Photos are stored locally.
            </p>
            <div className="grid grid-cols-5 gap-3">
              {photos.map((url, idx) => (
                <PhotoSlot
                  key={idx}
                  index={idx}
                  url={url}
                  onChange={val => updatePhoto(idx, val)}
                  onRemove={() => removePhoto(idx)}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Video ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Video Reference</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Link2 className="w-3.5 h-3.5" /> Video URL</Label>
              <Input
                {...register('video_url')}
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
              />
              {errors.video_url && <p className="text-xs text-destructive">{errors.video_url.message}</p>}
              <p className="text-xs text-muted-foreground">YouTube, Vimeo, or any direct video link. Shown to members in their workout plan.</p>
            </div>
            {watch('video_url') && (watch('video_url') ?? '').includes('youtube.com/watch?v=') && (
              <div className="rounded-lg overflow-hidden border aspect-video bg-muted">
                <iframe
                  className="w-full h-full"
                  src={`https://www.youtube.com/embed/${new URL(watch('video_url') ?? '').searchParams.get('v')}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-between gap-4 pb-6">
          <Button type="button" variant="outline" onClick={() => navigate('/coaching/exercises')}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending} className="bg-violet-600 hover:bg-violet-700 text-white">
            {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Add to Library'}
          </Button>
        </div>
      </form>
    </div>
  )
}
