import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { notificationsApi } from '@/api/notifications.api'
import { QUERY_KEYS } from '@/lib/constants'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import type { Notification, NotificationPreference } from '@/types/notification.types'
import {
  Bell, BellOff, CheckCheck, CreditCard, DollarSign, Calendar,
  Clock, UserCheck, UserX, Star, AlertTriangle, MailCheck, Smartphone,
  MessageSquare, ChevronRight, Inbox, RefreshCw, Settings, X,
  CalendarX, CalendarCheck, Repeat, ShieldCheck, Zap, Filter,
} from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'

const PER_PAGE = 20

// ─── Notification type config ─────────────────────────────────────────────────

type NotifMeta = {
  icon: React.ReactNode
  color: string        // Tailwind text color
  bg: string          // Tailwind bg color (light)
  border: string      // left border inline style color
  badgeText: string
  category: 'subscription' | 'payment' | 'class' | 'membership' | 'system'
}

function getNotifMeta(type: string): NotifMeta {
  const map: Record<string, NotifMeta> = {
    subscription_expiry_7d: {
      icon: <AlertTriangle className="h-4 w-4" />,
      color: 'text-amber-600', bg: 'bg-amber-50', border: '#f59e0b',
      badgeText: 'Subscription', category: 'subscription',
    },
    subscription_expiry_3d: {
      icon: <AlertTriangle className="h-4 w-4" />,
      color: 'text-orange-600', bg: 'bg-orange-50', border: '#ea580c',
      badgeText: 'Subscription', category: 'subscription',
    },
    subscription_expired: {
      icon: <CreditCard className="h-4 w-4" />,
      color: 'text-red-600', bg: 'bg-red-50', border: '#dc2626',
      badgeText: 'Subscription', category: 'subscription',
    },
    subscription_renewed: {
      icon: <Repeat className="h-4 w-4" />,
      color: 'text-emerald-600', bg: 'bg-emerald-50', border: '#10b981',
      badgeText: 'Subscription', category: 'subscription',
    },
    payment_received: {
      icon: <DollarSign className="h-4 w-4" />,
      color: 'text-emerald-600', bg: 'bg-emerald-50', border: '#10b981',
      badgeText: 'Payment', category: 'payment',
    },
    payment_refunded: {
      icon: <DollarSign className="h-4 w-4" />,
      color: 'text-orange-600', bg: 'bg-orange-50', border: '#f97316',
      badgeText: 'Payment', category: 'payment',
    },
    class_booking_confirmed: {
      icon: <CalendarCheck className="h-4 w-4" />,
      color: 'text-sky-600', bg: 'bg-sky-50', border: '#027DFD',
      badgeText: 'Class', category: 'class',
    },
    class_booking_waitlisted: {
      icon: <Clock className="h-4 w-4" />,
      color: 'text-violet-600', bg: 'bg-violet-50', border: '#8b5cf6',
      badgeText: 'Class', category: 'class',
    },
    class_booking_promoted: {
      icon: <Zap className="h-4 w-4" />,
      color: 'text-sky-600', bg: 'bg-sky-50', border: '#027DFD',
      badgeText: 'Class', category: 'class',
    },
    class_reminder: {
      icon: <Calendar className="h-4 w-4" />,
      color: 'text-blue-600', bg: 'bg-blue-50', border: '#3b82f6',
      badgeText: 'Reminder', category: 'class',
    },
    class_cancelled: {
      icon: <CalendarX className="h-4 w-4" />,
      color: 'text-red-600', bg: 'bg-red-50', border: '#ef4444',
      badgeText: 'Class', category: 'class',
    },
    member_frozen: {
      icon: <UserX className="h-4 w-4" />,
      color: 'text-slate-600', bg: 'bg-slate-50', border: '#64748b',
      badgeText: 'Membership', category: 'membership',
    },
    member_unfrozen: {
      icon: <UserCheck className="h-4 w-4" />,
      color: 'text-teal-600', bg: 'bg-teal-50', border: '#14b8a6',
      badgeText: 'Membership', category: 'membership',
    },
    welcome: {
      icon: <Star className="h-4 w-4" />,
      color: 'text-violet-600', bg: 'bg-violet-50', border: '#7c3aed',
      badgeText: 'Welcome', category: 'system',
    },
    birthday_reminder: {
      icon: <span className="text-sm">🎂</span>,
      color: 'text-pink-600', bg: 'bg-pink-50', border: '#ec4899',
      badgeText: 'Birthday', category: 'membership',
    },
    payment_due_reminder: {
      icon: <Clock className="h-4 w-4" />,
      color: 'text-amber-600', bg: 'bg-amber-50', border: '#f59e0b',
      badgeText: 'Payment Due', category: 'payment',
    },
    trainer_assigned: {
      icon: <UserCheck className="h-4 w-4" />,
      color: 'text-[#007a99]', bg: 'bg-cyan-50', border: '#00B4D8',
      badgeText: 'Trainer', category: 'membership',
    },
    promo_announcement: {
      icon: <span className="text-sm">🎉</span>,
      color: 'text-emerald-600', bg: 'bg-emerald-50', border: '#10b981',
      badgeText: 'Offer', category: 'system',
    },
  }
  return map[type] ?? {
    icon: <Bell className="h-4 w-4" />,
    color: 'text-gray-600', bg: 'bg-gray-50', border: '#9ca3af',
    badgeText: 'Notification', category: 'system',
  }
}

