import Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "./client";
import { PRIVATE_CREDIT_SYSTEM_PROMPT } from "./prompts";
import type { FundReport } from "@/types";

type PdfDocument = { type: "pdf"; base64: string; filename: string };
type TextDocument = { type: "text"; text: string; filename: string };

interface GenerateParams {
  fund_name: string;
  manager?: string | null;
  documents: Array<PdfDocument | TextDocument>;
}

// Anthropic structured outputs caps both union-typed parameters (16) and
// optional parameters (24). FundReport has 35 nullable scalar fields, so we
// split: 16 get nullable-required (union with null), 19 get optional
// (single-typed, omitted when missing). We backfill `null` for the omitted
// ones so the FundReport contract (T | null) holds either way.
const nullableString = { type: ["string", "null"] } as const;
const nullableNumber = { type: ["number", "null"] } as const;
const stringField = { type: "string" } as const;
const numberField = { type: "number" } as const;

const OPTIONAL_CREDIT_METRICS = [
  "pik_pct",
  "bsl_clo_exposure_pct",
  "avg_ebitda_m",
  "interest_coverage_ratio",
  "fixed_charge_ratio",
  "non_accrual_pct",
  "avg_loan_size_m",
  "net_leverage_turns",
] as const;

const OPTIONAL_PERFORMANCE = [
  "ytd_pct",
  "one_year_pct",
  "three_year_pct",
  "five_year_pct",
  "since_inception_pct",
  "benchmark_ytd_pct",
  "benchmark_one_year_pct",
  "benchmark_three_year_pct",
  "benchmark_since_inception_pct",
  "benchmark_name",
  "as_of_date",
] as const;

const FUND_REPORT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "fund_snapshot",
    "credit_metrics",
    "performance",
    "portfolio_composition",
    "merits",
    "risks",
    "suitability",
    "report_sections",
    "sources",
    "data_quality",
  ],
  properties: {
    fund_snapshot: {
      type: "object",
      additionalProperties: false,
      required: [
        "fund_name",
        "manager",
        "strategy_label",
        "structure",
        "inception_date",
        "fund_size_m",
        "nav_per_share",
        "distribution_rate_annualized_pct",
        "management_fee_pct",
        "performance_fee_pct",
        "hurdle_rate_pct",
        "minimum_investment",
        "liquidity_terms",
        "leverage_target",
      ],
      properties: {
        fund_name: stringField,
        manager: stringField,
        strategy_label: stringField,
        structure: stringField,
        // 10 nullable-required (union)
        inception_date: nullableString,
        fund_size_m: nullableNumber,
        nav_per_share: nullableNumber,
        distribution_rate_annualized_pct: nullableNumber,
        management_fee_pct: nullableNumber,
        performance_fee_pct: nullableNumber,
        hurdle_rate_pct: nullableNumber,
        minimum_investment: nullableNumber,
        liquidity_terms: nullableString,
        leverage_target: nullableString,
      },
    },
    credit_metrics: {
      type: "object",
      additionalProperties: false,
      required: [
        // 6 nullable-required (union) — most commonly cited metrics
        "weighted_avg_yield_pct",
        "senior_secured_pct",
        "floating_rate_pct",
        "ltv_pct",
        "deployed_pct",
        "number_of_portfolio_companies",
      ],
      properties: {
        weighted_avg_yield_pct: nullableNumber,
        senior_secured_pct: nullableNumber,
        floating_rate_pct: nullableNumber,
        ltv_pct: nullableNumber,
        deployed_pct: nullableNumber,
        number_of_portfolio_companies: nullableNumber,
        // 8 optional (omitted when unknown)
        pik_pct: numberField,
        bsl_clo_exposure_pct: numberField,
        avg_ebitda_m: numberField,
        interest_coverage_ratio: numberField,
        fixed_charge_ratio: numberField,
        non_accrual_pct: numberField,
        avg_loan_size_m: numberField,
        net_leverage_turns: numberField,
      },
    },
    performance: {
      type: "object",
      additionalProperties: false,
      required: [
        "nav_history",
        "fund_size_history",
        "distribution_history",
        "flow_history",
      ],
      properties: {
        // 11 optional (omitted when unknown)
        ytd_pct: numberField,
        one_year_pct: numberField,
        three_year_pct: numberField,
        five_year_pct: numberField,
        since_inception_pct: numberField,
        benchmark_ytd_pct: numberField,
        benchmark_one_year_pct: numberField,
        benchmark_three_year_pct: numberField,
        benchmark_since_inception_pct: numberField,
        benchmark_name: stringField,
        as_of_date: stringField,
        nav_history: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["date", "nav"],
            properties: {
              date: stringField,
              nav: numberField,
            },
          },
        },
        fund_size_history: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["date", "aum_m"],
            properties: {
              date: stringField,
              aum_m: numberField,
            },
          },
        },
        distribution_history: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["date", "amount", "type"],
            properties: {
              date: stringField,
              amount: numberField,
              type: stringField,
            },
          },
        },
        flow_history: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["date", "subscriptions_m", "redemptions_m"],
            properties: {
              date: stringField,
              subscriptions_m: numberField,
              redemptions_m: numberField,
            },
          },
        },
      },
    },
    portfolio_composition: {
      type: "object",
      additionalProperties: false,
      required: [
        "sector_breakdown",
        "rating_breakdown",
        "loan_type_breakdown",
        "geographic_breakdown",
      ],
      properties: {
        sector_breakdown: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name", "pct"],
            properties: {
              name: stringField,
              pct: numberField,
            },
          },
        },
        rating_breakdown: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["rating", "pct"],
            properties: {
              rating: stringField,
              pct: numberField,
            },
          },
        },
        loan_type_breakdown: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["type", "pct"],
            properties: {
              type: stringField,
              pct: numberField,
            },
          },
        },
        geographic_breakdown: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["region", "pct"],
            properties: {
              region: stringField,
              pct: numberField,
            },
          },
        },
      },
    },
    merits: { type: "array", items: stringField },
    risks: { type: "array", items: stringField },
    suitability: {
      type: "object",
      additionalProperties: false,
      required: ["suitable_for", "not_suitable_for"],
      properties: {
        suitable_for: { type: "array", items: stringField },
        not_suitable_for: { type: "array", items: stringField },
      },
    },
    report_sections: {
      type: "object",
      additionalProperties: false,
      required: [
        "fund_overview",
        "investment_strategy",
        "portfolio_analysis",
        "performance_analysis",
        "risk_analysis",
        "fee_analysis",
        "conclusion",
      ],
      properties: {
        fund_overview: stringField,
        investment_strategy: stringField,
        portfolio_analysis: stringField,
        performance_analysis: stringField,
        risk_analysis: stringField,
        fee_analysis: stringField,
        conclusion: stringField,
      },
    },
    sources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "name", "url", "reliability"],
        properties: {
          id: stringField,
          name: stringField,
          url: { type: "null" },
          reliability: { type: "string", enum: ["high", "medium", "low"] },
        },
      },
    },
    data_quality: {
      type: "object",
      additionalProperties: false,
      required: ["completeness_pct", "null_fields"],
      properties: {
        completeness_pct: numberField,
        null_fields: { type: "array", items: stringField },
      },
    },
  },
} as const;

