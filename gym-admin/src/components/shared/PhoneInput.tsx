import { forwardRef } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface PhoneInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string
}

const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ className, ...props }, ref) => (
    <div className="flex">
      <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground text-sm shrink-0">
        +91
      </span>
      <Input
        ref={ref}
        type="tel"
        placeholder="98765 43210"
        className={cn('rounded-l-none', className)}
        {...props}
      />
    </div>
  )
)

PhoneInput.displayName = 'PhoneInput'

export { PhoneInput }
