import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'

export const maxDuration = 120

const client = new Anthropic()

const SYSTEM_PROMPT = `You are an expert investment research analyst at Accession Partners, an independent investment advisory firm. Generate professional, structured investment research reports based on the provided documents and context. Include executive summary, key findings, risk assessment, and recommendations.

Structure every report with these clearly labeled sections using ## markdown headers:

## Executive Summary
A concise 2-3 paragraph overview of the investment thesis, key conclusions, and overall recommendation.

## Key Findings
Detailed analysis points organized as sub-sections or bullet points. Cover financial performance, business model, competitive positioning, market opportunity, and management quality where applicable.

## Risk Assessment
Identify and analyze key risks: business risks, market risks, financial risks, regulatory risks, and macro risks. For each risk, assess severity and any mitigating factors.

## Recommendations
Specific, actionable investment recommendations with supporting rationale. Include suggested position sizing considerations and key metrics to monitor.

Maintain a professional, objective, data-driven tone throughout. Support all claims with specific evidence from the provided materials. When quantitative data is available, cite it precisely.`

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
  const { fund_id, document_ids, context } = await request.json()
  if (!fund_id) return NextResponse.json({ error: 'fund_id required' }, { status: 400 })

  // Create pending run record immediately
  const { data: run, error: runCreateError } = await supabase
    .from('dashboard_runs')
    .insert({ fund_id, status: 'running' })
    .select()
    .single()

  if (runCreateError) return NextResponse.json({ error: runCreateError.message }, { status: 500 })

  try {
    // Fetch fund metadata for context
    const { data: fund } = await supabase
      .from('funds')
      .select('name, manager, strategy')
      .eq('id', fund_id)
      .single()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userContent: any[] = []

    // Fetch and attach selected documents
    if (Array.isArray(document_ids) && document_ids.length > 0) {
      const { data: docs } = await supabase
        .from('fund_documents')
        .select('file_name, storage_path, document_type')
        .in('id', document_ids)

      for (const doc of docs ?? []) {
        const { data: fileData } = await supabase.storage
          .from('fund-documents')
          .download(doc.storage_path)

        if (fileData) {
          const bytes = await fileData.arrayBuffer()
          userContent.push({
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: Buffer.from(bytes).toString('base64') },
            title: `${doc.document_type}: ${doc.file_name}`,
          })
        }
      }
    }

    // Build context text
    const fundMeta = fund
      ? `Fund: ${fund.name}${fund.manager ? ` | Manager: ${fund.manager}` : ''}${fund.strategy ? ` | Strategy: ${fund.strategy}` : ''}`
      : ''
    userContent.push({
      type: 'text',
      text: [fundMeta, context?.trim() || 'Generate a comprehensive investment research report for this fund.']
        .filter(Boolean)
        .join('\n\n'),
    })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    })

    const reportText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')

    // Save completed run
    const { data: completedRun, error: updateError } = await supabase
      .from('dashboard_runs')
      .update({
        status: 'complete',
        report_text: reportText,
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      })
      .eq('id', run.id)
      .select()
      .single()

    if (updateError) throw updateError

    // Update fund status and last_run_at
    await supabase
      .from('funds')
      .update({ status: 'complete', last_run_at: new Date().toISOString() })
      .eq('id', fund_id)

    return NextResponse.json(completedRun)
  } catch (err) {
    await supabase.from('dashboard_runs').update({ status: 'error' }).eq('id', run.id)
    await supabase.from('funds').update({ status: 'error' }).eq('id', fund_id)

    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Analysis failed' },
      { status: 500 }
    )
  }
}
