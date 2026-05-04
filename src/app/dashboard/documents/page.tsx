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
  created_at: string | null
  funds?: { name: string }
}

interface FundGroup {
  fundId: string
  fundName: string
  docs: Doc[]
}

function buildGroups(docs: Doc[]): FundGroup[] {
  const map = new Map<string, FundGroup>()
  const order: string[] = []
  for (const doc of docs) {
    if (!map.has(doc.fund_id)) {
      map.set(doc.fund_id, {
        fundId: doc.fund_id,
        fundName: doc.funds?.name ?? 'Unknown Fund',
        docs: [],
      })
      order.push(doc.fund_id)
    }
    map.get(doc.fund_id)!.docs.push(doc)
  }
  return order.map(id => map.get(id)!)
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedFunds, setExpandedFunds] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/all-documents')
      .then(r => r.json())
      .then(data => { setDocs(data.documents ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const grouped = buildGroups(docs)

  async function deleteDoc(id: string) {
    if (!confirm('Delete this document?')) return
    await fetch(`/api/documents/${id}`, { method: 'DELETE' })
    setDocs(prev => prev.filter(d => d.id !== id))
  }

  function toggleFund(fundId: string) {
    setExpandedFunds(prev => {
      const next = new Set(prev)
      if (next.has(fundId)) next.delete(fundId)
      else next.add(fundId)
      return next
    })
  }

  return (
    <div className={`${mono.className} flex flex-col min-h-screen`}>
      <div className="flex items-center px-8 py-5 border-b border-[#2a2a2a] flex-shrink-0">
        <span className="text-[#E8E0D0] text-xs tracking-widest">DOCUMENTS</span>
      </div>

      <div className="flex-1 px-8 py-8">
        <p style={{ color: '#444444', fontSize: 10, letterSpacing: '0.08em', marginBottom: 24 }}>
          Documents are uploaded and managed from each fund&apos;s detail page.
        </p>

        {loading ? (
          <p className="text-[#444444] text-xs tracking-widest">LOADING...</p>
        ) : grouped.length === 0 ? (
          <div className="border border-[#1e1e1e] px-6 py-10 text-center">
            <p className="text-[#333333] text-xs tracking-widest mb-2">No documents uploaded yet.</p>
            <p className="text-[#2a2a2a] text-xs">Upload documents from a fund&apos;s detail page.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {grouped.map(group => {
              const expanded = expandedFunds.has(group.fundId)
              return (
                <div key={group.fundId} style={{ border: '1px solid #2a2a2a' }}>
                  <button
                    onClick={() => toggleFund(group.fundId)}
                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-[#131313] transition-colors text-left"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-[#E8E0D0] text-xs tracking-widest">
                        {group.fundName.toUpperCase()}
                      </span>
                      <span style={{ color: '#444444', fontSize: 11 }}>
                        {group.docs.length} document{group.docs.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <span style={{ color: '#444444', fontSize: 11 }}>{expanded ? '▲' : '▼'}</span>
                  </button>

                  {expanded && (
                    <div style={{ borderTop: '1px solid #2a2a2a' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                            {['FILE NAME', 'DOCUMENT TYPE', 'UPLOAD DATE', 'ACTIONS'].map(h => (
                              <th
                                key={h}
                                className="text-left font-normal"
                                style={{
                                  color: '#444444',
                                  fontSize: 10,
                                  letterSpacing: '0.1em',
                                  padding: '10px 24px 10px',
                                }}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {group.docs.map(doc => (
                            <tr
                              key={doc.id}
                              style={{ borderBottom: '1px solid #1a1a1a' }}
                              className="hover:bg-[#131313] transition-colors"
                            >
                              <td
                                style={{
                                  padding: '11px 24px',
                                  color: '#E8E0D0',
                                  fontSize: 11,
                                  maxWidth: 280,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {doc.file_name}
                              </td>
                              <td style={{ padding: '11px 24px', color: '#777777', fontSize: 11 }}>
                                {doc.document_type || '—'}
                              </td>
                              <td style={{ padding: '11px 24px', color: '#555555', fontSize: 11, whiteSpace: 'nowrap' }}>
                                {doc.created_at
                                  ? format(new Date(doc.created_at), 'MMM d, yyyy')
                                  : '—'}
                              </td>
                              <td style={{ padding: '11px 24px' }}>
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
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
