/* eslint-disable react/no-unknown-property */
/**
 * Indian GST tax invoice generator.
 *
 * Uses tenant.settings to populate seller details (legalName, GSTIN, PAN,
 * address, state, stateCode, bank info, tax rate). Falls back to safe
 * defaults when fields aren't configured.
 *
 * Tax model:
 *   - intra-state (seller state == buyer state): CGST + SGST split
 *   - inter-state (states differ): IGST full
 *   - if state info missing on either side, falls back to IGST
 *
 * The invoice's totalAmount is treated as the taxable value (pre-tax)
 * since that's how it's computed today (tonnage × price). Tax is added
 * on top and the grand total is taxable + tax.
 */
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

type AnyDoc = Record<string, any>;

const COLORS = {
  ink: "#0f172a",
  inkSoft: "#475569",
  border: "#e2e8f0",
  bgSoft: "#f8fafc",
  bgAccent: "#eff6ff",
  primary: "#1d4ed8",
};

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: COLORS.ink,
    lineHeight: 1.35,
  },
  // Header
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brandBlock: { flexDirection: "column", flex: 1 },
  brandName: { fontSize: 14, fontWeight: "bold", marginBottom: 2 },
  brandLine: { fontSize: 9, color: COLORS.inkSoft },
  invoiceTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.primary,
    textAlign: "right",
  },
  invoiceSub: { fontSize: 9, color: COLORS.inkSoft, textAlign: "right", marginTop: 2 },

  hr: { borderBottom: 1, borderColor: COLORS.border, marginVertical: 10 },

  // Address grid
  addressGrid: { flexDirection: "row", marginTop: 6, gap: 12 },
  addressBox: { flex: 1, padding: 8, backgroundColor: COLORS.bgSoft, borderRadius: 4 },
  addressLabel: {
    fontSize: 7,
    fontWeight: "bold",
    color: COLORS.inkSoft,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  addressName: { fontSize: 11, fontWeight: "bold", marginBottom: 2 },

  // Meta strip
  metaRow: {
    flexDirection: "row",
    backgroundColor: COLORS.bgSoft,
    padding: 8,
    marginTop: 10,
    borderRadius: 4,
  },
  metaCell: { flex: 1 },
  metaLabel: { fontSize: 7, color: COLORS.inkSoft, textTransform: "uppercase", letterSpacing: 0.5 },
  metaValue: { fontSize: 10, fontWeight: "bold", marginTop: 2 },

  // Line items table
  table: { marginTop: 12, borderWidth: 1, borderColor: COLORS.border, borderRadius: 4 },
  thead: {
    flexDirection: "row",
    backgroundColor: COLORS.bgAccent,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderBottom: 1,
    borderColor: COLORS.border,
  },
  trow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderBottom: 0.5,
    borderColor: COLORS.border,
  },
  th: { fontSize: 8, fontWeight: "bold", color: COLORS.ink },
  td: { fontSize: 9 },
  cellSr: { width: 22 },
  cellDesc: { flex: 1, paddingRight: 6 },
  cellHsn: { width: 60 },
  cellQty: { width: 60, textAlign: "right" },
  cellRate: { width: 70, textAlign: "right" },
  cellAmt: { width: 80, textAlign: "right" },

  // Totals
  totalsBlock: { flexDirection: "row", marginTop: 12 },
  amountInWords: { flex: 1, padding: 8, backgroundColor: COLORS.bgSoft, borderRadius: 4, marginRight: 12 },
  amountWordsLabel: { fontSize: 7, color: COLORS.inkSoft, textTransform: "uppercase", letterSpacing: 0.5 },
  amountWordsValue: { fontSize: 10, fontWeight: "bold", marginTop: 3 },

  totalsTable: { width: 220 },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottom: 0.5,
    borderColor: COLORS.border,
  },
  totalsLabel: { fontSize: 9, color: COLORS.inkSoft },
  totalsValue: { fontSize: 9, fontWeight: "bold" },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 4,
    marginTop: 4,
  },
  grandLabel: { fontSize: 10, fontWeight: "bold", color: "#ffffff" },
  grandValue: { fontSize: 12, fontWeight: "bold", color: "#ffffff" },

  // Footer
  bankBox: {
    marginTop: 14,
    padding: 8,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: COLORS.border,
  },
  footerNote: { marginTop: 14, fontSize: 8, color: COLORS.inkSoft, textAlign: "center" },
  signature: { marginTop: 30, alignItems: "flex-end" },
  signatureLine: { borderTop: 0.5, borderColor: COLORS.ink, width: 160, marginTop: 30 },
  signatureLabel: { fontSize: 8, color: COLORS.inkSoft, marginTop: 3 },
});

function formatINR(amountMinor: number, currency = "INR") {
  const v = (amountMinor ?? 0) / 100;
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(v);
  } catch {
    return `${currency} ${v.toFixed(2)}`;
  }
}

