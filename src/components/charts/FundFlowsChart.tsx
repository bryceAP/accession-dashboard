'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Cell,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import type { FundSizeHistory } from '@/types'
import {
  chartTheme, axisTickProps, tooltipContentStyle,
  tooltipLabelStyle, tooltipItemStyle,
} from './theme'

interface Props {
  fundSizeHistory: FundSizeHistory[] | null | undefined
  deployedPct?: number | null
  fundSizeM?: number | null
}

function fmtAUM(v: number) {
  return v >= 1000 ? `$${(v / 1000).toFixed(1)}B` : `$${v.toFixed(0)}M`
}

function fmtDate(d: string) {
  try { return format(parseISO(d), 'MMM yy') } catch { return d }
}

function NoData() {
  return (
    <div className="flex items-center justify-center border border-[#1e1e1e]" style={{ height: 180 }}>
      <p className="text-xs tracking-widest" style={{ color: '#333', fontFamily: chartTheme.fontFamily }}>
        DATA UNAVAILABLE
      </p>
    </div>
  )
}

export function FundFlowsChart({ fundSizeHistory, deployedPct, fundSizeM }: Props) {
  // ── Deployed progress bar ──────────────────────────────────
  const showProgress = deployedPct != null && fundSizeM != null
  const deployedAmt = showProgress ? (fundSizeM! * deployedPct! / 100) : null
  const remainingAmt = showProgress ? fundSizeM! - deployedAmt! : null

  // ── Derive net flows from AUM history ─────────────────────
  const hasHistory = (fundSizeHistory?.length ?? 0) > 1
  const flowRows = hasHistory
    ? fundSizeHistory!.slice(1).map((d, i) => ({
        label: fmtDate(d.date),
        flow: d.aum_m - fundSizeHistory![i].aum_m,
      }))
    : []

  return (
    <div style={{ fontFamily: chartTheme.fontFamily }}>
      {/* Progress bar */}
      {showProgress && (
        <div className="mb-6">
          <div className="flex justify-between mb-1.5">
            <span style={{ fontSize: 9, color: chartTheme.textDim, letterSpacing: '0.1em' }}>
              DEPLOYED
            </span>
            <span style={{ fontSize: 9, color: chartTheme.textDim }}>
              {fmtAUM(deployedAmt!)} / {fmtAUM(fundSizeM!)} ({deployedPct!.toFixed(1)}%)
            </span>
          </div>
          <div style={{ height: 6, background: chartTheme.grid, position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                height: '100%',
                width: `${Math.min(100, deployedPct!)}%`,
                background: chartTheme.amber,
                transition: 'width 0.6s ease',
              }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span style={{ fontSize: 9, color: chartTheme.amber }}>Deployed</span>
            <span style={{ fontSize: 9, color: chartTheme.muted }}>Remaining {fmtAUM(remainingAmt!)}</span>
          </div>
        </div>
      )}

      {/* Flows chart */}
      {flowRows.length > 0 ? (
        <div style={{ width: '100%', height: 180 }}>
          <p style={{ fontSize: 9, color: chartTheme.textDim, letterSpacing: '0.1em', marginBottom: 8 }}>
            AUM CHANGE (PERIOD OVER PERIOD)
          </p>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={flowRows} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={chartTheme.grid} vertical={false} />
              <XAxis dataKey="label" tick={axisTickProps} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={fmtAUM}
                tick={axisTickProps}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <ReferenceLine y={0} stroke={chartTheme.border} />
              <Tooltip
                contentStyle={tooltipContentStyle}
                labelStyle={tooltipLabelStyle}
                itemStyle={{ ...tooltipItemStyle, color: chartTheme.bone }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any) => [typeof v === 'number' ? fmtAUM(v) : String(v), 'Net Change']}
              />
              <Bar dataKey="flow" maxBarSize={28} radius={0}>
                {flowRows.map((row, i) => (
                  <Cell
                    key={i}
                    fill={row.flow >= 0 ? chartTheme.amber : chartTheme.redText}
                    fillOpacity={0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : !showProgress ? (
        <NoData />
      ) : null}
    </div>
  )
}
