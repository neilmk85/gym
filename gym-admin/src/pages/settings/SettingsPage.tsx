import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared/PageHeader'
import { AvatarWithFallback } from '@/components/shared/AvatarWithFallback'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { authApi } from '@/api/auth.api'
import { facilitiesApi } from '@/api/facilities.api'
import { useAuthStore } from '@/store/auth.store'
import { useUIStore } from '@/store/ui.store'
import { ApiError } from '@/api/client'
import { cn } from '@/lib/utils'
import {
  User,
  Shield,
  SlidersHorizontal,
  Sun,
  Moon,
  Monitor,
  CheckCircle2,
  Mail,
  KeyRound,
  Layers,
  Building2,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'profile' | 'security' | 'preferences' | 'gym'

const ALL_TABS: { id: Tab; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
  { id: 'profile',     label: 'Profile',      icon: User },
  { id: 'security',    label: 'Security',     icon: Shield },
  { id: 'preferences', label: 'Preferences',  icon: SlidersHorizontal },
  { id: 'gym',         label: 'Gym Settings', icon: Building2, adminOnly: true },
]

// ─── Change Password Schema ───────────────────────────────────────────────────

const passwordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z
    .string()
    .min(8, 'Must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
  confirm_password: z.string(),
}).refine((d) => d.new_password === d.confirm_password, {
  message: "Passwords don't match",
  path: ['confirm_password'],
})

type PasswordForm = z.infer<typeof passwordSchema>

// ─── Profile schema ───────────────────────────────────────────────────────────

const profileSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name:  z.string().min(1, 'Last name is required'),
  phone:      z.string().optional(),
})
type ProfileForm = z.infer<typeof profileSchema>

// ─── Profile Tab ──────────────────────────────────────────────────────────────

