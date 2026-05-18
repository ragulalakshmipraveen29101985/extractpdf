import { NextRequest, NextResponse } from "next/server";
import { buildXlsxBytes, xlsxFilename } from "@/lib/excel";
import type { Invoice } from "@/lib/schema";

export const runtime = "nodejs";

// Accepts the invoice JSON as a form field `invoice` (form-POST from the
// browser — triggers a native download via Content-Disposition, which works
// reliably on iOS Safari and in-app webviews where blob+anchor.click() does
// not).
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const json = form.get("invoice");
    if (typeof json !== "string" || json.length === 0) {
      return new NextResponse("missing 'invoice' form field", { status: 400 });
    }
    let invoice: Invoice;
    try {
      invoice = JSON.parse(json) as Invoice;
    } catch (err) {
      return new NextResponse(
        `invoice field is not valid JSON: ${(err as Error).message}`,
        { status: 400 },
      );
    }

    const bytes = buildXlsxBytes(invoice);
    const filename = xlsxFilename(invoice);
    const body = Buffer.from(bytes);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(body.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[/api/download] failed:", err);
    return new NextResponse(
      `failed to build workbook: ${(err as Error).message}`,
      { status: 500 },
    );
  }
}
