'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import type { FlowHistory } from '@/types'
import {
  chartTheme, axisTickProps, tooltipContentStyle,
  tooltipLabelStyle, tooltipItemStyle,
} from './theme'

interface Props {
  data: FlowHistory[] | null | undefined
}

function fmtDate(d: string) {
  try { return format(parseISO(d), 'MMM yy') } catch { return d }
}

function fmtAmt(v: number) {
  const abs = Math.abs(v)
  const formatted = abs >= 1000 ? `$${(abs / 1000).toFixed(1)}B` : `$${abs.toFixed(0)}M`
  return v < 0 ? `-${formatted}` : formatted
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

export function InflowsOutflowsChart({ data }: Props) {
  if (!data?.length) return <NoData />

  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date))
  const rows = sorted.map(d => ({
    label: fmtDate(d.date),
    subscriptions: d.subscriptions_m,
    redemptions: -Math.abs(d.redemptions_m),
    net: d.subscriptions_m - Math.abs(d.redemptions_m),
  }))

  // Cumulative totals for the small summary line under the chart
  const totalIn = rows.reduce((s, r) => s + r.subscriptions, 0)
  const totalOut = rows.reduce((s, r) => s + Math.abs(r.redemptions), 0)
  const netTotal = totalIn - totalOut

  return (
    <div style={{ fontFamily: chartTheme.fontFamily }}>
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
            stackOffset="sign"
          >
            <CartesianGrid stroke={chartTheme.grid} vertical={false} />
            <XAxis
              dataKey="label"
              tick={axisTickProps}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={fmtAmt}
              tick={axisTickProps}
              axisLine={false}
              tickLine={false}
              width={60}
            />
            <ReferenceLine y={0} stroke={chartTheme.border} />
            <Tooltip
              contentStyle={tooltipContentStyle}
              labelStyle={tooltipLabelStyle}
              itemStyle={tooltipItemStyle}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any, name: any) => [
                typeof v === 'number' ? fmtAmt(v) : String(v),
                String(name),
              ]}
            />
            <Legend
              wrapperStyle={{
                fontSize: 10,
                fontFamily: chartTheme.fontFamily,
                color: chartTheme.textDim,
                paddingTop: 4,
              }}
              iconType="square"
              iconSize={8}
            />
            <Bar
              dataKey="subscriptions"
              name="Subscriptions"
              stackId="flows"
              fill={chartTheme.amber}
              fillOpacity={0.85}
              maxBarSize={32}
              radius={0}
            />
            <Bar
              dataKey="redemptions"
              name="Redemptions"
              stackId="flows"
              fill={chartTheme.redText}
              fillOpacity={0.85}
              maxBarSize={32}
              radius={0}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Cumulative summary row */}
      <div
        style={{
          display: 'flex',
          gap: 24,
          marginTop: 10,
          fontSize: 9,
          color: chartTheme.textDim,
          letterSpacing: '0.1em',
        }}
      >
        <span>
          IN <span style={{ color: chartTheme.amber }}>{fmtAmt(totalIn)}</span>
        </span>
        <span>
          OUT <span style={{ color: chartTheme.redText }}>{fmtAmt(-totalOut)}</span>
        </span>
        <span>
          NET{' '}
          <span style={{ color: netTotal >= 0 ? chartTheme.amber : chartTheme.redText }}>
            {fmtAmt(netTotal)}
          </span>
        </span>
      </div>
    </div>
  )
}
