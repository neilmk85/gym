import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { vendorsApi } from '@/api/vendors.api'
import { purchasesApi } from '@/api/purchases.api'
import {
  calcTotals, newLineItem,
  LINE_ITEM_CATEGORIES, LINE_ITEM_UNITS,
  PURCHASE_STATUSES, PAYMENT_STATUSES, PURCHASE_PAYMENT_METHODS,
  type PurchaseLineItem,
} from '@/lib/purchase-store'

// ── Schema (header fields only — items managed in state) ─────────────────────

const schema = z.object({
  vendor_id:            z.string().optional(),
  vendor_name:          z.string().min(1, 'Vendor name is required'),
  purchase_date:        z.string().min(1, 'Required'),
  expected_delivery:    z.string().optional(),
  received_date:        z.string().optional(),
  invoice_number:       z.string().optional(),
  additional_discount:  z.coerce.number().min(0),
  tax_percent:          z.coerce.number().min(0).max(100),
  shipping_charges:     z.coerce.number().min(0),
  amount_paid:          z.coerce.number().min(0),
  payment_method:       z.string().optional(),
  payment_date:         z.string().optional(),
  payment_reference:    z.string().optional(),
  payment_status:       z.enum(['pending', 'partial', 'paid']),
  status:               z.enum(['draft', 'ordered', 'received', 'partially_received', 'cancelled']),
  received_by:          z.string().optional(),
  notes:                z.string().optional(),
})

type FormValues = z.infer<typeof schema>

const selectClass = 'w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

// ── Line item row component ───────────────────────────────────────────────────

