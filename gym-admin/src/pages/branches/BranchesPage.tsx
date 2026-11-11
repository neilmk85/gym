import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/api/client'
import type { Branch } from '@/types/branch.types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, MapPin, Phone, Mail, Building2 } from 'lucide-react'
import { toast } from 'sonner'

const branchApi = {
  list: () => apiFetch<Branch[]>('/branches'),
  create: (data: Partial<Branch>) => apiFetch<Branch>('/branches', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Branch>) => apiFetch<Branch>(`/branches/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch<{ status: string }>(`/branches/${id}`, { method: 'DELETE' }),
}

export default function BranchesPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => branchApi.list(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => branchApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['branches'] }); toast.success('Branch removed') },
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Branches</h1>
        <Button size="sm" onClick={() => navigate('/branches/new')}><Plus className="w-4 h-4 mr-2" />Add Branch</Button>
      </div>

      {branches.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Building2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>No branches yet. Add your first location.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map((b: Branch) => (
            <Card key={b.id}>
              <CardContent className="pt-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-semibold text-lg">{b.name}</p>
                    {(b.city || b.state) && (
                      <p className="text-sm text-muted-foreground">{[b.city, b.state].filter(Boolean).join(', ')}</p>
                    )}
                  </div>
                  <Building2 className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  {b.address && <p className="flex items-center gap-1"><MapPin className="w-3 h-3" />{b.address}</p>}
                  {b.phone && <p className="flex items-center gap-1"><Phone className="w-3 h-3" />{b.phone}</p>}
                  {b.email && <p className="flex items-center gap-1"><Mail className="w-3 h-3" />{b.email}</p>}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3 text-red-600 hover:text-red-700 hover:bg-red-50 w-full"
                  onClick={() => deleteMutation.mutate(b.id)}
                  disabled={deleteMutation.isPending}
                >
                  Remove Branch
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
