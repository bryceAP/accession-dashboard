import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const { fund_id, file_name, file_size, document_type } = await request.json()

    if (!fund_id || !file_name) {
      return NextResponse.json({ error: 'fund_id and file_name are required' }, { status: 400 })
    }

    const path = `${fund_id}/${Date.now()}-${file_name}`

    const { data, error } = await supabase.storage
      .from('fund-documents')
      .createSignedUploadUrl(path)

    if (error) {
      console.error('upload-url supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ signedUrl: data.signedUrl, path, token: data.token })
  } catch (err) {
    console.error('upload-url unexpected error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to create upload URL' }, { status: 500 })
  }
}
