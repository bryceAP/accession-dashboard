'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useRouter } from 'next/navigation'

interface ReportData {
  report: string
  usage?: {
    input_tokens: number
    output_tokens: number
  }
}

export default function Dashboard() {
  const [file, setFile] = useState<File | null>(null)
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<ReportData | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const router = useRouter()

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0])
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    multiple: false,
  })

  const handleGenerate = async () => {
    setLoading(true)
    setError('')
    setReport(null)

    const formData = new FormData()
    if (file) formData.append('file', file)
    if (prompt.trim()) formData.append('prompt', prompt.trim())

    try {
      const res = await fetch('/api/generate-report', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate report')
      }

      setReport(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  const handleCopy = async () => {
    if (!report) return
    await navigator.clipboard.writeText(report.report)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadPDF = async () => {
    if (!report) return

    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')

    const pdfDoc = await PDFDocument.create()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    const pageWidth = 595
    const pageHeight = 842
    const margin = 55
    const contentWidth = pageWidth - margin * 2

    let page = pdfDoc.addPage([pageWidth, pageHeight])
    let y = pageHeight - margin

    const ensureSpace = (needed: number) => {
      if (y < margin + needed) {
        page = pdfDoc.addPage([pageWidth, pageHeight])
        y = pageHeight - margin
      }
    }

    const drawWrappedText = (
      text: string,
      fontSize: number,
      lineHeight: number,
      currentFont: typeof font,
      color: ReturnType<typeof rgb>
    ) => {
      const words = text.split(' ')
      let currentLine = ''

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word
        const lineWidth = currentFont.widthOfTextAtSize(testLine, fontSize)

        if (lineWidth > contentWidth && currentLine) {
          ensureSpace(lineHeight)
          page.drawText(currentLine, { x: margin, y, size: fontSize, font: currentFont, color })
          y -= lineHeight
          currentLine = word
        } else {
          currentLine = testLine
        }
      }

      if (currentLine.trim()) {
        ensureSpace(lineHeight)
        page.drawText(currentLine, { x: margin, y, size: fontSize, font: currentFont, color })
        y -= lineHeight
      }
    }

    // Title block
    ensureSpace(80)
    page.drawText('ACCESSION PARTNERS', {
      x: margin, y, size: 18, font: boldFont, color: rgb(0.06, 0.09, 0.16),
    })
    y -= 24
    page.drawText('Investment Research Report', {
      x: margin, y, size: 12, font, color: rgb(0.72, 0.59, 0.23),
    })
    y -= 18
    page.drawText(
      new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      { x: margin, y, size: 9, font, color: rgb(0.5, 0.5, 0.5) }
    )
    y -= 14
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 1.5,
      color: rgb(0.72, 0.59, 0.23),
    })
    y -= 22

    const lines = report.report.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()

      if (!trimmed) {
        y -= 8
        continue
      }

      if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
        y -= 10
        const headerText = trimmed.replace(/^#{1,3}\s+/, '')
        ensureSpace(28)
        drawWrappedText(headerText, 13, 20, boldFont, rgb(0.06, 0.09, 0.16))
        ensureSpace(4)
        page.drawLine({
          start: { x: margin, y: y + 2 },
          end: { x: pageWidth - margin, y: y + 2 },
          thickness: 0.5,
          color: rgb(0.72, 0.59, 0.23),
        })
        y -= 8
      } else if (trimmed.startsWith('### ')) {
        y -= 4
        const subText = trimmed.replace(/^###\s+/, '')
        drawWrappedText(subText, 11, 18, boldFont, rgb(0.15, 0.2, 0.3))
        y -= 2
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const bulletText = '•  ' + trimmed.slice(2).replace(/\*\*/g, '')
        drawWrappedText(bulletText, 10, 15, font, rgb(0.2, 0.2, 0.2))
      } else {
        const cleanText = trimmed.replace(/\*\*/g, '').replace(/\*/g, '')
        drawWrappedText(cleanText, 10, 15, font, rgb(0.2, 0.2, 0.2))
        y -= 2
      }
    }

    const pdfBytes = await pdfDoc.save()
    const pdfBuffer = pdfBytes.buffer.slice(
      pdfBytes.byteOffset,
      pdfBytes.byteOffset + pdfBytes.byteLength
    ) as ArrayBuffer
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `accession-partners-research-${Date.now()}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const renderReportLine = (line: string, index: number) => {
    const trimmed = line.trim()

    if (!trimmed) {
      return <div key={index} className="h-2" />
    }

    if (trimmed.startsWith('## ')) {
      return (
        <h2 key={index} className="text-[#b8973a] text-base font-bold mt-7 mb-3 pb-2 border-b border-[#b8973a]/25 tracking-wide uppercase text-xs">
          {trimmed.slice(3)}
        </h2>
      )
    }

    if (trimmed.startsWith('# ')) {
      return (
        <h1 key={index} className="text-white text-xl font-bold mt-4 mb-3">
          {trimmed.slice(2)}
        </h1>
      )
    }

    if (trimmed.startsWith('### ')) {
      return (
        <h3 key={index} className="text-slate-200 text-sm font-semibold mt-4 mb-1">
          {trimmed.slice(4).replace(/\*\*/g, '')}
        </h3>
      )
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const content = trimmed.slice(2)
      return (
        <div key={index} className="flex gap-2 mb-1.5 ml-2">
          <span className="text-[#b8973a] mt-1 flex-shrink-0 text-xs">▸</span>
          <p className="text-slate-300 text-sm leading-relaxed">
            {formatInline(content)}
          </p>
        </div>
      )
    }

    if (/^\d+\.\s/.test(trimmed)) {
      const match = trimmed.match(/^(\d+)\.\s(.+)/)
      if (match) {
        return (
          <div key={index} className="flex gap-2 mb-1.5 ml-2">
            <span className="text-[#b8973a] font-semibold text-sm flex-shrink-0 w-5">{match[1]}.</span>
            <p className="text-slate-300 text-sm leading-relaxed">{formatInline(match[2])}</p>
          </div>
        )
      }
    }

    return (
      <p key={index} className="text-slate-300 text-sm leading-relaxed mb-2">
        {formatInline(trimmed)}
      </p>
    )
  }

  const formatInline = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>
      }
      return part
    })
  }

  const canGenerate = (file || prompt.trim()) && !loading

  return (
    <div className="min-h-screen bg-[#0f172a]">
      {/* Header */}
      <header className="bg-[#1e293b] border-b border-[#b8973a]/20 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#b8973a] rounded-full flex items-center justify-center shadow-md">
              <span className="text-[#0f172a] font-bold text-sm tracking-tight">AP</span>
            </div>
            <div>
              <h1 className="text-white font-bold text-base leading-none">Accession Partners</h1>
              <p className="text-[#b8973a] text-xs mt-0.5">Investment Research Dashboard</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-slate-400 hover:text-white text-sm transition-colors px-4 py-2 rounded-lg hover:bg-slate-700/50 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Page title */}
        <div className="mb-8">
          <h2 className="text-white text-2xl font-bold">Research Report Generator</h2>
          <p className="text-slate-400 text-sm mt-1">Upload a PDF document and/or provide context to generate a structured investment research report.</p>
        </div>

        {/* Input grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-7">
          {/* File upload */}
          <div className="bg-[#1e293b] rounded-2xl p-6 border border-slate-700/60">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 bg-[#b8973a]/15 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-[#b8973a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-white font-semibold text-sm">Upload Document</h3>
              <span className="text-slate-500 text-xs ml-auto">Optional</span>
            </div>

            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                isDragActive
                  ? 'border-[#b8973a] bg-[#b8973a]/8'
                  : file
                    ? 'border-[#b8973a]/50 bg-[#b8973a]/5'
                    : 'border-slate-600/70 hover:border-slate-500 hover:bg-slate-700/20'
              }`}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                  file ? 'bg-[#b8973a]/20' : 'bg-slate-700/50'
                }`}>
                  {file ? (
                    <svg className="w-6 h-6 text-[#b8973a]" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  )}
                </div>

                {isDragActive ? (
                  <p className="text-[#b8973a] font-medium text-sm">Drop PDF here</p>
                ) : file ? (
                  <div className="text-center">
                    <p className="text-white font-medium text-sm truncate max-w-[220px]">{file.name}</p>
                    <p className="text-slate-500 text-xs mt-1">{(file.size / 1024).toFixed(1)} KB · Click to replace</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-slate-300 text-sm font-medium">Drag & drop a PDF</p>
                    <p className="text-slate-500 text-xs mt-1">or click to browse files</p>
                  </div>
                )}
              </div>
            </div>

            {file && (
              <button
                onClick={(e) => { e.stopPropagation(); setFile(null) }}
                className="mt-3 w-full text-slate-500 hover:text-red-400 text-xs transition-colors flex items-center justify-center gap-1.5 py-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Remove file
              </button>
            )}
          </div>

          {/* Context input */}
          <div className="bg-[#1e293b] rounded-2xl p-6 border border-slate-700/60">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 bg-[#b8973a]/15 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-[#b8973a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="text-white font-semibold text-sm">Research Context</h3>
              <span className="text-slate-500 text-xs ml-auto">Optional</span>
            </div>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={`Add context, questions, or analysis instructions...\n\nExamples:\n• Focus on competitive moat and growth trajectory\n• Evaluate capital allocation and management quality\n• Analyze downside risk scenarios`}
              className="w-full h-[188px] bg-[#0f172a] border border-slate-600/70 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-[#b8973a] focus:ring-1 focus:ring-[#b8973a] transition-colors resize-none text-sm leading-relaxed"
            />
            <p className="text-slate-600 text-xs mt-2">
              Provide investment thesis, specific questions, or context to guide the analysis
            </p>
          </div>
        </div>

        {/* Generate button */}
        <div className="flex justify-center mb-8">
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="bg-[#b8973a] hover:bg-[#a07d2e] active:bg-[#8f6d27] text-[#0f172a] font-bold py-4 px-14 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-base flex items-center gap-3 shadow-lg shadow-[#b8973a]/20"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Generating Report...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Generate Research Report
              </>
            )}
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-900/25 border border-red-700/40 rounded-xl p-4 mb-8 flex items-start gap-3">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Report display */}
        {report && (
          <div className="bg-[#1e293b] rounded-2xl border border-slate-700/60 overflow-hidden">
            {/* Report header */}
            <div className="px-6 py-4 border-b border-slate-700/60 bg-[#1a2744]/50 flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-white font-bold text-base">Investment Research Report</h2>
                <p className="text-slate-500 text-xs mt-0.5">
                  {new Date().toLocaleDateString('en-US', {
                    year: 'numeric', month: 'long', day: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                  {report.usage && (
                    <span className="ml-2">
                      · {(report.usage.input_tokens + report.usage.output_tokens).toLocaleString()} tokens
                    </span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-2 px-3.5 py-2 bg-slate-700/60 hover:bg-slate-600/60 text-slate-300 hover:text-white rounded-lg transition-colors text-xs font-medium"
                >
                  {copied ? (
                    <>
                      <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-green-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy Text
                    </>
                  )}
                </button>

                <button
                  onClick={handleDownloadPDF}
                  className="flex items-center gap-2 px-3.5 py-2 bg-[#b8973a] hover:bg-[#a07d2e] text-[#0f172a] rounded-lg transition-colors text-xs font-bold"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download PDF
                </button>
              </div>
            </div>

            {/* Report content */}
            <div className="px-8 py-7 max-h-[680px] overflow-y-auto">
              <div className="max-w-none">
                {report.report.split('\n').map((line, i) => renderReportLine(line, i))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
