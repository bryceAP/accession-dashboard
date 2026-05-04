'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { JetBrains_Mono } from 'next/font/google'
import { format } from 'date-fns'

const mono = JetBrains_Mono({ subsets: ['latin'] })

interface Run {
  id: string
  fund_id: string
  created_at: string | null
  status: string
  structured_data?: { data_quality?: { completeness_pct?: number } } | null
  funds?: { name: string }
}

interface FundGroup {
  fundId: string
  fundName: string
  runs: Run[]
}

const STATUS_STYLE: Record<string, { border: string; color: string }> = {
  complete: { border: '#1a4a1a', color: '#4ade80' },
  error:    { border: '#4a1a1a', color: '#f87171' },
  pending:  { border: '#3d2e00', color: '#C9A84C' },
  running:  { border: '#3d2e00', color: '#C9A84C' },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.pending
  return (
    <span
      className={mono.className}
      style={{
        border: `1px solid ${s.border}`,
        color: s.color,
        fontSize: 9,
        letterSpacing: '0.1em',
        padding: '2px 7px',
        display: 'inline-block',
      }}
    >
      {status.toUpperCase()}
    </span>
  )
}

function buildGroups(runs: Run[]): FundGroup[] {
  const map = new Map<string, FundGroup>()
  const order: string[] = []
  for (const run of runs) {
    if (!map.has(run.fund_id)) {
      map.set(run.fund_id, {
        fundId: run.fund_id,
        fundName: run.funds?.name ?? 'Unknown Fund',
        runs: [],
      })
      order.push(run.fund_id)
    }
    map.get(run.fund_id)!.runs.push(run)
  }
  return order.map(id => map.get(id)!)
}

export default function ReportsPage() {
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedFunds, setExpandedFunds] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/reports')
      .then(r => r.json())
      .then(data => {
        const fetched: Run[] = data.runs ?? []
        setRuns(fetched)
        if (fetched.length > 0) {
          setExpandedFunds(new Set([fetched[0].fund_id]))
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const grouped = buildGroups(runs)

  async function deleteRun(id: string) {
    if (!confirm('Delete this report?')) return
    await fetch(`/api/runs/${id}`, { method: 'DELETE' })
    setRuns(prev => prev.filter(r => r.id !== id))
  }

  function toggleFund(fundId: string) {
    setExpandedFunds(prev => {
      const next = new Set(prev)
      if (next.has(fundId)) next.delete(fundId)
      else next.add(fundId)
      return next
    })
  }

  return (
    <div className={`${mono.className} flex flex-col min-h-screen`}>
      <div className="flex items-center px-8 py-5 border-b border-[#2a2a2a] flex-shrink-0">
        <span className="text-[#E8E0D0] text-xs tracking-widest">REPORTS</span>
      </div>

      <div className="flex-1 px-8 py-8">
        {loading ? (
          <p className="text-[#444444] text-xs tracking-widest">LOADING...</p>
        ) : grouped.length === 0 ? (
          <div className="border border-[#1e1e1e] px-6 py-10 text-center">
            <p className="text-[#333333] text-xs tracking-widest">No reports yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {grouped.map(group => {
              const expanded = expandedFunds.has(group.fundId)
              return (
                <div key={group.fundId} style={{ border: '1px solid #2a2a2a' }}>
                  <button
                    onClick={() => toggleFund(group.fundId)}
                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-[#131313] transition-colors text-left"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-[#E8E0D0] text-xs tracking-widest">
                        {group.fundName.toUpperCase()}
                      </span>
                      <span style={{ color: '#444444', fontSize: 11 }}>
                        {group.runs.length} report{group.runs.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <span style={{ color: '#444444', fontSize: 11 }}>{expanded ? '▲' : '▼'}</span>
                  </button>

                  {expanded && (
                    <div style={{ borderTop: '1px solid #2a2a2a' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                            {['DATE', 'STATUS', 'DATA QUALITY', 'ACTIONS'].map(h => (
                              <th
                                key={h}
                                className="text-left font-normal"
                                style={{
                                  color: '#444444',
                                  fontSize: 10,
                                  letterSpacing: '0.1em',
                                  padding: '10px 24px 10px',
                                }}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {group.runs.map(run => (
                            <tr
                              key={run.id}
                              style={{ borderBottom: '1px solid #1a1a1a' }}
                              className="hover:bg-[#131313] transition-colors"
                            >
                              <td style={{ padding: '11px 24px', color: '#777777', fontSize: 11, whiteSpace: 'nowrap' }}>
                                {run.created_at
                                  ? format(new Date(run.created_at), 'MMM d, yyyy · HH:mm')
                                  : '—'}
                              </td>
                              <td style={{ padding: '11px 24px' }}>
                                <StatusBadge status={run.status} />
                              </td>
                              <td style={{ padding: '11px 24px', color: '#C9A84C', fontSize: 11 }}>
                                {run.structured_data?.data_quality?.completeness_pct != null
                                  ? `${run.structured_data.data_quality.completeness_pct.toFixed(0)}%`
                                  : '—'}
                              </td>
                              <td style={{ padding: '11px 24px' }}>
                                <div className="flex items-center gap-5">
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
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
