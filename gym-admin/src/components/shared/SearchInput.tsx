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
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#00B4D8] pointer-events-none" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={cn(
          'pl-9 h-10 border border-cyan-200 shadow-[0_2px_16px_rgba(0,180,216,0.15)] focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:border-[#00B4D8] bg-white/80 backdrop-blur-sm rounded-xl',
          inputClassName,
        )}
        {...rest}
      />
    </div>
  )
}
