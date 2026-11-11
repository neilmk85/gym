import { apiFetch } from './client'
import type { Notification, NotificationPreference } from '@/types/notification.types'

export const notificationsApi = {
  list: (params?: { page?: number; per_page?: number }) =>
    apiFetch<{ notifications: Notification[]; unread_count: number; meta: { total: number; page: number; per_page: number; total_pages: number } }>('/notifications', { params }),

  unreadCount: () => apiFetch<{ unread_count: number }>('/notifications/unread-count'),

  markRead: (id: number) =>
    apiFetch<{ message: string }>(`/notifications/${id}/read`, { method: 'PATCH' }),

  markAllRead: () =>
    apiFetch<{ message: string }>('/notifications/read-all', { method: 'POST' }),

  getPreferences: () => apiFetch<NotificationPreference>('/notifications/preferences'),

  updatePreferences: (data: Record<string, unknown>) =>
    apiFetch<NotificationPreference>('/notifications/preferences', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
}
