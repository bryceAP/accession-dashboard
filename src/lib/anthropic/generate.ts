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
    text: `${fundLine}\n\nAnalyze the ${documents.length} attached document${documents.length !== 1 ? "s" : ""} and generate a complete private credit fund research report. All data must come exclusively from the attached documents. Return only valid JSON.`,
  });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 16000,
    system: PRIVATE_CREDIT_SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const jsonStr = cleaned.slice(start, end + 1);

  try {
    return JSON.parse(jsonStr) as FundReport;
  } catch (e) {
    console.error("Raw Claude response:", text);
    throw e;
  }
}
