'use client'

import { useEffect } from 'react'
import { JetBrains_Mono } from 'next/font/google'

const mono = JetBrains_Mono({ subsets: ['latin'] })

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[dashboard error]', error)
  }, [error])

  return (
    <div className={`${mono.className} flex flex-col items-center justify-center min-h-[60vh] px-8`}>
      <p className="text-red-500 text-xs tracking-widest mb-4">SOMETHING WENT WRONG</p>
      <p className="text-[#666666] text-xs mb-2 max-w-md text-center leading-relaxed">
        {error.message || 'An unexpected error occurred while loading this page.'}
      </p>
      {error.digest && (
        <p className="text-[#333333] text-[10px] tracking-widest mb-8">
          REF · {error.digest}
        </p>
      )}
      <div className="flex gap-3 mt-2">
        <button
          onClick={reset}
          className="bg-[#C9A84C] text-black text-xs tracking-widest px-5 py-2 hover:bg-[#b8973a] transition-colors"
        >
          TRY AGAIN
        </button>
        <button
          onClick={() => { window.location.href = '/dashboard/funds' }}
          className="border border-[#2a2a2a] text-[#999999] hover:border-[#3a3a3a] hover:text-[#E8E0D0] text-xs tracking-widest px-5 py-2 transition-colors"
        >
          BACK TO FUNDS
        </button>
      </div>
    </div>
  )
}
