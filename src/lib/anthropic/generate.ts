import { anthropic } from "./client";
import { PRIVATE_CREDIT_SYSTEM_PROMPT } from "./prompts";
import type { FundReport } from "@/types";

interface Document {
  base64: string;
  filename: string;
  mediaType: string;
}

interface GenerateParams {
  fund_name: string;
  manager?: string | null;
  documents: Document[];
}

export async function generateFundReport({
  fund_name,
  manager,
  documents,
}: GenerateParams): Promise<FundReport> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any[] = [];

  for (const doc of documents) {
    content.push({
      type: "document",
      source: {
        type: "base64",
        media_type: doc.mediaType,
        data: doc.base64,
      },
      title: doc.filename,
    });
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
    max_tokens: 8000,
    system: PRIVATE_CREDIT_SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response received from Claude");
  }

  const raw = textBlock.text.trim();

  try {
    return JSON.parse(raw) as FundReport;
  } catch {
    console.error(
      "Claude returned invalid JSON. Raw response (first 1000 chars):",
      raw.slice(0, 1000)
    );
    throw new Error(
      "Claude returned invalid JSON — check server logs for the raw response."
    );
  }
}
