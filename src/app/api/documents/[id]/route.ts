import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const { data: doc, error: fetchError } = await supabase
    .from('fund_documents')
    .select('storage_path')
    .eq('id', params.id)
    .single()

  if (fetchError || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  await supabase.storage.from('fund-documents').remove([doc.storage_path])

  const { error } = await supabase
    .from('fund_documents')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
