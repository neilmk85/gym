import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/shared/SearchInput'
import { Select } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { foodsApi } from '@/api/foods.api'
import type { FoodItem, BulkImportPayload } from '@/api/foods.api'
import { useAuthStore } from '@/store/auth.store'
import { Plus, Pencil, Trash2, Upload, Download, CheckCircle2, AlertCircle, X } from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'beverages', 'fats', 'fruits', 'nuts', 'dairy', 'grains',
  'protein', 'pulses', 'snacks', 'supplements', 'vegetables',
] as const

const UNITS = ['g', 'ml', 'pcs', 'slice', 'tbsp'] as const

const CAT_COLORS: Record<string, string> = {
  beverages:   'bg-blue-100 text-blue-700',
  fats:        'bg-yellow-100 text-yellow-800',
  fruits:      'bg-green-100 text-green-700',
  nuts:        'bg-amber-100 text-amber-700',
  dairy:       'bg-yellow-100 text-yellow-700',
  grains:      'bg-orange-100 text-orange-700',
  protein:     'bg-red-100 text-red-700',
  pulses:      'bg-teal-100 text-teal-700',
  snacks:      'bg-purple-100 text-purple-700',
  supplements: 'bg-pink-100 text-pink-700',
  vegetables:  'bg-lime-100 text-lime-700',
}

const TEMPLATE_HEADERS = [
  'name', 'category', 'unit', 'per_unit',
  'cal_per', 'protein_per', 'carbs_per', 'fat_per', 'default_qty',
]

const TEMPLATE_EXAMPLE_ROWS = [
  ['Oats', 'grains', 'g', 100, 389, 17, 66, 7, 80],
  ['Banana', 'fruits', 'g', 100, 89, 1.1, 23, 0.3, 120],
  ['Whey Protein', 'supplements', 'g', 100, 370, 75, 10, 4, 30],
]

// ─── Parsed row for import preview ────────────────────────────────────────────

