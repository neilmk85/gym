import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { PageHeader } from '@/components/shared/PageHeader'
import { FormDrawer } from '@/components/shared/FormDrawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { expensesApi, expenseCategoriesApi } from '@/api/expenses.api'
import { QUERY_KEYS } from '@/lib/constants'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import type { Expense, ExpenseCategory } from '@/types/expense.types'
import {
  Plus, Pencil, Trash2, Receipt, TrendingDown,
  Tag, Wallet, CreditCard, ArrowLeftRight, MoreHorizontal,
  Palette,
} from 'lucide-react'

const PER_PAGE = 20

// ─── Colour presets ───────────────────────────────────────────────────────────

const COLOR_PRESETS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  '#14b8a6', '#64748b',
]

// ─── Schemas ──────────────────────────────────────────────────────────────────

const categorySchema = z.object({
  name:        z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  color:       z.string().min(1, 'Color is required'),
  icon:        z.string().optional(),
})

type CategoryFormValues = z.infer<typeof categorySchema>

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  const cfg: Record<string, { bg: string; text: string; label: string }> = {
    pending:  { bg: 'bg-amber-100',   text: 'text-amber-700',   label: 'Pending' },
    approved: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Approved' },
    rejected: { bg: 'bg-red-100',     text: 'text-red-700',     label: 'Rejected' },
  }
  const c = cfg[status] ?? cfg.pending
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  )
}

function paymentIcon(method: string) {
  const icons: Record<string, React.ReactNode> = {
    cash:     <Wallet className="h-3.5 w-3.5" />,
    card:     <CreditCard className="h-3.5 w-3.5" />,
    transfer: <ArrowLeftRight className="h-3.5 w-3.5" />,
    other:    <MoreHorizontal className="h-3.5 w-3.5" />,
  }
  return icons[method] ?? icons.other
}

// ─── Category Form ────────────────────────────────────────────────────────────

