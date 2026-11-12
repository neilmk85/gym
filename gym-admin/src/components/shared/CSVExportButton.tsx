import { useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiFetchBlob } from '@/api/client'
import { downloadBlob } from '@/lib/utils'
import { toast } from 'sonner'

interface CSVExportButtonProps {
  endpoint: string
  params?: Record<string, string>
  filename: string
  label?: string
}

export function CSVExportButton({ endpoint, params, filename, label = 'Export CSV' }: CSVExportButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    try {
      const blob = await apiFetchBlob(endpoint, { ...params, format: 'csv' })
      downloadBlob(blob, filename)
      toast.success('Export downloaded')
    } catch {
      toast.error('Export failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} loading={loading} className="border-0 shadow-none">
      <Download className="h-4 w-4" />
      {label}
    </Button>
  )
}