// ─── Relative time ────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const now  = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((now - then) / 1000)

  if (diff < 60)  return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'unread' | 'subscription' | 'payment' | 'class' | 'membership'

const FILTER_TABS: { key: FilterTab; label: string; icon: React.ReactNode }[] = [
  { key: 'all',          label: 'All',          icon: <Bell className="h-3.5 w-3.5" /> },
  { key: 'unread',       label: 'Unread',       icon: <Inbox className="h-3.5 w-3.5" /> },
  { key: 'subscription', label: 'Subscriptions', icon: <CreditCard className="h-3.5 w-3.5" /> },
  { key: 'payment',      label: 'Payments',     icon: <DollarSign className="h-3.5 w-3.5" /> },
  { key: 'class',        label: 'Classes',      icon: <Calendar className="h-3.5 w-3.5" /> },
  { key: 'membership',   label: 'Membership',   icon: <ShieldCheck className="h-3.5 w-3.5" /> },
]

function applyFilter(notifications: Notification[], filter: FilterTab): Notification[] {
  if (filter === 'all')    return notifications
  if (filter === 'unread') return notifications.filter((n) => !n.is_read)
  return notifications.filter((n) => getNotifMeta(n.type).category === filter)
}

// ─── Toggle component ─────────────────────────────────────────────────────────

function Toggle({ checked, onChange, label, description }: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div className="flex-1 min-w-0 pr-4">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${checked ? 'bg-sky-600' : 'bg-muted'}`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`}
        />
      </button>
    </div>
  )
}

// ─── Single notification card ──────────────────────────────────────────────────

