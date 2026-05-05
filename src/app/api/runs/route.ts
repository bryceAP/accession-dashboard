import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateFundReport } from '@/lib/anthropic/generate'
import { compareRuns } from '@/lib/compareRuns'
import type { FundReport } from '@/types'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse: (buffer: Buffer) => Promise<{ text: string }> = require('pdf-parse/lib/pdf-parse')

export const maxDuration = 300

const HARD_CAP = 80_000

function trimToRelevantSections(text: string, fileName: string): string {
  const lower = text.toLowerCase()
  const foundSections: string[] = []
  const parts: string[] = []

  // Returns the index of the first matching marker, or -1
  const findFirst = (markers: string[]): { idx: number; marker: string } => {
    let best = { idx: -1, marker: '' }
    for (const marker of markers) {
      const idx = lower.indexOf(marker.toLowerCase())
      if (idx !== -1 && (best.idx === -1 || idx < best.idx)) {
        best = { idx, marker }
      }
    }
    return best
  }

  const addFirst = (label: string, markers: string[], windowLen: number) => {
    const { idx, marker } = findFirst(markers)
    if (idx !== -1) {
      foundSections.push(label)
      parts.push(`\n\n=== ${label} (matched: "${marker}") ===\n` + text.substring(idx, idx + windowLen))
    }
  }

  const addAllOccurrences = (label: string, markers: string[], windowLen: number, maxOccurrences: number) => {
    let found = 0
    let start = 0
    while (found < maxOccurrences) {
      let earliest = -1
      let earliestMarker = ''
      for (const marker of markers) {
        const idx = lower.indexOf(marker.toLowerCase(), start)
        if (idx !== -1 && (earliest === -1 || idx < earliest)) {
          earliest = idx
          earliestMarker = marker
        }
      }
      if (earliest === -1) break
      if (found === 0) foundSections.push(label)
      const half = Math.floor(windowLen / 2)
      const from = Math.max(0, earliest - half)
      const to = Math.min(text.length, earliest + half)
      parts.push(`\n\n=== ${label} [${found + 1}] (matched: "${earliestMarker}") ===\n` + text.substring(from, to))
      start = earliest + 1
      found++
    }
  }

  // 1. Letter to Shareholders
  addFirst('LETTER TO SHAREHOLDERS', ['Letter to Shareholders'], 4000)

  // 2. Financial Highlights
  addFirst('FINANCIAL HIGHLIGHTS', ['Financial Highlights'], 8000)

  // 3. Statement of Assets and Liabilities
  addFirst('STATEMENT OF ASSETS AND LIABILITIES', ['Statement of Assets and Liabilities', 'Consolidated Statement of Assets'], 5000)

  // 4. Statement of Operations
  addFirst('STATEMENT OF OPERATIONS', ['Statement of Operations', 'Consolidated Statement of Operations'], 4000)

  // 5. Interest Rate Risk
  addFirst('INTEREST RATE RISK', ['Interest Rate Risk', 'interest rate risk'], 3000)

  // 6. Non-accrual occurrences
  addAllOccurrences('NON-ACCRUAL', ['non-accrual', 'non-earning'], 2000, 4)

  // 7. PIK income occurrences
  addAllOccurrences('PIK INCOME', ['payment-in-kind', 'PIK interest', 'PIK income'], 1500, 5)

  // 8. Portfolio statistics / quality
  addFirst('PORTFOLIO STATISTICS', ['Portfolio Statistics', 'Portfolio Characteristics', 'Portfolio Quality'], 4000)

  // 9. Credit quality / rating
  addFirst('CREDIT QUALITY', ['Credit Quality', 'Credit Rating', 'Rating Distribution'], 3000)

  // 10. Geographic breakdown
  addFirst('GEOGRAPHIC BREAKDOWN', ['Geographic', 'Country', 'Region'], 2000)

  // 11. Leverage and borrowings
  addFirst('LEVERAGE AND BORROWINGS', ['Leverage', 'Borrowings', 'Senior Notes', 'Credit Facility'], 3000)

  // 12. Distributions table
  addFirst('DISTRIBUTIONS', ['Distributions', 'distributions declared', 'distributions per share'], 3000)

  // 13. NAV per share history
  addFirst('NAV PER SHARE HISTORY', ['net asset value per share', 'NAV per share'], 2000)

  // 14. Tail
  foundSections.push('DOCUMENT TAIL')
  parts.push('\n\n=== DOCUMENT TAIL (last 5000 chars) ===\n' + text.substring(text.length - 5000))

  const combined = parts.join('')
  const trimmed = combined.length > HARD_CAP ? combined.substring(0, HARD_CAP) : combined
  console.log(`[runs] ${fileName}: ${text.length} chars → ${trimmed.length} chars. Sections found: ${foundSections.join(', ')}`)
  return trimmed
}

