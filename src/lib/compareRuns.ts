import type { FundReport } from '@/types'

export interface ChangeRecord {
  field: string
  label: string
  prior_value: number | string | null
  new_value: number | string | null
  change_pct: number | null
  direction: 'up' | 'down' | 'unchanged'
}

export interface KeyChanges {
  changes: ChangeRecord[]
  new_risks: string[]
  resolved_risks: string[]
  new_merits: string[]
  resolved_merits: string[]
  data_quality_change: { prior: number; new: number }
  prior_run_date?: string
}

interface NumericField {
  field: string
  label: string
  getValue: (r: FundReport) => number | null
}

const NUMERIC_FIELDS: NumericField[] = [
  { field: 'fund_size_m',                     label: 'Fund Size',           getValue: r => r.fund_snapshot.fund_size_m },
  { field: 'nav_per_share',                    label: 'NAV / Share',         getValue: r => r.fund_snapshot.nav_per_share },
  { field: 'distribution_rate_annualized_pct', label: 'Distribution Rate',   getValue: r => r.fund_snapshot.distribution_rate_annualized_pct },
  { field: 'management_fee_pct',               label: 'Management Fee',      getValue: r => r.fund_snapshot.management_fee_pct },
  { field: 'weighted_avg_yield_pct',           label: 'Weighted Avg Yield',  getValue: r => r.credit_metrics.weighted_avg_yield_pct },
  { field: 'non_accrual_pct',                  label: 'Non-Accrual %',       getValue: r => r.credit_metrics.non_accrual_pct },
  { field: 'senior_secured_pct',               label: 'Senior Secured %',    getValue: r => r.credit_metrics.senior_secured_pct },
  { field: 'net_leverage_turns',               label: 'Net Leverage',        getValue: r => r.credit_metrics.net_leverage_turns },
  { field: 'deployed_pct',                     label: 'Deployed %',          getValue: r => r.credit_metrics.deployed_pct },
  { field: 'number_of_portfolio_companies',    label: 'Portfolio Companies', getValue: r => r.credit_metrics.number_of_portfolio_companies },
  { field: 'ytd_pct',                          label: 'YTD Return',          getValue: r => r.performance.ytd_pct },
  { field: 'one_year_pct',                     label: '1-Year Return',       getValue: r => r.performance.one_year_pct },
  { field: 'since_inception_pct',              label: 'Since Inception',     getValue: r => r.performance.since_inception_pct },
]

function stringSetDiff(prior: string[], next: string[]) {
  const priorSet = new Set(prior)
  const nextSet = new Set(next)
  return {
    added: next.filter(s => !priorSet.has(s)),
    removed: prior.filter(s => !nextSet.has(s)),
  }
}

export function compareRuns(priorData: FundReport, newData: FundReport): KeyChanges {
  const changes: ChangeRecord[] = []

  for (const { field, label, getValue } of NUMERIC_FIELDS) {
    const priorVal = getValue(priorData)
    const newVal = getValue(newData)

    if (priorVal === null && newVal === null) continue

    let direction: 'up' | 'down' | 'unchanged' = 'unchanged'
    let change_pct: number | null = null

    if (priorVal !== null && newVal !== null) {
      if (newVal > priorVal) direction = 'up'
      else if (newVal < priorVal) direction = 'down'
      if (priorVal !== 0) {
        change_pct = ((newVal - priorVal) / Math.abs(priorVal)) * 100
      }
    }

    if (direction !== 'unchanged') {
      changes.push({ field, label, prior_value: priorVal, new_value: newVal, change_pct, direction })
    }
  }

  const riskDiff  = stringSetDiff(priorData.risks  ?? [], newData.risks  ?? [])
  const meritDiff = stringSetDiff(priorData.merits ?? [], newData.merits ?? [])

  const priorQuality = priorData.data_quality?.completeness_pct ?? 0
  const newQuality   = newData.data_quality?.completeness_pct   ?? 0

  return {
    changes,
    new_risks:       riskDiff.added,
    resolved_risks:  riskDiff.removed,
    new_merits:      meritDiff.added,
    resolved_merits: meritDiff.removed,
    data_quality_change: { prior: priorQuality, new: newQuality },
  }
}
