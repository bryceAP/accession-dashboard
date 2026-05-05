'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { JetBrains_Mono } from 'next/font/google'
import { format } from 'date-fns'

const mono = JetBrains_Mono({ subsets: ['latin'] })

/* ─── Types ──────────────────────────────────────────────────── */

interface Fund {
  id: string
  name: string
  manager: string | null
  strategy: string | null
  ticker: string | null
  isin: string | null
  status: string
  last_run_at: string | null
  created_at: string
}

interface FundDocument {
  id: string
  fund_id: string
  file_name: string
  document_type: string
  file_path: string
  file_size: number | null
  created_at: string
}

interface Run {
  id: string
  fund_id: string
  status: string
  report_text: string | null
  input_tokens: number | null
  output_tokens: number | null
  created_at: string | null
}

const DOC_TYPES = ['Fact Sheet', 'PPM', 'Tear Sheet', 'Annual Report', 'Other']
const STRATEGIES = ['Private Credit']

const STATUS_COLOR: Record<string, string> = {
  pending: 'text-[#C9A84C]',
  running: 'text-[#C9A84C]',
  complete: 'text-emerald-500',
  error: 'text-red-500',
}

const STATUS_BORDER: Record<string, string> = {
  pending: 'border-[#333333] text-[#555555]',
  running: 'border-[#C9A84C] text-[#C9A84C]',
  complete: 'border-emerald-800 text-emerald-500',
  error: 'border-red-900 text-red-500',
}

/* ─── Main page ──────────────────────────────────────────────── */

