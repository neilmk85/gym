/**
 * Per-package revenue split config. Stored in localStorage until the backend
 * supports it. Each package can have a category label (e.g. "Pilates") and a
 * gym-keeps percentage; trainer earns the remainder.
 */

export interface PTCategory {
  name: string
  gymPct: number
}

export interface PackageSplit {
  gymPct: number    // gym keeps this %; trainer earns (100 - gymPct)%
  category: string  // human label, e.g. "Pilates", "Yoga PT"
}

const CATS_KEY   = 'pt_categories_v1'
const SPLITS_KEY = 'pt_package_splits_v1'

const DEFAULT_CATEGORIES: PTCategory[] = [
  { name: 'Gym PT',    gymPct: 60 },
  { name: 'Pilates',   gymPct: 50 },
  { name: 'Yoga',      gymPct: 70 },
  { name: 'Nutrition', gymPct: 80 },
  { name: 'HIIT',      gymPct: 60 },
  { name: 'Dance',     gymPct: 55 },
]

export function loadCategories(): PTCategory[] {
  try {
    const raw = localStorage.getItem(CATS_KEY)
    if (raw) return JSON.parse(raw) as PTCategory[]
  } catch { /* ignore */ }
  // Seed defaults on first load
  localStorage.setItem(CATS_KEY, JSON.stringify(DEFAULT_CATEGORIES))
  return DEFAULT_CATEGORIES
}

export function saveCategories(cats: PTCategory[]): void {
  localStorage.setItem(CATS_KEY, JSON.stringify(cats))
}

export function loadPackageSplits(): Record<string, PackageSplit> {
  try {
    const raw = localStorage.getItem(SPLITS_KEY)
    if (raw) return JSON.parse(raw) as Record<string, PackageSplit>
  } catch { /* ignore */ }
  return {}
}

export function savePackageSplits(map: Record<string, PackageSplit>): void {
  localStorage.setItem(SPLITS_KEY, JSON.stringify(map))
}

export function getPackageSplit(packageId: number): PackageSplit | null {
  return loadPackageSplits()[String(packageId)] ?? null
}

/** Commission event_type derived from category name. E.g. "Pilates" → "pt_pilates" */
export function splitEventKey(category: string): string {
  return 'pt_' + category.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

export function computeSplit(split: PackageSplit): { gymPct: number; trainerPct: number } {
  return { gymPct: split.gymPct, trainerPct: 100 - split.gymPct }
}

// ── Per-trainer salary ────────────────────────────────────────────────────────
const TRAINER_SALARIES_KEY = 'trainer_salaries_v1'

export function loadTrainerSalaries(): Record<string, number> {
  try {
    const raw = localStorage.getItem(TRAINER_SALARIES_KEY)
    if (raw) return JSON.parse(raw) as Record<string, number>
  } catch { /* ignore */ }
  return {}
}

export function saveTrainerSalary(trainerId: number, salary: number): void {
  const map = loadTrainerSalaries()
  map[String(trainerId)] = salary
  localStorage.setItem(TRAINER_SALARIES_KEY, JSON.stringify(map))
}

export function getTrainerSalary(trainerId: number, fallback = 0): number {
  return loadTrainerSalaries()[String(trainerId)] ?? fallback
}

// Seed salaries on first load (15000 base + 1500/yr experience)
const SEED_SALARIES: Record<string, number> = {
  '1': 22500, '2': 19500, '3': 24000, '4': 27000,
  '5': 21000, '6': 22500, '7': 25500, '8': 30000,
  '9': 19500, '10': 22500, '11': 21000, '12': 28500,
}
;(function seedSalaries() {
  try {
    const existing = localStorage.getItem(TRAINER_SALARIES_KEY)
    if (!existing) {
      localStorage.setItem(TRAINER_SALARIES_KEY, JSON.stringify(SEED_SALARIES))
    }
  } catch { /* ignore */ }
})()

// ── Per-package session duration (minutes) ───────────────────────────────────
const DURATIONS_KEY = 'pt_package_durations_v1'

export function loadPackageDurations(): Record<string, number> {
  try {
    const raw = localStorage.getItem(DURATIONS_KEY)
    if (raw) return JSON.parse(raw) as Record<string, number>
  } catch { /* ignore */ }
  return {}
}

export function savePackageDuration(packageId: number, minutes: number): void {
  const map = loadPackageDurations()
  map[String(packageId)] = minutes
  localStorage.setItem(DURATIONS_KEY, JSON.stringify(map))
}

export function getPackageDuration(packageId: number): number {
  return loadPackageDurations()[String(packageId)] ?? 60
}

// ── Per-trainer ID documents ──────────────────────────────────────────────────
const TRAINER_DOCS_KEY = 'trainer_docs_v1'

export interface TrainerDocs {
  pan_number?: string
  aadhar_number?: string
}

export function loadTrainerDocs(): Record<string, TrainerDocs> {
  try {
    const raw = localStorage.getItem(TRAINER_DOCS_KEY)
    if (raw) return JSON.parse(raw) as Record<string, TrainerDocs>
  } catch { /* ignore */ }
  return {}
}

export function saveTrainerDocs(trainerId: number, docs: TrainerDocs): void {
  const map = loadTrainerDocs()
  map[String(trainerId)] = { ...map[String(trainerId)], ...docs }
  localStorage.setItem(TRAINER_DOCS_KEY, JSON.stringify(map))
}

export function getTrainerDocs(trainerId: number): TrainerDocs {
  return loadTrainerDocs()[String(trainerId)] ?? {}
}
