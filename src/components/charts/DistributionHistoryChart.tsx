'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import type { DistributionHistory } from '@/types'
import {
  chartTheme, axisTickProps, tooltipContentStyle,
  tooltipLabelStyle, tooltipItemStyle,
} from './theme'

interface Props {
  data: DistributionHistory[] | null | undefined
  annualizedRatePct?: number | null
}

function fmtDate(d: string) {
  try { return format(parseISO(d), 'MMM d, yy') } catch { return d }
}

function NoData() {
  return (
    <div className="flex items-center justify-center border border-[#1e1e1e]" style={{ height: 200 }}>
      <p className="text-xs tracking-widest" style={{ color: '#333', fontFamily: chartTheme.fontFamily }}>
        DATA UNAVAILABLE
      </p>
    </div>
  )
}

export function DistributionHistoryChart({ data, annualizedRatePct }: Props) {
  if (!data?.length) return <NoData />

  const rows = [...data]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(d => ({ ...d, label: fmtDate(d.date) }))

  // Reference line: annualizedRate / periods-per-year ≈ per-distribution amount
  // Since we don't know frequency, just show the annualized rate as a dashed label line
  const maxAmt = Math.max(...rows.map(r => r.amount))
  const refAmt = annualizedRatePct != null ? annualizedRatePct : null

  return (
    <div style={{ width: '100%', height: 200, fontFamily: chartTheme.fontFamily }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={chartTheme.grid} vertical={false} />
          <XAxis
            dataKey="label"
            tick={axisTickProps}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            angle={-30}
            textAnchor="end"
            height={48}
          />
          <YAxis
            tickFormatter={(v: number) => `$${v.toFixed(2)}`}
            tick={axisTickProps}
            axisLine={false}
            tickLine={false}
            width={52}
            domain={[0, maxAmt * 1.2]}
          />
          {refAmt != null && (
            <ReferenceLine
              y={refAmt / 12}
              stroke={chartTheme.amberDim}
              strokeDasharray="4 4"
              label={{
                value: `${refAmt.toFixed(1)}% ann.`,
                fill: chartTheme.amberDim,
                fontSize: 9,
                fontFamily: chartTheme.fontFamily,
                position: 'insideTopRight',
              }}
            />
          )}
          <Tooltip
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={{ ...tooltipItemStyle, color: chartTheme.amber }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(v: any, _: any, entry: any) => [
              typeof v === 'number' ? `$${v.toFixed(4)}` : String(v),
              entry?.payload?.type ?? 'Distribution',
            ]}
          />
          <Bar
            dataKey="amount"
            fill={chartTheme.amber}
            fillOpacity={0.85}
            maxBarSize={24}
            radius={0}
            name="Distribution"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
