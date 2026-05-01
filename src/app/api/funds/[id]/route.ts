import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

type Ctx = { params: { id: string } }

export async function GET(_req: Request, { params }: Ctx) {
  const { data, error } = await supabase
    .from('funds')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { name, manager, strategy, ticker, isin } = await request.json()

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Fund name is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('funds')
    .update({ name: name.trim(), manager: manager || null, strategy: strategy || null, ticker: ticker || null, isin: isin || null })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { error } = await supabase
    .from('funds')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
