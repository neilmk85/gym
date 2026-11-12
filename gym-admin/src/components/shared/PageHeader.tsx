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
    <div
      className="-mx-6 -mt-6 mb-6 px-8"
      style={{
        background: 'linear-gradient(to bottom, #ebe6fd 0%, #eef1ff 35%, #f4f6ff 60%, rgba(255,255,255,0) 100%)',
      }}
    >
      {/* ── Title + stats row ── */}
      <div className="pt-8 pb-6">
        {onBack && (
          <button
            onClick={onBack}
            className="mb-3 flex items-center gap-1 text-sm font-medium text-indigo-500 transition-colors hover:text-indigo-700"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {backLabel}
          </button>
        )}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Left: icon + title + chips */}
          <div className="flex items-center gap-3 flex-wrap min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500 text-white border border-indigo-400/30 shadow-sm">
              {icon ?? <Dumbbell className="h-4.5 w-4.5" />}
            </div>
            <div className="min-w-0">
              <h1 className="text-[1.75rem] font-black tracking-tight text-[#1a1a2e] leading-tight">{title}</h1>
              {subtitle && (
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-slate-500">
                  {subtitle}
                </div>
              )}
            </div>
            {hasStats && (
              <div className="flex flex-wrap gap-2 items-center ml-2">
                {stats!.map((stat, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2.5 rounded-xl px-4 shadow-sm border border-white/60"
                    style={{ background: STAT_GRADIENTS[i % STAT_GRADIENTS.length], paddingTop: '0.75rem', paddingBottom: '0.75rem' }}
                  >
                    {stat.icon && <span className="text-slate-500">{stat.icon}</span>}
                    <div>
                      <span className="text-base font-bold leading-tight text-slate-800">{stat.value}</span>
                      <span className="ml-1.5 text-sm text-slate-600">{stat.label}</span>
                      {stat.sub && <span className="ml-1 text-xs text-slate-500">{stat.sub}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Right: actions */}
          {actions && (
            <div className="flex shrink-0 items-center gap-2 page-header-actions">
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
