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
  // Build the list of charts that actually have data
  const charts: { title: string; data: Slice[] }[] = []

  if (composition?.sector_breakdown?.length) {
    charts.push({ title: 'SECTOR', data: composition.sector_breakdown })
  }
  if (composition?.rating_breakdown?.length) {
    charts.push({
      title: 'RATING',
      data: composition.rating_breakdown.map(d => ({ name: d.rating, pct: d.pct })),
    })
  }
  if (composition?.loan_type_breakdown?.length) {
    charts.push({
      title: 'LOAN TYPE',
      data: composition.loan_type_breakdown.map(d => ({ name: d.type, pct: d.pct })),
    })
  }
  if (composition?.geographic_breakdown?.length) {
    charts.push({
      title: 'GEOGRAPHY',
      data: composition.geographic_breakdown.map(d => ({ name: d.region, pct: d.pct })),
    })
  }

  // If nothing has data, render nothing (parent section can be hidden by caller)
  if (charts.length === 0) return null

  // Use a 2-column grid; single chart spans both columns
  const isSingle = charts.length === 1
  return (
    <div className={isSingle ? 'grid grid-cols-1 gap-8' : 'grid grid-cols-2 gap-8'}>
      {charts.map(c => (
        <MiniDonut key={c.title} title={c.title} data={c.data} />
      ))}
    </div>
  )
}
