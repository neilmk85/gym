import * as React from 'react'
import { Dumbbell } from 'lucide-react'

export interface PageHeaderStat {
  label: string
  value: React.ReactNode
  sub?: string
  icon?: React.ReactNode
}

export type PageHeaderTheme = 'orange' | 'crimson' | 'violet' | 'azure' | 'ocean' | 'firebase'

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
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
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

      {/* ── Stats strip ── */}
      {hasStats && (
        <div className="flex flex-wrap gap-3 px-6 pb-4">
          {stats!.map((stat, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 rounded-xl border border-border/50 bg-muted/30 px-4 py-2"
            >
              {stat.icon && (
                <span className="text-muted-foreground">{stat.icon}</span>
              )}
              <div>
                <span className="text-lg font-bold leading-tight text-foreground">{stat.value}</span>
                <span className="ml-1.5 text-xs text-muted-foreground">{stat.label}</span>
                {stat.sub && <span className="ml-1 text-[10px] text-muted-foreground/60">{stat.sub}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
