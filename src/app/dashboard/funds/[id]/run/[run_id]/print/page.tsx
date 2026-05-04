'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { JetBrains_Mono, Cormorant_Garamond } from 'next/font/google'
import { format } from 'date-fns'
import type { FundReport, ReportSections } from '@/types'
import { DISCLAIMER } from '@/lib/anthropic/prompts'
import { PerformanceTable } from '@/components/charts/PerformanceTable'
import { ReturnHistogram } from '@/components/charts/ReturnHistogram'
import { CreditMetricsGrid } from '@/components/charts/CreditMetricsGrid'
import { PortfolioCompositionCharts } from '@/components/charts/PortfolioCompositionCharts'
import { DistributionHistoryChart } from '@/components/charts/DistributionHistoryChart'

const mono = JetBrains_Mono({ subsets: ['latin'] })
const garamond = Cormorant_Garamond({ subsets: ['latin'], weight: ['300', '400', '500'], display: 'swap' })

interface RunRecord {
  id: string
  fund_id: string
  status: string
  structured_data: FundReport | null
  created_at: string
}

interface FundMeta {
  id: string
  name: string
  manager: string | null
  strategy: string | null
}

function fmtPct(v: number, d = 1) { return `${v.toFixed(d)}%` }
function fmtM(v: number) { return v >= 1000 ? `$${(v / 1000).toFixed(2)}B` : `$${v.toFixed(0)}M` }
function fmtNav(v: number) { return `$${v.toFixed(2)}` }
function fmtDollars(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v.toLocaleString()}`
}

const WRITTEN_SECTIONS: { num: number; title: string; key: keyof ReportSections }[] = [
  { num: 1, title: 'Fund Overview',        key: 'fund_overview' },
  { num: 2, title: 'Investment Strategy',  key: 'investment_strategy' },
  { num: 3, title: 'Portfolio Analysis',   key: 'portfolio_analysis' },
  { num: 4, title: 'Performance Analysis', key: 'performance_analysis' },
  { num: 5, title: 'Risk Analysis',        key: 'risk_analysis' },
  { num: 6, title: 'Fee Analysis',         key: 'fee_analysis' },
  { num: 7, title: 'Conclusion',           key: 'conclusion' },
]

const PRINT_STYLES = `
  @page { size: A4 landscape; margin: 1.5cm; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .page-break { page-break-after: always; break-after: page; }
  body { background: #0D0D0D; }
  @media print {
    .no-print { display: none !important; }
    aside { display: none !important; }
    main { margin-left: 0 !important; padding: 0 !important; }
  }
`

const PAGE: React.CSSProperties = { padding: '48px 56px', background: '#0D0D0D' }

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className={mono.className} style={{ fontSize: 10, color: '#666', letterSpacing: '0.2em', marginBottom: 24 }}>
      {children}
    </p>
  )
}

export default function PrintPage() {
  const params = useParams()
  const fundId  = params.id     as string
  const runId   = params.run_id as string

  const [run,     setRun]     = useState<RunRecord | null>(null)
  const [fund,    setFund]    = useState<FundMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [err,     setErr]     = useState('')

  const load = useCallback(async () => {
    try {
      const [runRes, fundRes] = await Promise.all([
        fetch(`/api/runs/${runId}`),
        fetch(`/api/funds/${fundId}`),
      ])
      if (!runRes.ok) throw new Error('Run not found')
      const [runData, fundData] = await Promise.all([
        runRes.json(),
        fundRes.ok ? fundRes.json() : null,
      ])
      setRun(runData)
      setFund(fundData)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [fundId, runId])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className={mono.className} style={{ background: '#0D0D0D', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#444', fontSize: 11, letterSpacing: '0.15em' }}>LOADING...</p>
      </div>
    )
  }

  if (err || !run) {
    return (
      <div className={mono.className} style={{ background: '#0D0D0D', minHeight: '100vh', padding: 32 }}>
        <p style={{ color: '#f87171', fontSize: 12, marginBottom: 16 }}>{err || 'Run not found'}</p>
        <Link href={`/dashboard/funds/${fundId}/run/${runId}`} style={{ color: '#555', fontSize: 11, letterSpacing: '0.1em' }}>
          ← BACK
        </Link>
      </div>
    )
  }

  const report      = run.structured_data
  const snap        = report?.fund_snapshot
  const perf        = report?.performance
  const metrics     = report?.credit_metrics
  const composition = report?.portfolio_composition
  const sections    = report?.report_sections
  const quality     = report?.data_quality

  const fundName    = fund?.name ?? snap?.fund_name ?? 'Unknown Fund'
  const manager     = fund?.manager ?? snap?.manager ?? null
  const strategy    = fund?.strategy ?? snap?.strategy_label ?? null
  const structure   = snap?.structure ?? null
  const analysisDate = format(new Date(run.created_at), 'MMMM d, yyyy')

  const snapshotCards = [
    { label: 'FUND NAME',          value: snap?.fund_name ?? null },
    { label: 'MANAGER',            value: snap?.manager ?? null },
    { label: 'STRATEGY',           value: snap?.strategy_label ?? null },
    { label: 'STRUCTURE',          value: snap?.structure ?? null },
    { label: 'INCEPTION DATE',     value: snap?.inception_date ?? null },
    { label: 'FUND SIZE',          value: snap?.fund_size_m != null ? fmtM(snap.fund_size_m) : null },
    { label: 'NAV / SHARE',        value: snap?.nav_per_share != null ? fmtNav(snap.nav_per_share) : null },
    { label: 'DISTRIBUTION RATE',  value: snap?.distribution_rate_annualized_pct != null ? fmtPct(snap.distribution_rate_annualized_pct) : null },
    { label: 'MGMT FEE',           value: snap?.management_fee_pct != null ? fmtPct(snap.management_fee_pct) : null },
    { label: 'PERFORMANCE FEE',    value: snap?.performance_fee_pct != null ? fmtPct(snap.performance_fee_pct) : null },
    { label: 'HURDLE RATE',        value: snap?.hurdle_rate_pct != null ? fmtPct(snap.hurdle_rate_pct) : null },
    { label: 'MIN INVESTMENT',     value: snap?.minimum_investment != null ? fmtDollars(snap.minimum_investment) : null },
    { label: 'LIQUIDITY TERMS',    value: snap?.liquidity_terms ?? null },
    { label: 'LEVERAGE TARGET',    value: snap?.leverage_target ?? null },
  ]

  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />

      {/* Floating UI — hidden on print */}
      <div
        className="no-print"
        style={{ position: 'fixed', top: 16, right: 16, display: 'flex', gap: 10, zIndex: 100 }}
      >
        <Link
          href={`/dashboard/funds/${fundId}/run/${runId}`}
          className={mono.className}
          style={{
            background: '#1a1a1a',
            border: '1px solid #2a2a2a',
            color: '#999999',
            fontSize: 11,
            letterSpacing: '0.1em',
            padding: '8px 16px',
            textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          ← BACK
        </Link>
        <button
          onClick={() => window.print()}
          className={mono.className}
          style={{
            background: '#C9A84C',
            color: '#000000',
            fontSize: 11,
            letterSpacing: '0.1em',
            padding: '8px 18px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          PRINT REPORT
        </button>
      </div>

      <div style={{ background: '#0D0D0D' }}>

        {/* ─── PAGE 1: Cover ──────────────────────────────────────── */}
        <div
          className="page-break"
          style={{
            background: '#0f172a',
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px 60px',
            position: 'relative',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/White V2.png" alt="Accession Partners" style={{ maxWidth: 200, marginBottom: 64 }} />

          <h1
            className={garamond.className}
            style={{ fontSize: 58, fontWeight: 300, color: '#E8E0D0', textAlign: 'center', lineHeight: 1.1, marginBottom: 20 }}
          >
            {fundName}
          </h1>

          {[manager, strategy, structure].filter(Boolean).length > 0 && (
            <p
              className={mono.className}
              style={{ fontSize: 12, color: '#666666', letterSpacing: '0.1em', marginBottom: 40, textAlign: 'center' }}
            >
              {[manager, strategy, structure].filter(Boolean).join(' · ')}
            </p>
          )}

          <p className={mono.className} style={{ fontSize: 11, color: '#555555', letterSpacing: '0.15em', marginBottom: 16 }}>
            ANALYSIS DATE: {analysisDate.toUpperCase()}
          </p>

          <p className={mono.className} style={{ fontSize: 9, color: '#444444', letterSpacing: '0.35em' }}>
            CONFIDENTIAL
          </p>

          <p
            className={mono.className}
            style={{ position: 'absolute', bottom: 40, fontSize: 9, color: '#444444', letterSpacing: '0.1em' }}
          >
            Prepared by Accession Partners LLC
          </p>
        </div>

        {/* ─── PAGE 2: Fund Snapshot ──────────────────────────────── */}
        <div className="page-break" style={PAGE}>
          <SectionLabel>FUND SNAPSHOT</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: '#2a2a2a' }}>
            {snapshotCards.map(card => (
              <div key={card.label} style={{ background: '#0D0D0D', padding: '20px 22px' }}>
                <p className={mono.className} style={{ fontSize: 9, color: '#666666', letterSpacing: '0.12em', marginBottom: 8 }}>
                  {card.label}
                </p>
                <p
                  className={garamond.className}
                  style={{ fontSize: 22, color: card.value ? '#E8E0D0' : '#333333', fontWeight: 300, lineHeight: 1.2 }}
                >
                  {card.value ?? '—'}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ─── PAGE 3: Merits & Risks ─────────────────────────────── */}
        <div className="page-break" style={PAGE}>
          <SectionLabel>MERITS & RISKS</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#2a2a2a' }}>
            <div style={{ background: '#040e04', border: '1px solid #0a1a0a', padding: 28 }}>
              <p className={mono.className} style={{ fontSize: 9, color: '#4ade80', letterSpacing: '0.12em', marginBottom: 16 }}>
                KEY STRENGTHS
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(report?.merits ?? []).length > 0
                  ? report!.merits.map((m, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <span style={{ color: '#4ade80', fontSize: 13, flexShrink: 0, lineHeight: 1.6 }}>✓</span>
                        <p className={mono.className} style={{ fontSize: 11, color: '#999999', lineHeight: 1.7 }}>{m}</p>
                      </div>
                    ))
                  : <p className={mono.className} style={{ fontSize: 11, color: '#333333' }}>No data</p>
                }
              </div>
            </div>
            <div style={{ background: '#0d0a00', border: '1px solid #1a1400', padding: 28 }}>
              <p className={mono.className} style={{ fontSize: 9, color: '#C9A84C', letterSpacing: '0.12em', marginBottom: 16 }}>
                KEY RISKS
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(report?.risks ?? []).length > 0
                  ? report!.risks.map((r, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <span style={{ color: '#C9A84C', fontSize: 13, flexShrink: 0, lineHeight: 1.6 }}>⚠</span>
                        <p className={mono.className} style={{ fontSize: 11, color: '#999999', lineHeight: 1.7 }}>{r}</p>
                      </div>
                    ))
                  : <p className={mono.className} style={{ fontSize: 11, color: '#333333' }}>No data</p>
                }
              </div>
            </div>
          </div>
        </div>

        {/* ─── PAGE 4: Performance ────────────────────────────────── */}
        <div className="page-break" style={PAGE}>
          <SectionLabel>PERFORMANCE</SectionLabel>
          <div style={{ marginBottom: 32 }}>
            <PerformanceTable performance={perf} />
          </div>
          <ReturnHistogram performance={perf} />
        </div>

        {/* ─── PAGE 5: Credit Metrics ─────────────────────────────── */}
        <div className="page-break" style={PAGE}>
          <SectionLabel>CREDIT QUALITY METRICS</SectionLabel>
          <CreditMetricsGrid metrics={metrics} />
        </div>

        {/* ─── PAGE 6: Portfolio Composition ──────────────────────── */}
        <div className="page-break" style={PAGE}>
          <SectionLabel>PORTFOLIO COMPOSITION</SectionLabel>
          <PortfolioCompositionCharts composition={composition} />
        </div>

        {/* ─── PAGE 7: Distribution History ───────────────────────── */}
        <div className="page-break" style={PAGE}>
          <SectionLabel>DISTRIBUTION HISTORY</SectionLabel>
          <DistributionHistoryChart
            data={perf?.distribution_history}
            annualizedRatePct={snap?.distribution_rate_annualized_pct}
          />
        </div>

        {/* ─── PAGES 8+: Written Analysis ─────────────────────────── */}
        {sections && WRITTEN_SECTIONS.map(({ num, title, key }) => {
          const text = sections[key]
          if (!text) return null
          return (
            <div key={key} className="page-break" style={{ ...PAGE, minHeight: '50vh' }}>
              <h2
                className={garamond.className}
                style={{ fontSize: 38, fontWeight: 400, color: '#E8E0D0', marginBottom: 8, lineHeight: 1.1 }}
              >
                {num}. {title}
              </h2>
              <div style={{ width: 40, height: 1, background: '#C9A84C', marginBottom: 28 }} />
              <p className={mono.className} style={{ fontSize: 12, color: '#999999', lineHeight: 2.0, maxWidth: 960 }}>
                {text}
              </p>
            </div>
          )
        })}

        {/* ─── LAST PAGE: Data Quality & Disclaimer ───────────────── */}
        <div style={PAGE}>
          <SectionLabel>DATA QUALITY & SOURCES</SectionLabel>

          {quality && (
            <div style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className={mono.className} style={{ fontSize: 9, color: '#666666', letterSpacing: '0.1em' }}>
                  DATA COMPLETENESS
                </span>
                <span className={mono.className} style={{ fontSize: 9, color: '#C9A84C' }}>
                  {quality.completeness_pct.toFixed(0)}%
                </span>
              </div>
              <div style={{ height: 6, background: '#1a1a1a', position: 'relative' }}>
                <div style={{
                  position: 'absolute', left: 0, top: 0, height: '100%',
                  width: `${Math.min(100, quality.completeness_pct)}%`,
                  background: '#C9A84C',
                }} />
              </div>
              {quality.null_fields?.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <p className={mono.className} style={{ fontSize: 9, color: '#666666', letterSpacing: '0.1em', marginBottom: 10 }}>
                    MISSING FIELDS
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {quality.null_fields.map(f => (
                      <span key={f} className={mono.className} style={{ fontSize: 9, color: '#555555', border: '1px solid #2a2a2a', padding: '3px 8px' }}>
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {report?.sources && report.sources.length > 0 && (
            <div style={{ marginBottom: 40 }}>
              <p className={mono.className} style={{ fontSize: 9, color: '#666666', letterSpacing: '0.1em', marginBottom: 12 }}>
                SOURCES
              </p>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                    {['NAME', 'RELIABILITY'].map(col => (
                      <th
                        key={col}
                        className={mono.className}
                        style={{ textAlign: 'left', fontSize: 9, color: '#444444', letterSpacing: '0.1em', paddingBottom: 8, paddingRight: 24, fontWeight: 400 }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.sources.map(source => {
                    const rc = source.reliability === 'high' ? '#4ade80' : source.reliability === 'medium' ? '#C9A84C' : '#f87171'
                    return (
                      <tr key={source.id} style={{ borderBottom: '1px solid #1a1a1a' }}>
                        <td className={mono.className} style={{ fontSize: 11, color: '#E8E0D0', padding: '10px 24px 10px 0' }}>
                          {source.name}
                        </td>
                        <td className={mono.className} style={{ fontSize: 10, color: rc, padding: '10px 0', letterSpacing: '0.08em' }}>
                          {source.reliability.toUpperCase()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ borderTop: '1px solid #1e1e1e', paddingTop: 24 }}>
            <p className={mono.className} style={{ fontSize: 10, color: '#444444', lineHeight: 1.8, maxWidth: 900 }}>
              {DISCLAIMER}
            </p>
          </div>
        </div>

      </div>
    </>
  )
}
