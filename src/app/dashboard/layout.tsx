'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { JetBrains_Mono } from 'next/font/google'

const mono = JetBrains_Mono({ subsets: ['latin'] })

const NAV_LINKS = [
  { label: 'FUNDS', href: '/dashboard/funds' },
  { label: 'REPORTS', href: '/dashboard/reports' },
  { label: 'DOCUMENTS', href: '/dashboard/documents' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const handleSignOut = async () => {
    await fetch('/api/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <div className="flex min-h-screen">
      <aside
        className={`${mono.className} fixed top-0 left-0 h-screen w-[240px] bg-[#111111] border-r border-[#2a2a2a] flex flex-col z-10`}
      >
        {/* Logo */}
        <div className="px-6 py-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/White V2.png" alt="Accession Partners" style={{ maxWidth: 140 }} />
        </div>
        <div style={{ height: 1, background: '#1e1e1e' }} />

        {/* Nav */}
        <nav className="flex-1 pt-2">
          {NAV_LINKS.map(({ label, href }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center px-6 py-3 text-xs tracking-widest transition-colors ${
                  active
                    ? 'text-[#E8E0D0] bg-[#1a1a1a] border-l border-[#C9A84C]'
                    : 'text-[#555555] hover:text-[#999999] border-l border-transparent'
                }`}
              >
                {label}
              </Link>
            )
          })}
        </nav>

        {/* User + Logout */}
        <div className="px-6 py-5 border-t border-[#2a2a2a]">
          {process.env.NEXT_PUBLIC_ADMIN_EMAIL && (
            <p className="text-[#444444] text-xs tracking-wide mb-3 truncate">
              {process.env.NEXT_PUBLIC_ADMIN_EMAIL}
            </p>
          )}
          <button
            onClick={handleSignOut}
            className="text-[#444444] hover:text-[#999999] text-xs tracking-widest transition-colors"
          >
            SIGN OUT
          </button>
        </div>
      </aside>

      <main className="ml-[240px] flex-1 bg-[#0D0D0D] min-w-0 min-h-screen">
        {children}
      </main>
    </div>
  )
}
