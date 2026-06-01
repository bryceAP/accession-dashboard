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

const stringField = { type: "string" } as const;
const numberField = { type: "number" } as const;

// Fields the model may omit when no data is available. We backfill `null` so
// the FundReport contract (string | null / number | null) is preserved without
// adding nullable unions to the schema (Anthropic structured outputs caps
// union-typed parameters at 16; nullability counts as a union).
const NULLABLE_FUND_SNAPSHOT = [
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
] as const;

const NULLABLE_CREDIT_METRICS = [
  "weighted_avg_yield_pct",
  "pik_pct",
  "bsl_clo_exposure_pct",
  "senior_secured_pct",
  "floating_rate_pct",
  "avg_ebitda_m",
  "interest_coverage_ratio",
  "fixed_charge_ratio",
  "ltv_pct",
  "deployed_pct",
  "non_accrual_pct",
  "number_of_portfolio_companies",
  "avg_loan_size_m",
  "net_leverage_turns",
] as const;

const NULLABLE_PERFORMANCE = [
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
      required: ["fund_name", "manager", "strategy_label", "structure"],
      properties: {
        fund_name: stringField,
        manager: stringField,
        strategy_label: stringField,
        structure: stringField,
        inception_date: stringField,
        fund_size_m: numberField,
        nav_per_share: numberField,
        distribution_rate_annualized_pct: numberField,
        management_fee_pct: numberField,
        performance_fee_pct: numberField,
        hurdle_rate_pct: numberField,
        minimum_investment: numberField,
        liquidity_terms: stringField,
        leverage_target: stringField,
      },
    },
    credit_metrics: {
      type: "object",
      additionalProperties: false,
      required: [],
      properties: {
        weighted_avg_yield_pct: numberField,
        pik_pct: numberField,
        bsl_clo_exposure_pct: numberField,
        senior_secured_pct: numberField,
        floating_rate_pct: numberField,
        avg_ebitda_m: numberField,
        interest_coverage_ratio: numberField,
        fixed_charge_ratio: numberField,
        ltv_pct: numberField,
        deployed_pct: numberField,
        non_accrual_pct: numberField,
        number_of_portfolio_companies: numberField,
        avg_loan_size_m: numberField,
        net_leverage_turns: numberField,
      },
    },
    performance: {
      type: "object",
      additionalProperties: false,
      required: ["nav_history", "fund_size_history", "distribution_history"],
      properties: {
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
  const fs = report.fund_snapshot as unknown as Record<string, unknown>;
  for (const key of NULLABLE_FUND_SNAPSHOT) {
    if (fs[key] === undefined) fs[key] = null;
  }
  const cm = report.credit_metrics as unknown as Record<string, unknown>;
  for (const key of NULLABLE_CREDIT_METRICS) {
    if (cm[key] === undefined) cm[key] = null;
  }
  const perf = report.performance as unknown as Record<string, unknown>;
  for (const key of NULLABLE_PERFORMANCE) {
    if (perf[key] === undefined) perf[key] = null;
  }
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
    } and generate a complete private credit fund research report. All data must come exclusively from the attached documents. When a value is not present in the documents, omit that field entirely rather than guessing.`,
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
