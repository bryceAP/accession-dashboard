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

const nullableString = { type: ["string", "null"] } as const;
const nullableNumber = { type: ["number", "null"] } as const;

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
        fund_name: { type: "string" },
        manager: { type: "string" },
        strategy_label: { type: "string" },
        structure: { type: "string" },
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
      ],
      properties: {
        weighted_avg_yield_pct: nullableNumber,
        pik_pct: nullableNumber,
        bsl_clo_exposure_pct: nullableNumber,
        senior_secured_pct: nullableNumber,
        floating_rate_pct: nullableNumber,
        avg_ebitda_m: nullableNumber,
        interest_coverage_ratio: nullableNumber,
        fixed_charge_ratio: nullableNumber,
        ltv_pct: nullableNumber,
        deployed_pct: nullableNumber,
        non_accrual_pct: nullableNumber,
        number_of_portfolio_companies: nullableNumber,
        avg_loan_size_m: nullableNumber,
        net_leverage_turns: nullableNumber,
      },
    },
    performance: {
      type: "object",
      additionalProperties: false,
      required: [
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
        "nav_history",
        "fund_size_history",
        "distribution_history",
      ],
      properties: {
        ytd_pct: nullableNumber,
        one_year_pct: nullableNumber,
        three_year_pct: nullableNumber,
        five_year_pct: nullableNumber,
        since_inception_pct: nullableNumber,
        benchmark_ytd_pct: nullableNumber,
        benchmark_one_year_pct: nullableNumber,
        benchmark_three_year_pct: nullableNumber,
        benchmark_since_inception_pct: nullableNumber,
        benchmark_name: nullableString,
        as_of_date: nullableString,
        nav_history: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["date", "nav"],
            properties: {
              date: { type: "string" },
              nav: { type: "number" },
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
              date: { type: "string" },
              aum_m: { type: "number" },
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
              date: { type: "string" },
              amount: { type: "number" },
              type: { type: "string" },
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
              name: { type: "string" },
              pct: { type: "number" },
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
              rating: { type: "string" },
              pct: { type: "number" },
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
              type: { type: "string" },
              pct: { type: "number" },
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
              region: { type: "string" },
              pct: { type: "number" },
            },
          },
        },
      },
    },
    merits: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
    suitability: {
      type: "object",
      additionalProperties: false,
      required: ["suitable_for", "not_suitable_for"],
      properties: {
        suitable_for: { type: "array", items: { type: "string" } },
        not_suitable_for: { type: "array", items: { type: "string" } },
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
        fund_overview: { type: "string" },
        investment_strategy: { type: "string" },
        portfolio_analysis: { type: "string" },
        performance_analysis: { type: "string" },
        risk_analysis: { type: "string" },
        fee_analysis: { type: "string" },
        conclusion: { type: "string" },
      },
    },
    sources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "name", "url", "reliability"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
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
        completeness_pct: { type: "number" },
        null_fields: { type: "array", items: { type: "string" } },
      },
    },
  },
} as const;

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
    } and generate a complete private credit fund research report. All data must come exclusively from the attached documents.`,
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
    return JSON.parse(text) as FundReport;
  } catch (e) {
    console.error("Raw Claude response:", text);
    throw e;
  }
}