/** Indian-style amount in words (Lakh / Crore numerology). */
function amountInWordsINR(amount: number): string {
  if (!Number.isFinite(amount)) return "";
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);

  const a = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function under1000(n: number): string {
    if (n === 0) return "";
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "");
    return a[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + under1000(n % 100) : "");
  }

  function inWords(n: number): string {
    if (n === 0) return "Zero";
    let out = "";
    const crore = Math.floor(n / 10000000);
    n %= 10000000;
    const lakh = Math.floor(n / 100000);
    n %= 100000;
    const thousand = Math.floor(n / 1000);
    n %= 1000;
    if (crore) out += under1000(crore) + " Crore ";
    if (lakh) out += under1000(lakh) + " Lakh ";
    if (thousand) out += under1000(thousand) + " Thousand ";
    if (n) out += under1000(n);
    return out.trim();
  }

  let words = `${inWords(rupees)} Rupees`;
  if (paise) words += ` and ${inWords(paise)} Paise`;
  return words + " Only";
}

export type InvoicePdfInput = {
  invoice: AnyDoc; // Invoice doc populated with customer
  order: AnyDoc | null; // SalesOrder populated with items
  tenant: AnyDoc;
  itemsResolved?: { name: string; hsn?: string; qty: number; unit: string; rate: number; amount: number }[];
};

