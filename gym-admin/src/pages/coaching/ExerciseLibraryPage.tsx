import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Plus, Dumbbell, Pencil, Trash2, Search, CheckCircle2, XCircle, Eye,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { coachingApi, type Exercise } from '@/api/coaching.api'
import { EXERCISE_CATEGORIES, loadExercisePhotos, deleteExercisePhotos } from '@/lib/exercise-meta'

// ── Category color map ────────────────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  'Chest':                  'bg-red-100 text-red-700 border-red-200',
  'Back':                   'bg-blue-100 text-blue-700 border-blue-200',
  'Shoulders':              'bg-orange-100 text-orange-700 border-orange-200',
  'Biceps':                 'bg-teal-100 text-teal-700 border-teal-200',
  'Triceps':                'bg-cyan-100 text-cyan-700 border-cyan-200',
  'Legs':                   'bg-green-100 text-green-700 border-green-200',
  'Glutes':                 'bg-pink-100 text-pink-700 border-pink-200',
  'Core / Abs':             'bg-yellow-100 text-yellow-700 border-yellow-200',
  'Cardio':                 'bg-purple-100 text-purple-700 border-purple-200',
  'Full Body':              'bg-indigo-100 text-indigo-700 border-indigo-200',
  'Functional':             'bg-lime-100 text-lime-700 border-lime-200',
  'Stretching & Mobility':  'bg-sky-100 text-sky-700 border-sky-200',
  'Olympic Lifting':        'bg-amber-100 text-amber-700 border-amber-200',
  'Powerlifting':           'bg-rose-100 text-rose-700 border-rose-200',
}

