'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import type { FundSizeHistory } from '@/types'
import {
  chartTheme, axisTickProps, tooltipContentStyle,
  tooltipLabelStyle, tooltipItemStyle,
} from './theme'

interface Props {
  data: FundSizeHistory[] | null | undefined
}

function fmtAUM(v: number) {
  return v >= 1000 ? `$${(v / 1000).toFixed(2)}B` : `$${v.toFixed(0)}M`
}

function fmtDate(d: string) {
  try { return format(parseISO(d), 'MMM yy') } catch { return d }
}

function NoData() {
  return (
    <div className="flex items-center justify-center border border-[#1e1e1e]" style={{ height: 220 }}>
      <p className="text-xs tracking-widest" style={{ color: '#333', fontFamily: chartTheme.fontFamily }}>
        DATA UNAVAILABLE
      </p>
    </div>
  )
}

export function FundSizeChart({ data }: Props) {
  if (!data?.length) return <NoData />

  const rows = data.map(d => ({ ...d, label: fmtDate(d.date) }))

  return (
    <div style={{ width: '100%', height: 220, fontFamily: chartTheme.fontFamily }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="aumFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={chartTheme.amber} stopOpacity={0.2} />
              <stop offset="95%" stopColor={chartTheme.amber} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={chartTheme.grid} vertical={false} />
          <XAxis
            dataKey="label"
            tick={axisTickProps}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={fmtAUM}
            tick={axisTickProps}
            axisLine={false}
            tickLine={false}
            width={62}
          />
          <Tooltip
            contentStyle={tooltipContentStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={{ ...tooltipItemStyle, color: chartTheme.amber }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(v: any) => [typeof v === 'number' ? fmtAUM(v) : String(v), 'AUM']}
          />
          <Area
            type="monotone"
            dataKey="aum_m"
            stroke={chartTheme.amber}
            strokeWidth={1.5}
            fill="url(#aumFill)"
            dot={false}
            activeDot={{ r: 4, fill: chartTheme.amber, stroke: 'none' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
