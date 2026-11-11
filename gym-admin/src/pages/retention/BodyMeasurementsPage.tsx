import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { retentionApi, type BodyMeasurement } from '@/api/retention.api'
import { formatDate } from '@/lib/utils'

export default function BodyMeasurementsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [filterMemberId, setFilterMemberId] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['body-measurements', filterMemberId],
    queryFn: () => filterMemberId
      ? retentionApi.listMeasurementsByMember(filterMemberId, { per_page: 50 })
      : Promise.resolve({ body_measurements: [] }),
    enabled: !!filterMemberId,
  })

  const measurements: BodyMeasurement[] = (data as any)?.body_measurements ?? []

  const deleteMutation = useMutation({
    mutationFn: (id: number) => retentionApi.deleteMeasurement(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['body-measurements'] }),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Body Measurements" subtitle="Track member body metrics over time" />
        <Button onClick={() => navigate('/retention/measurements/new')}>+ Record Measurement</Button>
      </div>

      <div className="flex gap-2 items-center">
        <Label className="text-sm text-muted-foreground whitespace-nowrap">Member ID:</Label>
        <Input
          type="number"
          className="max-w-32"
          placeholder="Member ID"
          onChange={e => setFilterMemberId(parseInt(e.target.value) || null)}
        />
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-6 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : !filterMemberId ? (
            <EmptyState title="Enter a Member ID" description="Enter a member ID to view their measurement history." />
          ) : measurements.length === 0 ? (
            <EmptyState title="No measurements" description="No body measurements recorded for this member." />
          ) : (
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-sidebar">
                <tr>
                  {['Date', 'Weight (kg)', 'Height (cm)', 'BMI', 'Body Fat %', 'Waist (cm)', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {measurements.map(m => (
                  <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{formatDate(m.measured_at)}</td>
                    <td className="px-4 py-3">{m.weight_kg ?? '—'}</td>
                    <td className="px-4 py-3">{m.height_cm ?? '—'}</td>
                    <td className="px-4 py-3">{m.bmi ? m.bmi.toFixed(1) : '—'}</td>
                    <td className="px-4 py-3">{m.body_fat_pct != null ? `${m.body_fat_pct}%` : '—'}</td>
                    <td className="px-4 py-3">{m.waist_cm ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Button size="sm" variant="outline" className="text-destructive"
                        onClick={() => deleteMutation.mutate(m.id)} disabled={deleteMutation.isPending}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
