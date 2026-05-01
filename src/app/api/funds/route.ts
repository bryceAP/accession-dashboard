import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('funds')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const { name, manager, strategy, ticker, isin } = await request.json()

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Fund name is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('funds')
    .insert({ name: name.trim(), manager: manager || null, strategy: strategy || null, ticker: ticker || null, isin: isin || null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
