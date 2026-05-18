import * as XLSX from "xlsx";
import {
  EINVOICE_FIELDS,
  HSN_COLUMNS,
  HsnSummary,
  INVOICE_BASIC_FIELDS,
  Invoice,
  ORDER_FIELDS,
  PARTY_FIELDS,
  Party,
  SHIP_PARTY_FIELDS,
  ShipParty,
  TOTAL_FIELDS,
  TRANSPORT_FIELDS,
} from "./schema";

type CellValue = string | number | null;
type Row = CellValue[];

function rowsFor<T>(
  obj: T,
  fields: Array<{ key: keyof T; label: string }>,
): Row[] {
  return fields.map((f) => [f.label, obj[f.key] as CellValue]);
}

function section(title: string): Row {
  return [title, ""];
}

function buildHeaderSheet(inv: Invoice): XLSX.WorkSheet {
  const rows: Row[] = [["Field", "Value"]];

  rows.push(section("INVOICE"));
  rows.push(...rowsFor(inv, INVOICE_BASIC_FIELDS));

  rows.push(["", ""]);
  rows.push(section("E-INVOICE"));
  rows.push(...rowsFor(inv, EINVOICE_FIELDS));

  rows.push(["", ""]);
  rows.push(section("ORDER / PO"));
  rows.push(...rowsFor(inv, ORDER_FIELDS));

  rows.push(["", ""]);
  rows.push(section("VENDOR"));
  rows.push(...rowsFor<Party>(inv.vendor, PARTY_FIELDS));

  rows.push(["", ""]);
  rows.push(section("BILL TO"));
  rows.push(...rowsFor<ShipParty>(inv.billTo, SHIP_PARTY_FIELDS));

  rows.push(["", ""]);
  rows.push(section("SHIP TO"));
  rows.push(...rowsFor<ShipParty>(inv.shipTo, SHIP_PARTY_FIELDS));

  rows.push(["", ""]);
  rows.push(section("TRANSPORT"));
  rows.push(...rowsFor(inv, TRANSPORT_FIELDS));

  rows.push(["", ""]);
  rows.push(section("TOTALS"));
  rows.push(...rowsFor(inv, TOTAL_FIELDS));

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [{ wch: 22 }, { wch: 70 }];
  return sheet;
}

function wideColumnKeywords(label: string): boolean {
  const k = label.toLowerCase();
  return (
    k.includes("particular") ||
    k.includes("description") ||
    k.includes("product name") ||
    k.includes("item name") ||
    k.includes("description of goods")
  );
}

function buildLineItemsSheet(inv: Invoice): XLSX.WorkSheet {
  if (inv.lineItemColumns.length === 0) {
    return XLSX.utils.aoa_to_sheet([["(no line-item table detected)"]]);
  }
  const sheet = XLSX.utils.aoa_to_sheet([inv.lineItemColumns, ...inv.lineItems]);
  sheet["!cols"] = inv.lineItemColumns.map((label) =>
    wideColumnKeywords(label) ? { wch: 45 } : { wch: 14 },
  );
  return sheet;
}

function buildHsnSheet(inv: Invoice): XLSX.WorkSheet {
  const header = HSN_COLUMNS.map((c) => c.label);
  const data = inv.hsnSummary.map((row: HsnSummary) =>
    HSN_COLUMNS.map((c) => row[c.key] as CellValue),
  );
  const sheet = XLSX.utils.aoa_to_sheet([header, ...data]);
  sheet["!cols"] = HSN_COLUMNS.map(() => ({ wch: 14 }));
  return sheet;
}

// Returns the XLSX bytes. Works in both Node (server) and browser; the caller
// decides how to ship them — as a streamed `Content-Disposition: attachment`
// response (server) or wrapped in a Blob (browser).
export function buildXlsxBytes(inv: Invoice): Uint8Array {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildHeaderSheet(inv), "Header");
  XLSX.utils.book_append_sheet(wb, buildLineItemsSheet(inv), "Line Items");
  XLSX.utils.book_append_sheet(wb, buildHsnSheet(inv), "HSN Tax Summary");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;
}

export function sanitizeFilename(s: string): string {
  return s.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_");
}

export function xlsxFilename(inv: Invoice, fallback = "invoice"): string {
  const base = inv.invoiceNumber
    ? sanitizeFilename(inv.invoiceNumber)
    : sanitizeFilename(fallback);
  return `${base}.xlsx`;
}
