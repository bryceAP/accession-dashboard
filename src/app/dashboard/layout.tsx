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
      {/* Fixed sidebar */}
      <aside
        className={`${mono.className} fixed top-0 left-0 h-screen w-[240px] bg-[#111111] border-r border-[#2a2a2a] flex flex-col z-10`}
      >
        {/* Wordmark */}
        <div className="px-6 py-6 border-b border-[#2a2a2a]">
          <span className="text-[#999999] text-xs tracking-widest">ACCESSION</span>
          <span className="text-[#C9A84C] text-xs tracking-widest"> PARTNERS</span>
        </div>

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

      {/* Content offset for fixed sidebar */}
      <main className="ml-[240px] flex-1 bg-[#0D0D0D] min-w-0 min-h-screen">
        {children}
      </main>
    </div>
  )
}
