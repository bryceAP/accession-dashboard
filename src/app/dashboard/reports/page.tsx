'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { JetBrains_Mono } from 'next/font/google'
import { format } from 'date-fns'

const mono = JetBrains_Mono({ subsets: ['latin'] })

interface Run {
  id: string
  fund_id: string
  created_at: string
  status: string
  structured_data?: { data_quality?: { completeness_pct?: number } }
  funds?: { name: string }
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'text-[#555555]',
  running: 'text-[#C9A84C]',
  complete: 'text-emerald-500',
  error: 'text-red-500',
}

export default function ReportsPage() {
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/reports')
      .then(r => r.json())
      .then(data => { setRuns(data.runs ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function deleteRun(id: string) {
    if (!confirm('Delete this report?')) return
    await fetch(`/api/runs/${id}`, { method: 'DELETE' })
    setRuns(prev => prev.filter(r => r.id !== id))
  }

  return (
    <div className={`${mono.className} flex flex-col min-h-screen`}>
      <div className="flex items-center px-8 py-5 border-b border-[#2a2a2a] flex-shrink-0">
        <span className="text-[#E8E0D0] text-xs tracking-widest">REPORTS</span>
      </div>

      <div className="flex-1 px-8 py-8">
        {loading ? (
          <p className="text-[#444444] text-xs tracking-widest">LOADING...</p>
        ) : runs.length === 0 ? (
          <div className="border border-[#1e1e1e] px-6 py-10 text-center">
            <p className="text-[#333333] text-xs tracking-widest mb-2">NO REPORTS YET</p>
            <p className="text-[#2a2a2a] text-xs">Run an analysis on a fund to generate the first report.</p>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                {['FUND', 'DATE', 'STATUS', 'DATA QUALITY', 'ACTIONS'].map(h => (
                  <th key={h} className="text-left text-[#444444] text-xs tracking-widest pb-3 pr-6 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map(run => (
                <tr key={run.id} className="border-b border-[#1a1a1a] hover:bg-[#131313] transition-colors">
                  <td className="text-[#E8E0D0] text-xs py-3.5 pr-6">{run.funds?.name ?? '—'}</td>
                  <td className="text-[#777777] text-xs py-3.5 pr-6 whitespace-nowrap">
                    {format(new Date(run.created_at), 'MMM d, yyyy · HH:mm')}
                  </td>
                  <td className="py-3.5 pr-6">
                    <span className={`text-xs tracking-widest ${STATUS_COLOR[run.status] ?? 'text-[#555555]'}`}>
                      {run.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="text-[#C9A84C] text-xs py-3.5 pr-6">
                    {run.structured_data?.data_quality?.completeness_pct != null
                      ? `${run.structured_data.data_quality.completeness_pct}%`
                      : '—'}
                  </td>
                  <td className="py-3.5 flex items-center gap-4">
                    <Link
                      href={`/dashboard/funds/${run.fund_id}/run/${run.id}`}
                      className="text-[#555555] hover:text-[#C9A84C] text-xs tracking-widest transition-colors"
                    >
                      VIEW →
                    </Link>
                    <button
                      onClick={() => deleteRun(run.id)}
                      className="text-[#444444] hover:text-red-500 text-xs tracking-widest transition-colors"
                    >
                      DELETE
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
