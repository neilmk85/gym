import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, UserCheck, UserX, Users, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/shared/SearchInput'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { staffApi, type Staff } from '@/api/staff.api'
import { formatCurrency } from '@/lib/utils'
import { PageHeader } from '@/components/shared/PageHeader'

const DEPARTMENTS = ['Reception', 'Accounts', 'HR', 'Housekeeping', 'Security', 'Maintenance', 'Marketing', 'IT', 'Management', 'Other']
const EMPLOYMENT_TYPES: Record<string, string> = { full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract', intern: 'Intern' }
const STAFF_STATUSES: Record<string, string> = { active: 'Active', inactive: 'Inactive', on_leave: 'On Leave', resigned: 'Resigned' }

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

  const { data, isLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffApi.list({ per_page: 500 }),
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
    active: staff.filter(s => s.status === 'active').length,
    onLeave: staff.filter(s => s.status === 'on_leave').length,
    departments: new Set(staff.map(s => s.department)).size,
  }), [staff])

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff Members"
        subtitle="Manage non-trainer employees — reception, accounts, housekeeping, and more."
        icon={<Users className="h-5 w-5" />}
        stats={[
          { label: 'Total Staff',  value: stats.total       },
          { label: 'Active',       value: stats.active      },
          { label: 'On Leave',     value: stats.onLeave     },
          { label: 'Departments',  value: stats.departments },
        ]}
        actions={
          <Button onClick={() => navigate('/staff/new')} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Staff
          </Button>
        }
      />

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
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">Loading…</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
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
                        <p className="text-xs text-muted-foreground">{s.employee_id}</p>
                      </div>
                    </div>
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
    </div>
  )
}
