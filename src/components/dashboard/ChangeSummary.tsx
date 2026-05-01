'use client'

import { useState } from 'react'
import { JetBrains_Mono } from 'next/font/google'
import { format } from 'date-fns'
import type { KeyChanges, ChangeRecord } from '@/lib/compareRuns'

const mono = JetBrains_Mono({ subsets: ['latin'] })

// Fields where an increase is bad for the investor
const INVERTED_FIELDS = new Set(['non_accrual_pct', 'management_fee_pct', 'net_leverage_turns'])

function isPositiveChange(change: ChangeRecord): boolean {
  const isUp = change.direction === 'up'
  return INVERTED_FIELDS.has(change.field) ? !isUp : isUp
}

function formatValue(field: string, v: number | string | null): string {
  if (v === null) return '—'
  if (typeof v === 'string') return v
  switch (field) {
    case 'fund_size_m':
      return v >= 1000 ? `$${(v / 1000).toFixed(2)}B` : `$${v.toFixed(0)}M`
    case 'nav_per_share':
      return `$${v.toFixed(2)}`
    case 'net_leverage_turns':
      return `${v.toFixed(1)}x`
    case 'number_of_portfolio_companies':
      return String(Math.round(v))
    case 'management_fee_pct':
    case 'distribution_rate_annualized_pct':
    case 'weighted_avg_yield_pct':
    case 'non_accrual_pct':
    case 'senior_secured_pct':
    case 'deployed_pct':
    case 'ytd_pct':
    case 'one_year_pct':
    case 'since_inception_pct':
    case 'completeness_pct':
      return `${v.toFixed(1)}%`
    default:
      return String(v)
  }
}

interface Props {
  changes: KeyChanges
}

