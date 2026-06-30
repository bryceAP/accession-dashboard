'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { JetBrains_Mono } from 'next/font/google'
import { getSupabaseBrowser } from '@/lib/supabase-browser'

const mono = JetBrains_Mono({ subsets: ['latin'] })

type PaperStatus = {
  id: number
  strategy_name: string | null
  is_running: boolean | null
  started_at: string | null
  last_heartbeat: string | null
  connection_state: 'connected' | 'stopped' | 'disconnected' | null
  instrument: string | null
  position_side: 'LONG' | 'SHORT' | 'FLAT' | null
  position_qty: number | null
  position_avg_price: number | null
  current_price: number | null
  unrealized_pnl: number | null
  daily_pnl: number | null
  updated_at: string | null
}

type StatusPayload = {
  row: PaperStatus | null
  is_stale: boolean
  ms_since_heartbeat: number | null
}

type EventRow = {
  id: number | string
  ts: string
  event_type: string
  source: string
  data: Record<string, unknown> | null
}

type Trade = {
  entry_ts: string
  exit_ts: string | null
  instrument: string | null
  side: 'LONG' | 'SHORT' | null
  entry_price: number | null
  exit_price: number | null
  quantity: number | null
  pnl: number | null
  commission: number | null
  slippage: number | null
  exit_reason: string | null
  strategy_name: string | null
}

type TradesPayload = {
  since: string
  trades: Trade[]
  aggregate: {
    count: number
    gross_pnl: number
    net_pnl: number
    wins: number
    losses: number
  }
}

const STALE_MS = 90_000

