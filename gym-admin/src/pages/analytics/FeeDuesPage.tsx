import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Clock, UserX, Phone, Search } from 'lucide-react'
import { reportsApi } from '@/api/reports.api'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/PageHeader'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

const TAB_OPTIONS = [
  { key: 'expiring', label: 'Expiring Soon', icon: <Clock className="h-4 w-4" /> },
  { key: 'expired',  label: 'Expired / Inactive', icon: <UserX className="h-4 w-4" /> },
]

const DAYS_OPTIONS = [7, 15, 30, 60]

export default function FeeDuesPage() {
  const [tab, setTab]     = useState<'expiring' | 'expired'>('expiring')
  const [days, setDays]   = useState(30)
  const [search, setSearch] = useState('')

  const { data: expiringData, isLoading: expiringLoading } = useQuery({
    queryKey: ['fee-dues-expiring', days],
    queryFn: () => reportsApi.expiring(days),
  })
  const { data: inactiveData, isLoading: inactiveLoading } = useQuery({
    queryKey: ['fee-dues-inactive', days],
    queryFn: () => reportsApi.inactive(days),
  })

  const isLoading = tab === 'expiring' ? expiringLoading : inactiveLoading

  const expiringList = (expiringData?.members ?? []).filter(m => {
    if (!search) return true
    const q = search.toLowerCase()
    return m.name.toLowerCase().includes(q) || m.phone.includes(q)
  })

  const inactiveList = (inactiveData?.members ?? []).filter(m => {
    if (!search) return true
    const q = search.toLowerCase()
    return m.name.toLowerCase().includes(q) || m.phone.includes(q)
  })

  const list = tab === 'expiring' ? expiringList : inactiveList
  const totalCount = tab === 'expiring' ? (expiringData?.count ?? 0) : (inactiveData?.count ?? 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fee Dues Report"
        subtitle="Members with pending renewals or inactive subscriptions"
        icon={<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}><AlertTriangle className="h-5 w-5" /></div>}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm cursor-pointer" onClick={() => setTab('expiring')}>
          <CardContent className={`p-5 flex items-center gap-4 rounded-xl transition-all ${tab === 'expiring' ? 'ring-2 ring-amber-400' : ''}`}>
            <div className="h-10 w-10 rounded-xl bg-amber-500 flex items-center justify-center shrink-0 text-white">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Expiring in {days} days</p>
              <p className="text-2xl font-bold text-slate-800">{expiringLoading ? '…' : expiringData?.count ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm cursor-pointer" onClick={() => setTab('expired')}>
          <CardContent className={`p-5 flex items-center gap-4 rounded-xl transition-all ${tab === 'expired' ? 'ring-2 ring-red-400' : ''}`}>
            <div className="h-10 w-10 rounded-xl bg-red-500 flex items-center justify-center shrink-0 text-white">
              <UserX className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Inactive ({days}+ days)</p>
              <p className="text-2xl font-bold text-slate-800">{inactiveLoading ? '…' : inactiveData?.count ?? 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search name or phone…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
          {DAYS_OPTIONS.map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${days === d ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {TAB_OPTIONS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as 'expiring' | 'expired')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${tab === t.key ? 'border-amber-500 text-amber-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {isLoading
            ? <div className="py-16 text-center text-slate-400">Loading…</div>
            : list.length === 0
              ? <div className="py-16 text-center text-slate-400">No members found</div>
              : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Member</th>
                      <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Phone</th>
                      {tab === 'expiring' && <>
                        <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Plan</th>
                        <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Expires</th>
                        <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Days Left</th>
                      </>}
                      {tab === 'expired' && <>
                        <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Status</th>
                        <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Last Visit</th>
                        <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">Days Inactive</th>
                      </>}
                    </tr>
                  </thead>
                  <tbody>
                    {tab === 'expiring'
                      ? expiringList.map(m => (
                        <tr key={m.member_id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3 font-medium text-slate-800">{m.name}</td>
                          <td className="px-5 py-3 text-slate-600 flex items-center gap-1.5">
                            <Phone className="h-3 w-3 text-slate-400" />{m.phone}
                          </td>
                          <td className="px-5 py-3 text-slate-600">{m.plan_name}</td>
                          <td className="px-5 py-3 text-slate-600">{formatDate(m.end_date)}</td>
                          <td className="px-5 py-3">
                            <Badge className={m.days_left <= 7 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}>
                              {m.days_left}d
                            </Badge>
                          </td>
                        </tr>
                      ))
                      : inactiveList.map(m => (
                        <tr key={m.member_id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3 font-medium text-slate-800">{m.name}</td>
                          <td className="px-5 py-3 text-slate-600">
                            <div className="flex items-center gap-1.5"><Phone className="h-3 w-3 text-slate-400" />{m.phone}</div>
                          </td>
                          <td className="px-5 py-3">
                            <Badge className="bg-slate-100 text-slate-600 capitalize">{m.status}</Badge>
                          </td>
                          <td className="px-5 py-3 text-slate-600">{m.last_visit ? formatDate(m.last_visit) : '—'}</td>
                          <td className="px-5 py-3">
                            <Badge className="bg-red-100 text-red-700">{m.days_since_visit ?? '—'}d</Badge>
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              )
          }
        </CardContent>
      </Card>
      <p className="text-xs text-slate-400 text-right">Showing {list.length} of {totalCount} members</p>
    </div>
  )
}
