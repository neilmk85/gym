import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, UserCheck, UserX, Users, Plus, Dumbbell, Fingerprint, Link, Unlink, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchInput } from '@/components/shared/SearchInput'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { staffApi, type Staff, type StaffRole } from '@/api/staff.api'
import { membersApi } from '@/api/members.api'
import { trainersApi } from '@/api/trainers.api'
import { formatCurrency } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'

const DEPARTMENTS = ['Reception', 'Accounts', 'HR', 'Housekeeping', 'Security', 'Maintenance', 'Marketing', 'IT', 'Management', 'Other']
const EMPLOYMENT_TYPES: Record<string, string> = { full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract', intern: 'Intern' }
const STAFF_STATUSES: Record<string, string> = { active: 'Active', inactive: 'Inactive', on_leave: 'On Leave', resigned: 'Resigned' }
const ROLE_LABELS: Record<StaffRole, string> = { trainer: 'Trainer', receptionist: 'Receptionist', manager: 'Manager', other: 'Other' }
const ROLE_COLORS: Record<StaffRole, string> = {
  trainer:      'bg-violet-100 text-violet-700',
  receptionist: 'bg-teal-100 text-teal-700',
  manager:      'bg-blue-100 text-blue-700',
  other:        'bg-gray-100 text-gray-600',
}

type RoleTab = 'all' | StaffRole

function statusStyle(status: string): string {
  switch (status) {
    case 'active':   return 'bg-green-100 text-green-700'
    case 'inactive': return 'bg-gray-100 text-gray-600'
    case 'on_leave': return 'bg-amber-100 text-amber-700'
    case 'resigned': return 'bg-red-100 text-red-600'
    default: return 'bg-gray-100 text-gray-600'
  }
}

function empTypeBadge(type: string): string {
  switch (type) {
    case 'full_time': return 'bg-blue-100 text-blue-700'
    case 'part_time': return 'bg-purple-100 text-purple-700'
    case 'contract':  return 'bg-orange-100 text-orange-700'
    case 'intern':    return 'bg-teal-100 text-teal-700'
    default: return 'bg-gray-100 text-gray-600'
  }
}

function initials(s: Staff) {
  return (s.first_name[0] ?? '') + (s.last_name[0] ?? '')
}

export default function StaffListPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')
  const [roleTab, setRoleTab] = useState<RoleTab>('all')

  // Biometric link state
  const [linkDeviceOpen, setLinkDeviceOpen] = useState(false)
  const [staffToLink, setStaffToLink] = useState<Staff | null>(null)
  const [linkDeviceInput, setLinkDeviceInput] = useState('')
  const [baselineScanAt, setBaselineScanAt] = useState<string | null>(null)
  const [scannedName, setScannedName] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['staff', roleTab],
    queryFn: () => staffApi.list({ per_page: 500, role: roleTab === 'all' ? undefined : roleTab }),
  })

  const staff = data?.data ?? []

  const filtered = useMemo(() => staff.filter(s => {
    const q = search.toLowerCase()
    const matchSearch = !q || `${s.first_name} ${s.last_name}`.toLowerCase().includes(q)
      || s.email.toLowerCase().includes(q) || s.phone.includes(q) || s.employee_id.toLowerCase().includes(q)
    const matchDept = !filterDept || s.department === filterDept
    const matchStatus = !filterStatus || s.status === filterStatus
    const matchType = !filterType || s.employment_type === filterType
    return matchSearch && matchDept && matchStatus && matchType
  }), [staff, search, filterDept, filterStatus, filterType])

  const stats = useMemo(() => ({
    total: staff.length,
    trainers: staff.filter(s => s.role === 'trainer').length,
    active: staff.filter(s => s.status === 'active').length,
    onLeave: staff.filter(s => s.status === 'on_leave').length,
  }), [staff])

  const linkDeviceMutation = useMutation({
    mutationFn: ({ id, deviceUserId, trainerProfileId }: { id: number; deviceUserId: string; trainerProfileId?: number }) =>
      trainerProfileId
        ? trainersApi.linkDevice(trainerProfileId, deviceUserId)
        : staffApi.linkDevice(id, deviceUserId),
    onSuccess: (_, { deviceUserId }) => {
      qc.invalidateQueries({ queryKey: ['staff'] })
      setLinkDeviceOpen(false)
      setStaffToLink(null)
      toast.success(deviceUserId ? 'Device linked successfully' : 'Device unlinked')
    },
    onError: () => toast.error('Failed to link device'),
  })

  const { data: lastScan } = useQuery({
    queryKey: ['biometric-last-scan'],
    queryFn: () => membersApi.getLastScan(),
    refetchInterval: linkDeviceOpen ? 2000 : false,
    enabled: linkDeviceOpen,
  })

  useEffect(() => {
    if (!linkDeviceOpen || !lastScan || !baselineScanAt) return
    if (lastScan.scanned_at > baselineScanAt && lastScan.device_user_id !== linkDeviceInput) {
      setLinkDeviceInput(lastScan.device_user_id)
      setScannedName(lastScan.name || null)
    }
  }, [lastScan, linkDeviceOpen, baselineScanAt])

  // For trainer-role staff, biometric lives on trainer_profile; for all others on the staff row.
  const effectiveDeviceId = (s: Staff) =>
    s.role === 'trainer' ? (s.trainer_profile?.device_user_id ?? '') : (s.device_user_id ?? '')

  const openLinkDeviceModal = (s: Staff, e: React.MouseEvent) => {
    e.stopPropagation()
    setStaffToLink(s)
    setLinkDeviceInput(effectiveDeviceId(s))
    setScannedName(null)
    membersApi.getLastScan().then(scan => {
      setBaselineScanAt(scan?.scanned_at ?? new Date(0).toISOString())
    }).catch(() => setBaselineScanAt(new Date(0).toISOString()))
    setLinkDeviceOpen(true)
    membersApi.requestScan().catch(() => {})
  }

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => staffApi.update(id, { status }),
    onSuccess: (_, { status }) => {
      qc.invalidateQueries({ queryKey: ['staff'] })
      toast.success(`Staff marked as ${STAFF_STATUSES[status]}`)
    },
  })

  const toggleStatus = (s: Staff) => {
    const next = s.status === 'active' ? 'inactive' : 'active'
    toggleMutation.mutate({ id: s.id, status: next })
  }

  const selectClass = 'h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

  const ROLE_TABS: { key: RoleTab; label: string; icon?: React.ReactNode }[] = [
    { key: 'all',          label: 'All Staff' },
    { key: 'trainer',      label: 'Trainers',      icon: <Dumbbell className="h-3.5 w-3.5" /> },
    { key: 'receptionist', label: 'Reception' },
    { key: 'manager',      label: 'Managers' },
    { key: 'other',        label: 'Other' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff"
        section="HR"
        subtitle="All gym staff — trainers, reception, managers, and more."
        icon={<Users className="h-5 w-5" />}
        statLayout="inline"
        stats={[
          { label: 'Total',    value: stats.total    },
          { label: 'Trainers', value: stats.trainers },
          { label: 'Active',   value: stats.active   },
          { label: 'On Leave', value: stats.onLeave  },
        ]}
        actions={
          <Button onClick={() => navigate('/staff/new')} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Staff
          </Button>
        }
      />

      {/* Role tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {ROLE_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setRoleTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              roleTab === tab.key
                ? 'border-[#0096b4] text-[#0096b4]'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <SearchInput
              placeholder="Search by name, email, phone…"
              value={search}
              onChange={setSearch}
              className="flex-1 min-w-48"
            />
            <select className={selectClass} value={filterDept} onChange={e => setFilterDept(e.target.value)}>
              <option value="">All Departments</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select className={selectClass} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              {Object.entries(STAFF_STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select className={selectClass} value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="">All Types</option>
              {Object.entries(EMPLOYMENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sidebar">
              <tr>
                <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Staff</th>
                <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Role</th>
                <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Department</th>
                <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Designation</th>
                <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Salary</th>
                <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Joined</th>
                <th className="text-right px-4 py-3 font-light text-sidebar-foreground text-xs uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground">Loading…</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No staff members found.
                  </td>
                </tr>
              ) : filtered.map(s => (
                <tr
                  key={s.id}
                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/staff/${s.id}/edit`)}
                >
                  {/* Staff */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br from-[#00B4D8] to-purple-600">
                        {initials(s).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium leading-tight">{s.first_name} {s.last_name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <p className="text-xs text-muted-foreground">{s.employee_id}</p>
                          {effectiveDeviceId(s) ? (
                            <span className="flex items-center gap-0.5 text-[10px] font-medium text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded-full">
                              <Fingerprint className="h-2.5 w-2.5" />{effectiveDeviceId(s)}
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/60">No biometric</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[s.role ?? 'other']}`}>
                      {ROLE_LABELS[s.role ?? 'other']}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{s.department}</td>
                  <td className="px-4 py-3">{s.designation}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${empTypeBadge(s.employment_type)}`}>
                      {EMPLOYMENT_TYPES[s.employment_type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">{formatCurrency(s.salary)}/mo</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle(s.status)}`}>
                      {STAFF_STATUSES[s.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(s.date_of_joining).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
                      <Button
                        variant="ghost" size="icon"
                        className={`h-8 w-8 ${effectiveDeviceId(s) ? 'text-teal-600 hover:text-teal-700' : 'text-muted-foreground hover:text-teal-600'}`}
                        title={effectiveDeviceId(s) ? `Biometric linked (ID: ${effectiveDeviceId(s)})` : 'Link biometric device'}
                        onClick={e => openLinkDeviceModal(s, e)}
                      >
                        <Fingerprint className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        title="Edit staff member"
                        onClick={() => navigate(`/staff/${s.id}/edit`)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className={`h-8 w-8 ${s.status === 'active' ? 'text-muted-foreground hover:text-destructive' : 'text-muted-foreground hover:text-green-600'}`}
                        title={s.status === 'active' ? 'Mark inactive' : 'Mark active'}
                        onClick={() => toggleStatus(s)}
                      >
                        {s.status === 'active' ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-4 py-2.5 border-t bg-muted/20 text-xs text-muted-foreground">
            Showing {filtered.length} of {staff.length} staff members
          </div>
        )}
      </Card>

      {/* Link Biometric Device Modal */}
      {linkDeviceOpen && staffToLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setLinkDeviceOpen(false); setStaffToLink(null) }}>
          <div className="bg-background rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-teal-100 dark:bg-teal-900/30">
                <Fingerprint className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <h2 className="font-semibold text-base">Link Biometric Device</h2>
                <p className="text-sm text-muted-foreground">{staffToLink.first_name} {staffToLink.last_name}</p>
              </div>
            </div>

            {scannedName ? (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 px-3 py-2.5">
                <CheckCircle2 className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0" />
                <p className="text-sm text-teal-700 dark:text-teal-300">
                  Scan detected: <span className="font-medium">{scannedName}</span>
                </p>
              </div>
            ) : (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 px-3 py-2.5">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500" />
                </span>
                <p className="text-sm text-muted-foreground">Waiting for scan… ask the staff member to scan their finger</p>
              </div>
            )}

            <div className="mb-4">
              <Label htmlFor="staff-device-user-id" className="text-sm font-medium mb-1.5 block">Device User ID</Label>
              <Input
                id="staff-device-user-id"
                value={linkDeviceInput}
                onChange={e => { setLinkDeviceInput(e.target.value); setScannedName(null) }}
                placeholder="e.g. 1638"
                className="font-mono"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') linkDeviceMutation.mutate({ id: staffToLink.id, deviceUserId: linkDeviceInput.trim(), trainerProfileId: staffToLink.trainer_profile?.id }) }}
              />
              {effectiveDeviceId(staffToLink) && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  Currently linked to: <span className="font-mono text-teal-600 dark:text-teal-400">{effectiveDeviceId(staffToLink)}</span>
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setLinkDeviceOpen(false); setStaffToLink(null) }}>
                Cancel
              </Button>
              {effectiveDeviceId(staffToLink) && (
                <Button variant="ghost" className="text-destructive hover:text-destructive"
                  disabled={linkDeviceMutation.isPending}
                  onClick={() => {
                    membersApi.deleteDeviceUser(effectiveDeviceId(staffToLink)).catch(() => {})
                    linkDeviceMutation.mutate({ id: staffToLink.id, deviceUserId: '', trainerProfileId: staffToLink.trainer_profile?.id })
                  }}>
                  <Unlink className="h-4 w-4 mr-1" /> Unlink
                </Button>
              )}
              <Button className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
                disabled={linkDeviceMutation.isPending || !linkDeviceInput.trim()}
                onClick={() => linkDeviceMutation.mutate({ id: staffToLink.id, deviceUserId: linkDeviceInput.trim(), trainerProfileId: staffToLink.trainer_profile?.id })}>
                {linkDeviceMutation.isPending ? 'Saving…' : <><Link className="h-4 w-4 mr-1" /> Link</>}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
