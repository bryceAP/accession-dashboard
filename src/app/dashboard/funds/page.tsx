'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { JetBrains_Mono } from 'next/font/google'
import { format } from 'date-fns'

const mono = JetBrains_Mono({ subsets: ['latin'] })

interface Fund {
  id: string
  name: string
  manager: string | null
  strategy: string | null
  ticker: string | null
  isin: string | null
  status: 'pending' | 'running' | 'complete' | 'error'
  last_run_at: string | null
  created_at: string
}

const STRATEGIES = ['Private Credit']

const STATUS_COLOR: Record<string, string> = {
  pending: 'text-[#555555]',
  running: 'text-[#C9A84C]',
  complete: 'text-emerald-500',
  error: 'text-red-500',
}

const COLS = ['FUND NAME', 'MANAGER', 'STRATEGY', 'LAST RUN', 'STATUS', 'ACTIONS']

const emptyForm = { name: '', manager: '', strategy: 'Private Credit', ticker: '', isin: '' }

export default function FundsPage() {
  const router = useRouter()
  const [funds, setFunds] = useState<Fund[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')

  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const [postSave, setPostSave] = useState<Fund | null>(null)

  const fetchFunds = useCallback(async () => {
    try {
      const res = await fetch('/api/funds')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      setFunds(json)
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'Failed to load funds.')
    } finally {
      setPageLoading(false)
    }
  }, [])

  useEffect(() => { fetchFunds() }, [fetchFunds])

  const openAdd = () => {
    setForm(emptyForm)
    setFormError('')
    setAddOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setFormError('Fund name is required'); return }
    setSaving(true)
    setFormError('')

    const res = await fetch('/api/funds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name.trim(),
        manager: form.manager.trim() || null,
        strategy: form.strategy || null,
        ticker: form.ticker.trim() || null,
        isin: form.isin.trim() || null,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setFormError(data.error ?? 'Failed to create fund')
      setSaving(false)
      return
    }

    setFunds((prev) => [data, ...prev])
    setSaving(false)
    setAddOpen(false)
    setPostSave(data)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this fund? This cannot be undone.')) return
    await fetch(`/api/funds/${id}`, { method: 'DELETE' })
    setFunds((prev) => prev.filter((f) => f.id !== id))
  }

  return (
    <div className={`${mono.className} flex flex-col h-screen`}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-[#2a2a2a] flex-shrink-0">
        <h1 className="text-[#E8E0D0] text-xs tracking-widest">FUNDS</h1>
        <button
          onClick={openAdd}
          className="bg-[#C9A84C] text-black text-xs tracking-widest px-4 py-2 hover:bg-[#b8973a] transition-colors"
        >
          + ADD FUND
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-8 py-8">
        {pageLoading ? (
          <p className="text-[#444444] text-xs tracking-widest">LOADING...</p>
        ) : fetchError ? (
          <p className="text-red-500 text-xs">{fetchError}</p>
        ) : funds.length === 0 ? (
          <EmptyState onAdd={openAdd} />
        ) : (
          <FundTable funds={funds} onDelete={handleDelete} />
        )}
      </div>

      {/* Add Fund modal */}
      {addOpen && (
        <Overlay onClose={() => setAddOpen(false)}>
          <div className="border-b border-[#2a2a2a] px-8 py-5">
            <p className="text-[#E8E0D0] text-xs tracking-widest">ADD FUND</p>
          </div>
          <form onSubmit={handleSave} className="px-8 py-6 space-y-5">
            <Field label="FUND NAME" required>
              <TextInput
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
                autoFocus
              />
            </Field>
            <Field label="MANAGER">
              <TextInput value={form.manager} onChange={(v) => setForm({ ...form, manager: v })} />
            </Field>
            <Field label="STRATEGY">
              <select
                value={form.strategy}
                onChange={(e) => setForm({ ...form, strategy: e.target.value })}
                className="w-full bg-[#0D0D0D] border border-[#2a2a2a] text-[#E8E0D0] text-xs px-3 py-2.5 outline-none focus:border-[#3a3a3a] rounded-none appearance-none"
              >
                {STRATEGIES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="TICKER / ID">
                <TextInput
                  value={form.ticker}
                  onChange={(v) => setForm({ ...form, ticker: v })}
                  placeholder="Optional"
                />
              </Field>
              <Field label="ISIN">
                <TextInput
                  value={form.isin}
                  onChange={(v) => setForm({ ...form, isin: v })}
                  placeholder="Optional"
                />
              </Field>
            </div>
            {formError && <p className="text-red-500 text-xs">{formError}</p>}
            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="bg-[#C9A84C] text-black text-xs tracking-widest px-6 py-2.5 hover:bg-[#b8973a] transition-colors disabled:opacity-50"
              >
                {saving ? 'SAVING...' : 'SAVE FUND'}
              </button>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="text-[#555555] hover:text-[#999999] text-xs tracking-widest px-4 py-2.5 transition-colors"
              >
                CANCEL
              </button>
            </div>
          </form>
        </Overlay>
      )}

      {/* Post-save prompt */}
      {postSave && (
        <Overlay onClose={() => setPostSave(null)}>
          <div className="px-8 py-10 text-center">
            <p className="text-[#555555] text-xs tracking-widest mb-1">FUND CREATED</p>
            <p className="text-[#C9A84C] text-xs tracking-wide mb-10">{postSave.name}</p>
            <p className="text-[#555555] text-xs tracking-widest mb-6">WHAT WOULD YOU LIKE TO DO NEXT?</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => router.push(`/dashboard/funds/${postSave.id}`)}
                className="border border-[#2a2a2a] text-[#999999] text-xs tracking-widest px-5 py-2.5 hover:border-[#3a3a3a] hover:text-[#E8E0D0] transition-colors"
              >
                UPLOAD DOCUMENTS
              </button>
              <button
                onClick={() => setPostSave(null)}
                className="bg-[#C9A84C] text-black text-xs tracking-widest px-5 py-2.5 hover:bg-[#b8973a] transition-colors"
              >
                RUN NOW
              </button>
            </div>
          </div>
        </Overlay>
      )}
    </div>
  )
}

