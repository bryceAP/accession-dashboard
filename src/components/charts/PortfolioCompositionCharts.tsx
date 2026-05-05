'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { PortfolioComposition } from '@/types'
import { chartTheme, tooltipContentStyle, tooltipItemStyle } from './theme'

interface Props {
  composition: PortfolioComposition | null | undefined
}

interface Slice {
  name: string
  pct: number
}

function NoData() {
  return (
    <div
      className="flex items-center justify-center border border-[#1e1e1e]"
      style={{ height: 180, fontFamily: chartTheme.fontFamily }}
    >
      <p className="text-xs tracking-widest" style={{ color: '#333' }}>NO DATA</p>
    </div>
  )
}

function PieLegend({ data }: { data: Slice[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', marginTop: 4 }}>
      {data.map((d, i) => (
        <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div
            style={{
              width: 7,
              height: 7,
              backgroundColor: chartTheme.piePalette[i % chartTheme.piePalette.length],
              flexShrink: 0,
            }}
          />
          <span style={{ fontFamily: chartTheme.fontFamily, fontSize: 9, color: chartTheme.textDim }}>
            {d.name} {(d.pct ?? 0).toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  )
}

function MiniDonut({ title, data }: { title: string; data: Slice[] }) {
  if (!data?.length) {
    return (
      <div>
        <p style={{ fontFamily: chartTheme.fontFamily, fontSize: 9, color: chartTheme.textDim, letterSpacing: '0.1em', marginBottom: 8 }}>
          {title}
        </p>
        <NoData />
      </div>
    )
  }

  return (
    <div>
      <p style={{ fontFamily: chartTheme.fontFamily, fontSize: 9, color: chartTheme.textDim, letterSpacing: '0.1em', marginBottom: 6 }}>
        {title}
      </p>
      <div style={{ width: '100%', height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="pct"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="45%"
              outerRadius="72%"
              paddingAngle={1}
              strokeWidth={0}
            >
              {data.map((_, i) => (
                <Cell
                  key={i}
                  fill={chartTheme.piePalette[i % chartTheme.piePalette.length]}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipContentStyle}
              itemStyle={{ ...tooltipItemStyle, color: chartTheme.bone }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any) => [typeof v === 'number' ? `${v.toFixed(1)}%` : String(v)]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <PieLegend data={data} />
    </div>
  )
}

export function PortfolioCompositionCharts({ composition }: Props) {
  if (!composition) {
    return (
      <div className="grid grid-cols-2 gap-6">
        {['SECTOR', 'RATING', 'LOAN TYPE', 'GEOGRAPHY'].map(t => (
          <div key={t}>
            <p style={{ fontFamily: chartTheme.fontFamily, fontSize: 9, color: chartTheme.textDim, letterSpacing: '0.1em', marginBottom: 8 }}>
              {t}
            </p>
            <NoData />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-8">
      <MiniDonut title="SECTOR" data={composition.sector_breakdown ?? []} />
      <MiniDonut
        title="RATING"
        data={composition.rating_breakdown?.map(d => ({ name: d.rating, pct: d.pct })) ?? []}
      />
      <MiniDonut
        title="LOAN TYPE"
        data={composition.loan_type_breakdown?.map(d => ({ name: d.type, pct: d.pct })) ?? []}
      />
      <MiniDonut
        title="GEOGRAPHY"
        data={composition.geographic_breakdown?.map(d => ({ name: d.region, pct: d.pct })) ?? []}
      />
    </div>
  )
}
