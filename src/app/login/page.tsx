'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { JetBrains_Mono } from 'next/font/google'

const mono = JetBrains_Mono({ subsets: ['latin'] })

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
      className={mono.className}
      style={{
        minHeight: '100vh',
        background: '#0A0A0A',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 320 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/Accession Partners Logo.jpg"
          alt="Accession Partners"
          style={{ maxWidth: 180, marginBottom: 32 }}
        />

        <p style={{ color: '#555555', fontSize: 11, letterSpacing: '0.15em', marginBottom: 8 }}>
          Fund Research Platform
        </p>
        <p style={{ color: '#333333', fontSize: 11, letterSpacing: '0.1em', marginBottom: 48 }}>
          Authorized Access Only
        </p>

        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            style={{
              width: '100%',
              background: '#111111',
              border: '1px solid #2a2a2a',
              color: '#ffffff',
              padding: '12px',
              fontSize: 12,
              outline: 'none',
              borderRadius: 0,
              boxSizing: 'border-box',
              marginBottom: 8,
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: '#C9A84C',
              color: '#000000',
              fontWeight: 500,
              padding: '12px',
              fontSize: 12,
              letterSpacing: '0.1em',
              border: 'none',
              borderRadius: 0,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            ENTER
          </button>
          {error && (
            <p style={{ color: '#ef4444', fontSize: 11, marginTop: 8 }}>{error}</p>
          )}
        </form>
      </div>

      <p
        style={{
          position: 'fixed',
          bottom: 24,
          color: '#2a2a2a',
          fontSize: 10,
          letterSpacing: '0.08em',
        }}
      >
        Accession Partners LLC · Registered Investment Adviser · Colorado
      </p>
    </div>
  )
}
