import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { classesApi } from '@/api/classes.api'
import { trainersApi } from '@/api/trainers.api'
import { formatDateTime, formatCurrency } from '@/lib/utils'
import type { GymClass } from '@/types/class.types'
import type { TrainerProfile } from '@/types/trainer.types'
import {
  CalendarDays, Search, Users, Zap, CheckCircle2, XCircle,
  Clock, DollarSign, TrendingUp, BarChart2,
} from 'lucide-react'

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  scheduled:  { label: 'Scheduled',  cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
  ongoing:    { label: 'Ongoing',    cls: 'bg-green-50 text-green-700 border border-green-200' },
  completed:  { label: 'Completed',  cls: 'bg-gray-100 text-gray-600 border border-gray-200' },
  cancelled:  { label: 'Cancelled',  cls: 'bg-red-50 text-red-600 border border-red-200' },
}

const TYPE_COLORS: Record<string, string> = {
  yoga:     'bg-purple-100 text-purple-700',
  pilates:  'bg-pink-100 text-pink-700',
  crossfit: 'bg-orange-100 text-orange-700',
  cycling:  'bg-blue-100 text-blue-700',
  boxing:   'bg-red-100 text-red-700',
  swimming: 'bg-cyan-100 text-cyan-700',
  hiit:     'bg-yellow-100 text-yellow-700',
  other:    'bg-gray-100 text-gray-600',
}

const CLASS_TYPES = ['yoga', 'pilates', 'crossfit', 'cycling', 'boxing', 'swimming', 'hiit', 'other']

