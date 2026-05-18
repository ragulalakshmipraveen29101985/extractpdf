// Indian GST tax-invoice schema.
// Header / parties / HSN summary / totals stay structured. Line items
// switch to a PDF-shaped layout: `lineItemColumns` carries the literal
// column headers as printed on the invoice, and each row in `lineItems`
// is a positional array matching that column order.

export type Cell = string | number | null;

export type Party = {
  name: string | null;
  brand: string | null;
  address: string | null;
  gstin: string | null;
  stateCode: string | null;
  pan: string | null;
  email: string | null;
  phone: string | null;
};

export type ShipParty = {
  name: string | null;
  address: string | null;
  gstin: string | null;
  stateCode: string | null;
};

export type HsnSummary = {
  hsnCode: string | null;
  taxableValue: number | null;
  taxRatePercent: number | null;
  quantity: number | null;
  igstAmount: number | null;
  cgstAmount: number | null;
  sgstAmount: number | null;
  cessAmount: number | null;
  total: number | null;
};

export type Invoice = {
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;

  irn: string | null;
  ackNo: string | null;
  ackDate: string | null;

  poNumber: string | null;
  poDate: string | null;
  soNumber: string | null;
  orderNumber: string | null;
  orderDate: string | null;

  portal: string | null;
  paymentMode: string | null;
  paymentTerms: string | null;
  placeOfSupply: string | null;

  transporter: string | null;
  lrNumber: string | null;
  lrDate: string | null;
  awbNumber: string | null;
  dispatchThrough: string | null;
  noOfBoxes: number | null;
  weight: string | null;
  vehicleNumber: string | null;

  remarks: string | null;
  notes: string | null;

  vendor: Party;
  billTo: ShipParty;
  shipTo: ShipParty;

  lineItemColumns: string[];
  lineItems: Cell[][];

  hsnSummary: HsnSummary[];

  currency: string | null;
  totalQuantity: number | null;
  subtotal: number | null;
  totalIgst: number | null;
  totalCgst: number | null;
  totalSgst: number | null;
  totalCess: number | null;
  roundOff: number | null;
  grandTotal: number | null;
  amountInWords: string | null;
};

// ---------- Column metadata for the preview UI + Excel header sheet ----------

type FieldDef<T> = { key: keyof T; label: string };

export const INVOICE_BASIC_FIELDS: FieldDef<Invoice>[] = [
  { key: "invoiceNumber", label: "Invoice #" },
  { key: "invoiceDate", label: "Invoice Date" },
  { key: "dueDate", label: "Due Date" },
  { key: "placeOfSupply", label: "Place of Supply" },
  { key: "currency", label: "Currency" },
];

export const EINVOICE_FIELDS: FieldDef<Invoice>[] = [
  { key: "irn", label: "IRN" },
  { key: "ackNo", label: "Ack No" },
  { key: "ackDate", label: "Ack Date" },
];

export const ORDER_FIELDS: FieldDef<Invoice>[] = [
  { key: "poNumber", label: "PO Number" },
  { key: "poDate", label: "PO Date" },
  { key: "soNumber", label: "SO Number" },
  { key: "orderNumber", label: "Order Number" },
  { key: "orderDate", label: "Order Date" },
  { key: "portal", label: "Portal" },
  { key: "paymentMode", label: "Payment Mode" },
  { key: "paymentTerms", label: "Payment Terms" },
];

export const TRANSPORT_FIELDS: FieldDef<Invoice>[] = [
  { key: "transporter", label: "Transporter" },
  { key: "dispatchThrough", label: "Dispatch Through" },
  { key: "lrNumber", label: "LR Number" },
  { key: "lrDate", label: "LR Date" },
  { key: "awbNumber", label: "AWB Number" },
  { key: "vehicleNumber", label: "Vehicle Number" },
  { key: "noOfBoxes", label: "No. of Boxes" },
  { key: "weight", label: "Weight" },
];

export const TOTAL_FIELDS: FieldDef<Invoice>[] = [
  { key: "totalQuantity", label: "Total Quantity" },
  { key: "subtotal", label: "Subtotal (Taxable)" },
  { key: "totalIgst", label: "Total IGST" },
  { key: "totalCgst", label: "Total CGST" },
  { key: "totalSgst", label: "Total SGST" },
  { key: "totalCess", label: "Total Cess" },
  { key: "roundOff", label: "Round Off" },
  { key: "grandTotal", label: "Grand Total" },
  { key: "amountInWords", label: "Amount in Words" },
];

export const PARTY_FIELDS: FieldDef<Party>[] = [
  { key: "name", label: "Name" },
  { key: "brand", label: "Brand" },
  { key: "address", label: "Address" },
  { key: "gstin", label: "GSTIN" },
  { key: "stateCode", label: "State Code" },
  { key: "pan", label: "PAN" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
];

export const SHIP_PARTY_FIELDS: FieldDef<ShipParty>[] = [
  { key: "name", label: "Name" },
  { key: "address", label: "Address" },
  { key: "gstin", label: "GSTIN" },
  { key: "stateCode", label: "State Code" },
];

export const HSN_COLUMNS: FieldDef<HsnSummary>[] = [
  { key: "hsnCode", label: "HSN" },
  { key: "taxableValue", label: "Taxable Value" },
  { key: "taxRatePercent", label: "Tax %" },
  { key: "quantity", label: "Qty" },
  { key: "igstAmount", label: "IGST" },
  { key: "cgstAmount", label: "CGST" },
  { key: "sgstAmount", label: "SGST" },
  { key: "cessAmount", label: "Cess" },
  { key: "total", label: "Total" },
];
