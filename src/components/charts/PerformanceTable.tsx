'use client'

import type { Performance } from '@/types'
import { chartTheme } from './theme'

interface Props {
  performance: Performance | null | undefined
}

interface Period {
  label: string
  fund: number | null | undefined
  bench: number | null | undefined
}

function fmt(v: number | null | undefined) {
  if (v == null) return '—'
  const sign = v > 0 ? '+' : ''
  return `${sign}${v.toFixed(2)}%`
}

function deltaColor(fund: number | null | undefined, bench: number | null | undefined) {
  if (fund == null || bench == null) return chartTheme.textSecondary
  if (fund > bench) return chartTheme.amber
  if (fund < bench) return chartTheme.redText
  return chartTheme.textSecondary
}

export function PerformanceTable({ performance: p }: Props) {
  const mono = chartTheme.fontFamily

  if (!p) {
    return (
      <div
        className="flex items-center justify-center border border-[#1e1e1e] py-8"
        style={{ fontFamily: mono }}
      >
        <span className="text-xs tracking-widest" style={{ color: '#333' }}>DATA UNAVAILABLE</span>
      </div>
    )
  }

  const bench = p.benchmark_name ?? 'CDLI'

  const periods: Period[] = [
    { label: 'YTD', fund: p.ytd_pct, bench: p.benchmark_ytd_pct },
    { label: '1 YR', fund: p.one_year_pct, bench: p.benchmark_one_year_pct },
    { label: '3 YR', fund: p.three_year_pct, bench: p.benchmark_three_year_pct },
    { label: '5 YR', fund: p.five_year_pct, bench: null },
    { label: 'INCEP.', fund: p.since_inception_pct, bench: p.benchmark_since_inception_pct },
  ]

  const thStyle: React.CSSProperties = {
    fontFamily: mono,
    fontSize: 10,
    color: chartTheme.textDim,
    letterSpacing: '0.1em',
    fontWeight: 400,
    textAlign: 'right',
    paddingBottom: 8,
    paddingLeft: 16,
    borderBottom: `1px solid ${chartTheme.border}`,
  }

  const tdBase: React.CSSProperties = {
    fontFamily: mono,
    fontSize: 12,
    textAlign: 'right',
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 16,
    borderBottom: `1px solid ${chartTheme.grid}`,
  }

  const rowLabelStyle: React.CSSProperties = {
    fontFamily: mono,
    fontSize: 10,
    color: chartTheme.textDim,
    letterSpacing: '0.1em',
    paddingTop: 10,
    paddingBottom: 10,
    paddingRight: 4,
    borderBottom: `1px solid ${chartTheme.grid}`,
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, textAlign: 'left', paddingLeft: 0 }} />
            {periods.map(per => (
              <th key={per.label} style={thStyle}>{per.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Fund row */}
          <tr>
            <td style={rowLabelStyle}>FUND</td>
            {periods.map(per => (
              <td
                key={per.label}
                style={{ ...tdBase, color: deltaColor(per.fund, per.bench) }}
              >
                {fmt(per.fund)}
              </td>
            ))}
          </tr>
          {/* Benchmark row */}
          <tr>
            <td style={{ ...rowLabelStyle, borderBottom: 'none' }}>{bench.toUpperCase()}</td>
            {periods.map(per => (
              <td
                key={per.label}
                style={{ ...tdBase, color: chartTheme.mutedMid, borderBottom: 'none' }}
              >
                {fmt(per.bench)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      {p.as_of_date && (
        <p style={{ fontFamily: mono, fontSize: 9, color: chartTheme.textDim, marginTop: 6 }}>
          AS OF {p.as_of_date.toUpperCase()}
        </p>
      )}
    </div>
  )
}
