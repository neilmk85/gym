import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { ComponentPropsWithoutRef } from 'react'

interface SearchInputProps extends Omit<ComponentPropsWithoutRef<'input'>, 'onChange'> {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string   // applied to the wrapper div
  inputClassName?: string
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className, inputClassName, ...rest }: SearchInputProps) {
  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-400 pointer-events-none" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={cn(
          'pl-9 h-10 border border-indigo-200 shadow-[0_2px_16px_rgba(99,102,241,0.15)] focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:border-indigo-400 bg-white/80 backdrop-blur-sm rounded-xl',
          inputClassName,
        )}
        {...rest}
      />
    </div>
  )
}