function ProfileTab() {
  const { user, setAuth, accessToken } = useAuthStore()
  const [editing, setEditing] = useState(false)

  const ROLE_COLORS: Record<string, string> = {
    admin:   'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
    manager: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    trainer: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    member:  'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  }

  const roleColor = ROLE_COLORS[user?.role ?? 'member'] ?? ROLE_COLORS.member

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: user?.first_name ?? '',
      last_name:  user?.last_name ?? '',
      phone:      user?.phone ?? '',
    },
  })

  const onSubmit = async (data: ProfileForm) => {
    try {
      const updated = await authApi.updateMe(data)
      setAuth(updated, accessToken ?? '')
      toast.success('Profile updated')
      setEditing(false)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update profile')
    }
  }

  return (
    <div className="space-y-6">
      {/* Avatar & identity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your Profile</CardTitle>
          <CardDescription>Your account information as it appears in the system.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center">
            <AvatarWithFallback
              firstName={user?.first_name ?? '?'}
              lastName={user?.last_name ?? '?'}
              className="h-20 w-20 text-2xl shrink-0"
            />
            <div className="space-y-1">
              <h3 className="text-xl font-semibold">
                {user?.first_name} {user?.last_name}
              </h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                {user?.email}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full capitalize', roleColor)}>
                  {user?.role}
                </span>
                {user?.email_verified && (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Email verified
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Details / Edit form */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Account Details</CardTitle>
          {!editing && (
            <Button variant="outline" size="sm" onClick={() => {
              reset({ first_name: user?.first_name ?? '', last_name: user?.last_name ?? '', phone: user?.phone ?? '' })
              setEditing(true)
            }}>
              Edit
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {editing ? (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="first_name">First Name</Label>
                  <Input id="first_name" {...register('first_name')} />
                  {errors.first_name && <p className="text-xs text-destructive">{errors.first_name.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input id="last_name" {...register('last_name')} />
                  {errors.last_name && <p className="text-xs text-destructive">{errors.last_name.message}</p>}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" type="tel" placeholder="+91 98765 43210" {...register('phone')} />
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="submit" size="sm" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving…' : 'Save changes'}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <div>
                <dt className="text-muted-foreground mb-0.5">First Name</dt>
                <dd className="font-medium">{user?.first_name || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground mb-0.5">Last Name</dt>
                <dd className="font-medium">{user?.last_name || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground mb-0.5">Email Address</dt>
                <dd className="font-medium">{user?.email ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground mb-0.5">Phone</dt>
                <dd className="font-medium">{user?.phone || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground mb-0.5">Role</dt>
                <dd className="font-medium capitalize">{user?.role ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground mb-0.5">User ID</dt>
                <dd className="font-mono text-xs text-muted-foreground">#{user?.id}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground mb-0.5">Email Status</dt>
                <dd>
                  {user?.email_verified ? (
                    <Badge variant="secondary" className="text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400 border-0">
                      Verified
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 border-0">
                      Unverified
                    </Badge>
                  )}
                </dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Security Tab ─────────────────────────────────────────────────────────────

function SecurityTab() {
  const [done, setDone] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) })

  const onSubmit = async (data: PasswordForm) => {
    try {
      await authApi.changePassword(data.current_password, data.new_password)
      toast.success('Password changed successfully')
      reset()
      setDone(true)
      setTimeout(() => setDone(false), 4000)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to change password'
      toast.error(message)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            Change Password
          </CardTitle>
          <CardDescription>
            Choose a strong password. Must be at least 8 characters with an uppercase letter and a number.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {done ? (
            <div className="flex items-center gap-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Password updated successfully. Use your new password on next sign in.
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
              <div className="space-y-1.5">
                <Label htmlFor="current_password">Current Password</Label>
                <Input
                  id="current_password"
                  type="password"
                  autoComplete="current-password"
                  {...register('current_password')}
                />
                {errors.current_password && (
                  <p className="text-xs text-destructive">{errors.current_password.message}</p>
                )}
              </div>

              <Separator />

              <div className="space-y-1.5">
                <Label htmlFor="new_password">New Password</Label>
                <Input
                  id="new_password"
                  type="password"
                  autoComplete="new-password"
                  {...register('new_password')}
                />
                {errors.new_password && (
                  <p className="text-xs text-destructive">{errors.new_password.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm_password">Confirm New Password</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  autoComplete="new-password"
                  {...register('confirm_password')}
                />
                {errors.confirm_password && (
                  <p className="text-xs text-destructive">{errors.confirm_password.message}</p>
                )}
              </div>

              <Button type="submit" loading={isSubmitting}>
                Update Password
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Session info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Session</CardTitle>
          <CardDescription>Your current authentication session details.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <p>Access tokens expire after <strong className="text-foreground">15 minutes</strong> and are refreshed automatically.</p>
          <p>Your session will remain active as long as your refresh token is valid (7 days).</p>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Preferences Tab ──────────────────────────────────────────────────────────

type ThemeOption = 'light' | 'dark' | 'system'

const THEME_OPTIONS: { value: ThemeOption; label: string; icon: React.ElementType }[] = [
  { value: 'light',  label: 'Light',  icon: Sun },
  { value: 'dark',   label: 'Dark',   icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

function PreferencesTab() {
  const { theme, setTheme, sidebarCollapsed, toggleSidebar } = useUIStore()

  return (
    <div className="space-y-6">
      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
          <CardDescription>Choose how the admin panel looks to you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-3 block">Theme</Label>
            <div className="grid grid-cols-3 gap-3 max-w-sm">
              {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
                const active = theme === value
                return (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-xl border-2 p-3 text-sm font-medium transition-all',
                      active
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border hover:border-primary/40 hover:bg-muted text-muted-foreground',
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sidebar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            Sidebar
          </CardTitle>
          <CardDescription>Configure the navigation sidebar behaviour.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between max-w-sm">
            <div>
              <p className="text-sm font-medium">Collapsed sidebar</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Show only icons, hiding labels to save space.
              </p>
            </div>
            {/* Toggle switch */}
            <button
              onClick={toggleSidebar}
              className={cn(
                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent',
                'transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                sidebarCollapsed ? 'bg-primary' : 'bg-muted-foreground/30',
              )}
              role="switch"
              aria-checked={sidebarCollapsed}
            >
              <span
                className={cn(
                  'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0',
                  'transition-transform duration-200 ease-in-out',
                  sidebarCollapsed ? 'translate-x-5' : 'translate-x-0',
                )}
              />
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Gym Settings Tab ─────────────────────────────────────────────────────────

const gymSchema = z.object({
  name:         z.string().min(1, 'Gym name is required'),
  address:      z.string().optional(),
  city:         z.string().optional(),
  state:        z.string().optional(),
  phone:        z.string().optional(),
  email:        z.string().email('Invalid email').optional().or(z.literal('')),
  opening_time: z.string().optional(),
  closing_time: z.string().optional(),
  max_capacity: z.coerce.number().int().min(1).optional(),
})
type GymForm = z.infer<typeof gymSchema>

function GymSettingsTab() {
  const qc = useQueryClient()
  const setFacilityName = useUIStore(s => s.setFacilityName)

  const { data: facilityRaw, isLoading } = useQuery({
    queryKey: ['facility', 1],
    queryFn: () => facilitiesApi.getById(1),
  })
  const facility = facilityRaw as any

  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<GymForm>({
    resolver: zodResolver(gymSchema),
    values: facility ? {
      name:         facility.name ?? '',
      address:      facility.address ?? '',
      city:         facility.city ?? '',
      state:        facility.state ?? '',
      phone:        facility.phone ?? '',
      email:        facility.email ?? '',
      opening_time: facility.opening_time ?? '06:00',
      closing_time: facility.closing_time ?? '22:00',
      max_capacity: facility.max_capacity ?? 200,
    } : undefined,
  })

  const mutation = useMutation({
    mutationFn: (data: GymForm) => facilitiesApi.update(1, data as Record<string, unknown>),
    onSuccess: (res: any) => {
      if (res?.name) setFacilityName(res.name)
      qc.invalidateQueries({ queryKey: ['facility', 1] })
      toast.success('Gym settings saved')
      reset(undefined, { keepValues: true })
    },
    onError: () => toast.error('Failed to save gym settings'),
  })

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-10 text-center">Loading…</div>
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Gym Information
          </CardTitle>
          <CardDescription>
            This name appears on the login page and throughout the app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4 max-w-lg">
            <div className="space-y-1.5">
              <Label>Gym / Facility Name <span className="text-destructive">*</span></Label>
              <Input {...register('name')} placeholder="e.g. StayFit Gym" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input {...register('city')} placeholder="Pune" />
              </div>
              <div className="space-y-1.5">
                <Label>State</Label>
                <Input {...register('state')} placeholder="Maharashtra" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input {...register('address')} placeholder="123, MG Road" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input {...register('phone')} placeholder="+91 98765 43210" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" {...register('email')} placeholder="admin@gym.com" />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Opening Time</Label>
                <Input type="time" {...register('opening_time')} />
              </div>
              <div className="space-y-1.5">
                <Label>Closing Time</Label>
                <Input type="time" {...register('closing_time')} />
              </div>
              <div className="space-y-1.5">
                <Label>Max Capacity</Label>
                <Input type="number" min="1" {...register('max_capacity')} placeholder="200" />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="submit" disabled={mutation.isPending || !isDirty}>
                {mutation.isPending ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'
  const [activeTab, setActiveTab] = useState<Tab>('profile')

  const visibleTabs = ALL_TABS.filter(t => !t.adminOnly || isAdmin)

  const ActiveContent =
    activeTab === 'profile'     ? ProfileTab      :
    activeTab === 'security'    ? SecurityTab     :
    activeTab === 'gym'         ? GymSettingsTab  :
    PreferencesTab

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your account and preferences" />

      {/* Tab bar */}
      <div className="flex gap-1 border-b mb-6">
        {visibleTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <ActiveContent />
    </div>
  )
}
