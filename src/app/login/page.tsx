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
    <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center">
      <div className="w-full max-w-[400px] border border-[#2a2a2a] p-10">
        <div className="mb-8">
          <p className={`${jetbrainsMono.className} text-xs tracking-widest`}>
            <span className="text-[#999999]">ACCESSION</span>
            <span className="text-[#C9A84C]"> PARTNERS</span>
          </p>
          <p className="text-[#444444] text-sm mt-2">Fund Research Platform</p>
        </div>

        <form onSubmit={handleSubmit}>
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
          {error && (
            <p className="text-red-500 text-xs mt-2">{error}</p>
          )}
        </form>
      </div>
    </div>
  )
}
