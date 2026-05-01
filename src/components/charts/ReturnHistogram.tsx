'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { Performance } from '@/types'
import {
  chartTheme, axisTickProps, tooltipContentStyle,
  tooltipLabelStyle, tooltipItemStyle,
} from './theme'

interface Props {
  performance: Performance | null | undefined
  benchmarkLabel?: string
}

const PERIODS = [
  { key: 'ytd', label: 'YTD', fund: 'ytd_pct', bench: 'benchmark_ytd_pct' },
  { key: '1yr', label: '1 YR', fund: 'one_year_pct', bench: 'benchmark_one_year_pct' },
  { key: '3yr', label: '3 YR', fund: 'three_year_pct', bench: 'benchmark_three_year_pct' },
  { key: 'inc', label: 'INCEP.', fund: 'since_inception_pct', bench: 'benchmark_since_inception_pct' },
] as const

function NoData() {
  return (
    <div className="flex items-center justify-center border border-[#1e1e1e]" style={{ height: 220 }}>
      <p className="text-xs tracking-widest" style={{ color: '#333', fontFamily: chartTheme.fontFamily }}>
        DATA UNAVAILABLE
      </p>
    </div>
  )
}

export function ReturnHistogram({ performance, benchmarkLabel }: Props) {
  if (!performance) return <NoData />

  const rows = PERIODS.map(p => ({
    period: p.label,
    fund: performance[p.fund] ?? undefined,
    benchmark: performance[p.bench] ?? undefined,
  })).filter(r => r.fund !== undefined || r.benchmark !== undefined)

  if (!rows.length) return <NoData />

  const bench = benchmarkLabel ?? performance.benchmark_name ?? 'CDLI'

  return (
    <div style={{ width: '100%', height: 220, fontFamily: chartTheme.fontFamily }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }} barGap={2}>
          <CartesianGrid stroke={chartTheme.grid} vertical={false} />
          <XAxis dataKey="period" tick={axisTickProps} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={(v: number) => `${v.toFixed(1)}%`}
            tick={axisTickProps}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <ReferenceLine y={0} stroke={chartTheme.border} />
          <Tooltip
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(v: any) => [typeof v === 'number' ? `${v.toFixed(2)}%` : String(v)]}
          />
          <Legend
            wrapperStyle={{ fontFamily: chartTheme.fontFamily, fontSize: 10, color: chartTheme.textDim }}
            iconSize={8}
            iconType="square"
          />
          <Bar dataKey="fund" name="Fund" fill={chartTheme.amber} maxBarSize={28} />
          <Bar dataKey="benchmark" name={bench} fill={chartTheme.muted} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
