'use client'

import { useState } from 'react'

export function usePDFExport(runId: string) {
  const [isExporting, setIsExporting] = useState(false)

  async function exportPDF() {
    if (isExporting) return
    setIsExporting(true)
    try {
      const res = await fetch('/api/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ run_id: runId }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? 'Export failed')
      }

      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url

      const disposition = res.headers.get('Content-Disposition')
      const match = disposition?.match(/filename="([^"]+)"/)
      a.download = match?.[1] ?? 'fund-report.pdf'

      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('[usePDFExport]', err)
    } finally {
      setIsExporting(false)
    }
  }

  return { exportPDF, isExporting }
}
