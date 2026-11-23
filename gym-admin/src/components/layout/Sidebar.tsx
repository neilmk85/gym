import { useState, useMemo, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import stayfitLogo from '@/assets/stayfit-logo.jpg'
import {
  LayoutDashboard, Users, CreditCard, Receipt, Dumbbell,
  BookOpen, UserCheck, ClipboardList, Tag, Building2, BarChart3,
  Bell, ScrollText, Settings, ChevronLeft, ChevronRight, ChevronDown,
  Salad, Trophy, Ticket, UtensilsCrossed, Moon, Sun, LogOut, ChevronUp,
  TrendingDown, CalendarDays, MessageSquare, Wallet, Shield,
  Star, ShoppingCart, DollarSign, GitBranch, Package2, BarChart2, UserPlus, Warehouse, KeyRound, Repeat, Wrench, ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import { useUIStore } from '@/store/ui.store'
import { authApi } from '@/api/auth.api'
import { AvatarWithFallback } from '@/components/shared/AvatarWithFallback'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import type { Role } from '@/types/auth.types'
import { useMyPermissions } from '@/hooks/useMyPermissions'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  roles: Role[]
  permission?: string
}

interface NavGroup {
  label: string
  icon: React.ReactNode
  roles: Role[]
  items: NavItem[]
}

// ─── Standalone items (not in any group) ─────────────────────────────────────

const STANDALONE: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: <LayoutDashboard className="h-4 w-4" />,
    roles: ['owner', 'reception', 'manager', 'trainer'],
  },
]

