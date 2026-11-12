import * as React from 'react'
import { Dumbbell } from 'lucide-react'

export interface PageHeaderStat {
  label: string
  value: React.ReactNode
  sub?: string
  icon?: React.ReactNode
}

export type PageHeaderTheme = 'orange' | 'crimson' | 'violet' | 'azure' | 'ocean' | 'firebase'

// Pastel gradients — same palette as dashboard KPI cards, cycling per stat index
const STAT_GRADIENTS = [
  'linear-gradient(135deg, #fde8c8 0%, #fac8c8 100%)',
  'linear-gradient(135deg, #dbd9f5 0%, #b8e8e3 100%)',
  'linear-gradient(135deg, #d0f4e4 0%, #bae8f5 100%)',
  'linear-gradient(135deg, #fef3c0 0%, #fdd5b0 100%)',
  'linear-gradient(135deg, #fce4f0 0%, #e8d8fb 100%)',
  'linear-gradient(135deg, #cce5ff 0%, #c0f4e0 100%)',
]

interface PageHeaderProps {
  title: string
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  icon?: React.ReactNode
  stats?: PageHeaderStat[]
  theme?: PageHeaderTheme
  onBack?: () => void
  backLabel?: string
}

export function PageHeader({ title, subtitle, actions, icon, stats, onBack, backLabel = 'Back' }: PageHeaderProps) {
  const hasStats = stats && stats.length > 0

  return (
    <div className="mb-6 border-b border-border/40 bg-background">
      {/* ── Title row ── */}
      <div className="flex items-center justify-between gap-4 px-6 py-5">
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="mr-1 flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground shrink-0"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {backLabel}
            </button>
          )}
          {/* Icon with accent color */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
            {icon ?? <Dumbbell className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-foreground">{title}</h1>
            {subtitle && (
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
                {subtitle}
              </div>
            )}
          </div>
        </div>

        {actions && (
          <div className="flex shrink-0 items-center gap-2 page-header-actions">
            {actions}
          </div>
        )}
      </div>

      {/* ── Stats strip — pastel gradient chips ── */}
      {hasStats && (
        <div className="flex flex-wrap gap-3 px-6 pb-4">
          {stats!.map((stat, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 rounded-xl px-4 py-2 shadow-sm"
              style={{ background: STAT_GRADIENTS[i % STAT_GRADIENTS.length] }}
            >
              {stat.icon && (
                <span className="text-slate-500">{stat.icon}</span>
              )}
              <div>
                <span className="text-lg font-bold leading-tight text-slate-800">{stat.value}</span>
                <span className="ml-1.5 text-xs text-slate-600">{stat.label}</span>
                {stat.sub && <span className="ml-1 text-[10px] text-slate-500">{stat.sub}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
