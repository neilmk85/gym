import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getInitials } from '@/lib/utils'

interface AvatarWithFallbackProps {
  src?: string
  firstName?: string
  lastName?: string
  className?: string
}

export function AvatarWithFallback({ src, firstName, lastName, className }: AvatarWithFallbackProps) {
  return (
    <Avatar className={className}>
      {src && <AvatarImage src={src} alt={`${firstName} ${lastName}`} />}
      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
        {getInitials(firstName, lastName)}
      </AvatarFallback>
    </Avatar>
  )
}
