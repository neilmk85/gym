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
  section?: string
  titleBadge?: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  icon?: React.ReactNode
  stats?: PageHeaderStat[]
  statLayout?: 'cards' | 'grid'
  theme?: PageHeaderTheme
  onBack?: () => void
  backLabel?: string
}

export function PageHeader({ title, section, titleBadge, subtitle, actions, icon, stats, statLayout = 'cards', onBack, backLabel = 'Back' }: PageHeaderProps) {
  const hasStats = stats && stats.length > 0
  const isGrid = statLayout === 'grid'

  return (
    <div
      className="-mx-6 -mt-6 mb-6"
      style={{
        background: 'linear-gradient(to bottom, #d0f5fb 0%, #e8f9fc 35%, #f4fbfd 60%, rgba(255,255,255,0) 100%)',
      }}
    >
      {/* ── Title row ── */}
      <div className={`px-8 pt-8 ${isGrid && hasStats ? 'pb-5' : 'pb-6'}`}>
        {onBack && (
          <button
            onClick={onBack}
            className="mb-3 flex items-center gap-1 text-sm font-medium text-[#00B4D8] transition-colors hover:text-[#0096b4]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {backLabel}
          </button>
        )}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          {/* Left: icon + title */}
          <div className="min-w-0">
            {section && (
              <p className="text-[11px] font-semibold tracking-widest uppercase text-[#0096b4]/70 mb-1.5">{section}</p>
            )}
            <div className="flex items-center gap-2.5 mb-1">
              {icon ? (
                <span className="shrink-0 text-[#0096b4]">{icon}</span>
              ) : (
                <Dumbbell className="h-5 w-5 shrink-0 text-[#0096b4]" />
              )}
              <h1 className="text-2xl font-bold tracking-tight text-[#1a1a2e] leading-tight">
                {title}
                {titleBadge && <span className="ml-2">{titleBadge}</span>}
              </h1>
            </div>
            {subtitle && (
              <p className="text-sm text-slate-500">{subtitle}</p>
            )}
          </div>
          {/* Right: actions */}
          {actions && (
            <div className="flex shrink-0 items-center gap-2 page-header-actions">
              {actions}
            </div>
          )}
        </div>

        {/* Inline cards layout (original) */}
        {hasStats && !isGrid && (
          <div className="flex flex-wrap gap-2 items-center mt-4">
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

      {/* Grid layout — panels at the bottom with dividers */}
      {hasStats && isGrid && (
        <div
          className="grid divide-x divide-teal-100 border-t border-teal-100"
          style={{ gridTemplateColumns: `repeat(${stats!.length}, minmax(0, 1fr))` }}
        >
          {stats!.map((stat, i) => (
            <div key={i} className="px-6 py-4">
              <p className="text-xl font-bold leading-none text-[#1a1a2e]">{stat.value}</p>
              <p className="text-xs font-medium text-slate-600 mt-1">{stat.label}</p>
              {stat.sub && <p className="text-xs text-slate-400 mt-0.5">{stat.sub}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
