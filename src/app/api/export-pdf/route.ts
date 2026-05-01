import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from 'pdf-lib'
import { supabase } from '@/lib/supabase'
import type { FundReport, ReportSections } from '@/types'

// A4 landscape
const PW = 842
const PH = 595
const M  = 48
const FOOTER_Y      = 16
const CONTENT_BOTTOM = 42

// Colors (0-1 scale)
const NAVY  = rgb(0.106, 0.169, 0.298)
const GOLD  = rgb(0.788, 0.659, 0.298)
const WHITE = rgb(1, 1, 1)
const DARK  = rgb(0.13, 0.13, 0.13)
const GRAY  = rgb(0.45, 0.45, 0.45)
const LGRAY = rgb(0.85, 0.85, 0.85)
const GREEN = rgb(0.10, 0.52, 0.10)
const RED   = rgb(0.72, 0.10, 0.10)

const wrapText = (text: string, font: PDFFont, size: number, maxWidth: number): string[] => {
  const lines: string[] = []
  for (const para of text.split('\n')) {
    if (!para.trim()) { lines.push(''); continue }
    const words = para.split(' ')
    let line = ''
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        lines.push(line)
        line = word
      } else {
        line = candidate
      }
    }
    if (line) lines.push(line)
  }
  return lines
}

const fmtPct = (v: number | null | undefined, d = 1): string =>
  v == null ? '-' : `${v.toFixed(d)}%`

const fmtM = (v: number | null | undefined): string => {
  if (v == null) return '-'
  if (v >= 1000) return `$${(v / 1000).toFixed(2)}B`
  return `$${v.toFixed(0)}M`
}