interface ParsedRow {
  row: number
  data: BulkImportPayload
  errors: string[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validateImportRow(raw: Record<string, unknown>, rowNum: number): ParsedRow {
  const errs: string[] = []

  const name = String(raw['name'] ?? '').trim()
  const category = String(raw['category'] ?? '').trim().toLowerCase()
  const unit = String(raw['unit'] ?? '').trim().toLowerCase()
  const per_unit = Number(raw['per_unit'] ?? 0)

  if (!name) errs.push('name is required')
  if (!CATEGORIES.includes(category as typeof CATEGORIES[number])) {
    errs.push(`category "${category}" is invalid`)
  }
  if (!UNITS.includes(unit as typeof UNITS[number])) {
    errs.push(`unit "${unit}" must be one of: ${UNITS.join(', ')}`)
  }
  if (isNaN(per_unit) || per_unit <= 0) errs.push('per_unit must be > 0')

  return {
    row: rowNum,
    errors: errs,
    data: {
      name,
      category,
      unit,
      per_unit,
      cal_per:     Number(raw['cal_per'] ?? 0) || 0,
      protein_per: Number(raw['protein_per'] ?? 0) || 0,
      carbs_per:   Number(raw['carbs_per'] ?? 0) || 0,
      fat_per:     Number(raw['fat_per'] ?? 0) || 0,
      default_qty: Number(raw['default_qty'] ?? 0) || 0,
    },
  }
}

function parseFileToRows(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: '',
          raw: false,
        })
        const parsed = jsonRows.map((row, i) => validateImportRow(row, i + 2))
        resolve(parsed)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsArrayBuffer(file)
  })
}

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...TEMPLATE_EXAMPLE_ROWS])
  ws['!cols'] = [{ wch: 30 }, { wch: 14 }, { wch: 8 }, { wch: 10 },
                 { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 12 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Foods')
  XLSX.writeFile(wb, 'food_import_template.xlsx')
}

// ─── Import Preview Modal ──────────────────────────────────────────────────────

interface ImportPreviewProps {
  fileName: string
  rows: ParsedRow[]
  onConfirm: (validRows: BulkImportPayload[]) => void
  onClose: () => void
  isLoading: boolean
}

function ImportPreviewModal({ fileName, rows, onConfirm, onClose, isLoading }: ImportPreviewProps) {
  const validRows   = rows.filter((r) => r.errors.length === 0)
  const invalidRows = rows.filter((r) => r.errors.length > 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-background rounded-xl shadow-2xl w-full max-w-3xl mx-4 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <h2 className="text-base font-semibold">Import Preview</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{fileName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Stats */}
        <div className="flex gap-4 px-6 py-3 bg-muted/30 border-b shrink-0">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="font-medium text-green-700">{validRows.length} valid</span>
          </div>
          {invalidRows.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <span className="font-medium text-amber-700">{invalidRows.length} will be skipped (errors)</span>
            </div>
          )}
          <div className="text-sm text-muted-foreground">{rows.length} total rows</div>
        </div>

        {/* Table */}
        <div className="overflow-auto flex-1">
          <table className="w-full text-xs">
            <thead className="bg-sidebar sticky top-0 z-10">
              <tr>
                <th className="text-left px-3 py-2.5 font-light text-sidebar-foreground uppercase tracking-wide">#</th>
                <th className="text-left px-3 py-2.5 font-light text-sidebar-foreground uppercase tracking-wide">Name</th>
                <th className="text-left px-3 py-2.5 font-light text-sidebar-foreground uppercase tracking-wide">Category</th>
                <th className="text-left px-3 py-2.5 font-light text-sidebar-foreground uppercase tracking-wide">Unit</th>
                <th className="text-left px-3 py-2.5 font-light text-sidebar-foreground uppercase tracking-wide">Per Unit</th>
                <th className="text-left px-3 py-2.5 font-light text-sidebar-foreground uppercase tracking-wide">Cal</th>
                <th className="text-left px-3 py-2.5 font-light text-sidebar-foreground uppercase tracking-wide">Protein</th>
                <th className="text-left px-3 py-2.5 font-light text-sidebar-foreground uppercase tracking-wide">Carbs</th>
                <th className="text-left px-3 py-2.5 font-light text-sidebar-foreground uppercase tracking-wide">Fat</th>
                <th className="text-left px-3 py-2.5 font-light text-sidebar-foreground uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => {
                const hasError = r.errors.length > 0
                return (
                  <tr key={r.row} className={hasError ? 'bg-red-50 dark:bg-red-950/20' : 'hover:bg-muted/30'}>
                    <td className="px-3 py-2 text-muted-foreground">{r.row}</td>
                    <td className="px-3 py-2 font-medium">{r.data.name || '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.data.category || '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.data.unit || '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.data.per_unit}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.data.cal_per}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.data.protein_per}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.data.carbs_per}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.data.fat_per}</td>
                    <td className="px-3 py-2">
                      {hasError ? (
                        <span className="text-red-600 dark:text-red-400" title={r.errors.join('; ')}>
                          ✗ {r.errors[0]}{r.errors.length > 1 ? ` +${r.errors.length - 1}` : ''}
                        </span>
                      ) : (
                        <span className="text-green-600 dark:text-green-400">✓ OK</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t shrink-0 bg-background">
          <p className="text-xs text-muted-foreground">
            Duplicate names will be skipped automatically.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              onClick={() => onConfirm(validRows.map((r) => r.data))}
              disabled={validRows.length === 0 || isLoading}
              loading={isLoading}
            >
              Import {validRows.length} items
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FoodsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const canManage = user?.role === 'admin' || user?.role === 'manager'

  const [search, setSearch]               = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [deleteTarget, setDeleteTarget]   = useState<FoodItem | null>(null)

  // Import state
  const fileInputRef                      = useRef<HTMLInputElement>(null)
  const [parsedRows, setParsedRows]       = useState<ParsedRow[] | null>(null)
  const [importFileName, setImportFileName] = useState('')
  const [parseError, setParseError]       = useState<string | null>(null)

  // ── Query ────────────────────────────────────────────────────────────────

  const { data, isLoading, isError } = useQuery({
    queryKey: ['foods', { search, category: categoryFilter }],
    queryFn: () => foodsApi.list({ search: search || undefined, category: categoryFilter || undefined, active_only: false }),
  })

  const foods: FoodItem[] = data?.foods ?? []

  // ── Mutations ─────────────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: (id: number) => foodsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foods'] })
      toast.success('Food item deleted')
      setDeleteTarget(null)
    },
    onError: () => toast.error('Failed to delete food item'),
  })

  const importMutation = useMutation({
    mutationFn: (rows: BulkImportPayload[]) => foodsApi.bulkImport(rows),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['foods'] })
      toast.success(`Import complete — ${result.imported} added, ${result.skipped} skipped (duplicates)`)
      setParsedRows(null)
      setImportFileName('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    onError: () => toast.error('Import failed. Please try again.'),
  })

  // ── File pick handler ─────────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setParseError(null)
    setImportFileName(file.name)
    try {
      const rows = await parseFileToRows(file)
      if (rows.length === 0) {
        setParseError('No data rows found in the file.')
        return
      }
      setParsedRows(rows)
    } catch {
      setParseError('Failed to parse file. Make sure it is a valid CSV or Excel file.')
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Food Database"
        subtitle="Manage food items and nutritional data"
        actions={
          canManage ? (
            <div className="flex items-center gap-2">
              {/* Download template */}
              <Button variant="outline" onClick={downloadTemplate} title="Download CSV/Excel template">
                <Download className="h-4 w-4" />
                Template
              </Button>

              {/* Import */}
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4" />
                Import
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />

              {/* Add single */}
              <Button onClick={() => navigate('/foods/new')}>
                <Plus className="h-4 w-4" />
                Add Food
              </Button>
            </div>
          ) : undefined
        }
      />

      {parseError && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {parseError}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <SearchInput
          placeholder="Search by name…"
          value={search}
          onChange={setSearch}
          className="w-56"
        />
        <Select value={categoryFilter} onValueChange={setCategoryFilter} className="w-44">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c} className="capitalize">{c}</option>
          ))}
        </Select>
      </div>

      <Card className="border-0 shadow-md overflow-hidden">
        <CardContent className="p-0">
          {isError && (
            <div className="p-6 text-sm text-destructive">Failed to load food items. Please try again.</div>
          )}
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !isError && foods.length === 0 ? (
            <EmptyState title="No food items found" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-sidebar">
                  <tr>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Name</th>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Category</th>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Unit</th>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Per Unit</th>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Calories</th>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Protein</th>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Carbs</th>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Fat</th>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Default Qty</th>
                    <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Status</th>
                    {canManage && (
                      <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {foods.map((food) => {
                    const catColor = CAT_COLORS[food.category] ?? 'bg-gray-100 text-gray-700'
                    return (
                      <tr key={food.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{food.name}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${catColor}`}>
                            {food.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{food.unit}</td>
                        <td className="px-4 py-3 text-muted-foreground">{food.per_unit}</td>
                        <td className="px-4 py-3 text-muted-foreground">{food.cal_per ?? '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{food.protein_per ?? '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{food.carbs_per ?? '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{food.fat_per ?? '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{food.default_qty ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${food.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {food.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        {canManage && (
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit food" onClick={() => navigate(`/foods/${food.id}/edit`)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" title="Delete food" onClick={() => setDeleteTarget(food)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import preview modal */}
      {parsedRows && (
        <ImportPreviewModal
          fileName={importFileName}
          rows={parsedRows}
          onConfirm={(validRows) => importMutation.mutate(validRows)}
          onClose={() => {
            setParsedRows(null)
            setImportFileName('')
            if (fileInputRef.current) fileInputRef.current.value = ''
          }}
          isLoading={importMutation.isPending}
        />
      )}

      {/* Delete confirm */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete Food Item"
        description={`Delete ${deleteTarget?.name ?? 'this item'}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
