import Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "./client";
import { PRIVATE_CREDIT_SYSTEM_PROMPT } from "./prompts";
import type {
  FundReport,
  NavHistory,
  FundSizeHistory,
  DistributionHistory,
  FlowHistory,
} from "@/types";

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

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidNav(x: unknown): x is NavHistory {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.date === "string" &&
    ISO_DATE_RE.test(r.date) &&
    typeof r.nav === "number" &&
    Number.isFinite(r.nav)
  );
}

function isValidFundSize(x: unknown): x is FundSizeHistory {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.date === "string" &&
    ISO_DATE_RE.test(r.date) &&
    typeof r.aum_m === "number" &&
    Number.isFinite(r.aum_m)
  );
}

function isValidDistribution(x: unknown): x is DistributionHistory {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.date === "string" &&
    ISO_DATE_RE.test(r.date) &&
    typeof r.amount === "number" &&
    Number.isFinite(r.amount) &&
    typeof r.type === "string"
  );
}

function isValidFlow(x: unknown): x is FlowHistory {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.date === "string" &&
    ISO_DATE_RE.test(r.date) &&
    typeof r.subscriptions_m === "number" &&
    Number.isFinite(r.subscriptions_m) &&
    typeof r.redemptions_m === "number" &&
    Number.isFinite(r.redemptions_m)
  );
}

// Merge two arrays of dated entries: union by date, preferring the
// first-pass value when both passes claim the same date (lower
// hallucination risk on the first pass since it wasn't framed as
// "find what you missed").
function mergeByDate<T extends { date: string }>(first: T[], second: T[]): T[] {
  const byDate = new Map<string, T>();
  for (const entry of second) byDate.set(entry.date, entry);
  for (const entry of first) byDate.set(entry.date, entry); // first-pass wins on conflict
  return Array.from(byDate.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

// Second-pass time-series expansion. Scoped narrowly to the four dated arrays
// to keep hallucination risk low — dates anchor each entry to a real
// reporting period in the documents, which is much harder to fabricate
// than a single bare scalar.
async function expandTimeSeries(
  firstPass: FundReport,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  docContent: any[],
): Promise<void> {
  const perf = firstPass.performance;
  if (!perf) return;

  // Don't run if all four arrays are empty — if the first pass found
  // nothing, the docs probably don't contain time-series data and we'd be
  // inviting the model to invent entries.
  const seedTotal =
    (perf.nav_history?.length ?? 0) +
    (perf.fund_size_history?.length ?? 0) +
    (perf.distribution_history?.length ?? 0) +
    (perf.flow_history?.length ?? 0);
  if (seedTotal === 0) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any[] = [...docContent];

  content.push({
    type: "text",
    text: `You just generated a report from the attached documents. Below is the time-series data your first pass returned. Now re-scan the attached documents specifically for the four time-series tables and return the COMPLETE series for each.

Strict rules:
- Only emit entries where BOTH the date AND value(s) are explicitly stated in a document. Date format YYYY-MM-DD.
- Never extrapolate, interpolate, or estimate a missing period.
- It is fine — even expected — to return fewer entries than your first pass for an array if the first pass included entries that aren't actually in the documents. Quality over quantity.
- Express every monetary field in millions of USD.
- Return ONLY the four arrays. Do not return scalar fields. Do not change any other part of the report.

First-pass series (for reference; you may return a superset, subset, or different set):
${JSON.stringify(
  {
    nav_history: perf.nav_history ?? [],
    fund_size_history: perf.fund_size_history ?? [],
    distribution_history: perf.distribution_history ?? [],
    flow_history: perf.flow_history ?? [],
  },
  null,
  2,
)}

Where to look in each document type:
- nav_history: Selected Financial Highlights / Per Share Data tables (10-K Item 6 or Annual Report); quarterly NAV in 10-Q MD&A.
- fund_size_history: Statement of Assets and Liabilities at each period end across all filings; "Net Assets" line.
- distribution_history: 10-K Item 5 "Market for Common Equity / Distributions" table; Statement of Changes in Net Assets.
- flow_history: Statement of Changes in Net Assets — "Proceeds from sale of shares" / "Subscriptions" (subscriptions_m) and "Cost of shares redeemed" / "Redemptions" (redemptions_m, positive number).

Return JSON in exactly this shape:
{
  "nav_history": [{ "date": "YYYY-MM-DD", "nav": number }],
  "fund_size_history": [{ "date": "YYYY-MM-DD", "aum_m": number }],
  "distribution_history": [{ "date": "YYYY-MM-DD", "amount": number, "type": "string" }],
  "flow_history": [{ "date": "YYYY-MM-DD", "subscriptions_m": number, "redemptions_m": number }]
}

No markdown fences, no preamble. Begin with { and end with }.`,
  });

  let response;
  try {
    const stream = anthropic.messages.stream({
      model: "claude-opus-4-7",
      max_tokens: 6000,
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
    response = await stream.finalMessage();
  } catch (e) {
    console.warn("Time-series expansion failed; keeping first-pass series.", e);
    return;
  }

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const parsed = extractJson(text);
  if (!parsed || typeof parsed !== "object") {
    console.warn("Time-series expansion returned no parseable JSON.");
    return;
  }
  const p = parsed as Record<string, unknown>;

  const newNav = Array.isArray(p.nav_history)
    ? (p.nav_history as unknown[]).filter(isValidNav)
    : [];
  const newSize = Array.isArray(p.fund_size_history)
    ? (p.fund_size_history as unknown[]).filter(isValidFundSize)
    : [];
  const newDist = Array.isArray(p.distribution_history)
    ? (p.distribution_history as unknown[]).filter(isValidDistribution)
    : [];
  const newFlow = Array.isArray(p.flow_history)
    ? (p.flow_history as unknown[]).filter(isValidFlow)
    : [];

  const mergedNav = mergeByDate(perf.nav_history ?? [], newNav);
  const mergedSize = mergeByDate(perf.fund_size_history ?? [], newSize);
  const mergedDist = mergeByDate(perf.distribution_history ?? [], newDist);
  const mergedFlow = mergeByDate(perf.flow_history ?? [], newFlow);

  // Only swap if the merge yielded at least as many entries as the
  // first pass had — never regress.
  if (mergedNav.length >= (perf.nav_history?.length ?? 0)) perf.nav_history = mergedNav;
  if (mergedSize.length >= (perf.fund_size_history?.length ?? 0)) perf.fund_size_history = mergedSize;
  if (mergedDist.length >= (perf.distribution_history?.length ?? 0)) perf.distribution_history = mergedDist;
  if (mergedFlow.length >= (perf.flow_history?.length ?? 0)) perf.flow_history = mergedFlow;

  const added =
    (perf.nav_history.length - (newNav.length === 0 ? perf.nav_history.length : 0)) +
    (perf.fund_size_history.length - (newSize.length === 0 ? perf.fund_size_history.length : 0)) +
    (perf.distribution_history.length - (newDist.length === 0 ? perf.distribution_history.length : 0)) +
    (perf.flow_history.length - (newFlow.length === 0 ? perf.flow_history.length : 0));
  console.log(
    `[generateFundReport] Time-series pass: nav=${perf.nav_history.length}, size=${perf.fund_size_history.length}, dist=${perf.distribution_history.length}, flow=${perf.flow_history.length} (delta ${added})`,
  );
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
    // time-series expansion pass reuses it cheaply.
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

  // Targeted second pass: expand the four time-series arrays only.
  // Reuses the cached system prompt + cached docs prefix.
  await expandTimeSeries(firstPass, [...docContent, firstUserText]);

  return firstPass;
}
