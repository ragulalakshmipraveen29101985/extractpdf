import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  Cell,
  HsnSummary,
  Invoice,
  Party,
  ShipParty,
} from "./schema";

const SYSTEM_PROMPT = `You are an Indian GST tax-invoice data extractor.
The user uploaded a PDF invoice. Read it (every page) and return a single JSON object matching the shape below.

\`\`\`
{
  invoiceNumber, invoiceDate, dueDate,                              // strings
  irn, ackNo, ackDate,                                              // e-invoice
  poNumber, poDate, soNumber, orderNumber, orderDate,
  portal, paymentMode, paymentTerms, placeOfSupply,
  transporter, lrNumber, lrDate, awbNumber,
  dispatchThrough, weight, vehicleNumber,
  noOfBoxes: number,
  remarks, notes,

  vendor: { name, brand, address, gstin, stateCode, pan, email, phone },
  billTo: { name, address, gstin, stateCode },
  shipTo: { name, address, gstin, stateCode },

  // Literal column headers printed on the line-items table, in the same order shown on the PDF.
  // Copy them verbatim (whitespace-normalized): e.g. ["SI.NO", "Particulars", "Brand", "HSN/SAC", "Quantity", "Price", "Disc%", "Discount", "Total Price"].
  // If multi-line headers, join them with a single space.
  lineItemColumns: string[],

  // ONE ARRAY PER ITEM ROW on the invoice, in the same order the rows appear.
  // Each array has EXACTLY lineItemColumns.length entries — positional, matching the column order above.
  // Use the cell's value as a JSON number when the cell is numeric (strip ₹, Rs., commas, %, currency suffixes — "₹ 1,043.50" -> 1043.50; "5.00 %" -> 5).
  // Use a string when the cell is text (description, HSN, color, size, brand, etc.).
  // Use null for empty cells.
  // Emit EVERY row across ALL pages, including continuation pages. Some invoices have 100-300 rows. Do not summarise or skip.
  lineItems: (string | number | null)[][],

  // HSN-rate breakup table (usually near the bottom). [] if absent.
  hsnSummary: [
    { hsnCode: string, taxableValue: number, taxRatePercent: number, quantity: number,
      igstAmount: number, cgstAmount: number, sgstAmount: number, cessAmount: number, total: number }
  ],

  currency: string,   // default "INR"
  totalQuantity: number, subtotal: number,
  totalIgst: number, totalCgst: number, totalSgst: number, totalCess: number,
  roundOff: number, grandTotal: number,
  amountInWords: string
}
\`\`\`

Rules:
- **Omit any header/party/totals key whose value would be null/empty/unknown — do not include the key at all.** (This rule does NOT apply to lineItems rows, which must always have lineItemColumns.length entries — use null for empty cells there.)
- "vendor" is the seller; "billTo"/"shipTo" are the buyer/consignee — populate both even if identical.
- GSTIN, IRN, Ack No: copy exactly as printed. Dates as written; do not reformat.
- For intra-state invoices populate totalCgst/totalSgst; for inter-state populate totalIgst.
- "amountInWords": copy the exact "Amount in Words" / "Amount Chargeable (in words)" line.
- Default currency to "INR" if not otherwise indicated.
- CRITICAL: lineItemColumns must be the literal column-header strings from the line-items table on the invoice, in the printed order. Do not invent columns. Do not rename them. Do not split or merge cells.
- CRITICAL: every row in lineItems must have exactly lineItemColumns.length entries in the same order. Use null for empty cells.`;

function getClient() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY is not set. Add it to .env.local or your Vercel project env.");
  }
  return new GoogleGenerativeAI(apiKey);
}

// ---------- response normalization ----------

type AnyObj = Record<string, unknown> | null | undefined;

function s(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}
function n(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function cell(v: unknown): Cell {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") return v.length > 0 ? v : null;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

function normParty(p: AnyObj): Party {
  const o = (p ?? {}) as Record<string, unknown>;
  return {
    name: s(o.name),
    brand: s(o.brand),
    address: s(o.address),
    gstin: s(o.gstin),
    stateCode: s(o.stateCode),
    pan: s(o.pan),
    email: s(o.email),
    phone: s(o.phone),
  };
}

function normShipParty(p: AnyObj): ShipParty {
  const o = (p ?? {}) as Record<string, unknown>;
  return {
    name: s(o.name),
    address: s(o.address),
    gstin: s(o.gstin),
    stateCode: s(o.stateCode),
  };
}

function normHsn(row: AnyObj): HsnSummary {
  const o = (row ?? {}) as Record<string, unknown>;
  return {
    hsnCode: s(o.hsnCode),
    taxableValue: n(o.taxableValue),
    taxRatePercent: n(o.taxRatePercent),
    quantity: n(o.quantity),
    igstAmount: n(o.igstAmount),
    cgstAmount: n(o.cgstAmount),
    sgstAmount: n(o.sgstAmount),
    cessAmount: n(o.cessAmount),
    total: n(o.total),
  };
}

function normLineItemColumns(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? x.replace(/\s+/g, " ").trim() : ""))
    .filter((x) => x.length > 0);
}