export default function FundDetailPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()

  // Data
  const [fund, setFund] = useState<Fund | null>(null)
  const [documents, setDocuments] = useState<FundDocument[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null)

  // Upload modal
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadType, setUploadType] = useState('Fact Sheet')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Run analysis modal
  const [runOpen, setRunOpen] = useState(false)
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([])
  const [runContext, setRunContext] = useState('')
  const [runError, setRunError] = useState('')

  // Progress modal
  const [progressOpen, setProgressOpen] = useState(false)
  const [progressPct, setProgressPct] = useState(0)
  const [progressStage, setProgressStage] = useState('')
  const [progressError, setProgressError] = useState('')
  const [progressDuration, setProgressDuration] = useState(0)
  const progressTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  // Edit fund modal
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', manager: '', strategy: 'Private Credit', ticker: '', isin: '' })
  const [editing, setEditing] = useState(false)
  const [editError, setEditError] = useState('')

  /* ─── Data fetching ─────────────────────────────────────────── */

  const load = useCallback(async () => {
    setLoading(true)
    setFetchError('')
    try {
      const [fundRes, docsRes, runsRes] = await Promise.all([
        fetch(`/api/funds/${id}`),
        fetch(`/api/documents?fund_id=${id}`),
        fetch(`/api/runs?fund_id=${id}`),
      ])

      if (!fundRes.ok) {
        const d = await fundRes.json()
        throw new Error(d.error ?? 'Fund not found')
      }

      const [fundData, docsData, runsData] = await Promise.all([
        fundRes.json(),
        docsRes.ok ? docsRes.json() : [],
        runsRes.ok ? runsRes.json() : [],
      ])

      setFund(fundData)
      setDocuments(docsData)
      setRuns(runsData)
      if (runsData.length > 0) setExpandedRunId(runsData[0].id)
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'Failed to load fund')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  /* ─── Upload document ───────────────────────────────────────── */

  const openUpload = () => {
    setUploadFile(null)
    setUploadType('Fact Sheet')
    setUploadError('')
    setUploadOpen(true)
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadFile) { setUploadError('Please select a PDF file'); return }
    setUploading(true)
    setUploadError('')

    const formData = new FormData()
    formData.append('file', uploadFile)
    formData.append('fund_id', id)
    formData.append('document_type', uploadType)

    const res = await fetch('/api/documents', { method: 'POST', body: formData })
    const data = await res.json()

    if (!res.ok) {
      setUploadError(data.error ?? 'Upload failed')
      setUploading(false)
      return
    }

    setDocuments((prev) => [data, ...prev])
    setUploading(false)
    setUploadOpen(false)
  }

  const handleDeleteDoc = async (docId: string) => {
    if (!confirm('Delete this document?')) return
    await fetch(`/api/documents/${docId}`, { method: 'DELETE' })
    setDocuments((prev) => prev.filter((d) => d.id !== docId))
  }

  /* ─── Edit fund ─────────────────────────────────────────────── */

  const openEdit = () => {
    if (!fund) return
    setEditForm({
      name: fund.name,
      manager: fund.manager ?? '',
      strategy: fund.strategy ?? 'Private Credit',
      ticker: fund.ticker ?? '',
      isin: fund.isin ?? '',
    })
    setEditError('')
    setEditOpen(true)
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editForm.name.trim()) { setEditError('Fund name is required'); return }
    setEditing(true)
    setEditError('')

    const res = await fetch(`/api/funds/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editForm.name.trim(),
        manager: editForm.manager.trim() || null,
        strategy: editForm.strategy || null,
        ticker: editForm.ticker.trim() || null,
        isin: editForm.isin.trim() || null,
      }),
    })
    const data = await res.json()

    if (!res.ok) {
      setEditError(data.error ?? 'Update failed')
      setEditing(false)
      return
    }

    setFund(data)
    setEditing(false)
    setEditOpen(false)
  }

  /* ─── Run analysis ──────────────────────────────────────────── */

  const openRun = () => {
    setSelectedDocIds(documents.map((d) => d.id))
    setRunContext('')
    setRunError('')
    setRunOpen(true)
  }

  const toggleDoc = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    )
  }

  const handleDeleteRun = async (runId: string) => {
    if (!confirm('Delete this report?')) return
    await fetch(`/api/runs/${runId}`, { method: 'DELETE' })
    setRuns((prev) => prev.filter((r) => r.id !== runId))
    if (expandedRunId === runId) setExpandedRunId(null)
  }

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault()
    setRunError('')
    setProgressError('')

    // Close config modal, open progress overlay
    setRunOpen(false)
    setProgressPct(0)
    setProgressDuration(0)
    setProgressStage('Reading documents...')
    setProgressOpen(true)

    // Clear any stale timers
    progressTimers.current.forEach(clearTimeout)
    progressTimers.current = []

    const schedule = (fn: () => void, delay: number) => {
      const id = setTimeout(fn, delay)
      progressTimers.current.push(id)
    }

    // Stage 1: 0→15% over 3s
    schedule(() => { setProgressPct(15); setProgressDuration(3) }, 50)
    // Stage 2: 15→35% over 5s
    schedule(() => { setProgressStage('Extracting fund data...'); setProgressPct(35); setProgressDuration(5) }, 3050)
    // Stage 3: 35→60% over 8s
    schedule(() => { setProgressStage('Analyzing portfolio metrics...'); setProgressPct(60); setProgressDuration(8) }, 8050)
    // Stage 4: 60→80% over 10s
    schedule(() => { setProgressStage('Writing research report...'); setProgressPct(80); setProgressDuration(10) }, 16050)
    // Stage 5: 80→95% slow crawl until API responds
    schedule(() => { setProgressStage('Finalizing analysis...'); setProgressPct(95); setProgressDuration(90) }, 26050)

    const priorRunId = runs.length > 0 ? runs[0].id : undefined
    const res = await fetch('/api/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fund_id: id, document_ids: selectedDocIds, context: runContext, prior_run_id: priorRunId }),
    })
    const data = await res.json()

    // Cancel pending stage timers
    progressTimers.current.forEach(clearTimeout)
    progressTimers.current = []

    if (!res.ok) {
      setProgressError(data.error ?? 'Analysis failed')
      return
    }

    // Stage 6: Complete
    setProgressStage('Complete!')
    setProgressPct(100)
    setProgressDuration(0.4)

    setRuns((prev) => [data, ...prev])
    setExpandedRunId(data.id)
    setFund((prev) => prev ? { ...prev, status: data.status, last_run_at: data.created_at } : prev)

    const redirectId = setTimeout(() => {
      router.push(`/dashboard/funds/${id}/run/${data.id}`)
    }, 900)
    progressTimers.current.push(redirectId)
  }

  /* ─── Render ────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className={`${mono.className} flex items-center justify-center h-64`}>
        <p className="text-[#444444] text-xs tracking-widest">LOADING...</p>
      </div>
    )
  }

  if (fetchError || !fund) {
    return (
      <div className={`${mono.className} p-8`}>
        <p className="text-red-500 text-xs mb-4">{fetchError || 'Fund not found'}</p>
        <Link href="/dashboard/funds" className="text-[#555555] hover:text-[#999999] text-xs tracking-widest transition-colors">
          ← BACK TO FUNDS
        </Link>
      </div>
    )
  }

  return (
    <div className={`${mono.className} flex flex-col min-h-screen`}>

      {/* Top bar */}
      <div className="flex items-center px-8 py-5 border-b border-[#2a2a2a] flex-shrink-0 gap-2">
        <Link href="/dashboard/funds" className="text-[#444444] hover:text-[#999999] text-xs tracking-widest transition-colors">
          FUNDS
        </Link>
        <span className="text-[#2a2a2a] text-xs">/</span>
        <span className="text-[#E8E0D0] text-xs tracking-widest truncate">{fund.name.toUpperCase()}</span>
      </div>

      <div className="flex-1 px-8 py-8 space-y-10">

        {/* Fund header */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-[#E8E0D0] text-2xl font-light tracking-wide mb-1">{fund.name}</h1>
            <p className="text-[#666666] text-xs tracking-widest">
              {[fund.manager, fund.strategy].filter(Boolean).join(' · ') || '—'}
              {(fund.ticker || fund.isin) && (
                <span className="ml-3 text-[#444444]">
                  {[fund.ticker, fund.isin].filter(Boolean).join(' · ')}
                </span>
              )}
            </p>
            <div className="mt-3">
              <span className={`inline-block border text-xs tracking-widest px-2 py-0.5 ${STATUS_BORDER[fund.status] ?? 'border-[#333333] text-[#555555]'}`}>
                {fund.status.toUpperCase()}
              </span>
            </div>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <button
              onClick={openEdit}
              className="border border-[#2a2a2a] text-[#999999] hover:border-[#3a3a3a] hover:text-[#E8E0D0] text-xs tracking-widest px-4 py-2 transition-colors"
            >
              EDIT FUND
            </button>
            <button
              onClick={openRun}
              disabled={progressOpen}
              className="bg-[#C9A84C] text-black text-xs tracking-widest px-5 py-2 hover:bg-[#b8973a] transition-colors disabled:opacity-50"
            >
              RUN ANALYSIS
            </button>
          </div>
        </div>

        {/* Documents */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[#555555] text-xs tracking-widest">DOCUMENTS</h2>
            <button
              onClick={openUpload}
              className="border border-[#2a2a2a] text-[#555555] hover:text-[#999999] hover:border-[#3a3a3a] text-xs tracking-widest px-4 py-1.5 transition-colors"
            >
              + UPLOAD
            </button>
          </div>

          {documents.length === 0 ? (
            <div className="border border-[#1e1e1e] px-6 py-10 text-center">
              <p className="text-[#333333] text-xs tracking-widest mb-2">NO DOCUMENTS</p>
              <p className="text-[#2a2a2a] text-xs">Upload PDFs to include in analysis runs.</p>
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  {['FILE NAME', 'TYPE', 'SIZE', 'UPLOADED', ''].map((col) => (
                    <th key={col} className="text-left text-[#444444] text-xs tracking-widest pb-3 pr-6 font-normal">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} className="border-b border-[#1a1a1a] hover:bg-[#131313] transition-colors">
                    <td className="text-[#E8E0D0] text-xs py-3.5 pr-6 max-w-[240px] truncate">{doc.file_name}</td>
                    <td className="text-[#777777] text-xs py-3.5 pr-6 whitespace-nowrap">{doc.document_type}</td>
                    <td className="text-[#555555] text-xs py-3.5 pr-6 whitespace-nowrap">
                      {doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB` : '—'}
                    </td>
                    <td className="text-[#555555] text-xs py-3.5 pr-6 whitespace-nowrap">
                      {(() => { const d = new Date(doc.created_at); return isNaN(d.getTime()) ? '—' : format(d, 'MMM d, yyyy') })()}
                    </td>
                    <td className="py-3.5">
                      <button
                        onClick={() => handleDeleteDoc(doc.id)}
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
        </section>

        {/* Reports */}
        <section>
          <h2 className="text-[#555555] text-xs tracking-widest mb-5">REPORTS</h2>

          {runs.length === 0 ? (
            <div className="border border-[#1e1e1e] px-6 py-10 text-center">
              <p className="text-[#333333] text-xs tracking-widest mb-2">NO REPORTS YET</p>
              <p className="text-[#2a2a2a] text-xs">Run an analysis to generate the first report.</p>
            </div>
          ) : (
            <div className="space-y-px">
              {runs.map((run) => {
                const expanded = expandedRunId === run.id
                return (
                  <div key={run.id} className="border border-[#2a2a2a]">
                    <div className="flex items-center">
                      <button
                        onClick={() => setExpandedRunId(expanded ? null : run.id)}
                        className="flex-1 flex items-center justify-between px-6 py-4 hover:bg-[#131313] transition-colors text-left"
                      >
                        <div className="flex items-center gap-6">
                          <span className="text-[#E8E0D0] text-xs">
                            {run.created_at ? format(new Date(run.created_at), 'MMM d, yyyy · HH:mm') : '—'}
                          </span>
                          <span className={`text-xs tracking-widest ${STATUS_COLOR[run.status] ?? 'text-[#555555]'}`}>
                            {run.status.toUpperCase()}
                          </span>
                          {run.input_tokens != null && (
                            <span className="text-[#444444] text-xs">
                              {((run.input_tokens + (run.output_tokens ?? 0)) / 1000).toFixed(1)}k tokens
                            </span>
                          )}
                        </div>
                        <span className="text-[#444444] text-xs">{expanded ? '▲' : '▼'}</span>
                      </button>
                      <Link
                        href={`/dashboard/funds/${id}/run/${run.id}`}
                        className="border-l border-[#2a2a2a] px-5 py-4 text-xs tracking-widest text-[#555555] hover:text-[#C9A84C] hover:bg-[#131313] transition-colors flex-shrink-0"
                      >
                        VIEW →
                      </Link>
                      <button
                        onClick={() => handleDeleteRun(run.id)}
                        className="border-l border-[#2a2a2a] px-5 py-4 text-xs tracking-widest text-[#444444] hover:text-red-500 hover:bg-[#131313] transition-colors flex-shrink-0"
                      >
                        DELETE
                      </button>
                    </div>

                    {expanded && run.report_text && (
                      <div className="border-t border-[#2a2a2a] px-8 py-6 bg-[#0a0a0a]">
                        <ReportRenderer text={run.report_text} />
                      </div>
                    )}
                    {expanded && run.status === 'error' && (
                      <div className="border-t border-[#2a2a2a] px-8 py-6 bg-[#0a0a0a]">
                        <p className="text-red-500 text-xs">Analysis failed.</p>
                      </div>
                    )}
                    {expanded && run.status === 'running' && (
                      <div className="border-t border-[#2a2a2a] px-8 py-6 bg-[#0a0a0a]">
                        <p className="text-[#C9A84C] text-xs tracking-widest">GENERATING...</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {/* Upload document modal */}
      {uploadOpen && (
        <Overlay onClose={() => !uploading && setUploadOpen(false)}>
          <div className="border-b border-[#2a2a2a] px-8 py-5">
            <p className="text-[#E8E0D0] text-xs tracking-widest">UPLOAD DOCUMENT</p>
          </div>
          <form onSubmit={handleUpload} className="px-8 py-6 space-y-5">
            <Field label="DOCUMENT TYPE">
              <select
                value={uploadType}
                onChange={(e) => setUploadType(e.target.value)}
                className="w-full bg-[#0D0D0D] border border-[#2a2a2a] text-[#E8E0D0] text-xs px-3 py-2.5 outline-none focus:border-[#3a3a3a] rounded-none appearance-none"
              >
                {DOC_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="FILE">
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.htm,.html"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border border-dashed border-[#2a2a2a] hover:border-[#3a3a3a] text-[#555555] hover:text-[#999999] text-xs tracking-widest py-4 transition-colors text-center"
                >
                  {uploadFile ? uploadFile.name : 'SELECT PDF →'}
                </button>
                {uploadFile && (
                  <p className="text-[#444444] text-xs mt-1.5">
                    {(uploadFile.size / 1024).toFixed(0)} KB
                  </p>
                )}
              </div>
            </Field>
            {uploadError && <p className="text-red-500 text-xs">{uploadError}</p>}
            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={uploading}
                className="bg-[#C9A84C] text-black text-xs tracking-widest px-6 py-2.5 hover:bg-[#b8973a] transition-colors disabled:opacity-50"
              >
                {uploading ? 'UPLOADING...' : 'UPLOAD'}
              </button>
              <button
                type="button"
                onClick={() => setUploadOpen(false)}
                disabled={uploading}
                className="text-[#555555] hover:text-[#999999] text-xs tracking-widest px-4 py-2.5 transition-colors disabled:opacity-40"
              >
                CANCEL
              </button>
            </div>
          </form>
        </Overlay>
      )}

      {/* Run analysis modal */}
      {runOpen && (
        <Overlay onClose={() => setRunOpen(false)}>
          <div className="border-b border-[#2a2a2a] px-8 py-5">
            <p className="text-[#E8E0D0] text-xs tracking-widest">RUN ANALYSIS</p>
            <p className="text-[#444444] text-xs mt-1">{fund.name}</p>
          </div>
          <form onSubmit={handleRun} className="px-8 py-6 space-y-5">
            {documents.length > 0 && (
              <Field label="DOCUMENTS TO INCLUDE">
                <div className="space-y-2 mt-1">
                  {documents.map((doc) => (
                    <label key={doc.id} className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={selectedDocIds.includes(doc.id)}
                        onChange={() => toggleDoc(doc.id)}
                        className="accent-[#C9A84C]"
                      />
                      <span className="text-[#999999] group-hover:text-[#E8E0D0] text-xs transition-colors">
                        {doc.file_name}
                        <span className="text-[#444444] ml-2">{doc.document_type}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </Field>
            )}
            <Field label="ADDITIONAL CONTEXT">
              <textarea
                value={runContext}
                onChange={(e) => setRunContext(e.target.value)}
                placeholder="Focus areas, specific questions, investment thesis..."
                rows={4}
                className="w-full bg-[#0D0D0D] border border-[#2a2a2a] text-[#E8E0D0] text-xs px-3 py-2.5 outline-none focus:border-[#3a3a3a] rounded-none resize-none placeholder-[#333333] leading-relaxed"
              />
            </Field>
            {runError && <p className="text-red-500 text-xs">{runError}</p>}
            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                className="bg-[#C9A84C] text-black text-xs tracking-widest px-6 py-2.5 hover:bg-[#b8973a] transition-colors"
              >
                GENERATE REPORT
              </button>
              <button
                type="button"
                onClick={() => setRunOpen(false)}
                className="text-[#555555] hover:text-[#999999] text-xs tracking-widest px-4 py-2.5 transition-colors"
              >
                CANCEL
              </button>
            </div>
          </form>
        </Overlay>
      )}

      {/* Progress modal */}
      {progressOpen && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50">
          <div className={`${mono.className} bg-[#111111] border border-[#2a2a2a] w-full max-w-[480px] px-8 py-8`}>
            {progressError ? (
              <>
                <p className="text-red-500 text-xs tracking-widest mb-3">ANALYSIS FAILED</p>
                <p className="text-[#666666] text-xs mb-6 leading-relaxed">{progressError}</p>
                <button
                  onClick={() => { setProgressOpen(false); setProgressError('') }}
                  className="text-[#555555] hover:text-[#999999] text-xs tracking-widest transition-colors"
                >
                  CLOSE
                </button>
              </>
            ) : (
              <>
                <p className="text-[#E8E0D0] text-xs tracking-widest mb-1">RUNNING ANALYSIS</p>
                <p className="text-[#444444] text-xs mb-8">{fund?.name}</p>
                <div className="bg-[#1a1a1a] h-1">
                  <div
                    className="h-full bg-[#C9A84C]"
                    style={{
                      width: `${progressPct}%`,
                      transition: `width ${progressDuration}s linear`,
                    }}
                  />
                </div>
                <p className="text-[#555555] text-xs mt-3">{progressStage}</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Edit fund modal */}
      {editOpen && (
        <Overlay onClose={() => !editing && setEditOpen(false)}>
          <div className="border-b border-[#2a2a2a] px-8 py-5">
            <p className="text-[#E8E0D0] text-xs tracking-widest">EDIT FUND</p>
          </div>
          <form onSubmit={handleEdit} className="px-8 py-6 space-y-5">
            <Field label="FUND NAME" required>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                autoFocus
                className="w-full bg-[#0D0D0D] border border-[#2a2a2a] text-[#E8E0D0] text-xs px-3 py-2.5 outline-none focus:border-[#3a3a3a] rounded-none"
              />
            </Field>
            <Field label="MANAGER">
              <input
                type="text"
                value={editForm.manager}
                onChange={(e) => setEditForm({ ...editForm, manager: e.target.value })}
                className="w-full bg-[#0D0D0D] border border-[#2a2a2a] text-[#E8E0D0] text-xs px-3 py-2.5 outline-none focus:border-[#3a3a3a] rounded-none"
              />
            </Field>
            <Field label="STRATEGY">
              <select
                value={editForm.strategy}
                onChange={(e) => setEditForm({ ...editForm, strategy: e.target.value })}
                className="w-full bg-[#0D0D0D] border border-[#2a2a2a] text-[#E8E0D0] text-xs px-3 py-2.5 outline-none focus:border-[#3a3a3a] rounded-none appearance-none"
              >
                {STRATEGIES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="TICKER / ID">
                <input
                  type="text"
                  value={editForm.ticker}
                  onChange={(e) => setEditForm({ ...editForm, ticker: e.target.value })}
                  className="w-full bg-[#0D0D0D] border border-[#2a2a2a] text-[#E8E0D0] text-xs px-3 py-2.5 outline-none focus:border-[#3a3a3a] rounded-none"
                />
              </Field>
              <Field label="ISIN">
                <input
                  type="text"
                  value={editForm.isin}
                  onChange={(e) => setEditForm({ ...editForm, isin: e.target.value })}
                  className="w-full bg-[#0D0D0D] border border-[#2a2a2a] text-[#E8E0D0] text-xs px-3 py-2.5 outline-none focus:border-[#3a3a3a] rounded-none"
                />
              </Field>
            </div>
            {editError && <p className="text-red-500 text-xs">{editError}</p>}
            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={editing}
                className="bg-[#C9A84C] text-black text-xs tracking-widest px-6 py-2.5 hover:bg-[#b8973a] transition-colors disabled:opacity-50"
              >
                {editing ? 'SAVING...' : 'UPDATE FUND'}
              </button>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                disabled={editing}
                className="text-[#555555] hover:text-[#999999] text-xs tracking-widest px-4 py-2.5 transition-colors disabled:opacity-40"
              >
                CANCEL
              </button>
            </div>
          </form>
        </Overlay>
      )}
    </div>
  )
}

/* ─── Sub-components ─────────────────────────────────────────── */

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className={`${mono.className} bg-[#111111] border border-[#2a2a2a] w-full max-w-[500px] max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-[#555555] text-xs tracking-widest mb-2">
        {label}
        {required && <span className="text-[#C9A84C] ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}

function ReportRenderer({ text }: { text: string }) {
  const lines = text.split('\n')

  const formatInline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={i} className="text-[#E8E0D0] font-semibold">{part.slice(2, -2)}</strong>
        : part
    )

  return (
    <div className={mono.className}>
      {lines.map((line, i) => {
        const t = line.trim()
        if (!t) return <div key={i} className="h-3" />
        if (t.startsWith('## ')) {
          return (
            <h2 key={i} className="text-[#C9A84C] text-xs tracking-widest font-normal mt-7 mb-3 pb-2 border-b border-[#C9A84C]/20 uppercase">
              {t.slice(3)}
            </h2>
          )
        }
        if (t.startsWith('# ')) {
          return <h1 key={i} className="text-[#E8E0D0] text-base font-light mt-4 mb-3">{t.slice(2)}</h1>
        }
        if (t.startsWith('### ')) {
          return <h3 key={i} className="text-[#999999] text-xs tracking-widest mt-4 mb-1">{t.slice(4)}</h3>
        }
        if (t.startsWith('- ') || t.startsWith('* ')) {
          return (
            <div key={i} className="flex gap-2 mb-1.5 ml-2">
              <span className="text-[#C9A84C] text-xs mt-0.5 flex-shrink-0">▸</span>
              <p className="text-[#999999] text-xs leading-relaxed">{formatInline(t.slice(2))}</p>
            </div>
          )
        }
        const numbered = t.match(/^(\d+)\.\s(.+)/)
        if (numbered) {
          return (
            <div key={i} className="flex gap-2 mb-1.5 ml-2">
              <span className="text-[#C9A84C] text-xs flex-shrink-0 w-4">{numbered[1]}.</span>
              <p className="text-[#999999] text-xs leading-relaxed">{formatInline(numbered[2])}</p>
            </div>
          )
        }
        return (
          <p key={i} className="text-[#999999] text-xs leading-relaxed mb-2">{formatInline(t)}</p>
        )
      })}
    </div>
  )
}
