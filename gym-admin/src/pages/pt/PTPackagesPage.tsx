import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { ptApi, type PTPackage } from '@/api/pt.api'
import { formatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import { Package2, Search, Zap, Pencil, Ban, Layers, DollarSign, Clock4, Plus, X } from 'lucide-react'
import {
  loadPackageSplits, savePackageSplits, computeSplit, type PackageSplit,
  loadCategories, saveCategories, type PTCategory,
  loadPackageDurations,
} from '@/lib/service-types'

const QUERY_KEY = ['billing', 'pt-packages']

export default function PTPackagesPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const canManage = user?.role === 'admin' || user?.role === 'manager'

  const [search, setSearch] = useState('')
  const [pkgSplits, setPkgSplits]       = useState<Record<string, PackageSplit>>({})
  const [categories, setCategories]     = useState<PTCategory[]>([])
  const [pkgDurations, setPkgDurations] = useState<Record<string, number>>({})
  const [newCatName, setNewCatName]   = useState('')
  const [newCatPct, setNewCatPct]     = useState('60')
  const [addingCat, setAddingCat]     = useState(false)
  const [editingCat, setEditingCat]   = useState<string | null>(null)   // name of category being edited
  const [editName, setEditName]       = useState('')
  const [editPct, setEditPct]         = useState('')

  useEffect(() => {
    setPkgSplits(loadPackageSplits())
    setCategories(loadCategories())
    setPkgDurations(loadPackageDurations())
  }, [])

  const saveNewCategory = () => {
    const name = newCatName.trim()
    if (!name || !newCatPct) return
    if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      toast.error('Category already exists')
      return
    }
    const next = [...categories, { name, gymPct: Number(newCatPct) }]
    setCategories(next)
    saveCategories(next)
    setNewCatName(''); setNewCatPct('60'); setAddingCat(false)
    toast.success('Category added')
  }

  const removeCategory = (name: string) => {
    const next = categories.filter(c => c.name !== name)
    setCategories(next)
    saveCategories(next)
  }

  const startEdit = (cat: PTCategory) => {
    setEditingCat(cat.name)
    setEditName(cat.name)
    setEditPct(String(cat.gymPct))
    setAddingCat(false)
  }

  const saveEdit = () => {
    const name = editName.trim()
    if (!name || !editPct) return
    const oldName = editingCat!
    const next = categories.map(c =>
      c.name === oldName ? { name, gymPct: Number(editPct) } : c
    )
    setCategories(next)
    saveCategories(next)
    // Update any packages that were using the old name
    const updatedSplits = { ...pkgSplits }
    Object.keys(updatedSplits).forEach(k => {
      if (updatedSplits[k].category === oldName) {
        updatedSplits[k] = { ...updatedSplits[k], category: name }
      }
    })
    setPkgSplits(updatedSplits)
    savePackageSplits(updatedSplits)
    setEditingCat(null)
    toast.success('Category updated')
  }

  const assignCategory = (pkgId: number, catName: string) => {
    const cat = categories.find(c => c.name === catName)
    const next = {
      ...pkgSplits,
      [String(pkgId)]: { category: catName, gymPct: cat?.gymPct ?? 60 },
    }
    setPkgSplits(next)
    savePackageSplits(next)
  }

  const updateSplit = (pkgId: number, field: 'category' | 'gymPct', value: string | number) => {
    const current = pkgSplits[String(pkgId)] ?? { gymPct: 60, category: '' }
    const next = { ...pkgSplits, [String(pkgId)]: { ...current, [field]: value } }
    setPkgSplits(next)
    savePackageSplits(next)
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => ptApi.listPackages(),
  })

  const allPkgs: PTPackage[] = (data as { pt_packages?: PTPackage[] })?.pt_packages ?? []

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => ptApi.deactivatePackage(id),
    onSuccess: () => {
      toast.success('Package deactivated')
      qc.invalidateQueries({ queryKey: QUERY_KEY })
    },
    onError: () => toast.error('Failed to deactivate package'),
  })

  // Client-side search
  const pkgs = search.trim()
    ? allPkgs.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : allPkgs

  // Stats
  const activePkgs    = allPkgs.filter(p => p.is_active)
  const inactivePkgs  = allPkgs.filter(p => !p.is_active)
  const totalSessions = activePkgs.reduce((s, p) => s + p.sessions, 0)
  const prices        = activePkgs.map(p => p.price)
  const minPrice      = prices.length ? Math.min(...prices) : null
  const maxPrice      = prices.length ? Math.max(...prices) : null

  return (
    <div className="space-y-6">

      {/* ── Edge-to-edge header ── */}
      <div className="relative overflow-hidden -mx-6 -mt-6 bg-gradient-to-r from-teal-600 via-cyan-600 to-sky-600 px-6 py-6 text-white">
        <div className="relative">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Package2 className="w-6 h-6 opacity-90" />
                <h1 className="text-xl font-bold">PT Packages</h1>
              </div>
              <p className="text-sm text-white/80 max-w-2xl">
                Personal training session bundles — set up packages with session counts, validity windows, and pricing that trainers can sell to members.
              </p>
            </div>
            {canManage && (
              <Button
                size="sm"
                className="shrink-0 bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm"
                onClick={() => navigate('/pt/packages/new')}
              >
                + New Package
              </Button>
            )}
          </div>

          {/* Stat chips */}
          {!isLoading && (
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1 text-xs font-medium">
                <Layers className="w-3.5 h-3.5" /> {allPkgs.length} total
              </div>
              <div className="flex items-center gap-1.5 bg-green-400/30 backdrop-blur-sm border border-green-300/40 rounded-full px-3 py-1 text-xs font-medium">
                <Zap className="w-3.5 h-3.5 text-green-200" /> {activePkgs.length} active
              </div>
              {inactivePkgs.length > 0 && (
                <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1 text-xs font-medium">
                  <Ban className="w-3.5 h-3.5 text-white/60" /> {inactivePkgs.length} inactive
                </div>
              )}
              {totalSessions > 0 && (
                <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1 text-xs font-medium">
                  <Clock4 className="w-3.5 h-3.5" /> {totalSessions} sessions (active)
                </div>
              )}
              {minPrice !== null && maxPrice !== null && (
                <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1 text-xs font-medium">
                  <DollarSign className="w-3.5 h-3.5" />
                  {minPrice === maxPrice
                    ? formatCurrency(minPrice)
                    : `${formatCurrency(minPrice)} – ${formatCurrency(maxPrice)}`}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute -right-2 -bottom-8 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
      </div>

      {isError && <p className="text-sm text-destructive">Failed to load packages.</p>}

      {/* ── PT Categories card ── */}
      {canManage && (
        <Card className="shadow-sm rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b bg-teal-50/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-teal-600" />
              <span className="font-medium text-sm text-teal-700">PT Categories</span>
              <span className="text-xs text-muted-foreground">— define categories and their default gym/trainer split</span>
            </div>
            {!addingCat && (
              <button
                onClick={() => setAddingCat(true)}
                className="flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-900 bg-white border border-teal-200 px-2.5 py-1 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Category
              </button>
            )}
          </div>

          <div className="px-4 py-3 flex flex-wrap gap-2 items-center">
            {categories.map(cat => (
              editingCat === cat.name ? (
                <div key={cat.name} className="flex items-center gap-2 bg-teal-50 border border-teal-300 rounded-xl px-3 py-1.5">
                  <input
                    autoFocus
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveEdit()}
                    className="h-6 w-28 rounded border border-input bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-teal-400"
                  />
                  <span className="text-xs text-muted-foreground">Gym</span>
                  <div className="relative flex items-center">
                    <input
                      type="number" min={0} max={100}
                      value={editPct}
                      onChange={e => setEditPct(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveEdit()}
                      className="h-6 w-12 rounded border border-input bg-white pl-1.5 pr-4 text-xs focus:outline-none focus:ring-1 focus:ring-teal-400 text-center"
                    />
                    <span className="absolute right-1 text-[10px] text-muted-foreground pointer-events-none">%</span>
                  </div>
                  <button onClick={saveEdit} className="text-xs font-medium text-teal-700 hover:text-teal-900">Save</button>
                  <button onClick={() => setEditingCat(null)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
                </div>
              ) : (
                <div
                  key={cat.name}
                  className="flex items-center gap-1.5 bg-white border border-teal-200 rounded-full px-3 py-1 text-xs"
                >
                  <span className="font-medium text-teal-800">{cat.name}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-teal-600 font-semibold">Gym {cat.gymPct}%</span>
                  <span className="text-muted-foreground">/ Trainer {100 - cat.gymPct}%</span>
                  <button
                    onClick={() => startEdit(cat)}
                    className="ml-1 text-muted-foreground hover:text-teal-600 transition-colors"
                    title="Edit"
                  >✎</button>
                  <button
                    onClick={() => removeCategory(cat.name)}
                    className="text-muted-foreground hover:text-red-500 transition-colors"
                    title="Remove"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )
            ))}
            {categories.length === 0 && !addingCat && (
              <p className="text-xs text-muted-foreground">No categories yet — add one to get started.</p>
            )}

            {addingCat && (
              <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-xl px-3 py-2">
                <input
                  autoFocus
                  type="text"
                  placeholder="Category name"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveNewCategory()}
                  className="h-7 w-32 rounded border border-input bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-teal-400"
                />
                <div className="relative flex items-center">
                  <span className="text-xs text-muted-foreground mr-1">Gym</span>
                  <input
                    type="number" min={0} max={100}
                    value={newCatPct}
                    onChange={e => setNewCatPct(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveNewCategory()}
                    className="h-7 w-14 rounded border border-input bg-white pl-2 pr-5 text-xs focus:outline-none focus:ring-1 focus:ring-teal-400 text-center"
                  />
                  <span className="absolute right-1.5 text-[10px] text-muted-foreground pointer-events-none">%</span>
                </div>
                <button
                  onClick={saveNewCategory}
                  className="h-7 px-3 rounded-lg bg-teal-600 text-white text-xs font-medium hover:bg-teal-700 transition-colors"
                >Save</button>
                <button
                  onClick={() => { setAddingCat(false); setNewCatName(''); setNewCatPct('60') }}
                  className="h-7 px-2 rounded-lg text-muted-foreground hover:text-foreground text-xs"
                >Cancel</button>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ── Table card ── */}
      <Card className="shadow-lg shadow-gray-200/80 rounded-xl overflow-hidden">

        {/* Search bar */}
        <div className="flex items-center justify-between gap-4 px-4 py-3 border-b bg-teal-50/60">
          <p className="font-medium text-sm text-teal-700 whitespace-nowrap flex items-center gap-1.5">
            <Package2 className="w-4 h-4" />
            {isLoading ? 'Loading…' : `${pkgs.length} package${pkgs.length !== 1 ? 's' : ''}`}
          </p>
          <div className="relative w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-teal-400" />
            <Input
              placeholder="Search by name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gradient-to-r from-teal-50 via-cyan-50 to-sky-50">
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Package</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Revenue Split</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Sessions</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Validity</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Price</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700">Status</th>
                {canManage && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y">

              {isLoading && Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  {[1,2,3,4,5,6].map(c => (
                    <td key={c} className="px-4 py-3">
                      <div className="h-4 bg-gray-100 rounded animate-pulse w-20" />
                    </td>
                  ))}
                </tr>
              ))}

              {!isLoading && pkgs.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 7 : 6} className="px-4 py-14 text-center">
                    <Package2 className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-muted-foreground text-sm font-medium">No packages found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {search ? 'Try a different search term.' : 'Click "New Package" to create the first one.'}
                    </p>
                  </td>
                </tr>
              )}

              {!isLoading && pkgs.map((pkg) => {
                const ps   = pkgSplits[String(pkg.id)]
                const split = ps && ps.gymPct > 0 ? computeSplit(ps) : null
                return (
                  <tr
                    key={pkg.id}
                    className="hover:bg-teal-50/40 cursor-pointer transition-colors"
                    onClick={() => navigate(`/pt/packages/${pkg.id}`)}
                  >
                    {/* Package name + description */}
                    <td className="px-4 py-3">
                      <p className="font-medium leading-tight">{pkg.name}</p>
                      {pkg.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 max-w-[200px]">
                          {pkg.description}
                        </p>
                      )}
                    </td>

                    {/* Revenue Split — category dropdown + override % */}
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="space-y-1.5 w-52">
                        <div className="flex gap-1.5">
                          <select
                            value={ps?.category ?? ''}
                            onChange={e => assignCategory(pkg.id, e.target.value)}
                            className="h-7 flex-1 min-w-0 rounded border border-input bg-background px-2 text-xs focus:outline-none appearance-none cursor-pointer"
                          >
                            <option value="">— Select type —</option>
                            {categories.map(c => (
                              <option key={c.name} value={c.name}>{c.name}</option>
                            ))}
                          </select>
                          {ps?.category && (
                            <div className="relative flex items-center shrink-0">
                              <input
                                type="number" min={0} max={100}
                                value={ps.gymPct}
                                onChange={e => updateSplit(pkg.id, 'gymPct', Number(e.target.value))}
                                className="h-7 w-14 rounded border border-input bg-background pl-2 pr-5 text-xs focus:outline-none focus:ring-1 focus:ring-teal-400 text-center"
                                title="Override gym %"
                              />
                              <span className="absolute right-1.5 text-[10px] text-muted-foreground pointer-events-none">%</span>
                            </div>
                          )}
                        </div>
                        {split && (
                          <div className="space-y-0.5">
                            <div className="w-full h-1.5 rounded-full overflow-hidden bg-muted flex">
                              <div className="h-full bg-teal-500 rounded-full" style={{ width: `${split.gymPct}%` }} />
                            </div>
                            <div className="flex justify-between text-[10px] font-medium">
                              <span className="text-teal-600">Gym {split.gymPct}%</span>
                              <span className="text-muted-foreground">Trainer {split.trainerPct}%</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Sessions */}
                    <td className="px-4 py-3">
                      <span className="text-lg font-bold text-teal-700">{pkg.sessions}</span>
                      <span className="text-xs text-muted-foreground ml-1">sessions</span>
                    </td>

                    {/* Validity + Duration */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-sm">
                        <Clock4 className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{pkg.validity_days} days</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {pkgDurations[String(pkg.id)] ?? 60} min/session
                      </div>
                    </td>

                    {/* Price */}
                    <td className="px-4 py-3">
                      <p className="font-semibold">{formatCurrency(pkg.price)}</p>
                      {pkg.sessions > 0 && (
                        <p className="text-[10px] text-muted-foreground">{formatCurrency(pkg.price / pkg.sessions)}/session</p>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      {pkg.is_active ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                          <Zap className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                          Inactive
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    {canManage && (
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-end">
                          {pkg.is_active && (
                            <button
                              title="Deactivate package"
                              className="p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                              onClick={() => deactivateMutation.mutate(pkg.id)}
                              disabled={deactivateMutation.isPending}
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            title="View details"
                            className="p-1.5 rounded-md text-muted-foreground hover:text-teal-600 hover:bg-teal-50 transition-colors"
                            onClick={() => navigate(`/pt/packages/${pkg.id}`)}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
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
