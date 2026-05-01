import { JetBrains_Mono } from 'next/font/google'

const mono = JetBrains_Mono({ subsets: ['latin'] })

export default function Loading() {
  return (
    <div
      className={mono.className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#0D0D0D',
      }}
    >
      <p
        style={{
          fontSize: 11,
          color: '#444444',
          letterSpacing: '0.2em',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}
      >
        LOADING...
      </p>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  )
}