function CategoryChip({ category }: { category: string }) {
  const cls = CAT_COLORS[category] ?? 'bg-gray-100 text-gray-600 border-gray-200'
  return (
    <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full border ${cls}`}>
      {category}
    </span>
  )
}

// ── Thumbnail ─────────────────────────────────────────────────────────────────

function ExerciseThumbnail({ exerciseId }: { exerciseId: number }) {
  const photos = loadExercisePhotos(exerciseId)
  const first = photos[0]
  return (
    <div className="w-14 h-10 rounded-md overflow-hidden bg-muted border shrink-0 flex items-center justify-center">
      {first
        ? <img src={first} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
        : <Dumbbell className="w-4 h-4 text-muted-foreground/40" />
      }
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ExerciseLibraryPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [search, setSearch]           = useState('')
  const [categoryFilter, setCategory] = useState('all')
  const [statusFilter, setStatus]     = useState('all')

  const { data, isLoading } = useQuery({
    queryKey: ['exercises', search],
    queryFn: () => coachingApi.listExercises({ search, per_page: 200 }),
  })
  const allExercises: Exercise[] = (data as any)?.exercises ?? []

  const filtered = useMemo(() => allExercises.filter(ex => {
    const matchCat    = categoryFilter === 'all' || ex.category === categoryFilter
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? ex.is_active : !ex.is_active)
    return matchCat && matchStatus
  }), [allExercises, categoryFilter, statusFilter])

  const activeCount  = allExercises.filter(e => e.is_active).length
  const inactiveCount = allExercises.length - activeCount
  const categoryCount = new Set(allExercises.map(e => e.category).filter(Boolean)).size

  const deleteMutation = useMutation({
    mutationFn: (id: number) => coachingApi.deleteExercise(id),
    onSuccess: (_: unknown, id: number) => {
      deleteExercisePhotos(id)
      qc.invalidateQueries({ queryKey: ['exercises'] })
      toast.success('Exercise deleted')
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Failed to delete'),
  })

  const handleDelete = (ex: Exercise) => {
    if (!confirm(`Delete "${ex.name}"? This cannot be undone.`)) return
    deleteMutation.mutate(ex.id)
  }

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="relative overflow-hidden -mx-6 -mt-6 bg-gradient-to-br from-violet-700 via-purple-700 to-fuchsia-700 text-white">
        <div className="relative px-6 py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold tracking-widest uppercase text-white/55 mb-1.5">Coaching</p>
              <div className="flex items-center gap-2.5 mb-1">
                <Dumbbell className="w-5 h-5 opacity-80" />
                <h1 className="text-2xl font-bold tracking-tight">Exercise Library</h1>
              </div>
              <p className="text-sm text-white/65">Manage the master catalogue of exercises for workout plans</p>
            </div>
            <Button onClick={() => navigate('/coaching/exercises/new')}
              className="shrink-0 bg-white text-violet-800 hover:bg-white/90">
              <Plus className="w-4 h-4 mr-1.5" /> Add Exercise
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/15 border-t border-white/15">
          <div className="px-5 py-4">
            <p className="text-xl font-bold">{allExercises.length}</p>
            <p className="text-xs font-medium text-white/85 mt-1">Total Exercises</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xl font-bold text-green-300">{activeCount}</p>
            <p className="text-xs font-medium text-white/85 mt-1">Active</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xl font-bold text-amber-300">{inactiveCount}</p>
            <p className="text-xs font-medium text-white/85 mt-1">Inactive</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xl font-bold text-sky-300">{categoryCount}</p>
            <p className="text-xs font-medium text-white/85 mt-1">Categories</p>
          </div>
        </div>
        <div className="absolute -right-6 -top-6 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute right-20 -bottom-8 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />
      </div>

      {/* ── Category filter chips ── */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setCategory('all')}
          className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
            categoryFilter === 'all'
              ? 'bg-violet-600 text-white border-violet-600'
              : 'bg-background text-muted-foreground border-input hover:border-violet-400'
          }`}
        >
          All Categories
        </button>
        {EXERCISE_CATEGORIES.map(c => (
          <button key={c}
            onClick={() => setCategory(categoryFilter === c ? 'all' : c)}
            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
              categoryFilter === c
                ? 'bg-violet-600 text-white border-violet-600'
                : 'bg-background text-muted-foreground border-input hover:border-violet-400'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* ── Search + status filter ── */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search exercises, muscles…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9 w-72"
          />
        </div>
        <select value={statusFilter} onChange={e => setStatus(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="all">All Statuses</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>
      </div>

      {/* ── Table ── */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-sidebar">
                  <tr>
                    {['', 'Exercise Name', 'Category', 'Muscle Groups', 'Equipment', 'Difficulty', 'Status', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-light text-sidebar-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-16 text-muted-foreground">
                        {allExercises.length === 0
                          ? 'No exercises yet. Click "Add Exercise" to build the library.'
                          : 'No exercises match your filters.'}
                      </td>
                    </tr>
                  ) : filtered.map(ex => {
                    const muscleList = ex.muscle_groups
                      ? ex.muscle_groups.split(',').map(m => m.trim()).filter(Boolean)
                      : []

                    // Extract difficulty from instructions if packed there
                    const diffMatch = (ex.instructions ?? '').match(/\[Difficulty: ([^\]]+)\]/)
                    const difficulty = diffMatch ? diffMatch[1] : null

                    return (
                      <tr key={ex.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5">
                          <ExerciseThumbnail exerciseId={ex.id} />
                        </td>
                        <td className="px-4 py-2.5">
                          <p className="font-semibold">{ex.name}</p>
                          {ex.video_url && (
                            <a href={ex.video_url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-violet-600 hover:underline">
                              Watch video
                            </a>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {ex.category ? <CategoryChip category={ex.category} /> : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-wrap gap-1 max-w-[220px]">
                            {muscleList.length > 0
                              ? muscleList.map(m => (
                                <span key={m} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                                  {m}
                                </span>
                              ))
                              : <span className="text-muted-foreground/40">—</span>
                            }
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                          {ex.equipment || <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          {difficulty
                            ? <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                                difficulty === 'Beginner' ? 'bg-green-100 text-green-700 border-green-200' :
                                difficulty === 'Intermediate' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                difficulty === 'Advanced' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                'bg-red-100 text-red-700 border-red-200'
                              }`}>{difficulty}</span>
                            : <span className="text-muted-foreground/40">—</span>
                          }
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${
                            ex.is_active
                              ? 'bg-green-100 text-green-700 border-green-200'
                              : 'bg-gray-100 text-gray-500 border-gray-200'
                          }`}>
                            {ex.is_active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            {ex.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1">
                            <button title="Edit"
                              onClick={() => navigate(`/coaching/exercises/${ex.id}/edit`)}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button title="Delete"
                              onClick={() => handleDelete(ex)}
                              disabled={deleteMutation.isPending}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!isLoading && filtered.length > 0 && (
            <div className="px-4 py-3 border-t text-xs text-muted-foreground">
              Showing {filtered.length} of {allExercises.length} exercises
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
