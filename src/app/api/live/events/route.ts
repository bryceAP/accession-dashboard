import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limitRaw = Number(searchParams.get('limit') ?? '50')
  const limit = Math.max(1, Math.min(500, Number.isFinite(limitRaw) ? limitRaw : 50))

  const { data, error } = await supabase
    .from('events')
    .select('id, ts, event_type, source, data')
    .eq('source', 'paper')
    .order('ts', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
