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
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { dietTemplatesApi } from '@/api/diet-templates.api'
import { QUERY_KEYS } from '@/lib/constants'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  goal: z.string().optional(),
  calories_target: z.coerce.number().int().min(0).optional().or(z.literal('')),
  protein_target: z.coerce.number().min(0).optional().or(z.literal('')),
  carbs_target: z.coerce.number().min(0).optional().or(z.literal('')),
  fat_target: z.coerce.number().min(0).optional().or(z.literal('')),
  description: z.string().optional(),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export default function DietTemplateFormPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)

  const { data, isLoading } = useQuery({
    queryKey: [QUERY_KEYS.dietTemplates, id],
    queryFn: () => dietTemplatesApi.getTemplate(Number(id)),
    enabled: isEdit,
  })
  const template = (data as any)?.diet_template

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', goal: '', description: '', notes: '' },
    values: template ? {
      name: template.name ?? '',
      goal: template.goal ?? '',
      calories_target: template.calories_target ?? '',
      protein_target: template.protein_target ?? '',
      carbs_target: template.carbs_target ?? '',
      fat_target: template.fat_target ?? '',
      description: template.description ?? '',
      notes: template.notes ?? '',
    } : undefined,
  })

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => dietTemplatesApi.createTemplate(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.dietTemplates] })
      toast.success('Diet template created')
      navigate('/diet-templates')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to create template'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) => dietTemplatesApi.updateTemplate(Number(id), data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.dietTemplates] })
      toast.success('Diet template updated')
      navigate('/diet-templates')
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
        <Button variant="ghost" size="icon" title="Back" onClick={() => navigate('/diet-templates')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{isEdit ? 'Edit Diet Template' : 'New Diet Template'}</h1>
          <p className="text-sm text-muted-foreground">
            {isEdit ? 'Update diet template' : 'Create a reusable diet plan template'}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit(v => activeMutation.mutate(v))} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Template Name <span className="text-destructive">*</span></Label>
              <Input {...register('name')} placeholder="e.g. High Protein Weight Loss" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Goal</Label>
              <Input {...register('goal')} placeholder="e.g. Weight loss, Muscle gain, Maintenance" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Calories Target (kcal)</Label>
                <Input type="number" min="0" {...register('calories_target')} placeholder="2000" />
              </div>
              <div className="space-y-1.5">
                <Label>Protein Target (g)</Label>
                <Input type="number" min="0" step="0.1" {...register('protein_target')} placeholder="150" />
              </div>
              <div className="space-y-1.5">
                <Label>Carbs Target (g)</Label>
                <Input type="number" min="0" step="0.1" {...register('carbs_target')} placeholder="200" />
              </div>
              <div className="space-y-1.5">
                <Label>Fat Target (g)</Label>
                <Input type="number" min="0" step="0.1" {...register('fat_target')} placeholder="65" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea {...register('description')} rows={3} placeholder="Overview of this diet template…" />
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea {...register('notes')} rows={2} placeholder="Special instructions or notes…" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate('/diet-templates')}>Cancel</Button>
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
