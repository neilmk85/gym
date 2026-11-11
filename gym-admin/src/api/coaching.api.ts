import { apiFetch } from './client'

export interface Exercise {
  id: number
  name: string
  category: string
  muscle_groups: string
  equipment: string
  instructions: string
  video_url: string
  is_active: boolean
  created_at: string
}

export interface WorkoutAssignment {
  id: number
  member_id: number
  trainer_id: number
  training_template_id?: number
  title: string
  description: string
  start_date: string
  end_date?: string
  status: 'active' | 'completed' | 'revoked'
  notes: string
  created_at: string
  member?: { user: { first_name: string; last_name: string } }
  trainer?: { user: { first_name: string; last_name: string } }
}

export interface DietAssignment {
  id: number
  member_id: number
  trainer_id: number
  diet_template_id?: number
  title: string
  description: string
  start_date: string
  end_date?: string
  status: 'active' | 'completed' | 'revoked'
  notes: string
  created_at: string
  member?: { user: { first_name: string; last_name: string } }
  trainer?: { user: { first_name: string; last_name: string } }
}

export interface WorkoutLog {
  id: number
  member_id: number
  workout_assignment_id?: number
  pt_session_id?: number
  log_date: string
  status: 'completed' | 'skipped' | 'partial'
  duration_minutes: number
  notes: string
  exercises: string
  created_at: string
}

export interface TrainerFeedback {
  id: number
  member_id: number
  trainer_id: number
  workout_assignment_id?: number
  pt_session_id?: number
  rating: 'excellent' | 'good' | 'average' | 'poor' | ''
  feedback: string
  goals: string
  recommendations: string
  feedback_date: string
  created_at: string
  member?: { user: { first_name: string; last_name: string } }
  trainer?: { user: { first_name: string; last_name: string } }
}

export const coachingApi = {
  // Exercises
  createExercise: (data: Partial<Exercise>) =>
    apiFetch('/exercises', { method: 'POST', body: JSON.stringify(data) }),

  listExercises: (params?: { page?: number; per_page?: number; search?: string }) => {
    const q = new URLSearchParams()
    if (params?.page) q.set('page', String(params.page))
    if (params?.per_page) q.set('per_page', String(params.per_page))
    if (params?.search) q.set('search', params.search)
    return apiFetch(`/exercises?${q}`)
  },

  getExercise: (id: number) => apiFetch(`/exercises/${id}`),

  updateExercise: (id: number, data: Partial<Exercise>) =>
    apiFetch(`/exercises/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteExercise: (id: number) =>
    apiFetch(`/exercises/${id}`, { method: 'DELETE' }),

  // Workout assignments
  createWorkoutAssignment: (data: {
    member_id: number
    trainer_id: number
    training_template_id?: number
    title: string
    description?: string
    start_date: string
    end_date?: string
    notes?: string
  }) => apiFetch('/workout-assignments', { method: 'POST', body: JSON.stringify(data) }),

  getWorkoutAssignment: (id: number) => apiFetch(`/workout-assignments/${id}`),

  listWorkoutAssignmentsByMember: (memberId: number, params?: { page?: number; per_page?: number }) => {
    const q = new URLSearchParams()
    if (params?.page) q.set('page', String(params.page))
    if (params?.per_page) q.set('per_page', String(params.per_page))
    return apiFetch(`/members/${memberId}/workout-assignments?${q}`)
  },

  listWorkoutAssignmentsByTrainer: (trainerId: number, params?: { page?: number; per_page?: number }) => {
    const q = new URLSearchParams()
    if (params?.page) q.set('page', String(params.page))
    if (params?.per_page) q.set('per_page', String(params.per_page))
    return apiFetch(`/trainers/${trainerId}/workout-assignments?${q}`)
  },

  revokeWorkoutAssignment: (id: number) =>
    apiFetch(`/workout-assignments/${id}`, { method: 'DELETE' }),

  // Diet assignments
  createDietAssignment: (data: {
    member_id: number
    trainer_id: number
    diet_template_id?: number
    title: string
    description?: string
    start_date: string
    end_date?: string
    notes?: string
  }) => apiFetch('/diet-assignments', { method: 'POST', body: JSON.stringify(data) }),

  getDietAssignment: (id: number) => apiFetch(`/diet-assignments/${id}`),

  listDietAssignmentsByMember: (memberId: number, params?: { page?: number; per_page?: number }) => {
    const q = new URLSearchParams()
    if (params?.page) q.set('page', String(params.page))
    if (params?.per_page) q.set('per_page', String(params.per_page))
    return apiFetch(`/members/${memberId}/diet-assignments?${q}`)
  },

  listDietAssignmentsByTrainer: (trainerId: number, params?: { page?: number; per_page?: number }) => {
    const q = new URLSearchParams()
    if (params?.page) q.set('page', String(params.page))
    if (params?.per_page) q.set('per_page', String(params.per_page))
    return apiFetch(`/trainers/${trainerId}/diet-assignments?${q}`)
  },

  revokeDietAssignment: (id: number) =>
    apiFetch(`/diet-assignments/${id}`, { method: 'DELETE' }),

  // Workout logs
  createWorkoutLog: (data: {
    member_id: number
    workout_assignment_id?: number
    pt_session_id?: number
    log_date: string
    status?: string
    duration_minutes?: number
    notes?: string
    exercises?: string
  }) => apiFetch('/workout-logs', { method: 'POST', body: JSON.stringify(data) }),

  getWorkoutLog: (id: number) => apiFetch(`/workout-logs/${id}`),

  listWorkoutLogsByMember: (memberId: number, params?: { page?: number; per_page?: number }) => {
    const q = new URLSearchParams()
    if (params?.page) q.set('page', String(params.page))
    if (params?.per_page) q.set('per_page', String(params.per_page))
    return apiFetch(`/members/${memberId}/workout-logs?${q}`)
  },

  // Trainer feedback
  createTrainerFeedback: (data: {
    member_id: number
    trainer_id: number
    workout_assignment_id?: number
    pt_session_id?: number
    rating?: string
    feedback: string
    goals?: string
    recommendations?: string
    feedback_date?: string
  }) => apiFetch('/trainer-feedback', { method: 'POST', body: JSON.stringify(data) }),

  getTrainerFeedback: (id: number) => apiFetch(`/trainer-feedback/${id}`),

  listFeedbackByMember: (memberId: number, params?: { page?: number; per_page?: number }) => {
    const q = new URLSearchParams()
    if (params?.page) q.set('page', String(params.page))
    if (params?.per_page) q.set('per_page', String(params.per_page))
    return apiFetch(`/members/${memberId}/trainer-feedback?${q}`)
  },

  listFeedbackByTrainer: (trainerId: number, params?: { page?: number; per_page?: number }) => {
    const q = new URLSearchParams()
    if (params?.page) q.set('page', String(params.page))
    if (params?.per_page) q.set('per_page', String(params.per_page))
    return apiFetch(`/trainers/${trainerId}/trainer-feedback?${q}`)
  },
}