export async function renderInvoicePdf(input: InvoicePdfInput): Promise<Buffer> {
  const { invoice, order, tenant } = input;
  const settings = (tenant?.settings ?? {}) as Record<string, any>;

  const sellerName = (settings.legalName as string) || tenant?.name || "Your Company";
  const sellerAddr = (settings.address as string) || "";
  const sellerGstin = (settings.gstin as string) || "";
  const sellerPan = (settings.pan as string) || "";
  const sellerStateCode = (settings.stateCode as string) || "";
  const sellerState = (settings.state as string) || "";
  const sellerEmail = (settings.email as string) || "";
  const sellerPhone = (settings.phone as string) || "";

  const customer = (invoice.customerId ?? {}) as AnyDoc;
  const buyerName = customer.name ?? "Customer";
  const buyerAddr = customer.address ?? "";
  const buyerGstin = customer.gstin ?? "";
  const buyerStateCode = customer.stateCode ?? "";
  const buyerState = customer.state ?? "";

  const taxRate = Number(settings.taxRate ?? 0.05); // default 5% sand
  const isIntra = !!sellerStateCode && !!buyerStateCode && sellerStateCode === buyerStateCode;

  const unit = tenant?.unitOfMeasure ?? "Tons";
  const currency = tenant?.currency ?? "INR";

  // Items: pull from the source sales order if provided
  const items =
    input.itemsResolved ??
    (order?.items ?? []).map((it: any, i: number) => ({
      name: it.gradeName ?? `Item ${i + 1}`,
      hsn: settings.defaultHsn ?? "2505",
      qty: Number(it.orderedTonnage?.toString?.() ?? it.orderedTonnage ?? 0),
      unit,
      rate: Number(it.pricePerUnit ?? 0) / 100,
      amount: (Number(it.orderedTonnage?.toString?.() ?? it.orderedTonnage ?? 0) * (it.pricePerUnit ?? 0)) / 100,
    }));

  // Money is stored in minor units. Treat invoice.totalAmount as taxable value.
  const taxableMinor = invoice.totalAmount ?? 0;
  const cgstMinor = isIntra ? Math.round((taxableMinor * taxRate) / 2) : 0;
  const sgstMinor = isIntra ? Math.round((taxableMinor * taxRate) / 2) : 0;
  const igstMinor = !isIntra ? Math.round(taxableMinor * taxRate) : 0;
  const totalTaxMinor = cgstMinor + sgstMinor + igstMinor;
  const grandMinor = taxableMinor + totalTaxMinor;

  const inv = invoice as AnyDoc;
  const invoiceNumber = inv.invoiceNumber ?? "—";
  const invoiceDate = inv.invoiceDate ? new Date(inv.invoiceDate) : new Date();
  const dueDate = inv.dueDate ? new Date(inv.dueDate) : new Date();
  const placeOfSupply = buyerState || buyerStateCode || sellerState || "—";

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.brandBlock}>
            <Text style={styles.brandName}>{sellerName}</Text>
            {sellerAddr ? <Text style={styles.brandLine}>{sellerAddr}</Text> : null}
            {(sellerEmail || sellerPhone) ? (
              <Text style={styles.brandLine}>
                {[sellerEmail, sellerPhone].filter(Boolean).join(" · ")}
              </Text>
            ) : null}
            {sellerGstin ? <Text style={styles.brandLine}>GSTIN: {sellerGstin}</Text> : null}
            {sellerPan ? <Text style={styles.brandLine}>PAN: {sellerPan}</Text> : null}
            {sellerState ? (
              <Text style={styles.brandLine}>
                State: {sellerState}
                {sellerStateCode ? ` (${sellerStateCode})` : ""}
              </Text>
            ) : null}
          </View>
          <View>
            <Text style={styles.invoiceTitle}>TAX INVOICE</Text>
            <Text style={styles.invoiceSub}>(Original for Recipient)</Text>
          </View>
        </View>

        <View style={styles.hr} />

        {/* Bill To / Ship To */}
        <View style={styles.addressGrid}>
          <View style={styles.addressBox}>
            <Text style={styles.addressLabel}>Bill To</Text>
            <Text style={styles.addressName}>{buyerName}</Text>
            {buyerAddr ? <Text>{buyerAddr}</Text> : null}
            {buyerGstin ? <Text>GSTIN: {buyerGstin}</Text> : null}
            {buyerState ? (
              <Text>
                State: {buyerState}
                {buyerStateCode ? ` (${buyerStateCode})` : ""}
              </Text>
            ) : null}
          </View>
          <View style={styles.addressBox}>
            <Text style={styles.addressLabel}>Ship To</Text>
            <Text style={styles.addressName}>{buyerName}</Text>
            {buyerAddr ? <Text>{buyerAddr}</Text> : null}
            <Text>Place of supply: {placeOfSupply}</Text>
          </View>
        </View>

        {/* Meta strip */}
        <View style={styles.metaRow}>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Invoice #</Text>
            <Text style={styles.metaValue}>{invoiceNumber}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Invoice Date</Text>
            <Text style={styles.metaValue}>{invoiceDate.toLocaleDateString("en-IN")}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Due Date</Text>
            <Text style={styles.metaValue}>{dueDate.toLocaleDateString("en-IN")}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Order #</Text>
            <Text style={styles.metaValue}>{order?.orderNumber ?? "—"}</Text>
          </View>
        </View>

        {/* Line items */}
        <View style={styles.table}>
          <View style={styles.thead}>
            <Text style={[styles.th, styles.cellSr]}>#</Text>
            <Text style={[styles.th, styles.cellDesc]}>Description</Text>
            <Text style={[styles.th, styles.cellHsn]}>HSN/SAC</Text>
            <Text style={[styles.th, styles.cellQty]}>Qty ({unit})</Text>
            <Text style={[styles.th, styles.cellRate]}>Rate</Text>
            <Text style={[styles.th, styles.cellAmt]}>Amount</Text>
          </View>
          {items.map((it: any, i: number) => (
            <View key={i} style={styles.trow}>
              <Text style={[styles.td, styles.cellSr]}>{i + 1}</Text>
              <Text style={[styles.td, styles.cellDesc]}>{it.name}</Text>
              <Text style={[styles.td, styles.cellHsn]}>{it.hsn ?? ""}</Text>
              <Text style={[styles.td, styles.cellQty]}>
                {it.qty.toLocaleString("en-IN", { maximumFractionDigits: 3 })}
              </Text>
              <Text style={[styles.td, styles.cellRate]}>
                {it.rate.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
              </Text>
              <Text style={[styles.td, styles.cellAmt]}>
                {it.amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
              </Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsBlock}>
          <View style={styles.amountInWords}>
            <Text style={styles.amountWordsLabel}>Amount in words</Text>
            <Text style={styles.amountWordsValue}>{amountInWordsINR(grandMinor / 100)}</Text>
          </View>
          <View style={styles.totalsTable}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Taxable value</Text>
              <Text style={styles.totalsValue}>{formatINR(taxableMinor, currency)}</Text>
            </View>
            {isIntra ? (
              <>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>CGST ({((taxRate / 2) * 100).toFixed(2)}%)</Text>
                  <Text style={styles.totalsValue}>{formatINR(cgstMinor, currency)}</Text>
                </View>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>SGST ({((taxRate / 2) * 100).toFixed(2)}%)</Text>
                  <Text style={styles.totalsValue}>{formatINR(sgstMinor, currency)}</Text>
                </View>
              </>
            ) : (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>IGST ({(taxRate * 100).toFixed(2)}%)</Text>
                <Text style={styles.totalsValue}>{formatINR(igstMinor, currency)}</Text>
              </View>
            )}
            <View style={styles.grandRow}>
              <Text style={styles.grandLabel}>Grand Total</Text>
              <Text style={styles.grandValue}>{formatINR(grandMinor, currency)}</Text>
            </View>
          </View>
        </View>

        {/* Bank details */}
        {(settings.bankName || settings.bankAccount || settings.bankIfsc) ? (
          <View style={styles.bankBox}>
            <Text style={styles.addressLabel}>Bank details</Text>
            {settings.bankName ? <Text>Bank: {settings.bankName}</Text> : null}
            {settings.bankAccount ? <Text>A/C: {settings.bankAccount}</Text> : null}
            {settings.bankIfsc ? <Text>IFSC: {settings.bankIfsc}</Text> : null}
            {settings.bankBranch ? <Text>Branch: {settings.bankBranch}</Text> : null}
            {settings.upiId ? <Text>UPI: {settings.upiId}</Text> : null}
          </View>
        ) : null}

        {/* Signature */}
        <View style={styles.signature}>
          <View style={styles.signatureLine} />
          <Text style={styles.signatureLabel}>Authorised signatory · {sellerName}</Text>
        </View>

        <Text style={styles.footerNote}>
          {settings.invoiceFooterNote ??
            "This is a computer-generated invoice. Subject to your local jurisdiction."}
        </Text>
      </Page>
    </Document>
  );

  return renderToBuffer(doc as any);
}
