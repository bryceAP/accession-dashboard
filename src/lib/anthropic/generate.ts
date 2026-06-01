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

// Defensive: older reports / model omissions shouldn't break consumers that
// assume the field is at least `null` (for scalars) or `[]` (for arrays).
function backfillReport(report: FundReport): FundReport {
  const perf = report.performance as unknown as Record<string, unknown>;
  if (perf && perf.flow_history === undefined) perf.flow_history = [];
  return report;
}

// Every scalar field counted in data_quality.completeness_pct (arrays and
// nested objects excluded, per the system prompt's accounting rule).
const COMPLETENESS_FIELDS = [
  "fund_snapshot.fund_name",
  "fund_snapshot.manager",
  "fund_snapshot.strategy_label",
  "fund_snapshot.structure",
  "fund_snapshot.inception_date",
  "fund_snapshot.fund_size_m",
  "fund_snapshot.nav_per_share",
  "fund_snapshot.distribution_rate_annualized_pct",
  "fund_snapshot.management_fee_pct",
  "fund_snapshot.performance_fee_pct",
  "fund_snapshot.hurdle_rate_pct",
  "fund_snapshot.minimum_investment",
  "fund_snapshot.liquidity_terms",
  "fund_snapshot.leverage_target",
  "credit_metrics.weighted_avg_yield_pct",
  "credit_metrics.pik_pct",
  "credit_metrics.bsl_clo_exposure_pct",
  "credit_metrics.senior_secured_pct",
  "credit_metrics.floating_rate_pct",
  "credit_metrics.avg_ebitda_m",
  "credit_metrics.interest_coverage_ratio",
  "credit_metrics.fixed_charge_ratio",
  "credit_metrics.ltv_pct",
  "credit_metrics.deployed_pct",
  "credit_metrics.non_accrual_pct",
  "credit_metrics.number_of_portfolio_companies",
  "credit_metrics.avg_loan_size_m",
  "credit_metrics.net_leverage_turns",
  "performance.ytd_pct",
  "performance.one_year_pct",
  "performance.three_year_pct",
  "performance.five_year_pct",
  "performance.since_inception_pct",
  "performance.benchmark_ytd_pct",
  "performance.benchmark_one_year_pct",
  "performance.benchmark_three_year_pct",
  "performance.benchmark_since_inception_pct",
  "performance.benchmark_name",
  "performance.as_of_date",
] as const;

function getByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((cur, key) => {
    if (cur == null || typeof cur !== "object") return undefined;
    return (cur as Record<string, unknown>)[key];
  }, obj);
}

function setByPath(obj: unknown, path: string, value: unknown): void {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur == null || typeof cur !== "object") return;
    cur = (cur as Record<string, unknown>)[parts[i]];
  }
  if (cur != null && typeof cur === "object") {
    (cur as Record<string, unknown>)[parts[parts.length - 1]] = value;
  }
}

function recomputeDataQuality(report: FundReport): void {
  const nullFields = COMPLETENESS_FIELDS.filter(
    (path) => getByPath(report, path) == null,
  );
  const total = COMPLETENESS_FIELDS.length;
  const completeness = Math.round(((total - nullFields.length) / total) * 100);
  report.data_quality = {
    completeness_pct: completeness,
    null_fields: [...nullFields],
  };
}

function extractJson(text: string): unknown {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

// Second-pass fill: ask the model to re-read the docs and try to populate any
// field the first pass returned as null. Returns a flat map of dot-path to
// value; entries with null/undefined values are ignored at merge time.
async function fillMissingFields(
  firstPass: FundReport,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  docContent: any[],
): Promise<Record<string, unknown>> {
  const nullFields = firstPass.data_quality?.null_fields ?? [];
  if (nullFields.length === 0) return {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any[] = [...docContent];

  content.push({
    type: "text",
    text: `Below is the JSON report you just generated from the attached documents. The fields listed under "null_fields" were returned as null. Re-read the attached documents and try to fill any of those fields that ARE explicitly present in the documents.

Strict rules:
- Only fill a field if the value (or all inputs to its calculation) is explicitly stated in a document. Never estimate, infer, or guess.
- Use the same field paths shown below (dot notation, e.g. "credit_metrics.pik_pct").
- Omit any field you cannot fill — do NOT include null entries in your response.
- Do not touch fields that weren't in the null list.

Existing report:
${JSON.stringify(firstPass, null, 2)}

Return a single flat JSON object mapping each filled field's dot-path to its value. For example:
{
  "fund_snapshot.fund_size_m": 1830,
  "credit_metrics.pik_pct": 5.2,
  "performance.benchmark_name": "Cliffwater Direct Lending Index"
}

Return only valid JSON. No markdown fences, no preamble, no explanation.`,
  });

  const stream = anthropic.messages.stream({
    model: "claude-opus-4-7",
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
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

  let response;
  try {
    response = await stream.finalMessage();
  } catch (e) {
    console.warn("Second-pass fill failed; using first-pass report.", e);
    return {};
  }

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const parsed = extractJson(text);
  if (!parsed || typeof parsed !== "object") {
    console.warn("Second-pass returned no parseable JSON:", text);
    return {};
  }
  return parsed as Record<string, unknown>;
}

function mergeFills(
  report: FundReport,
  fills: Record<string, unknown>,
): number {
  let applied = 0;
  for (const [path, value] of Object.entries(fills)) {
    if (value === null || value === undefined) continue;
    if (!(COMPLETENESS_FIELDS as readonly string[]).includes(path)) continue;
    // Only fill fields that were null in the first pass.
    if (getByPath(report, path) != null) continue;
    setByPath(report, path, value);
    applied += 1;
  }
  return applied;
}

export async function generateFundReport({
  fund_name,
  manager,
  documents,
}: GenerateParams): Promise<FundReport> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const docContent: any[] = [];

  for (const doc of documents) {
    if (doc.type === "pdf") {
      docContent.push({
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: doc.base64,
        },
        title: doc.filename,
      });
    } else {
      docContent.push({
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

  const firstUserText = {
    type: "text" as const,
    text: `${fundLine}\n\nAnalyze the ${documents.length} attached document${
      documents.length !== 1 ? "s" : ""
    } and generate a complete private credit fund research report. All data must come exclusively from the attached documents. Return only valid JSON matching the schema in the system prompt — no markdown fences, no preamble, no explanation outside the JSON.`,
    // Cache the prefix (system + docs + initial instructions) so the
    // second-pass fill reuses it cheaply.
    cache_control: { type: "ephemeral" as const },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const firstContent: any[] = [...docContent, firstUserText];

  const stream = anthropic.messages.stream({
    model: "claude-opus-4-7",
    max_tokens: 32000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
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
        content: firstContent as Anthropic.MessageParam["content"],
      },
    ],
  });

  const response = await stream.finalMessage();

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const parsed = extractJson(text);
  if (!parsed || typeof parsed !== "object") {
    console.error("Raw Claude response:", text);
    throw new Error("Claude returned no parseable JSON object.");
  }
  const firstPass = backfillReport(parsed as FundReport);

  // Second pass: attempt to fill any field the first pass returned as null.
  // Reuses the cached system prompt + docs, so cost is dominated by output
  // tokens (the response is small) plus a cheap cache-read.
  const docContentForSecondPass: typeof firstContent = [
    ...docContent,
    firstUserText,
  ];
  const fills = await fillMissingFields(firstPass, docContentForSecondPass);
  const applied = mergeFills(firstPass, fills);
  if (applied > 0) {
    recomputeDataQuality(firstPass);
    console.log(`[generateFundReport] Second pass filled ${applied} fields.`);
  }

  return firstPass;
}
