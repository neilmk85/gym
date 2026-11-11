import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export default function ForbiddenPage() {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <h1 className="text-6xl font-bold text-muted-foreground">403</h1>
      <h2 className="text-2xl font-semibold mt-4">Access Forbidden</h2>
      <p className="text-muted-foreground mt-2 max-w-sm">
        You do not have permission to access this page.
      </p>
      <Button className="mt-6" onClick={() => navigate('/dashboard')}>
        Back to Dashboard
      </Button>
    </div>
  )
}
