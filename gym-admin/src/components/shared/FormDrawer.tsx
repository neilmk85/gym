import * as React from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet'

interface FormDrawerProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  wide?: boolean
  fullWidth?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl' | '60'
  glassmorphicClose?: boolean
}

const GLASS_CLOSE = 'h-9 w-9 rounded-full bg-white/15 backdrop-blur-sm border border-white/25 text-white opacity-80 hover:opacity-100 hover:bg-white/25'

export function FormDrawer({ isOpen, onClose, title, description, children, footer, wide, fullWidth, size, glassmorphicClose }: FormDrawerProps) {
  const widthClass = size === '60'
    ? 'w-[60vw] max-w-[60vw]'
    : fullWidth
    ? 'w-full sm:max-w-full'
    : wide
    ? 'w-full sm:max-w-2xl'
    : 'w-full sm:max-w-lg'

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        className={`${widthClass} overflow-y-auto flex flex-col`}
        closeClassName={glassmorphicClose ? GLASS_CLOSE : undefined}
      >
        {(title || description) && (
          <SheetHeader>
            {title && <SheetTitle>{title}</SheetTitle>}
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
        )}
        <div className="flex-1 py-4">{children}</div>
        {footer && <SheetFooter className="pt-4 border-t">{footer}</SheetFooter>}
      </SheetContent>
    </Sheet>
  )
}