function NotifCard({ n, onMarkRead }: { n: Notification; onMarkRead: (id: number) => void }) {
  const meta = getNotifMeta(n.type)

  return (
    <div
      className={`relative flex gap-4 px-5 py-4 rounded-xl border transition-all group
        ${n.is_read
          ? 'bg-white/60 border-border opacity-80'
          : 'bg-white border-border shadow-sm'
        }`}
      style={{ borderLeft: `3px solid ${n.is_read ? '#e2e8f0' : meta.border}` }}
    >
      {/* Icon bubble */}
      <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${meta.bg} ${meta.color}`}>
        {meta.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-[10px] font-semibold tracking-wide uppercase px-1.5 py-0.5 rounded"
                style={{ background: meta.border + '18', color: meta.border }}
              >
                {meta.badgeText}
              </span>
              {!n.is_read && (
                <span className="h-2 w-2 rounded-full bg-sky-500 shrink-0" />
              )}
            </div>
            <h4 className={`text-sm font-semibold mt-1 ${n.is_read ? 'text-muted-foreground' : 'text-foreground'}`}>
              {n.title}
            </h4>
            <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{n.body}</p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">{relativeTime(n.created_at)}</span>
            {!n.is_read && (
              <button
                onClick={() => onMarkRead(n.id)}
                className="opacity-0 group-hover:opacity-100 text-[10px] text-sky-600 hover:text-sky-700 font-medium flex items-center gap-1 transition-opacity"
              >
                <CheckCheck className="h-3 w-3" />
                Mark read
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Preferences panel ────────────────────────────────────────────────────────

function PreferencesPanel({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()

  const { data: prefs, isLoading } = useQuery({
    queryKey: ['notifications', 'preferences'],
    queryFn: () => notificationsApi.getPreferences(),
  })

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => notificationsApi.updatePreferences(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'preferences'] })
      toast.success('Preferences saved')
    },
    onError: () => toast.error('Failed to save preferences'),
  })

  if (isLoading) {
    return (
      <div className="space-y-3 p-6">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
      </div>
    )
  }

  const p = prefs as NotificationPreference | undefined

  const update = (key: string, value: boolean) => {
    mutation.mutate({ [key]: value })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-5 flex items-center justify-between shrink-0 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-background border border-border flex items-center justify-center text-muted-foreground">
            <Settings className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Notification Preferences</h3>
            <p className="text-xs text-muted-foreground">Control what alerts you receive</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="h-7 w-7 rounded-lg bg-muted hover:bg-muted/70 flex items-center justify-center text-muted-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Delivery Channels */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-5 w-5 rounded bg-sky-100 flex items-center justify-center">
              <MailCheck className="h-3 w-3 text-sky-600" />
            </div>
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Delivery Channels</h4>
          </div>
          <div className="rounded-xl border border-border bg-card px-4">
            <Toggle
              checked={p?.email_enabled ?? true}
              onChange={(v) => update('email_enabled', v)}
              label="Email Notifications"
              description="Receive alerts to your registered email address"
            />
            <Toggle
              checked={p?.push_enabled ?? true}
              onChange={(v) => update('push_enabled', v)}
              label="Push Notifications"
              description="Browser push alerts when you're logged in"
            />
            <Toggle
              checked={p?.sms_enabled ?? false}
              onChange={(v) => update('sms_enabled', v)}
              label="SMS Notifications"
              description="Text messages to your registered mobile number"
            />
          </div>
        </div>

        {/* Alert Categories */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-5 w-5 rounded bg-amber-100 flex items-center justify-center">
              <Filter className="h-3 w-3 text-amber-600" />
            </div>
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Alert Categories</h4>
          </div>
          <div className="rounded-xl border border-border bg-card px-4">
            <Toggle
              checked={p?.sub_expiry_alerts ?? true}
              onChange={(v) => update('sub_expiry_alerts', v)}
              label="Subscription Expiry Alerts"
              description="7-day and 3-day advance notice before membership expires"
            />
            <Toggle
              checked={p?.payment_alerts ?? true}
              onChange={(v) => update('payment_alerts', v)}
              label="Payment Alerts"
              description="Receipts for payments received and refunds issued"
            />
            <Toggle
              checked={p?.class_alerts ?? true}
              onChange={(v) => update('class_alerts', v)}
              label="Class Booking Alerts"
              description="Confirmations, waitlist updates, and cancellations"
            />
            <Toggle
              checked={p?.class_reminders ?? true}
              onChange={(v) => update('class_reminders', v)}
              label="Class Reminders"
              description="Reminder 30 minutes before your scheduled class"
            />
            <Toggle
              checked={p?.membership_alerts ?? true}
              onChange={(v) => update('membership_alerts', v)}
              label="Membership Status Alerts"
              description="Freeze, unfreeze, trainer assignments, and status changes"
            />
            <Toggle
              checked={p?.birthday_alerts ?? true}
              onChange={(v) => update('birthday_alerts', v)}
              label="Birthday Wishes"
              description="A special notification on your birthday 🎂"
            />
            <Toggle
              checked={p?.promo_alerts ?? true}
              onChange={(v) => update('promo_alerts', v)}
              label="Promotional Offers"
              description="Exclusive deals, promo codes, and special discounts"
            />
          </div>
        </div>

        {/* Info card */}
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 flex gap-3">
          <Bell className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
          <p className="text-xs text-sky-700 leading-relaxed">
            Changes take effect immediately. In-app notifications are always delivered regardless of channel settings.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const queryClient = useQueryClient()
  const [filter, setFilter]         = useState<FilterTab>('all')
  const [page, setPage]             = useState(1)
  const [showPrefs, setShowPrefs]   = useState(false)

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: QUERY_KEYS.notifications,
    queryFn: () => notificationsApi.list({ page, per_page: PER_PAGE }),
    staleTime: 30_000,
  })

  const markReadMutation = useMutation({
    mutationFn: (id: number) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notificationUnreadCount })
    },
    onError: () => toast.error('Failed to mark as read'),
  })

  const markAllMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notificationUnreadCount })
      toast.success('All notifications marked as read')
    },
    onError: () => toast.error('Failed to mark all as read'),
  })

  const allNotifications: Notification[] = (data as { notifications?: Notification[] })?.notifications ?? []
  const unreadCount: number = (data as { unread_count?: number })?.unread_count ?? 0
  const meta = (data as { meta?: { total: number; page: number; per_page: number; total_pages: number } })?.meta

  const filtered = applyFilter(allNotifications, filter)

  // Category counts
  const counts: Record<FilterTab, number> = {
    all:          allNotifications.length,
    unread:       allNotifications.filter((n) => !n.is_read).length,
    subscription: allNotifications.filter((n) => getNotifMeta(n.type).category === 'subscription').length,
    payment:      allNotifications.filter((n) => getNotifMeta(n.type).category === 'payment').length,
    class:        allNotifications.filter((n) => getNotifMeta(n.type).category === 'class').length,
    membership:   allNotifications.filter((n) => getNotifMeta(n.type).category === 'membership').length,
  }

  return (
    <div className="flex gap-0 relative">
      {/* ── Main content ── */}
      <div className={`flex-1 min-w-0 transition-all duration-300 ${showPrefs ? 'mr-[360px]' : ''}`}>

        <PageHeader
          title="Notifications"
          subtitle={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : "You're all caught up"}
          icon={<Bell className="h-5 w-5" />}
          stats={[
            { label: 'Total',      value: meta?.total ?? allNotifications.length },
            { label: 'Unread',     value: unreadCount },
            { label: 'This Page',  value: allNotifications.length },
            { label: 'Categories', value: 5 },
          ]}
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground border border-border hover:text-foreground transition-colors"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllMutation.mutate()}
                  disabled={markAllMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground border border-border hover:text-foreground transition-colors"
                >
                  <CheckCheck className="h-4 w-4" />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setShowPrefs((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${showPrefs ? 'bg-cyan-50 text-[#007a99] border-cyan-200' : 'text-muted-foreground border-border hover:text-foreground'}`}
              >
                <Settings className="h-4 w-4" />
                Preferences
              </button>
            </div>
          }
        />

        {/* ── Filter tabs ── */}
        <div className="flex gap-1.5 mb-5 flex-wrap">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-all border ${
                filter === tab.key
                  ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                  : 'bg-white text-muted-foreground border-border hover:border-sky-300 hover:text-sky-700'
              }`}
            >
              {tab.icon}
              {tab.label}
              {counts[tab.key] > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                  filter === tab.key ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
                }`}>
                  {counts[tab.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        {isError && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm mb-4">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Failed to load notifications. Please try refreshing.
            <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-auto">Retry</Button>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex gap-4 px-5 py-4 rounded-xl border bg-white">
                <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-4 w-64" />
                  <Skeleton className="h-3.5 w-full max-w-sm" />
                </div>
                <Skeleton className="h-3 w-16 shrink-0" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 rounded-2xl border border-border bg-white/60">
            {filter === 'unread'
              ? <BellOff className="h-12 w-12 text-muted-foreground mb-4" />
              : <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
            }
            <h3 className="text-base font-semibold text-foreground">
              {filter === 'unread' ? 'All caught up!' : `No ${filter === 'all' ? '' : filter + ' '}notifications`}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {filter === 'unread'
                ? 'You have no unread notifications right now.'
                : `No notifications in this category yet.`}
            </p>
            {filter !== 'all' && (
              <button
                onClick={() => setFilter('all')}
                className="mt-4 text-sm text-sky-600 hover:text-sky-700 font-medium flex items-center gap-1"
              >
                View all notifications <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Group by date */}
            <NotifFeed
              notifications={filtered}
              onMarkRead={(id) => markReadMutation.mutate(id)}
            />

            {/* Pagination */}
            {meta && meta.total_pages > 1 && (
              <div className="flex items-center justify-between mt-5 pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  Showing {allNotifications.length} of {meta.total}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= meta.total_pages} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Preferences slide-in panel ── */}
      {showPrefs && (
        <div
          className="fixed top-0 right-0 h-full w-[360px] bg-background border-l border-border shadow-2xl z-40 flex flex-col overflow-hidden"
          style={{ animation: 'slideInRight 0.2s ease' }}
        >
          <PreferencesPanel onClose={() => setShowPrefs(false)} />
        </div>
      )}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  )
}

// ─── Feed grouped by date ─────────────────────────────────────────────────────

function NotifFeed({ notifications, onMarkRead }: {
  notifications: Notification[]
  onMarkRead: (id: number) => void
}) {
  // Group by calendar day
  const groups: { label: string; items: Notification[] }[] = []
  const seen = new Set<string>()

  for (const n of notifications) {
    const date = new Date(n.created_at)
    const now  = new Date()
    let label: string

    if (date.toDateString() === now.toDateString()) {
      label = 'Today'
    } else {
      const yesterday = new Date(now)
      yesterday.setDate(now.getDate() - 1)
      if (date.toDateString() === yesterday.toDateString()) {
        label = 'Yesterday'
      } else {
        label = date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
      }
    }

    if (!seen.has(label)) {
      seen.add(label)
      groups.push({ label, items: [] })
    }
    groups[groups.length - 1].items.push(n)
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.label}>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {group.label}
            </span>
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] text-muted-foreground">{group.items.length} notification{group.items.length > 1 ? 's' : ''}</span>
          </div>
          <div className="space-y-2">
            {group.items.map((n) => (
              <NotifCard key={n.id} n={n} onMarkRead={onMarkRead} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
