import type React from 'react'

export const chartTheme = {
  bg: '#0D0D0D',
  grid: '#1a1a1a',
  amber: '#C9A84C',
  amberDim: '#b8973a',
  bone: '#E8E0D0',
  muted: '#555555',
  mutedMid: '#777777',
  textPrimary: '#E8E0D0',
  textSecondary: '#999999',
  textDim: '#555555',
  border: '#2a2a2a',
  redText: '#f87171',
  fontFamily: '"JetBrains Mono", monospace',
  piePalette: [
    '#C9A84C', '#E8E0D0', '#888888', '#555555',
    '#b8973a', '#aaaaaa', '#3d3d3d', '#666666',
  ],
} as const

export const axisTickProps = {
  fill: '#555555' as string,
  fontSize: 10,
  fontFamily: '"JetBrains Mono", monospace' as string,
}

export const tooltipContentStyle: React.CSSProperties = {
  backgroundColor: '#111111',
  border: '1px solid #2a2a2a',
  borderRadius: 0,
  fontFamily: '"JetBrains Mono", monospace',
  fontSize: 10,
  color: '#E8E0D0',
  padding: '8px 12px',
}

export const tooltipLabelStyle: React.CSSProperties = {
  color: '#999999',
  fontFamily: '"JetBrains Mono", monospace',
  fontSize: 10,
  marginBottom: 4,
}

export const tooltipItemStyle: React.CSSProperties = {
  fontFamily: '"JetBrains Mono", monospace',
  fontSize: 10,
}
