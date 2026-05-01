'use client'

import { useState, useCallback } from 'react'
import { useDropzone, FileRejection } from 'react-dropzone'
import { JetBrains_Mono } from 'next/font/google'

const mono = JetBrains_Mono({ subsets: ['latin'] })

const DOC_TYPES = ['Fact Sheet', 'PPM', 'Supplement', 'Annual Report', 'Tear Sheet', '10-K', '10-Q', 'Other']

type UploadStatus = 'queued' | 'uploading' | 'done' | 'error'

interface QueuedFile {
  id: string
  file: File
  docType: string
  status: UploadStatus
  error?: string
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
}

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

  const uploadAll = async () => {
    const pending = queue.filter((f) => f.status === 'queued' || f.status === 'error')
    if (pending.length === 0) return

    setUploading(true)

    for (const qf of pending) {
      setQueue((prev) => prev.map((f) => (f.id === qf.id ? { ...f, status: 'uploading', error: undefined } : f)))

      const formData = new FormData()
      formData.append('file', qf.file)
      formData.append('fund_id', fundId)
      formData.append('document_type', qf.docType)

      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData })
        const data = await res.json()
        if (!res.ok) {
          setQueue((prev) => prev.map((f) => (f.id === qf.id ? { ...f, status: 'error', error: data.error ?? 'Upload failed' } : f)))
        } else {
          setQueue((prev) => prev.map((f) => (f.id === qf.id ? { ...f, status: 'done' } : f)))
          onUpload(data as FundDocument)
        }
      } catch {
        setQueue((prev) => prev.map((f) => (f.id === qf.id ? { ...f, status: 'error', error: 'Network error' } : f)))
      }
    }

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

              <span
                className={`text-xs tracking-widest flex-shrink-0 w-[72px] text-right ${
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
                  : qf.status === 'uploading'
                  ? 'UPLOADING'
                  : qf.status === 'error'
                  ? 'ERROR'
                  : 'QUEUED'}
              </span>

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