/* ─── Sub-components ──────────────────────────────────────────── */

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-32">
      <p className="text-[#333333] text-xs tracking-widest mb-2">NO FUNDS</p>
      <p className="text-[#2a2a2a] text-xs mb-8">Add your first fund to get started.</p>
      <button
        onClick={onAdd}
        className="border border-[#2a2a2a] text-[#555555] hover:text-[#999999] hover:border-[#3a3a3a] text-xs tracking-widest px-6 py-2.5 transition-colors"
      >
        + ADD FUND
      </button>
    </div>
  )
}

function FundTable({
  funds,
  onDelete,
}: {
  funds: Fund[]
  onDelete: (id: string) => void
}) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b border-[#2a2a2a]">
          {COLS.map((col) => (
            <th
              key={col}
              className="text-left text-[#444444] text-xs tracking-widest pb-3 pr-8 font-normal whitespace-nowrap"
            >
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {funds.map((fund) => (
          <tr key={fund.id} className="border-b border-[#1a1a1a] group hover:bg-[#131313] transition-colors">
            <td className="text-[#E8E0D0] text-xs py-4 pr-8 whitespace-nowrap">{fund.name}</td>
            <td className="text-[#777777] text-xs py-4 pr-8">{fund.manager ?? '—'}</td>
            <td className="text-[#777777] text-xs py-4 pr-8">{fund.strategy ?? '—'}</td>
            <td className="text-[#777777] text-xs py-4 pr-8 whitespace-nowrap">
              {fund.last_run_at ? format(new Date(fund.last_run_at), 'MMM d, yyyy') : '—'}
            </td>
            <td className={`text-xs py-4 pr-8 tracking-widest ${STATUS_COLOR[fund.status] ?? 'text-[#555555]'}`}>
              {fund.status.toUpperCase()}
            </td>
            <td className="text-xs py-4">
              <div className="flex gap-5">
                <Link href={`/dashboard/funds/${fund.id}`} className="text-[#555555] hover:text-[#E8E0D0] tracking-widest transition-colors">
                  VIEW
                </Link>
                <button className="text-[#555555] hover:text-[#C9A84C] tracking-widest transition-colors">
                  RE-RUN
                </button>
                <button
                  onClick={() => onDelete(fund.id)}
                  className="text-[#555555] hover:text-red-500 tracking-widest transition-colors"
                >
                  DELETE
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className={`${mono.className} bg-[#111111] border border-[#2a2a2a] w-full max-w-[480px] max-h-[90vh] overflow-y-auto`}
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

function TextInput({
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoFocus?: boolean
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className="w-full bg-[#0D0D0D] border border-[#2a2a2a] text-[#E8E0D0] text-xs px-3 py-2.5 outline-none focus:border-[#3a3a3a] rounded-none placeholder-[#333333]"
    />
  )
}
