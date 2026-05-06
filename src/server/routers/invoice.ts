import { z } from "zod";
import { Types } from "mongoose";
import { TRPCError } from "@trpc/server";
import { router, requirePermission } from "../trpc";
import { Invoice, Payment, SalesOrder, Customer, Tenant } from "@/models";
import { recordAudit } from "../audit";
import { tenantStamp } from "../tenant-stamp";
import { nextNumber } from "../next-number";
import { addDays } from "date-fns";
import {
  generatePresignedGetUrl,
  uploadBuffer,
  buildS3Key,
} from "@/lib/s3";

export const invoiceRouter = router({
  list: requirePermission("invoice.read")
    .input(
      z
        .object({
          customerId: z.string().optional(),
          status: z.string().optional(),
          search: z.string().optional(),
          from: z.date().optional(),
          to: z.date().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const filter: any = {};
      if (input?.customerId) filter.customerId = input.customerId;
      if (input?.status) filter.status = input.status;
      if (input?.search) filter.invoiceNumber = { $regex: input.search, $options: "i" };
      if (input?.from || input?.to) {
        filter.invoiceDate = {};
        if (input.from) filter.invoiceDate.$gte = input.from;
        if (input.to) filter.invoiceDate.$lte = input.to;
      }
      return Invoice.find(filter)
        .populate("customerId", "name")
        .populate("salesOrderId", "orderNumber")
        .sort({ invoiceDate: -1 })
        .lean();
    }),

  byId: requirePermission("invoice.read")
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const inv = await Invoice.findById(input.id)
        .populate("customerId")
        .populate("salesOrderId")
        .lean();
      if (!inv) throw new TRPCError({ code: "NOT_FOUND" });
      const payments = await Payment.find({ invoiceId: input.id })
        .sort({ paymentDate: -1 })
        .lean();
      return { ...inv, payments };
    }),

  /**
   * Generate an invoice from a sales order. Computes totalAmount from
   * order items × prices and sets dueDate = invoiceDate + customer.creditDays.
   */
  createFromOrder: requirePermission("invoice.create")
    .input(
      z.object({
        salesOrderId: z.string(),
        invoiceNumber: z.string().optional(), // auto-generated server-side
        invoiceDate: z.date().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const order: any = await SalesOrder.findById(input.salesOrderId).lean();
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      const customer: any = await Customer.findById(order.customerId).lean();
      if (!customer) throw new TRPCError({ code: "NOT_FOUND" });
      const totalAmount = (order.items ?? []).reduce(
        (s: number, it: any) =>
          s + Math.round(Number(it.orderedTonnage?.toString() ?? 0) * (it.pricePerUnit ?? 0)),
        0,
      );
      const invoiceDate = input.invoiceDate ?? new Date();
      const dueDate = addDays(invoiceDate, customer.creditDays ?? 30);
      const invoiceNumber = input.invoiceNumber || (await nextNumber("INVOICE"));
      const inv = await Invoice.create({
        ...tenantStamp(),
        salesOrderId: input.salesOrderId,
        customerId: order.customerId,
        invoiceNumber,
        invoiceDate,
        dueDate,
        totalAmount,
        paidAmount: 0,
        status: "DRAFT",
      });
      await recordAudit({
        action: "invoice.create",
        entityType: "Invoice",
        entityId: String(inv._id),
        newValue: { ...input, totalAmount },
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });
      return { id: String(inv._id) };
    }),

  send: requirePermission("invoice.update")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await Invoice.findByIdAndUpdate(input.id, {
        $set: { status: "SENT", sentAt: new Date() },
      });
      return { ok: true };
    }),

  /**
   * Edit invoice metadata. Total/paid owned by recordPayment;
   * status by send/cancel/recordPayment.
   */
  update: requirePermission("invoice.update")
    .input(
      z.object({
        id: z.string(),
        invoiceDate: z.date().optional(),
        dueDate: z.date().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...rest } = input;
      const inv: any = await Invoice.findById(id);
      if (!inv) throw new TRPCError({ code: "NOT_FOUND" });
      if (inv.status === "CANCELLED" || inv.status === "PAID") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot edit a cancelled or fully paid invoice.",
        });
      }
      await Invoice.findByIdAndUpdate(id, {
        $set: { ...rest, updatedBy: ctx.user.id, pdfS3Key: undefined },
      });
      return { ok: true };
    }),

  recordPayment: requirePermission("payment.create")
    .input(
      z.object({
        invoiceId: z.string(),
        paymentDate: z.date(),
        amount: z.number().positive(),
        method: z.enum(["CASH", "BANK_TRANSFER", "UPI", "CHEQUE", "OTHER"]),
        referenceNumber: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const inv: any = await Invoice.findById(input.invoiceId);
      if (!inv) throw new TRPCError({ code: "NOT_FOUND" });
      const newPaid = (inv.paidAmount ?? 0) + input.amount;
      if (newPaid > inv.totalAmount + 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Payment amount exceeds invoice total.",
        });
      }
      const payment = await Payment.create({
        ...tenantStamp(),
        invoiceId: input.invoiceId,
        paymentDate: input.paymentDate,
        amount: input.amount,
        method: input.method,
        referenceNumber: input.referenceNumber ?? "",
        notes: input.notes ?? "",
        recordedByUserId: ctx.user.id,
      });
      inv.paidAmount = newPaid;
      inv.status =
        newPaid >= inv.totalAmount
          ? "PAID"
          : newPaid > 0
            ? "PARTIAL"
            : inv.status;
      await inv.save();
      await recordAudit({
        action: "invoice.payment",
        entityType: "Invoice",
        entityId: input.invoiceId,
        newValue: input,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });
      return { id: String(payment._id), invoiceStatus: inv.status };
    }),

  /**
   * Generate a simple PDF (text-based for now to avoid heavy server deps),
   * upload to S3, return a presigned download URL.
   */
  generatePdfUrl: requirePermission("invoice.read")
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const inv: any = await Invoice.findById(input.id).populate("customerId").lean();
      if (!inv) throw new TRPCError({ code: "NOT_FOUND" });
      // If we already have one stored, return it.
      if (inv.pdfS3Key) {
        const url = await generatePresignedGetUrl(inv.pdfS3Key, {
          downloadName: `${inv.invoiceNumber}.pdf`,
        });
        return { url };
      }
      // Lazy import pdfkit-style generator. For now, render a text PDF.
      const tenant: any = await Tenant.findById(ctx.user.tenantId).lean();
      const buffer = await renderInvoicePdf(inv, tenant);
      const key = buildS3Key({
        tenantId: ctx.user.tenantId,
        entityType: "INVOICE",
        entityId: String(inv._id),
        fileName: `${inv.invoiceNumber}.pdf`,
      });
      await uploadBuffer({ key, body: buffer, mimeType: "application/pdf" });
      await Invoice.findByIdAndUpdate(input.id, { $set: { pdfS3Key: key } });
      const url = await generatePresignedGetUrl(key, {
        downloadName: `${inv.invoiceNumber}.pdf`,
      });
      return { url };
    }),

  cancel: requirePermission("invoice.delete")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await Invoice.findByIdAndUpdate(input.id, { $set: { status: "CANCELLED" } });
      return { ok: true };
    }),
});

