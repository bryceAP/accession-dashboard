import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  const fundId = new URL(request.url).searchParams.get('fund_id')
  if (!fundId) return NextResponse.json({ error: 'fund_id required' }, { status: 400 })

  try {
    const { data, error } = await supabase
      .from('fund_documents')
      .select('*')
      .eq('fund_id', fundId)
      .order('uploaded_at', { ascending: false })

    if (error) {
      console.error('GET /api/documents supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('GET /api/documents unexpected error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to fetch documents' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const fundId = formData.get('fund_id') as string | null
  const documentType = (formData.get('document_type') as string) || 'Other'

  if (!file || !fundId) {
    return NextResponse.json({ error: 'file and fund_id are required' }, { status: 400 })
  }

  const storagePath = `${fundId}/${Date.now()}-${file.name}`
  const bytes = await file.arrayBuffer()

  const fileExt = file.name.split('.').pop()?.toLowerCase() ?? ''
  const contentTypeMap: Record<string, string> = {
    pdf: 'application/pdf',
    htm: 'text/html',
    html: 'text/html',
  }
  const contentType = contentTypeMap[fileExt] ?? file.type ?? 'application/octet-stream'

  const { error: uploadError } = await supabase.storage
    .from('fund-documents')
    .upload(storagePath, bytes, { contentType, upsert: false })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data, error } = await supabase
    .from('fund_documents')
    .insert({ fund_id: fundId, file_name: file.name, document_type: documentType, file_path: storagePath, file_size: file.size })
    .select()
    .single()

  if (error) {
    await supabase.storage.from('fund-documents').remove([storagePath])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