// ─── Grouped items ────────────────────────────────────────────────────────────

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Members',
    icon: <Users className="h-4 w-4" />,
    roles: ['owner', 'reception', 'manager'],
    items: [
      { label: 'All Members',  href: '/members',    icon: <Users className="h-4 w-4" />,        roles: ['owner', 'reception', 'manager'] },
      { label: 'Enquiries',    href: '/enquiries',  icon: <MessageSquare className="h-4 w-4" />, roles: ['owner', 'reception', 'manager'] },
      { label: 'Trial Visits', href: '/crm/trials', icon: <Ticket className="h-4 w-4" />,        roles: ['owner', 'reception', 'manager'] },
    ],
  },
  {
    label: 'Sales',
    icon: <Wallet className="h-4 w-4" />,
    roles: ['owner', 'reception', 'manager'],
    items: [
      { label: 'Memberships',         href: '/memberships',          icon: <Receipt className="h-4 w-4" />, roles: ['owner', 'reception', 'manager'] },
      { label: 'Transfer Membership', href: '/memberships/transfer',  icon: <Repeat className="h-4 w-4" />, roles: ['owner', 'reception', 'manager'] },
      { label: 'Payments',       href: '/payments',       icon: <Receipt className="h-4 w-4" />,      roles: ['owner', 'reception', 'manager'] },
      { label: 'Day Passes',     href: '/day-passes',     icon: <Ticket className="h-4 w-4" />,       roles: ['owner', 'reception', 'manager'] },
      { label: 'Promo Codes',    href: '/promo-codes',    icon: <Tag className="h-4 w-4" />,          roles: ['owner'] },
      { label: 'GST Invoices',   href: '/billing/invoices',      icon: <ScrollText className="h-4 w-4" />,  roles: ['owner', 'reception', 'manager'] },
      { label: 'Receipts',       href: '/billing/receipts',      icon: <Receipt className="h-4 w-4" />,     roles: ['owner', 'reception', 'manager'] },
      { label: 'Credit Notes',   href: '/billing/credit-notes',  icon: <Receipt className="h-4 w-4" />,     roles: ['owner', 'reception', 'manager'] },
      { label: 'Point of Sale',  href: '/pos',                  icon: <ShoppingCart className="h-4 w-4" />, roles: ['superadmin'] },
    ],
  },
  {
    label: 'Purchases',
    icon: <Package2 className="h-4 w-4" />,
    roles: ['owner', 'reception', 'manager'],
    items: [
      { label: 'Expenses',        href: '/expenses',          icon: <TrendingDown className="h-4 w-4" />, roles: ['owner', 'reception', 'manager'] },
      { label: 'Direct Purchase', href: '/purchases/direct',  icon: <ShoppingCart className="h-4 w-4" />, roles: ['owner', 'reception', 'manager'] },
      { label: 'Vendors',         href: '/purchases/vendors',      icon: <Building2 className="h-4 w-4" />, roles: ['owner', 'reception', 'manager'] },
      { label: 'Maintenance',      href: '/purchases/maintenance',  icon: <Wrench className="h-4 w-4" />,   roles: ['owner', 'reception', 'manager'] },
    ],
  },
  {
    label: 'Fitness',
    icon: <Dumbbell className="h-4 w-4" />,
    roles: ['owner', 'reception', 'manager', 'trainer'],
    items: [
      { label: 'Classes',       href: '/classes',     icon: <Dumbbell className="h-4 w-4" />,    roles: ['owner', 'reception', 'manager', 'trainer'] },
      { label: 'Bookings',      href: '/bookings',    icon: <BookOpen className="h-4 w-4" />,    roles: ['owner', 'reception', 'manager'] },
      { label: 'Attendance',    href: '/attendance',  icon: <ClipboardList className="h-4 w-4" />, roles: ['owner', 'reception', 'manager', 'trainer'] },
      { label: 'PT Packages',    href: '/pt/packages',       icon: <Trophy       className="h-4 w-4" />, roles: ['owner', 'reception', 'manager'] },
      { label: 'PT Sessions',    href: '/pt/sessions',       icon: <CalendarDays className="h-4 w-4" />, roles: ['owner', 'reception', 'manager', 'trainer'] },
      { label: 'PT Enrolment',   href: '/pt/enroll',         icon: <UserPlus     className="h-4 w-4" />, roles: ['owner', 'reception', 'manager'] },
    ],
  },
  {
    label: 'Coaching',
    icon: <MessageSquare className="h-4 w-4" />,
    roles: ['superadmin'],
    items: [
      { label: 'Exercise Library',    href: '/coaching/exercises', icon: <Dumbbell className="h-4 w-4" />,      roles: ['superadmin'] },
      { label: 'Workout Assignments', href: '/coaching/workouts',  icon: <ClipboardList className="h-4 w-4" />, roles: ['superadmin'] },
      { label: 'Diet Assignments',    href: '/coaching/diet',      icon: <Salad className="h-4 w-4" />,         roles: ['superadmin'] },
      { label: 'Workout Logs',        href: '/coaching/logs',      icon: <ScrollText className="h-4 w-4" />,    roles: ['superadmin'] },
      { label: 'Trainer Feedback',    href: '/coaching/feedback',  icon: <MessageSquare className="h-4 w-4" />, roles: ['superadmin'] },
    ],
  },
  {
    label: 'Retention',
    icon: <TrendingDown className="h-4 w-4" />,
    roles: ['superadmin'],
    items: [
      { label: 'Workspace',         href: '/retention/workspace',    icon: <Shield className="h-4 w-4" />,       roles: ['superadmin'] },
      { label: 'Body Measurements', href: '/retention/measurements', icon: <ClipboardList className="h-4 w-4" />, roles: ['superadmin'] },
      { label: 'Progress Photos',   href: '/retention/photos',       icon: <BookOpen className="h-4 w-4" />,     roles: ['superadmin'] },
    ],
  },
  {
    label: 'Compliance',
    icon: <ScrollText className="h-4 w-4" />,
    roles: ['superadmin'],
    items: [
      { label: 'Waivers & PAR-Q', href: '/waivers', icon: <Shield className="h-4 w-4" />, roles: ['superadmin'] },
    ],
  },
  {
    label: 'Loyalty',
    icon: <Star className="h-4 w-4" />,
    roles: ['owner', 'reception', 'manager'],
    items: [
      { label: 'Loyalty & Referrals', href: '/loyalty', icon: <Star className="h-4 w-4" />, roles: ['superadmin'] },
    ],
  },
  {
    label: 'Staff',
    icon: <Users className="h-4 w-4" />,
    roles: ['owner', 'reception', 'manager'],
    items: [
      { label: 'All Staff',       href: '/staff',            icon: <Users className="h-4 w-4" />,        roles: ['owner', 'reception', 'manager'] },
      { label: 'Trainers',        href: '/trainers',         icon: <UserCheck className="h-4 w-4" />,    roles: ['owner', 'reception', 'manager'] },
      { label: 'Attendance',      href: '/staff/attendance', icon: <ClipboardList className="h-4 w-4" />, roles: ['owner', 'reception', 'manager'], permission: 'staff-attendance.view' },
      { label: 'Payroll',         href: '/staff/payroll',    icon: <Wallet className="h-4 w-4" />,        roles: ['owner', 'reception', 'manager'] },
      { label: 'Commissions',     href: '/commissions',      icon: <DollarSign className="h-4 w-4" />,    roles: ['owner', 'reception', 'manager'] },
    ],
  },
  {
    label: 'Branches',
    icon: <GitBranch className="h-4 w-4" />,
    roles: ['superadmin'],
    items: [
      { label: 'Manage Branches', href: '/branches', icon: <Building2 className="h-4 w-4" />, roles: ['superadmin'] },
    ],
  },
  {
    label: 'Lockers',
    icon: <KeyRound className="h-4 w-4" />,
    roles: ['owner', 'reception', 'manager'],
    items: [
      { label: 'Locker Management', href: '/lockers', icon: <KeyRound className="h-4 w-4" />, roles: ['owner', 'reception', 'manager'] },
    ],
  },
  {
    label: 'Content',
    icon: <BookOpen className="h-4 w-4" />,
    roles: ['superadmin'],
    items: [
      { label: 'Diet Templates',     href: '/diet-templates',     icon: <Salad className="h-4 w-4" />,          roles: ['superadmin'] },
      { label: 'Food Database',      href: '/foods',              icon: <UtensilsCrossed className="h-4 w-4" />, roles: ['superadmin'] },
      { label: 'Training Templates', href: '/training-templates', icon: <Trophy className="h-4 w-4" />,         roles: ['superadmin'] },
    ],
  },
  {
    label: 'Reports',
    icon: <BarChart3 className="h-4 w-4" />,
    roles: ['owner', 'reception', 'manager'],
    items: [
      { label: 'Overview',             href: '/reports',               icon: <BarChart3 className="h-4 w-4" />,    roles: ['owner', 'reception', 'manager'] },
      { label: 'Members Attendance',     href: '/reports/monthly',       icon: <CalendarDays className="h-4 w-4" />, roles: ['owner', 'reception', 'manager'] },
      { label: 'GST Report',           href: '/reports/gst',           icon: <Receipt className="h-4 w-4" />,      roles: [] },
      { label: 'Packages & Plans',     href: '/reports/packages',      icon: <Package2 className="h-4 w-4" />,     roles: ['owner', 'reception', 'manager'] },
      { label: 'Classes Report',       href: '/reports/classes',       icon: <BarChart2 className="h-4 w-4" />,    roles: ['owner', 'reception', 'manager'] },
      { label: 'Memberships Report',   href: '/reports/memberships',   icon: <CreditCard className="h-4 w-4" />,   roles: ['owner', 'reception', 'manager'] },
      { label: 'PT Report',            href: '/reports/pt',            icon: <Dumbbell className="h-4 w-4" />,     roles: ['owner', 'reception', 'manager'] },
      { label: 'Revenue Report',       href: '/reports/revenue',       icon: <TrendingDown className="h-4 w-4" />, roles: ['owner', 'reception', 'manager'] },
      { label: 'Staff Attendance',    href: '/reports/attendance',    icon: <ClipboardList className="h-4 w-4" />, roles: ['owner'] },
      { label: 'Members Report',       href: '/reports/members',       icon: <Users className="h-4 w-4" />,        roles: ['owner', 'reception', 'manager'] },
    ],
  },
  {
    label: 'Settings',
    icon: <Shield className="h-4 w-4" />,
    roles: ['owner', 'reception', 'manager', 'trainer'],
    items: [
      { label: 'Inventory',       href: '/inventory',      icon: <Warehouse className="h-4 w-4" />,  roles: ['owner', 'reception', 'manager'] },
      { label: 'Membership Plans', href: '/membership-plans', icon: <CreditCard className="h-4 w-4" />, roles: ['owner'] },
      { label: 'Facilities',    href: '/facilities',    icon: <Building2 className="h-4 w-4" />,  roles: ['owner', 'reception', 'manager'] },
      { label: 'Notifications', href: '/notifications', icon: <Bell className="h-4 w-4" />,       roles: ['owner', 'reception', 'manager', 'trainer'] },
      { label: 'Audit Logs',    href: '/audit-logs',    icon: <ScrollText className="h-4 w-4" />, roles: ['superadmin'] },
      { label: 'Tax Settings',  href: '/billing/tax-settings', icon: <Settings className="h-4 w-4" />, roles: ['owner'] },
      { label: 'Settings',      href: '/settings',      icon: <Settings className="h-4 w-4" />,   roles: ['owner', 'reception', 'manager', 'trainer'] },
    ],
  },
  {
    label: 'Super Admin',
    icon: <ShieldCheck className="h-4 w-4" />,
    roles: ['superadmin'],
    items: [
      { label: 'User Management', href: '/superadmin/users',         icon: <Users className="h-4 w-4" />,      roles: ['superadmin'] },
      { label: 'Entitlements',   href: '/superadmin/entitlements', icon: <ShieldCheck className="h-4 w-4" />, roles: ['superadmin'] },
    ],
  },
]