const fmtDollars = (v: number | null | undefined): string => {
  if (v == null) return '-'
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`
  return `$${v.toLocaleString()}`
}

const fmtX = (v: number | null | undefined, d = 2): string =>
  v == null ? '-' : `${v.toFixed(d)}x`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const run_id: string = body?.run_id
    if (!run_id) return NextResponse.json({ error: 'run_id required' }, { status: 400 })

    const { data: run, error: runErr } = await supabase
      .from('dashboard_runs')
      .select('*')
      .eq('id', run_id)
      .single()
    if (runErr || !run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })

    const { data: fund } = await supabase
      .from('funds')
      .select('id, name, manager, strategy')
      .eq('id', run.fund_id)
      .single()

    const report   = run.structured_data as FundReport | null
    const snap     = report?.fund_snapshot
    const perf     = report?.performance
    const metrics  = report?.credit_metrics
    const sections = report?.report_sections
    const quality  = report?.data_quality

    const fundName = (fund?.name ?? snap?.fund_name ?? 'Unknown Fund') as string
    const manager  = (fund?.manager ?? snap?.manager ?? null) as string | null
    const strategy = (fund?.strategy ?? snap?.strategy_label ?? null) as string | null
    const runDate  = new Date(run.created_at).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    })

    const doc  = await PDFDocument.create()
    const reg  = await doc.embedFont(StandardFonts.Helvetica)
    const bold = await doc.embedFont(StandardFonts.HelveticaBold)

    let pageNum = 0

    const drawFooter = (page: PDFPage, num: number, dark = false) => {
      const lineColor = dark ? rgb(0.22, 0.27, 0.38) : LGRAY
      const textColor = dark ? rgb(0.35, 0.38, 0.45) : GRAY
      page.drawLine({
        start: { x: M, y: FOOTER_Y + 12 },
        end:   { x: PW - M, y: FOOTER_Y + 12 },
        thickness: 0.3,
        color: lineColor,
      })
      const txt = `Accession Partners LLC  |  Confidential  |  ${runDate}  |  Not investment advice`
      page.drawText(txt, { x: M, y: FOOTER_Y, size: 6.5, font: reg, color: textColor })
      const nStr = `${num}`
      const nW   = reg.widthOfTextAtSize(nStr, 6.5)
      page.drawText(nStr, { x: PW - M - nW, y: FOOTER_Y, size: 6.5, font: reg, color: textColor })
    }

    const contentPage = (title: string): { page: PDFPage; y: number } => {
      pageNum++
      const page = doc.addPage([PW, PH])
      page.drawRectangle({ x: 0, y: 0, width: PW, height: PH, color: WHITE })
      page.drawRectangle({ x: 0, y: PH - 36, width: PW, height: 36, color: NAVY })
      page.drawText('ACCESSION PARTNERS', { x: M, y: PH - 23, size: 7, font: bold, color: GOLD })
      const tw = bold.widthOfTextAtSize(title, 8)
      page.drawText(title, { x: PW - M - tw, y: PH - 23, size: 8, font: bold, color: WHITE })
      page.drawRectangle({ x: 0, y: PH - 37, width: PW, height: 1, color: GOLD })
      drawFooter(page, pageNum)
      return { page, y: PH - 36 - 18 }
    }

    // ── Cover ────────────────────────────────────────────────────
    pageNum++
    const cover = doc.addPage([PW, PH])
    cover.drawRectangle({ x: 0, y: 0, width: PW, height: PH, color: NAVY })
    cover.drawRectangle({ x: 0, y: PH - 5, width: PW, height: 5, color: GOLD })
    cover.drawRectangle({ x: 0, y: 0,      width: PW, height: 4, color: GOLD })

    cover.drawText('ACCESSION PARTNERS', { x: M, y: PH - M - 8, size: 11, font: bold, color: GOLD })
    cover.drawLine({
      start: { x: M,      y: PH - M - 22 },
      end:   { x: PW - M, y: PH - M - 22 },
      thickness: 0.5,
      color: rgb(0.20, 0.28, 0.44),
    })

    const nameY = PH / 2 + 55
    const baseSize = 30
    let displayName = fundName
    while (displayName.length > 3 && bold.widthOfTextAtSize(displayName, baseSize) > PW - 2 * M) {
      displayName = displayName.slice(0, -1)
    }
    if (displayName !== fundName) displayName += '...'
    cover.drawText(displayName, { x: M, y: nameY, size: baseSize, font: bold, color: WHITE })

    const meta = [manager, strategy].filter(Boolean).join('  |  ')
    if (meta) {
      cover.drawText(meta, {
        x: M, y: nameY - baseSize - 10,
        size: 10, font: reg, color: rgb(0.62, 0.69, 0.80),
      })
    }
    cover.drawText(`Analysis Date: ${runDate}`, {
      x: M, y: nameY - baseSize - 30,
      size: 9, font: reg, color: rgb(0.45, 0.52, 0.62),
    })

    const confTxt = 'C O N F I D E N T I A L'
    const confW   = bold.widthOfTextAtSize(confTxt, 8)
    cover.drawText(confTxt, {
      x: (PW - confW) / 2, y: M + 28,
      size: 8, font: bold, color: GOLD,
    })

    drawFooter(cover, 1, true)

    // ── Fund Snapshot ────────────────────────────────────────────
    if (snap) {
      const { page, y: sy } = contentPage('FUND SNAPSHOT')

      const fields: [string, string][] = [
        ['FUND NAME',         snap.fund_name ?? fundName],
        ['MANAGER',           snap.manager ?? manager ?? '-'],
        ['STRATEGY',          snap.strategy_label ?? strategy ?? '-'],
        ['STRUCTURE',         snap.structure ?? '-'],
        ['INCEPTION DATE',    snap.inception_date ?? '-'],
        ['FUND SIZE',         fmtM(snap.fund_size_m)],
        ['NAV / SHARE',       snap.nav_per_share != null ? `$${snap.nav_per_share.toFixed(2)}` : '-'],
        ['DISTRIBUTION RATE', fmtPct(snap.distribution_rate_annualized_pct)],
        ['MANAGEMENT FEE',    fmtPct(snap.management_fee_pct)],
        ['PERFORMANCE FEE',   fmtPct(snap.performance_fee_pct)],
        ['HURDLE RATE',       fmtPct(snap.hurdle_rate_pct)],
        ['MIN INVESTMENT',    fmtDollars(snap.minimum_investment)],
        ['LIQUIDITY TERMS',   snap.liquidity_terms ?? '-'],
        ['LEVERAGE TARGET',   snap.leverage_target ?? '-'],
      ]

      const cols = 3
      const cw   = Math.floor((PW - 2 * M - (cols - 1) * 2) / cols)
      const rh   = 52

      fields.forEach(([label, raw], i) => {
        const col = i % cols
        const row = Math.floor(i / cols)
        const x   = M + col * (cw + 2)
        const cy  = sy - row * rh

        const bgColor = row % 2 === 0 ? rgb(0.97, 0.97, 0.97) : rgb(0.99, 0.99, 0.99)
        page.drawRectangle({ x, y: cy - rh + 4, width: cw - 1, height: rh - 5, color: bgColor })
        page.drawText(label, { x: x + 8, y: cy - 16, size: 6.5, font: bold, color: GRAY })

        const maxW = cw - 22
        let val = raw
        while (val.length > 1 && reg.widthOfTextAtSize(val, 13) > maxW) val = val.slice(0, -1)
        if (val !== raw) val += '...'
        page.drawText(val, { x: x + 8, y: cy - 36, size: 13, font: reg, color: DARK })
      })
    }

    // ── Performance ──────────────────────────────────────────────
    if (perf) {
      const { page, y: sy } = contentPage('PERFORMANCE')

      const benchName = perf.benchmark_name ?? 'BENCHMARK'
      const periods   = ['YTD', '1 Year', '3 Year', '5 Year', 'Since Inception']
      const fundVals  = [perf.ytd_pct, perf.one_year_pct, perf.three_year_pct, perf.five_year_pct, perf.since_inception_pct]
      const benchVals = [perf.benchmark_ytd_pct, perf.benchmark_one_year_pct, perf.benchmark_three_year_pct, null, perf.benchmark_since_inception_pct]

      const colWidths = [180, 150, 150, 120]
      const tableW    = colWidths.reduce((a, b) => a + b, 0)
      let ty = sy - 10
      const rh = 32

      page.drawRectangle({ x: M, y: ty - rh, width: tableW, height: rh, color: NAVY })
      const headers = ['PERIOD', 'FUND RETURN', benchName.toUpperCase().slice(0, 20), 'SPREAD']
      let cx = M
      headers.forEach((h, i) => {
        page.drawText(h, { x: cx + 8, y: ty - rh + 10, size: 7.5, font: bold, color: WHITE })
        cx += colWidths[i]
      })
      ty -= rh

      periods.forEach((period, i) => {
        const fv = fundVals[i]
        const bv = benchVals[i]
        const sp = fv != null && bv != null ? fv - bv : null

        page.drawRectangle({ x: M, y: ty - rh, width: tableW, height: rh, color: i % 2 === 0 ? rgb(0.97, 0.97, 0.97) : WHITE })

        cx = M
        page.drawText(period, { x: cx + 8, y: ty - rh + 10, size: 10, font: reg, color: DARK })
        cx += colWidths[0]

        const fvStr = fmtPct(fv)
        const fvCol = fv == null ? GRAY : fv >= 0 ? GREEN : RED
        page.drawText(fvStr, { x: cx + 8, y: ty - rh + 10, size: 10, font: bold, color: fvCol })
        cx += colWidths[1]

        page.drawText(fmtPct(bv), { x: cx + 8, y: ty - rh + 10, size: 10, font: reg, color: GRAY })
        cx += colWidths[2]

        const spStr = sp != null ? `${sp >= 0 ? '+' : ''}${fmtPct(sp)}` : '-'
        const spCol = sp == null ? GRAY : sp >= 0 ? GREEN : RED
        page.drawText(spStr, { x: cx + 8, y: ty - rh + 10, size: 10, font: reg, color: spCol })

        ty -= rh
      })

      if (perf.as_of_date) {
        page.drawText(
          `As of ${perf.as_of_date}. Past performance is not indicative of future results.`,
          { x: M, y: ty - 20, size: 7.5, font: reg, color: GRAY },
        )
      }
    }

    // ── Credit Metrics ───────────────────────────────────────────
    if (metrics) {
      const { page, y: sy } = contentPage('CREDIT QUALITY METRICS')

      const fields: [string, string][] = [
        ['WTD AVG YIELD',      fmtPct(metrics.weighted_avg_yield_pct)],
        ['PIK %',              fmtPct(metrics.pik_pct)],
        ['BSL / CLO EXPOSURE', fmtPct(metrics.bsl_clo_exposure_pct)],
        ['SENIOR SECURED',     fmtPct(metrics.senior_secured_pct)],
        ['FLOATING RATE',      fmtPct(metrics.floating_rate_pct)],
        ['AVG EBITDA',         fmtM(metrics.avg_ebitda_m)],
        ['INTEREST COVERAGE',  fmtX(metrics.interest_coverage_ratio)],
        ['FIXED CHARGE RATIO', fmtX(metrics.fixed_charge_ratio)],
        ['LTV',                fmtPct(metrics.ltv_pct)],
        ['DEPLOYED',           fmtPct(metrics.deployed_pct)],
        ['NON-ACCRUAL',        fmtPct(metrics.non_accrual_pct)],
        ['PORTFOLIO COS.',     metrics.number_of_portfolio_companies?.toString() ?? '-'],
        ['AVG LOAN SIZE',      fmtM(metrics.avg_loan_size_m)],
        ['NET LEVERAGE',       fmtX(metrics.net_leverage_turns, 1)],
      ]

      const cols = 4
      const cw   = Math.floor((PW - 2 * M - (cols - 1) * 3) / cols)
      const rh   = 50

      fields.forEach(([label, value], i) => {
        const col = i % cols
        const row = Math.floor(i / cols)
        const x   = M + col * (cw + 3)
        const cy  = sy - row * rh

        page.drawRectangle({ x, y: cy - rh + 4, width: cw, height: rh - 5, color: rgb(0.97, 0.97, 0.97) })
        page.drawRectangle({ x, y: cy - rh + 4, width: 2,  height: rh - 5, color: GOLD })
        page.drawText(label, { x: x + 8, y: cy - 16, size: 6.5, font: bold, color: GRAY })
        page.drawText(value, { x: x + 8, y: cy - 36, size: 15, font: bold, color: NAVY })
      })
    }

    // ── Merits & Risks ───────────────────────────────────────────
    if (report) {
      const { page, y: sy } = contentPage('MERITS & RISKS')

      const cw    = Math.floor((PW - 2 * M - 12) / 2)
      const lx    = M
      const rx    = M + cw + 12
      const areaH = sy - CONTENT_BOTTOM

      page.drawRectangle({ x: lx, y: CONTENT_BOTTOM, width: cw, height: areaH, color: rgb(0.97, 1.0, 0.97) })
      page.drawRectangle({ x: lx, y: sy - 20,         width: cw, height: 20,    color: rgb(0.10, 0.42, 0.10) })
      page.drawText('KEY STRENGTHS', { x: lx + 10, y: sy - 14, size: 7.5, font: bold, color: WHITE })

      let by = sy - 32
      for (const merit of report.merits ?? []) {
        const lines = wrapText(merit, reg, 8.5, cw - 28)
        if (by - lines.length * 13 < CONTENT_BOTTOM) break
        page.drawText('+', { x: lx + 10, y: by, size: 9, font: bold, color: GREEN })
        for (const ln of lines) {
          page.drawText(ln, { x: lx + 22, y: by, size: 8.5, font: reg, color: DARK })
          by -= 13
        }
        by -= 8
      }

      page.drawRectangle({ x: rx, y: CONTENT_BOTTOM, width: cw, height: areaH, color: rgb(1.0, 0.99, 0.97) })
      page.drawRectangle({ x: rx, y: sy - 20,         width: cw, height: 20,    color: rgb(0.28, 0.18, 0.00) })
      page.drawText('KEY RISKS', { x: rx + 10, y: sy - 14, size: 7.5, font: bold, color: GOLD })

      by = sy - 32
      for (const risk of report.risks ?? []) {
        const lines = wrapText(risk, reg, 8.5, cw - 28)
        if (by - lines.length * 13 < CONTENT_BOTTOM) break
        page.drawText('!', { x: rx + 10, y: by, size: 9, font: bold, color: GOLD })
        for (const ln of lines) {
          page.drawText(ln, { x: rx + 22, y: by, size: 8.5, font: reg, color: DARK })
          by -= 13
        }
        by -= 8
      }
    }

    // ── Written Analysis ─────────────────────────────────────────
    if (sections) {
      const written: { title: string; key: keyof ReportSections }[] = [
        { title: 'Fund Overview',        key: 'fund_overview' },
        { title: 'Investment Strategy',  key: 'investment_strategy' },
        { title: 'Portfolio Analysis',   key: 'portfolio_analysis' },
        { title: 'Performance Analysis', key: 'performance_analysis' },
        { title: 'Risk Analysis',        key: 'risk_analysis' },
        { title: 'Fee Analysis',         key: 'fee_analysis' },
        { title: 'Conclusion',           key: 'conclusion' },
      ]

      for (const { title, key } of written) {
        const text = sections[key]
        if (!text) continue

        const allLines = wrapText(text, reg, 9.5, PW - 2 * M)
        let { page: curPage, y: curY } = contentPage(title.toUpperCase())
        curY -= 8

        for (const line of allLines) {
          if (curY <= CONTENT_BOTTOM) {
            const next = contentPage(`${title.toUpperCase()} (CONT.)`)
            curPage = next.page
            curY    = next.y - 8
          }
          if (line) {
            curPage.drawText(line, { x: M, y: curY, size: 9.5, font: reg, color: DARK })
          }
          curY -= line ? 14 : 7
        }
      }
    }

    // ── Data Quality ─────────────────────────────────────────────
    if (quality) {
      const { page, y: sy } = contentPage('DATA QUALITY')

      page.drawText('DATA COMPLETENESS', { x: M, y: sy - 10, size: 8, font: bold, color: GRAY })
      page.drawText(`${quality.completeness_pct.toFixed(0)}%`, {
        x: M, y: sy - 65, size: 52, font: bold, color: NAVY,
      })

      const barW = 320
      const barY = sy - 80
      page.drawRectangle({ x: M, y: barY, width: barW, height: 8, color: rgb(0.90, 0.90, 0.90) })
      page.drawRectangle({
        x: M, y: barY,
        width: barW * Math.min(1, quality.completeness_pct / 100),
        height: 8,
        color: GOLD,
      })

      if (quality.null_fields?.length > 0) {
        page.drawText('MISSING FIELDS', { x: M, y: barY - 24, size: 8, font: bold, color: GRAY })
        let fx = M
        let fy = barY - 44
        for (const field of quality.null_fields) {
          const tagW = reg.widthOfTextAtSize(field, 8) + 16
          if (fx + tagW > PW - M) { fx = M; fy -= 24 }
          if (fy < CONTENT_BOTTOM) break
          page.drawRectangle({ x: fx, y: fy - 4, width: tagW, height: 18, color: rgb(0.92, 0.92, 0.92) })
          page.drawText(field, { x: fx + 8, y: fy + 1, size: 8, font: reg, color: GRAY })
          fx += tagW + 6
        }
      }
    }

    const pdfBytes = await doc.save()
    const safeName = fundName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeName}-report.pdf"`,
      },
    })
  } catch (err) {
    console.error('[export-pdf]', err)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
