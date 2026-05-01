import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const { data, error } = await supabase
    .from('dashboard_runs')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Run not found' }, { status: 404 })

  return NextResponse.json(data)
}
