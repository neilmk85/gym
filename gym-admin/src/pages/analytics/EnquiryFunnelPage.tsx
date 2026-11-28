import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Filter, TrendingUp, Users, CheckCircle2, Phone } from 'lucide-react'
import { enquiriesApi } from '@/api/enquiries.api'
import type { Enquiry } from '@/types/enquiry.types'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { ResponsiveContainer, FunnelChart, Funnel, LabelList, Tooltip } from 'recharts'

const STATUS_ORDER = ['new', 'contacted', 'visit_scheduled', 'converted', 'closed'] as const
const STATUS_LABELS: Record<string, string> = {
  new:             'New Enquiry',
  contacted:       'Contacted',
  visit_scheduled: 'Visit Scheduled',
  converted:       'Converted',
  closed:          'Closed',
}
const STATUS_COLORS: Record<string, string> = {
  new:             '#0ea5e9',
  contacted:       '#8b5cf6',
  visit_scheduled: '#f59e0b',
  converted:       '#10b981',
  closed:          '#94a3b8',
}
const STATUS_BADGE: Record<string, string> = {
  new:             'bg-sky-100 text-sky-700',
  contacted:       'bg-violet-100 text-violet-700',
  visit_scheduled: 'bg-amber-100 text-amber-700',
  converted:       'bg-emerald-100 text-emerald-700',
  closed:          'bg-slate-100 text-slate-500',
}

export default function EnquiryFunnelPage() {
  const [activeStatus, setActiveStatus] = useState<string | null>(null)

  // Load all statuses
  const queries = STATUS_ORDER.map(status =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useQuery({
      queryKey: ['enquiry-funnel', status],
      queryFn: () => enquiriesApi.list({ status, per_page: 200 }) as Promise<{ enquiries?: Enquiry[]; total?: number }>,
    })
  )

  const isLoading = queries.some(q => q.isLoading)

  const counts = STATUS_ORDER.reduce((acc, status, i) => {
    const data = queries[i].data as { enquiries?: Enquiry[]; total?: number } | undefined
    acc[status] = data?.total ?? (data?.enquiries?.length ?? 0)
    return acc
  }, {} as Record<string, number>)

  const totalEnquiries  = counts['new'] + counts['contacted'] + counts['visit_scheduled'] + counts['converted'] + counts['closed']
  const conversionRate  = totalEnquiries > 0 ? ((counts['converted'] / totalEnquiries) * 100).toFixed(1) : '0'
  const visitRate       = totalEnquiries > 0 ? (((counts['visit_scheduled'] + counts['converted']) / totalEnquiries) * 100).toFixed(1) : '0'

  const funnelData = STATUS_ORDER.filter(s => s !== 'closed').map(s => ({
    name:  STATUS_LABELS[s],
    value: counts[s],
    fill:  STATUS_COLORS[s],
  }))

  const selectedQuery = activeStatus ? queries[STATUS_ORDER.indexOf(activeStatus as typeof STATUS_ORDER[number])] : null
  const selectedList  = activeStatus
    ? ((selectedQuery?.data as { enquiries?: Enquiry[] } | undefined)?.enquiries ?? [])
    : []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enquiry Funnel"
        subtitle="Lead-to-member conversion pipeline"
        icon={<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm" style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }}><Filter className="h-5 w-5" /></div>}
      />

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-sky-500 flex items-center justify-center shrink-0 text-white"><Users className="h-5 w-5" /></div>
            <div>
              <p className="text-xs text-slate-500">Total Enquiries</p>
              <p className="text-2xl font-bold text-slate-800">{isLoading ? '…' : totalEnquiries}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0 text-white"><CheckCircle2 className="h-5 w-5" /></div>
            <div>
              <p className="text-xs text-slate-500">Conversion Rate</p>
              <p className="text-2xl font-bold text-slate-800">{isLoading ? '…' : `${conversionRate}%`}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-amber-500 flex items-center justify-center shrink-0 text-white"><TrendingUp className="h-5 w-5" /></div>
            <div>
              <p className="text-xs text-slate-500">Visit Rate</p>
              <p className="text-2xl font-bold text-slate-800">{isLoading ? '…' : `${visitRate}%`}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funnel visual */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-5">Conversion Funnel</h3>
            {isLoading
              ? <div className="h-72 flex items-center justify-center text-slate-400">Loading…</div>
              : (
                <ResponsiveContainer width="100%" height={280}>
                  <FunnelChart>
                    <Tooltip formatter={(v: number, name: string) => [v, name]} />
                    <Funnel dataKey="value" data={funnelData} isAnimationActive>
                      <LabelList position="right" fill="#374151" stroke="none" dataKey="name" style={{ fontSize: 12 }} />
                    </Funnel>
                  </FunnelChart>
                </ResponsiveContainer>
              )
            }
          </CardContent>
        </Card>

        {/* Stage cards */}
        <div className="space-y-3">
          {STATUS_ORDER.map(status => (
            <button key={status} onClick={() => setActiveStatus(activeStatus === status ? null : status)}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all ${activeStatus === status ? 'border-violet-400 bg-violet-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full" style={{ background: STATUS_COLORS[status] }} />
                  <span className="text-sm font-semibold text-slate-700">{STATUS_LABELS[status]}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-slate-800">{isLoading ? '…' : counts[status]}</span>
                  {totalEnquiries > 0 && (
                    <span className="text-xs text-slate-400">({((counts[status] / totalEnquiries) * 100).toFixed(0)}%)</span>
                  )}
                </div>
              </div>
              {totalEnquiries > 0 && (
                <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${(counts[status] / totalEnquiries) * 100}%`, background: STATUS_COLORS[status] }} />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Detail list for selected stage */}
      {activeStatus && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-5">
              {STATUS_LABELS[activeStatus]} — {selectedList.length} leads
            </h3>
            {selectedQuery?.isLoading
              ? <div className="py-8 text-center text-slate-400">Loading…</div>
              : selectedList.length === 0
                ? <div className="py-8 text-center text-slate-400">No enquiries in this stage</div>
                : (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Name</th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Phone</th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Status</th>
                        <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedList.slice(0, 20).map((e: Enquiry) => (
                        <tr key={e.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-slate-800">{e.first_name} {e.last_name}</td>
                          <td className="px-4 py-3 text-slate-600">
                            <div className="flex items-center gap-1.5"><Phone className="h-3 w-3 text-slate-400" />{e.phone}</div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={STATUS_BADGE[e.status] ?? 'bg-slate-100 text-slate-600'}>{STATUS_LABELS[e.status] ?? e.status}</Badge>
                          </td>
                          <td className="px-4 py-3 text-slate-500">{formatDate(e.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
            }
          </CardContent>
        </Card>
      )}
    </div>
  )
}
