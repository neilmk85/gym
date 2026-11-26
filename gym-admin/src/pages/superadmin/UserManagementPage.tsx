import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Users, ChevronLeft, ChevronRight, KeyRound, X, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function PasswordInput({ id, value, onChange, placeholder }: { id: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? 'text' : 'password'}
        autoComplete="new-password"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="pr-9"
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow(v => !v)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        {show ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </button>
    </div>
  )
}
import { PageHeader } from '@/components/shared/PageHeader'
import { SearchInput } from '@/components/shared/SearchInput'
import { staffLoginsApi } from '@/api/superadmin-staff-logins.api'
import { superadminUsersApi } from '@/api/superadmin-users.api'
import { ApiError } from '@/api/client'

const PER_PAGE = 25

function ResetPasswordDialog({ staffName, userId, onClose }: { staffName: string; userId: number; onClose: () => void }) {
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => superadminUsersApi.resetPassword(userId, newPassword),
    onSuccess: () => {
      toast.success(`Password reset for ${staffName}`)
      onClose()
    },
    onError: (err) => setError(err instanceof ApiError ? (err.details || err.message) : 'Failed to reset password'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (newPassword.length < 8) return setError('Password must be at least 8 characters')
    if (!/[A-Z]/.test(newPassword)) return setError('Must contain an uppercase letter')
    if (!/[0-9]/.test(newPassword)) return setError('Must contain a number')
    if (!/[^A-Za-z0-9]/.test(newPassword)) return setError('Must contain a special character (e.g. @, #, !)')
    if (newPassword !== confirm) return setError("Passwords don't match")
    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-background rounded-xl shadow-xl border w-full max-w-sm mx-4 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              Reset Password
            </h3>
            <p className="text-xs text-muted-foreground mt-1">{staffName}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="rp-new">New Password</Label>
            <PasswordInput
              id="rp-new"
              value={newPassword}
              onChange={setNewPassword}
              placeholder="Min 8 chars, uppercase, number, special char"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rp-confirm">Confirm Password</Label>
            <PasswordInput
              id="rp-confirm"
              value={confirm}
              onChange={setConfirm}
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 pt-1">
            <Button type="submit" size="sm" disabled={mutation.isPending} className="flex-1">
              {mutation.isPending ? 'Resetting…' : 'Reset Password'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function UserManagementPage() {
  const qc = useQueryClient()
  const [page, setPage]     = useState(1)
  const [search, setSearch] = useState('')
  const [resetTarget, setResetTarget] = useState<{ userId: number; name: string } | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['superadmin-staff-logins', { search, page }],
    queryFn: () => staffLoginsApi.list({ search, page, per_page: PER_PAGE }),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ staffId, hasLogin, loginEnabled }: { staffId: number; hasLogin: boolean; loginEnabled: boolean }) => {
      if (!hasLogin) return staffLoginsApi.grantLogin(staffId)
      return staffLoginsApi.toggleLogin(staffId, loginEnabled)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin-staff-logins'] })
      toast.success('Login access updated')
    },
    onError: () => toast.error('Failed to update login access'),
  })

  const staff = data?.staff ?? []
  const meta  = data?.meta
  const total = meta?.total ?? 0
  const perPage = meta?.per_page ?? PER_PAGE

  return (
    <div className="space-y-6">
      {resetTarget && (
        <ResetPasswordDialog
          userId={resetTarget.userId}
          staffName={resetTarget.name}
          onClose={() => setResetTarget(null)}
        />
      )}
      <PageHeader
        title="User Management"
        section="Super Admin"
        subtitle="Control login access for staff members."
        icon={<Users className="h-5 w-5" />}
        statLayout="inline"
        stats={[{ label: 'Total Staff', value: total }]}
      />

      <Card className="border-0 shadow-md rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b">
          <SearchInput
            placeholder="Name, email or employee ID…"
            value={search}
            onChange={v => { setSearch(v); setPage(1) }}
            className="w-64"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sidebar sticky top-0 z-10">
              <tr>
                <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Staff</th>
                <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Role</th>
                <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Department</th>
                <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Phone</th>
                <th className="text-right px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Login Access</th>
                <th className="text-right px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Password</th>
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

              {!isLoading && staff.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-14 text-center">
                    <Users className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-muted-foreground text-sm font-medium">No staff members found</p>
                    <p className="text-xs text-muted-foreground mt-1">Add staff from the Staff page first.</p>
                  </td>
                </tr>
              )}

              {!isLoading && staff.map(s => {
                const isOn = s.has_login && s.login_enabled
                return (
                  <tr key={s.staff_id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium leading-tight">{s.first_name} {s.last_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.email}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground capitalize">{s.role}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{s.department || '—'}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{s.phone || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3">
                        {s.has_login && (
                          <span className={`text-xs ${s.login_enabled ? 'text-green-600' : 'text-muted-foreground'}`}>
                            {s.login_enabled ? 'Allowed' : 'Blocked'}
                          </span>
                        )}
                        {!s.has_login && (
                          <span className="text-xs text-muted-foreground">No login</span>
                        )}
                        <button
                          onClick={() => toggleMutation.mutate({
                            staffId: s.staff_id,
                            hasLogin: s.has_login,
                            loginEnabled: !s.login_enabled,
                          })}
                          disabled={toggleMutation.isPending}
                          title={isOn ? 'Revoke login access' : s.has_login ? 'Grant login access' : 'Create login account'}
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus:outline-none ${isOn ? 'bg-green-500' : 'bg-gray-300'}`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${isOn ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        {s.has_login && s.user_id ? (
                          <button
                            onClick={() => setResetTarget({ userId: s.user_id!, name: `${s.first_name} ${s.last_name}` })}
                            title="Reset password"
                            className="text-muted-foreground hover:text-primary transition-colors"
                          >
                            <KeyRound className="h-4 w-4" />
                          </button>
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
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
              Showing {Math.min((page - 1) * perPage + 1, total)}–{Math.min(page * perPage, total)} of {total} staff
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
    </div>
  )
}
