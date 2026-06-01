// Map of fund-document types to the report fields they unlock during
// extraction. Shown on the fund page so users know which uploads will most
// improve completeness. Keep field names human-readable, not schema paths.

export interface DocTypeSpec {
  type: string
  unlocks: string[]
  // Whether this doc type is one of the "primary intelligence sources."
  // We surface a stronger "missing" warning for these.
  recommended: boolean
}

export const DOC_TYPE_SPECS: DocTypeSpec[] = [
  {
    type: 'Fact Sheet',
    recommended: true,
    unlocks: [
      'NAV per share',
      'Distribution rate',
      'Fund size',
      'Weighted-average yield',
      'Sector / loan-type / rating breakdowns',
      'Performance vs. benchmark',
    ],
  },
  {
    type: 'Tear Sheet',
    recommended: false,
    unlocks: [
      'NAV per share',
      'Performance series',
      'Headline portfolio statistics',
    ],
  },
  {
    type: '10-K',
    recommended: true,
    unlocks: [
      'PIK %',
      'Deployed %',
      'Non-accrual %',
      'Net leverage turns',
      'NAV history',
      'Fund-size history',
      'Capital flows (subscriptions / redemptions)',
      'Detailed fee structure',
    ],
  },
  {
    type: '10-Q',
    recommended: true,
    unlocks: [
      'Most recent NAV / AUM',
      'Most recent distribution',
      'Latest quarter PIK %, non-accrual %, deployed %',
      'Updated flow history',
    ],
  },
  {
    type: 'Annual Report',
    recommended: true,
    unlocks: [
      'PIK %',
      'Deployed %',
      'Non-accrual %',
      'Net leverage turns',
      'NAV / fund-size / distribution history',
      'Capital flows',
    ],
  },
  {
    type: 'PPM',
    recommended: false,
    unlocks: [
      'Management fee',
      'Performance fee / hurdle',
      'Liquidity terms',
      'Leverage target',
      'Suitability language',
    ],
  },
  {
    type: 'Supplement',
    recommended: false,
    unlocks: [
      'Fee / distribution / leverage updates layered on top of the PPM',
    ],
  },
  {
    type: 'Other',
    recommended: false,
    unlocks: [
      'Investor presentations and shareholder letters add narrative context',
    ],
  },
]

export const DOC_TYPES = DOC_TYPE_SPECS.map(s => s.type)

export interface DocCoverage {
  present: DocTypeSpec[]
  missingRecommended: DocTypeSpec[]
  missingOptional: DocTypeSpec[]
}

export function summarizeCoverage(uploadedTypes: string[]): DocCoverage {
  const set = new Set(uploadedTypes)
  const present: DocTypeSpec[] = []
  const missingRecommended: DocTypeSpec[] = []
  const missingOptional: DocTypeSpec[] = []
  for (const spec of DOC_TYPE_SPECS) {
    if (set.has(spec.type)) present.push(spec)
    else if (spec.recommended) missingRecommended.push(spec)
    else missingOptional.push(spec)
  }
  return { present, missingRecommended, missingOptional }
}
