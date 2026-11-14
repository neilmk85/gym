import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Pencil, Trash2, X, Building2, Phone, Mail,
  MapPin, FileText, CreditCard, CheckCircle2, XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SearchInput } from '@/components/shared/SearchInput'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { vendorsApi, type Vendor } from '@/api/vendors.api'

const VENDOR_CATEGORIES = ['Equipment', 'Supplements', 'Maintenance', 'Cleaning', 'Stationery', 'IT & Tech', 'Food & Beverage', 'Uniforms', 'Marketing', 'Other']
const PAYMENT_TERMS = ['Immediate', 'Net 7', 'Net 15', 'Net 30', 'Net 45', 'Net 60', 'Advance']

const schema = z.object({
  name:          z.string().min(1, 'Required'),
  contact_name:  z.string().optional(),
  phone:         z.string().min(10, 'Enter at least 10 digits'),
  email:         z.string().email('Invalid email').optional().or(z.literal('')),
  address:       z.string().optional(),
  city:          z.string().optional(),
  state:         z.string().optional(),
  pincode:       z.string().optional(),
  gst_number:    z.string().optional(),
  pan_number:    z.string().optional(),
  category:      z.string().min(1, 'Required'),
  payment_terms: z.string().optional(),
  credit_limit:  z.coerce.number().optional(),
  bank_name:     z.string().optional(),
  bank_account:  z.string().optional(),
  bank_ifsc:     z.string().optional(),
  status:        z.enum(['active', 'inactive']),
  notes:         z.string().optional(),
})

type FormValues = z.infer<typeof schema>

const selectClass = 'w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

// ── Vendor Form Modal ─────────────────────────────────────────────────────────

