import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  htm: 'text/html',
  html: 'text/html',
}

const ALLOWED_EXTENSIONS = new Set(['pdf', 'xlsx', 'docx', 'htm', 'html'])

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const fundId = formData.get('fund_id') as string | null
  const documentType = (formData.get('document_type') as string) || 'Other'

  if (!file || !fundId) {
    return NextResponse.json({ error: 'file and fund_id are required' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json({ error: 'Only PDF, XLSX, and DOCX files are allowed' }, { status: 400 })
  }

  const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream'
  const storagePath = `${fundId}/${Date.now()}-${file.name}`
  const bytes = await file.arrayBuffer()

  const { error: uploadError } = await supabase.storage
    .from('fund-documents')
    .upload(storagePath, bytes, { contentType, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data, error } = await supabase
    .from('fund_documents')
    .insert({
      fund_id: fundId,
      file_name: file.name,
      document_type: documentType,
      file_path: storagePath,
      file_size: file.size,
    })
    .select()
    .single()

  if (error) {
    await supabase.storage.from('fund-documents').remove([storagePath])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