export async function GET(request: Request) {
  const fundId = new URL(request.url).searchParams.get('fund_id')
  if (!fundId) return NextResponse.json({ error: 'fund_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('dashboard_runs')
    .select('*')
    .eq('fund_id', fundId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const { fund_id, document_ids, context, prior_run_id } = await request.json()
  if (!fund_id) return NextResponse.json({ error: 'fund_id required' }, { status: 400 })

  const { data: run, error: runCreateError } = await supabase
    .from('dashboard_runs')
    .insert({ fund_id, status: 'pending', prior_run_id: prior_run_id ?? null })
    .select()
    .single()

  if (runCreateError) return NextResponse.json({ error: runCreateError.message }, { status: 500 })

  try {
    await supabase.from('dashboard_runs').update({ status: 'running' }).eq('id', run.id)

    const { data: fund } = await supabase
      .from('funds')
      .select('name, manager')
      .eq('id', fund_id)
      .single()

    const documents: Array<
      { type: 'pdf'; base64: string; filename: string } |
      { type: 'text'; text: string; filename: string }
    > = []

    const TEN_MB = 10 * 1024 * 1024

    if (Array.isArray(document_ids) && document_ids.length > 0) {
      const { data: docs } = await supabase
        .from('fund_documents')
        .select('file_name, file_path, document_type')
        .in('id', document_ids)

      for (const doc of docs ?? []) {
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('fund-documents')
          .download(doc.file_path)

        if (downloadError) {
          console.error(`Storage download failed for ${doc.file_path}:`, downloadError)
        }

        if (fileData) {
          const bytes = await fileData.arrayBuffer()
          const buffer = Buffer.from(bytes)
          const filename = `${doc.document_type}: ${doc.file_name}`

          if (buffer.byteLength <= TEN_MB) {
            documents.push({ type: 'pdf', base64: buffer.toString('base64'), filename })
          } else {
            const parsed = await pdfParse(buffer)
            const extractedText = parsed.text
            console.log(`[runs] Total extracted text length for ${doc.file_name}: ${extractedText.length} characters`)
            console.log(`[runs] Extracted text from ${doc.file_name} (first 2000 chars):`, extractedText.substring(0, 2000))

            const finalText = extractedText.length > 100_000
              ? trimToRelevantSections(extractedText, doc.file_name)
              : extractedText

            documents.push({ type: 'text', text: finalText, filename })
          }
        }
      }
    }

    const report = await generateFundReport({
      fund_name: fund?.name ?? 'Unknown Fund',
      manager: fund?.manager,
      documents,
    })

    // Build report_text for the fund-page preview
    const contextNote = context?.trim() ? `Context: ${context.trim()}\n\n` : ''
    const reportText = contextNote + [
      report.report_sections.fund_overview,
      report.report_sections.investment_strategy,
      report.report_sections.portfolio_analysis,
      report.report_sections.performance_analysis,
      report.report_sections.risk_analysis,
      report.report_sections.fee_analysis,
      report.report_sections.conclusion,
    ].filter(Boolean).join('\n\n')

    // Change detection
    let keyChanges = null
    if (prior_run_id) {
      const { data: priorRun } = await supabase
        .from('dashboard_runs')
        .select('structured_data, created_at')
        .eq('id', prior_run_id)
        .single()

      if (priorRun?.structured_data) {
        keyChanges = {
          ...compareRuns(priorRun.structured_data as FundReport, report),
          prior_run_date: priorRun.created_at as string,
        }
      }
    }

    const updatePayload: Record<string, unknown> = {
      status: 'complete',
      report_text: reportText,
      structured_data: report,
    }
    if (keyChanges !== null) updatePayload.key_changes = keyChanges

    const { data: completedRun, error: updateError } = await supabase
      .from('dashboard_runs')
      .update(updatePayload)
      .eq('id', run.id)
      .select()
      .single()

    if (updateError) throw updateError

    await supabase
      .from('funds')
      .update({ status: 'complete', last_run_at: new Date().toISOString() })
      .eq('id', fund_id)

    return NextResponse.json(completedRun)
  } catch (err) {
    console.error('POST /api/runs failed:', err)

    await supabase.from('dashboard_runs').update({ status: 'error' }).eq('id', run.id)
    await supabase.from('funds').update({ status: 'error' }).eq('id', fund_id)

    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Analysis failed' },
      { status: 500 }
    )
  }
}
