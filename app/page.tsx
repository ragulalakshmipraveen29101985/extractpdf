"use client";

import { useState } from "react";
import { downloadWorkbook } from "@/lib/excel";
import {
  EINVOICE_FIELDS,
  HSN_COLUMNS,
  INVOICE_BASIC_FIELDS,
  Invoice,
  ORDER_FIELDS,
  PARTY_FIELDS,
  Party,
  SHIP_PARTY_FIELDS,
  ShipParty,
  TOTAL_FIELDS,
  TRANSPORT_FIELDS,
} from "@/lib/schema";

type ExtractResponse =
  | { ok: true; invoice: Invoice }
  | { ok: false; error: string };

function display(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExtract() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setInvoice(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/extract", { method: "POST", body: form });
      const data = (await res.json()) as ExtractResponse;
      if (!data.ok) {
        setError(data.error);
      } else {
        setInvoice(data.invoice);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  function handleDownload() {
    if (!invoice) return;
    const fallback = file?.name.replace(/\.pdf$/i, "") || "invoice";
    downloadWorkbook(invoice, fallback);
  }

  return (
    <main>
      <h1>Invoice PDF → Excel</h1>
      <p className="muted">
        Upload an Indian GST tax invoice (PDF, ≤ 4 MB). Gemini reads it
        natively, the line-items table is mirrored with the same columns it
        has on the PDF, and you can download the result as Excel.
      </p>

      <div className="card">
        <div className="row">
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              setInvoice(null);
              setError(null);
            }}
          />
          <button onClick={handleExtract} disabled={!file || loading}>
            {loading && <span className="spinner" />}
            {loading ? "Extracting…" : "Extract"}
          </button>
          {invoice && (
            <button className="secondary" onClick={handleDownload}>
              Download Excel
            </button>
          )}
        </div>
        {error && <div className="error">{error}</div>}
      </div>

      {invoice && <InvoicePreview invoice={invoice} />}
    </main>
  );
}

function InvoicePreview({ invoice }: { invoice: Invoice }) {
  return (
    <>
      <div className="card">
        <SectionKV title="Invoice" obj={invoice} fields={INVOICE_BASIC_FIELDS} />
        <SectionKV title="E-Invoice" obj={invoice} fields={EINVOICE_FIELDS} />
        <SectionKV title="Order / PO" obj={invoice} fields={ORDER_FIELDS} />
        <SectionKV title="Transport" obj={invoice} fields={TRANSPORT_FIELDS} />
      </div>

      <div className="card">
        <div className="section-title">Vendor</div>
        <KV<Party> obj={invoice.vendor} fields={PARTY_FIELDS} />
        <div className="section-title">Bill To</div>
        <KV<ShipParty> obj={invoice.billTo} fields={SHIP_PARTY_FIELDS} />
        <div className="section-title">Ship To</div>
        <KV<ShipParty> obj={invoice.shipTo} fields={SHIP_PARTY_FIELDS} />
      </div>

      <div className="card">
        <div className="section-title">Totals</div>
        <KV<Invoice> obj={invoice} fields={TOTAL_FIELDS} />
      </div>

      <div className="card">
        <div className="section-title">
          Line Items ({invoice.lineItems.length})
        </div>
        <div style={{ overflowX: "auto", maxHeight: 500 }}>
          {invoice.lineItemColumns.length === 0 ? (
            <p style={{ color: "#57606a" }}>No line-item table detected.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  {invoice.lineItemColumns.map((c, i) => (
                    <th key={i}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={invoice.lineItemColumns.length}
                      style={{ textAlign: "center", color: "#57606a" }}
                    >
                      No line items detected.
                    </td>
                  </tr>
                ) : (
                  invoice.lineItems.map((row, i) => (
                    <tr key={i}>
                      {row.map((v, j) => (
                        <td key={j}>{display(v)}</td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card">
        <div className="section-title">
          HSN Tax Summary ({invoice.hsnSummary.length})
        </div>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                {HSN_COLUMNS.map((c) => (
                  <th key={String(c.key)}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoice.hsnSummary.length === 0 ? (
                <tr>
                  <td
                    colSpan={HSN_COLUMNS.length}
                    style={{ textAlign: "center", color: "#57606a" }}
                  >
                    No HSN tax summary printed on this invoice.
                  </td>
                </tr>
              ) : (
                invoice.hsnSummary.map((row, i) => (
                  <tr key={i}>
                    {HSN_COLUMNS.map((c) => (
                      <td key={String(c.key)}>{display(row[c.key])}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function SectionKV<T>({
  title,
  obj,
  fields,
}: {
  title: string;
  obj: T;
  fields: Array<{ key: keyof T; label: string }>;
}) {
  return (
    <>
      <div className="section-title">{title}</div>
      <KV<T> obj={obj} fields={fields} />
    </>
  );
}

function KV<T>({
  obj,
  fields,
}: {
  obj: T;
  fields: Array<{ key: keyof T; label: string }>;
}) {
  return (
    <div className="kv">
      {fields.map((f) => (
        <Pair
          key={String(f.key)}
          label={f.label}
          value={obj[f.key] as string | number | null}
        />
      ))}
    </div>
  );
}

function Pair({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <>
      <div>{label}</div>
      <div>{display(value)}</div>
    </>
  );
}
