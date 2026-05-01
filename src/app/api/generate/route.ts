import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateFundReport } from "@/lib/anthropic/generate";

export const maxDuration = 120;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    // Download each document from Supabase Storage
    const documents: { base64: string; filename: string; mediaType: string }[] =
      [];

    for (const storagePath of document_paths ?? []) {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("fund-documents")
        .download(storagePath);

      if (downloadError || !fileData) {
        console.warn(`Skipping ${storagePath}:`, downloadError?.message);
        continue;
      }

      const bytes = await fileData.arrayBuffer();
      documents.push({
        base64: Buffer.from(bytes).toString("base64"),
        filename: (storagePath as string).split("/").pop() ?? storagePath,
        mediaType: "application/pdf",
      });
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
