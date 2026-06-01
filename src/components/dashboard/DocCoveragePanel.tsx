'use client'

import { useMemo } from 'react'
import { summarizeCoverage, type DocTypeSpec } from '@/lib/docCoverage'

interface Props {
  uploadedTypes: string[]
}

function TypeRow({
  spec,
  status,
}: {
  spec: DocTypeSpec
  status: 'present' | 'missing-recommended' | 'missing-optional'
}) {
  const dotColor =
    status === 'present'
      ? '#C9A84C'
      : status === 'missing-recommended'
        ? '#f87171'
        : '#3a3a3a'
  const labelColor =
    status === 'present' ? '#E8E0D0' : status === 'missing-recommended' ? '#999' : '#555'
  const unlocksColor = status === 'present' ? '#555' : status === 'missing-recommended' ? '#777' : '#3a3a3a'

  return (
    <li style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
      <span
        style={{
          width: 6,
          height: 6,
          background: dotColor,
          borderRadius: '50%',
          flexShrink: 0,
          marginTop: 6,
        }}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: '0.1em',
            color: labelColor,
            textTransform: 'uppercase',
          }}
        >
          {spec.type}
          {status === 'present' && (
            <span style={{ color: '#C9A84C', marginLeft: 8 }}>UPLOADED</span>
          )}
          {status === 'missing-recommended' && (
            <span style={{ color: '#f87171', marginLeft: 8 }}>RECOMMENDED</span>
          )}
        </div>
        <div style={{ fontSize: 10, color: unlocksColor, marginTop: 2, lineHeight: 1.5 }}>
          {spec.unlocks.join(' · ')}
        </div>
      </div>
    </li>
  )
}

export function DocCoveragePanel({ uploadedTypes }: Props) {
  const { present, missingRecommended, missingOptional } = useMemo(
    () => summarizeCoverage(uploadedTypes),
    [uploadedTypes],
  )

  const presentCount = present.length
  const recommendedTotal = present.filter(s => s.recommended).length + missingRecommended.length
  const recommendedPresent = present.filter(s => s.recommended).length

  return (
    <div
      className="border border-[#2a2a2a]"
      style={{ padding: '18px 20px', marginBottom: 24, fontFamily: 'inherit' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <h3 style={{ fontSize: 11, letterSpacing: '0.2em', color: '#777' }}>
          DOCUMENT COVERAGE
        </h3>
        <span style={{ fontSize: 10, color: '#555', letterSpacing: '0.1em' }}>
          {recommendedPresent}/{recommendedTotal} RECOMMENDED · {presentCount} TOTAL
        </span>
      </div>

      {missingRecommended.length > 0 && (
        <div
          style={{
            fontSize: 10,
            color: '#f87171',
            marginBottom: 12,
            letterSpacing: '0.05em',
          }}
        >
          Adding the recommended document types below will materially raise report
          completeness.
        </div>
      )}

      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {present.map(spec => (
          <TypeRow key={spec.type} spec={spec} status="present" />
        ))}
        {missingRecommended.map(spec => (
          <TypeRow key={spec.type} spec={spec} status="missing-recommended" />
        ))}
        {missingOptional.map(spec => (
          <TypeRow key={spec.type} spec={spec} status="missing-optional" />
        ))}
      </ul>
    </div>
  )
}
