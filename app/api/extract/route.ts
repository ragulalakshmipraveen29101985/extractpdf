import { NextRequest, NextResponse } from "next/server";
import { extractInvoice } from "@/lib/extract";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB — under Vercel Hobby request body limit

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "No file uploaded. Send a PDF as form field 'file'." },
        { status: 400 },
      );
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { ok: false, error: "Only PDF files are supported." },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { ok: false, error: `File is too large (${(file.size / 1024 / 1024).toFixed(2)} MB). Max is 4 MB.` },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const invoice = await extractInvoice(buffer);

    return NextResponse.json({ ok: true, invoice });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/extract] failed:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
