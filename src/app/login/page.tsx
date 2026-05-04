'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { JetBrains_Mono } from 'next/font/google'

const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'] })

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    if (res.ok) {
      router.push('/dashboard')
    } else {
      setError('Incorrect password')
      setLoading(false)
    }
  }

  return (
    <div
      className={`${jetbrainsMono.className} min-h-screen flex flex-col items-center justify-center`}
      style={{ background: '#0A0A0A' }}
    >
      <div className="flex flex-col items-center w-full max-w-[360px] px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/Accession Partners Logo.jpg"
          alt="Accession Partners"
          style={{ maxWidth: 220, marginBottom: 24 }}
        />
        <p style={{ color: '#666666', fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>
          Fund Research Platform
        </p>
        <p style={{ color: '#444444', fontSize: 10, letterSpacing: '0.1em', marginBottom: 40 }}>
          Authorized Access Only
        </p>

        <form onSubmit={handleSubmit} className="w-full">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full bg-[#111111] border border-[#2a2a2a] text-white p-3 rounded-none outline-none placeholder-[#444444] focus:border-[#3a3a3a] mb-3"
            autoFocus
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#C9A84C] text-black font-medium p-3 rounded-none hover:bg-[#b8973a] transition-colors disabled:opacity-60"
          >
            {loading ? '...' : 'Enter'}
          </button>
          {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
        </form>
      </div>

      <p
        style={{
          color: '#333333',
          fontSize: 9,
          letterSpacing: '0.08em',
          position: 'fixed',
          bottom: 24,
          textAlign: 'center',
        }}
      >
        Accession Partners LLC · Registered Investment Adviser · Colorado
      </p>
    </div>
  )
}
