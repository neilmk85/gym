import { useState, useRef, useEffect } from 'react'
import { Popover, PopoverTrigger, PopoverContent } from './popover'
import { Clock } from 'lucide-react'

// value / onChange use 24h "HH:MM" strings (react-hook-form format)
interface TimePickerProps {
  value: string
  onChange: (v: string) => void
  className?: string
}

function to12(hhmm: string): { h: number; m: number; ampm: 'am' | 'pm' } {
  const [hh, mm] = hhmm.split(':').map(Number)
  return { h: hh % 12 || 12, m: mm, ampm: hh < 12 ? 'am' : 'pm' }
}

function to24(h: number, m: number, ampm: 'am' | 'pm'): string {
  let hh = h % 12
  if (ampm === 'pm') hh += 12
  return `${String(hh).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function fmt(hhmm: string): string {
  const { h, m, ampm } = to12(hhmm)
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1)
const MINUTES = Array.from({ length: 60 }, (_, i) => i)

function ScrollList<T extends number>({
  items, selected, onSelect, label,
}: { items: T[]; selected: T; onSelect: (v: T) => void; label: (v: T) => string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current?.querySelector('[data-sel="true"]') as HTMLElement | null
    el?.scrollIntoView({ block: 'center' })
  }, [selected])
  return (
    <div ref={ref} className="h-40 overflow-y-auto overscroll-contain snap-y scroll-smooth">
      {items.map((v) => (
        <button
          key={v}
          type="button"
          data-sel={v === selected ? 'true' : undefined}
          onClick={() => onSelect(v)}
          className={`w-full text-center py-1.5 text-sm rounded snap-start transition-colors ${
            v === selected
              ? 'bg-primary text-primary-foreground font-semibold'
              : 'hover:bg-accent text-foreground'
          }`}
        >
          {label(v)}
        </button>
      ))}
    </div>
  )
}

export function TimePicker({ value, onChange, className }: TimePickerProps) {
  const [open, setOpen] = useState(false)
  const parsed = to12(value || '09:00')
  const [h, setH] = useState(parsed.h)
  const [m, setM] = useState(parsed.m)
  const [ampm, setAmpm] = useState<'am' | 'pm'>(parsed.ampm)

  // sync local state when popover opens
  const handleOpen = (o: boolean) => {
    if (o) {
      const p = to12(value || '09:00')
      setH(p.h); setM(p.m); setAmpm(p.ampm)
    }
    setOpen(o)
  }

  const confirm = () => {
    onChange(to24(h, m, ampm))
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`flex items-center gap-2 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-left hover:bg-accent/50 transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${className ?? ''}`}
        >
          <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span>{fmt(value || '09:00')}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="flex gap-2">
          {/* Hours */}
          <div className="flex-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide text-center mb-1">Hour</p>
            <ScrollList items={HOURS} selected={h} onSelect={setH} label={(v) => String(v)} />
          </div>
          {/* Minutes */}
          <div className="flex-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide text-center mb-1">Min</p>
            <ScrollList items={MINUTES} selected={m} onSelect={setM} label={(v) => String(v).padStart(2, '0')} />
          </div>
          {/* AM/PM */}
          <div className="flex flex-col gap-1 pt-6">
            {(['am', 'pm'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setAmpm(p)}
                className={`px-3 py-1.5 rounded text-sm font-semibold transition-colors ${
                  ampm === p ? 'bg-primary text-primary-foreground' : 'border border-input hover:bg-accent'
                }`}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        {/* Preview + OK */}
        <div className="mt-3 pt-3 border-t flex items-center justify-between">
          <span className="text-sm font-mono font-semibold">{h}:{String(m).padStart(2, '0')} {ampm.toUpperCase()}</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1">Cancel</button>
            <button type="button" onClick={confirm} className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded font-semibold hover:bg-primary/90 transition-colors">OK</button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