export default function LivePage() {
  const supaRef = useRef(getSupabaseBrowser())
  const supa = supaRef.current

  const [status, setStatus] = useState<StatusPayload | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [events, setEvents] = useState<EventRow[]>([])
  const [trades, setTrades] = useState<TradesPayload | null>(null)
  const [tradesError, setTradesError] = useState<string | null>(null)
  const [, setTick] = useState(0)

  const refetchStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/live/status', { cache: 'no-store' })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`)
      setStatus(j)
      setStatusError(null)
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : 'Failed to load status')
    }
  }, [])

  const refetchEvents = useCallback(async () => {
    try {
      const r = await fetch('/api/live/events?limit=50', { cache: 'no-store' })
      if (!r.ok) return
      const j = (await r.json()) as EventRow[]
      setEvents(j)
    } catch {
      // surfaced via empty list
    }
  }, [])

  const refetchTrades = useCallback(async () => {
    try {
      const r = await fetch('/api/live/trades/today', { cache: 'no-store' })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`)
      setTrades(j)
      setTradesError(null)
    } catch (e) {
      setTradesError(e instanceof Error ? e.message : 'Failed to load trades')
    }
  }, [])

  useEffect(() => {
    refetchStatus()
    const ch = supa
      .channel('live-paper-status')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'paper_status', filter: 'id=eq.1' },
        () => refetchStatus(),
      )
      .subscribe()
    return () => {
      supa.removeChannel(ch)
    }
  }, [refetchStatus, supa])

  useEffect(() => {
    refetchEvents()
    const ch = supa
      .channel('live-paper-events')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'events', filter: 'source=eq.paper' },
        (payload) => {
          const row = payload.new as EventRow
          setEvents((prev) => [row, ...prev].slice(0, 50))
        },
      )
      .subscribe()
    return () => {
      supa.removeChannel(ch)
    }
  }, [refetchEvents, supa])

  useEffect(() => {
    refetchTrades()
    const i = setInterval(refetchTrades, 30_000)
    return () => clearInterval(i)
  }, [refetchTrades])

  // 1Hz tick so "12s ago" / freshness pill updates without depending on Realtime.
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(i)
  }, [])

  const row = status?.row ?? null
  // Recomputed every render (cheap) so the 1Hz tick rolls the pill from
  // LIVE → STALE as soon as last_heartbeat ages past STALE_MS.
  const liveState = deriveLiveState(row)

  return (
    <div className={`${mono.className} flex flex-col h-screen`}>
      <div className="flex items-center justify-between px-8 py-5 border-b border-[#2a2a2a] flex-shrink-0">
        <h1 className="text-[#E8E0D0] text-xs tracking-widest">LIVE</h1>
        <div className="text-[#444444] text-xs tracking-widest">PAPER · MES</div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-8 space-y-8">
        <StatusBanner status={status} error={statusError} liveState={liveState} />
        <PositionCard row={row} />
        <PnlRow row={row} trades={trades} />
        <TradesSection trades={trades} error={tradesError} />
        <EventTail events={events} />
      </div>
    </div>
  )
}

/* ─── status helpers ─────────────────────────────────────────── */

type LiveState = 'live' | 'stale' | 'stopped' | 'unknown'

function deriveLiveState(row: PaperStatus | null): LiveState {
  if (!row) return 'unknown'
  if (row.is_running === false) return 'stopped'
  const hbMs = row.last_heartbeat ? Date.parse(row.last_heartbeat) : NaN
  if (!Number.isFinite(hbMs)) return 'stale'
  const age = Date.now() - hbMs
  if (age > STALE_MS) return 'stale'
  if (row.is_running && row.connection_state === 'connected') return 'live'
  return 'stale'
}

const STATE_PILL: Record<LiveState, { label: string; cls: string }> = {
  live:    { label: 'LIVE',                       cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40' },
  stale:   { label: 'STALE — runner may be dead', cls: 'bg-red-500/15 text-red-400 border-red-500/40' },
  stopped: { label: 'STOPPED',                    cls: 'bg-[#1a1a1a] text-[#777777] border-[#2a2a2a]' },
  unknown: { label: 'NO STATUS',                  cls: 'bg-[#1a1a1a] text-[#777777] border-[#2a2a2a]' },
}

/* ─── banner ─────────────────────────────────────────────────── */

function StatusBanner({
  status,
  error,
  liveState,
}: {
  status: StatusPayload | null
  error: string | null
  liveState: LiveState
}) {
  const row = status?.row ?? null
  const pill = STATE_PILL[liveState]
  const startedAgo = row?.started_at ? humanDelta(Date.now() - Date.parse(row.started_at)) : null
  const hbAgo = row?.last_heartbeat
    ? humanDelta(Date.now() - Date.parse(row.last_heartbeat))
    : null

  return (
    <section className="border border-[#2a2a2a] bg-[#111111] p-6">
      {error ? (
        <p className="text-red-500 text-xs">{error}</p>
      ) : !status ? (
        <p className="text-[#444444] text-xs tracking-widest">LOADING…</p>
      ) : (
        <div className="flex flex-wrap items-center gap-6">
          <span
            className={`inline-flex items-center px-3 py-1.5 text-xs tracking-widest border ${pill.cls}`}
          >
            {pill.label}
          </span>
          <BannerStat label="STRATEGY" value={row?.strategy_name ?? '—'} />
          <BannerStat label="INSTRUMENT" value={row?.instrument ?? '—'} />
          <BannerStat label="CONNECTION" value={(row?.connection_state ?? '—').toUpperCase()} />
          <BannerStat label="STARTED" value={startedAgo ? `${startedAgo} ago` : '—'} />
          <BannerStat
            label="HEARTBEAT"
            value={hbAgo ? `${hbAgo} ago` : '—'}
            valueClass={liveState === 'stale' ? 'text-red-400' : undefined}
          />
        </div>
      )}
    </section>
  )
}

function BannerStat({
  label,
  value,
  valueClass,
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div>
      <p className="text-[#555555] text-[10px] tracking-widest mb-1">{label}</p>
      <p className={`text-[#E8E0D0] text-xs ${valueClass ?? ''}`}>{value}</p>
    </div>
  )
}

/* ─── position ───────────────────────────────────────────────── */

function PositionCard({ row }: { row: PaperStatus | null }) {
  const flat = !row || row.position_side === 'FLAT' || !row.position_side || !row.position_qty

  return (
    <section className="border border-[#2a2a2a] bg-[#111111] p-6">
      <h2 className="text-[#555555] text-xs tracking-widest mb-4">POSITION</h2>
      {flat ? (
        <p className="text-[#777777] text-xs tracking-wide">FLAT — no open position.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
          <PositionStat
            label="SIDE"
            value={row!.position_side ?? '—'}
            valueClass={row!.position_side === 'LONG' ? 'text-emerald-400' : 'text-red-400'}
          />
          <PositionStat label="QTY" value={fmtInt(row!.position_qty)} />
          <PositionStat label="AVG ENTRY" value={fmtPrice(row!.position_avg_price)} />
          <PositionStat label="LAST PRICE" value={fmtPrice(row!.current_price)} />
          <PositionStat
            label="UNREALIZED"
            value={fmtMoney(row!.unrealized_pnl)}
            valueClass={pnlColor(row!.unrealized_pnl)}
          />
        </div>
      )}
    </section>
  )
}

function PositionStat({
  label,
  value,
  valueClass,
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div>
      <p className="text-[#555555] text-[10px] tracking-widest mb-1">{label}</p>
      <p className={`text-sm tabular-nums text-[#E8E0D0] ${valueClass ?? ''}`}>{value}</p>
    </div>
  )
}

/* ─── P&L ────────────────────────────────────────────────────── */

function PnlRow({ row, trades }: { row: PaperStatus | null; trades: TradesPayload | null }) {
  const sessionRealized = row?.daily_pnl ?? 0
  const tradesGross = trades?.aggregate.gross_pnl ?? 0
  const tradesNet = trades?.aggregate.net_pnl ?? 0
  // daily_pnl from paper_status is the runner's session-realized total. The
  // trades-table sum is closed positions for today only. We surface both
  // so a divergence is visible (e.g. runner restarted mid-session).
  const grossTotal = tradesGross
  const netTotal = tradesNet

  return (
    <section className="border border-[#2a2a2a] bg-[#111111] p-6">
      <h2 className="text-[#555555] text-xs tracking-widest mb-4">{"TODAY'S P&L"}</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <PositionStat
          label="GROSS (CLOSED)"
          value={fmtMoney(grossTotal)}
          valueClass={pnlColor(grossTotal)}
        />
        <PositionStat
          label="NET (CLOSED)"
          value={fmtMoney(netTotal)}
          valueClass={pnlColor(netTotal)}
        />
        <PositionStat
          label="SESSION REALIZED"
          value={fmtMoney(sessionRealized)}
          valueClass={pnlColor(sessionRealized)}
        />
        <PositionStat
          label="TRADES"
          value={
            trades
              ? `${trades.aggregate.count} · ${trades.aggregate.wins}W / ${trades.aggregate.losses}L`
              : '—'
          }
        />
      </div>
    </section>
  )
}

/* ─── trades table ──────────────────────────────────────────── */

function TradesSection({
  trades,
  error,
}: {
  trades: TradesPayload | null
  error: string | null
}) {
  return (
    <section className="border border-[#2a2a2a] bg-[#111111]">
      <div className="px-6 py-4 border-b border-[#2a2a2a] flex items-center justify-between">
        <h2 className="text-[#555555] text-xs tracking-widest">{"TODAY'S TRADES"}</h2>
        <span className="text-[#444444] text-[10px] tracking-widest">
          {trades ? `${trades.aggregate.count} CLOSED` : ''}
        </span>
      </div>
      {error ? (
        <p className="text-red-500 text-xs px-6 py-4">{error}</p>
      ) : !trades ? (
        <p className="text-[#444444] text-xs tracking-widest px-6 py-4">LOADING…</p>
      ) : trades.trades.length === 0 ? (
        <p className="text-[#555555] text-xs px-6 py-6">No closed trades today.</p>
      ) : (
        <div className="max-h-[420px] overflow-y-auto">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 bg-[#111111]">
              <tr className="border-b border-[#2a2a2a]">
                {['TIME', 'SIDE', 'QTY', 'ENTRY', 'EXIT', 'PNL', 'COMM', 'SLIP', 'EXIT REASON'].map(
                  (c, i) => (
                    <th
                      key={c}
                      className={`text-[#444444] tracking-widest pb-3 pt-3 px-4 font-normal whitespace-nowrap ${
                        i <= 1 ? 'text-left' : 'text-right'
                      }`}
                    >
                      {c}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {trades.trades.map((t, idx) => (
                <tr key={`${t.entry_ts}-${idx}`} className="border-b border-[#1a1a1a]">
                  <td className="text-[#E8E0D0] px-4 py-3 whitespace-nowrap">{fmtTimeEt(t.entry_ts)}</td>
                  <td
                    className={`px-4 py-3 tracking-widest ${
                      t.side === 'LONG' ? 'text-emerald-400' : t.side === 'SHORT' ? 'text-red-400' : 'text-[#777777]'
                    }`}
                  >
                    {t.side ?? '—'}
                  </td>
                  <td className="text-[#E8E0D0] tabular-nums text-right px-4 py-3">{fmtInt(t.quantity)}</td>
                  <td className="text-[#E8E0D0] tabular-nums text-right px-4 py-3">{fmtPrice(t.entry_price)}</td>
                  <td className="text-[#E8E0D0] tabular-nums text-right px-4 py-3">{fmtPrice(t.exit_price)}</td>
                  <td className={`tabular-nums text-right px-4 py-3 ${pnlColor(t.pnl)}`}>{fmtMoney(t.pnl)}</td>
                  <td className="text-[#777777] tabular-nums text-right px-4 py-3">{fmtMoney(t.commission)}</td>
                  <td className="text-[#777777] tabular-nums text-right px-4 py-3">{fmtMoney(t.slippage)}</td>
                  <td className="text-[#777777] text-right px-4 py-3 whitespace-nowrap">{t.exit_reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

/* ─── event tail ─────────────────────────────────────────────── */

const EVENT_BADGE: Record<string, string> = {
  order_filled: 'text-emerald-400 border-emerald-500/40',
  system_stop: 'text-red-400 border-red-500/40',
  position_opened: 'text-amber-400 border-amber-500/40',
  position_closed: 'text-amber-400 border-amber-500/40',
  connection_state: 'text-[#999999] border-[#2a2a2a]',
  subscription: 'text-[#999999] border-[#2a2a2a]',
  order_submitted: 'text-[#999999] border-[#2a2a2a]',
  system_start: 'text-[#999999] border-[#2a2a2a]',
}
const EVENT_BADGE_DEFAULT = 'text-[#999999] border-[#2a2a2a]'

function EventTail({ events }: { events: EventRow[] }) {
  return (
    <section className="border border-[#2a2a2a] bg-[#111111]">
      <div className="px-6 py-4 border-b border-[#2a2a2a] flex items-center justify-between">
        <h2 className="text-[#555555] text-xs tracking-widest">EVENT TAIL</h2>
        <span className="text-[#444444] text-[10px] tracking-widest">
          LAST {events.length}
        </span>
      </div>
      {events.length === 0 ? (
        <p className="text-[#555555] text-xs px-6 py-6">No events.</p>
      ) : (
        <div className="max-h-[480px] overflow-y-auto">
          <ul className="divide-y divide-[#1a1a1a]">
            {events.map((e) => (
              <li key={String(e.id)} className="flex items-baseline gap-4 px-6 py-2.5">
                <span className="text-[#777777] text-xs tabular-nums whitespace-nowrap">
                  {fmtTimeEt(e.ts)}
                </span>
                <span
                  className={`text-[10px] tracking-widest px-2 py-0.5 border whitespace-nowrap ${
                    EVENT_BADGE[e.event_type] ?? EVENT_BADGE_DEFAULT
                  }`}
                >
                  {e.event_type.toUpperCase()}
                </span>
                <span className="text-[#E8E0D0] text-xs truncate">{eventSummary(e)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function eventSummary(e: EventRow): string {
  const d = (e.data ?? {}) as Record<string, unknown>
  const s = (k: string) => (d[k] == null ? '' : String(d[k]))
  const n = (k: string): number | null => {
    const v = d[k]
    if (v == null) return null
    const num = Number(v)
    return Number.isFinite(num) ? num : null
  }
  switch (e.event_type) {
    case 'system_start': {
      const tags = [s('dry_run') === 'true' ? '[dry-run]' : '', s('flatten') === 'true' ? '[flatten]' : '']
        .filter(Boolean)
        .join(' ')
      return `${s('strategy')} on ${s('instrument')}${tags ? ' ' + tags : ''}`.trim()
    }
    case 'system_stop':
      return `${s('strategy')} on ${s('instrument')}`.trim()
    case 'connection_state':
      return s('status') || '—'
    case 'subscription':
      return `${s('instrument')} ${s('bar_type')}`.trim()
    case 'order_submitted':
      return `${s('instrument_id')} ${s('client_order_id')}`.trim()
    case 'order_filled': {
      const slip = n('slippage')
      const comm = n('commission')
      return `${s('side')} ${fmtInt(n('qty'))} @ ${fmtPrice(n('price'))}` +
        ` (slip ${slip == null ? '—' : slip.toFixed(2)}, comm ${comm == null ? '—' : comm.toFixed(2)})`
    }
    case 'position_opened':
      return `${s('side')} ${fmtInt(n('qty'))} ${s('instrument')} @ ${fmtPrice(n('entry_price'))}`
    case 'position_closed': {
      const pnl = n('pnl_gross')
      return `${s('side')} ${fmtInt(n('qty'))} ${s('instrument')} pnl ${fmtMoney(pnl)}` +
        ` (${fmtPrice(n('entry_price'))} → ${fmtPrice(n('exit_price'))})`
    }
    default:
      return ''
  }
}

/* ─── format helpers ─────────────────────────────────────────── */

const timeEtFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

function fmtTimeEt(iso: string | null): string {
  if (!iso) return '—'
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return '—'
  return timeEtFmt.format(new Date(ms))
}

function fmtInt(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(Number(v))) return '—'
  return String(Math.trunc(Number(v)))
}

function fmtPrice(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(Number(v))) return '—'
  return Number(v).toFixed(2)
}

function fmtMoney(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(Number(v))) return '—'
  const n = Number(v)
  const sign = n < 0 ? '-' : ''
  return `${sign}$${Math.abs(n).toFixed(2)}`
}

function pnlColor(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(Number(v))) return 'text-[#777777]'
  const n = Number(v)
  if (n > 0) return 'text-emerald-400'
  if (n < 0) return 'text-red-400'
  return 'text-[#999999]'
}

function humanDelta(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const rm = m % 60
  if (h < 24) return rm ? `${h}h ${rm}m` : `${h}h`
  const d = Math.floor(h / 24)
  const rh = h % 24
  return rh ? `${d}d ${rh}h` : `${d}d`
}
