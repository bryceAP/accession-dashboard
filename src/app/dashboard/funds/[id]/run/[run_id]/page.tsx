'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { JetBrains_Mono, Cormorant_Garamond } from 'next/font/google'
import { format } from 'date-fns'
import type { FundReport, ReportSections } from '@/types'
import { DISCLAIMER } from '@/lib/anthropic/prompts'
import type { KeyChanges } from '@/lib/compareRuns'
import { ChangeSummary } from '@/components/dashboard/ChangeSummary'
import { PerformanceTable } from '@/components/charts/PerformanceTable'
import { ReturnHistogram } from '@/components/charts/ReturnHistogram'
import { FundSizeChart } from '@/components/charts/FundSizeChart'
import { FundFlowsChart } from '@/components/charts/FundFlowsChart'
import { CreditMetricsGrid } from '@/components/charts/CreditMetricsGrid'
import { PortfolioCompositionCharts } from '@/components/charts/PortfolioCompositionCharts'
import { DistributionHistoryChart } from '@/components/charts/DistributionHistoryChart'

const mono = JetBrains_Mono({ subsets: ['latin'] })
const garamond = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  display: 'swap',
})

/* ─── Types ─────────────────────────────────────────────────── */

interface RunRecord {
  id: string
  fund_id: string
  status: string
  report_text: string | null
  structured_data: FundReport | null
  input_tokens: number | null
  output_tokens: number | null
  created_at: string
  prior_run_id: string | null
  key_changes: KeyChanges | null
}

interface FundMeta {
  id: string
  name: string
  manager: string | null
  strategy: string | null
}

/* ─── Formatting ─────────────────────────────────────────────── */

function fmtPct(v: number, decimals = 1): string {
  return `${v.toFixed(decimals)}%`
}

function fmtM(v: number): string {
  if (v >= 1000) return `$${(v / 1000).toFixed(2)}B`
  return `$${v.toFixed(0)}M`
}

function fmtNav(v: number): string {
  return `$${v.toFixed(2)}`
}

