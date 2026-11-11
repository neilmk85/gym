// Pre-defined exercise categories
export const EXERCISE_CATEGORIES = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps',
  'Legs', 'Glutes', 'Core / Abs', 'Cardio', 'Full Body',
  'Functional', 'Stretching & Mobility', 'Olympic Lifting', 'Powerlifting', 'Other',
]

// Pre-defined muscle groups (for multi-select chips)
export const MUSCLE_GROUPS = [
  'Chest', 'Upper Back', 'Lats', 'Rear Delts', 'Front Delts', 'Side Delts',
  'Biceps', 'Triceps', 'Forearms', 'Traps',
  'Abs', 'Obliques', 'Lower Back',
  'Glutes', 'Quads', 'Hamstrings', 'Calves', 'Hip Flexors', 'Adductors',
  'Full Body',
]

// Pre-defined equipment
export const EQUIPMENT_LIST = [
  'Barbell', 'Dumbbell', 'Kettlebell', 'Cable Machine', 'Smith Machine',
  'Resistance Band', 'Pull-up Bar', 'Bench', 'Leg Press Machine',
  'Lat Pulldown Machine', 'Rowing Machine', 'Treadmill', 'Stationary Bike',
  'Battle Ropes', 'TRX / Suspension', 'Medicine Ball', 'Foam Roller',
  'Bodyweight (No Equipment)',
]

// Difficulty levels
export const DIFFICULTY_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert']

// Primary function
export const PRIMARY_FUNCTIONS = [
  'Strength', 'Hypertrophy', 'Endurance', 'Power', 'Flexibility', 'Balance', 'Rehabilitation',
]

// Photos stored locally (keyed by exercise ID) since backend doesn't support file uploads
const PHOTOS_KEY = 'gym_exercise_photos_v1'

export type ExercisePhotos = { urls: string[] }

export function loadExercisePhotos(exerciseId: number): string[] {
  try {
    const raw = localStorage.getItem(PHOTOS_KEY)
    if (!raw) return []
    const map: Record<string, string[]> = JSON.parse(raw)
    return map[String(exerciseId)] ?? []
  } catch { return [] }
}

export function saveExercisePhotos(exerciseId: number, urls: string[]): void {
  try {
    const raw = localStorage.getItem(PHOTOS_KEY)
    const map: Record<string, string[]> = raw ? JSON.parse(raw) : {}
    map[String(exerciseId)] = urls.filter(Boolean)
    localStorage.setItem(PHOTOS_KEY, JSON.stringify(map))
  } catch { /* ignore */ }
}

export function deleteExercisePhotos(exerciseId: number): void {
  try {
    const raw = localStorage.getItem(PHOTOS_KEY)
    if (!raw) return
    const map: Record<string, string[]> = JSON.parse(raw)
    delete map[String(exerciseId)]
    localStorage.setItem(PHOTOS_KEY, JSON.stringify(map))
  } catch { /* ignore */ }
}
