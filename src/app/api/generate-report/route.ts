import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

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

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const prompt = (formData.get('prompt') as string | null)?.trim() || ''

    if (!file && !prompt) {
      return NextResponse.json(
        { error: 'Please provide a PDF document and/or a text prompt.' },
        { status: 400 }
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userContent: any[] = []

    if (file && file.size > 0) {
      const bytes = await file.arrayBuffer()
      const base64 = Buffer.from(bytes).toString('base64')
      userContent.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: base64,
        },
      })
    }

    userContent.push({
      type: 'text',
      text: prompt ||
        'Please analyze the provided document and generate a comprehensive investment research report.',
    })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userContent as Anthropic.MessageParam['content'],
        },
      ],
    })

    const reportText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')

    return NextResponse.json({
      report: reportText,
      usage: response.usage,
    })
  } catch (error) {
    console.error('Report generation error:', error)
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status ?? 500 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to generate report. Please try again.' },
      { status: 500 }
    )
  }
}
