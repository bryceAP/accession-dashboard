import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const STALE_MS = 90_000

export async function GET() {
  const { data, error } = await supabase
    .from('paper_status')
    .select('*')
    .eq('id', 1)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!data) {
    return NextResponse.json({
      row: null,
      is_stale: true,
      ms_since_heartbeat: null,
    })
  }

  const hbMs = data.last_heartbeat ? Date.parse(data.last_heartbeat) : NaN
  const ms_since_heartbeat = Number.isFinite(hbMs) ? Date.now() - hbMs : null
  const is_stale = ms_since_heartbeat === null || ms_since_heartbeat > STALE_MS

  return NextResponse.json({ row: data, is_stale, ms_since_heartbeat })
}
