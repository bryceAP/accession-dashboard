import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const { fund_id, file_name, file_path, document_type, file_size } = await request.json()

    if (!fund_id || !file_name || !file_path) {
      return NextResponse.json({ error: 'fund_id, file_name, and file_path are required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('fund_documents')
      .insert({ fund_id, file_name, document_type: document_type ?? 'Other', file_path, file_size: file_size ?? null })
      .select()
      .single()

    if (error) {
      console.error('upload-complete supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('upload-complete unexpected error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to record upload' }, { status: 500 })
  }
}