function VendorForm({ item, onSave, onClose }: {
  item: Vendor | null
  onSave: () => void
  onClose: () => void
}) {
  const qc = useQueryClient()
  const isEdit = !!item
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: item ? {
      name: item.name, contact_name: item.contact_name ?? '', phone: item.phone,
      email: item.email ?? '', address: item.address ?? '', city: item.city ?? '',
      state: item.state ?? '', pincode: item.pincode ?? '', gst_number: item.gst_number ?? '',
      pan_number: item.pan_number ?? '', category: item.category,
      payment_terms: item.payment_terms ?? '', credit_limit: item.credit_limit,
      bank_name: item.bank_name ?? '', bank_account: item.bank_account ?? '',
      bank_ifsc: item.bank_ifsc ?? '', status: item.status, notes: item.notes ?? '',
    } : {
      name: '', contact_name: '', phone: '', email: '', address: '', city: '',
      state: '', pincode: '', gst_number: '', pan_number: '', category: 'Equipment',
      payment_terms: 'Net 30', credit_limit: undefined, bank_name: '', bank_account: '',
      bank_ifsc: '', status: 'active', notes: '',
    },
  })

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => vendorsApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendors'] }); toast.success('Vendor added'); onSave() },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => vendorsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendors'] }); toast.success('Vendor updated'); onSave() },
  })

  const onSubmit = (data: FormValues) => {
    const payload: Record<string, unknown> = { ...data, email: data.email || undefined }
    if (isEdit && item) {
      updateMutation.mutate({ id: item.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold">{isEdit ? 'Edit Vendor' : 'Add Vendor'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-5">

          {/* Basic Info */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Basic Information</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Company / Vendor Name <span className="text-destructive">*</span></Label>
                <Input {...register('name')} placeholder="e.g. Kore Fitness Pvt Ltd" />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Contact Person</Label>
                <Input {...register('contact_name')} placeholder="Primary contact name" />
              </div>
              <div className="space-y-1.5">
                <Label>Category <span className="text-destructive">*</span></Label>
                <select {...register('category')} className={selectClass}>
                  {VENDOR_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Phone <span className="text-destructive">*</span></Label>
                <Input {...register('phone')} placeholder="+91 98765 43210" />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input {...register('email')} type="email" placeholder="vendor@company.com" />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Address</p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Street Address</Label>
                <Textarea {...register('address')} placeholder="Building, street, area…" rows={2} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>City</Label>
                  <Input {...register('city')} placeholder="City" />
                </div>
                <div className="space-y-1.5">
                  <Label>State</Label>
                  <Input {...register('state')} placeholder="State" />
                </div>
                <div className="space-y-1.5">
                  <Label>Pincode</Label>
                  <Input {...register('pincode')} placeholder="110001" />
                </div>
              </div>
            </div>
          </div>

          {/* Tax & Compliance */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Tax & Compliance</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>GST Number</Label>
                <Input {...register('gst_number')} placeholder="29AABCK1234A1Z5" className="uppercase" />
              </div>
              <div className="space-y-1.5">
                <Label>PAN Number</Label>
                <Input {...register('pan_number')} placeholder="ABCDE1234F" className="uppercase" />
              </div>
            </div>
          </div>

          {/* Payment Terms */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Payment & Terms</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Payment Terms</Label>
                <select {...register('payment_terms')} className={selectClass}>
                  <option value="">Select…</option>
                  {PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Credit Limit (₹)</Label>
                <Input {...register('credit_limit')} type="number" min={0} step={1000} placeholder="0" />
              </div>
            </div>
          </div>

          {/* Bank Details */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Bank Details</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Bank Name</Label>
                <Input {...register('bank_name')} placeholder="e.g. HDFC Bank" />
              </div>
              <div className="space-y-1.5">
                <Label>Account Number</Label>
                <Input {...register('bank_account')} placeholder="Account number" />
              </div>
              <div className="space-y-1.5">
                <Label>IFSC Code</Label>
                <Input {...register('bank_ifsc')} placeholder="HDFC0001234" className="uppercase" />
              </div>
            </div>
          </div>

          {/* Status & Notes */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <select {...register('status')} className={selectClass}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input {...register('notes')} placeholder="Any remarks…" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">{isEdit ? 'Save Changes' : 'Add Vendor'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function VendorsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [formVendor, setFormVendor] = useState<Vendor | 'new' | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => vendorsApi.list({ per_page: 500 }),
  })

  const vendors = data?.data ?? []

  const deleteMutation = useMutation({
    mutationFn: (id: number) => vendorsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendors'] }); toast.success('Vendor deleted') },
  })

  const filtered = useMemo(() => vendors.filter(v => {
    const matchCat = categoryFilter === 'all' || v.category === categoryFilter
    const matchStatus = statusFilter === 'all' || v.status === statusFilter
    const q = search.toLowerCase()
    const matchSearch = !q || v.name.toLowerCase().includes(q) ||
      (v.contact_name ?? '').toLowerCase().includes(q) ||
      v.phone.includes(q) ||
      (v.email ?? '').toLowerCase().includes(q) ||
      (v.city ?? '').toLowerCase().includes(q)
    return matchCat && matchStatus && matchSearch
  }), [vendors, search, categoryFilter, statusFilter])

  const activeCount = vendors.filter(v => v.status === 'active').length
  const categories = new Set(vendors.map(v => v.category)).size

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Delete vendor "${name}"? This cannot be undone.`)) return
    deleteMutation.mutate(id)
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="relative overflow-hidden -mx-6 -mt-6 bg-gradient-to-br from-indigo-700 via-blue-700 to-cyan-700 text-white">
        <div className="relative px-6 py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold tracking-widest uppercase text-white/55 mb-1.5">Purchases</p>
              <div className="flex items-center gap-2.5 mb-1">
                <Building2 className="w-5 h-5 opacity-80" />
                <h1 className="text-2xl font-bold tracking-tight">Vendors</h1>
              </div>
              <p className="text-sm text-white/65">Supplier directory — companies you buy from</p>
            </div>
            <Button onClick={() => setFormVendor('new')} className="shrink-0 bg-white text-[#005f7a] hover:bg-white/90">
              <Plus className="w-4 h-4 mr-1.5" /> Add Vendor
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/15 border-t border-white/15">
          <div className="px-5 py-4">
            <p className="text-xl font-bold">{vendors.length}</p>
            <p className="text-xs font-medium text-white/85 mt-1">Total Vendors</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xl font-bold text-emerald-300">{activeCount}</p>
            <p className="text-xs font-medium text-white/85 mt-1">Active</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xl font-bold text-amber-300">{vendors.length - activeCount}</p>
            <p className="text-xs font-medium text-white/85 mt-1">Inactive</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xl font-bold text-sky-300">{categories}</p>
            <p className="text-xs font-medium text-white/85 mt-1">Categories</p>
          </div>
        </div>
        <div className="absolute -right-6 -top-6 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute right-20 -bottom-8 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <SearchInput placeholder="Search vendors…" value={search} onChange={setSearch} className="w-64" />
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="all">All Categories</option>
          {VENDOR_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Vendors table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-sidebar">
                <tr>
                  {['Vendor', 'Category', 'Contact Person', 'Phone', 'Email', 'City', 'GST Number', 'PAN', 'Payment Terms', 'Credit Limit', 'Bank', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-light text-sidebar-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="text-center py-14 text-muted-foreground">
                      {search || categoryFilter !== 'all' || statusFilter !== 'all'
                        ? 'No vendors match your filters.'
                        : 'No vendors yet. Click "Add Vendor" to get started.'}
                    </td>
                  </tr>
                ) : filtered.map(v => (
                  <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-sm">{v.name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs whitespace-nowrap">{v.category}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {v.contact_name || <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="w-3 h-3 shrink-0" />
                        {v.phone}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {v.email
                        ? <div className="flex items-center gap-1.5 text-muted-foreground"><Mail className="w-3 h-3 shrink-0" /><span className="max-w-[160px] truncate">{v.email}</span></div>
                        : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {v.city || v.state
                        ? <div className="flex items-center gap-1"><MapPin className="w-3 h-3 shrink-0" />{[v.city, v.state].filter(Boolean).join(', ')}</div>
                        : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {v.gst_number
                        ? <span className="font-mono text-xs text-muted-foreground">{v.gst_number}</span>
                        : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {v.pan_number
                        ? <span className="font-mono text-xs text-muted-foreground">{v.pan_number}</span>
                        : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {v.payment_terms || <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {v.credit_limit ? `₹${v.credit_limit.toLocaleString()}` : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {v.bank_name
                        ? <div className="text-xs text-muted-foreground">
                            <p>{v.bank_name}</p>
                            {v.bank_ifsc && <p className="font-mono text-muted-foreground/60">{v.bank_ifsc}</p>}
                          </div>
                        : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${
                        v.status === 'active'
                          ? 'bg-green-100 text-green-700 border-green-200'
                          : 'bg-gray-100 text-gray-500 border-gray-200'
                      }`}>
                        {v.status === 'active' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {v.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button title="Edit" onClick={() => setFormVendor(v)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button title="Delete" onClick={() => handleDelete(v.id, v.name)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="px-4 py-3 border-t text-xs text-muted-foreground">
              Showing {filtered.length} of {vendors.length} vendors
            </div>
          )}
        </CardContent>
      </Card>

      {formVendor !== null && (
        <VendorForm
          item={formVendor === 'new' ? null : formVendor}
          onSave={() => setFormVendor(null)}
          onClose={() => setFormVendor(null)}
        />
      )}
    </div>
  )
}
