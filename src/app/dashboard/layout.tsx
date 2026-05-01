'use client'

import { useRouter } from 'next/navigation'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  const handleSignOut = async () => {
    await fetch('/api/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-[220px] bg-[#111111] border-r border-[#1e1e1e] flex flex-col flex-shrink-0">
        <div className="px-6 py-5 border-b border-[#1e1e1e]">
          <p className="text-white text-xs font-semibold tracking-widest leading-none">
            ACCESSION PARTNERS
          </p>
        </div>

        <div className="flex-1" />

        <div className="p-4 border-t border-[#1e1e1e]">
          <button
            onClick={handleSignOut}
            className="w-full text-left text-[#555555] hover:text-white text-xs py-2 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 bg-[#0D0D0D] min-w-0">
        {children}
      </main>
    </div>
  )
}
