// Time restriction data for membership plans, stored locally
// (backend Plan type doesn't include these fields)

const KEY = 'gym_plan_time_restrictions_v1'

export interface PlanTimeRestriction {
  enabled: boolean
  start_time: string   // "HH:MM" e.g. "06:00"
  end_time: string     // "HH:MM" e.g. "17:00"
  days: string[]       // e.g. ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  label: string        // e.g. "Happy Hours"
}

const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function defaultRestriction(): PlanTimeRestriction {
  return { enabled: false, start_time: '06:00', end_time: '17:00', days: ALL_DAYS, label: 'Happy Hours' }
}

export { ALL_DAYS }

function load(): Record<string, PlanTimeRestriction> {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function save(map: Record<string, PlanTimeRestriction>): void {
  try { localStorage.setItem(KEY, JSON.stringify(map)) } catch { /* ignore */ }
}

export function loadPlanTimeRestriction(planId: number): PlanTimeRestriction {
  return load()[String(planId)] ?? defaultRestriction()
}

export function savePlanTimeRestriction(planId: number, r: PlanTimeRestriction): void {
  const map = load()
  map[String(planId)] = r
  save(map)
}

export function deletePlanTimeRestriction(planId: number): void {
  const map = load()
  delete map[String(planId)]
  save(map)
}

export function loadAllPlanTimeRestrictions(): Record<string, PlanTimeRestriction> {
  return load()
}