function backfillNulls(report: FundReport): FundReport {
  const cm = report.credit_metrics as unknown as Record<string, unknown>;
  for (const key of OPTIONAL_CREDIT_METRICS) {
    if (cm[key] === undefined) cm[key] = null;
  }
  const perf = report.performance as unknown as Record<string, unknown>;
  for (const key of OPTIONAL_PERFORMANCE) {
    if (perf[key] === undefined) perf[key] = null;
  }
  if (perf.flow_history === undefined) perf.flow_history = [];
  return report;
}

export async function generateFundReport({
  fund_name,
  manager,
  documents,
}: GenerateParams): Promise<FundReport> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any[] = [];

  for (const doc of documents) {
    if (doc.type === "pdf") {
      content.push({
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: doc.base64,
        },
        title: doc.filename,
      });
    } else {
      content.push({
        type: "text",
        text: `=== DOCUMENT: ${doc.filename} ===\n${doc.text}\n=== END DOCUMENT ===`,
      });
    }
  }

  const fundLine = [
    `Fund Name: ${fund_name}`,
    manager ? `Manager: ${manager}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  content.push({
    type: "text",
    text: `${fundLine}\n\nAnalyze the ${documents.length} attached document${
      documents.length !== 1 ? "s" : ""
    } and generate a complete private credit fund research report. All data must come exclusively from the attached documents. For required fields where no value is given in the documents, return null. For optional fields where no value is given, omit the field entirely.`,
  });

  const stream = anthropic.messages.stream({
    model: "claude-opus-4-7",
    max_tokens: 32000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "high",
      format: {
        type: "json_schema",
        schema: FUND_REPORT_SCHEMA as unknown as Record<string, unknown>,
      },
    },
    system: [
      {
        type: "text",
        text: PRIVATE_CREDIT_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: content as Anthropic.MessageParam["content"],
      },
    ],
  });

  const response = await stream.finalMessage();

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  try {
    const parsed = JSON.parse(text) as FundReport;
    return backfillNulls(parsed);
  } catch (e) {
    console.error("Raw Claude response:", text);
    throw e;
  }
}
