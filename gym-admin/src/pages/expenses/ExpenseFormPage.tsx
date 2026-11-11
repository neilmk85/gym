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
import { expensesApi } from '@/api/expenses.api'
import { QUERY_KEYS } from '@/lib/constants'

const schema = z.object({
  facility_id: z.string().min(1, 'Facility is required'),
  category_id: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  amount: z.coerce.number().min(0, 'Amount must be ≥ 0'),
  expense_date: z.string().min(1, 'Date is required'),
  payment_method: z.enum(['cash', 'card', 'transfer', 'other']),
  vendor: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
})

type FormValues = z.infer<typeof schema>

export default function ExpenseFormPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)

  const { data, isLoading } = useQuery({
    queryKey: [QUERY_KEYS.expenses, id],
    queryFn: () => expensesApi.getExpense(Number(id)),
    enabled: isEdit,
  })
  const expense = (data as any)?.expense

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      facility_id: '1',
      category_id: '',
      title: '',
      amount: 0,
      expense_date: new Date().toISOString().split('T')[0],
      payment_method: 'cash',
      vendor: '',
      notes: '',
      status: 'pending',
    },
    values: expense ? {
      facility_id: String(expense.facility_id ?? '1'),
      category_id: expense.category_id ? String(expense.category_id) : '',
      title: expense.title ?? '',
      amount: expense.amount ?? 0,
      expense_date: expense.expense_date ?? '',
      payment_method: expense.payment_method ?? 'cash',
      vendor: expense.vendor ?? '',
      notes: expense.notes ?? '',
      status: expense.status ?? 'pending',
    } : undefined,
  })

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => expensesApi.createExpense(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.expenses] })
      toast.success('Expense recorded')
      navigate('/expenses')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to record expense'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) => expensesApi.updateExpense(Number(id), data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.expenses] })
      toast.success('Expense updated')
      navigate('/expenses')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to update expense'),
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
        <Button variant="ghost" size="icon" title="Back" onClick={() => navigate('/expenses')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{isEdit ? 'Edit Expense' : 'Record Expense'}</h1>
          <p className="text-sm text-muted-foreground">
            {isEdit ? 'Update expense details' : 'Record a new business expense'}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit(v => activeMutation.mutate(v))} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title <span className="text-destructive">*</span></Label>
              <Input {...register('title')} placeholder="Electricity bill, Equipment repair…" />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Amount (₹) <span className="text-destructive">*</span></Label>
                <Input type="number" min="0" step="0.01" {...register('amount')} placeholder="0" />
                {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Date <span className="text-destructive">*</span></Label>
                <Input type="date" {...register('expense_date')} />
                {errors.expense_date && <p className="text-xs text-destructive">{errors.expense_date.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Facility ID <span className="text-destructive">*</span></Label>
                <Input type="number" min="1" {...register('facility_id')} placeholder="1" />
                {errors.facility_id && <p className="text-xs text-destructive">{errors.facility_id.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Category ID</Label>
                <Input type="number" min="1" {...register('category_id')} placeholder="Optional" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Payment Method <span className="text-destructive">*</span></Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" {...register('payment_method')}>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="transfer">Bank Transfer</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Vendor</Label>
                <Input {...register('vendor')} placeholder="Supplier name" />
              </div>
            </div>

            {isEdit && (
              <div className="space-y-1.5">
                <Label>Status</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" {...register('status')}>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea {...register('notes')} rows={3} placeholder="Any additional notes…" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate('/expenses')}>Cancel</Button>
              <Button type="submit" disabled={activeMutation.isPending}>
                {activeMutation.isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Record Expense'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
