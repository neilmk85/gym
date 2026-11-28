import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Copy, Phone, AlertTriangle } from 'lucide-react'
import { membersApi } from '@/api/members.api'
import type { Member } from '@/types/member.types'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

export default function DuplicateMembersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['members-all-for-dup'],
    queryFn: () => membersApi.list({ page: 1, per_page: 2000 }) as Promise<{ members?: Member[]; total?: number }>,
    staleTime: 2 * 60 * 1000,
  })

  const allMembers: Member[] = (data as { members?: Member[] } | undefined)?.members ?? []

  const duplicateGroups = useMemo(() => {
    const phoneMap = new Map<string, Member[]>()
    for (const m of allMembers) {
      const phone = m.user?.phone?.replace(/\D/g, '') ?? ''
      if (!phone || phone.length < 7) continue
      const key = phone.slice(-10)
      if (!phoneMap.has(key)) phoneMap.set(key, [])
      phoneMap.get(key)!.push(m)
    }
    return Array.from(phoneMap.entries())
      .filter(([, members]) => members.length > 1)
      .sort((a, b) => b[1].length - a[1].length)
  }, [allMembers])

  const totalDuplicateMembers = duplicateGroups.reduce((s, [, arr]) => s + arr.length, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Duplicate Members"
        subtitle="Members sharing the same phone number"
        icon={<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm" style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}><Copy className="h-5 w-5" /></div>}
      />

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-orange-500 flex items-center justify-center shrink-0 text-white">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Duplicate Groups</p>
              <p className="text-2xl font-bold text-slate-800">{isLoading ? '…' : duplicateGroups.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-red-500 flex items-center justify-center shrink-0 text-white">
              <Copy className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Members Affected</p>
              <p className="text-2xl font-bold text-slate-800">{isLoading ? '…' : totalDuplicateMembers}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading && (
        <div className="py-16 text-center text-slate-400">Scanning members…</div>
      )}

      {!isLoading && duplicateGroups.length === 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center">
            <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
              <Phone className="h-6 w-6 text-emerald-500" />
            </div>
            <p className="text-slate-600 font-semibold">No duplicates found</p>
            <p className="text-sm text-slate-400 mt-1">All member phone numbers are unique</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && duplicateGroups.map(([phone, members]) => (
        <Card key={phone} className="border-0 shadow-sm border-l-2 border-l-orange-400">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Phone className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-bold text-slate-700">+91 {phone}</span>
              <Badge className="bg-orange-100 text-orange-700 ml-auto">{members.length} accounts</Badge>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left pb-2 text-xs font-bold text-slate-400 uppercase">Name</th>
                  <th className="text-left pb-2 text-xs font-bold text-slate-400 uppercase">Code</th>
                  <th className="text-left pb-2 text-xs font-bold text-slate-400 uppercase">Status</th>
                  <th className="text-left pb-2 text-xs font-bold text-slate-400 uppercase">Joined</th>
                </tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.id} className="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 font-medium text-slate-800">
                      {m.user?.first_name} {m.user?.last_name}
                    </td>
                    <td className="py-2.5 font-mono text-xs text-slate-500">{m.member_code}</td>
                    <td className="py-2.5">
                      <Badge className={
                        m.membership_status === 'active'    ? 'bg-emerald-100 text-emerald-700' :
                        m.membership_status === 'expired'   ? 'bg-red-100 text-red-700' :
                        m.membership_status === 'paused'    ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-500'
                      }>
                        {m.membership_status}
                      </Badge>
                    </td>
                    <td className="py-2.5 text-slate-500">{formatDate(String(m.joined_date))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
