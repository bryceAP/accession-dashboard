import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { etTodayStartUtc } from '@/lib/et-time'

export const dynamic = 'force-dynamic'

export async function GET() {
  const since = etTodayStartUtc().toISOString()

  const { data, error } = await supabase
    .from('trades')
    .select(
      'entry_ts, exit_ts, instrument, side, entry_price, exit_price, quantity, pnl, commission, slippage, exit_reason, strategy_name',
    )
    .eq('source', 'paper')
    .is('backtest_id', null)
    .gte('entry_ts', since)
    .order('entry_ts', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const trades = data ?? []
  let gross = 0
  let net = 0
  let wins = 0
  let losses = 0
  for (const t of trades) {
    const pnl = Number(t.pnl ?? 0)
    const comm = Number(t.commission ?? 0)
    const slip = Number(t.slippage ?? 0)
    gross += pnl
    net += pnl - comm - slip
    if (pnl > 0) wins += 1
    else if (pnl < 0) losses += 1
  }

  return NextResponse.json({
    since,
    trades,
    aggregate: {
      count: trades.length,
      gross_pnl: gross,
      net_pnl: net,
      wins,
      losses,
    },
  })
}
