import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Users, Search, ChevronLeft, ChevronRight, Pencil, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/PageHeader'
import { SearchInput } from '@/components/shared/SearchInput'
import { superadminUsersApi, type StaffUser, type UpdateUserPayload } from '@/api/superadmin-users.api'

const PER_PAGE = 25

const ROLE_COLORS: Record<string, string> = {
  superadmin: 'bg-violet-100 text-violet-700 border border-violet-200',
  owner:      'bg-sky-100 text-sky-700 border border-sky-200',
  manager:    'bg-emerald-100 text-emerald-700 border border-emerald-200',
  reception:  'bg-amber-100 text-amber-700 border border-amber-200',
  trainer:    'bg-pink-100 text-pink-700 border border-pink-200',
}

const STATUS_COLORS: Record<string, string> = {
  active:    'bg-green-50 text-green-700 border border-green-200',
  inactive:  'bg-gray-100 text-gray-500 border border-gray-200',
  suspended: 'bg-red-50 text-red-600 border border-red-200',
  locked:    'bg-orange-50 text-orange-600 border border-orange-200',
}

const ROLES = ['owner', 'manager', 'reception', 'trainer', 'superadmin']
const STATUSES = ['active', 'inactive', 'suspended', 'locked']

interface EditDrawerProps {
  user: StaffUser
  onClose: () => void
  onSave: (id: number, payload: UpdateUserPayload) => void
  saving: boolean
}

function EditDrawer({ user, onClose, onSave, saving }: EditDrawerProps) {
  const [form, setForm] = useState({
    first_name: user.first_name,
    last_name:  user.last_name,
    email:      user.email,
    phone:      user.phone ?? '',
    role:       user.role,
    status:     user.status,
  })

  const field = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  const handleSave = () => {
    const payload: UpdateUserPayload = {}
    if (form.first_name !== user.first_name) payload.first_name = form.first_name
    if (form.last_name  !== user.last_name)  payload.last_name  = form.last_name
    if (form.email      !== user.email)      payload.email      = form.email
    if (form.phone      !== (user.phone ?? '')) payload.phone   = form.phone
    if (form.role       !== user.role)       payload.role       = form.role
    if (form.status     !== user.status)     payload.status     = form.status
    if (Object.keys(payload).length === 0) { onClose(); return }
    onSave(user.id, payload)
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-background shadow-2xl flex flex-col h-full">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <p className="font-semibold text-base">{user.first_name} {user.last_name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">First Name</label>
              <input value={form.first_name} onChange={field('first_name')}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Last Name</label>
              <input value={form.last_name} onChange={field('last_name')}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
            <input value={form.email} onChange={field('email')} type="email"
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Phone</label>
            <input value={form.phone} onChange={field('phone')}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Role</label>
            <select value={form.role} onChange={field('role')}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              {ROLES.map(r => (
                <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
            <select value={form.status} onChange={field('status')}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              {STATUSES.map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="px-6 py-4 border-t flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function UserManagementPage() {
  const qc = useQueryClient()
  const [page, setPage]           = useState(1)
  const [search, setSearch]       = useState('')
  const [roleFilter, setRoleFilter]     = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [editing, setEditing]     = useState<StaffUser | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['superadmin-users', { search, roleFilter, statusFilter, page }],
    queryFn: () => superadminUsersApi.list({ search, role: roleFilter, status: statusFilter, page, per_page: PER_PAGE }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateUserPayload }) =>
      superadminUsersApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin-users'] })
      toast.success('User updated')
      setEditing(null)
    },
    onError: () => toast.error('Failed to update user'),
  })

  const toggleStatus = (user: StaffUser) => {
    const next = user.status === 'active' ? 'inactive' : 'active'
    updateMutation.mutate({ id: user.id, payload: { status: next } })
  }

  const users = data?.users ?? []
  const meta  = data?.meta
  const total = meta?.total ?? 0
  const perPage = meta?.per_page ?? PER_PAGE

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        section="Super Admin"
        subtitle="View, edit and enable or disable staff accounts across all roles."
        icon={<Users className="h-5 w-5" />}
        statLayout="grid"
        stats={[
          { label: 'Total Users', value: total },
        ]}
      />

      <Card className="border-0 shadow-md rounded-xl overflow-hidden">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b">
          <SearchInput
            placeholder="Name or email…"
            value={search}
            onChange={v => { setSearch(v); setPage(1) }}
            className="w-52"
          />
          <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1) }}
            className="h-9 w-36 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">All roles</option>
            {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
          </select>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
            className="h-9 w-36 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sidebar sticky top-0 z-10">
              <tr>
                <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">User</th>
                <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Role</th>
                <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Phone</th>
                <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Joined</th>
                <th className="px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {[1,2,3,4,5,6].map(c => (
                    <td key={c} className="px-4 py-3">
                      <div className="h-4 bg-gray-100 rounded animate-pulse w-24" />
                    </td>
                  ))}
                </tr>
              ))}

              {!isLoading && users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-14 text-center">
                    <Users className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-muted-foreground text-sm font-medium">No users found</p>
                  </td>
                </tr>
              )}

              {!isLoading && users.map(u => {
                const isActive = u.status === 'active'
                return (
                  <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium leading-tight">{u.first_name} {u.last_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[u.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {isActive && <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />}
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {u.phone || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {/* Enable / Disable toggle */}
                        <button
                          onClick={() => toggleStatus(u)}
                          disabled={updateMutation.isPending}
                          title={isActive ? 'Disable user' : 'Enable user'}
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus:outline-none ${isActive ? 'bg-green-500' : 'bg-gray-300'}`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </button>
                        {/* Edit */}
                        <button
                          onClick={() => setEditing(u)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          title="Edit user"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {!isLoading && total > 0 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t bg-muted/20 text-xs text-muted-foreground">
            <span>
              Showing {Math.min((page - 1) * perPage + 1, total)}–{Math.min(page * perPage, total)} of {total} users
            </span>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7"
                onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <span className="flex items-center px-2 font-medium">Page {page}</span>
              <Button variant="outline" size="icon" className="h-7 w-7"
                onClick={() => setPage(p => p + 1)} disabled={page * perPage >= total}>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {editing && (
        <EditDrawer
          user={editing}
          onClose={() => setEditing(null)}
          onSave={(id, payload) => updateMutation.mutate({ id, payload })}
          saving={updateMutation.isPending}
        />
      )}
    </div>
  )
}