function fmtDollars(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v.toLocaleString()}`
}

/* ─── Status badge ───────────────────────────────────────────── */

const STATUS_STYLE: Record<string, { border: string; color: string }> = {
  complete: { border: '#1a4a1a', color: '#4ade80' },
  partial:  { border: '#3d2e00', color: '#C9A84C' },
  error:    { border: '#4a1a1a', color: '#f87171' },
  running:  { border: '#3d2e00', color: '#C9A84C' },
  pending:  { border: '#2a2a2a', color: '#555555' },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.pending
  return (
    <span
      className={mono.className}
      style={{
        display: 'inline-block',
        border: `1px solid ${s.border}`,
        color: s.color,
        fontSize: 10,
        letterSpacing: '0.1em',
        padding: '2px 8px',
      }}
    >
      {status.toUpperCase()}
    </span>
  )
}

/* ─── Layout primitives ──────────────────────────────────────── */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p
      className={mono.className}
      style={{
        fontSize: 10,
        color: '#666666',
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        marginBottom: 16,
      }}
    >
      {children}
    </p>
  )
}

function SectionBox({
  title,
  children,
  style,
}: {
  title?: string
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div style={{ border: '1px solid #2a2a2a', padding: 24, ...style }}>
      {title && <SectionTitle>{title}</SectionTitle>}
      {children}
    </div>
  )
}

function SnapshotCard({ label, value }: { label: string; value: string | null }) {
  return (
    <div style={{ padding: '18px 20px', background: '#0D0D0D' }}>
      <p
        className={mono.className}
        style={{ fontSize: 9, color: '#666666', letterSpacing: '0.12em', marginBottom: 8 }}
      >
        {label}
      </p>
      <p
        className={garamond.className}
        style={{ fontSize: 22, color: value ? '#E8E0D0' : '#333333', fontWeight: 300, lineHeight: 1.2 }}
      >
        {value ?? '—'}
      </p>
    </div>
  )
}

/* ─── Written-analysis section map ───────────────────────────── */

const WRITTEN_SECTIONS: { num: number; title: string; key: keyof ReportSections }[] = [
  { num: 1, title: 'Fund Overview',        key: 'fund_overview' },
  { num: 2, title: 'Investment Strategy',  key: 'investment_strategy' },
  { num: 3, title: 'Portfolio Analysis',   key: 'portfolio_analysis' },
  { num: 4, title: 'Performance Analysis', key: 'performance_analysis' },
  { num: 5, title: 'Risk Analysis',        key: 'risk_analysis' },
  { num: 6, title: 'Fee Analysis',         key: 'fee_analysis' },
  { num: 7, title: 'Conclusion',           key: 'conclusion' },
]

/* ─── Page ───────────────────────────────────────────────────── */

export default function RunDetailPage() {
  const params  = useParams()
  const router  = useRouter()
  const fundId  = params.id as string
  const runId   = params.run_id as string

  const [run,        setRun]        = useState<RunRecord | null>(null)
  const [fund,       setFund]       = useState<FundMeta | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [rerunning,  setRerunning]  = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setFetchError('')
    try {
      const [runRes, fundRes] = await Promise.all([
        fetch(`/api/runs/${runId}`),
        fetch(`/api/funds/${fundId}`),
      ])
      if (!runRes.ok) {
        const d = await runRes.json()
        throw new Error(d.error ?? 'Run not found')
      }
      const [runData, fundData] = await Promise.all([
        runRes.json(),
        fundRes.ok ? fundRes.json() : null,
      ])
      setRun(runData)
      setFund(fundData)
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [fundId, runId])

  useEffect(() => { load() }, [load])

  const handleRerun = async () => {
    if (rerunning) return
    setRerunning(true)
    try {
      const res = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fund_id: fundId, document_ids: [], prior_run_id: runId }),
      })
      const data = await res.json()
      if (res.ok) router.push(`/dashboard/funds/${fundId}/run/${data.id}`)
    } finally {
      setRerunning(false)
    }
  }

  /* ─── Loading / error ────────────────────────────────────── */

  if (loading) {
    return (
      <div
        className={`${mono.className} flex items-center justify-center`}
        style={{ height: 300, background: '#0D0D0D' }}
      >
        <p style={{ color: '#444444', fontSize: 11, letterSpacing: '0.15em' }}>LOADING...</p>
      </div>
    )
  }

  if (fetchError || !run) {
    return (
      <div className={`${mono.className} p-8`} style={{ background: '#0D0D0D', minHeight: '100vh' }}>
        <p style={{ color: '#f87171', fontSize: 12, marginBottom: 16 }}>
          {fetchError || 'Run not found'}
        </p>
        <Link
          href={`/dashboard/funds/${fundId}`}
          className="text-[#555555] hover:text-[#999999] text-xs tracking-widest transition-colors"
        >
          ← BACK TO FUND
        </Link>
      </div>
    )
  }

  /* ─── Derived data ───────────────────────────────────────── */

  const report      = run.structured_data
  const snap        = report?.fund_snapshot
  const perf        = report?.performance
  const metrics     = report?.credit_metrics
  const composition = report?.portfolio_composition
  const sections    = report?.report_sections
  const quality     = report?.data_quality

  const fundName = fund?.name ?? snap?.fund_name ?? 'Unknown Fund'
  const manager  = fund?.manager ?? snap?.manager ?? null
  const strategy = fund?.strategy ?? snap?.strategy_label ?? null
  const structure = snap?.structure ?? null
  const runDate   = format(new Date(run.created_at), 'MMM d, yyyy')

  const metaLine = [manager, strategy, structure, runDate].filter(Boolean).join(' · ')

  const snapshotCards: { label: string; value: string | null }[] = [
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
    { label: 'BENCHMARK',          value: perf?.benchmark_name ?? null },
    { label: 'STRATEGY',           value: snap?.strategy_label ?? strategy },
  ]

  /* ─── Render ─────────────────────────────────────────────── */

  return (
    <div style={{ background: '#0D0D0D', minHeight: '100vh' }}>

      {/* Breadcrumb */}
      <div
        className={`${mono.className} flex items-center gap-3 px-8 py-5`}
        style={{ borderBottom: '1px solid #2a2a2a' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/White V2.png" alt="Accession Partners" style={{ height: 16, width: 'auto' }} />
        <span style={{ color: '#444444', fontSize: 10, letterSpacing: '0.15em' }}>ACCESSION PARTNERS</span>
        <span style={{ color: '#2a2a2a' }}>/</span>
        <Link href="/dashboard/funds" className="text-[#444444] hover:text-[#999999] text-xs tracking-widest transition-colors">
          FUNDS
        </Link>
        <span style={{ color: '#2a2a2a' }}>/</span>
        <Link
          href={`/dashboard/funds/${fundId}`}
          className="text-[#444444] hover:text-[#999999] text-xs tracking-widest transition-colors truncate max-w-[200px]"
        >
          {fundName.toUpperCase()}
        </Link>
        <span style={{ color: '#2a2a2a' }}>/</span>
        <span className="text-[#E8E0D0] text-xs tracking-widest">
          {format(new Date(run.created_at), 'MMM d, yyyy')}
        </span>
      </div>

      {/* Sections */}
      <div className="flex flex-col gap-px px-8 py-8">

        {/* Change detection banner */}
        {run.key_changes && (
          <ChangeSummary changes={run.key_changes} />
        )}

        {/* SECTION 1 — Header */}
        <SectionBox>
          <div className="flex items-start justify-between gap-6">
            <div>
              <h1
                className={garamond.className}
                style={{ fontSize: 40, fontWeight: 300, color: '#E8E0D0', lineHeight: 1.1, marginBottom: 10 }}
              >
                {fundName}
              </h1>
              {metaLine && (
                <p
                  className={mono.className}
                  style={{ fontSize: 11, color: '#666666', letterSpacing: '0.08em', marginBottom: 16 }}
                >
                  {metaLine}
                </p>
              )}
              <StatusBadge status={run.status} />
            </div>
            <div className="flex gap-3 flex-shrink-0 mt-1">
              <button
                onClick={() => window.open(`/dashboard/funds/${fundId}/run/${runId}/print`, '_blank')}
                className={mono.className}
                style={{
                  background: '#C9A84C',
                  color: '#000000',
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  padding: '9px 22px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                EXPORT PDF
              </button>
              <button
                onClick={handleRerun}
                disabled={rerunning}
                className={mono.className}
                style={{
                  background: '#C9A84C',
                  color: '#000000',
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  padding: '9px 22px',
                  border: 'none',
                  cursor: rerunning ? 'not-allowed' : 'pointer',
                  opacity: rerunning ? 0.6 : 1,
                }}
              >
                {rerunning ? 'RUNNING...' : 'RE-RUN'}
              </button>
            </div>
          </div>
        </SectionBox>

        {/* SECTION 2 — Fund Snapshot */}
        <SectionBox title="FUND SNAPSHOT">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 1,
              background: '#2a2a2a',
              border: '1px solid #2a2a2a',
            }}
          >
            {snapshotCards.map((card) => (
              <SnapshotCard key={card.label} label={card.label} value={card.value} />
            ))}
          </div>
        </SectionBox>

        {/* SECTION 3 — Merits & Risks */}
        <SectionBox title="MERITS & RISKS">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#2a2a2a' }}>
            {/* Key Strengths */}
            <div style={{ background: '#040e04', border: '1px solid #0a1a0a', padding: 20 }}>
              <p
                className={mono.className}
                style={{ fontSize: 9, color: '#4ade80', letterSpacing: '0.12em', marginBottom: 14 }}
              >
                KEY STRENGTHS
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(report?.merits ?? []).length > 0 ? (
                  report!.merits.map((merit, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ color: '#4ade80', fontSize: 13, flexShrink: 0, lineHeight: 1.6 }}>✓</span>
                      <p className={mono.className} style={{ fontSize: 11, color: '#999999', lineHeight: 1.7 }}>
                        {merit}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className={mono.className} style={{ fontSize: 11, color: '#333333' }}>No data</p>
                )}
              </div>
            </div>
            {/* Key Risks */}
            <div style={{ background: '#0d0a00', border: '1px solid #1a1400', padding: 20 }}>
              <p
                className={mono.className}
                style={{ fontSize: 9, color: '#C9A84C', letterSpacing: '0.12em', marginBottom: 14 }}
              >
                KEY RISKS
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(report?.risks ?? []).length > 0 ? (
                  report!.risks.map((risk, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ color: '#C9A84C', fontSize: 13, flexShrink: 0, lineHeight: 1.6 }}>⚠</span>
                      <p className={mono.className} style={{ fontSize: 11, color: '#999999', lineHeight: 1.7 }}>
                        {risk}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className={mono.className} style={{ fontSize: 11, color: '#333333' }}>No data</p>
                )}
              </div>
            </div>
          </div>
        </SectionBox>

        {/* SECTION 4 — Performance */}
        <SectionBox title="PERFORMANCE">
          <div style={{ marginBottom: 28 }}>
            <PerformanceTable performance={perf} />
          </div>
          <ReturnHistogram performance={perf} />
        </SectionBox>

        {/* SECTION 5 — Fund Size & Flows */}
        <SectionBox title="FUND SIZE & FLOWS">
          <div style={{ display: 'flex', gap: 24 }}>
            <div style={{ flex: '0 0 60%', minWidth: 0 }}>
              <FundSizeChart data={perf?.fund_size_history} />
            </div>
            <div style={{ flex: '1 1 40%', minWidth: 0 }}>
              <FundFlowsChart
                fundSizeHistory={perf?.fund_size_history}
                deployedPct={metrics?.deployed_pct}
                fundSizeM={snap?.fund_size_m}
              />
            </div>
          </div>
        </SectionBox>

        {/* SECTION 6 — Credit Quality Metrics */}
        <SectionBox title="CREDIT QUALITY METRICS">
          <CreditMetricsGrid metrics={metrics} />
        </SectionBox>

        {/* SECTION 7 — Portfolio Composition */}
        <SectionBox title="PORTFOLIO COMPOSITION">
          <PortfolioCompositionCharts composition={composition} />
        </SectionBox>

        {/* SECTION 8 — Distribution History */}
        <SectionBox title="DISTRIBUTION HISTORY">
          <DistributionHistoryChart
            data={perf?.distribution_history}
            annualizedRatePct={snap?.distribution_rate_annualized_pct}
          />
        </SectionBox>

        {/* WRITTEN ANALYSIS divider */}
        <div
          style={{
            borderTop: '1px solid #1e1e1e',
            borderBottom: '1px solid #1e1e1e',
            padding: '14px 0',
            textAlign: 'center',
            margin: '8px 0',
          }}
        >
          <span className={mono.className} style={{ fontSize: 10, color: '#444444', letterSpacing: '0.3em' }}>
            WRITTEN ANALYSIS
          </span>
        </div>

        {/* SECTION 9 — Written Report */}
        <SectionBox>
          {sections ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
              {WRITTEN_SECTIONS.map(({ num, title, key }) => {
                const text = sections[key]
                if (!text) return null
                return (
                  <div key={key}>
                    <h2
                      className={garamond.className}
                      style={{
                        fontSize: 24,
                        fontWeight: 400,
                        color: '#E8E0D0',
                        marginBottom: 14,
                        paddingBottom: 10,
                        borderBottom: '1px solid #1e1e1e',
                      }}
                    >
                      {num}. {title}
                    </h2>
                    <p
                      className={mono.className}
                      style={{ fontSize: 12, color: '#999999', lineHeight: 1.9 }}
                    >
                      {text}
                    </p>
                  </div>
                )
              })}

              {/* Disclaimer */}
              <div style={{ borderTop: '1px solid #1e1e1e', paddingTop: 20 }}>
                <p
                  className={mono.className}
                  style={{ fontSize: 10, color: '#444444', lineHeight: 1.8 }}
                >
                  {DISCLAIMER}
                </p>
              </div>
            </div>
          ) : (
            <p className={mono.className} style={{ fontSize: 12, color: '#444444', letterSpacing: '0.08em' }}>
              No written analysis available for this run.
            </p>
          )}
        </SectionBox>

        {/* SECTION 10 — Data Quality & Sources */}
        <SectionBox title="DATA QUALITY & SOURCES">

          {/* Completeness bar */}
          {quality && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className={mono.className} style={{ fontSize: 9, color: '#666666', letterSpacing: '0.1em' }}>
                  DATA COMPLETENESS
                </span>
                <span className={mono.className} style={{ fontSize: 9, color: '#C9A84C' }}>
                  {quality.completeness_pct.toFixed(0)}%
                </span>
              </div>
              <div style={{ height: 6, background: '#1a1a1a', position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    height: '100%',
                    width: `${Math.min(100, quality.completeness_pct)}%`,
                    background: '#C9A84C',
                  }}
                />
              </div>

              {quality.null_fields?.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <p
                    className={mono.className}
                    style={{ fontSize: 9, color: '#666666', letterSpacing: '0.1em', marginBottom: 10 }}
                  >
                    MISSING FIELDS
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {quality.null_fields.map((field) => (
                      <span
                        key={field}
                        className={mono.className}
                        style={{
                          fontSize: 9,
                          color: '#555555',
                          border: '1px solid #2a2a2a',
                          padding: '3px 8px',
                          letterSpacing: '0.05em',
                        }}
                      >
                        {field}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sources table */}
          {report?.sources && report.sources.length > 0 && (
            <div>
              <p
                className={mono.className}
                style={{ fontSize: 9, color: '#666666', letterSpacing: '0.1em', marginBottom: 10 }}
              >
                SOURCES
              </p>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                    {(['NAME', 'RELIABILITY'] as const).map((col) => (
                      <th
                        key={col}
                        className={mono.className}
                        style={{
                          textAlign: 'left',
                          fontSize: 9,
                          color: '#444444',
                          letterSpacing: '0.1em',
                          paddingBottom: 8,
                          paddingRight: 24,
                          fontWeight: 400,
                        }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.sources.map((source) => {
                    const reliabilityColor =
                      source.reliability === 'high'   ? '#4ade80'
                      : source.reliability === 'medium' ? '#C9A84C'
                      : '#f87171'
                    return (
                      <tr key={source.id} style={{ borderBottom: '1px solid #1a1a1a' }}>
                        <td
                          className={mono.className}
                          style={{ fontSize: 11, color: '#E8E0D0', padding: '10px 24px 10px 0' }}
                        >
                          {source.name}
                        </td>
                        <td
                          className={mono.className}
                          style={{ fontSize: 10, color: reliabilityColor, padding: '10px 0', letterSpacing: '0.08em' }}
                        >
                          {source.reliability.toUpperCase()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!quality && (!report?.sources || report.sources.length === 0) && (
            <p className={mono.className} style={{ fontSize: 12, color: '#444444' }}>
              No data quality information available.
            </p>
          )}
        </SectionBox>

      </div>
    </div>
  )
}