export function ChangeSummary({ changes }: Props) {
  const [expanded, setExpanded] = useState(false)

  const totalChanges =
    changes.changes.length +
    changes.new_risks.length +
    changes.resolved_risks.length +
    changes.new_merits.length +
    changes.resolved_merits.length

  if (totalChanges === 0) return null

  const priorDate = changes.prior_run_date
    ? format(new Date(changes.prior_run_date), 'MMM d, yyyy')
    : null

  return (
    <div
      className={mono.className}
      style={{ border: '1px solid #2a2a2a', background: '#0D0D0D', marginBottom: 1 }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 24px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 10, color: '#C9A84C', letterSpacing: '0.15em' }}>
            CHANGES SINCE LAST RUN
          </span>
          {priorDate && (
            <span style={{ fontSize: 10, color: '#555555', letterSpacing: '0.06em' }}>
              {priorDate}
            </span>
          )}
          <span
            style={{
              fontSize: 9,
              color: '#666666',
              border: '1px solid #2a2a2a',
              padding: '2px 8px',
              letterSpacing: '0.08em',
            }}
          >
            {totalChanges} CHANGE{totalChanges !== 1 ? 'S' : ''}
          </span>
        </div>
        <span style={{ fontSize: 10, color: '#444444' }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid #2a2a2a', padding: '20px 24px 24px' }}>

          {/* Numeric metric changes */}
          {changes.changes.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 9, color: '#555555', letterSpacing: '0.12em', marginBottom: 12 }}>
                METRIC CHANGES
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {changes.changes.map((c) => {
                  const positive = isPositiveChange(c)
                  const arrowColor = positive ? '#4ade80' : '#f87171'
                  const arrow = c.direction === 'up' ? '↑' : '↓'
                  return (
                    <div
                      key={c.field}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '180px 100px 100px 80px',
                        alignItems: 'center',
                        gap: 12,
                        padding: '9px 12px',
                        background: '#111111',
                        border: '1px solid #1a1a1a',
                      }}
                    >
                      <span style={{ fontSize: 10, color: '#777777', letterSpacing: '0.04em' }}>
                        {c.label}
                      </span>
                      <span style={{ fontSize: 11, color: '#555555' }}>
                        {formatValue(c.field, c.prior_value)}
                      </span>
                      <span style={{ fontSize: 11, color: '#E8E0D0' }}>
                        {formatValue(c.field, c.new_value)}
                      </span>
                      <span style={{ fontSize: 12, color: arrowColor, textAlign: 'right' }}>
                        {arrow}
                        {c.change_pct != null && (
                          <span style={{ fontSize: 9, marginLeft: 4 }}>
                            {Math.abs(c.change_pct).toFixed(1)}%
                          </span>
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Risk changes */}
          {(changes.new_risks.length > 0 || changes.resolved_risks.length > 0) && (
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 9, color: '#555555', letterSpacing: '0.12em', marginBottom: 12 }}>
                RISK CHANGES
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {changes.new_risks.map((r, i) => (
                  <div key={`nr-${i}`} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span
                      style={{
                        fontSize: 9,
                        color: '#C9A84C',
                        border: '1px solid #3d2e00',
                        padding: '1px 6px',
                        flexShrink: 0,
                        letterSpacing: '0.06em',
                        marginTop: 2,
                      }}
                    >
                      NEW
                    </span>
                    <p style={{ fontSize: 11, color: '#C9A84C', lineHeight: 1.6, margin: 0 }}>{r}</p>
                  </div>
                ))}
                {changes.resolved_risks.map((r, i) => (
                  <div key={`rr-${i}`} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span
                      style={{
                        fontSize: 9,
                        color: '#4ade80',
                        border: '1px solid #1a4a1a',
                        padding: '1px 6px',
                        flexShrink: 0,
                        letterSpacing: '0.06em',
                        marginTop: 2,
                      }}
                    >
                      RES
                    </span>
                    <p style={{ fontSize: 11, color: '#4ade80', lineHeight: 1.6, margin: 0 }}>{r}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Merit changes */}
          {(changes.new_merits.length > 0 || changes.resolved_merits.length > 0) && (
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 9, color: '#555555', letterSpacing: '0.12em', marginBottom: 12 }}>
                MERIT CHANGES
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {changes.new_merits.map((m, i) => (
                  <div key={`nm-${i}`} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span
                      style={{
                        fontSize: 9,
                        color: '#4ade80',
                        border: '1px solid #1a4a1a',
                        padding: '1px 6px',
                        flexShrink: 0,
                        letterSpacing: '0.06em',
                        marginTop: 2,
                      }}
                    >
                      NEW
                    </span>
                    <p style={{ fontSize: 11, color: '#4ade80', lineHeight: 1.6, margin: 0 }}>{m}</p>
                  </div>
                ))}
                {changes.resolved_merits.map((m, i) => (
                  <div key={`rm-${i}`} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span
                      style={{
                        fontSize: 9,
                        color: '#555555',
                        border: '1px solid #2a2a2a',
                        padding: '1px 6px',
                        flexShrink: 0,
                        letterSpacing: '0.06em',
                        marginTop: 2,
                      }}
                    >
                      REM
                    </span>
                    <p style={{ fontSize: 11, color: '#555555', lineHeight: 1.6, margin: 0 }}>{m}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Data quality change */}
          {changes.data_quality_change.prior !== changes.data_quality_change.new && (
            <div>
              <p style={{ fontSize: 9, color: '#555555', letterSpacing: '0.12em', marginBottom: 10 }}>
                DATA QUALITY
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, color: '#555555' }}>
                  {changes.data_quality_change.prior.toFixed(0)}%
                </span>
                <span style={{ fontSize: 10, color: '#333333' }}>→</span>
                <span
                  style={{
                    fontSize: 11,
                    color: changes.data_quality_change.new > changes.data_quality_change.prior
                      ? '#4ade80'
                      : '#f87171',
                  }}
                >
                  {changes.data_quality_change.new.toFixed(0)}%
                </span>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
