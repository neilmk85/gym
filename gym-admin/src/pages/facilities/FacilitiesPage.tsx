import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { facilitiesApi } from '@/api/facilities.api'
import { QUERY_KEYS } from '@/lib/constants'
import { MapPin, Phone, Mail } from 'lucide-react'

export default function FacilitiesPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: QUERY_KEYS.facilities,
    queryFn: () => facilitiesApi.list(),
  })

  const facilities = (data as { facilities?: unknown[] })?.facilities ?? []

  return (
    <div>
      <PageHeader title="Facilities" subtitle="Manage gym facilities and locations" />

      {isError && (
        <p className="text-sm text-destructive mb-4">Failed to load facilities. Please try again.</p>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6 space-y-3">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : facilities.length === 0 ? (
        <EmptyState title="No facilities found" description="No gym facilities have been added yet." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {facilities.map((facility, idx) => {
            const f = facility as {
              id?: number
              name?: string
              address?: string
              city?: string
              country?: string
              phone?: string
              email?: string
              is_active?: boolean
            }
            return (
              <Card key={f.id ?? idx}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-semibold">{f.name ?? 'Unnamed Facility'}</h3>
                    <StatusBadge status={f.is_active ? 'active' : 'inactive'} />
                  </div>

                  <div className="space-y-2 text-sm text-muted-foreground">
                    {(f.address || f.city || f.country) && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>
                          {[f.address, f.city, f.country].filter(Boolean).join(', ')}
                        </span>
                      </div>
                    )}
                    {f.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 shrink-0" />
                        <span>{f.phone}</span>
                      </div>
                    )}
                    {f.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 shrink-0" />
                        <span>{f.email}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
