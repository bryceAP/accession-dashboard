'use client'

import { useEffect, useState } from 'react'
import { JetBrains_Mono } from 'next/font/google'
import { format } from 'date-fns'

const mono = JetBrains_Mono({ subsets: ['latin'] })

interface Doc {
  id: string
  fund_id: string
  file_name: string
  document_type: string
  created_at: string
  funds?: { name: string }
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/all-documents')
      .then(r => r.json())
      .then(data => { setDocs(data.documents ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function deleteDoc(id: string) {
    if (!confirm('Delete this document?')) return
    await fetch(`/api/documents/${id}`, { method: 'DELETE' })
    setDocs(prev => prev.filter(d => d.id !== id))
  }

  return (
    <div className={`${mono.className} flex flex-col min-h-screen`}>
      <div className="flex items-center px-8 py-5 border-b border-[#2a2a2a] flex-shrink-0">
        <span className="text-[#E8E0D0] text-xs tracking-widest">DOCUMENTS</span>
      </div>

      <div className="flex-1 px-8 py-8">
        {loading ? (
          <p className="text-[#444444] text-xs tracking-widest">LOADING...</p>
        ) : docs.length === 0 ? (
          <div className="border border-[#1e1e1e] px-6 py-10 text-center">
            <p className="text-[#333333] text-xs tracking-widest mb-2">NO DOCUMENTS</p>
            <p className="text-[#2a2a2a] text-xs">Upload PDFs on a fund page to get started.</p>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                {['FILE NAME', 'FUND', 'TYPE', 'UPLOADED', 'ACTIONS'].map(h => (
                  <th key={h} className="text-left text-[#444444] text-xs tracking-widest pb-3 pr-6 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {docs.map(doc => (
                <tr key={doc.id} className="border-b border-[#1a1a1a] hover:bg-[#131313] transition-colors">
                  <td className="text-[#E8E0D0] text-xs py-3.5 pr-6 max-w-[280px] truncate">{doc.file_name}</td>
                  <td className="text-[#777777] text-xs py-3.5 pr-6">{doc.funds?.name ?? '—'}</td>
                  <td className="text-[#777777] text-xs py-3.5 pr-6 whitespace-nowrap">{doc.document_type || '—'}</td>
                  <td className="text-[#555555] text-xs py-3.5 pr-6 whitespace-nowrap">
                    {(() => { const d = new Date(doc.created_at); return isNaN(d.getTime()) ? '—' : format(d, 'MMM d, yyyy') })()}
                  </td>
                  <td className="py-3.5">
                    <button
                      onClick={() => deleteDoc(doc.id)}
                      className="text-[#444444] hover:text-red-500 text-xs tracking-widest transition-colors"
                    >
                      DELETE
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
