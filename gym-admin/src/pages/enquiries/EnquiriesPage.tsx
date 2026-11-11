import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { PageHeader } from '@/components/shared/PageHeader'
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { enquiriesApi } from '@/api/enquiries.api'
import { formatDate } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import type { Enquiry, EnquiryStatus, EnquirySource } from '@/types/enquiry.types'
import { Plus, Search, Trash2, Calendar, Phone, Mail, UserPlus, TrendingUp, Users, Clock, Target, Flame } from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const SOURCES: { value: EnquirySource; label: string }[] = [
  { value: 'walk_in',      label: 'Walk-in' },
  { value: 'phone_call',   label: 'Phone Call' },
  { value: 'email',        label: 'Email' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'referral',     label: 'Referral' },
  { value: 'website',      label: 'Website' },
  { value: 'other',        label: 'Other' },
]

const STATUSES: { value: EnquiryStatus; label: string; color: string }[] = [
  { value: 'new',             label: 'New',             color: 'bg-sky-100 text-sky-700 border-sky-200' },
  { value: 'contacted',       label: 'Contacted',       color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'visit_scheduled', label: 'Visit Scheduled', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  { value: 'converted',       label: 'Converted',       color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'closed',          label: 'Closed',          color: 'bg-gray-100 text-gray-500 border-gray-200' },
]

function statusStyle(status: string) {
  return STATUSES.find(s => s.value === status)?.color ?? 'bg-gray-100 text-gray-500'
}
function statusLabel(status: string) {
  return STATUSES.find(s => s.value === status)?.label ?? status
}
function sourceLabel(source: string) {
  return SOURCES.find(s => s.value === source)?.label ?? source
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const PER_PAGE = 200

export default function EnquiriesPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager'

  const [deleteTarget, setDeleteTarget] = useState<Enquiry | null>(null)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<EnquiryStatus | ''>('')

  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['enquiries', { search }],
    queryFn: () => enquiriesApi.list({ per_page: PER_PAGE, search: search || undefined }),
  })

  const allEnquiries = ((data as { enquiries?: Enquiry[] })?.enquiries ?? []) as Enquiry[]

  const enquiries = activeTab
    ? allEnquiries.filter(e => e.status === activeTab)
    : allEnquiries

  const countByStatus = (s: string) => allEnquiries.filter(e => e.status === s).length

  const convertMutation = useMutation({
    mutationFn: (id: number) => enquiriesApi.update(id, { status: 'converted' }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['enquiries'] })
      const e = allEnquiries.find(x => x.id === id)
      navigate('/members/new', { state: { from_enquiry: { name: e?.name, phone: e?.phone, email: e?.email } } })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => enquiriesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enquiries'] })
      toast.success('Enquiry deleted')
      setDeleteTarget(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const tabs: { value: EnquiryStatus | ''; label: string }[] = [
    { value: '', label: 'All' },
    ...STATUSES.map(s => ({ value: s.value, label: s.label })),
  ]

  // ── Stats ──
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const newThisMonth = allEnquiries.filter(e => new Date(e.created_at) >= startOfMonth).length
  const convertedThisMonth = allEnquiries.filter(e => e.status === 'converted' && new Date(e.created_at) >= startOfMonth).length
  const totalConverted = allEnquiries.filter(e => e.status === 'converted').length
  const conversionRate = allEnquiries.length > 0 ? Math.round((totalConverted / allEnquiries.length) * 100) : 0
  const followUpsDue = allEnquiries.filter(e => e.follow_up_date && new Date(e.follow_up_date) <= now && !['converted', 'closed'].includes(e.status)).length
  const activePipeline = allEnquiries.filter(e => ['new', 'contacted', 'visit_scheduled'].includes(e.status)).length

  const stats = [
    { label: 'New This Month',      value: newThisMonth,      icon: Flame,      color: 'text-orange-500', bg: 'bg-orange-50' },
    { label: 'Converted This Month',value: convertedThisMonth,icon: TrendingUp,  color: 'text-green-600',  bg: 'bg-green-50'  },
    { label: 'Conversion Rate',     value: `${conversionRate}%`, icon: Target,  color: 'text-primary',    bg: 'bg-primary/10' },
    { label: 'Active Pipeline',     value: activePipeline,    icon: Users,      color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'Follow-ups Due',      value: followUpsDue,      icon: Clock,      color: 'text-amber-600',  bg: 'bg-amber-50'  },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enquiries"
        subtitle="Track leads and prospective members"
        actions={
          isAdminOrManager ? (
            <Button onClick={() => navigate('/enquiries/new')}>
              <Plus className="h-4 w-4 mr-1.5" /> New Enquiry
            </Button>
          ) : undefined
        }
        stats={isLoading ? undefined : stats.map(s => ({
          label: s.label,
          value: s.value,
          icon: <s.icon className="h-4 w-4 text-white" />,
        }))}
      />

      {/* ── Table ── */}
      <Card className="border-0 shadow-md overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                {/* Toolbar row */}
                <tr className="bg-white">
                  <td colSpan={9} className="px-4 pt-2.5 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 flex-1">
                        {tabs.map(tab => {
                          const count = tab.value === '' ? allEnquiries.length : countByStatus(tab.value)
                          const isActive = activeTab === tab.value
                          return (
                            <button
                              key={tab.value}
                              onClick={() => setActiveTab(tab.value)}
                              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-normal tracking-wide transition-all duration-150 ${
                                isActive
                                  ? 'bg-primary/10 text-primary'
                                  : 'text-gray-500 hover:text-gray-800 hover:bg-black/5'
                              }`}
                            >
                              {tab.label}
                              {!isLoading && (
                                <span className={`min-w-[20px] text-center rounded-full text-[11px] font-semibold px-1.5 py-0.5 ${
                                  isActive
                                    ? 'bg-primary/15 text-primary'
                                    : 'bg-black/8 text-gray-500'
                                }`}>
                                  {count}
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                      <div className="relative shrink-0">
                        <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-500" />
                        <Input
                          placeholder="Search name, phone, email…"
                          value={search}
                          onChange={e => setSearch(e.target.value)}
                          className="pl-8 h-8 w-80 text-xs bg-white border-0 shadow-md text-gray-700 placeholder:text-gray-400 focus-visible:ring-0 focus-visible:shadow-lg"
                        />
                      </div>
                    </div>
                  </td>
                </tr>
                {/* Column headers row */}
                <tr className="bg-blue-50">
                  {['Name', 'Phone', 'Email', 'Source', 'Plan Interest', 'Status', 'Follow-up', 'Date', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-black text-xs uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 9 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                      ))}
                    </tr>
                  ))
                ) : enquiries.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-16 text-muted-foreground text-sm">
                      No enquiries found
                    </td>
                  </tr>
                ) : (
                  enquiries.map(e => (
                    <tr
                      key={e.id}
                      className="hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => navigate(`/enquiries/${e.id}/edit`)}
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium">{e.name}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Phone className="h-3 w-3 shrink-0" />{e.phone}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {e.email
                          ? <span className="flex items-center gap-1 text-muted-foreground"><Mail className="h-3 w-3 shrink-0" />{e.email}</span>
                          : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs">{sourceLabel(e.source)}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {e.plan_interest || <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusStyle(e.status)}`}>
                          {statusLabel(e.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                        {e.follow_up_date
                          ? <span className="flex items-center gap-1 text-amber-600"><Calendar className="h-3 w-3" />{formatDate(e.follow_up_date)}</span>
                          : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                        {formatDate(e.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isAdminOrManager && e.status !== 'converted' && (
                            <button
                              onClick={ev => { ev.stopPropagation(); convertMutation.mutate(e.id) }}
                              disabled={convertMutation.isPending}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors whitespace-nowrap disabled:opacity-50"
                              title="Convert to membership"
                            >
                              <UserPlus className="h-3.5 w-3.5" />
                              Convert
                            </button>
                          )}
                          {isAdminOrManager && (
                            <button
                              onClick={ev => { ev.stopPropagation(); setDeleteTarget(e) }}
                              className="text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Delete confirm */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete Enquiry"
        description={`Delete enquiry from ${deleteTarget?.name}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
