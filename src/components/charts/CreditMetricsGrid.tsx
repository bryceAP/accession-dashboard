'use client'

import type { CreditMetrics } from '@/types'
import { chartTheme } from './theme'

interface Props {
  metrics: CreditMetrics | null | undefined
}

interface MetricDef {
  label: string
  key: keyof CreditMetrics
  fmt: (v: number) => string
}

const METRICS: MetricDef[] = [
  { label: 'PIK %', key: 'pik_pct', fmt: v => `${v.toFixed(1)}%` },
  { label: 'BSL / CLO EXP.', key: 'bsl_clo_exposure_pct', fmt: v => `${v.toFixed(1)}%` },
  { label: 'SR. SECURED', key: 'senior_secured_pct', fmt: v => `${v.toFixed(1)}%` },
  { label: 'FLOATING RATE', key: 'floating_rate_pct', fmt: v => `${v.toFixed(1)}%` },
  { label: 'AVG EBITDA', key: 'avg_ebitda_m', fmt: v => `$${v.toFixed(0)}M` },
  { label: 'INT. COVERAGE', key: 'interest_coverage_ratio', fmt: v => `${v.toFixed(2)}x` },
  { label: 'FIXED CHARGE', key: 'fixed_charge_ratio', fmt: v => `${v.toFixed(2)}x` },
  { label: 'LTV', key: 'ltv_pct', fmt: v => `${v.toFixed(1)}%` },
  { label: 'NON-ACCRUAL', key: 'non_accrual_pct', fmt: v => `${v.toFixed(2)}%` },
  { label: 'PORTFOLIO COS.', key: 'number_of_portfolio_companies', fmt: v => v.toFixed(0) },
  { label: 'NET LEVERAGE', key: 'net_leverage_turns', fmt: v => `${v.toFixed(2)}x` },
  { label: 'DEPLOYED', key: 'deployed_pct', fmt: v => `${v.toFixed(1)}%` },
]

function MetricCard({ label, value }: { label: string; value: string | null }) {
  return (
    <div
      style={{
        border: `1px solid ${chartTheme.border}`,
        padding: '14px 16px',
        background: '#0a0a0a',
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
    </div>
  )
}

export function CreditMetricsGrid({ metrics }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px" style={{ background: chartTheme.border }}>
      {METRICS.map(({ label, key, fmt }) => {
        const raw = metrics?.[key]
        const display = typeof raw === 'number' ? fmt(raw) : null
        return <MetricCard key={key} label={label} value={display} />
      })}
    </div>
  )
}
