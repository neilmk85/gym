import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, TrendingDown, Tag, CreditCard, Building2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { expensesApi, expenseCategoriesApi } from '@/api/expenses.api'
import { QUERY_KEYS } from '@/lib/constants'
import type { ExpenseCategory } from '@/types/expense.types'

const schema = z.object({
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

function SectionHead({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-50 border border-cyan-200 text-[#00B4D8]">
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

export default function ExpenseFormPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)

  const { data: catData } = useQuery({
    queryKey: [QUERY_KEYS.expenseCategories ?? 'expense-categories'],
    queryFn: () => expenseCategoriesApi.list(true),
  })
  const categories: ExpenseCategory[] = (catData as any)?.categories ?? []

  const { data, isLoading } = useQuery({
    queryKey: [QUERY_KEYS.expenses, id],
    queryFn: () => expensesApi.getById(Number(id)),
    enabled: isEdit,
  })
  const expense = (data as any)?.expense

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
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
      category_id: expense.category_id ? String(expense.category_id) : '',
      title: expense.title ?? '',
      amount: expense.amount ?? 0,
      expense_date: expense.expense_date?.slice(0, 10) ?? '',
      payment_method: expense.payment_method ?? 'cash',
      vendor: expense.vendor ?? '',
      notes: expense.notes ?? '',
      status: expense.status ?? 'pending',
    } : undefined,
  })

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => expensesApi.create({ ...data, facility_id: 1 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.expenses] })
      toast.success('Expense recorded')
      navigate('/expenses')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to record expense'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) => expensesApi.update(Number(id), data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.expenses] })
      toast.success('Expense updated')
      navigate('/expenses')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to update expense'),
  })

  const activeMutation = isEdit ? updateMutation : createMutation

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
        style={{ background: 'linear-gradient(to bottom, #d0f5fb 0%, #e8f9fc 35%, #f4fbfd 60%, rgba(255,255,255,0) 100%)' }}>
        <button onClick={() => navigate('/expenses')}
          className="mb-3 flex items-center gap-1 text-sm font-medium text-[#00B4D8] hover:text-[#0096b4] transition-colors">
          <ArrowLeft className="h-4 w-4" /> Expenses
        </button>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white shadow-sm"
            style={{ background: 'linear-gradient(135deg, #0096b4, #00B4D8)' }}>
            <TrendingDown className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-[1.75rem] font-black tracking-tight text-[#1a1a2e] leading-tight">
              {isEdit ? 'Edit Expense' : 'Record Expense'}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {isEdit ? 'Update expense details' : 'Record a new business expense'}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(v => activeMutation.mutate(v))} className="space-y-4 mt-6">

        {/* ── Expense Details ── */}
        <div className="bg-card border rounded-xl px-6 pt-6 pb-7">
          <SectionHead icon={TrendingDown} title="Expense Details" description="What was spent and when" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="col-span-2">
              <Field label="Title" required error={errors.title?.message}>
                <Input {...register('title')} placeholder="e.g. Electricity bill, Equipment repair…" />
              </Field>
            </div>
            <Field label="Amount (₹)" required error={errors.amount?.message}>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                <Input type="number" min="0" step="0.01" className="pl-7" {...register('amount')} placeholder="0" />
              </div>
            </Field>
            <Field label="Date" required error={errors.expense_date?.message}>
              <Input type="date" {...register('expense_date')} />
            </Field>
          </div>
        </div>

        {/* ── Category & Payment ── */}
        <div className="bg-card border rounded-xl px-6 pt-6 pb-7">
          <SectionHead icon={Tag} title="Category & Payment" description="How it was classified and paid" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="col-span-2">
              <Field label="Category" hint="Select the most relevant category">
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  {...register('category_id')}
                >
                  <option value="">— Select category —</option>
                  {categories.map(c => (
                    <option key={c.id} value={String(c.id)}>{c.name}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Payment Method" required>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                {...register('payment_method')}
              >
                <option value="cash">Cash</option>
                <option value="card">Card / UPI</option>
                <option value="transfer">Bank Transfer</option>
                <option value="other">Other</option>
              </select>
            </Field>
            {isEdit && (
              <Field label="Status">
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  {...register('status')}
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </Field>
            )}
          </div>
        </div>

        {/* ── Vendor & Notes ── */}
        <div className="bg-card border rounded-xl px-6 pt-6 pb-7">
          <SectionHead icon={FileText} title="Vendor & Notes" description="Supplier details and additional context" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="col-span-2">
              <Field label="Vendor" hint="Name of supplier, contractor, or service provider">
                <Input {...register('vendor')} placeholder="e.g. MSEB, Urban Ladder, ABC Maintenance…" />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Notes">
                <Textarea {...register('notes')} rows={2} placeholder="Any additional notes or references…" />
              </Field>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex justify-end gap-3 py-2">
          <Button type="button" variant="outline" onClick={() => navigate('/expenses')}>Cancel</Button>
          <Button type="submit" disabled={activeMutation.isPending}
            className="min-w-36">
            {activeMutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Record Expense'}
          </Button>
        </div>
      </form>
    </div>
  )
}
