import { Badge, type BadgeProps } from '@/components/ui/badge'

const statusMap: Record<string, BadgeProps['variant']> = {
  active: 'success',
  paid: 'success',
  confirmed: 'success',
  scheduled: 'default',
  ongoing: 'default',
  pending: 'warning',
  frozen: 'warning',
  paused: 'warning',
  waitlisted: 'warning',
  expired: 'outline',
  cancelled: 'destructive',
  completed: 'secondary',
  refunded: 'secondary',
  failed: 'destructive',
  inactive: 'outline',
}

export function StatusBadge({ status }: { status: string }) {
  const variant = statusMap[status.toLowerCase()] ?? 'outline'
  return (
    <Badge variant={variant} className="capitalize">
      {status.replace(/_/g, ' ')}
    </Badge>
  )
}
