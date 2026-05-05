'use client'

import type { CreditMetrics } from '@/types'
import type { ChangeRecord } from '@/lib/compareRuns'
import { chartTheme } from './theme'

const FIELD_GOOD_DIRECTION: Record<string, boolean> = {
  fund_size_m: true,
  nav_per_share: true,
  distribution_rate_annualized_pct: true,
  weighted_avg_yield_pct: true,
  senior_secured_pct: true,
  deployed_pct: true,
  number_of_portfolio_companies: true,
  ytd_pct: true,
  one_year_pct: true,
  since_inception_pct: true,
  non_accrual_pct: false,
  net_leverage_turns: false,
  management_fee_pct: false,
}

interface Props {
  metrics: CreditMetrics | null | undefined
  changes?: ChangeRecord[]
}

interface MetricDef {
  label: string
  key: keyof CreditMetrics
  fmt: (v: number) => string
}

const METRICS: MetricDef[] = [
  { label: 'PIK %',          key: 'pik_pct',                    fmt: v => `${v.toFixed(1)}%` },
  { label: 'BSL / CLO EXP.', key: 'bsl_clo_exposure_pct',       fmt: v => `${v.toFixed(1)}%` },
  { label: 'SR. SECURED',    key: 'senior_secured_pct',          fmt: v => `${v.toFixed(1)}%` },
  { label: 'FLOATING RATE',  key: 'floating_rate_pct',           fmt: v => `${v.toFixed(1)}%` },
  { label: 'AVG EBITDA',     key: 'avg_ebitda_m',                fmt: v => `$${v.toFixed(0)}M` },
  { label: 'INT. COVERAGE',  key: 'interest_coverage_ratio',     fmt: v => `${v.toFixed(2)}x` },
  { label: 'FIXED CHARGE',   key: 'fixed_charge_ratio',          fmt: v => `${v.toFixed(2)}x` },
  { label: 'LTV',            key: 'ltv_pct',                     fmt: v => `${v.toFixed(1)}%` },
  { label: 'NON-ACCRUAL',    key: 'non_accrual_pct',             fmt: v => `${v.toFixed(2)}%` },
  { label: 'PORTFOLIO COS.', key: 'number_of_portfolio_companies', fmt: v => v.toFixed(0) },
  { label: 'NET LEVERAGE',   key: 'net_leverage_turns',          fmt: v => `${v.toFixed(2)}x` },
  { label: 'DEPLOYED',       key: 'deployed_pct',                fmt: v => `${v.toFixed(1)}%` },
]

function fmtDelta(change: ChangeRecord): string {
  const { field, prior_value, new_value } = change
  if (typeof prior_value !== 'number' || typeof new_value !== 'number') return ''
  const diff = new_value - prior_value
  const isPct = field.endsWith('_pct') || field.includes('rate')
  const sign = diff >= 0 ? '+' : ''
  return isPct ? `${sign}${diff.toFixed(1)}%` : `${sign}${diff.toFixed(2)}`
}

function MetricCard({
  label,
  value,
  change,
}: {
  label: string
  value: string | null
  change?: ChangeRecord
}) {
  const deltaText = change ? fmtDelta(change) : ''

  let deltaColor = '#666666'
  if (change && deltaText) {
    const goodDir = FIELD_GOOD_DIRECTION[change.field]
    if (goodDir !== undefined) {
      const isUp = change.direction === 'up'
      deltaColor = isUp === goodDir ? '#22c55e' : '#ef4444'
    }
  }

  return (
    <div
      style={{
        border: `1px solid ${chartTheme.border}`,
        padding: '14px 16px',
        background: '#0a0a0a',
        opacity: value ? 1 : 0.35,
      }}
    >
      <p
        style={{
          fontFamily: chartTheme.fontFamily,
          fontSize: 9,
          color: chartTheme.textDim,
          letterSpacing: '0.12em',
          marginBottom: 6,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontFamily: chartTheme.fontFamily,
          fontSize: 18,
          color: value ? chartTheme.bone : '#333333',
          fontWeight: 300,
          lineHeight: 1,
        }}
      >
        {value ?? 'N/A'}
      </p>
      {change && deltaText && (
        <p
          style={{
            fontFamily: chartTheme.fontFamily,
            fontSize: 9,
            color: deltaColor,
            marginTop: 5,
            letterSpacing: '0.05em',
          }}
        >
          {change.direction === 'up' ? '▲' : '▼'} {deltaText}
        </p>
      )}
    </div>
  )
}

export function CreditMetricsGrid({ metrics, changes }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px" style={{ background: chartTheme.border }}>
      {METRICS.map(({ label, key, fmt }) => {
        const raw = metrics?.[key]
        const display = typeof raw === 'number' ? fmt(raw) : null
        const change = changes?.find(c => c.field === key)
        return <MetricCard key={key} label={label} value={display} change={change} />
      })}
    </div>
  )
}
