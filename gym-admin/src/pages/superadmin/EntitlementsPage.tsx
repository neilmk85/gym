import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ShieldCheck, Save, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/PageHeader'
import { superadminApi, type GrantUpdate } from '@/api/superadmin.api'

// Group permissions by their prefix for a cleaner UI
const PERM_GROUPS: Record<string, string[]> = {}

function groupPermissions(permissions: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {}
  for (const p of permissions) {
    const prefix = p.split('.')[0]
    ;(groups[prefix] ??= []).push(p)
  }
  return groups
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  reception: 'Reception',
  manager: 'Manager',
  trainer: 'Trainer',
}

const GROUP_LABELS: Record<string, string> = {
  members: 'Members', memberships: 'Memberships', payments: 'Payments',
  trainers: 'Trainers', classes: 'Classes', bookings: 'Bookings',
  attendance: 'Attendance', reports: 'Reports', staff: 'Staff',
  purchases: 'Purchases', coaching: 'Coaching', crm: 'CRM',
  retention: 'Retention', loyalty: 'Loyalty', settings: 'Settings', compliance: 'Compliance',
  module: 'Module Access',
}

function permLabel(perm: string): string {
  const action = perm.split('.')[1] ?? perm
  return action.charAt(0).toUpperCase() + action.slice(1)
}

export default function EntitlementsPage() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['entitlements'],
    queryFn: superadminApi.getEntitlements,
  })

  // local edits: "role::perm" → boolean
  const [edits, setEdits] = useState<Record<string, boolean>>({})
  const [dirty, setDirty] = useState(false)

  const grants = useMemo(() => ({ ...(data?.grants ?? {}), ...edits }), [data, edits])

  const toggle = (role: string, perm: string) => {
    const key = `${role}::${perm}`
    const current = grants[key] ?? false
    setEdits(prev => ({ ...prev, [key]: !current }))
    setDirty(true)
  }

  const saveMutation = useMutation({
    mutationFn: (updates: GrantUpdate[]) => superadminApi.updateEntitlements(updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entitlements'] })
      setEdits({})
      setDirty(false)
      toast.success('Permissions saved')
    },
    onError: () => toast.error('Failed to save'),
  })

  const handleSave = () => {
    if (!data) return
    const updates: GrantUpdate[] = Object.entries(edits).map(([key, granted]) => {
      const [role, permission] = key.split('::')
      return { role, permission, granted }
    })
    saveMutation.mutate(updates)
  }

  const groups = useMemo(() => data ? groupPermissions(data.permissions) : {}, [data])
  const roles = data?.roles ?? []

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Entitlements"
          subtitle="Manage role permissions across the system"
          icon={<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: '1px solid rgba(99,102,241,0.3)' }}><ShieldCheck className="h-5 w-5" /></div>}
        />
        <div className="text-center py-16 text-muted-foreground">Loading permissions…</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Entitlements"
        subtitle="Configure which roles can access which features"
        icon={<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: '1px solid rgba(99,102,241,0.3)' }}><ShieldCheck className="h-5 w-5" /></div>}
        actions={
          dirty ? (
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr style={{ background: 'linear-gradient(to bottom, #d0f5fb, #e8f9fc)' }}>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-600 uppercase tracking-wider w-56 border-b border-cyan-200">
                  Permission
                </th>
                {roles.map((role, i) => {
                  const colors = [
                    'text-violet-700 bg-violet-50',
                    'text-sky-700 bg-sky-50',
                    'text-emerald-700 bg-emerald-50',
                    'text-amber-700 bg-amber-50',
                  ]
                  return (
                    <th key={role} className={`px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-center whitespace-nowrap border-b border-cyan-200`}>
                      <span className={`inline-block px-3 py-1 rounded-full text-[11px] font-semibold ${colors[i % colors.length]}`}>
                        {ROLE_LABELS[role] ?? role}
                      </span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {Object.entries(groups).map(([group, perms]) => (
                <>
                  <tr key={`group-${group}`} className="bg-slate-50 border-t-2 border-slate-200">
                    <td colSpan={roles.length + 1} className="px-5 py-2 text-[11px] font-extrabold text-[#0096b4] uppercase tracking-[0.12em]">
                      {GROUP_LABELS[group] ?? group}
                    </td>
                  </tr>
                  {perms.map(perm => (
                    <tr key={perm} className="border-t border-slate-100 hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3 text-sm font-medium text-slate-600 pl-9">
                        {permLabel(perm)}
                      </td>
                      {roles.map(role => {
                        const key = `${role}::${perm}`
                        const granted = grants[key] ?? false
                        const changed = key in edits
                        return (
                          <td key={role} className="px-4 py-3 text-center">
                            <button
                              onClick={() => toggle(role, perm)}
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-150
                                ${granted
                                  ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm hover:bg-emerald-600 hover:border-emerald-600'
                                  : 'bg-white border-slate-300 text-slate-300 hover:border-slate-400 hover:text-slate-400'
                                }
                                ${changed ? 'ring-2 ring-offset-2 ring-amber-400' : ''}
                              `}
                              title={granted ? 'Click to revoke' : 'Click to grant'}
                            >
                              {granted
                                ? <Check className="h-4 w-4" strokeWidth={3} />
                                : <X className="h-3.5 w-3.5" strokeWidth={2} />
                              }
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {dirty && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button size="lg" onClick={handleSave} disabled={saveMutation.isPending} className="shadow-xl">
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      )}
    </div>
  )
}
