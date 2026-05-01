import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateFundReport } from "@/lib/anthropic/generate";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse: (buffer: Buffer) => Promise<{ text: string }> = require("pdf-parse/lib/pdf-parse");

export const maxDuration = 120;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TEN_MB = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const { fund_id, run_id, fund_name, manager, document_paths } =
    await request.json();

  if (!fund_id || !run_id) {
    return NextResponse.json(
      { error: "fund_id and run_id are required" },
      { status: 400 }
    );
  }

  try {
    const documents: Array<
      { type: "pdf"; base64: string; filename: string } |
      { type: "text"; text: string; filename: string }
    > = [];

    for (const storagePath of document_paths ?? []) {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("fund-documents")
        .download(storagePath);

      if (downloadError || !fileData) {
        console.warn(`Skipping ${storagePath}:`, downloadError?.message);
        continue;
      }

      const bytes = await fileData.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const filename = (storagePath as string).split("/").pop() ?? storagePath;

      if (buffer.byteLength <= TEN_MB) {
        documents.push({ type: "pdf", base64: buffer.toString("base64"), filename });
      } else {
        const parsed = await pdfParse(buffer);
        documents.push({ type: "text", text: parsed.text, filename });
      }
    }

    const report = await generateFundReport({ fund_name, manager, documents });

    await supabase
      .from("dashboard_runs")
      .update({
        status: "complete",
        structured_data: report,
      })
      .eq("id", run_id);

    await supabase
      .from("funds")
      .update({ status: "complete", last_run_at: new Date().toISOString() })
      .eq("id", fund_id);

    return NextResponse.json({ success: true, run_id });
  } catch (err) {
    console.error("Generate report error:", err);

    await supabase
      .from("dashboard_runs")
      .update({ status: "error" })
      .eq("id", run_id);

    await supabase
      .from("funds")
      .update({ status: "error" })
      .eq("id", fund_id);

    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Report generation failed",
      },
      { status: 500 }
    );
  }
}
