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
  admin: 'Admin',
  manager: 'Manager',
  trainer: 'Trainer',
  trainer_assistant: 'Trainer Asst.',
}

const PERM_LABELS: Record<string, string> = {
  'members.view': 'View', 'members.create': 'Create', 'members.edit': 'Edit', 'members.delete': 'Delete',
  'subscriptions.view': 'View', 'subscriptions.create': 'Create', 'subscriptions.edit': 'Edit',
  'payments.view': 'View', 'payments.create': 'Create',
  'trainers.view': 'View', 'trainers.manage': 'Manage',
  'classes.view': 'View', 'classes.manage': 'Manage',
  'bookings.view': 'View', 'bookings.manage': 'Manage',
  'attendance.view': 'View', 'attendance.mark': 'Mark',
  'reports.view': 'View',
  'staff.view': 'View', 'staff.manage': 'Manage',
  'purchases.view': 'View', 'purchases.manage': 'Manage',
  'coaching.view': 'View', 'coaching.manage': 'Manage',
  'crm.view': 'View', 'crm.manage': 'Manage',
  'retention.view': 'View',
  'loyalty.view': 'View', 'loyalty.manage': 'Manage',
  'settings.view': 'View', 'settings.manage': 'Manage',
  'compliance.view': 'View',
}

const GROUP_LABELS: Record<string, string> = {
  members: 'Members', subscriptions: 'Subscriptions', payments: 'Payments',
  trainers: 'Trainers', classes: 'Classes', bookings: 'Bookings',
  attendance: 'Attendance', reports: 'Reports', staff: 'Staff',
  purchases: 'Purchases', coaching: 'Coaching', crm: 'CRM',
  retention: 'Retention', loyalty: 'Loyalty', settings: 'Settings', compliance: 'Compliance',
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
            <thead className="bg-sidebar sticky top-0 z-10">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-56">
                  Permission
                </th>
                {roles.map(role => (
                  <th key={role} className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center whitespace-nowrap">
                    {ROLE_LABELS[role] ?? role}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(groups).map(([group, perms]) => (
                <>
                  <tr key={`group-${group}`} className="bg-muted/40">
                    <td colSpan={roles.length + 1} className="px-5 py-2 text-xs font-bold text-foreground/70 uppercase tracking-widest">
                      {GROUP_LABELS[group] ?? group}
                    </td>
                  </tr>
                  {perms.map(perm => (
                    <tr key={perm} className="border-t hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-2.5 text-sm text-muted-foreground pl-8">
                        {PERM_LABELS[perm] ?? perm.split('.')[1]}
                      </td>
                      {roles.map(role => {
                        const key = `${role}::${perm}`
                        const granted = grants[key] ?? false
                        const changed = key in edits
                        return (
                          <td key={role} className="px-4 py-2.5 text-center">
                            <button
                              onClick={() => toggle(role, perm)}
                              className={`inline-flex h-7 w-7 items-center justify-center rounded-md border transition-all
                                ${granted
                                  ? 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'
                                  : 'bg-muted/50 border-border text-muted-foreground/40 hover:bg-muted'
                                }
                                ${changed ? 'ring-2 ring-offset-1 ring-amber-400' : ''}
                              `}
                              title={granted ? 'Revoke' : 'Grant'}
                            >
                              {granted ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
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
