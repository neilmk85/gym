export interface Notification {
  id: number
  user_id: number
  type: string
  channel: string
  title: string
  body: string
  data?: Record<string, unknown>
  is_read: boolean
  read_at?: string
  sent_at?: string
  resource_type?: string
  resource_id?: number
  created_at: string
  updated_at: string
}

export interface NotificationPreference {
  id: number
  user_id: number
  email_enabled: boolean
  push_enabled: boolean
  sms_enabled: boolean
  sub_expiry_alerts: boolean
  payment_alerts: boolean
  class_alerts: boolean
  class_reminders: boolean
  membership_alerts: boolean
  birthday_alerts: boolean
  promo_alerts: boolean
  created_at: string
  updated_at: string
}
