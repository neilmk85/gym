import * as React from 'react'
import { Dumbbell } from 'lucide-react'

export interface PageHeaderStat {
  label: string
  value: React.ReactNode
  sub?: string
  icon?: React.ReactNode
}

export type PageHeaderTheme = 'orange' | 'crimson' | 'violet' | 'azure' | 'ocean' | 'firebase'

const GRADIENTS: Record<PageHeaderTheme, { main: string; glow: string; border: string }> = {
  firebase: {
    main:   'linear-gradient(135deg, #e65100 0%, #f57c00 40%, #ffa000 75%, #ffca28 100%)',
    glow:   'radial-gradient(ellipse at 90% 50%, rgba(255,202,40,0.4) 0%, transparent 60%)',
    border: 'rgba(255,255,255,0.15)',
  },
  orange: {
    main:   'linear-gradient(135deg, #c2440a 0%, #e05a1a 35%, #f97316 70%, #fb923c 100%)',
    glow:   'radial-gradient(ellipse at 90% 50%, rgba(251,191,36,0.35) 0%, transparent 60%)',
    border: 'rgba(255,255,255,0.12)',
  },
  crimson: {
    main:   'linear-gradient(135deg, #7f1d1d 0%, #b91c1c 35%, #dc2626 70%, #ef4444 100%)',
    glow:   'radial-gradient(ellipse at 90% 50%, rgba(252,165,165,0.3) 0%, transparent 60%)',
    border: 'rgba(255,255,255,0.12)',
  },
  violet: {
    main:   'linear-gradient(135deg, #2e1065 0%, #5b21b6 35%, #7c3aed 70%, #8b5cf6 100%)',
    glow:   'radial-gradient(ellipse at 90% 50%, rgba(196,181,253,0.3) 0%, transparent 60%)',
    border: 'rgba(255,255,255,0.12)',
  },
  azure: {
    main:   'linear-gradient(135deg, #020617 0%, #0f172a 30%, #1d4ed8 70%, #3b82f6 100%)',
    glow:   'radial-gradient(ellipse at 90% 50%, rgba(147,197,253,0.35) 0%, transparent 60%)',
    border: 'rgba(255,255,255,0.12)',
  },
  ocean: {
    main:   'linear-gradient(135deg, #042B59 0%, #0553B1 52%, #027DFD 100%)',
    glow:   'radial-gradient(ellipse at 90% 50%, rgba(96,165,250,0.35) 0%, transparent 60%)',
    border: 'rgba(255,255,255,0.15)',
  },
}

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

export function PageHeader({ title, subtitle, actions, icon, stats, theme = 'ocean', onBack, backLabel = 'Back' }: PageHeaderProps) {
  const hasStats = stats && stats.length > 0
  const g = GRADIENTS[theme]

  return (
    <div className="relative mb-6 rounded-2xl overflow-hidden shadow-lg">
      {/* ── Main gradient background ── */}
      <div className="absolute inset-0" style={{ background: g.main }} />

      {/* ── Radial glow (right side accent) ── */}
      <div className="absolute inset-0" style={{ background: g.glow }} />

      {/* ── Subtle dot pattern ── */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />

      {/* ── Top-left dark vignette ── */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 0% 0%, rgba(0,0,0,0.25) 0%, transparent 50%)',
        }}
      />

      {/* ── Content ── */}
      <div className="relative">
        {/* Top row: back (optional) + icon + title + actions */}
        <div className="px-8 py-5 flex items-center justify-between gap-6">
          {/* Left: back button (if provided) + icon + title */}
          <div className="flex items-center gap-4 min-w-0">
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-1 text-white/70 hover:text-white text-sm font-medium transition-colors shrink-0 mr-1"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                {backLabel}
              </button>
            )}
            <div className="h-12 w-12 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0 border border-white/20 shadow-inner">
              {icon ?? <Dumbbell className="h-6 w-6 text-white" />}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-light tracking-[0.2em] text-white/60 uppercase mb-0.5">
                Overview
              </p>
              <h1 className="text-2xl font-bold text-white tracking-tight drop-shadow-sm truncate">
                {title}
              </h1>
              {subtitle && (
                <div className="text-sm text-white/70 mt-1 font-light flex flex-wrap items-center gap-x-3 gap-y-1">
                  {subtitle}
                </div>
              )}
            </div>
          </div>

          {/* Right: action buttons */}
          {actions && (
            <div className="flex items-center gap-2 shrink-0 page-header-actions">
              {actions}
            </div>
          )}
        </div>

        {/* Stats strip — only rendered when stats are provided */}
        {hasStats && (
          <div
            className="grid pb-5 px-8"
            style={{
              borderTop: `1px solid ${g.border}`,
              paddingTop: '14px',
              gridTemplateColumns: `repeat(${stats!.length}, 1fr)`,
            }}
          >
            {stats!.map((stat, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4"
                style={{
                  borderRight: i < stats!.length - 1 ? '1px solid rgba(255,255,255,0.18)' : 'none',
                }}
              >
                {stat.icon && (
                  <div className="h-9 w-9 rounded-lg bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                    {stat.icon}
                  </div>
                )}
                <div>
                  <span className="text-xl font-bold text-white leading-tight tracking-tight block">
                    {stat.value}
                  </span>
                  <span className="text-xs font-light text-white/75 tracking-wide block">
                    {stat.label}
                  </span>
                  {stat.sub && (
                    <span className="text-[10px] text-white/50 block">{stat.sub}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
