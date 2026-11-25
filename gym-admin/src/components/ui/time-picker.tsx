import { useState } from 'react'
import { Popover, PopoverTrigger, PopoverContent } from './popover'
import { Clock } from 'lucide-react'

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
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

export function TimePicker({ value, onChange, className }: TimePickerProps) {
  const [open, setOpen] = useState(false)
  const parsed = to12(value || '09:00')
  const [h, setH] = useState(parsed.h)
  const [m, setM] = useState(parsed.m)
  const [ampm, setAmpm] = useState<'am' | 'pm'>(parsed.ampm)

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

  // snap minute to nearest 5 when typing
  const nearestM = MINUTES.includes(m) ? m : MINUTES.reduce((a, b) => Math.abs(b - m) < Math.abs(a - m) ? b : a)

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
      <PopoverContent className="w-52 p-4" align="start">
        <div className="flex items-center gap-2">
          {/* Hour */}
          <select
            value={h}
            onChange={e => setH(Number(e.target.value))}
            className="flex-1 h-9 rounded-md border border-input bg-background px-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {HOURS.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>

          <span className="text-muted-foreground font-semibold">:</span>

          {/* Minute */}
          <select
            value={nearestM}
            onChange={e => setM(Number(e.target.value))}
            className="flex-1 h-9 rounded-md border border-input bg-background px-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {MINUTES.map(v => (
              <option key={v} value={v}>{String(v).padStart(2, '0')}</option>
            ))}
          </select>

          {/* AM/PM */}
          <div className="flex flex-col gap-1">
            {(['am', 'pm'] as const).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setAmpm(p)}
                className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors ${
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
          <span className="text-sm font-mono font-semibold">{h}:{String(nearestM).padStart(2, '0')} {ampm.toUpperCase()}</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1">Cancel</button>
            <button type="button" onClick={confirm} className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded font-semibold hover:bg-primary/90 transition-colors">OK</button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