// ─── Explicit sub-page → nav-item parent mappings ────────────────────────────
// Maps a path prefix to the nav href that should be highlighted.
// Used when a detail page lives under a path that doesn't match its nav item.
// Longer/more-specific prefixes must come first.
const SUB_PAGE_PARENTS: Array<{ prefix: string; navHref: string }> = [
  { prefix: '/reports/trainers',      navHref: '/reports/pt' },
  { prefix: '/reports/members',       navHref: '/reports/members' },
  { prefix: '/purchases/direct/',     navHref: '/purchases/direct' },
]

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar() {
  const location  = useLocation()
  const navigate  = useNavigate()
  const { user, logout } = useAuthStore()
  const { hasPermission } = useMyPermissions()
  const { sidebarCollapsed, toggleSidebar, theme, setTheme } = useUIStore()

  // Collect every nav href so we can detect exact matches
  const allNavHrefs = useMemo(() => [
    ...STANDALONE.map(i => i.href),
    ...NAV_GROUPS.flatMap(g => g.items.map(i => i.href)),
  ], [])

  const isNavActive = (href: string) => {
    if (location.pathname === href) return true
    // Only use prefix match when no nav item exactly owns this path
    // (e.g. /members/123 highlights /members, but /reports/pt must NOT highlight /reports)
    if (allNavHrefs.includes(location.pathname)) return false
    // Explicit sub-page parent mappings: if current path starts with a known
    // prefix, only the mapped nav href is active (prevents /reports/* from
    // highlighting Overview instead of the correct report sub-item)
    for (const { prefix, navHref } of SUB_PAGE_PARENTS) {
      if (location.pathname.startsWith(prefix)) {
        return href === navHref
      }
    }
    return location.pathname.startsWith(href + '/')
  }

  // Track open/closed state purely by label — start with active groups open
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    NAV_GROUPS.forEach(g => {
      if (g.items.some(item => isNavActive(item.href))) {
        init[g.label] = true
      }
    })
    return init
  })

  // Auto-open the relevant group whenever the route changes
  useEffect(() => {
    NAV_GROUPS.forEach(g => {
      if (g.items.some(item => isNavActive(item.href))) {
        setOpenGroups(prev => prev[g.label] ? prev : { ...prev, [g.label]: true })
      }
    })
  }, [location.pathname])

  const toggleGroup = (label: string) =>
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }))

  const isGroupOpen = (label: string) => openGroups[label] ?? false

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem('gym_refresh_token') ?? ''
    try { await authApi.logout(refreshToken) } catch { /* ignore */ }
    logout()
    navigate('/login')
    toast.success('Logged out successfully')
  }

  const isDark = theme === 'dark'
  const role = user?.role as Role | undefined
  const isSuperAdmin = role === 'superadmin'
  const canSee = (roles: Role[], permission?: string) => {
    if (!role || isSuperAdmin) return true
    if (permission) return hasPermission(permission)
    return roles.includes(role)
  }

  // Filter standalone items by role (show all when role not yet known)
  const visibleStandalone = STANDALONE.filter(i => canSee(i.roles, i.permission))

  // Filter groups and their items by role (show all when role not yet known)
  const visibleGroups = useMemo(() =>
    NAV_GROUPS
      .filter(g => canSee(g.roles))
      .map(g => ({
        ...g,
        items: g.items.filter(i => canSee(i.roles, i.permission)),
      }))
      .filter(g => g.items.length > 0),
    [role, hasPermission],
  )

  // For collapsed sidebar: flatten all visible items
  const allFlatItems = useMemo(() => [
    ...visibleStandalone,
    ...visibleGroups.flatMap(g => g.items),
  ], [visibleStandalone, visibleGroups])

  const activeStyle = {
    background: 'linear-gradient(135deg, #0096b4 0%, #00B4D8 60%, #00c8f0 100%)',
    boxShadow: '0 2px 8px rgba(0,180,216,0.30)',
  }

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-cyan-100/60 transition-all duration-300 shadow-sm bg-white',
        sidebarCollapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Brand accent line */}
      <div
        className="h-0.5 w-full shrink-0"
        style={{ background: 'linear-gradient(90deg, #cff9fe, #a5f3fc, #00B4D8)' }}
      />

      {/* Logo + collapse toggle */}
      <div className="flex items-center h-16 px-4 border-b border-cyan-50 bg-white">
        {!sidebarCollapsed && (
          <div className="flex items-center min-w-0 flex-1">
            <img src={stayfitLogo} alt="StayFit Health Club" className="h-9 w-auto object-contain" />
          </div>
        )}
        {sidebarCollapsed && (
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center mx-auto text-white text-xs font-bold tracking-tight shrink-0"
            style={{ background: 'linear-gradient(135deg, #0096b4, #00B4D8)' }}
          >
            SF
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className={cn(
            'p-1.5 rounded-md transition-colors text-gray-400 hover:text-[#00B4D8] hover:bg-cyan-50',
            sidebarCollapsed ? 'mx-auto mt-2' : 'ml-auto shrink-0',
          )}
        >
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav — scrollable */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 bg-white">

        {/* ── Collapsed: flat icon list ── */}
        {sidebarCollapsed && (
          <ul className="space-y-0.5">
            {allFlatItems.map(item => {
              const isActive = isNavActive(item.href)
              return (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    title={item.label}
                    className={cn(
                      'flex items-center justify-center rounded-lg p-2 transition-all duration-150',
                      isActive ? 'text-white shadow-md' : 'text-gray-500 hover:text-[#00B4D8] hover:bg-cyan-50',
                    )}
                    style={isActive ? activeStyle : undefined}
                  >
                    {item.icon}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}

        {/* ── Expanded: grouped list ── */}
        {!sidebarCollapsed && (
          <ul className="space-y-0.5">
            {/* Standalone items (Dashboard) */}
            {visibleStandalone.map(item => {
              const isActive = isNavActive(item.href)
              return (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-normal tracking-wide transition-all duration-150',
                      isActive
                        ? 'text-white shadow-md'
                        : 'text-gray-500 hover:text-[#00B4D8] hover:bg-cyan-50',
                    )}
                    style={isActive ? activeStyle : undefined}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                </li>
              )
            })}

            {/* Divider after standalones */}
            {visibleStandalone.length > 0 && visibleGroups.length > 0 && (
              <li className="pt-1 pb-0.5">
                <div className="h-px bg-cyan-50 mx-1" />
              </li>
            )}

            {/* Groups */}
            {visibleGroups.map(group => {
              const open = isGroupOpen(group.label)
              const hasActive = group.items.some(i => isNavActive(i.href))

              return (
                <li key={group.label}>
                  {/* Group header */}
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className={cn(
                      'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150',
                      hasActive
                        ? 'font-semibold text-[#007a99] bg-cyan-50'
                        : 'font-medium text-gray-500 hover:text-[#00B4D8] hover:bg-cyan-50',
                    )}
                  >
                    <span className={cn(hasActive ? 'text-[#00B4D8]' : 'text-gray-400')}>
                      {group.icon}
                    </span>
                    <span className="flex-1 text-left tracking-wide">{group.label}</span>
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 text-gray-300 transition-transform duration-200 shrink-0',
                        open && 'rotate-180',
                      )}
                    />
                  </button>

                  {/* Group children */}
                  {open && (
                    <ul className="mt-0.5 ml-3 pl-3 border-l border-cyan-100 space-y-0.5 pb-1">
                      {group.items.map(item => {
                        const isActive = isNavActive(item.href)
                        return (
                          <li key={item.href}>
                            <Link
                              to={item.href}
                              className={cn(
                                'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-all duration-150',
                                isActive
                                  ? 'text-white shadow-sm font-medium'
                                  : 'text-gray-500 hover:text-[#00B4D8] hover:bg-cyan-50',
                              )}
                              style={isActive ? activeStyle : undefined}
                            >
                              <span className="shrink-0">{item.icon}</span>
                              <span>{item.label}</span>
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </nav>

      {/* ── Bottom bar ── */}
      <div className="border-t border-cyan-50 px-2 py-3 bg-white space-y-1">
        {/* Profile row */}
        {user && (
          <div
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2',
              sidebarCollapsed && 'justify-center px-2',
            )}
          >
            <AvatarWithFallback
              firstName={user.first_name}
              lastName={user.last_name}
              className="h-7 w-7 shrink-0 text-xs"
            />
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-700 truncate">
                  {user.first_name} {user.last_name}
                </p>
                <p className="text-[10px] text-gray-400 capitalize truncate">{user.role}</p>
              </div>
            )}
          </div>
        )}

        {/* Logout button */}
        <button
          onClick={handleLogout}
          className={cn(
            'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-normal text-red-500 hover:text-red-600 hover:bg-red-50 transition-all duration-150',
            sidebarCollapsed && 'justify-center px-2',
          )}
          title={sidebarCollapsed ? 'Log out' : undefined}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!sidebarCollapsed && <span>Log out</span>}
        </button>
      </div>
    </aside>
  )
}
