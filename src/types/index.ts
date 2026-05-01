export interface NavHistory {
  date: string
  nav: number
}

export interface FundSizeHistory {
  date: string
  aum_m: number
}

export interface DistributionHistory {
  date: string
  amount: number
  type: string
}

export interface SectorBreakdown {
  name: string
  pct: number
}

export interface RatingBreakdown {
  rating: string
  pct: number
}

export interface LoanTypeBreakdown {
  type: string
  pct: number
}

export interface GeographicBreakdown {
  region: string
  pct: number
}

export interface FundSnapshot {
  fund_name: string
  manager: string
  strategy_label: string
  structure: string
  inception_date: string | null
  fund_size_m: number | null
  nav_per_share: number | null
  distribution_rate_annualized_pct: number | null
  management_fee_pct: number | null
  performance_fee_pct: number | null
  hurdle_rate_pct: number | null
  minimum_investment: number | null
  liquidity_terms: string | null
  leverage_target: string | null
}

export interface CreditMetrics {
  weighted_avg_yield_pct: number | null
  pik_pct: number | null
  bsl_clo_exposure_pct: number | null
  senior_secured_pct: number | null
  floating_rate_pct: number | null
  avg_ebitda_m: number | null
  interest_coverage_ratio: number | null
  fixed_charge_ratio: number | null
  ltv_pct: number | null
  deployed_pct: number | null
  non_accrual_pct: number | null
  number_of_portfolio_companies: number | null
  avg_loan_size_m: number | null
  net_leverage_turns: number | null
}

export interface Performance {
  ytd_pct: number | null
  one_year_pct: number | null
  three_year_pct: number | null
  five_year_pct: number | null
  since_inception_pct: number | null
  benchmark_ytd_pct: number | null
  benchmark_one_year_pct: number | null
  benchmark_three_year_pct: number | null
  benchmark_since_inception_pct: number | null
  benchmark_name: string | null
  as_of_date: string | null
  nav_history: NavHistory[]
  fund_size_history: FundSizeHistory[]
  distribution_history: DistributionHistory[]
}

export interface PortfolioComposition {
  sector_breakdown: SectorBreakdown[]
  rating_breakdown: RatingBreakdown[]
  loan_type_breakdown: LoanTypeBreakdown[]
  geographic_breakdown: GeographicBreakdown[]
}

export interface Suitability {
  suitable_for: string[]
  not_suitable_for: string[]
}

export interface ReportSections {
  fund_overview: string
  investment_strategy: string
  portfolio_analysis: string
  performance_analysis: string
  risk_analysis: string
  fee_analysis: string
  conclusion: string
}

export interface Source {
  id: string
  name: string
  url: null
  reliability: 'high' | 'medium' | 'low'
}

export interface DataQuality {
  completeness_pct: number
  null_fields: string[]
}

export interface FundReport {
  fund_snapshot: FundSnapshot
  credit_metrics: CreditMetrics
  performance: Performance
  portfolio_composition: PortfolioComposition
  merits: string[]
  risks: string[]
  suitability: Suitability
  report_sections: ReportSections
  sources: Source[]
  data_quality: DataQuality
}
