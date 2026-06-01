'use client'

import { useState, useCallback } from 'react'
import { useDropzone, FileRejection } from 'react-dropzone'
import { JetBrains_Mono } from 'next/font/google'

const mono = JetBrains_Mono({ subsets: ['latin'] })

const DOC_TYPES = ['Fact Sheet', 'PPM', 'Supplement', 'Annual Report', 'Tear Sheet', '10-K', '10-Q', 'Other']

type UploadStatus = 'queued' | 'uploading' | 'done' | 'error'
type UploadStage = 'url' | 'put' | 'finalize'

interface QueuedFile {
  id: string
  file: File
  docType: string
  status: UploadStatus
  error?: string
  stage?: UploadStage // which step within 'uploading'
  progress?: number   // 0..100 — only meaningful during stage='put'
  startedAt?: number  // perf.now() when upload began; for elapsed-time
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

interface DocumentUploaderProps {
  fundId: string
  onUpload: (doc: FundDocument) => void
}

const ACCEPT = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  // SEC EDGAR 10-Ks/10-Qs ship as .htm — much smaller than a print-to-PDF
  // version and preserve table structure better through extraction.
  'text/html': ['.htm', '.html'],
}

const UPLOAD_CONCURRENCY = 3

export default function DocumentUploader({ fundId, onUpload }: DocumentUploaderProps) {
  const [queue, setQueue] = useState<QueuedFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [rejections, setRejections] = useState<string[]>([])

  const onDrop = useCallback((accepted: File[], rejected: FileRejection[]) => {
    setRejections(rejected.map((r) => `${r.file.name}: ${r.errors[0]?.message ?? 'invalid file'}`))
    if (accepted.length === 0) return
    const newFiles: QueuedFile[] = accepted.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      docType: 'Fact Sheet',
      status: 'queued',
    }))
    setQueue((prev) => [...prev, ...newFiles])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT,
    multiple: true,
  })

  const setDocType = (id: string, docType: string) => {
    setQueue((prev) => prev.map((f) => (f.id === id ? { ...f, docType } : f)))
  }

  const removeFile = (id: string) => {
    setQueue((prev) => prev.filter((f) => f.id !== id))
  }

  // XHR-based PUT so we get real upload-progress events for the bar.
  // fetch() in browsers doesn't expose request-body upload progress.
  const putWithProgress = (
    url: string,
    file: File,
    onProgress: (pct: number) => void,
  ): Promise<{ ok: boolean; status: number; text: string }> => {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', url)
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
      }
      xhr.onload = () => resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, text: xhr.responseText })
      xhr.onerror = () => resolve({ ok: false, status: 0, text: 'network error' })
      xhr.onabort = () => resolve({ ok: false, status: 0, text: 'aborted' })
      xhr.send(file)
    })
  }

  const uploadOne = async (qf: QueuedFile) => {
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const log = (msg: string, data?: unknown) => {
      const elapsed = Math.round(((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0))
      console.log(`[upload] ${qf.file.name} (+${elapsed}ms) ${msg}`, data ?? '')
    }

    setQueue((prev) => prev.map((f) => (f.id === qf.id ? { ...f, status: 'uploading', stage: 'url', progress: 0, startedAt: t0, error: undefined } : f)))
    log('start — requesting signed URL')

    try {
      // Step 1: get signed upload URL
      const urlRes = await fetch('/api/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fund_id: fundId,
          file_name: qf.file.name,
          file_size: qf.file.size,
          document_type: qf.docType,
        }),
      })
      const urlData = await urlRes.json()
      if (!urlRes.ok) {
        log('signed URL request FAILED', urlData)
        setQueue((prev) => prev.map((f) => (f.id === qf.id ? { ...f, status: 'error', error: urlData.error ?? 'Failed to get upload URL' } : f)))
        return
      }
      log('signed URL received, starting PUT')

      // Step 2: PUT file directly to Supabase Storage with progress
      setQueue((prev) => prev.map((f) => (f.id === qf.id ? { ...f, stage: 'put', progress: 0 } : f)))
      const putRes = await putWithProgress(urlData.signedUrl, qf.file, (pct) => {
        setQueue((prev) => prev.map((f) => (f.id === qf.id ? { ...f, progress: pct } : f)))
      })
      if (!putRes.ok) {
        log(`PUT FAILED (status ${putRes.status})`, putRes.text)
        setQueue((prev) => prev.map((f) => (f.id === qf.id ? { ...f, status: 'error', error: putRes.text || `Storage upload failed (${putRes.status})` } : f)))
        return
      }
      log('PUT complete, finalizing')

      // Step 3: record the upload in the database
      setQueue((prev) => prev.map((f) => (f.id === qf.id ? { ...f, stage: 'finalize', progress: 100 } : f)))
      const completeRes = await fetch('/api/upload-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fund_id: fundId,
          file_name: qf.file.name,
          file_path: urlData.path,
          document_type: qf.docType,
          file_size: qf.file.size,
        }),
      })
      const completeData = await completeRes.json()
      if (!completeRes.ok) {
        log('finalize FAILED', completeData)
        setQueue((prev) => prev.map((f) => (f.id === qf.id ? { ...f, status: 'error', error: completeData.error ?? 'Failed to record upload' } : f)))
      } else {
        log('DONE')
        setQueue((prev) => prev.map((f) => (f.id === qf.id ? { ...f, status: 'done' } : f)))
        onUpload(completeData as FundDocument)
      }
    } catch (e) {
      log('unexpected error', e)
      setQueue((prev) => prev.map((f) => (f.id === qf.id ? { ...f, status: 'error', error: e instanceof Error ? e.message : 'Network error' } : f)))
    }
  }

  const uploadAll = async () => {
    const pending = queue.filter((f) => f.status === 'queued' || f.status === 'error')
    if (pending.length === 0) return

    setUploading(true)

    // Bounded concurrency — N parallel workers pulling from the queue.
    // Keeps the network pipe full without spawning a request per file
    // (which can fight for bandwidth and trip browser per-host limits).
    let index = 0
    const worker = async () => {
      while (index < pending.length) {
        const qf = pending[index++]
        await uploadOne(qf)
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(UPLOAD_CONCURRENCY, pending.length) }, worker),
    )

    setUploading(false)
  }

  const pendingCount = queue.filter((f) => f.status === 'queued' || f.status === 'error').length

  return (
    <div className={mono.className}>
      <div
        {...getRootProps()}
        className={`border border-dashed px-8 py-10 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-[#C9A84C] bg-[#C9A84C]/5' : 'border-[#2a2a2a] hover:border-[#3a3a3a]'
        }`}
      >
        <input {...getInputProps()} />
        <p className={`text-xs tracking-widest mb-1 ${isDragActive ? 'text-[#C9A84C]' : 'text-[#555555]'}`}>
          {isDragActive ? 'DROP FILES HERE' : 'DRAG & DROP FILES'}
        </p>
        <p className="text-[#333333] text-xs">PDF · XLSX · DOCX</p>
      </div>

      {rejections.length > 0 && (
        <div className="mt-2 space-y-1">
          {rejections.map((msg, i) => (
            <p key={i} className="text-red-500 text-xs">{msg}</p>
          ))}
        </div>
      )}

      {queue.length > 0 && (
        <div className="mt-4 space-y-px">
          {queue.map((qf) => (
            <div key={qf.id} className="flex items-center gap-3 border border-[#1e1e1e] px-4 py-3 bg-[#0D0D0D]">
              <span className="text-[#E8E0D0] text-xs truncate flex-1 min-w-0">{qf.file.name}</span>

              <span className="text-[#444444] text-xs whitespace-nowrap flex-shrink-0">
                {(qf.file.size / 1024).toFixed(0)} KB
              </span>

              <select
                value={qf.docType}
                onChange={(e) => setDocType(qf.id, e.target.value)}
                disabled={qf.status === 'uploading' || qf.status === 'done'}
                className="bg-[#0D0D0D] border border-[#2a2a2a] text-[#999999] text-xs px-2 py-1.5 outline-none focus:border-[#3a3a3a] rounded-none appearance-none disabled:opacity-40 flex-shrink-0"
              >
                {DOC_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>

              <div className="flex-shrink-0 w-[160px] flex flex-col items-end gap-1">
                <span
                  className={`text-xs tracking-widest ${
                    qf.status === 'done'
                      ? 'text-emerald-500'
                      : qf.status === 'uploading'
                      ? 'text-[#C9A84C]'
                      : qf.status === 'error'
                      ? 'text-red-500'
                      : 'text-[#333333]'
                  }`}
                >
                  {qf.status === 'done'
                    ? 'DONE'
                    : qf.status === 'error'
                    ? 'ERROR'
                    : qf.status === 'uploading'
                    ? qf.stage === 'url'
                      ? 'REQUESTING URL…'
                      : qf.stage === 'put'
                      ? `UPLOADING ${qf.progress ?? 0}%`
                      : qf.stage === 'finalize'
                      ? 'FINALIZING…'
                      : 'STARTING…'
                    : 'QUEUED'}
                </span>
                {qf.status === 'uploading' && (
                  <div style={{ height: 2, background: '#1a1a1a', width: '100%' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${qf.stage === 'finalize' ? 100 : qf.progress ?? 0}%`,
                        background: '#C9A84C',
                        transition: 'width 0.2s linear',
                      }}
                    />
                  </div>
                )}
              </div>

              {qf.status !== 'uploading' && (
                <button
                  onClick={() => removeFile(qf.id)}
                  className="text-[#333333] hover:text-red-500 text-xs transition-colors flex-shrink-0 leading-none"
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          {queue.some((f) => f.status === 'error') && (
            <div className="pt-1 space-y-0.5">
              {queue.filter((f) => f.status === 'error').map((qf) => (
                <p key={`err-${qf.id}`} className="text-red-500 text-xs">
                  {qf.file.name}: {qf.error}
                </p>
              ))}
            </div>
          )}

          {pendingCount > 0 && (
            <div className="pt-3">
              <button
                onClick={uploadAll}
                disabled={uploading}
                className="bg-[#C9A84C] text-black text-xs tracking-widest px-6 py-2 hover:bg-[#b8973a] transition-colors disabled:opacity-50"
              >
                {uploading ? 'UPLOADING...' : `UPLOAD ${pendingCount} FILE${pendingCount > 1 ? 'S' : ''}`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