function LineItemRow({
  item,
  index,
  onChange,
  onRemove,
  canRemove,
}: {
  item: PurchaseLineItem
  index: number
  onChange: (updated: PurchaseLineItem) => void
  onRemove: () => void
  canRemove: boolean
}) {
  const update = (field: Partial<PurchaseLineItem>) => {
    const updated = { ...item, ...field }
    // Recalc total
    const lineTotal = Math.max(0, (updated.quantity * updated.unit_price) - (updated.discount_amount * updated.quantity))
    const withTax = lineTotal + (lineTotal * (updated.tax_percent / 100))
    onChange({ ...updated, total_price: parseFloat(withTax.toFixed(2)) })
  }

  return (
    <tr className="border-b last:border-0 hover:bg-muted/20">
      <td className="px-3 py-2.5 text-muted-foreground text-xs text-center w-8">{index + 1}</td>
      <td className="px-2 py-2.5 min-w-[180px]">
        <Input
          value={item.item_name}
          onChange={e => update({ item_name: e.target.value })}
          placeholder="Item name"
          className="h-8 text-sm"
        />
        <Input
          value={item.description ?? ''}
          onChange={e => update({ description: e.target.value })}
          placeholder="Description (optional)"
          className="h-7 text-xs mt-1 text-muted-foreground"
        />
      </td>
      <td className="px-2 py-2.5 w-36">
        <select value={item.category} onChange={e => update({ category: e.target.value })}
          className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring">
          {LINE_ITEM_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </td>
      <td className="px-2 py-2.5 w-20">
        <Input type="number" min={1} value={item.quantity}
          onChange={e => update({ quantity: parseFloat(e.target.value) || 1 })}
          className="h-8 text-sm text-right" />
      </td>
      <td className="px-2 py-2.5 w-24">
        <select value={item.unit} onChange={e => update({ unit: e.target.value as any })}
          className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring">
          {LINE_ITEM_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </td>
      <td className="px-2 py-2.5 w-28">
        <Input type="number" min={0} step={0.01} value={item.unit_price}
          onChange={e => update({ unit_price: parseFloat(e.target.value) || 0 })}
          className="h-8 text-sm text-right" />
      </td>
      <td className="px-2 py-2.5 w-24">
        <Input type="number" min={0} step={0.01} value={item.discount_amount}
          onChange={e => update({ discount_amount: parseFloat(e.target.value) || 0 })}
          placeholder="per unit"
          className="h-8 text-sm text-right" />
      </td>
      <td className="px-2 py-2.5 w-20">
        <Input type="number" min={0} max={100} value={item.tax_percent}
          onChange={e => update({ tax_percent: parseFloat(e.target.value) || 0 })}
          className="h-8 text-sm text-right" />
      </td>
      <td className="px-3 py-2.5 w-28 text-right font-semibold text-sm">
        {formatCurrency(item.total_price)}
      </td>
      <td className="px-2 py-2.5 w-10">
        {canRemove && (
          <button type="button" onClick={onRemove}
            className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </td>
    </tr>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PurchaseFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const isEdit = !!id && id !== 'new'

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['purchases', id],
    queryFn: () => purchasesApi.getById(Number(id)),
    enabled: isEdit,
  })

  const { data: vendorsData } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => vendorsApi.list({ per_page: 500, status: 'active' }),
  })
  const vendors = vendorsData?.data ?? []

  const [items, setItems] = useState<PurchaseLineItem[]>([newLineItem()])

  const { register, handleSubmit, watch, setValue, reset, control, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      vendor_id: '', vendor_name: '',
      purchase_date: new Date().toISOString().split('T')[0],
      expected_delivery: '', received_date: '', invoice_number: '',
      additional_discount: 0, tax_percent: 18, shipping_charges: 0,
      amount_paid: 0, payment_method: '', payment_date: '', payment_reference: '',
      payment_status: 'pending', status: 'draft', received_by: '', notes: '',
    },
  })

  useEffect(() => {
    if (existing) {
      reset({
        vendor_id:           existing.vendor_id ? String(existing.vendor_id) : '',
        vendor_name:         existing.vendor_name,
        purchase_date:       existing.purchase_date?.slice(0, 10) ?? '',
        expected_delivery:   existing.expected_delivery?.slice(0, 10) ?? '',
        received_date:       existing.received_date?.slice(0, 10) ?? '',
        invoice_number:      existing.invoice_number ?? '',
        additional_discount: existing.additional_discount,
        tax_percent:         existing.tax_percent,
        shipping_charges:    existing.shipping_charges,
        amount_paid:         existing.amount_paid,
        payment_method:      existing.payment_method ?? '',
        payment_date:        existing.payment_date?.slice(0, 10) ?? '',
        payment_reference:   existing.payment_reference ?? '',
        payment_status:      existing.payment_status as FormValues['payment_status'],
        status:              existing.status as FormValues['status'],
        received_by:         existing.received_by ?? '',
        notes:               existing.notes ?? '',
      })
      if (existing.items?.length) {
        setItems(existing.items.map(i => ({
          id: String(i.id ?? crypto.randomUUID()),
          item_name: i.item_name,
          description: i.description,
          category: i.category ?? 'Equipment',
          quantity: i.quantity,
          unit: i.unit as PurchaseLineItem['unit'],
          unit_price: i.unit_price,
          discount_amount: i.discount_amount,
          tax_percent: i.tax_percent,
          total_price: i.total_price,
        })))
      }
    }
  }, [existing, reset])

  // Derived totals
  const additionalDiscount = parseFloat(String(watch('additional_discount'))) || 0
  const taxPercent         = parseFloat(String(watch('tax_percent'))) || 0
  const shippingCharges    = parseFloat(String(watch('shipping_charges'))) || 0
  const amountPaid         = parseFloat(String(watch('amount_paid'))) || 0

  const { subtotal, taxAmount, total } = calcTotals(items, additionalDiscount, taxPercent, shippingCharges)
  const balance = total - amountPaid

  // Auto-set payment status
  useEffect(() => {
    if (total <= 0) return
    if (amountPaid <= 0) setValue('payment_status', 'pending')
    else if (amountPaid >= total) setValue('payment_status', 'paid')
    else setValue('payment_status', 'partial')
  }, [amountPaid, total, setValue])

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => purchasesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchases'] })
      toast.success('Purchase order created')
      navigate('/purchases/direct')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => purchasesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchases'] })
      toast.success('Purchase order updated')
      navigate('/purchases/direct')
    },
  })

  const handleVendorSelect = (vendorId: string) => {
    const v = vendors.find(v => String(v.id) === vendorId)
    setValue('vendor_id', vendorId)
    if (v) setValue('vendor_name', v.name)
  }

  const addItem = () => setItems(prev => [...prev, newLineItem()])
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))
  const updateItem = useCallback((idx: number, updated: PurchaseLineItem) => {
    setItems(prev => prev.map((item, i) => i === idx ? updated : item))
  }, [])

  if (isEdit && loadingExisting) {
    return <div className="text-center py-14 text-muted-foreground">Loading…</div>
  }

  const onSubmit = (data: FormValues) => {
    if (items.some(i => !i.item_name.trim())) {
      toast.error('All line items must have a name')
      return
    }

    const apiItems = items.map(({ id: _localId, ...rest }) => rest)

    const payload: Record<string, unknown> = {
      vendor_id:           data.vendor_id ? Number(data.vendor_id) : undefined,
      vendor_name:         data.vendor_name,
      purchase_date:       data.purchase_date,
      expected_delivery:   data.expected_delivery || undefined,
      received_date:       data.received_date || undefined,
      invoice_number:      data.invoice_number || undefined,
      items:               apiItems,
      subtotal,
      item_discount:       items.reduce((s, i) => s + i.discount_amount * i.quantity, 0),
      additional_discount: additionalDiscount,
      tax_percent:         taxPercent,
      tax_amount:          taxAmount,
      shipping_charges:    shippingCharges,
      total_amount:        total,
      amount_paid:         amountPaid,
      payment_method:      data.payment_method || undefined,
      payment_date:        data.payment_date || undefined,
      payment_reference:   data.payment_reference || undefined,
      payment_status:      data.payment_status,
      status:              data.status,
      received_by:         data.received_by || undefined,
      notes:               data.notes || undefined,
    }

    if (isEdit && id) {
      updateMutation.mutate({ id: Number(id), data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" title="Back" onClick={() => navigate('/purchases/direct')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {isEdit ? `Edit ${existing?.purchase_number ?? 'Purchase Order'}` : 'New Purchase Order'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isEdit ? 'Update purchase order details' : 'Record a purchase from a vendor'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

        {/* ── Purchase Details ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Purchase Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Vendor selector */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Select Vendor</Label>
                <select value={watch('vendor_id')} onChange={e => handleVendorSelect(e.target.value)} className={selectClass}>
                  <option value="">— Select from directory —</option>
                  {vendors.map(v => (
                    <option key={v.id} value={String(v.id)}>{v.name} · {v.category}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Vendor Name <span className="text-destructive">*</span></Label>
                <Input {...register('vendor_name')} placeholder="Or type a vendor name directly" />
                {errors.vendor_name && <p className="text-xs text-destructive">{errors.vendor_name.message}</p>}
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Info className="w-3 h-3" /> Auto-filled from directory, or type manually
                </p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label>Purchase Date <span className="text-destructive">*</span></Label>
                <Input {...register('purchase_date')} type="date" />
                {errors.purchase_date && <p className="text-xs text-destructive">{errors.purchase_date.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Expected Delivery</Label>
                <Input {...register('expected_delivery')} type="date" />
              </div>
              <div className="space-y-1.5">
                <Label>Actual Receipt Date</Label>
                <Input {...register('received_date')} type="date" />
              </div>
              <div className="space-y-1.5">
                <Label>Vendor Invoice #</Label>
                <Input {...register('invoice_number')} placeholder="Vendor's invoice number" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Order Status</Label>
                <select {...register('status')} className={selectClass}>
                  {Object.entries(PURCHASE_STATUSES).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Received By</Label>
                <Input {...register('received_by')} placeholder="Staff name who received" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Line Items ── */}
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Items Purchased</CardTitle>
            <Button type="button" size="sm" variant="outline" onClick={addItem}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead className="bg-sidebar text-sidebar-foreground">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-xs font-light uppercase tracking-wide w-8">#</th>
                    <th className="px-2 py-2.5 text-left text-xs font-light uppercase tracking-wide">Item Name & Description</th>
                    <th className="px-2 py-2.5 text-left text-xs font-light uppercase tracking-wide">Category</th>
                    <th className="px-2 py-2.5 text-right text-xs font-light uppercase tracking-wide">Qty</th>
                    <th className="px-2 py-2.5 text-left text-xs font-light uppercase tracking-wide">Unit</th>
                    <th className="px-2 py-2.5 text-right text-xs font-light uppercase tracking-wide">Unit Price (₹)</th>
                    <th className="px-2 py-2.5 text-right text-xs font-light uppercase tracking-wide">Discount/unit</th>
                    <th className="px-2 py-2.5 text-right text-xs font-light uppercase tracking-wide">GST %</th>
                    <th className="px-2 py-2.5 text-right text-xs font-light uppercase tracking-wide">Total (₹)</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <LineItemRow
                      key={item.id}
                      item={item}
                      index={idx}
                      onChange={updated => updateItem(idx, updated)}
                      onRemove={() => removeItem(idx)}
                      canRemove={items.length > 1}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals section */}
            <div className="border-t p-5 flex justify-end">
              <div className="w-80 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Additional Discount (₹)</span>
                  <Input
                    type="number" min={0} step={1}
                    {...register('additional_discount')}
                    className="w-28 h-7 text-sm text-right"
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">GST / Tax (%)</span>
                  <Input
                    type="number" min={0} max={100} step={0.5}
                    {...register('tax_percent')}
                    className="w-28 h-7 text-sm text-right"
                  />
                </div>
                <div className="flex justify-between text-muted-foreground text-xs">
                  <span>Tax Amount</span>
                  <span>{formatCurrency(taxAmount)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Shipping / Freight (₹)</span>
                  <Input
                    type="number" min={0} step={1}
                    {...register('shipping_charges')}
                    className="w-28 h-7 text-sm text-right"
                  />
                </div>
                <div className="flex justify-between font-bold text-base pt-2 border-t">
                  <span>Total Amount</span>
                  <span className="text-primary">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Payment Details ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Payment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label>Amount Paid (₹)</Label>
                <Input type="number" min={0} max={total} step={0.01}
                  {...register('amount_paid')}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Payment Method</Label>
                <select {...register('payment_method')} className={selectClass}>
                  <option value="">— None —</option>
                  {Object.entries(PURCHASE_PAYMENT_METHODS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Payment Date</Label>
                <Input {...register('payment_date')} type="date" />
              </div>
              <div className="space-y-1.5">
                <Label>Reference / Cheque #</Label>
                <Input {...register('payment_reference')} placeholder="UPI ref / Cheque number" />
              </div>
            </div>

            {/* Payment summary strip */}
            <div className="rounded-xl bg-muted/40 p-4 grid grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <p className="font-bold text-lg">{formatCurrency(total)}</p>
                <p className="text-xs text-muted-foreground">Total Amount</p>
              </div>
              <div className="text-center border-x">
                <p className="font-bold text-lg text-green-600">{formatCurrency(amountPaid)}</p>
                <p className="text-xs text-muted-foreground">Amount Paid</p>
              </div>
              <div className="text-center">
                <p className={`font-bold text-lg ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(balance)}</p>
                <p className="text-xs text-muted-foreground">Balance Due</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Payment Status:</span>
              <Controller control={control} name="payment_status" render={({ field }) => (
                <select {...field} className={`${selectClass} w-40`}>
                  {Object.entries(PAYMENT_STATUSES).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              )} />
              <span className="text-xs text-muted-foreground">(auto-set based on amount paid)</span>
            </div>
          </CardContent>
        </Card>

        {/* ── Additional Notes ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Notes & Remarks</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea {...register('notes')} placeholder="Any additional notes about this purchase — quality issues, partial delivery, special terms…" rows={3} />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-between gap-4">
          <Button type="button" variant="outline" onClick={() => navigate('/purchases/direct')}>Cancel</Button>
          <div className="flex gap-2">
            <Button type="submit" onClick={() => setValue('status', 'draft')} variant="outline"
              loading={createMutation.isPending || updateMutation.isPending}>
              Save as Draft
            </Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {isEdit ? 'Update Order' : 'Create Purchase Order'}
            </Button>
          </div>
        </div>

      </form>
    </div>
  )
}
