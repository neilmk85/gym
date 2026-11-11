import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { billingApi, type TaxProfile, type TaxRate } from '@/api/billing.api'
import { QUERY_KEYS } from '@/lib/constants'

const FACILITY_ID = 1

export default function TaxSettingsPage() {
  const qc = useQueryClient()

  const { data: profileData, isLoading: loadingProfile } = useQuery({
    queryKey: QUERY_KEYS.taxProfile(FACILITY_ID),
    queryFn: () => billingApi.getTaxProfile(FACILITY_ID),
    retry: false,
  })

  const { data: ratesData, isLoading: loadingRates } = useQuery({
    queryKey: QUERY_KEYS.taxRates,
    queryFn: () => billingApi.listTaxRates(),
  })

  const profile = profileData as TaxProfile | undefined
  const rates: TaxRate[] = (ratesData as { tax_rates?: TaxRate[] })?.tax_rates ?? []

  const [form, setForm] = useState({
    legal_name: '',
    gstin: '',
    address: '',
    invoice_prefix: 'INV',
    receipt_prefix: 'RCP',
    credit_note_prefix: 'CN',
    financial_year_start: '04-01',
    tax_inclusive: false,
  })

  const [newRate, setNewRate] = useState({
    name: '',
    rate: '',
    cgst_rate: '',
    sgst_rate: '',
    igst_rate: '',
    is_default: false,
  })

  const [saved, setSaved] = useState(false)
  const [rateSaved, setRateSaved] = useState(false)

  useEffect(() => {
    if (profile) {
      setForm({
        legal_name: profile.legal_name ?? '',
        gstin: profile.gstin ?? '',
        address: profile.address ?? '',
        invoice_prefix: profile.invoice_prefix ?? 'INV',
        receipt_prefix: profile.receipt_prefix ?? 'RCP',
        credit_note_prefix: profile.credit_note_prefix ?? 'CN',
        financial_year_start: profile.financial_year_start ?? '04-01',
        tax_inclusive: profile.tax_inclusive ?? false,
      })
    }
  }, [profile])

  const upsertMutation = useMutation({
    mutationFn: () => billingApi.upsertTaxProfile(form, FACILITY_ID),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.taxProfile(FACILITY_ID) })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const createRateMutation = useMutation({
    mutationFn: () => billingApi.createTaxRate({
      name: newRate.name,
      rate: parseFloat(newRate.rate) || 0,
      cgst_rate: parseFloat(newRate.cgst_rate) || 0,
      sgst_rate: parseFloat(newRate.sgst_rate) || 0,
      igst_rate: parseFloat(newRate.igst_rate) || 0,
      is_default: newRate.is_default,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.taxRates })
      setNewRate({ name: '', rate: '', cgst_rate: '', sgst_rate: '', igst_rate: '', is_default: false })
      setRateSaved(true)
      setTimeout(() => setRateSaved(false), 3000)
    },
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Tax & Billing Settings" subtitle="Configure GST profile and tax rates for your facility" />

      {/* Facility GST Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Facility GST Profile</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingProfile ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-9 w-full" />)}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Legal Business Name *</Label>
                <Input value={form.legal_name} onChange={e => setForm(f => ({ ...f, legal_name: e.target.value }))} placeholder="Your Gym Pvt. Ltd." />
              </div>
              <div className="space-y-1">
                <Label>GSTIN</Label>
                <Input value={form.gstin} onChange={e => setForm(f => ({ ...f, gstin: e.target.value }))} placeholder="22AAAAA0000A1Z5" className="font-mono" />
              </div>
              <div className="col-span-full space-y-1">
                <Label>Registered Address</Label>
                <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Plot 42, MG Road, Mumbai - 400001" />
              </div>
              <div className="space-y-1">
                <Label>Invoice Prefix</Label>
                <Input value={form.invoice_prefix} onChange={e => setForm(f => ({ ...f, invoice_prefix: e.target.value }))} placeholder="INV" className="font-mono" />
              </div>
              <div className="space-y-1">
                <Label>Receipt Prefix</Label>
                <Input value={form.receipt_prefix} onChange={e => setForm(f => ({ ...f, receipt_prefix: e.target.value }))} placeholder="RCP" className="font-mono" />
              </div>
              <div className="space-y-1">
                <Label>Credit Note Prefix</Label>
                <Input value={form.credit_note_prefix} onChange={e => setForm(f => ({ ...f, credit_note_prefix: e.target.value }))} placeholder="CN" className="font-mono" />
              </div>
              <div className="space-y-1">
                <Label>Financial Year Start (MM-DD)</Label>
                <Input value={form.financial_year_start} onChange={e => setForm(f => ({ ...f, financial_year_start: e.target.value }))} placeholder="04-01" className="font-mono" />
              </div>
              <div className="col-span-full flex items-center gap-2">
                <input
                  type="checkbox"
                  id="tax-inclusive"
                  checked={form.tax_inclusive}
                  onChange={e => setForm(f => ({ ...f, tax_inclusive: e.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="tax-inclusive" className="cursor-pointer">Prices are tax-inclusive</Label>
              </div>

              <div className="col-span-full flex items-center gap-3">
                <Button
                  onClick={() => upsertMutation.mutate()}
                  disabled={!form.legal_name || upsertMutation.isPending}
                >
                  {upsertMutation.isPending ? 'Saving...' : 'Save Profile'}
                </Button>
                {saved && <span className="text-sm text-green-600">Saved successfully!</span>}
                {upsertMutation.isError && (
                  <span className="text-sm text-destructive">Save failed. Check GSTIN and try again.</span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tax Rates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">GST Tax Rates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingRates ? (
            <Skeleton className="h-20 w-full" />
          ) : rates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tax rates configured. Add the standard GST rates below.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {['Name', 'Total %', 'CGST %', 'SGST %', 'IGST %', 'Default'].map(h => (
                    <th key={h} className="text-left py-2 font-medium text-muted-foreground text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rates.map(rate => (
                  <tr key={rate.id} className="border-b border-dashed">
                    <td className="py-2 font-medium">{rate.name}</td>
                    <td className="py-2">{rate.rate}%</td>
                    <td className="py-2">{rate.cgst_rate}%</td>
                    <td className="py-2">{rate.sgst_rate}%</td>
                    <td className="py-2">{rate.igst_rate}%</td>
                    <td className="py-2">{rate.is_default ? '✓' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Add new rate */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-3">Add Tax Rate</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input value={newRate.name} onChange={e => setNewRate(r => ({ ...r, name: e.target.value }))} placeholder="GST 18%" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Total Rate %</Label>
                <Input type="number" value={newRate.rate} onChange={e => setNewRate(r => ({ ...r, rate: e.target.value }))} placeholder="18" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">CGST %</Label>
                <Input type="number" value={newRate.cgst_rate} onChange={e => setNewRate(r => ({ ...r, cgst_rate: e.target.value }))} placeholder="9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">SGST %</Label>
                <Input type="number" value={newRate.sgst_rate} onChange={e => setNewRate(r => ({ ...r, sgst_rate: e.target.value }))} placeholder="9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">IGST %</Label>
                <Input type="number" value={newRate.igst_rate} onChange={e => setNewRate(r => ({ ...r, igst_rate: e.target.value }))} placeholder="0" />
              </div>
              <div className="flex items-end pb-1 gap-2">
                <input
                  type="checkbox"
                  id="rate-default"
                  checked={newRate.is_default}
                  onChange={e => setNewRate(r => ({ ...r, is_default: e.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="rate-default" className="text-xs cursor-pointer">Set as default</Label>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-3">
              <Button
                size="sm"
                onClick={() => createRateMutation.mutate()}
                disabled={!newRate.name || createRateMutation.isPending}
              >
                {createRateMutation.isPending ? 'Adding...' : 'Add Rate'}
              </Button>
              {rateSaved && <span className="text-sm text-green-600">Rate added!</span>}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