async function renderInvoicePdf(inv: any, tenant: any): Promise<Buffer> {
  // Use @react-pdf/renderer for the PDF
  const React = (await import("react")).default;
  const { renderToBuffer, Document, Page, Text, View, StyleSheet } = await import(
    "@react-pdf/renderer"
  );
  const styles = StyleSheet.create({
    page: { padding: 40, fontSize: 11, fontFamily: "Helvetica" },
    title: { fontSize: 18, marginBottom: 12 },
    row: { flexDirection: "row", marginBottom: 4 },
    label: { width: 120, color: "#444" },
    table: { marginTop: 16 },
    th: { flexDirection: "row", backgroundColor: "#eee", padding: 4 },
    td: { flexDirection: "row", padding: 4, borderBottom: "0.5pt solid #ddd" },
    cellNarrow: { width: 80 },
    cellWide: { flex: 1 },
  });

  const totalFmt = (n: number) =>
    `${tenant?.currency ?? "INR"} ${(n / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  const doc = React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      React.createElement(Text, { style: styles.title }, `${tenant?.name ?? "Invoice"}`),
      React.createElement(Text, null, `Invoice ${inv.invoiceNumber}`),
      React.createElement(Text, null, `Date: ${new Date(inv.invoiceDate).toLocaleDateString()}`),
      React.createElement(Text, null, `Due: ${new Date(inv.dueDate).toLocaleDateString()}`),
      React.createElement(Text, null, `Status: ${inv.status}`),
      React.createElement(View, { style: { marginTop: 20 } },
        React.createElement(Text, null, `Bill To: ${inv.customerId?.name ?? ""}`),
        React.createElement(Text, null, `${inv.customerId?.address ?? ""}`),
      ),
      React.createElement(View, { style: { marginTop: 24 } },
        React.createElement(Text, null, `Total: ${totalFmt(inv.totalAmount)}`),
        React.createElement(Text, null, `Paid: ${totalFmt(inv.paidAmount ?? 0)}`),
        React.createElement(Text, null, `Outstanding: ${totalFmt(inv.totalAmount - (inv.paidAmount ?? 0))}`),
      ),
    ),
  );
  return renderToBuffer(doc as any);
}