function CategoryForm({
  initial, onSubmit, loading,
}: {
  initial?: ExpenseCategory | null
  onSubmit: (v: CategoryFormValues) => void
  loading: boolean
}) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name:  initial?.name  ?? '',
      description: initial?.description ?? '',
      color: initial?.color ?? '#6366f1',
      icon:  initial?.icon  ?? 'receipt',
    },
  })

  const color = watch('color')

  return (
    <form id="category-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Name *</Label>
        <Input {...register('name')} placeholder="e.g. Utilities" />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea {...register('description')} rows={2} placeholder="Brief description…" />
      </div>

      <div className="space-y-2">
        <Label>Colour *</Label>
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg border-2 border-white shadow" style={{ background: color }} />
          <Input type="color" {...register('color')} className="h-8 w-16 cursor-pointer p-0.5 rounded" />
        </div>
        <div className="flex flex-wrap gap-2 mt-1">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setValue('color', c, { shouldValidate: true })}
              className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${color === c ? 'border-gray-800 scale-110' : 'border-white shadow'}`}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Icon</Label>
        <Input {...register('icon')} placeholder="e.g. receipt, zap, wrench" />
        <p className="text-xs text-muted-foreground">Descriptive label used for display purposes</p>
      </div>
    </form>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExpensesListPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const canManage = user?.role === 'admin' || user?.role === 'manager'

  const [activeTab, setActiveTab] = useState<'expenses' | 'categories'>('expenses')

  // Expense filters
  const [page, setPage]               = useState(1)
  const [statusFilter, setStatusFilter] = useState('all')
  const [catFilter, setCatFilter]       = useState('all')

  // Category drawer
  const [catDrawer, setCatDrawer]         = useState<'closed' | 'create' | 'edit'>('closed')
  const [selectedCat, setSelectedCat]         = useState<ExpenseCategory | null>(null)

  // Queries
  const expensesQuery = useQuery({
    queryKey: QUERY_KEYS.expenses({ page, status: statusFilter, category_id: catFilter }),
    queryFn: () => expensesApi.list({
      page,
      per_page: PER_PAGE,
      status:   statusFilter !== 'all' ? statusFilter : undefined,
      category_id: catFilter !== 'all' ? Number(catFilter) : undefined,
    }),
    staleTime: 30_000,
  })

  const categoriesQuery = useQuery({
    queryKey: QUERY_KEYS.expenseCategories,
    queryFn: () => expenseCategoriesApi.list(false),
    staleTime: 60_000,
  })

  const expenses:   Expense[]         = (expensesQuery.data as { expenses?: Expense[] })?.expenses ?? []
  const categories: ExpenseCategory[] = (categoriesQuery.data as { categories?: ExpenseCategory[] })?.categories ?? []
  const meta = (expensesQuery.data as { meta?: { total: number; page: number; per_page: number; total_pages: number } })?.meta

  // ── Stats ──
  const totalAmount = expenses.reduce((sum, e) => e.status !== 'rejected' ? sum + e.amount : sum, 0)
  const pendingCount  = expenses.filter((e) => e.status === 'pending').length
  const approvedCount = expenses.filter((e) => e.status === 'approved').length

  // ── Mutations — Expenses ──
  const deleteExpense = useMutation({
    mutationFn: (id: number) => expensesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      toast.success('Expense deleted')
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to delete expense'),
  })

  // ── Mutations — Categories ──
  const createCategory = useMutation({
    mutationFn: (data: CategoryFormValues) => expenseCategoriesApi.create({ ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.expenseCategories })
      toast.success('Category created')
      setCatDrawer('closed')
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to create category'),
  })

  const updateCategory = useMutation({
    mutationFn: (data: CategoryFormValues) => expenseCategoriesApi.update(selectedCat!.id, { ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.expenseCategories })
      toast.success('Category updated')
      setCatDrawer('closed')
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to update category'),
  })

  const deleteCategory = useMutation({
    mutationFn: (id: number) => expenseCategoriesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.expenseCategories })
      toast.success('Category deleted')
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to delete category'),
  })

  // ── Handlers ──
  const openCreateCat     = () => { setSelectedCat(null); setCatDrawer('create') }
  const openEditCat       = (c: ExpenseCategory) => { setSelectedCat(c); setCatDrawer('edit') }

  return (
    <div>
      {/* ── Header ── */}
      <PageHeader
        title="Expenses"
        subtitle="Track and manage gym operational expenses"

        stats={[
          { label: 'Total (this page)', value: formatCurrency(totalAmount) },
          { label: 'Pending',  value: String(pendingCount)  },
          { label: 'Approved', value: String(approvedCount) },
          { label: 'Categories', value: String(categories.length) },
        ]}
        actions={
          canManage ? (
            activeTab === 'expenses' ? (
              <Button onClick={() => navigate('/expenses/new')}>
                <Plus className="h-4 w-4" />
                Add Expense
              </Button>
            ) : (
              <Button onClick={openCreateCat}>
                <Plus className="h-4 w-4" />
                Add Category
              </Button>
            )
          ) : undefined
        }
      />

      {/* ── Tabs ── */}
      <div className="flex gap-1 mb-5 border-b border-border">
        {(['expenses', 'categories'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'expenses' ? (
              <span className="flex items-center gap-2"><Receipt className="h-4 w-4" />Expenses</span>
            ) : (
              <span className="flex items-center gap-2"><Tag className="h-4 w-4" />Categories</span>
            )}
          </button>
        ))}
      </div>

      {/* ════════════════ EXPENSES TAB ════════════════ */}
      {activeTab === 'expenses' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }} className="w-40">
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </Select>
            <Select value={catFilter} onValueChange={(v) => { setCatFilter(v); setPage(1) }} className="w-48">
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={String(c.id)}>{c.name}</option>
              ))}
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-border overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left px-4 py-3 text-white/80 font-medium">Title</th>
                  <th className="text-left px-4 py-3 text-white/80 font-medium">Category</th>
                  <th className="text-left px-4 py-3 text-white/80 font-medium">Date</th>
                  <th className="text-left px-4 py-3 text-white/80 font-medium">Payment</th>
                  <th className="text-right px-4 py-3 text-white/80 font-medium">Amount</th>
                  <th className="text-left px-4 py-3 text-white/80 font-medium">Status</th>
                  {canManage && <th className="px-4 py-3 text-white/80 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {expensesQuery.isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-t border-border">
                      {Array.from({ length: canManage ? 7 : 6 }).map((__, j) => (
                        <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                      ))}
                    </tr>
                  ))
                ) : expenses.length === 0 ? (
                  <tr>
                    <td colSpan={canManage ? 7 : 6} className="py-12">
                      <EmptyState
                        icon={<TrendingDown className="h-8 w-8 text-muted-foreground" />}
                        title="No expenses found"
                        description="Add your first expense to start tracking costs."
                        action={canManage ? <Button onClick={() => navigate('/expenses/new')}><Plus className="h-4 w-4" />Add Expense</Button> : undefined}
                      />
                    </td>
                  </tr>
                ) : expenses.map((exp) => (
                  <tr key={exp.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{exp.title}</div>
                      {exp.vendor && <div className="text-xs text-muted-foreground">{exp.vendor}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {exp.category ? (
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                          style={{ background: exp.category.color }}
                        >
                          {exp.category.name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(exp.expense_date)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-muted-foreground capitalize">
                        {paymentIcon(exp.payment_method)}
                        {exp.payment_method}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {formatCurrency(exp.amount)}
                    </td>
                    <td className="px-4 py-3">{statusBadge(exp.status)}</td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => navigate(`/expenses/${exp.id}/edit`)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-sky-700 hover:bg-sky-50 transition-colors"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => { if (confirm('Delete this expense?')) deleteExpense.mutate(exp.id) }}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta && meta.total_pages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Page {meta.page} of {meta.total_pages} · {meta.total} total
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= meta.total_pages}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ════════════════ CATEGORIES TAB ════════════════ */}
      {activeTab === 'categories' && (
        <>
          {categoriesQuery.isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <EmptyState
              icon={<Tag className="h-8 w-8 text-muted-foreground" />}
              title="No categories yet"
              description="Create categories to organise your expenses by type."
              action={canManage ? <Button onClick={openCreateCat}><Plus className="h-4 w-4" />Add Category</Button> : undefined}
            />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="relative rounded-xl border border-border bg-card shadow-sm overflow-hidden group"
                >
                  {/* Colour strip */}
                  <div className="h-1.5 w-full" style={{ background: cat.color }} />
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: cat.color + '20', color: cat.color }}
                      >
                        <Palette className="h-5 w-5" />
                      </div>
                      {canManage && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEditCat(cat)}
                            className="p-1 rounded text-muted-foreground hover:text-sky-700 hover:bg-sky-50 transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => { if (confirm(`Delete "${cat.name}"?`)) deleteCategory.mutate(cat.id) }}
                            className="p-1 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="mt-2 font-semibold text-sm text-foreground">{cat.name}</p>
                    {cat.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{cat.description}</p>
                    )}
                    <div className="mt-2 flex items-center gap-1">
                      <span className={`h-1.5 w-1.5 rounded-full ${cat.is_active ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                      <span className="text-[10px] text-muted-foreground">{cat.is_active ? 'Active' : 'Inactive'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Category Drawers ── */}
      <FormDrawer
        open={catDrawer !== 'closed'}
        onClose={() => setCatDrawer('closed')}
        title={catDrawer === 'create' ? 'Add Category' : 'Edit Category'}
        formId="category-form"
        isSubmitting={createCategory.isPending || updateCategory.isPending}
        submitLabel={catDrawer === 'create' ? 'Create' : 'Save Changes'}
      >
        <CategoryForm
          key={selectedCat?.id ?? 'new'}
          initial={selectedCat}
          onSubmit={(v) => catDrawer === 'create' ? createCategory.mutate(v) : updateCategory.mutate(v)}
          loading={createCategory.isPending || updateCategory.isPending}
        />
      </FormDrawer>
    </div>
  )
}
