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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { retentionApi, type ProgressPhoto } from '@/api/retention.api'
import { formatDate } from '@/lib/utils'

export default function ProgressPhotosPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [filterMemberId, setFilterMemberId] = useState<number | null>(null)
  const [lightbox, setLightbox] = useState<ProgressPhoto | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['progress-photos', filterMemberId],
    queryFn: () => filterMemberId
      ? retentionApi.listPhotosByMember(filterMemberId, { per_page: 50 })
      : Promise.resolve({ progress_photos: [] }),
    enabled: !!filterMemberId,
  })

  const photos: ProgressPhoto[] = (data as any)?.progress_photos ?? []

  const deleteMutation = useMutation({
    mutationFn: (id: number) => retentionApi.deletePhoto(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['progress-photos'] }),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Progress Photos" subtitle="Visual progress tracking for members" />
        <Button onClick={() => navigate('/retention/photos/new')}>+ Add Photo</Button>
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

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-48 w-full rounded-lg" />)}
        </div>
      ) : !filterMemberId ? (
        <Card><CardContent className="p-6"><EmptyState title="Enter a Member ID" description="Enter a member ID to view their progress photos." /></CardContent></Card>
      ) : photos.length === 0 ? (
        <Card><CardContent className="p-6"><EmptyState title="No photos" description="No progress photos for this member." /></CardContent></Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.map(p => (
            <div key={p.id} className="group relative rounded-lg overflow-hidden border bg-card cursor-pointer"
              onClick={() => setLightbox(p)}>
              <img
                src={p.photo_url}
                alt={`Progress photo ${p.id}`}
                className="w-full h-48 object-cover"
                onError={e => { (e.target as HTMLImageElement).src = 'https://placehold.co/300x200?text=Photo' }}
              />
              <div className="p-2">
                <p className="text-xs font-medium">{formatDate(p.photo_date)}</p>
                {p.angle && <Badge variant="secondary" className="text-xs">{p.angle}</Badge>}
              </div>
              <Button
                size="sm"
                variant="destructive"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={e => { e.stopPropagation(); deleteMutation.mutate(p.id) }}
              >
                ×
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      <Dialog open={!!lightbox} onOpenChange={() => setLightbox(null)}>
        <DialogContent className="max-w-2xl">
          {lightbox && (
            <>
              <DialogHeader>
                <DialogTitle>{formatDate(lightbox.photo_date)} {lightbox.angle && `· ${lightbox.angle}`}</DialogTitle>
              </DialogHeader>
              <img src={lightbox.photo_url} alt="Progress photo" className="w-full max-h-[70vh] object-contain rounded"
                onError={e => { (e.target as HTMLImageElement).src = 'https://placehold.co/600x400?text=Photo' }} />
              {lightbox.notes && <p className="text-sm text-muted-foreground">{lightbox.notes}</p>}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