function normLineItems(v: unknown, width: number): Cell[][] {
  if (!Array.isArray(v) || width === 0) return [];
  return v
    .filter((row): row is unknown[] => Array.isArray(row))
    .map((row) => {
      const out: Cell[] = [];
      for (let i = 0; i < width; i++) {
        out.push(cell(row[i]));
      }
      return out;
    });
}

function normalizeInvoice(raw: unknown): Invoice {
  const o = (raw ?? {}) as Record<string, unknown>;
  const lineItemColumns = normLineItemColumns(o.lineItemColumns);
  const lineItems = normLineItems(o.lineItems, lineItemColumns.length);

  return {
    invoiceNumber: s(o.invoiceNumber),
    invoiceDate: s(o.invoiceDate),
    dueDate: s(o.dueDate),

    irn: s(o.irn),
    ackNo: s(o.ackNo),
    ackDate: s(o.ackDate),

    poNumber: s(o.poNumber),
    poDate: s(o.poDate),
    soNumber: s(o.soNumber),
    orderNumber: s(o.orderNumber),
    orderDate: s(o.orderDate),

    portal: s(o.portal),
    paymentMode: s(o.paymentMode),
    paymentTerms: s(o.paymentTerms),
    placeOfSupply: s(o.placeOfSupply),

    transporter: s(o.transporter),
    lrNumber: s(o.lrNumber),
    lrDate: s(o.lrDate),
    awbNumber: s(o.awbNumber),
    dispatchThrough: s(o.dispatchThrough),
    noOfBoxes: n(o.noOfBoxes),
    weight: s(o.weight),
    vehicleNumber: s(o.vehicleNumber),

    remarks: s(o.remarks),
    notes: s(o.notes),

    vendor: normParty(o.vendor as AnyObj),
    billTo: normShipParty(o.billTo as AnyObj),
    shipTo: normShipParty(o.shipTo as AnyObj),

    lineItemColumns,
    lineItems,

    hsnSummary: Array.isArray(o.hsnSummary)
      ? (o.hsnSummary as AnyObj[]).map(normHsn)
      : [],

    currency: s(o.currency) ?? "INR",
    totalQuantity: n(o.totalQuantity),
    subtotal: n(o.subtotal),
    totalIgst: n(o.totalIgst),
    totalCgst: n(o.totalCgst),
    totalSgst: n(o.totalSgst),
    totalCess: n(o.totalCess),
    roundOff: n(o.roundOff),
    grandTotal: n(o.grandTotal),
    amountInWords: s(o.amountInWords),
  };
}

// ---------- main entry point ----------

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

async function callWithRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const delaysMs = [1500, 4000]; // up to 2 retries; total worst-case wait ≈ 5.5 s
  let lastErr: unknown;
  for (let attempt = 0; attempt <= delaysMs.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = (err as { status?: number })?.status;
      if (!status || !RETRYABLE_STATUSES.has(status) || attempt === delaysMs.length) {
        throw err;
      }
      const wait = delaysMs[attempt];
      console.log(`[/api/extract] ${label} status=${status}, retrying in ${wait}ms (attempt ${attempt + 1}/${delaysMs.length})`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

export async function extractInvoice(pdfBuffer: Buffer): Promise<Invoice> {
  const genai = getClient();
  const modelId = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const model = genai.getGenerativeModel({
    model: modelId,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0,
    },
  });

  const t0 = Date.now();
  const result = await callWithRetry("generateContent", () =>
    model.generateContent([
      {
        inlineData: {
          mimeType: "application/pdf",
          data: pdfBuffer.toString("base64"),
        },
      },
      { text: SYSTEM_PROMPT },
    ]),
  );
  const ms = Date.now() - t0;

  const raw = result.response.text();
  if (!raw) {
    throw new Error("Gemini returned an empty response.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Could not parse JSON from Gemini response: ${(err as Error).message}`);
  }

  const invoice = normalizeInvoice(parsed);

  const usage = result.response.usageMetadata;
  console.log(
    `[/api/extract] model=${modelId} ms=${ms} ` +
      `prompt_tokens=${usage?.promptTokenCount ?? "?"} ` +
      `output_tokens=${usage?.candidatesTokenCount ?? "?"} ` +
      `columns=${invoice.lineItemColumns.length} ` +
      `lineItems=${invoice.lineItems.length} hsnRows=${invoice.hsnSummary.length}`,
  );

  return invoice;
}
