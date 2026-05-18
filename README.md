# Invoice PDF → Excel (POC)

A one-page Next.js app that takes an Indian GST tax-invoice PDF, extracts the
data via **Gemini 2.0 Flash** (native PDF input), and lets you download the
result as Excel. The "Line Items" sheet mirrors the source invoice's column
headers exactly.

## Run locally

```bash
cd /home/praveen/praveen/apps/poc/extractpdf
npm install
cp .env.example .env.local        # then put your real GOOGLE_API_KEY in .env.local
npm run dev
```

Get a free Gemini API key at <https://aistudio.google.com/apikey>.

Open <http://localhost:3000> (or `:3001` if `3000` is in use), upload an
invoice PDF, click **Extract**, then **Download Excel**.

## Environment variables

| Var              | Required | Default              | Notes                                       |
| ---------------- | -------- | -------------------- | ------------------------------------------- |
| `GOOGLE_API_KEY` | yes      | —                    | Google AI Studio API key (free tier works). |
| `GEMINI_MODEL`   | no       | `gemini-2.0-flash`   | Try `gemini-2.5-flash` for harder invoices. |

## Deploy to Vercel

```bash
npx vercel              # first time: link project to your Vercel account
npx vercel --prod       # production deploy
```

Then in **Project Settings → Environment Variables** add `GOOGLE_API_KEY`
(and optionally `GEMINI_MODEL`) for the Production environment.

### Vercel limits to be aware of (Hobby tier)
- Request body: **4 MB** — the API rejects PDFs larger than this.
- Function duration: **60 s** on the Node runtime (already set via
  `export const maxDuration = 60` in `app/api/extract/route.ts`). Gemini
  typically returns in 30-50 s for a 15-page, 250-line-item invoice.

## Project layout

```
app/
  layout.tsx               root layout + global styles
  page.tsx                 upload UI + preview + download button
  globals.css              styling
  api/extract/route.ts     POST: PDF → Gemini → JSON
lib/
  schema.ts                Invoice TS type + header/HSN column metadata
  extract.ts               extractInvoice(buffer) → Invoice (single Gemini call)
  excel.ts                 buildWorkbook(invoice) → Blob (browser-side)
```

## How the extraction works

1. Browser uploads the PDF as multipart form data to `/api/extract`.
2. Server base64-encodes the PDF and sends it inline to Gemini with a JSON-
   shaped system prompt.
3. Gemini returns a single JSON object containing:
   - structured header / vendor / bill-to / ship-to / totals / HSN tax summary
   - `lineItemColumns`: the literal column headers from the line-items table
     on the invoice (e.g. `["SI.NO", "Particulars", "Brand", ...]`)
   - `lineItems`: rows as positional arrays matching `lineItemColumns`
4. The browser renders a preview, and on **Download Excel** uses SheetJS
   (`xlsx`) to build a 3-sheet workbook (`Header`, `Line Items`,
   `HSN Tax Summary`) entirely client-side.

## Why positional line-item rows?

Each invoice in the wild has a different column layout — Paluck uses
"SI.NO Particulars Brand HSN/SAC Quantity Price Disc% Discount Total Price",
Pratyaya uses "Sr No. Product Name Product Code. Qty Rate Taxable Value IGST Amount",
M.K. Silk uses "S.N. Description of Goods HSN/SAC Code Qty. Unit Price Amount",
etc. Forcing them into a fixed 25-column schema either drops fields the team
cares about or fills most cells with null. Mirroring the source table makes
the Excel feel like a direct port of the invoice.

Header / vendor / customer / totals fields stay in a uniform schema across
invoices because the team needs them in the same place every time.

## Refining

- Header / vendor / totals fields: edit `lib/schema.ts` and the column-metadata
  arrays (`INVOICE_BASIC_FIELDS`, `PARTY_FIELDS`, etc.). The preview UI and
  the Header sheet are driven by those arrays.
- Line-item columns: nothing to refine — they come from the PDF.