export default function ClassesReportPage() {
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter]   = useState('all')

  const { data: classData, isLoading: classLoading } = useQuery({
    queryKey: ['report-classes'],
    queryFn: () => classesApi.list({ page: 1, per_page: 100 }),
  })

  const { data: trainerData } = useQuery({
    queryKey: ['trainers-list'],
    queryFn: () => trainersApi.list(),
  })

  const allClasses: GymClass[] = (classData as any)?.items ?? (classData as any)?.classes ?? []
  const trainers: TrainerProfile[] = (trainerData as { trainers?: TrainerProfile[] })?.trainers ?? []

  const trainerMap = useMemo(() => {
    const m = new Map<number, string>()
    trainers.forEach(t => {
      if (t.user) m.set(t.id, `${t.user.first_name} ${t.user.last_name}`)
    })
    return m
  }, [trainers])

  // Stats
  const totalEnrolled   = allClasses.reduce((s, c) => s + (c.current_bookings ?? 0), 0)
  const totalCapacity   = allClasses.reduce((s, c) => s + (c.max_capacity ?? 0), 0)
  const fillRate        = totalCapacity > 0 ? Math.round((totalEnrolled / totalCapacity) * 100) : 0
  const countScheduled  = allClasses.filter(c => c.status === 'scheduled').length
  const countOngoing    = allClasses.filter(c => c.status === 'ongoing').length
  const countCompleted  = allClasses.filter(c => c.status === 'completed').length
  const countCancelled  = allClasses.filter(c => c.status === 'cancelled').length
  const countFree       = allClasses.filter(c => c.is_free).length
  const countPaid       = allClasses.filter(c => !c.is_free).length

  // Per-class fill rates for average
  const fillRates = allClasses
    .filter(c => c.max_capacity > 0)
    .map(c => Math.round((c.current_bookings / c.max_capacity) * 100))
  const avgFillRate = fillRates.length
    ? Math.round(fillRates.reduce((a, b) => a + b, 0) / fillRates.length)
    : 0

  // Filtered classes
  const filtered = useMemo(() => {
    return allClasses.filter(c => {
      const matchSearch = !search.trim() ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.class_type.toLowerCase().includes(search.toLowerCase())
      const matchStatus = statusFilter === 'all' || c.status === statusFilter
      const matchType   = typeFilter === 'all' || c.class_type === typeFilter
      return matchSearch && matchStatus && matchType
    })
  }, [allClasses, search, statusFilter, typeFilter])

  return (
    <div className="space-y-6">

      {/* ── Edge-to-edge header ── */}
      <div className="relative overflow-hidden -mx-6 -mt-6 bg-gradient-to-r from-teal-600 via-cyan-600 to-sky-600 px-6 py-6 text-white">
        <div className="relative">
          <div className="flex items-start gap-3 mb-1">
            <CalendarDays className="w-6 h-6 opacity-90 mt-0.5" />
            <div>
              <h1 className="text-xl font-bold">Classes Report</h1>
              <p className="text-sm text-white/80 mt-0.5 max-w-2xl">
                Enrollment rates, trainer assignments, and class activity across all scheduled sessions.
              </p>
            </div>
          </div>

          {/* Stat chips */}
          {!classLoading && (
            <div className="flex flex-wrap gap-2 mt-4">
              <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1 text-xs font-medium">
                <CalendarDays className="w-3.5 h-3.5" /> {allClasses.length} total
              </div>
              <div className="flex items-center gap-1.5 bg-blue-400/30 backdrop-blur-sm border border-blue-300/40 rounded-full px-3 py-1 text-xs font-medium">
                <Zap className="w-3.5 h-3.5 text-blue-200" /> {countScheduled} scheduled
              </div>
              {countOngoing > 0 && (
                <div className="flex items-center gap-1.5 bg-green-400/30 backdrop-blur-sm border border-green-300/40 rounded-full px-3 py-1 text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" /> {countOngoing} ongoing
                </div>
              )}
              <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1 text-xs font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-200" /> {countCompleted} completed
              </div>
              {countCancelled > 0 && (
                <div className="flex items-center gap-1.5 bg-red-400/20 backdrop-blur-sm border border-red-300/30 rounded-full px-3 py-1 text-xs font-medium">
                  <XCircle className="w-3.5 h-3.5 text-red-200" /> {countCancelled} cancelled
                </div>
              )}
              <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1 text-xs font-medium">
                <Users className="w-3.5 h-3.5" /> {totalEnrolled}/{totalCapacity} enrolled
              </div>
              <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1 text-xs font-medium">
                <TrendingUp className="w-3.5 h-3.5" /> {fillRate}% fill rate
              </div>
            </div>
          )}
        </div>
        <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute -right-2 -bottom-8 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
      </div>

      {/* ── Summary stat cards ── */}
      {!classLoading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-50">
                <CalendarDays className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Classes</p>
                <p className="text-2xl font-bold text-teal-700">{allClasses.length}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <BarChart2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Fill Rate</p>
                <p className="text-2xl font-bold text-blue-700">{avgFillRate}%</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Free Classes</p>
                <p className="text-2xl font-bold text-green-700">{countFree}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-50">
                <DollarSign className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Paid Classes</p>
                <p className="text-2xl font-bold text-orange-700">{countPaid}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ── Table card ── */}
      <Card className="shadow-lg shadow-gray-200/80 rounded-xl overflow-hidden">

        {/* Search + filter bar */}
        <div className="flex items-center justify-between gap-4 px-4 py-3 border-b bg-teal-50/60 flex-wrap">
          <p className="font-medium text-sm text-teal-700 whitespace-nowrap flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4" />
            {classLoading ? 'Loading…' : `${filtered.length} class${filtered.length !== 1 ? 'es' : ''}`}
          </p>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="relative w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-teal-400" />
              <Input placeholder="Search name or type…" value={search}
                onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="h-9 w-36 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
              <option value="all">All statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="h-9 w-36 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
              <option value="all">All types</option>
              {CLASS_TYPES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gradient-to-r from-teal-50 via-cyan-50 to-sky-50">
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Class</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Trainer</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Scheduled</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Enrolled</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Fill Rate</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Price</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">

              {classLoading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {[1,2,3,4,5,6,7].map(c => (
                    <td key={c} className="px-4 py-3">
                      <div className="h-4 bg-gray-100 rounded animate-pulse w-24" />
                    </td>
                  ))}
                </tr>
              ))}

              {!classLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center">
                    <CalendarDays className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-muted-foreground text-sm font-medium">No classes found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {search || statusFilter !== 'all' || typeFilter !== 'all'
                        ? 'Try adjusting your filters.'
                        : 'No classes have been scheduled yet.'}
                    </p>
                  </td>
                </tr>
              )}

              {!classLoading && filtered.map(cls => {
                const trainerName = cls.trainer_id ? (trainerMap.get(cls.trainer_id) ?? `Trainer #${cls.trainer_id}`) : '—'
                const enrolled    = cls.current_bookings ?? 0
                const capacity    = cls.max_capacity ?? 0
                const fill        = capacity > 0 ? Math.round((enrolled / capacity) * 100) : 0
                const fillColor   = fill >= 90 ? 'text-red-600' : fill >= 75 ? 'text-orange-500' : 'text-green-600'
                const fillBar     = fill >= 90 ? 'bg-red-500' : fill >= 75 ? 'bg-orange-400' : 'bg-teal-500'
                const sCfg        = STATUS_CFG[cls.status] ?? { label: cls.status, cls: 'bg-gray-100 text-gray-600' }
                const typeColor   = TYPE_COLORS[cls.class_type] ?? TYPE_COLORS.other
                const price       = (cls as any).price as number | undefined

                return (
                  <tr key={cls.id} className="hover:bg-teal-50/40 transition-colors">

                    {/* Class */}
                    <td className="px-4 py-3">
                      <p className="font-medium leading-tight">{cls.name}</p>
                      <span className={`inline-block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded capitalize ${typeColor}`}>
                        {cls.class_type}
                      </span>
                    </td>

                    {/* Trainer */}
                    <td className="px-4 py-3 text-muted-foreground">{trainerName}</td>

                    {/* Scheduled */}
                    <td className="px-4 py-3">
                      <p className="text-sm">{formatDateTime(cls.start_time)}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" /> {cls.duration_mins} min
                      </p>
                    </td>

                    {/* Enrolled + fill bar */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{enrolled}/{capacity}</span>
                        <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className={`h-full rounded-full ${fillBar}`} style={{ width: `${fill}%` }} />
                        </div>
                      </div>
                    </td>

                    {/* Fill Rate */}
                    <td className="px-4 py-3">
                      <span className={`font-semibold text-sm ${fillColor}`}>{fill}%</span>
                    </td>

                    {/* Price */}
                    <td className="px-4 py-3">
                      {cls.is_free
                        ? <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">Free</span>
                        : <span className="font-medium">{formatCurrency(price ?? 0)}</span>
                      }
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${sCfg.cls}`}>
                        {sCfg.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
