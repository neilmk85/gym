import * as React from 'react'
import { format, parse, isValid } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface DatePickerFieldProps {
  value?: string        // ISO date string yyyy-MM-dd
  onChange: (val: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function DatePickerField({ value, onChange, placeholder = 'DD/MM/YYYY', disabled, className }: DatePickerFieldProps) {
  const [open, setOpen] = React.useState(false)

  const selected = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined
  const isValidDate = selected && isValid(selected)
  const display = isValidDate ? format(selected, 'dd/MM/yyyy') : ''

  function handleSelect(day: Date | undefined) {
    if (day) {
      onChange(format(day, 'yyyy-MM-dd'))
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors',
            'hover:bg-accent/50 focus:outline-none focus:ring-1 focus:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
            !display && 'text-muted-foreground',
            className
          )}
        >
          <span>{display || placeholder}</span>
          <CalendarIcon className="h-4 w-4 opacity-50 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={isValidDate ? selected : undefined}
          onSelect={handleSelect}
          initialFocus
        />
        <div className="flex justify-end gap-2 border-t p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => { onChange(''); setOpen(false) }}
          >
            Clear
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={!isValidDate}
          >
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
