import { apiFetch } from './client'
import type { TrainerProfile, TrainerSchedule } from '@/types/trainer.types'

export const trainersApi = {
  list: (activeOnly?: boolean) =>
    apiFetch<{ trainers: TrainerProfile[]; meta: unknown }>('/trainers', {
      params: activeOnly !== undefined ? { active_only: activeOnly } : undefined,
    }),

  getById: (id: number) => apiFetch<TrainerProfile>(`/trainers/${id}`),

  create: (data: Record<string, unknown>) =>
    apiFetch<TrainerProfile>('/trainers', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: number, data: Record<string, unknown>) =>
    apiFetch<TrainerProfile>(`/trainers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deactivate: (id: number) =>
    apiFetch<void>(`/trainers/${id}`, { method: 'DELETE' }),

  getClasses: (id: number) =>
    apiFetch<unknown[]>(`/trainers/${id}/classes`),

  // Schedule
  getSchedule: (id: number) =>
    apiFetch<{ shifts: TrainerSchedule[] }>(`/trainers/${id}/schedule`),

  createShift: (id: number, data: Record<string, unknown>) =>
    apiFetch<TrainerSchedule>(`/trainers/${id}/schedule`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateShift: (trainerId: number, shiftId: number, data: Record<string, unknown>) =>
    apiFetch<TrainerSchedule>(`/trainers/${trainerId}/schedule/${shiftId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteShift: (trainerId: number, shiftId: number) =>
    apiFetch<void>(`/trainers/${trainerId}/schedule/${shiftId}`, { method: 'DELETE' }),
}
