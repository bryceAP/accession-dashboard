import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateFundReport } from '@/lib/anthropic/generate'
import { compareRuns } from '@/lib/compareRuns'
import type { FundReport } from '@/types'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse: (buffer: Buffer) => Promise<{ text: string }> = require('pdf-parse/lib/pdf-parse')

export const maxDuration = 300

function trimToRelevantSections(text: string, fileName: string): string {
  const lower = text.toLowerCase()
  const parts: string[] = []

  const addSection = (marker: string, maxLen: number) => {
    const idx = lower.indexOf(marker.toLowerCase())
    if (idx !== -1) {
      parts.push(`\n\n--- SECTION: ${marker.toUpperCase()} ---\n` + text.substring(idx, idx + maxLen))
    }
  }

  const addAllOccurrences = (keyword: string, surrounding: number) => {
    let start = 0
    while (true) {
      const idx = lower.indexOf(keyword.toLowerCase(), start)
      if (idx === -1) break
      const from = Math.max(0, idx - surrounding / 2)
      const to = Math.min(text.length, idx + surrounding / 2)
      parts.push(`\n\n--- OCCURRENCE: ${keyword.toUpperCase()} ---\n` + text.substring(from, to))
      start = idx + 1
    }
  }

  addSection('Letter to Shareholders', 5000)
  addSection('Statement of Assets and Liabilities', 3000)
  addSection('Statement of Operations', 3000)
  addSection('Financial Highlights', 3000)
  addSection('Portfolio Characteristics', 3000)
  addSection('Portfolio Statistics', 3000)
  addSection('Notes to Financial Statements', 5000)

  addAllOccurrences('non-accrual', 2000)
  addAllOccurrences('PIK', 2000)
  addAllOccurrences('payment-in-kind', 2000)
  addAllOccurrences('floating rate', 1000)
  addAllOccurrences('interest coverage', 1000)

  parts.push('\n\n--- TAIL: LAST 10000 CHARS ---\n' + text.substring(text.length - 10000))

  const trimmed = parts.join('')
  console.log(`[runs] Trimmed ${fileName} from ${text.length} to ${trimmed.length} characters`)
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
